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
by the demo once you want to inspect the canonical Pod mapping. It is not a
prerequisite for the first local run.

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

The intended pattern is additive:

1. create and use the same SQLite-backed demo locally first
2. supply Pod runtime inputs only for a sync command
3. let that command attach sync to the existing local app through `engine.sync.attach(...)`

The same `TaskEntity` in [entities.ts](entities.ts) owns both sides of that
boundary:

- the bounded local task shape stays `id`, `title`, `status`, and optional `due`
- the sync-scoped canonical mapping projects tasks to `tasks/<id>.ttl`
- the canonical Turtle uses `mlg:Task`, `schema:name`, `mlg:status`, and
  optional `mlg:due` with the `mlg:edtf` datatype

That mapping is a demo-owned app choice layered on top of the same local-first
programming model. You can ignore the ontology files entirely until you want to
inspect or reuse the Pod-side RDF.

`createEngine(...)` stays environment-neutral in the root package. The demo's
Node-specific wiring lives in `demo/app.ts`, where `createSqliteStorage(...)`
and `createSolidPodAdapter(...)` both come from `lofipod/node`.

Persisted Pod config can survive in local state after an attach, but that does
not create a live network connection by itself. Each CLI process still has to
provide a runtime adapter before sync can run.

Use:

- `sync bootstrap --pod-base-url <url>`
- `sync status`
- `sync now --pod-base-url <url>`

The log path defaults to `apps/lifegraph-demo/log/` and can be overridden with
`--log-base-path`.

The local task and journal commands keep the same local-first behavior whether
or not Pod env vars are present. Only the `sync ...` commands attach the
Node-side Pod adapter.

Temporary Pod or network failure is expected to degrade to continued local
use, not application failure. The demo's local CRUD commands still commit to
the same SQLite-backed state first, so interruption does not block ordinary
task or journal edits.

This CLI demo is process-based rather than a long-lived app shell. Ordinary
`task ...` and `journal ...` commands stay local, while `sync ...` commands
reattach the Pod adapter against the same persisted local state. In the
library's long-lived attached-engine model, retry happens in the background
when connectivity returns; in this demo, later `sync` commands resume that
work without requiring you to reconstruct local changes by hand.

### Inspecting sync state

`sync status` is the demo's supported inspection path for the library's public
`engine.sync.state()` surface. It reports:

- `status`, `configured`, and `pending` on the first line
- the last known connection fields on the following lines:
  - `reachable`
  - `notifications`
  - `lastSyncedAt`
  - `lastFailedAt`
  - `lastFailureReason`

Unset values are rendered as `-`. This output is intentionally a thin
presentation of the public sync-state contract, not a demo-only diagnostics
model.

Example before any Pod attachment:

```text
status=unconfigured configured=false pending=1
connection reachable=false notifications=false
lastSyncedAt=-
lastFailedAt=-
lastFailureReason=-
```

Example after a successful sync:

```text
status=idle configured=true pending=0
connection reachable=true notifications=false
lastSyncedAt=2026-05-02T12:00:00.000Z
lastFailedAt=-
lastFailureReason=-
```

`reachable` is the last known sync result, not a foreground liveness probe.
The local-first commands still work even when the last known remote state is
offline.

When a canonical remote edit is classified as unsupported, the bounded
protective policy is to keep local state unchanged and skip importing that
remote shape. If a logger is attached, this is surfaced as
`sync:reconcile:unsupported` with
`policy: "preserve-local-skip-unsupported-remote"` and a reason string.

### Inspecting canonical Pod output

The demo's canonical Pod output is Solid-specific transport state layered on
top of the storage-agnostic `lofipod` core. The core library remains local-
first and adapter-driven; the canonical Turtle path below is specific to the
current Solid Pod adapter and the demo's task mapping.

To inspect a synced task resource:

1. create or update a task locally
2. run `sync now --data-dir <dir> --pod-base-url <url>`
3. read `tasks/<id>.ttl` from the target Pod

