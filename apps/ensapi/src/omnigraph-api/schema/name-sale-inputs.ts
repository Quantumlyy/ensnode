import { builder } from "@/omnigraph-api/builder";
import { CurrencyRef } from "@/omnigraph-api/schema/price";

/**
 * Filters for the `market.sales` connection.
 */
export const NameSalesWhereInput = builder.inputType("NameSalesWhereInput", {
  description: "Filters for finding ENS name sales.",
  fields: (t) => ({
    buyer: t.field({ type: "Address", description: "Only sales bought by this account." }),
    seller: t.field({ type: "Address", description: "Only sales sold by this account." }),
    assetId: t.field({ type: "String", description: "Only sales of this CAIP-19 Asset Id." }),
    currency: t.field({ type: CurrencyRef, description: "Only sales paid in this currency." }),
    since: t.field({
      type: "BigInt",
      description: "Only sales at or after this Unix timestamp (inclusive).",
    }),
    until: t.field({
      type: "BigInt",
      description: "Only sales at or before this Unix timestamp (inclusive).",
    }),
  }),
});
