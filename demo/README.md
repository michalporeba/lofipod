# Demo

This directory is reserved for the in-repo demo application and related assets.

The first purpose of the demo is not to be a polished showcase. It is a small
end-to-end application surface that can help validate `lofipod` behaviour over
time.

The current shape is:

- a command-line-first application that can also gain a TUI shell later
- a regression harness for future library changes
- a place to keep demo-specific ontology and sample data assets

See [ontology/README.md](ontology/README.md) for the `mlg` ontology subset used
by the demo.

## App shape

The demo currently uses two entity families:

- tasks
- journal entries

The command-line interface is the current primary surface. The demo application
logic stays separate from the CLI shell so a lightweight TUI can wrap the same
operations later.

The local-first state for the demo lives in a SQLite-backed filesystem store,
by default under a cache directory such as:

- `$XDG_CACHE_HOME/lifegraph-demo`
- or `~/.cache/lifegraph-demo`

## Sync

The demo can also project its local-first data to a Solid Pod.

Use:

- `sync bootstrap --pod-base-url <url>`
- `sync status`
- `sync now --pod-base-url <url>`

The log path defaults to `apps/lifegraph-demo/log/` and can be overridden with
`--log-base-path`.
