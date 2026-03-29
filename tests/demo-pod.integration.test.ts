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

  async function ensureContainer(path: string): Promise<void> {
    const segments = path.split("/").filter(Boolean);

    for (let index = 0; index < segments.length; index += 1) {
      const slug = segments[index]!;
      const parentPath = segments.slice(0, index).join("/");
      const parentUrl = new URL(
        parentPath ? `${parentPath}/` : "",
        solidOpenBaseUrl,
      );
      const response = await fetch(parentUrl, {
        method: "POST",
        headers: {
          Link: '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',
          Slug: slug,
        },
      });

      if (response.ok || response.status === 409) {
        continue;
      }

      throw new Error(`Failed to create container ${path}: ${response.status}`);
    }
  }

  async function putExternalResource(
    path: string,
    body: string,
  ): Promise<void> {
    await ensureContainer(path.split("/").slice(0, -1).join("/"));
    const response = await fetch(new URL(path, solidOpenBaseUrl), {
      method: "PUT",
      headers: {
        "Content-Type": "text/turtle",
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`Failed to create resource ${path}: ${response.status}`);
    }
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

  it("bootstraps pre-existing canonical task and journal resources from the Pod", async () => {
    const dataDir = await createDataDir();

    await putExternalResource(
      "tasks/task-remote.ttl",
      [
        "<https://michalporeba.com/demo/id/task/task-remote> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://michalporeba.com/ns/lifegraph#Task> .",
        '<https://michalporeba.com/demo/id/task/task-remote> <https://schema.org/name> "Imported task" .',
        "<https://michalporeba.com/demo/id/task/task-remote> <https://michalporeba.com/ns/lifegraph#status> <https://michalporeba.com/ns/lifegraph#Todo> .",
        '<https://michalporeba.com/demo/id/task/task-remote> <https://michalporeba.com/ns/lifegraph#due> "2026-04" .',
        '<https://michalporeba.com/demo/id/task/task-remote> <http://purl.org/dc/terms/created> "2026-03-29T09:00:00.000Z" .',
        '<https://michalporeba.com/demo/id/task/task-remote> <http://purl.org/dc/terms/modified> "2026-03-29T09:00:00.000Z" .',
      ].join("\n"),
    );
    await putExternalResource(
      "journal-entries/entry-remote.ttl",
      [
        "<https://michalporeba.com/demo/id/journal-entry/entry-remote> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://michalporeba.com/ns/lifegraph#JournalEntry> .",
        '<https://michalporeba.com/demo/id/journal-entry/entry-remote> <https://schema.org/name> "Imported journal" .',
        '<https://michalporeba.com/demo/id/journal-entry/entry-remote> <https://schema.org/text> "Imported body." .',
        '<https://michalporeba.com/demo/id/journal-entry/entry-remote> <https://michalporeba.com/ns/lifegraph#entryDate> "2022" .',
        "<https://michalporeba.com/demo/id/journal-entry/entry-remote> <https://michalporeba.com/ns/lifegraph#aboutTask> <https://michalporeba.com/demo/id/task/task-remote> .",
        '<https://michalporeba.com/demo/id/journal-entry/entry-remote> <http://purl.org/dc/terms/created> "2026-03-29T09:05:00.000Z" .',
        '<https://michalporeba.com/demo/id/journal-entry/entry-remote> <http://purl.org/dc/terms/modified> "2026-03-29T09:05:00.000Z" .',
      ].join("\n"),
    );

    await expect(
      runDemo([
        "sync",
        "bootstrap",
        "--data-dir",
        dataDir,
        "--pod-base-url",
        solidOpenBaseUrl,
      ]),
    ).resolves.toMatch(/^imported=\d+ skipped=0 collisions=0$/);

    await expect(
      runDemo(["task", "list", "--data-dir", dataDir]),
    ).resolves.toContain("task-remote [todo] Imported task due=2026-04");
    await expect(
      runDemo(["journal", "list", "--data-dir", dataDir]),
    ).resolves.toContain(
      "entry-remote date=2022 task=task-remote Imported journal",
    );
  }, 30_000);
});
