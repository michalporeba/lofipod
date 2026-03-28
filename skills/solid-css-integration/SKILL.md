---
name: solid-css-integration
description: Use when setting up Community Solid Server integration tests for a local-first library or app, especially when you need Docker-backed CSS coverage for real N3 Patch behavior, Pod file layout, and account/client-credentials authentication without slowing the normal test suite.
---

# Community Solid Server Integration

Use this skill when a project needs real Solid integration coverage with
Community Solid Server (CSS) in Docker.

Keep the integration suite focused. The goal is to prove the Pod boundary
against a real server, not to rebuild the whole test pyramid with Docker.

## What to cover

- Real canonical resource creation and update.
- Real N3 Patch compatibility.
- Real Pod path/layout compatibility.
- Real account and client-credentials flow when authentication matters.

Keep these tests out of the normal fast suite. Use a dedicated Vitest config and
a separate script such as `npm run test:pod`.

## Recommended test split

In practice, CSS defaults may force you to split coverage into two server
shapes:

- **Open-write server**
  Use this to prove real file creation, canonical resource layout, and N3 Patch
  update behavior.
- **Authenticated server**
  Use this to prove account creation, password setup, client-credentials
  generation, and authenticated session setup.

Do not assume one default CSS config will cleanly prove both.

## Workflow

1. Start CSS in Docker with a dedicated compose file.
2. Keep integration tests in files excluded from the normal Vitest config.
3. Use a separate Vitest config for the pod suite only.
4. For authenticated CSS flows:
   - create an account through `/.account/`
   - set email/password
   - create a pod
   - create client credentials
   - log in with `@inrupt/solid-client-authn-node`
   - pass `session.fetch.bind(session)` into your Pod adapter
5. For real canonical writes:
   - create the RDF resource with `PUT` on first sync
   - use `PATCH text/n3` for later updates
6. Clean Docker services with `down -v --remove-orphans` before and after the
   suite so repeated runs do not fight old containers.

## Important gotchas

- CSS Docker images may not include the config alias you expect. Inspect the
  built-in config directory inside the image instead of guessing names.
- `file-root.json` is useful for open-write real patch tests.
- Authenticated CSS account flow and authenticated Pod writes are not the same
  thing.
- Passing an unbound `session.fetch` can break authenticated requests. Bind it.
- CSS accepted N3 Patch updates only after the first resource existed.
- For delete+insert updates, CSS required the `solid:where` clause to match the
  retracted triples rather than using an empty `{}`.

Read [references/css-gotchas.md](references/css-gotchas.md) before building or
debugging the integration setup.
