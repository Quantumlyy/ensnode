import {
  type Address,
  type InterpretedName,
  isNormalizedName,
  type NormalizedAddress,
} from "enssdk";

import type { GrailsListing } from "@/lib/grails/grails-client";
import { builder } from "@/omnigraph-api/builder";
import { getDomainIdByInterpretedName } from "@/omnigraph-api/lib/get-domain-by-interpreted-name";
import { AccountRef } from "@/omnigraph-api/schema/account";
import { DomainInterfaceRef } from "@/omnigraph-api/schema/domain";

export const ListingRef = builder.objectRef<GrailsListing>("Listing");

ListingRef.implement({
  description:
    'A live secondary-market sell order ("Buy Now") for an ENS name, federated from an off-chain marketplace. Unlike an on-chain NameSale (a settled sale), a Listing is an unsettled signed Seaport order and may be denominated in any currency.',
  fields: (t) => ({
    id: t.field({
      description: "The marketplace's identifier for this listing.",
      type: "ID",
      nullable: false,
      resolve: (listing) => String(listing.id),
    }),
    name: t.field({
      description: "The ENS name this listing is for.",
      type: "String",
      nullable: false,
      resolve: (listing) => listing.name,
    }),
    tokenId: t.field({
      description: "The token id of the listed ENS name NFT.",
      type: "BigInt",
      nullable: false,
      resolve: (listing) => listing.tokenId,
    }),
    seller: t.field({
      description: "The account offering the name for sale.",
      type: AccountRef,
      nullable: false,
      resolve: (listing) => listing.seller as Address,
    }),
    priceWei: t.field({
      description: "The asking price, denominated in the smallest unit of `currencyAddress`.",
      type: "BigInt",
      nullable: false,
      resolve: (listing) => listing.priceWei,
    }),
    currencyAddress: t.field({
      description:
        "The payment currency's ERC-20 contract address; the zero address denotes native ETH.",
      type: "Address",
      nullable: false,
      resolve: (listing) => listing.currencyAddress as NormalizedAddress,
    }),
    orderHash: t.field({
      description: "The Seaport order hash.",
      type: "Hex",
      nullable: false,
      resolve: (listing) => listing.orderHash,
    }),
    status: t.field({
      description: "The marketplace order status (e.g. `active`).",
      type: "String",
      nullable: false,
      resolve: (listing) => listing.status,
    }),
    source: t.field({
      description: "The marketplace the order originates from (e.g. `grails`, `opensea`).",
      type: "String",
      nullable: false,
      resolve: (listing) => listing.source,
    }),
    expiresAt: t.field({
      description: "ISO-8601 timestamp at which the order expires, if known.",
      type: "String",
      nullable: true,
      resolve: (listing) => listing.expiresAt,
    }),
    createdAt: t.field({
      description: "ISO-8601 timestamp at which the order was created, if known.",
      type: "String",
      nullable: true,
      resolve: (listing) => listing.createdAt,
    }),
    domain: t.field({
      description:
        "The indexed Domain for this listing's name, if the name is normalized and canonical.",
      type: DomainInterfaceRef,
      nullable: true,
      resolve: (listing) =>
        isNormalizedName(listing.name)
          ? getDomainIdByInterpretedName(listing.name as InterpretedName)
          : null,
    }),
  }),
});
