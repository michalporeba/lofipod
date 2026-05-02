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
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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
      ["--import", "tsx", "demo/cli.ts", ...args],
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

  async function expectTaskResource(
    taskId: string,
    assertions: {
      title: string;
      statusTerm: "Todo" | "Done";
      due?: string;
    },
  ): Promise<string> {
    const response = await fetch(
      new URL(`tasks/${taskId}.ttl`, solidOpenBaseUrl),
    );
    const body = await response.text();

    expect(response.ok).toBe(true);
    expect(body).toContain(`<https://michalporeba.com/demo/id/task/${taskId}>`);
    expect(body).toContain("a <https://michalporeba.com/ns/lifegraph#Task>");
    expect(body).toContain(`<https://schema.org/name> "${assertions.title}"`);
    expect(body).toContain(
      `<https://michalporeba.com/ns/lifegraph#status> <https://michalporeba.com/ns/lifegraph#${assertions.statusTerm}>`,
    );

    if (assertions.due) {
      expect(body).toContain(
        `"${assertions.due}"^^<https://michalporeba.com/ns/lifegraph#edtf>`,
      );
    } else {
      expect(body).not.toContain("<https://michalporeba.com/ns/lifegraph#due>");
    }

    expect(body).not.toContain("http://purl.org/dc/terms/created");
    expect(body).not.toContain("http://purl.org/dc/terms/modified");

    return body;
  }

  function expectSyncedOutput(output: string): void {
    expect(output).toMatch(/^status=(idle|syncing) configured=true pending=0$/);
  }

  it("syncs task and journal data from the demo CLI to the open test Pod", async () => {
    const taskId = `task-1-${runId}`;
    const entryId = `entry-1-${runId}`;
    const dataDir = await createDataDir();

    await runDemo([
      "task",
      "add",
      "--data-dir",
      dataDir,
      "--id",
      taskId,
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
      entryId,
      "--title",
      "Summary 2022",
      "--text",
      "A retrospective over the year.",
      "--date",
      "2022",
      "--task",
      taskId,
    ]);

    await expect(
      runDemo(["sync", "status", "--data-dir", dataDir]),
    ).resolves.toBe("status=unconfigured configured=false pending=2");

    await expect(
      runDemo([
        "sync",
        "status",
        "--data-dir",
        dataDir,
        "--pod-base-url",
        solidOpenBaseUrl,
      ]),
    ).resolves.toBe("status=syncing configured=true pending=2");

    const firstSyncOutput = await runDemo([
      "sync",
      "now",
      "--data-dir",
      dataDir,
      "--pod-base-url",
      solidOpenBaseUrl,
    ]);
    expectSyncedOutput(firstSyncOutput);

    const taskBody = await expectTaskResource(taskId, {
      title: "Prepare April review",
      statusTerm: "Todo",
      due: "2026-04",
    });
    expect(taskBody).not.toContain(
      "<https://michalporeba.com/ns/lifegraph#Done>",
    );

    await expect(
      runDemo([
        "sync",
        "now",
        "--data-dir",
        dataDir,
        "--pod-base-url",
        solidOpenBaseUrl,
      ]),
    ).resolves.toMatch(/^status=(idle|syncing) configured=true pending=0$/);

    const entryResponse = await fetch(
      new URL(`journal-entries/${entryId}.ttl`, solidOpenBaseUrl),
    );
    const entryBody = await entryResponse.text();
    expect(entryResponse.ok).toBe(true);
    expect(entryBody).toContain("Summary 2022");
    expect(entryBody).toContain(
      '"2022"^^<https://michalporeba.com/ns/lifegraph#edtf>',
    );
    expect(entryBody).toContain(taskId);
  }, 30_000);

  it("updates and deletes the canonical task resource through the local-first demo flow", async () => {
    const taskId = `task-lifecycle-${runId}`;
    const dataDir = await createDataDir();

    await runDemo([
      "task",
      "add",
      "--data-dir",
      dataDir,
      "--id",
      taskId,
      "--title",
      "Inspect canonical task",
      "--due",
      "2026-04",
    ]);

    expectSyncedOutput(
      await runDemo([
        "sync",
        "now",
        "--data-dir",
        dataDir,
        "--pod-base-url",
        solidOpenBaseUrl,
      ]),
    );

    const createdBody = await expectTaskResource(taskId, {
      title: "Inspect canonical task",
      statusTerm: "Todo",
      due: "2026-04",
    });
    expect(createdBody).not.toContain(
      "<https://michalporeba.com/ns/lifegraph#Done>",
    );

    await expect(
      runDemo(["task", "done", taskId, "--data-dir", dataDir]),
    ).resolves.toBe(
      `completed ${taskId} [done] Inspect canonical task due=2026-04`,
    );

    expectSyncedOutput(
      await runDemo([
        "sync",
        "now",
        "--data-dir",
        dataDir,
        "--pod-base-url",
        solidOpenBaseUrl,
      ]),
    );

    const updatedBody = await expectTaskResource(taskId, {
      title: "Inspect canonical task",
      statusTerm: "Done",
      due: "2026-04",
    });
    expect(updatedBody).not.toContain(
      "<https://michalporeba.com/ns/lifegraph#Todo>",
    );

    await expect(
      runDemo(["task", "delete", taskId, "--data-dir", dataDir]),
    ).resolves.toBe(`deleted ${taskId}`);

    expectSyncedOutput(
      await runDemo([
        "sync",
        "now",
        "--data-dir",
        dataDir,
        "--pod-base-url",
        solidOpenBaseUrl,
      ]),
    );

    const deletedResponse = await fetch(
      new URL(`tasks/${taskId}.ttl`, solidOpenBaseUrl),
    );
    expect(deletedResponse.status).toBe(404);
  }, 30_000);

  it("bootstraps pre-existing canonical task and journal resources from the Pod", async () => {
    const taskId = `task-remote-${runId}`;
    const entryId = `entry-remote-${runId}`;
    const dataDir = await createDataDir();

    await putExternalResource(
      `tasks/${taskId}.ttl`,
      [
        `<https://michalporeba.com/demo/id/task/${taskId}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://michalporeba.com/ns/lifegraph#Task> .`,
        `<https://michalporeba.com/demo/id/task/${taskId}> <https://schema.org/name> "Imported task" .`,
        `<https://michalporeba.com/demo/id/task/${taskId}> <https://michalporeba.com/ns/lifegraph#status> <https://michalporeba.com/ns/lifegraph#Todo> .`,
        `<https://michalporeba.com/demo/id/task/${taskId}> <https://michalporeba.com/ns/lifegraph#due> "2026-04"^^<https://michalporeba.com/ns/lifegraph#edtf> .`,
      ].join("\n"),
    );
    await putExternalResource(
      `journal-entries/${entryId}.ttl`,
      [
        `<https://michalporeba.com/demo/id/journal-entry/${entryId}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://michalporeba.com/ns/lifegraph#JournalEntry> .`,
        `<https://michalporeba.com/demo/id/journal-entry/${entryId}> <https://schema.org/name> "Imported journal" .`,
        `<https://michalporeba.com/demo/id/journal-entry/${entryId}> <https://schema.org/text> "Imported body." .`,
        `<https://michalporeba.com/demo/id/journal-entry/${entryId}> <https://michalporeba.com/ns/lifegraph#entryDate> "2022"^^<https://michalporeba.com/ns/lifegraph#edtf> .`,
        `<https://michalporeba.com/demo/id/journal-entry/${entryId}> <https://michalporeba.com/ns/lifegraph#aboutTask> <https://michalporeba.com/demo/id/task/${taskId}> .`,
        `<https://michalporeba.com/demo/id/journal-entry/${entryId}> <http://purl.org/dc/terms/created> "2026-03-29T09:05:00.000Z" .`,
        `<https://michalporeba.com/demo/id/journal-entry/${entryId}> <http://purl.org/dc/terms/modified> "2026-03-29T09:05:00.000Z" .`,
      ].join("\n"),
    );

    await expect(
      runDemo(["task", "list", "--data-dir", dataDir]),
    ).resolves.toBe("no tasks");

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
      runDemo(["task", "get", taskId, "--data-dir", dataDir]),
    ).resolves.toBe(`${taskId} [todo] Imported task due=2026-04`);
    await expect(
      runDemo(["task", "list", "--data-dir", dataDir]),
    ).resolves.toContain(`${taskId} [todo] Imported task due=2026-04`);
    await expect(
      runDemo(["journal", "list", "--data-dir", dataDir]),
    ).resolves.toContain(
      `${entryId} date=2022 task=${taskId} Imported journal`,
    );
  }, 30_000);
});
