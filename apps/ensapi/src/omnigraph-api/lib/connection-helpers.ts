import { and, asc, desc, eq, gt, lt, or } from "drizzle-orm";
import z from "zod/v4";

import { cursors } from "@/omnigraph-api/lib/cursors";
import { lazyConnection } from "@/omnigraph-api/lib/lazy-connection";

type Column = Parameters<typeof lt>[0];

const indexSchema = z.number();

/**
 * Returns a SQL condition for cursor-based pagination on a string column.
 */
export const paginateBy = (
  column: Column, //
  before: string | undefined,
  after: string | undefined,
) =>
  and(
    before ? lt(column, cursors.decode(before)) : undefined,
    after ? gt(column, cursors.decode(after)) : undefined,
  );

/**
 * Returns a SQL condition for cursor-based pagination on an integer column.
 * Decodes cursor values as numbers for numeric comparison.
 */
export const paginateByInt = (
  column: Column,
  before: string | undefined,
  after: string | undefined,
) =>
  and(
    before ? lt(column, indexSchema.parse(cursors.decode(before))) : undefined,
    after ? gt(column, indexSchema.parse(cursors.decode(after))) : undefined,
  );

/**
 * Returns an order-by clause for cursor-based pagination.
 * Default order is ascending; when `inverted` is true, order is descending.
 */
export const orderPaginationBy = (column: Column, inverted: boolean) =>
  inverted ? desc(column) : asc(column);

/**
 * A cursor for newest-first pagination over rows ordered by `(timestamp DESC, id DESC)`.
 * `timestamp` alone is not unique (rows can share a block timestamp), so the unique row `id`
 * breaks ties and guarantees a total order with no skipped or duplicated rows across pages.
 */
export interface TimestampIdCursor {
  timestamp: bigint;
  id: string;
}

/**
 * Returns a SQL condition for cursor-based pagination over a `(timestamp, id)` composite ordered
 * newest-first (`timestamp DESC, id DESC`). Forward pagination (`after`) yields rows strictly
 * older than the cursor; backward pagination (`before`) yields rows strictly newer. Comparisons
 * are lexicographic over `(timestamp, id)`.
 */
export const paginateByTimestampIdDesc = (
  timestampColumn: Column,
  idColumn: Column,
  before: string | undefined,
  after: string | undefined,
) => {
  const olderThan = ({ timestamp, id }: TimestampIdCursor) =>
    or(lt(timestampColumn, timestamp), and(eq(timestampColumn, timestamp), lt(idColumn, id)));
  const newerThan = ({ timestamp, id }: TimestampIdCursor) =>
    or(gt(timestampColumn, timestamp), and(eq(timestampColumn, timestamp), gt(idColumn, id)));

  return and(
    after ? olderThan(cursors.decode<TimestampIdCursor>(after)) : undefined,
    before ? newerThan(cursors.decode<TimestampIdCursor>(before)) : undefined,
  );
};

/**
 * Returns the order-by clause for newest-first `(timestamp DESC, id DESC)` cursor pagination.
 * Flips to ascending for backward pagination (`inverted`), matching `orderPaginationBy`.
 */
export const orderByTimestampIdDesc = (
  timestampColumn: Column,
  idColumn: Column,
  inverted: boolean,
) => (inverted ? [asc(timestampColumn), asc(idColumn)] : [desc(timestampColumn), desc(idColumn)]);

/**
 * An empty Relay Connection, used when short-circuiting connection resolvers.
 */
export const EMPTY_CONNECTION = lazyConnection({
  totalCount: async () => 0,
  connection: async () => ({
    edges: [],
    pageInfo: {
      hasNextPage: false,
      hasPreviousPage: false,
      startCursor: null,
      endCursor: null,
    },
  }),
});
