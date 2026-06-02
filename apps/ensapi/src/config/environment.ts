import type {
  EnsDbEnvironment,
  LogLevelEnvironment,
  PortEnvironment,
  ReferralProgramEditionsEnvironment,
  RpcEnvironment,
  TheGraphEnvironment,
} from "@ensnode/ensnode-sdk/internal";

/**
 * Represents the raw, unvalidated environment variables for the ENSApi application.
 *
 * Keys correspond to the environment variable names, and all values are optional strings, reflecting
 * their state in `process.env`. This interface is intended to be the source type which then gets
 * mapped/parsed into a structured configuration object like `EnsApiConfig`.
 */
export type EnsApiEnvironment = EnsDbEnvironment &
  RpcEnvironment &
  PortEnvironment &
  LogLevelEnvironment &
  TheGraphEnvironment &
  ReferralProgramEditionsEnvironment & {
    /**
     * Optional base URL for the Grails marketplace API (e.g. `https://api.grails.app/api/v1`).
     * When set, ENSApi federates live secondary-market listings/offers; when unset, those
     * Omnigraph fields are disabled and return null.
     */
    GRAILS_API_URL?: string;
  };
