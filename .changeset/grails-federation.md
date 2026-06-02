---
"ensapi": minor
"enssdk": minor
---

Federate live secondary-market listings and offers from the Grails marketplace API into the Omnigraph. When `GRAILS_API_URL` is set, `Domain.listings`, `Domain.offers`, `Domain.floorListing`, and `Account.market.listings` / `Account.market.offers` surface active off-chain Seaport orders (which cannot be derived on-chain), each linkable to its indexed `Domain` and exposing raw `priceWei` + `currencyAddress` (offers are commonly denominated in WETH, so they are not constrained to the on-chain `Currency` enum).

Read access is public; the client sends a browser User-Agent (to pass the marketplace WAF), caches responses briefly, caps upstream concurrency, and fails soft. All federated fields return `null` when `GRAILS_API_URL` is unset or the upstream is unavailable, so they never break the surrounding query.
