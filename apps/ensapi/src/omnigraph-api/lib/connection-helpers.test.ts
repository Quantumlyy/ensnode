import { bigint, pgTable, text } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  orderByTimestampIdDesc,
  paginateByTimestampIdDesc,
  type TimestampIdCursor,
} from "@/omnigraph-api/lib/connection-helpers";
import { cursors } from "@/omnigraph-api/lib/cursors";

// A throwaway table providing real Drizzle columns to exercise the pagination helpers.
const sales = pgTable("name_sales", {
  id: text("id").primaryKey(),
  timestamp: bigint("timestamp", { mode: "bigint" }).notNull(),
});

describe("(timestamp, id) cursor", () => {
  it("round-trips, preserving the bigint timestamp", () => {
    const cursor = cursors.encode<TimestampIdCursor>({ timestamp: 1_700_000_000n, id: "1-123-4" });
    expect(cursors.decode<TimestampIdCursor>(cursor)).toEqual({
      timestamp: 1_700_000_000n,
      id: "1-123-4",
    });
  });

  it("distinguishes rows that share a timestamp by their id tiebreaker", () => {
    const a = cursors.encode<TimestampIdCursor>({ timestamp: 5n, id: "1-1-1" });
    const b = cursors.encode<TimestampIdCursor>({ timestamp: 5n, id: "1-1-2" });
    expect(a).not.toEqual(b);
  });
});

describe("paginateByTimestampIdDesc", () => {
  it("is unconstrained when neither before nor after is provided", () => {
    expect(
      paginateByTimestampIdDesc(sales.timestamp, sales.id, undefined, undefined),
    ).toBeUndefined();
  });

  it("produces a predicate when paginating forward (after)", () => {
    const after = cursors.encode<TimestampIdCursor>({ timestamp: 5n, id: "1-1-1" });
    expect(paginateByTimestampIdDesc(sales.timestamp, sales.id, undefined, after)).toBeDefined();
  });

  it("produces a predicate when paginating backward (before)", () => {
    const before = cursors.encode<TimestampIdCursor>({ timestamp: 5n, id: "1-1-1" });
    expect(paginateByTimestampIdDesc(sales.timestamp, sales.id, before, undefined)).toBeDefined();
  });
});

describe("orderByTimestampIdDesc", () => {
  it("orders by both the timestamp and the id tiebreaker", () => {
    expect(orderByTimestampIdDesc(sales.timestamp, sales.id, false)).toHaveLength(2);
  });

  it("flips direction for backward pagination", () => {
    expect(orderByTimestampIdDesc(sales.timestamp, sales.id, true)).toHaveLength(2);
  });
});
