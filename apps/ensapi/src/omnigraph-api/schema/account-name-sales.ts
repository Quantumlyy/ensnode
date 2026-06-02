import { eq } from "drizzle-orm";
import type { NormalizedAddress } from "enssdk";
import type { Hex } from "viem";

import di from "@/di";
import { builder } from "@/omnigraph-api/builder";
import { ListingRef } from "@/omnigraph-api/schema/listing";
import { NameSaleRef, nameSalesConnection } from "@/omnigraph-api/schema/name-sale";
import { OfferRef } from "@/omnigraph-api/schema/offer";

/**
 * `AccountMarket` is the account-rooted view of ENS secondary-market activity, reached via
 * `Account.market`. Its parent is the account's address. Named distinctly from "sales" because it
 * also holds purchases and is the home for future off-chain listings/offers for the account.
 */
export const AccountMarketRef = builder.objectRef<NormalizedAddress>("AccountMarket");

AccountMarketRef.implement({
  description: "An account's ENS secondary-market activity.",
  fields: (t) => ({
    /////////////////////////
    // AccountMarket.purchases
    /////////////////////////
    purchases: t.connection({
      description: "Sales in which this account was the buyer, newest first.",
      type: NameSaleRef,
      resolve: (address, args) => {
        const { ensIndexerSchema } = di.context;
        return nameSalesConnection(eq(ensIndexerSchema.nameSales.buyer, address as Hex), args);
      },
    }),

    /////////////////////
    // AccountMarket.sales
    /////////////////////
    sales: t.connection({
      description: "Sales in which this account was the seller, newest first.",
      type: NameSaleRef,
      resolve: (address, args) => {
        const { ensIndexerSchema } = di.context;
        return nameSalesConnection(eq(ensIndexerSchema.nameSales.seller, address as Hex), args);
      },
    }),

    /////////////////////////
    // AccountMarket.listings
    /////////////////////////
    listings: t.field({
      description:
        "This account's live marketplace listings (as seller), truncated. Null when federation is disabled.",
      type: [ListingRef],
      nullable: true,
      resolve: async (address) => {
        const { grailsClient } = di.context;
        if (!grailsClient.enabled) return null;
        return grailsClient.listingsBySeller(address);
      },
    }),

    ///////////////////////
    // AccountMarket.offers
    ///////////////////////
    offers: t.field({
      description:
        "This account's live marketplace offers (as buyer), truncated. Null when federation is disabled.",
      type: [OfferRef],
      nullable: true,
      resolve: async (address) => {
        const { grailsClient } = di.context;
        if (!grailsClient.enabled) return null;
        return grailsClient.offersByBuyer(address);
      },
    }),
  }),
});
