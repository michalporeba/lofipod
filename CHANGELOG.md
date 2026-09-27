# Changelog

All notable changes to `lofipod` are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
follows [Semantic Versioning](https://semver.org/). While the version is below
1.0, minor releases may add or reshape public API.

## [0.3.0] - 2026-09-27

Sync becomes trustworthy under real-world conditions: other clients, direct Pod
edits, interruptions, and evolving entity definitions.

### Added

- Replay of compatible changes written to the Pod replication log by other
  `lofipod` clients, including from a fresh device.
- Reconciliation of supported edits made directly to canonical `.ttl` entity
  resources after attach.
- Detection and classification of unsupported or unsafe remote edits, handled
  by a documented policy (`preserve-local-skip-unsupported-remote`) rather than
  silently overwriting local data.
- `SyncState.reconciliation` exposing the last unsupported-change policy applied
  and the reason.
- Bounded model evolution: entity definitions can change over time, with
  existing local data reprojected into the updated model and canonical Pod
  resources kept compatible.
- `SyncState.migration` and the `MigrationOutcome` type, reporting the latest
  local and canonical-remote migration outcome (`repaired`, `migrated`,
  `unchanged`, or `failed`) with phase, entity, timestamp, and failure reason.
- `sync.bootstrap()` now merges supported first-attach overlaps when local and
  remote data both exist, reported in the new `reconciled` list, and reports
  entities it could not import in the new `unsupported` list.
- `SyncAttachConfig.startBackground` option (default `true`) to attach without
  starting background polling, notifications, and the initial sync.
- `PodSyncAdapter.listLogEntries` accepts an optional `{ logBasePath }`, and the
  Solid adapter now lists replication log entries from the Pod.
- New architecture, development, deployment, and contribution guides; updated
  quickstart and testing guide; an expanded CLI demo covering Pod attach,
  offline use, and multi-device sync.

### Changed

- Recovery from interrupted or failed sync work is more robust: pending work is
  retried cleanly instead of leaving partial state.
- Unsupported or incomplete migrations now fail explicitly with entity-scoped
  context during local reprojection, remote log replay, and canonical
  reconciliation, instead of being partially applied.
- Runtime dependency `better-sqlite3` upgraded from 12 to 13 (requires Node.js
  22 or later; `lofipod` already requires Node.js 24 or later).

### Upgrade notes

- `BootstrapResult` has new required `reconciled` and `unsupported` fields, and
  `SyncState` has new `reconciliation` and `migration` fields. Code that only
  reads these results is unaffected; hand-written test fakes that construct them
  need the new fields.
- The evolution contract is deliberately bounded to shallow entities and the
  supported paths documented in `docs/API.md`; it is not a
  general-purpose schema migration system.

## [0.2.1] - 2026-04-19

### Changed

- Dependency updates, including `@inrupt/solid-client-authn-node` 4.0.0.

## [0.2.0] - 2026-04-09

### Added

- Full local CRUD with memory, IndexedDB, and SQLite storage adapters.

## [0.1.0] - 2026-03-29

- First public release, used to validate automated publishing.

[0.3.0]: https://github.com/michalporeba/lofipod/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/michalporeba/lofipod/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/michalporeba/lofipod/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/michalporeba/lofipod/releases/tag/v0.1.0
