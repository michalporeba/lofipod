# lofipod Deployment Guide

**Date:** 2026-04-25

## Overview

`lofipod` is deployed as an npm package. The repository uses GitHub Actions to
enforce quality gates on pull requests and to publish releases only after the
same checks pass on release automation.

## Build Artifacts

- package bundles under `dist/`
- declaration files from `tsc`
- published package entrypoints:
  - `lofipod`
  - `lofipod/node`
  - `lofipod/browser`

## CI Workflow

File: `.github/workflows/ci.yml`

### Verify Job

Runs on pushes to `main` and pull requests:

```bash
npm ci
npm run verify
npm run build
```

### Demo Integration Job

Runs after verify:

```bash
npm ci
npm run test:demo
```

### Pod Integration Job

Runs after verify:

```bash
npm ci
npm run test:pod
```

## Publish Workflow

File: `.github/workflows/publish.yml`

### Trigger

- GitHub Release published event

### Release Gates

Before publishing, GitHub Actions runs:

```bash
npm ci
npm run verify
npm run build
npm run test:demo
npm run test:pod
```

### Publish Step

After all gates pass, the workflow runs:

```bash
npm publish --provenance --access public
```

Publishing uses npm trusted publishing with GitHub OIDC (`id-token: write`).

## Local Release Preparation

Before cutting a release locally, run:

```bash
npm run verify
npm run build
npm run test:demo
npm run test:pod
```

## Infrastructure Notes

- The repo does not deploy a long-running service.
- `docker-compose.solid.yml` is test infrastructure for local Community Solid
  Server integration checks.
- The publish path assumes npm as the distribution channel and GitHub Actions
  as the release automation platform.

---

_Generated using BMAD Method `document-project` workflow_
