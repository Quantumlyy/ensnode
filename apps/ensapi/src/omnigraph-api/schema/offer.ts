import {
  type Address,
  type InterpretedName,
  isNormalizedName,
  type NormalizedAddress,
} from "enssdk";

import type { GrailsOffer } from "@/lib/grails/grails-client";
import { builder } from "@/omnigraph-api/builder";
import { getDomainIdByInterpretedName } from "@/omnigraph-api/lib/get-domain-by-interpreted-name";
import { AccountRef } from "@/omnigraph-api/schema/account";
import { DomainInterfaceRef } from "@/omnigraph-api/schema/domain";

export const OfferRef = builder.objectRef<GrailsOffer>("Offer");

OfferRef.implement({
  description:
    "A live secondary-market buy order (bid) for an ENS name, federated from an off-chain marketplace. It is an unsettled signed Seaport order and may be denominated in any currency (offers are commonly in WETH).",
  fields: (t) => ({
    id: t.field({
      description: "The marketplace's identifier for this offer.",
      type: "ID",
      nullable: false,
      resolve: (offer) => String(offer.id),
    }),
    name: t.field({
      description: "The ENS name this offer is for.",
      type: "String",
      nullable: false,
      resolve: (offer) => offer.name,
    }),
    tokenId: t.field({
      description: "The token id of the ENS name NFT being bid on.",
      type: "BigInt",
      nullable: false,
      resolve: (offer) => offer.tokenId,
    }),
    buyer: t.field({
      description: "The account making the offer.",
      type: AccountRef,
      nullable: false,
      resolve: (offer) => offer.buyer as Address,
    }),
    priceWei: t.field({
      description: "The offered amount, denominated in the smallest unit of `currencyAddress`.",
      type: "BigInt",
      nullable: false,
      resolve: (offer) => offer.priceWei,
    }),
    currencyAddress: t.field({
      description:
        "The payment currency's ERC-20 contract address; the zero address denotes native ETH.",
      type: "Address",
      nullable: false,
      resolve: (offer) => offer.currencyAddress as NormalizedAddress,
    }),
    orderHash: t.field({
      description: "The Seaport order hash.",
      type: "Hex",
      nullable: false,
      resolve: (offer) => offer.orderHash,
    }),
    status: t.field({
      description: "The marketplace order status (e.g. `pending`).",
      type: "String",
      nullable: false,
      resolve: (offer) => offer.status,
    }),
    source: t.field({
      description: "The marketplace the order originates from (e.g. `grails`, `opensea`).",
      type: "String",
      nullable: false,
      resolve: (offer) => offer.source,
    }),
    expiresAt: t.field({
      description: "ISO-8601 timestamp at which the order expires, if known.",
      type: "String",
      nullable: true,
      resolve: (offer) => offer.expiresAt,
    }),
    createdAt: t.field({
      description: "ISO-8601 timestamp at which the order was created, if known.",
      type: "String",
      nullable: true,
      resolve: (offer) => offer.createdAt,
    }),
    domain: t.field({
      description:
        "The indexed Domain for this offer's name, if the name is normalized and canonical.",
      type: DomainInterfaceRef,
      nullable: true,
      resolve: (offer) =>
        isNormalizedName(offer.name)
          ? getDomainIdByInterpretedName(offer.name as InterpretedName)
          : null,
    }),
  }),
});
