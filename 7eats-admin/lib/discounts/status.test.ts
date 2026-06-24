import assert from "node:assert/strict";
import { test } from "node:test";
import { discountStatus } from "./status";

const now = new Date("2026-06-23T12:00:00Z");

test("inactive overrides everything", () => {
  assert.equal(
    discountStatus({ isActive: false, startsAt: null, endsAt: null }, now),
    "inactive",
  );
});

test("active when in window and no bounds", () => {
  assert.equal(
    discountStatus({ isActive: true, startsAt: null, endsAt: null }, now),
    "active",
  );
});

test("scheduled when startsAt is in the future", () => {
  assert.equal(
    discountStatus(
      { isActive: true, startsAt: new Date("2026-07-01T00:00:00Z"), endsAt: null },
      now,
    ),
    "scheduled",
  );
});

test("expired when endsAt has passed", () => {
  assert.equal(
    discountStatus(
      { isActive: true, startsAt: null, endsAt: new Date("2026-06-01T00:00:00Z") },
      now,
    ),
    "expired",
  );
});
