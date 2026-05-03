import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runCli } from "../demo/cli.js";

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
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = await runCli(args, {
      stdout(message) {
        stdout.push(message);
      },
      stderr(message) {
        stderr.push(message);
      },
    });

    if (exitCode !== 0) {
      throw new Error(stderr.join("\n") || "demo CLI failed");
    }

    return stdout.join("\n").trim();
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
        "lastUnsupportedPolicy=-",
        "lastUnsupportedReason=-",
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
        "lastUnsupportedPolicy=-",
        "lastUnsupportedReason=-",
      ].join("\n"),
    );
  });

  it("keeps task get/list outputs stable after bounded task-model evolution", async () => {
    const dataDir = await createDataDir();

    await expect(
      runDemo([
        "task",
        "add",
        "--data-dir",
        dataDir,
        "--id",
        "task-compat",
        "--title",
        "Compatibility check",
      ]),
    ).resolves.toBe("created task-compat [todo] Compatibility check");

    await expect(
      runDemo(["task", "get", "task-compat", "--data-dir", dataDir]),
    ).resolves.toBe("task-compat [todo] Compatibility check");

    await expect(
      runDemo(["task", "list", "--data-dir", dataDir]),
    ).resolves.toBe("task-compat [todo] Compatibility check");
  });
});
