import { type InterpretedName, isNormalizedName } from "enssdk";

import di from "@/di";
import type { GrailsClient } from "@/lib/grails/grails-client";

/**
 * Resolve a federated Grails field scoped to an account address.
 *
 * Returns `null` (signalling the data is unavailable, as distinct from an empty array) when
 * federation is disabled; otherwise delegates to `fetcher`.
 */
export function resolveGrailsForAccount<T>(
  address: string,
  fetcher: (client: GrailsClient, address: string) => Promise<T>,
): Promise<T> | null {
  const { grailsClient } = di.context;
  if (!grailsClient.enabled) return null;
  return fetcher(grailsClient, address);
}

/**
 * Resolve a federated Grails field scoped to a Domain's canonical name.
 *
 * Returns `null` when federation is disabled, or when the Domain has no normalized canonical name
 * to look up (the same guard `Domain.resolve` applies before resolving records); otherwise
 * delegates to `fetcher` with the canonical name.
 */
export function resolveGrailsForDomain<T>(
  canonicalName: InterpretedName | null,
  fetcher: (client: GrailsClient, name: InterpretedName) => Promise<T>,
): Promise<T> | null {
  const { grailsClient } = di.context;
  if (!grailsClient.enabled || !canonicalName || !isNormalizedName(canonicalName)) return null;
  return fetcher(grailsClient, canonicalName);
}
