import { type ResolveCursorConnectionArgs, resolveCursorConnection } from "@pothos/plugin-relay";
import { and, inArray, type SQL } from "drizzle-orm";
import type { Address, AssetNamespace, NormalizedAddress } from "enssdk";

import type { CurrencyId } from "@ensnode/ensnode-sdk";

import di from "@/di";
import { builder } from "@/omnigraph-api/builder";
import {
  orderByTimestampIdDesc,
  paginateByTimestampIdDesc,
} from "@/omnigraph-api/lib/connection-helpers";
import { cursors } from "@/omnigraph-api/lib/cursors";
import { getModelId } from "@/omnigraph-api/lib/get-model-id";
import { lazyConnection } from "@/omnigraph-api/lib/lazy-connection";
import { AccountRef } from "@/omnigraph-api/schema/account";
import {
  PAGINATION_DEFAULT_MAX_SIZE,
  PAGINATION_DEFAULT_PAGE_SIZE,
} from "@/omnigraph-api/schema/constants";
import { DomainInterfaceRef } from "@/omnigraph-api/schema/domain";
import { AssetNamespaceRef, PriceRef } from "@/omnigraph-api/schema/price";

export const NameSaleRef = builder.loadableObjectRef("NameSale", {
  load: (ids: string[]) => {
    const { ensDb, ensIndexerSchema } = di.context;
    return ensDb
      .select()
      .from(ensIndexerSchema.nameSales)
      .where(inArray(ensIndexerSchema.nameSales.id, ids));
  },
  toKey: getModelId,
  cacheResolved: true,
  sort: true,
});

export type NameSale = Exclude<typeof NameSaleRef.$inferType, string>;

/**
 * Connection args for newest-first `name_sales` pagination. The cursor encodes the `(timestamp,
 * id)` composite so it stays stable across same-timestamp ties (see `paginateByTimestampIdDesc`).
 */
export const NAME_SALE_CONNECTION_ARGS = {
  toCursor: (model: { timestamp: bigint; id: string }) =>
    cursors.encode({ timestamp: model.timestamp, id: model.id }),
  defaultSize: PAGINATION_DEFAULT_PAGE_SIZE,
  maxSize: PAGINATION_DEFAULT_MAX_SIZE,
} as const;

/**
 * Builds a newest-first (`timestamp DESC, id DESC`), cursor-paginated connection over the
 * `name_sales` rows matching `scope`. Shared by `market.sales`, `Domain.sales`, and
 * `Account.market.{purchases,sales}`.
 */
export const nameSalesConnection = <A extends object>(scope: SQL | undefined, args: A) => {
  const { ensDb, ensIndexerSchema } = di.context;
  const sales = ensIndexerSchema.nameSales;

  return lazyConnection({
    totalCount: () => ensDb.$count(sales, scope),
    connection: () =>
      resolveCursorConnection(
        { ...NAME_SALE_CONNECTION_ARGS, args },
        ({ before, after, limit, inverted }: ResolveCursorConnectionArgs) =>
          ensDb
            .select()
            .from(sales)
            .where(and(scope, paginateByTimestampIdDesc(sales.timestamp, sales.id, before, after)))
            .orderBy(...orderByTimestampIdDesc(sales.timestamp, sales.id, inverted))
            .limit(limit),
      ),
  });
};

////////////
// NameSale
////////////
NameSaleRef.implement({
  description:
    "A NameSale is a completed secondary-market sale of an ENS name NFT, parsed from a Seaport `OrderFulfilled` event by the TokenScope plugin.",
  fields: (t) => ({
    id: t.field({
      description: "A unique reference to this NameSale.",
      type: "ID",
      nullable: false,
      resolve: (parent) => parent.id,
    }),
    chainId: t.field({
      description: "The ChainId on which the sale occurred.",
      type: "ChainId",
      nullable: false,
      resolve: (parent) => parent.chainId,
    }),
    blockNumber: t.field({
      description: "The block number on `chainId` in which the sale occurred.",
      type: "BigInt",
      nullable: false,
      resolve: (parent) => parent.blockNumber,
    }),
    logIndex: t.field({
      description: "The log index of the sale event within its block.",
      type: "Int",
      nullable: false,
      resolve: (parent) => parent.logIndex,
    }),
    transactionHash: t.field({
      description: "The hash of the transaction in which the sale occurred.",
      type: "Hex",
      nullable: false,
      resolve: (parent) => parent.transactionHash,
    }),
    orderHash: t.field({
      description: "The Seaport order hash for the sale.",
      type: "Hex",
      nullable: false,
      resolve: (parent) => parent.orderHash,
    }),
    contractAddress: t.field({
      description: "The address of the NFT contract that manages the sold token.",
      type: "Address",
      nullable: false,
      resolve: (parent) => parent.contractAddress as NormalizedAddress,
    }),
    tokenId: t.field({
      description: "The id of the sold token within `contractAddress`.",
      type: "BigInt",
      nullable: false,
      resolve: (parent) => parent.tokenId,
    }),
    assetNamespace: t.field({
      description: "The CAIP-19 Asset Namespace of the sold token.",
      type: AssetNamespaceRef,
      nullable: false,
      resolve: (parent) => parent.assetNamespace as AssetNamespace,
    }),
    assetId: t.field({
      description: "The CAIP-19 Asset Id of the sold token.",
      type: "String",
      nullable: false,
      resolve: (parent) => parent.assetId,
    }),
    domain: t.field({
      description:
        "The Domain whose name was sold, if it is part of the canonical nametree. Null for a sale of a non-canonical name.",
      type: DomainInterfaceRef,
      nullable: true,
      resolve: (parent, _args, context) =>
        context.loaders.domainIdByCanonicalNode.load(parent.domainId),
    }),
    buyer: t.field({
      description: "The account that bought the token.",
      type: AccountRef,
      nullable: false,
      resolve: (parent) => parent.buyer as Address,
    }),
    seller: t.field({
      description: "The account that sold the token.",
      type: AccountRef,
      nullable: false,
      resolve: (parent) => parent.seller as Address,
    }),
    price: t.field({
      description: "The payment from buyer to seller in exchange for the token.",
      type: PriceRef,
      nullable: false,
      resolve: (parent) => ({ currency: parent.currency as CurrencyId, amount: parent.amount }),
    }),
    timestamp: t.field({
      description: "The Unix timestamp of the block in which the sale occurred.",
      type: "BigInt",
      nullable: false,
      resolve: (parent) => parent.timestamp,
    }),
  }),
});
