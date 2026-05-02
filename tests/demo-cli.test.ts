import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { createDemoApp } from "../demo/app.js";
import { runCli } from "../demo/cli.js";

describe("demo CLI", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirectories
        .splice(0)
        .map((directory) => rm(directory, { recursive: true, force: true })),
    );
  });

  async function createDataDir(): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), "lofipod-demo-"));
    tempDirectories.push(directory);
    return directory;
  }

  async function runWithCapturedOutput(argv: string[]): Promise<{
    exitCode: number;
    stdout: string[];
    stderr: string[];
  }> {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const exitCode = await runCli(argv, {
      stdout(message) {
        stdout.push(message);
      },
      stderr(message) {
        stderr.push(message);
      },
    });

    return { exitCode, stdout, stderr };
  }

  it("creates and lists tasks through the CLI", async () => {
    const dataDir = await createDataDir();

    await expect(
      runWithCapturedOutput([
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
      ]),
    ).resolves.toMatchObject({
      exitCode: 0,
      stdout: ["created task-1 [todo] Prepare April review due=2026-04"],
      stderr: [],
    });

    await expect(
      runWithCapturedOutput(["task", "list", "--data-dir", dataDir]),
    ).resolves.toMatchObject({
      exitCode: 0,
      stdout: ["task-1 [todo] Prepare April review due=2026-04"],
      stderr: [],
    });
  });

  it("completes an existing task through the CLI", async () => {
    const dataDir = await createDataDir();

    await runWithCapturedOutput([
      "task",
      "add",
      "--data-dir",
      dataDir,
      "--id",
      "task-1",
      "--title",
      "Prepare April review",
    ]);

    await expect(
      runWithCapturedOutput(["task", "done", "task-1", "--data-dir", dataDir]),
    ).resolves.toMatchObject({
      exitCode: 0,
      stdout: ["completed task-1 [done] Prepare April review"],
      stderr: [],
    });
  });

  it("reads a single existing task through the CLI", async () => {
    const dataDir = await createDataDir();

    await runWithCapturedOutput([
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

    await expect(
      runWithCapturedOutput(["task", "get", "task-1", "--data-dir", dataDir]),
    ).resolves.toMatchObject({
      exitCode: 0,
      stdout: ["task-1 [todo] Prepare April review due=2026-04"],
      stderr: [],
    });
  });

  it("deletes an existing task through the CLI", async () => {
    const dataDir = await createDataDir();

    await runWithCapturedOutput([
      "task",
      "add",
      "--data-dir",
      dataDir,
      "--id",
      "task-1",
      "--title",
      "Prepare April review",
    ]);

    await expect(
      runWithCapturedOutput([
        "task",
        "delete",
        "task-1",
        "--data-dir",
        dataDir,
      ]),
    ).resolves.toMatchObject({
      exitCode: 0,
      stdout: ["deleted task-1"],
      stderr: [],
    });

    await expect(
      runWithCapturedOutput(["task", "list", "--data-dir", dataDir]),
    ).resolves.toMatchObject({
      exitCode: 0,
      stdout: ["no tasks"],
      stderr: [],
    });
  });

  it("creates and lists journal entries linked to tasks", async () => {
    const dataDir = await createDataDir();

    await runWithCapturedOutput([
      "task",
      "add",
      "--data-dir",
      dataDir,
      "--id",
      "task-1",
      "--title",
      "Write summary",
    ]);

    await expect(
      runWithCapturedOutput([
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
      ]),
    ).resolves.toMatchObject({
      exitCode: 0,
      stdout: ["created entry-1 date=2022 task=task-1 Summary 2022"],
      stderr: [],
    });

    await expect(
      runWithCapturedOutput(["journal", "list", "--data-dir", dataDir]),
    ).resolves.toMatchObject({
      exitCode: 0,
      stdout: ["entry-1 date=2022 task=task-1 Summary 2022"],
      stderr: [],
    });
  });

  it("keeps demo data across app recreation with the same data directory", async () => {
    const dataDir = await createDataDir();
    const firstApp = createDemoApp({
      dataDir,
      now() {
        return "2026-03-29T12:00:00.000Z";
      },
    });

    await firstApp.addTask({
      id: "task-1",
      title: "Prepare April review",
      due: "2026-04",
    });

    const secondApp = createDemoApp({
      dataDir,
    });

    await expect(secondApp.listTasks()).resolves.toEqual([
      {
        id: "task-1",
        title: "Prepare April review",
        status: "todo",
        due: "2026-04",
      },
    ]);
  });

  it("keeps completed task state across app recreation with the same data directory", async () => {
    const dataDir = await createDataDir();
    const firstApp = createDemoApp({
      dataDir,
      now() {
        return "2026-03-29T12:00:00.000Z";
      },
    });

    await firstApp.addTask({
      id: "task-1",
      title: "Prepare April review",
      due: "2026-04",
    });
    await firstApp.completeTask("task-1");

    const secondApp = createDemoApp({
      dataDir,
    });

    await expect(secondApp.getTask("task-1")).resolves.toEqual({
      id: "task-1",
      title: "Prepare April review",
      status: "done",
      due: "2026-04",
    });

    await expect(secondApp.listTasks()).resolves.toEqual([
      {
        id: "task-1",
        title: "Prepare April review",
        status: "done",
        due: "2026-04",
      },
    ]);
  });

  it("keeps deleted task state across app recreation with the same data directory", async () => {
    const dataDir = await createDataDir();
    const firstApp = createDemoApp({
      dataDir,
      now() {
        return "2026-03-29T12:00:00.000Z";
      },
    });

    await firstApp.addTask({
      id: "task-1",
      title: "Prepare April review",
      due: "2026-04",
    });
    await firstApp.deleteTask("task-1");

    const secondApp = createDemoApp({
      dataDir,
    });

    await expect(secondApp.listTasks()).resolves.toEqual([]);
    await expect(secondApp.getTask("task-1")).rejects.toThrow(
      "Unknown task: task-1",
    );
  });

  it("proves the documented local-first demo workflow through repeated CLI runs", async () => {
    const dataDir = await createDataDir();

    await expect(
      runWithCapturedOutput([
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
      ]),
    ).resolves.toMatchObject({
      exitCode: 0,
      stdout: ["created task-1 [todo] Prepare April review due=2026-04"],
      stderr: [],
    });

    await expect(
      runWithCapturedOutput(["task", "get", "task-1", "--data-dir", dataDir]),
    ).resolves.toMatchObject({
      exitCode: 0,
      stdout: ["task-1 [todo] Prepare April review due=2026-04"],
      stderr: [],
    });

    await expect(
      runWithCapturedOutput(["task", "list", "--data-dir", dataDir]),
    ).resolves.toMatchObject({
      exitCode: 0,
      stdout: ["task-1 [todo] Prepare April review due=2026-04"],
      stderr: [],
    });

    await expect(
      runWithCapturedOutput(["task", "done", "task-1", "--data-dir", dataDir]),
    ).resolves.toMatchObject({
      exitCode: 0,
      stdout: ["completed task-1 [done] Prepare April review due=2026-04"],
      stderr: [],
    });

    await expect(
      runWithCapturedOutput(["task", "get", "task-1", "--data-dir", dataDir]),
    ).resolves.toMatchObject({
      exitCode: 0,
      stdout: ["task-1 [done] Prepare April review due=2026-04"],
      stderr: [],
    });

    await expect(
      runWithCapturedOutput([
        "task",
        "delete",
        "task-1",
        "--data-dir",
        dataDir,
      ]),
    ).resolves.toMatchObject({
      exitCode: 0,
      stdout: ["deleted task-1"],
      stderr: [],
    });

    await expect(
      runWithCapturedOutput(["task", "list", "--data-dir", dataDir]),
    ).resolves.toMatchObject({
      exitCode: 0,
      stdout: ["no tasks"],
      stderr: [],
    });
  });

  it("keeps local CRUD local-first even when Pod env vars are present", async () => {
    const dataDir = await createDataDir();
    const previousPodBaseUrl = process.env.LIFEGRAPH_DEMO_POD_BASE_URL;
    const previousAuthorization = process.env.LIFEGRAPH_DEMO_AUTHORIZATION;

    process.env.LIFEGRAPH_DEMO_POD_BASE_URL = "http://127.0.0.1:1/";
    process.env.LIFEGRAPH_DEMO_AUTHORIZATION = "Bearer demo-token";

    try {
      await expect(
        runWithCapturedOutput([
          "task",
          "add",
          "--data-dir",
          dataDir,
          "--id",
          "task-1",
          "--title",
          "Stay local first",
        ]),
      ).resolves.toMatchObject({
        exitCode: 0,
        stdout: ["created task-1 [todo] Stay local first"],
        stderr: [],
      });

      await expect(
        runWithCapturedOutput(["task", "list", "--data-dir", dataDir]),
      ).resolves.toMatchObject({
        exitCode: 0,
        stdout: ["task-1 [todo] Stay local first"],
        stderr: [],
      });
    } finally {
      if (previousPodBaseUrl === undefined) {
        delete process.env.LIFEGRAPH_DEMO_POD_BASE_URL;
      } else {
        process.env.LIFEGRAPH_DEMO_POD_BASE_URL = previousPodBaseUrl;
      }

      if (previousAuthorization === undefined) {
        delete process.env.LIFEGRAPH_DEMO_AUTHORIZATION;
      } else {
        process.env.LIFEGRAPH_DEMO_AUTHORIZATION = previousAuthorization;
      }
    }
  });

  it("requires an explicit attach step before sync becomes configured", async () => {
    const dataDir = await createDataDir();
    const app = createDemoApp({ dataDir });

    await app.addTask({
      id: "task-1",
      title: "Prepare April review",
    });

    await expect(app.syncState()).resolves.toMatchObject({
      configured: false,
      pendingChanges: 1,
      status: "unconfigured",
    });

    await app.attachPodSync({
      podBaseUrl: "https://pod.example/",
      fetch: async () =>
        new Response("", {
          status: 404,
        }),
    });

    await expect(app.syncState()).resolves.toMatchObject({
      configured: true,
      pendingChanges: 1,
    });

    await app.close();
  });

  it("shows help for the top-level command", async () => {
    await expect(runWithCapturedOutput([])).resolves.toMatchObject({
      exitCode: 0,
      stdout: [expect.stringContaining("lifegraph-demo")],
      stderr: [],
    });
  });

  it("reports sync state for an unconfigured demo app", async () => {
    const dataDir = await createDataDir();

    await expect(
      runWithCapturedOutput(["sync", "status", "--data-dir", dataDir]),
    ).resolves.toMatchObject({
      exitCode: 0,
      stdout: ["status=unconfigured configured=false pending=0"],
      stderr: [],
    });
  });

  it("requires a pod base URL for bootstrap", async () => {
    const dataDir = await createDataDir();

    await expect(
      runWithCapturedOutput(["sync", "bootstrap", "--data-dir", dataDir]),
    ).resolves.toMatchObject({
      exitCode: 1,
      stdout: [],
      stderr: ["Missing required option: --pod-base-url"],
    });
  });
});
