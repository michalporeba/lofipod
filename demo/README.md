# Demo

This directory is reserved for the in-repo demo application and related assets.

The first purpose of the demo is not to be a polished showcase. It is a small
end-to-end application surface that can help validate `lofipod` behaviour over
time.

It is also the intended first proof of value after reading the quick start:
run it locally first, without Pod sync, and confirm that the library feels like
an ordinary local application API before adding remote durability.

The current shape is:

- a command-line-first application that can also gain a TUI shell later
- a regression harness for future library changes
- a place to keep demo-specific ontology and sample data assets

See [ontology/README.md](ontology/README.md) for the `mlg` ontology subset used
by the demo.

## App shape

The demo currently uses two entity families:

- tasks as the repo's concrete bounded todo example
- journal entries

The command-line interface is the current primary surface. The demo application
logic stays separate from the CLI shell so a lightweight TUI can wrap the same
operations later.

The local-first state for the demo lives in a SQLite-backed filesystem store,
by default under a cache directory such as:

- `$XDG_CACHE_HOME/lifegraph-demo`
- or `~/.cache/lifegraph-demo`

The persisted database file is `state.sqlite` inside that directory. Every
`task` and `journal` command reopens the same local store, so restart-safe
state is demonstrated by running the next command with the same default
location or the same explicit `--data-dir`.

## What this demo proves today

The demo is the repo's first proof of value for the local-only path.

Today it proves:

- local entity definition wired into a runnable app
- local task CRUD through a small CLI surface
- restart-safe persistence by reopening the same SQLite-backed data directory
- inspectable local state through `task get` and `task list`

The repeatable verification command is:

```bash
npm run test:demo
```

That shell harness exercises the same task workflow documented below.

## First local run

You do not need a Pod to start.

From the repository root:

```bash
npm run demo -- task add --title "Prepare April review" --id task-1 --due 2026-04
npm run demo -- task get task-1
npm run demo -- task list
npm run demo -- task done task-1
npm run demo -- task delete task-1
```

If you want an isolated local state directory for inspection:

```bash
npm run demo -- task add --data-dir /tmp/lofipod-demo --title "Prepare April review" --id task-1 --due 2026-04
npm run demo -- task get task-1 --data-dir /tmp/lofipod-demo
npm run demo -- task list --data-dir /tmp/lofipod-demo
npm run demo -- task done task-1 --data-dir /tmp/lofipod-demo
npm run demo -- task list --data-dir /tmp/lofipod-demo
npm run demo -- task delete task-1 --data-dir /tmp/lofipod-demo
```

That sequence is the intended local durability proof:

1. write to `/tmp/lofipod-demo/state.sqlite`
2. stop after any command
3. run the next command later with the same `--data-dir`
4. confirm that `task get` or `task list` shows the latest saved state

Changing `--data-dir` points the demo at a different local store. No Pod
connection is required for this restart-safe workflow.

## What this first proof does not prove yet

This first-use path does not yet prove:

- Pod sync
- remote durability
- multi-device behaviour
- broader interoperability claims across other Pod-writing applications

Those concerns belong to the later sync-focused epics. The purpose here is to
confirm that the library already feels like a normal local-first application
API before any Solid setup is involved.

## How the demo maps to the library API

- `demo/entities.ts`: demo-owned task and journal entity definitions built with `defineEntity(...)`
- `demo/app.ts`: demo app wiring built with `createEngine(...)` and the Node-specific `createSqliteStorage(...)` adapter path from `lofipod/node`
- `demo/cli.ts`: CLI scaffolding that calls the demo app
- `src/`: library implementation rather than demo scaffolding
- `docs/QUICKSTART.md`: smallest public API example before the demo layer

Useful files for the first-run path:

- `demo/README.md`: local and sync command guide
- `demo/entities.ts`: the minimal reusable todo/task entity definition
- `demo/cli.ts`: command surface
- `demo/app.ts`: demo application wiring
- `docs/QUICKSTART.md`: minimal public API example

The local-first task flow is the intended first stop. It is the repo's
deliberate "todo" pattern, even though the CLI command name stays `task`.
Journal entries and Pod sync are follow-on paths once the basic local flow is
clear.

Supported local task CRUD commands:

- `task add --title <title> [--due <edtf>] [--id <id>]`
- `task get <id>`
- `task list`
- `task done <id>`
- `task delete <id>`

## Sync

The demo can also project its local-first data to a Solid Pod.

Use:

- `sync bootstrap --pod-base-url <url>`
- `sync status`
- `sync now --pod-base-url <url>`

The log path defaults to `apps/lifegraph-demo/log/` and can be overridden with
`--log-base-path`.
