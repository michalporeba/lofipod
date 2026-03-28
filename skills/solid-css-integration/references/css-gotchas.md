# CSS Gotchas

These are the main lessons learned while making the Docker-backed CSS
integration suite work.

## Service split

Two CSS services were useful in practice:

- `solid-open`
  Uses an open/root-public config to prove real resource creation and N3 Patch
  behavior.
- `solid-auth`
  Uses the normal account-enabled file config to prove account creation and
  client-credentials authentication.

Why:

- Authenticated CSS setup did not cleanly permit the same write pattern used by
  the library for creating new entity/log containers and resources.
- Open-write CSS setup was good for real file and patch behavior but not for
  auth coverage.

This is a test-harness compromise, not a product requirement.

## Config names in the Docker image

Do not assume config files from docs or memory exist in the image.

The CSS image used here contained:

- `config/file.json`
- `config/file-root.json`
- `config/file-root-pod.json`

It did **not** contain `config/file-no-setup.json`.

For open-write tests, `config/file-root.json` was the right preset because it
initializes the root container with full public access.

## Real adapter behavior

For a real CSS-compatible Pod adapter:

- On first sync of a canonical entity resource:
  - ensure parent containers exist
  - create the resource with `PUT text/turtle`
  - serialize the full assertion set as Turtle
- On later syncs:
  - send `PATCH text/n3`
  - use a real N3 Patch document

## N3 Patch details that mattered

The generated patch needed to look like a real Solid N3 Patch:

- `a solid:InsertDeletePatch`
- `solid:inserts { ... }`
- `solid:deletes { ... }`
- `solid:where { ... }`

Two practical details mattered with CSS:

- Patching an empty resource failed with `409`; initial create had to use `PUT`.
- For updates that retract triples, `solid:where { ... }` had to contain the
  retracted triples instead of `{}`.

## Auth flow that worked

For the authenticated server:

1. Read `/.account/` controls.
2. Create an account.
3. Re-read controls with `CSS-Account-Token`.
4. Create the password login for the account.
5. Log in with email/password.
6. Re-read controls with the logged-in account token.
7. Create a pod.
8. Create client credentials for the Pod WebID.
9. Use `@inrupt/solid-client-authn-node` `Session.login(...)`.
10. Pass `session.fetch.bind(session)` into the adapter.

Notes:

- Simple account cookies were not enough to prove the Pod write path we needed.
- `session.fetch` must be bound before passing it around.

## Test runner layout

Keep the Docker-backed suite out of the normal fast suite:

- normal `vitest.config.ts`:
  - include normal tests only
  - exclude all `*.integration.test.ts`
- dedicated `vitest.pod.config.ts`:
  - include only pod integration tests

Use a wrapper script to:

- export the open/auth base URLs
- start Docker services
- run the dedicated Vitest config
- always clean up with `down -v --remove-orphans`

## What is library-specific vs harness-specific

Library-specific:

- canonical resource path behavior
- N3 Patch generation
- first-write vs later-update behavior
- remote log file layout

Harness-specific:

- account creation helper
- client-credentials bootstrap
- two-service CSS split
- Docker cleanup/orphan handling
