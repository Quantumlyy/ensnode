import { describe, expect, it } from "vitest";

import { request } from "@/test/integration/graphql-utils";
import { gql } from "@/test/integration/omnigraph-api-client";

/**
 * Wiring coverage for the secondary-market Omnigraph surface.
 *
 * Seaport indexing is mainnet-only, so the devnet stack has no `name_sales` rows. These assertions
 * prove the resolvers, composite-cursor pagination, and DI/table access execute and return clean,
 * empty results. `Domain.sales`/`Domain.lastSale` and `Account.market.{purchases,sales}` are backed
 * by the same `nameSalesConnection`, so they share this coverage. Populated-data assertions (real
 * sales and the `Domain.sales` canonicalNode join) belong to a future market devnet.
 */
describe("market.sales", () => {
  type SalesResult = {
    market: {
      sales: {
        totalCount: number;
        edges: { cursor: string; node: { id: string } }[];
        pageInfo: { hasNextPage: boolean; hasPreviousPage: boolean };
      };
    };
  };

  const MarketSales = gql`
    query MarketSales {
      market {
        sales(first: 10) {
          totalCount
          edges {
            cursor
            node {
              id
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
          }
        }
      }
    }
  `;

  it("returns an empty connection on the devnet (no on-chain Seaport sales)", async () => {
    const result = await request<SalesResult>(MarketSales);

    expect(result.market.sales.totalCount).toBe(0);
    expect(result.market.sales.edges).toHaveLength(0);
    expect(result.market.sales.pageInfo.hasNextPage).toBe(false);
    expect(result.market.sales.pageInfo.hasPreviousPage).toBe(false);
  });
});

describe("market.sale", () => {
  type SaleResult = { market: { sale: { id: string } | null } };

  const MarketSale = gql`
    query MarketSale($id: ID!) {
      market {
        sale(id: $id) {
          id
        }
      }
    }
  `;

  it("returns null for an unknown sale id", async () => {
    const result = await request<SaleResult>(MarketSale, { id: "1-1-1" });

    expect(result.market.sale).toBeNull();
  });
});
