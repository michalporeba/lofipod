import { describe, expect, it } from "vitest";

import { packageVersion } from "../src/index.js";

describe("package scaffold", () => {
  it("exposes the initial package version", () => {
    expect(packageVersion).toBe("0.1.0");
  });

  it("uses BDD-style tests through the public entrypoint", () => {
    expect(typeof packageVersion).toBe("string");
  });
});
