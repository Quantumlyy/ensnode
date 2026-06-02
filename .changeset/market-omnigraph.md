---
"ensapi": minor
"enssdk": minor
---

Expose ENS secondary-market sales through the Omnigraph API under a new `market` root field. `market.sales` (cursor-paginated newest-first, with buyer / seller / currency / assetId / time filters) and `market.sale(id)` surface the on-chain Seaport sales already indexed by the TokenScope plugin into `name_sales`. Each `NameSale` links to its buyer and seller `Account`s, the sold `Domain` (joined via canonical node), and a shared `Price` (amount plus `Currency`). Also adds `Domain.sales` / `Domain.lastSale` and an account-rooted `Account.market` (purchases and sales).

Requires the `tokenscope` (and `registrars`) plugins. Secondary-market sale indexing is currently mainnet-only.