The canonical task Turtle should contain:

- the task subject URI `https://michalporeba.com/demo/id/task/<id>`
- RDF type `mlg:Task`
- `schema:name` for the task title
- `mlg:status` pointing at `mlg:Todo` or `mlg:Done`
- optional `mlg:due` with datatype `mlg:edtf`

Task resources intentionally do not include journal-only fields such as
`dct:created` or `dct:modified`.

### Fresh-local recovery

`sync bootstrap` is the explicit first-attach recovery tool for a fresh local
state directory. It is not a replacement for ordinary local reads and it is
not meant to run automatically on every startup.

The intended recovery path is:

1. start with an empty or fresh `--data-dir`
2. attach the Pod runtime inputs through `sync bootstrap`
3. import supported canonical entity files such as `tasks/<id>.ttl`
4. continue using ordinary local commands such as `task get`, `task list`, and
   `journal list`

Canonical task resources under `tasks/<id>.ttl` are what make this recovery
path possible. `lofipod` uses the demo entity mapping to project those remote
graphs back into the same local SQLite-backed state and read model used by
locally created tasks.

Bootstrap stays additive by design:

- missing local entities are imported
- graph-identical local entities are skipped
- supported bounded mixed-state differences are reconciled deterministically
- unsupported or unsafe mixed-state differences are surfaced explicitly
- `collisions` remains as the compatibility list of unresolved unsupported
  entities

That keeps the first remote recovery story small and inspectable while
preserving the local-first operational model after import.

### Two-device workflow

The repo now includes a concrete two-directory todo workflow for demonstrating
supported multi-device consistency over one shared Pod dataset.

Use one shared log path and two local data directories:

```bash
export DEMO_POD_BASE_URL="http://localhost:3400/"
export DEMO_LOG_BASE_PATH="apps/lifegraph-demo-demo/log/"

npm run demo -- task add --data-dir /tmp/lofipod-a --id task-1 --title "Shared task" --due 2026-04
npm run demo -- sync now --data-dir /tmp/lofipod-a --pod-base-url "$DEMO_POD_BASE_URL" --log-base-path "$DEMO_LOG_BASE_PATH"

npm run demo -- sync bootstrap --data-dir /tmp/lofipod-b --pod-base-url "$DEMO_POD_BASE_URL" --log-base-path "$DEMO_LOG_BASE_PATH"
npm run demo -- task get task-1 --data-dir /tmp/lofipod-b

# Flush the imported bootstrap state so the second directory is ready to
# participate in ongoing log-based sync.
npm run demo -- sync now --data-dir /tmp/lofipod-b --pod-base-url "$DEMO_POD_BASE_URL" --log-base-path "$DEMO_LOG_BASE_PATH"

npm run demo -- task done task-1 --data-dir /tmp/lofipod-a
npm run demo -- sync now --data-dir /tmp/lofipod-a --pod-base-url "$DEMO_POD_BASE_URL" --log-base-path "$DEMO_LOG_BASE_PATH"
npm run demo -- sync now --data-dir /tmp/lofipod-b --pod-base-url "$DEMO_POD_BASE_URL" --log-base-path "$DEMO_LOG_BASE_PATH"
npm run demo -- task get task-1 --data-dir /tmp/lofipod-b
```

What this proves:

1. the first local directory can create and sync a task to canonical Pod data
2. a second fresh local directory can recover that existing task from the Pod
3. later changes from the first directory become visible in the second after
   the second directory resumes sync against the same dataset

This CLI proof is intentionally process-based. Each `sync ...` command reopens
local state, reattaches the runtime Pod adapter, and advances sync work for
that command invocation. In a long-lived attached engine, the same remote push,
pull, and retry behavior runs automatically in the background; that attached
model is covered separately by the focused integration suite in
`tests/pod-auto-sync.integration.test.ts`.
