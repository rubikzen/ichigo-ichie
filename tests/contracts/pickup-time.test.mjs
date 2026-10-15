import test from "node:test";
import assert from "node:assert/strict";
import {
  formatParisDateTimeInput,
  formatParisPickupDateTime,
  isWithinPickupHours,
  parseDailyPickupHours,
  parseParisDateTimeInput,
} from "../../src/lib/pickup-time.ts";

test("parses the shop's single daily interval but rejects complex schedules", () => {
  assert.deepEqual(parseDailyPickupHours("Tous les jours 11h–19h"), { opensMinutes: 660, closesMinutes: 1140 });
  assert.deepEqual(parseDailyPickupHours("11:30 - 18:15"), { opensMinutes: 690, closesMinutes: 1095 });
  assert.equal(parseDailyPickupHours("11h–19h; 12h–18h"), null);
  assert.equal(parseDailyPickupHours("lundi 11h–19h"), null);
  assert.equal(parseDailyPickupHours("fermé le dimanche 11h–19h"), null);
});

test("allows opening time and excludes the exact closing time in summer and winter", () => {
  assert.equal(isWithinPickupHours("2026-07-15T09:00:00Z", "11h–19h"), true);
  assert.equal(isWithinPickupHours("2026-07-15T16:59:00Z", "11h–19h"), true);
  assert.equal(isWithinPickupHours("2026-07-15T17:00:00Z", "11h–19h"), false);
  assert.equal(isWithinPickupHours("2026-07-15T01:00:00Z", "11h–19h"), false);
  assert.equal(isWithinPickupHours("2026-01-15T10:00:00Z", "11h–19h"), true);
  assert.equal(isWithinPickupHours("2026-01-15T18:00:00Z", "11h–19h"), false);
});

test("scheduled pickup datetime is interpreted in Nice, not the visitor's timezone", () => {
  assert.equal(parseParisDateTimeInput("2026-07-15T14:00")?.toISOString(), "2026-07-15T12:00:00.000Z");
  assert.equal(parseParisDateTimeInput("2026-01-15T14:00")?.toISOString(), "2026-01-15T13:00:00.000Z");
  assert.equal(formatParisDateTimeInput(new Date("2026-07-15T12:00:00Z")), "2026-07-15T14:00");
  assert.equal(parseParisDateTimeInput("2026-02-30T14:00"), null);
  assert.equal(parseParisDateTimeInput("2026-03-29T02:30"), null);
});

test("pickup emails always display the hour at the Nice shop", () => {
  assert.match(formatParisPickupDateTime("2026-07-15T12:00:00Z"), /14:00/);
  assert.match(formatParisPickupDateTime("2026-01-15T13:00:00Z"), /14:00/);
  assert.match(formatParisPickupDateTime("2026-07-15T12:00:00Z", "en"), /14:00/);
});
