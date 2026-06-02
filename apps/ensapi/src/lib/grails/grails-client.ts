import type { Hex } from "viem";
import { z } from "zod/v4";

import { makeLogger } from "@/lib/logger";

const logger = makeLogger("grails");

/**
 * api.grails.app sits behind a WAF that 403s requests lacking a browser-like User-Agent. Reads are
 * otherwise public (no auth), so a realistic UA is all that is required for server-side federation.
 */
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** Live order-book data is volatile; cache GET responses only briefly to absorb fan-out. */
const CACHE_TTL_MS = 30_000;
/** Federated data is best-effort; never let a slow upstream stall a GraphQL query for long. */
const REQUEST_TIMEOUT_MS = 5_000;
/** Cap concurrent upstream requests so a wide query (e.g. many domains) cannot fan out unbounded. */
const MAX_CONCURRENT_REQUESTS = 6;
/** Grails caps page size at 100; account-rooted result sets are truncated to this. */
const PAGE_LIMIT = 100;

/** A live secondary-market sell order ("Buy Now") for an ENS name, as reported by Grails. */
export interface GrailsListing {
  id: number;
  name: string;
  tokenId: bigint;
  seller: Hex;
  priceWei: bigint;
  currencyAddress: Hex;
  orderHash: Hex;
  status: string;
  source: string;
  expiresAt: string | null;
  createdAt: string | null;
}

/** A live secondary-market buy order (bid) for an ENS name, as reported by Grails. */
export interface GrailsOffer {
  id: number;
  name: string;
  tokenId: bigint;
  buyer: Hex;
  priceWei: bigint;
  currencyAddress: Hex;
  orderHash: Hex;
  status: string;
  source: string;
  expiresAt: string | null;
  createdAt: string | null;
}

const toHex = (value: string): Hex => value.toLowerCase() as Hex;
/** A non-negative integer encoded as a decimal string (token ids and wei amounts). */
const numericString = z.string().regex(/^\d+$/);

const ListingSchema = z
  .object({
    id: z.number(),
    ens_name: z.string(),
    token_id: numericString,
    seller_address: z.string(),
    price_wei: numericString,
    currency_address: z.string(),
    order_hash: z.string(),
    status: z.string(),
    source: z.string(),
    expires_at: z.string().nullish(),
    created_at: z.string().nullish(),
  })
  .transform(
    (r): GrailsListing => ({
      id: r.id,
      name: r.ens_name,
      tokenId: BigInt(r.token_id),
      seller: toHex(r.seller_address),
      priceWei: BigInt(r.price_wei),
      currencyAddress: toHex(r.currency_address),
      orderHash: toHex(r.order_hash),
      status: r.status,
      source: r.source,
      expiresAt: r.expires_at ?? null,
      createdAt: r.created_at ?? null,
    }),
  );

const OfferSchema = z
  .object({
    id: z.number(),
    name: z.string().nullish(),
    token_id: numericString,
    buyer_address: z.string(),
    offer_amount_wei: numericString,
    currency_address: z.string(),
    order_hash: z.string(),
    status: z.string(),
    source: z.string(),
    expires_at: z.string().nullish(),
    created_at: z.string().nullish(),
  })
  .transform(
    (r): GrailsOffer => ({
      id: r.id,
      name: r.name ?? "",
      tokenId: BigInt(r.token_id),
      buyer: toHex(r.buyer_address),
      priceWei: BigInt(r.offer_amount_wei),
      currencyAddress: toHex(r.currency_address),
      orderHash: toHex(r.order_hash),
      status: r.status,
      source: r.source,
      expiresAt: r.expires_at ?? null,
      createdAt: r.created_at ?? null,
    }),
  );

/**
 * Grails is inconsistent: collection endpoints wrap rows under `data.<key>` (with pagination),
 * while name-scoped endpoints return `data` as a bare array. Handle both shapes.
 */
function extractRows(json: unknown, key: "listings" | "offers"): unknown[] {
  if (json === null || typeof json !== "object") return [];
  const data = (json as { data?: unknown }).data;
  if (Array.isArray(data)) return data;
  if (data !== null && typeof data === "object") {
    const rows = (data as Record<string, unknown>)[key];
    if (Array.isArray(rows)) return rows;
  }
  return [];
}

