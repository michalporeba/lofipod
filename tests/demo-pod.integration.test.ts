import { mkdtemp, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { tmpdir } from "node:os";

import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { waitForSolidServer } from "./support/solidServer.js";

const execFileAsync = promisify(execFile);
const solidOpenBaseUrl =
  process.env.SOLID_OPEN_BASE_URL ?? "http://localhost:3400/";

describe("demo CLI with Community Solid Server", () => {
  const tempDirectories: string[] = [];

  beforeAll(async () => {
    await waitForSolidServer(solidOpenBaseUrl);
  }, 30_000);

  afterEach(async () => {
    await Promise.all(
      tempDirectories
        .splice(0)
        .map((directory) => rm(directory, { recursive: true, force: true })),
    );
  });

  async function createDataDir(): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), "lofipod-demo-pod-"));
    tempDirectories.push(directory);
    return directory;
  }

  async function runDemo(args: string[]): Promise<string> {
    const result = await execFileAsync(
      "node",
      ["--import", "./scripts/register-ts-node.mjs", "demo/cli.ts", ...args],
      {
        cwd: process.cwd(),
      },
    );

    return result.stdout.trim();
  }

  it("syncs task and journal data from the demo CLI to the open test Pod", async () => {
    const dataDir = await createDataDir();

    await runDemo([
      "task",
      "add",
      "--data-dir",
      dataDir,
      "--id",
      "task-1",
      "--title",
      "Prepare April review",
      "--due",
      "2026-04",
    ]);

    await runDemo([
      "journal",
      "add",
      "--data-dir",
      dataDir,
      "--id",
      "entry-1",
      "--title",
      "Summary 2022",
      "--text",
      "A retrospective over the year.",
      "--date",
      "2022",
      "--task",
      "task-1",
    ]);

    await expect(
      runDemo([
        "sync",
        "status",
        "--data-dir",
        dataDir,
        "--pod-base-url",
        solidOpenBaseUrl,
      ]),
    ).resolves.toBe("status=pending configured=true pending=2");

    await expect(
      runDemo([
        "sync",
        "now",
        "--data-dir",
        dataDir,
        "--pod-base-url",
        solidOpenBaseUrl,
      ]),
    ).resolves.toBe("status=idle configured=true pending=0");

    const taskResponse = await fetch(
      new URL("tasks/task-1.ttl", solidOpenBaseUrl),
    );
    const taskBody = await taskResponse.text();
    expect(taskResponse.ok).toBe(true);
    expect(taskBody).toContain("Prepare April review");
    expect(taskBody).toContain("2026-04");

    const entryResponse = await fetch(
      new URL("journal-entries/entry-1.ttl", solidOpenBaseUrl),
    );
    const entryBody = await entryResponse.text();
    expect(entryResponse.ok).toBe(true);
    expect(entryBody).toContain("Summary 2022");
    expect(entryBody).toContain("2022");
    expect(entryBody).toContain("task-1");
  }, 30_000);
});
