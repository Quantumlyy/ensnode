import { and, eq, gte, lte } from "drizzle-orm";
import type { Hex } from "viem";

import di from "@/di";
import { builder } from "@/omnigraph-api/builder";
import { NameSaleRef, nameSalesConnection } from "@/omnigraph-api/schema/name-sale";
import { NameSalesWhereInput } from "@/omnigraph-api/schema/name-sale-inputs";

/**
 * `MarketQuery` namespaces all ENS secondary-market queries under a single root `market` field,
 * keeping the market surface self-contained and the Query root uncluttered. It is also the home
 * for future off-chain order-book types (listings, offers) federated from a marketplace API.
 */
const MarketQueryRef = builder.objectRef<Record<string, never>>("MarketQuery");

MarketQueryRef.implement({
  description: "Queries for ENS secondary-market data indexed from on-chain Seaport sales.",
  fields: (t) => ({
    //////////////////
    // market.sale
    //////////////////
    sale: t.field({
      description: "Get a NameSale by its id.",
      type: NameSaleRef,
      nullable: true,
      args: { id: t.arg({ type: "ID", required: true }) },
      resolve: (_parent, args) => String(args.id),
    }),

    //////////////////
    // market.sales
    //////////////////
    sales: t.connection({
      description: "Find ENS name sales, newest first, optionally filtered.",
      type: NameSaleRef,
      args: { where: t.arg({ type: NameSalesWhereInput }) },
      resolve: (_parent, args) => {
        const { ensIndexerSchema } = di.context;
        const sales = ensIndexerSchema.nameSales;
        const where = args.where;
        const scope = and(
          where?.buyer ? eq(sales.buyer, where.buyer as Hex) : undefined,
          where?.seller ? eq(sales.seller, where.seller as Hex) : undefined,
          where?.assetId ? eq(sales.assetId, where.assetId) : undefined,
          where?.currency ? eq(sales.currency, where.currency) : undefined,
          where?.since != null ? gte(sales.timestamp, where.since) : undefined,
          where?.until != null ? lte(sales.timestamp, where.until) : undefined,
        );

        return nameSalesConnection(scope, args);
      },
    }),
  }),
});

/////////////////////////////////////////
// Query.market — the single market namespace
/////////////////////////////////////////
builder.queryField("market", (t) =>
  t.field({
    description: "ENS secondary-market queries.",
    type: MarketQueryRef,
    nullable: false,
    resolve: () => ({}),
  }),
);
