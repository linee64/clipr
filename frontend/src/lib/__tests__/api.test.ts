import { describe, expect, it } from "vitest";

import { isUpgradeError } from "@/lib/api";

describe("isUpgradeError", () => {
  it.each([402, 403, 429])("treats status %i as an upgrade error", (status) => {
    expect(isUpgradeError({ status })).toBe(true);
  });

  it.each([400, 401, 404, 500])("treats status %i as not an upgrade error", (status) => {
    expect(isUpgradeError({ status })).toBe(false);
  });

  it("is false for null / undefined / non-objects", () => {
    expect(isUpgradeError(null)).toBe(false);
    expect(isUpgradeError(undefined)).toBe(false);
    expect(isUpgradeError("nope")).toBe(false);
    expect(isUpgradeError({})).toBe(false);
  });
});
