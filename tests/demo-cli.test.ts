import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("demo CLI sync inspection", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirectories
        .splice(0)
        .map((directory) => rm(directory, { recursive: true, force: true })),
    );
  });

  async function createDataDir(): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), "lofipod-demo-cli-"));
    tempDirectories.push(directory);
    return directory;
  }

  async function runDemo(args: string[]): Promise<string> {
    const result = await execFileAsync(
      "node",
      ["--import", "tsx", "demo/cli.ts", ...args],
      {
        cwd: process.cwd(),
      },
    );

    return result.stdout.trim();
  }

  it("shows inspectable sync state without requiring Pod attachment", async () => {
    const dataDir = await createDataDir();

    await expect(
      runDemo(["sync", "status", "--data-dir", dataDir]),
    ).resolves.toBe(
      [
        "status=unconfigured configured=false pending=0",
        "connection reachable=false notifications=false",
        "lastSyncedAt=-",
        "lastFailedAt=-",
        "lastFailureReason=-",
      ].join("\n"),
    );

    await runDemo([
      "task",
      "add",
      "--data-dir",
      dataDir,
      "--id",
      "task-sync-inspect",
      "--title",
      "Inspect local sync state",
    ]);

    await expect(
      runDemo(["sync", "status", "--data-dir", dataDir]),
    ).resolves.toBe(
      [
        "status=unconfigured configured=false pending=1",
        "connection reachable=false notifications=false",
        "lastSyncedAt=-",
        "lastFailedAt=-",
        "lastFailureReason=-",
      ].join("\n"),
    );
  });
});
