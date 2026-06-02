import { afterEach, describe, expect, it, vi } from "vitest";

import { GrailsClient } from "@/lib/grails/grails-client";

vi.mock("@/lib/logger", () => ({
  makeLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

// A real listing captured from api.grails.app: the name-scoped endpoint returns `data` as a BARE
// ARRAY (no pagination), unlike collection endpoints which wrap rows in `data.listings`.
const ACTIVE_LISTING = {
  id: 522772,
  ens_name_id: 4006646,
  seller_address: "0x891866b2286a1279f59bfc7f4fef464235ce3edd",
  price_wei: "6900000000000000000",
  currency_address: "0x0000000000000000000000000000000000000000",
  order_hash: "0x61fdc72f4e7fb201247a1a43341e70fa887301be329cc81e274a54703c1e83e7",
  order_data: { marketplace: "grails" },
  status: "active",
  source: "grails",
  created_at: "2026-06-02T15:37:04.966Z",
  updated_at: "2026-06-02T15:37:04.966Z",
  expires_at: "2026-08-31T15:31:09.000Z",
  ens_name: "domainsbyproxy.eth",
  token_id: "50803852554859256139084209058435638887569369498364743634114394306323568778870",
  current_owner: "0x891866b2286a1279f59bfc7f4fef464235ce3edd",
};

const LISTINGS_BY_NAME_RESPONSE = { success: true, data: [ACTIVE_LISTING] };

// A real offer captured from api.grails.app: the name-scoped offers endpoint WRAPS rows in
// `data.offers` with pagination, and offers are commonly denominated in WETH (not native ETH).
const PENDING_OFFER = {
  id: 2216324,
  ens_name_id: 648778,
  buyer_address: "0x8426652892453b396e4d8053d99a27e07588900f",
  offer_amount_wei: "1000000000000000",
  currency_address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  order_hash: "0xef5e3ade3a9e352d84406ef02a00c021361dd480b139881a85d843ab4b0924b6",
  order_data: {},
  status: "pending",
  source: "opensea",
  created_at: "2026-03-13T20:19:46.072Z",
  expires_at: "2026-09-09T20:19:32.000Z",
  name: "000.eth",
  token_id: "2429365535908439898376214895795188736773474111528346913",
};

const OFFERS_BY_NAME_RESPONSE = {
  success: true,
  data: {
    offers: [PENDING_OFFER],
    pagination: { page: 1, limit: 3, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
  },
  meta: { timestamp: "2026-06-02T16:15:08.784Z", version: "1.0.0" },
};

const okResponse = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

const stubFetch = (impl: (url: string) => unknown) => {
  const fn = vi.fn(async (url: string) => impl(url));
  vi.stubGlobal("fetch", fn);
  return fn;
};

const BASE_URL = "https://grails.test/api/v1";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GrailsClient (disabled)", () => {
  it("is disabled and returns empty without fetching when no base URL is configured", async () => {
    const fetchFn = stubFetch(() => okResponse(LISTINGS_BY_NAME_RESPONSE));
    const client = new GrailsClient(undefined);

    expect(client.enabled).toBe(false);
    await expect(client.listingsByName("x.eth")).resolves.toEqual([]);
    await expect(client.offersByName("x.eth")).resolves.toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("GrailsClient.listingsByName", () => {
  it("parses the name-scoped bare-array shape and maps fields, sending a browser User-Agent", async () => {
    const fetchFn = stubFetch(() => okResponse(LISTINGS_BY_NAME_RESPONSE));
    const client = new GrailsClient(BASE_URL);

    const listings = await client.listingsByName("domainsbyproxy.eth");

    expect(listings).toHaveLength(1);
    expect(listings[0]).toMatchObject({
      id: 522772,
      name: "domainsbyproxy.eth",
      tokenId: 50803852554859256139084209058435638887569369498364743634114394306323568778870n,
      seller: "0x891866b2286a1279f59bfc7f4fef464235ce3edd",
      priceWei: 6900000000000000000n,
      currencyAddress: "0x0000000000000000000000000000000000000000",
      orderHash: "0x61fdc72f4e7fb201247a1a43341e70fa887301be329cc81e274a54703c1e83e7",
      status: "active",
      source: "grails",
      expiresAt: "2026-08-31T15:31:09.000Z",
    });
    expect(fetchFn).toHaveBeenCalledWith(
      expect.stringContaining("/listings/name/domainsbyproxy.eth"),
      expect.objectContaining({
        headers: expect.objectContaining({ "User-Agent": expect.stringContaining("Mozilla") }),
      }),
    );
  });

  it("treats a 404 as an empty result, not an error", async () => {
    stubFetch(() => ({ ok: false, status: 404, json: async () => null }));
    const client = new GrailsClient(BASE_URL);

    await expect(client.listingsByName("vitalik.eth")).resolves.toEqual([]);
  });

  it("fails soft to empty on a network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );
    const client = new GrailsClient(BASE_URL);

    await expect(client.listingsByName("x.eth")).resolves.toEqual([]);
  });

  it("filters out non-active listings", async () => {
    const body = {
      success: true,
      data: [ACTIVE_LISTING, { ...ACTIVE_LISTING, id: 999, status: "sold" }],
    };
    stubFetch(() => okResponse(body));
    const client = new GrailsClient(BASE_URL);

    const listings = await client.listingsByName("domainsbyproxy.eth");
    expect(listings).toHaveLength(1);
    expect(listings[0]?.status).toBe("active");
  });
});

describe("GrailsClient.offersByName", () => {
  it("parses the wrapped data.offers shape, including a WETH currency", async () => {
    stubFetch(() => okResponse(OFFERS_BY_NAME_RESPONSE));
    const client = new GrailsClient(BASE_URL);

    const offers = await client.offersByName("000.eth");

    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({
      id: 2216324,
      name: "000.eth",
      buyer: "0x8426652892453b396e4d8053d99a27e07588900f",
      priceWei: 1000000000000000n,
      currencyAddress: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
      status: "pending",
      source: "opensea",
    });
  });

  it("filters out non-pending offers", async () => {
    const body = {
      success: true,
      data: { offers: [PENDING_OFFER, { ...PENDING_OFFER, id: 5, status: "expired" }] },
    };
    stubFetch(() => okResponse(body));
    const client = new GrailsClient(BASE_URL);

    const offers = await client.offersByName("000.eth");
    expect(offers).toHaveLength(1);
    expect(offers[0]?.status).toBe("pending");
  });
});
