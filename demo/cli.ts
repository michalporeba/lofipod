import { createDemoApp } from "./app.js";
import type { JournalEntry, Task } from "./entities.js";

type Output = {
  stdout(message: string): void;
  stderr(message: string): void;
};

type ParsedArguments = {
  positional: string[];
  options: Record<string, string | boolean>;
};

function parseArguments(argv: string[]): ParsedArguments {
  const positional: string[] = [];
  const options: Record<string, string | boolean> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]!;

    if (!current.startsWith("--")) {
      positional.push(current);
      continue;
    }

    const key = current.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return { positional, options };
}

function optionAsString(
  options: Record<string, string | boolean>,
  name: string,
): string | undefined {
  return typeof options[name] === "string"
    ? (options[name] as string)
    : undefined;
}

function requireOption(
  options: Record<string, string | boolean>,
  name: string,
): string {
  const value = options[name];

  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required option: --${name}`);
  }

  return value;
}

function formatTask(task: Task): string {
  const due = task.due ? ` due=${task.due}` : "";
  return `${task.id} [${task.status}] ${task.title}${due}`;
}

function formatJournalEntry(entry: JournalEntry): string {
  const related = entry.aboutTaskId ? ` task=${entry.aboutTaskId}` : "";
  return `${entry.id} date=${entry.entryDate}${related} ${entry.title}`;
}

export function renderHelp(): string {
  return [
    "lifegraph-demo",
    "",
    "Commands:",
    "  task add --title <title> [--due <edtf>] [--id <id>] [--data-dir <dir>]",
    "  task list [--data-dir <dir>]",
    "  task done <id> [--data-dir <dir>]",
    "  journal add --title <title> --text <text> --date <edtf> [--task <task-id>] [--id <id>] [--data-dir <dir>]",
    "  journal list [--data-dir <dir>]",
    "  sync bootstrap [--data-dir <dir>] --pod-base-url <url> [--log-base-path <path>]",
    "  sync status [--data-dir <dir>] [--pod-base-url <url>] [--log-base-path <path>]",
    "  sync now [--data-dir <dir>] --pod-base-url <url> [--log-base-path <path>]",
  ].join("\n");
}

export async function runCli(
  argv: string[],
  output: Output = {
    stdout(message) {
      process.stdout.write(`${message}\n`);
    },
    stderr(message) {
      process.stderr.write(`${message}\n`);
    },
  },
): Promise<number> {
  const { positional, options } = parseArguments(argv);
  const [resource, command, maybeId] = positional;

  if (!resource || resource === "help" || options.help === true) {
    output.stdout(renderHelp());
    return 0;
  }

  const app = createDemoApp({
    dataDir: optionAsString(options, "data-dir"),
    pod:
      optionAsString(options, "pod-base-url") ||
      process.env.LIFEGRAPH_DEMO_POD_BASE_URL
        ? {
            podBaseUrl:
              optionAsString(options, "pod-base-url") ??
              process.env.LIFEGRAPH_DEMO_POD_BASE_URL ??
              "",
            logBasePath:
              optionAsString(options, "log-base-path") ??
              process.env.LIFEGRAPH_DEMO_LOG_BASE_PATH,
            authorization:
              optionAsString(options, "authorization") ??
              process.env.LIFEGRAPH_DEMO_AUTHORIZATION,
          }
        : undefined,
  });

  try {
    if (resource === "task" && command === "add") {
      const task = await app.addTask({
        id: typeof options.id === "string" ? options.id : undefined,
        title: requireOption(options, "title"),
        due: typeof options.due === "string" ? options.due : undefined,
      });

      output.stdout(`created ${formatTask(task)}`);
      return 0;
    }

    if (resource === "task" && command === "list") {
      const tasks = await app.listTasks();

      output.stdout(
        tasks.length === 0 ? "no tasks" : tasks.map(formatTask).join("\n"),
      );
      return 0;
    }

    if (resource === "task" && command === "done") {
      const id =
        maybeId ?? (typeof options.id === "string" ? options.id : undefined);

      if (!id) {
        throw new Error("Missing task id.");
      }

      const task = await app.completeTask(id);
      output.stdout(`completed ${formatTask(task)}`);
      return 0;
    }

    if (resource === "journal" && command === "add") {
      const entry = await app.addJournalEntry({
        id: typeof options.id === "string" ? options.id : undefined,
        title: requireOption(options, "title"),
        text: requireOption(options, "text"),
        entryDate: requireOption(options, "date"),
        aboutTaskId:
          typeof options.task === "string" ? options.task : undefined,
      });

      output.stdout(`created ${formatJournalEntry(entry)}`);
      return 0;
    }

    if (resource === "journal" && command === "list") {
      const entries = await app.listJournalEntries();

      output.stdout(
        entries.length === 0
          ? "no journal entries"
          : entries.map(formatJournalEntry).join("\n"),
      );
      return 0;
    }

    if (resource === "sync" && command === "status") {
      const state = await app.syncState();
      output.stdout(
        `status=${state.status} configured=${state.configured} pending=${state.pendingChanges}`,
      );
      return 0;
    }

    if (resource === "sync" && command === "bootstrap") {
      if (
        !optionAsString(options, "pod-base-url") &&
        !process.env.LIFEGRAPH_DEMO_POD_BASE_URL
      ) {
        throw new Error("Missing required option: --pod-base-url");
      }

      const result = await app.syncBootstrap();
      output.stdout(
        `imported=${result.imported} skipped=${result.skipped} collisions=${result.collisions.length}`,
      );
      return 0;
    }

    if (resource === "sync" && command === "now") {
      if (
        !optionAsString(options, "pod-base-url") &&
        !process.env.LIFEGRAPH_DEMO_POD_BASE_URL
      ) {
        throw new Error("Missing required option: --pod-base-url");
      }

      await app.syncNow();
      const state = await app.syncState();
      output.stdout(
        `status=${state.status} configured=${state.configured} pending=${state.pendingChanges}`,
      );
      return 0;
    }

    throw new Error("Unknown command.");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected CLI error.";
    output.stderr(message);
    return 1;
  } finally {
    await app.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const exitCode = await runCli(process.argv.slice(2));
  process.exitCode = exitCode;
}
