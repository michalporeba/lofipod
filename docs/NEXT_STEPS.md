# NEXT

Concept review, 2026-11-07. Focus: validate the concept against its real
target before adding features.

## Positioning

- No mature JS/TS local-first Solid sync library exists. Closest prior art is
  Locorda (Dart/Flutter, CRDT-based, JS port listed as "Future").
- The differentiator is the split: plain, human- and app-readable canonical
  RDF per entity in the Pod, with sync machinery isolated in an app-private
  log. Keep this; it is the only shape that honours Solid's data-portability
  promise without CRDT metadata in user data.

## Strengths to keep

- Disciplined scope (shallow entities, no realtime, no ordered collections).
- Local read model as the only query surface; Pod as replication medium.
- Entity-scoped triple deltas give field-level merge almost for free.
- Canonical-file recovery is mandatory, so logs are disposable.
- Polling for correctness, notifications as acceleration.
- Real CSS integration tests and the demo as regression harness.

## Weaknesses

1. **No change feed.** Every sync cycle lists the whole log and GETs every
   entry (`src/pod/solid.ts` `listLogEntries`), every 30 s. Cost is
   O(total history). Bucketing described in the ADR is not implemented.
   Contradicts "reading the whole Pod on startup is not acceptable".
2. **Interop is read-only in practice.** Save diffs stored graph against
   `toRdf(entity)` (`src/engine/local.ts`), so triples added by other apps
   are either skipped as unsupported or retracted on next save. Interop also
   needs shared vocabularies, which examples do not use.
3. **Two remote sources of truth.** Canonical files and log are written
   non-atomically; much of the remote engine (~1,250 lines) exists to
   reconcile drift. Most likely home of subtle bugs.
4. **Wall-clock LWW** for true conflicts. Clock skew between offline devices
   picks wrong winners. Document or move to a logical clock.
5. **Primary target unproven.** ADR targets browser apps; the only consumer
   is a Node CLI with a static `authorization` header. No browser app, no
   Solid-OIDC/DPoP login, token refresh, or multi-device browser test.
6. **Mapping boilerplate.** ~90 lines of `toRdf`/`project` for a four-field
   task. Likely adoption blocker.
7. **Process outweighs product.** 19 docs files, overlapping API docs,
   `_bmad-output/` artifacts, for a ~6.7k-line library without users.
8. **Small audience.** Solid devs ∩ local-first devs.

## Next steps, in order

1. **Real browser app.** Tiny todo app with real Solid login, two devices,
   against a public Pod provider. If this feels bad, nothing else matters.
2. **Change feed.** Time- or sequence-partitioned log segments plus a locally
   stored cursor so a sync cycle is O(changes). Benchmark on a Pod with
   1,000+ entities.
3. **Interop decision.** Either preserve unknown triples (round-trip them
   through the read model) or document clearly that other apps may only read.
4. **Reduce mapping boilerplate.** Field-spec helper that generates
   `toRdf`/`project`, with hand-written codecs as escape hatch.
5. **Trim docs** to README, ADR, API, WIP (+ QUICKSTART, TESTING).

## Go / no-go signals

- Go: steps 1 and 2 work at acceptable latency on a real Pod, and someone
  other than the author builds something with it.
- Reposition: if step 2 is fundamentally slow on Solid (Locorda reports
  similar protocol limits, e.g. no batch writes), consider a general
  local-first engine with Solid as one backend among several, or stop.
