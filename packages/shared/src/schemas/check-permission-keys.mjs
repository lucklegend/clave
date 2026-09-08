// Diffs `permissionKeySchema` in `permissions.ts` against the seed migration's `values`
// block for `public.permissions`, in both directions:
//
//   * a key only in SQL — the migration seeded a capability this build has never heard of.
//     Nothing else catches it: `user_permission_keys` and every RLS policy read
//     `public.permissions` directly and know nothing about `PermissionKey`.
//   * a key only in TS — a capability the type system can check but that no row in
//     `public.permissions` grants. `user_permission_keys` enumerates the table, so a
//     stray TS-only key can never appear in a permission set; a branch gated on it looks
//     reachable and never fires.
//
// Both fail closed but in opposite directions — a key only in SQL is silently dropped by
// this script's own parsing, a key only in TS can never be held by anyone — and both are
// still bugs that nothing else would surface.
//
// Run by hand, from the repo root, after any edit to the seed migration or to
// `permissions.ts`:
//   node packages/shared/src/schemas/check-permission-keys.mjs
// Dependency-free and deliberately not a test — the repo has no test runner. Sibling in
// shape to `src/theme/check-tokens.mjs`: same header convention, same console output, same
// exit-code contract.
// Node's globals are imported from `node:` modules rather than reached for as bare globals,
// the same reason check-tokens.mjs gives — an import is both the visible dependency and the
// thing that lints. `console` is imported explicitly (rather than declared in ESLint config)
// because this file lives in `src/schemas/`, outside the `src/theme/*.mjs` glob the
// package's `eslint.config.mjs` grants `console` to, and adding a second glob there is a
// config change this script does not need.
import { readFileSync } from "node:fs";
import console from "node:console";
import process from "node:process";
import { URL } from "node:url";

const MIGRATION_PATH = "supabase/migrations/20260906120100_seed_roles_and_permissions.sql";
const MIGRATION_URL = new URL(`../../../../${MIGRATION_PATH}`, import.meta.url);
const SCHEMA_PATH = "packages/shared/src/schemas/permissions.ts";
const SCHEMA_URL = new URL("permissions.ts", import.meta.url);

const failures = [];
function fail(message) {
  failures.push(message);
  return message;
}

// --- the migration's values block -------------------------------------------------------

// `--` line comments sit inside the values block itself (a note on `users.manage`), and the
// tuple matching below has no business reading them.
function stripSqlLineComments(sql) {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

// The permissions insert is the first `values (...)` in the file, closed by the `as seed`
// alias that names its columns — that alias is what tells this block apart from the roles
// and role_permissions inserts that follow it.
function permissionKeysFromMigration(sql) {
  const start = sql.indexOf("insert into public.permissions");
  const end = sql.indexOf("as seed (resource, action, description)", start);
  if (start === -1 || end === -1) {
    fail(`could not find the public.permissions values block in ${MIGRATION_PATH}`);
    return [];
  }

  const block = stripSqlLineComments(sql.slice(start, end));
  const keys = [];
  for (const [, resource, action] of block.matchAll(/\(\s*'([a-z]+)'\s*,\s*'([a-z]+)'\s*,/g)) {
    keys.push(`${resource}.${action}`);
  }
  return keys;
}

// --- the TS enum ---------------------------------------------------------------------------

function permissionKeysFromSchema(ts) {
  const start = ts.indexOf("z.enum([");
  const end = ts.indexOf("])", start);
  if (start === -1 || end === -1) {
    fail(`could not find the z.enum([...]) literal in ${SCHEMA_PATH}`);
    return [];
  }

  const block = ts.slice(start, end);
  return [...block.matchAll(/"([a-z]+\.[a-z]+)"/g)].map(([, key]) => key);
}

const migrationKeys = permissionKeysFromMigration(readFileSync(MIGRATION_URL, "utf8"));
const schemaKeys = permissionKeysFromSchema(readFileSync(SCHEMA_URL, "utf8"));

console.log(`check-permission-keys — ${SCHEMA_PATH} against ${MIGRATION_PATH}\n`);
console.log(`  migration keys: ${migrationKeys.length}`);
console.log(`  schema keys:    ${schemaKeys.length}`);

const migrationSet = new Set(migrationKeys);
const schemaSet = new Set(schemaKeys);

for (const key of migrationKeys) {
  if (!schemaSet.has(key)) {
    fail(`${key} is seeded in the migration but missing from permissionKeySchema`);
  }
}
for (const key of schemaKeys) {
  if (!migrationSet.has(key)) {
    fail(`${key} is in permissionKeySchema but not seeded in the migration`);
  }
}

if (failures.length === 0) {
  console.log(`\nOK — ${migrationKeys.length} keys match exactly, both directions.`);
} else {
  console.log(`\n${failures.length} FAILURE(S)`);
  for (const message of failures) console.log(`  ${message}`);
  process.exitCode = 1;
}
