import DataLoader from "dataloader";
import { getUnixTime } from "date-fns";
import { and, eq, inArray } from "drizzle-orm";
import type { DomainId, Node, RegistryId } from "enssdk";
import type { Hex } from "viem";

import di from "@/di";
import type { CanAccelerateMiddlewareVariables } from "@/middleware/can-accelerate.middleware";

/** Server context passed from Hono into GraphQL Yoga via `yoga.fetch(request, serverContext)`. */
export type OmnigraphYogaServerContext = CanAccelerateMiddlewareVariables;

const createRegistryParentDomainLoader = () =>
  new DataLoader<RegistryId, DomainId | null>(async (registryIds) => {
    const { ensDb, ensIndexerSchema } = di.context;
    const rows = await ensDb
      .select({
        id: ensIndexerSchema.registry.id,
        canonicalDomainId: ensIndexerSchema.registry.canonicalDomainId,
      })
      .from(ensIndexerSchema.registry)
      .where(inArray(ensIndexerSchema.registry.id, registryIds as RegistryId[]));
    const byId = new Map(rows.map((r) => [r.id, r.canonicalDomainId ?? null]));
    return registryIds.map((id) => byId.get(id) ?? null);
  });

/**
 * Loads the canonical Domain's `DomainId` for a given canonical `Node` (namehash). TokenScope's
 * `name_sales` / `name_tokens` reference a name by its bare `Node`, which equals the canonical
 * Domain's materialized `canonicalNode`. `canonicalNode` is non-null iff the Domain is canonical,
 * and the canonical nametree holds exactly one canonical Domain per `Node` (an invariant
 * maintained by `canonicality-db-helpers.ts`), so this resolves to at most one `DomainId`.
 */
const createDomainIdByCanonicalNodeLoader = () =>
  new DataLoader<Hex, DomainId | null>(async (canonicalNodes) => {
    const { ensDb, ensIndexerSchema } = di.context;
    const rows = await ensDb
      .select({
        id: ensIndexerSchema.domain.id,
        canonicalNode: ensIndexerSchema.domain.canonicalNode,
      })
      .from(ensIndexerSchema.domain)
      .where(
        and(
          eq(ensIndexerSchema.domain.canonical, true),
          inArray(ensIndexerSchema.domain.canonicalNode, canonicalNodes as unknown as Node[]),
        ),
      );
    const byNode = new Map<Hex, DomainId>();
    for (const row of rows) {
      if (row.canonicalNode) byNode.set(row.canonicalNode as Hex, row.id);
    }
    return canonicalNodes.map((node) => byNode.get(node) ?? null);
  });

/**
 * Constructs a new GraphQL Context per-request.
 *
 * @dev make sure that anything that is per-request (like dataloaders) are newly created in this fn
 */
export const createOmnigraphContext = (serverContext: OmnigraphYogaServerContext) => ({
  now: BigInt(getUnixTime(new Date())),
  loaders: {
    registryParentDomain: createRegistryParentDomainLoader(),
    domainIdByCanonicalNode: createDomainIdByCanonicalNodeLoader(),
  },
  canAccelerate: serverContext.canAccelerate,
});

export type Context = ReturnType<typeof createOmnigraphContext>;
