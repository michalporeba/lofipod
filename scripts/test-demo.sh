#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DATA_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$DATA_DIR"
}

trap cleanup EXIT

help_output="$(npm run demo -- help)"
printf "%s\n" "$help_output" | grep -q "lifegraph-demo"
printf "%s\n" "$help_output" | grep -q "task get <id>"

task_create_output="$(
  npm run demo -- task add \
    --data-dir "$DATA_DIR" \
    --id task-1 \
    --title "Prepare April review" \
    --due 2026-04
)"
printf "%s\n" "$task_create_output" | grep -q "created task-1 \[todo\] Prepare April review due=2026-04"

task_get_output="$(npm run demo -- task get task-1 --data-dir "$DATA_DIR")"
printf "%s\n" "$task_get_output" | grep -q "task-1 \[todo\] Prepare April review due=2026-04"

task_list_output="$(npm run demo -- task list --data-dir "$DATA_DIR")"
printf "%s\n" "$task_list_output" | grep -q "task-1 \[todo\] Prepare April review due=2026-04"

task_done_output="$(npm run demo -- task done task-1 --data-dir "$DATA_DIR")"
printf "%s\n" "$task_done_output" | grep -q "completed task-1 \[done\] Prepare April review due=2026-04"

task_done_get_output="$(npm run demo -- task get task-1 --data-dir "$DATA_DIR")"
printf "%s\n" "$task_done_get_output" | grep -q "task-1 \[done\] Prepare April review due=2026-04"

task_delete_output="$(npm run demo -- task delete task-1 --data-dir "$DATA_DIR")"
printf "%s\n" "$task_delete_output" | grep -q "deleted task-1"

task_final_list_output="$(npm run demo -- task list --data-dir "$DATA_DIR")"
printf "%s\n" "$task_final_list_output" | grep -q "no tasks"
