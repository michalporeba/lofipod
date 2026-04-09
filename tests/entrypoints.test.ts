import { describe, expect, it } from "vitest";

import * as browser from "../src/browser.js";
import * as core from "../src/index.js";
import * as node from "../src/node.js";

describe("public entrypoints", () => {
  it("keeps the root entrypoint core-only", () => {
    expect(core.createEngine).toBeTypeOf("function");
    expect(core.createMemoryStorage).toBeTypeOf("function");
    expect("createSolidPodAdapter" in core).toBe(false);
    expect("createSqliteStorage" in core).toBe(false);
    expect("createIndexedDbStorage" in core).toBe(false);
  });

  it("exposes Node-specific adapters from the node entrypoint", () => {
    expect(node.createEngine).toBeTypeOf("function");
    expect(node.createSolidPodAdapter).toBeTypeOf("function");
    expect(node.createSqliteStorage).toBeTypeOf("function");
    expect("createIndexedDbStorage" in node).toBe(false);
  });

  it("exposes browser-specific adapters from the browser entrypoint", () => {
    expect(browser.createEngine).toBeTypeOf("function");
    expect(browser.createSolidPodAdapter).toBeTypeOf("function");
    expect(browser.createIndexedDbStorage).toBeTypeOf("function");
    expect("createSqliteStorage" in browser).toBe(false);
  });
});