function parseRows<S extends z.ZodTypeAny>(rows: unknown[], schema: S): z.infer<S>[] {
  const parsed: z.infer<S>[] = [];
  for (const row of rows) {
    const result = schema.safeParse(row);
    if (result.success) parsed.push(result.data);
  }
  return parsed;
}

/** A concurrency limiter: at most `max` thunks run at once; the rest queue. */
function createLimiter(max: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  return async function run<T>(thunk: () => Promise<T>): Promise<T> {
    if (active >= max) await new Promise<void>((resolve) => queue.push(resolve));
    active++;
    try {
      return await thunk();
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}

/**
 * Client for the Grails marketplace REST API (https://api.grails.app), federating live order-book
 * data (active listings and offers) that cannot be derived on-chain.
 *
 * Read access is public; the client sets a browser User-Agent to pass the WAF. It is fail-soft:
 * every method returns an empty array on a disabled client, timeout, non-2xx, or unparseable body,
 * so federated GraphQL fields degrade to empty rather than breaking the surrounding query. It is
 * disabled (a no-op) when no base URL is configured.
 */
export class GrailsClient {
  readonly enabled: boolean;
  private readonly baseUrl: string;
  private readonly cache = new Map<string, { at: number; value: Promise<unknown> }>();
  private readonly limit = createLimiter(MAX_CONCURRENT_REQUESTS);

  constructor(baseUrl: string | undefined) {
    this.enabled = baseUrl !== undefined;
    this.baseUrl = baseUrl ?? "";
  }

  /** Active listings for a specific ENS name (a small, unpaginated set). */
  async listingsByName(name: string): Promise<GrailsListing[]> {
    const rows = await this.get(`/listings/name/${encodeURIComponent(name)}?limit=${PAGE_LIMIT}`);
    return parseRows(extractRows(rows, "listings"), ListingSchema).filter(isActiveListing);
  }

  /** Pending offers for a specific ENS name. */
  async offersByName(name: string): Promise<GrailsOffer[]> {
    const rows = await this.get(`/offers/name/${encodeURIComponent(name)}?limit=${PAGE_LIMIT}`);
    return parseRows(extractRows(rows, "offers"), OfferSchema).filter(isPendingOffer);
  }

  /** Active listings created by an account (truncated to {@link PAGE_LIMIT}). */
  async listingsBySeller(seller: string): Promise<GrailsListing[]> {
    const rows = await this.get(`/listings?seller=${seller}&status=active&limit=${PAGE_LIMIT}`);
    return parseRows(extractRows(rows, "listings"), ListingSchema).filter(isActiveListing);
  }

  /** Pending offers made by an account (truncated to {@link PAGE_LIMIT}). */
  async offersByBuyer(buyer: string): Promise<GrailsOffer[]> {
    const rows = await this.get(`/offers/buyer/${buyer}?status=pending&limit=${PAGE_LIMIT}`);
    return parseRows(extractRows(rows, "offers"), OfferSchema).filter(isPendingOffer);
  }

  private async get(path: string): Promise<unknown> {
    if (!this.enabled) return null;

    const url = `${this.baseUrl}${path}`;
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

    const value = this.limit(() => fetchJson(url));
    this.cache.set(url, { at: Date.now(), value });
    // Do not retain failures: evict once a `null` result settles so the next call can retry.
    void value.then((result) => {
      if (result === null) this.cache.delete(url);
    });

    return value;
  }
}

const isActiveListing = (listing: GrailsListing) => listing.status === "active";
const isPendingOffer = (offer: GrailsOffer) => offer.status === "pending";

/** Fetches and JSON-parses a URL, returning `null` on 404, any non-2xx, timeout, or error. */
async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": BROWSER_USER_AGENT, accept: "application/json" },
      signal: controller.signal,
    });

    // Some name-scoped endpoints 404 when a name has no orders; treat as empty, not an error.
    if (response.status === 404) return null;
    if (!response.ok) {
      logger.warn(`Grails request failed (HTTP ${response.status}): ${url}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    logger.warn(error, `Grails request errored: ${url}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
