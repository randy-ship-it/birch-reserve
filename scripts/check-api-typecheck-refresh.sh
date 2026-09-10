#!/usr/bin/env bash

set -euo pipefail

workspace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
db_source="$workspace_root/lib/db/src/schema/launch.ts"
db_dist="$workspace_root/lib/db/dist"
db_build_info="$workspace_root/lib/db/tsconfig.tsbuildinfo"
api_build_info="$workspace_root/artifacts/api-server/.tsbuildinfo"
api_fixture="$workspace_root/artifacts/api-server/src/typecheck-refresh.fixture.ts"
fixture_property="typecheckRefreshFixture"
fixture_column="typecheck_refresh_fixture"
snapshot="$(mktemp -d)"

snapshot_path() {
  local path="$1"
  local name="$2"

  if [[ -e "$path" ]]; then
    printf 'present\n' >"$snapshot/$name.state"
    cp -a "$path" "$snapshot/$name"
  else
    printf 'absent\n' >"$snapshot/$name.state"
  fi
}

restore_path() {
  local path="$1"
  local name="$2"
  local state_file="$snapshot/$name.state"

  if [[ ! -f "$state_file" ]]; then
    echo "Cannot restore $path: snapshot state is missing" >&2
    return 1
  fi

  if [[ "$(cat "$state_file")" == "present" ]]; then
    if [[ ! -e "$snapshot/$name" ]]; then
      echo "Cannot restore $path: snapshot content is missing" >&2
      return 1
    fi
    rm -rf "$path"
    cp -a "$snapshot/$name" "$path"
  else
    rm -rf "$path"
  fi
}

cleanup() {
  local status=$?
  trap - EXIT INT TERM

  if [[ ! -d "$snapshot" ]]; then
    exit "$status"
  fi

  restore_path "$db_source" db-source
  restore_path "$db_dist" db-dist
  restore_path "$db_build_info" db-build-info
  restore_path "$api_build_info" api-build-info
  restore_path "$api_fixture" api-fixture
  rm -rf "$snapshot"
  exit "$status"
}

snapshot_path "$db_source" db-source
snapshot_path "$db_dist" db-dist
snapshot_path "$db_build_info" db-build-info
snapshot_path "$api_build_info" api-build-info
snapshot_path "$api_fixture" api-fixture
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

cd "$workspace_root"

# Establish a declaration generated from the unmodified schema, then change the
# schema input so the declaration is intentionally stale.
pnpm exec tsc --build lib/db/tsconfig.json --force

node --input-type=module - "$db_source" "$fixture_property" "$fixture_column" <<'NODE'
import { readFile, writeFile } from "node:fs/promises";

const [sourcePath, property, column] = process.argv.slice(2);
const source = await readFile(sourcePath, "utf8");
const anchor = '    queueSequence: serial("queue_sequence").notNull(),';

if (!source.includes(anchor)) {
  throw new Error(`Could not find schema fixture anchor in ${sourcePath}`);
}
if (source.includes(property) || source.includes(column)) {
  throw new Error("Typecheck refresh fixture already exists in the database schema");
}

await writeFile(
  sourcePath,
  source.replace(anchor, `${anchor}\n    ${property}: text("${column}"),`),
);
NODE

if rg -q "$fixture_property" "$db_dist/schema/launch.d.ts"; then
  echo "Expected the database declaration to be stale before API typecheck" >&2
  exit 1
fi

cat >"$api_fixture" <<EOF
import { pilotWaitlistEntriesTable } from "@workspace/db";

type RefreshedDatabaseField =
  typeof pilotWaitlistEntriesTable.\$inferSelect["$fixture_property"];

const refreshedDatabaseField: RefreshedDatabaseField = null;
void refreshedDatabaseField;
EOF

stale_check_log="$snapshot/stale-api-typecheck.log"
if pnpm exec tsc -p artifacts/api-server/tsconfig.json --noEmit \
  >"$stale_check_log" 2>&1; then
  echo "Expected direct API compilation to fail against the stale declaration" >&2
  exit 1
fi
if ! rg -q "$fixture_property" "$stale_check_log"; then
  cat "$stale_check_log" >&2
  echo "Direct API compilation failed for an unexpected reason" >&2
  exit 1
fi

if [[ -n "${_API_TYPECHECK_REFRESH_TEST_PAUSE_SECONDS:-}" ]]; then
  sleep "$_API_TYPECHECK_REFRESH_TEST_PAUSE_SECONDS"
fi

pnpm --filter @workspace/api-server run typecheck

if ! rg -q "$fixture_property" "$db_dist/schema/launch.d.ts"; then
  echo "API typecheck passed without refreshing the database declaration" >&2
  exit 1
fi

echo "API typecheck refreshed stale database declarations successfully."