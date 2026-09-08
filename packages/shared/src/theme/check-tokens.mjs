// Checks the Material 3 token blocks in `apps/web/src/app/globals.css` against the scheme
// committed beside this file. Two jobs, one exit code:
//
//   1. Drift — every `--md-<role>: <hex>` in each of the four theme blocks must equal
//      `scheme.json`'s `content.light` / `content.dark` value for that role, and every block that
//      declares roles must declare all of them. Seventy-two hex values are typed by hand into
//      that file; this is what stands between a typo and a silently wrong colour.
//   2. Contrast — WCAG 2.x relative-luminance ratios for the pair table the design measures, in
//      both themes, each against its floor. The whole table prints whatever the outcome, so a
//      scheme change shows its margins and not just its verdict.
//
// Run by hand, from the repo root, after any edit to the token blocks or to `scheme.json`:
//   node packages/shared/src/theme/check-tokens.mjs
// Dependency-free and deliberately not a test — the repo has no test runner. It sits beside
// `gen-scheme.mjs` as the other half of a hand-run pair: that one writes the scheme, this one
// proves `globals.css` still agrees with it.
// Node's globals are imported rather than reached for: this package's ESLint config declares
// `console` for these two scripts and nothing else, so an import is both the visible dependency
// and the thing that lints.
import { readFileSync } from "node:fs";
import process from "node:process";
import { URL } from "node:url";

const CSS_PATH = "apps/web/src/app/globals.css";
const CSS_URL = new URL(`../../../../${CSS_PATH}`, import.meta.url);
const SCHEME_URL = new URL("scheme.json", import.meta.url);

const failures = [];
function fail(message) {
  failures.push(message);
  return message;
}

// --- the scheme, keyed the way the CSS is ---------------------------------------------------

