import { AssetNamespaces } from "enssdk";

import { type CurrencyId, CurrencyIds } from "@ensnode/ensnode-sdk";

import { builder } from "@/omnigraph-api/builder";

/**
 * The currency a secondary-market payment is denominated in.
 *
 * Derived from `@ensnode/ensnode-sdk`'s `CurrencyIds` so the GraphQL enum can never drift from
 * the set of currencies TokenScope's Seaport indexer writes to `name_sales.currency`.
 */
export const CurrencyRef = builder.enumType("Currency", {
  description: "A currency in which a secondary-market payment may be denominated.",
  values: Object.values(CurrencyIds),
});

/**
 * The CAIP-19 Asset Namespace of a token.
 *
 * @see https://chainagnostic.org/CAIPs/caip-19
 */
export const AssetNamespaceRef = builder.enumType("AssetNamespace", {
  description: "The CAIP-19 Asset Namespace of a token (https://chainagnostic.org/CAIPs/caip-19).",
  values: Object.values(AssetNamespaces),
});

/**
 * A payment amount in a specific currency, denominated in that currency's smallest unit.
 *
 * Mirrors `@ensnode/ensnode-sdk`'s `Price`. Shared by all secondary-market types: the Phase 1
 * `NameSale` and future off-chain `Listing` / `Offer` types.
 */
export interface PriceModel {
  currency: CurrencyId;
  amount: bigint;
}

export const PriceRef = builder.objectRef<PriceModel>("Price");

PriceRef.implement({
  description:
    "A payment amount in a specific currency. `amount` is denominated in the currency's smallest unit (e.g. wei for ETH, micro-units for USDC).",
  fields: (t) => ({
    currency: t.field({
      description: "The currency of the payment.",
      type: CurrencyRef,
      nullable: false,
      resolve: (parent) => parent.currency,
    }),
    amount: t.field({
      description: "The amount paid, denominated in the currency's smallest unit.",
      type: "BigInt",
      nullable: false,
      resolve: (parent) => parent.amount,
    }),
  }),
});
