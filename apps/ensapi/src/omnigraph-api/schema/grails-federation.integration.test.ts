import { describe, expect, it } from "vitest";

import { request } from "@/test/integration/graphql-utils";
import { gql } from "@/test/integration/omnigraph-api-client";

/**
 * Wiring coverage for the Grails-federated secondary-market fields (`Domain.listings` /
 * `Domain.offers` / `Domain.floorListing`, `Account.market.listings` / `offers`).
 *
 * The devnet stack runs without `GRAILS_API_URL`, so federation is disabled and every federated
 * field resolves to `null`. These assertions prove the schema, resolvers, and DI wiring execute and
 * degrade gracefully when the marketplace API is not configured. With `GRAILS_API_URL` set (and
 * network access to api.grails.app), these fields populate from the live order book; that
 * populated-data coverage is exercised by the GrailsClient unit tests and at deploy time.
 */
describe("Grails federation (disabled on devnet)", () => {
  type FederatedDomainResult = {
    domain: {
      listings: unknown[] | null;
      offers: unknown[] | null;
      floorListing: { id: string } | null;
    } | null;
  };

  const FederatedDomainFields = gql`
    query FederatedDomainFields($name: InterpretedName!) {
      domain(by: { name: $name }) {
        listings {
          id
        }
        offers {
          id
        }
        floorListing {
          id
        }
      }
    }
  `;

  it("returns null federated fields when GRAILS_API_URL is not configured", async () => {
    const result = await request<FederatedDomainResult>(FederatedDomainFields, {
      name: "newowner.eth",
    });

    expect(result.domain).not.toBeNull();
    expect(result.domain?.listings).toBeNull();
    expect(result.domain?.offers).toBeNull();
    expect(result.domain?.floorListing).toBeNull();
  });
});