// `scheme.json` names roles in camelCase because Material Color Utilities does; `globals.css`
// names them in kebab because CSS custom properties do. One conversion here, and every lookup
// below is by the CSS name.
function kebab(role) {
  return role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

function rolesOf(themeScheme) {
  return Object.fromEntries(
    Object.entries(themeScheme).map(([role, hex]) => [kebab(role), String(hex).toLowerCase()]),
  );
}

const scheme = JSON.parse(readFileSync(SCHEME_URL, "utf8"));
const expected = {
  light: rolesOf(scheme.content.light),
  dark: rolesOf(scheme.content.dark),
};
const ROLES = Object.keys(expected.light);

// The scheme is the source of truth for both jobs, so it gets a pass of its own first: a role
// `gen-scheme.mjs` could not resolve lands as `null`, which would otherwise read downstream as a
// CSS mismatch and send the reader to the wrong file.
for (const theme of ["light", "dark"]) {
  for (const [role, hex] of Object.entries(expected[theme])) {
    if (!/^#[0-9a-f]{6}$/.test(hex)) {
      fail(`scheme.json content.${theme}.${role} is not a 6-digit hex: ${hex}`);
    }
  }
}
for (const role of Object.keys(expected.dark)) {
  if (!ROLES.includes(role)) {
    fail(`scheme.json content.dark carries a role content.light does not: ${role}`);
  }
}

// --- job 1: drift ---------------------------------------------------------------------------

// The four blocks of the three-way theme mechanism, in source order. `declares` is why they are
// listed rather than discovered: the `data-theme="light"` block is *expected* to carry no roles,
// because `:root` above it already holds the light values and the dark media query excludes that
// attribute. A role declared there would be a second copy free to go stale, so zero is asserted
// rather than assumed.
const BLOCKS = [
  { selector: ":root", theme: "light", declares: true },
  { selector: ':root:not([data-theme="light"])', theme: "dark", declares: true },
  { selector: ':root[data-theme="light"]', theme: "light", declares: false },
  { selector: ':root[data-theme="dark"]', theme: "dark", declares: true },
];

function escapeForRegExp(literal) {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Comments come out first: the file's header comment names a role and quotes a hex in prose, and
// brace matching has no business reading prose either.
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

// `:root`, `:root:not(...)` and `:root[...]` share a prefix, so the selector has to be followed
// by its own brace to match — that is what tells the three apart.
function blockBody(css, selector) {
  const start = new RegExp(`${escapeForRegExp(selector)}\\s*\\{`).exec(css);
  if (!start) return null;

  const bodyFrom = start.index + start[0].length;
  let depth = 1;
  for (let i = bodyFrom; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}" && --depth === 0) return css.slice(bodyFrom, i);
  }
  return null;
}

// Only declarations whose value is a hex are colour roles, so `--md-shape-*` (a length) and
// `--md-elev-*` (a shadow list) fall out here without having to be named.
function hexDeclarations(body) {
  const found = new Map();
  for (const [, role, hex] of body.matchAll(/--md-([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    found.set(role, hex.toLowerCase());
  }
  return found;
}

const css = stripComments(readFileSync(CSS_URL, "utf8"));

console.log(`check-tokens — ${CSS_PATH} against packages/shared/src/theme/scheme.json\n`);
console.log("TOKEN DRIFT");

for (const block of BLOCKS) {
  const body = blockBody(css, block.selector);
  if (body === null) {
    console.log(`  ${block.selector.padEnd(32)} MISSING`);
    fail(`${block.selector} is not in ${CSS_PATH}`);
    continue;
  }

  const declared = hexDeclarations(body);
  const problems = [];

  for (const [role, hex] of declared) {
    if (!ROLES.includes(role)) {
      problems.push(fail(`${block.selector}: --md-${role} is not a role in scheme.json`));
    } else if (!block.declares) {
      problems.push(
        fail(`${block.selector}: --md-${role} is declared here but should inherit from :root`),
      );
    } else if (hex !== expected[block.theme][role]) {
      problems.push(
        fail(
          `${block.selector}: --md-${role} is ${hex}, content.${block.theme} says ${expected[block.theme][role]}`,
        ),
      );
    }
  }

  if (block.declares) {
    for (const role of ROLES.filter((r) => !declared.has(r))) {
      problems.push(
        fail(`${block.selector}: --md-${role} is missing (content.${block.theme} defines it)`),
      );
    }
  }

  const count = block.declares
    ? `${declared.size}/${ROLES.length} roles`
    : `${declared.size} roles (inherits :root)`;
  const verdict = problems.length === 0 ? "ok" : `${problems.length} problem(s)`;
  console.log(
    `  ${block.selector.padEnd(32)} ${block.theme.padEnd(6)} ${count.padEnd(26)} ${verdict}`,
  );
  for (const problem of problems) console.log(`    ${problem}`);
}

// --- job 2: contrast ------------------------------------------------------------------------

function relativeLuminance(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fg, bg) {
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// The design's measured-contrast table. 4.5 is WCAG 1.4.3 for text and 3.0 is 1.4.11 for a
// component boundary or a focus indicator; `floor: null` is a decorative hairline, which carries
// no meaning and so carries no floor.
const PAIRS = [
  { fg: "on-surface", bg: "surface", floor: 4.5 },
  { fg: "on-surface-variant", bg: "surface", floor: 4.5 },
  { fg: "on-surface", bg: "surface-container-low", floor: 4.5 },
  { fg: "on-surface-variant", bg: "surface-container-low", floor: 4.5 },
  { fg: "on-surface-variant", bg: "surface-container", floor: 4.5, note: "app bar" },
  { fg: "on-surface-variant", bg: "surface-container-lowest", floor: 4.5 },
  { fg: "primary", bg: "surface", floor: 4.5 },
  { fg: "primary", bg: "surface-container", floor: 4.5 },
  { fg: "primary", bg: "surface-container-low", floor: 4.5 },
  { fg: "on-primary", bg: "primary", floor: 4.5, note: "filled button" },
  { fg: "outline", bg: "surface", floor: 3.0 },
  { fg: "outline", bg: "surface-container-low", floor: 3.0 },
  { fg: "outline", bg: "surface-container", floor: 3.0 },
  { fg: "outline-variant", bg: "surface", floor: null, note: "divider, decorative" },
  { fg: "on-primary-container", bg: "primary-container", floor: 4.5, note: "chip, booked slot" },
  { fg: "on-secondary-container", bg: "secondary-container", floor: 4.5, note: "selected segment" },
  { fg: "on-tertiary-container", bg: "tertiary-container", floor: 4.5, note: "status badge" },
  { fg: "on-error-container", bg: "error-container", floor: 4.5, note: "alert" },
  { fg: "on-surface", bg: "secondary-container", floor: 4.5, note: "owner-only row" },
  { fg: "on-surface-variant", bg: "secondary-container", floor: 4.5, note: "row sub-meta" },
  { fg: "primary", bg: "secondary-container", floor: 3.0, note: "focus ring" },
  { fg: "primary", bg: "error-container", floor: 3.0, note: "focus ring" },
  { fg: "error", bg: "surface-container-low", floor: 4.5, note: "invalid field" },
];

// Asserted, not omitted. Both are measured against their floor and printed with the decision that
// waives it, because a pair left out of the table is indistinguishable from a pair nobody thought
// about — and the numbers stay on screen, so a scheme change shows what the waiver now covers.
const EXEMPT_PAIRS = [
  {
    fg: "primary",
    bg: "primary-container",
    floor: 3.0,
    exemption:
      "D4 rule 3 — no focusable element on the three built surfaces sits on a primary-container fill, and `.focus-on-container` moves the ring to on-primary-container for the first one that does",
  },
  {
    fg: "outline",
    bg: "secondary-container",
    floor: 3.0,
    exemption:
      "the segmented button's internal separator, not the boundary that identifies the control — that boundary is the track's outer border, measured against surface-container-low above",
  },
];

function printRow(pair, { exempt }) {
  const light = contrastRatio(expected.light[pair.fg], expected.light[pair.bg]);
  const dark = contrastRatio(expected.dark[pair.fg], expected.dark[pair.bg]);
  const below = pair.floor !== null && (light < pair.floor || dark < pair.floor);

  let verdict;
  if (pair.floor === null) verdict = "n/a";
  else if (!below) verdict = exempt ? "ok — clears its floor anyway" : "ok";
  else if (exempt) verdict = "below floor, exempt";
  else {
    verdict = "FAIL";
    fail(
      `${pair.fg} on ${pair.bg}: ${light.toFixed(2)} light / ${dark.toFixed(2)} dark, floor ${pair.floor}`,
    );
  }

  const label = `${pair.fg} / ${pair.bg}`;
  const floor = pair.floor === null ? "—" : pair.floor.toFixed(1);
  const note = pair.note ? `  (${pair.note})` : "";
  console.log(
    `  ${label.padEnd(46)} ${light.toFixed(2).padStart(6)} ${dark.toFixed(2).padStart(6)} ${floor.padStart(6)}  ${verdict}${note}`,
  );
}

console.log("\nCONTRAST — WCAG 2.x, computed from scheme.json, both themes");
console.log(
  `  ${"pair".padEnd(46)} ${"light".padStart(6)} ${"dark".padStart(6)} ${"floor".padStart(6)}`,
);
for (const pair of PAIRS) printRow(pair, { exempt: false });

console.log("\nNAMED EXEMPTIONS — measured and recorded, floor waived by a decision");
for (const pair of EXEMPT_PAIRS) {
  printRow(pair, { exempt: true });
  console.log(`    ${pair.exemption}`);
}

// --- verdict --------------------------------------------------------------------------------

if (failures.length === 0) {
  console.log(
    `\nOK — ${ROLES.length * 3} token values match scheme.json, ${PAIRS.length} contrast pairs clear their floor.`,
  );
} else {
  console.log(`\n${failures.length} FAILURE(S)`);
  for (const message of failures) console.log(`  ${message}`);
  process.exitCode = 1;
}
