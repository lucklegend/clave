// Checks every Tailwind class candidate in `apps/web/src` against the theme
// `apps/web/src/app/globals.css` declares. Its `@theme inline` block opens with `--color-*:
// initial` and `--radius-*: initial`, which deletes Tailwind's own palette and radius scale — so
// `bg-slate-200`, `bg-paper` and `shadow-[var(--shadow)]` are all names with nothing behind them.
// Tailwind 4 drops a candidate it cannot resolve *silently*: the build stays green and the colour
// simply never paints. That guardrail only bites if something reads the class strings and says so,
// and this is that reader.
//
// Run by hand, from the repo root, after any edit to the theme map or to a component's classes:
//   node packages/shared/src/theme/check-utilities.mjs
// Dependency-free and deliberately not a test, like `check-tokens.mjs` beside it, and on the same
// exit-code contract: the findings, then either `OK` and exit 0 or a failure list and exit 1.
// `check-tokens.mjs` proves the token *values* are right; this proves every name that reaches for
// one exists.
//
// WHAT IT CHECKS
//   * The utilities that take their value from `--color-*` — `bg-`, `text-`, `border-`, `fill-`,
//     `ring-` and the rest. The value must be a colour the theme map declares, a keyword Tailwind
//     keeps whatever the theme says (`transparent`, `current`, `inherit`), one of that namespace's
//     own non-colour values (`text-center`, `border-2`), or an arbitrary value.
//   * `rounded-*` against `--radius-*`, and `font-*` against `--font-*`.
//   * `var(--x)` inside any arbitrary value, against the custom properties `globals.css` declares
//     or reads — `--mark-width` and the `next/font` variables are set elsewhere and only read
//     there, so being read is enough to count as known.
//   * Bare project utilities, in the families `globals.css` declares with `@utility`: `body-*`,
//     `label-*`, `m3-*` and friends. A name in one of those families that no `@utility` block
//     defines is a failure. Those families are this repo's own, so no framework utility and no
//     hyphenated English word can be mistaken for one.
//
// WHAT IT DOES NOT
//   * Layout, spacing, flex, grid — Tailwind's own vocabulary. This knows the theme, not the
//     framework, so a candidate outside the namespaces above is ignored rather than judged.
//   * A misspelt bare utility outside the `@utility` families (`inline-flx`). It cannot be told
//     from prose without a full table of Tailwind's utilities, which is exactly the thing this
//     script refuses to own — a table that goes stale turns a green check into a lie.
//   * Comments. Tailwind scans them for candidates and this does not, on purpose: comment prose is
//     full of CSS property names (`font-size`, `border-radius`, `background-color`) shaped exactly
//     like candidates, and a check that cries wolf over documentation is a check nobody reads. The
//     cost is that a dead class named only in a comment goes unseen — it emits a rule no element
//     ever carries.
//   * Class names assembled across a `${...}` hole. The four class strings `features/brand/cta.ts`
//     exports are scanned where they are *defined*, so their characters are all checked; only a
//     name spliced together from parts (`bg-${role}`) escapes, and that is reported as
//     unclassified rather than guessed at.
//
// It reads string literals, which means UI copy is read as candidates too: a word beginning with a
// utility namespace and a hyphen (`to-do`) would be checked as one. None does today.
//
// Node's globals are imported rather than reached for, for the reason `check-tokens.mjs` gives:
// this package's ESLint config declares `console` for these scripts and nothing else.
import { readFileSync, readdirSync, statSync } from "node:fs";
import process from "node:process";
import { URL, fileURLToPath } from "node:url";

const CSS_PATH = "apps/web/src/app/globals.css";
const SRC_PATH = "apps/web/src";
const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

const failures = [];
function fail(message) {
  failures.push(message);
  return message;
}

// --- what `globals.css` declares --------------------------------------------------------------

// Comments come out first for the same reason they do in `check-tokens.mjs`, and one more: the
// theme map's own comments name `bg-slate-200`, `rounded-lg` and `--radius` in prose, and reading
// those as declarations would whitelist the very utilities the `initial` lines exist to kill.
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

// `@theme inline` opens with `--color-*: initial`, which the `[a-z0-9-]+` class cannot match — the
// wildcard falls out here rather than having to be excluded by name.
function themeNames(body, namespace) {
  const pattern = new RegExp(`--${namespace}-([a-z0-9-]+)\\s*:`, "g");
  return new Set([...body.matchAll(pattern)].map(([, name]) => name));
}

function braceBody(css, opening) {
  const start = new RegExp(`${opening}\\s*\\{`).exec(css);
  if (!start) return null;

  const bodyFrom = start.index + start[0].length;
  let depth = 1;
  for (let i = bodyFrom; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}" && --depth === 0) return css.slice(bodyFrom, i);
  }
  return null;
}

const css = stripComments(readFileSync(`${ROOT}${CSS_PATH}`, "utf8"));
const themeBody = braceBody(css, "@theme inline");
if (themeBody === null) {
  fail(`${CSS_PATH} has no @theme inline block — nothing to check candidates against`);
}

const colours = themeNames(themeBody ?? "", "color");
const radii = themeNames(themeBody ?? "", "radius");
const fonts = themeNames(themeBody ?? "", "font");
const utilities = new Set([...css.matchAll(/@utility\s+([a-z0-9-]+)/g)].map(([, name]) => name));

// The first segment of every multi-segment `@utility` name: `display`, `headline`, `title`,
// `body`, `label`, `m3`. A candidate in one of these families has to be one of the declared names,
// because nothing but this file coins names there.
const utilityFamilies = new Set(
  [...utilities].filter((name) => name.includes("-")).map((name) => name.split("-")[0]),
);

// Declared *or* read. `--mark-width` and the three `--font-*` faces `app/fonts.ts` loads are set
// outside this stylesheet and only read inside it, so being read there is as good a
// proof of existence as being declared there.
const properties = new Set([
  ...[...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(([, name]) => name),
  ...[...css.matchAll(/var\(\s*(--[a-z0-9-]+)/g)].map(([, name]) => name),
]);

// --- the namespaces this script owns ----------------------------------------------------------

// Every colour keyword Tailwind keeps whatever the theme says. `black` and `white` are absent on
// purpose: they come from `--color-black` / `--color-white`, which `--color-*: initial` removed.
const COLOUR_KEYWORDS = ["inherit", "current", "transparent"];

const TEXT_SIZES = ["xs", "sm", "base", "lg", "xl"].concat(
  [2, 3, 4, 5, 6, 7, 8, 9].map((n) => `${n}xl`),
);
const SHADOW_SIZES = ["2xs", "xs", "sm", "md", "lg", "xl", "2xl", "none"];
const LINE_STYLES = ["solid", "dashed", "dotted", "double", "hidden", "none"];
const WEIGHTS = [
  "thin",
  "extralight",
  "light",
  "normal",
  "medium",
  "semibold",
  "bold",
  "extrabold",
  "black",
];
const BORDER_SIDES = ["x", "y", "t", "r", "b", "l", "s", "e"];
const RADIUS_SIDES = BORDER_SIDES.concat(["ss", "se", "es", "ee", "tl", "tr", "bl", "br"]);

// `kind` picks the theme namespace the value is looked up in; `keywords`, `sides`, `numeric` and
// `subPrefixes` are the same namespace's non-theme vocabulary. Those four lists are this script's
// one completeness assumption: a Tailwind value missing from them reads as a token that does not
// exist. Widen the list rather than soften the verdict — a name added here costs nothing, and a
// failure nobody believes is what turns a check into noise.
const NAMESPACES = [
  { name: "accent", kind: "colour" },
  {
    name: "bg",
    kind: "colour",
    keywords: [
      "none",
      "auto",
      "cover",
      "contain",
      "fixed",
      "local",
      "scroll",
      "top",
      "bottom",
      "left",
      "right",
      "center",
      "top-left",
      "top-right",
      "bottom-left",
      "bottom-right",
      "left-top",
      "left-bottom",
      "right-top",
      "right-bottom",
      "repeat",
      "repeat-x",
      "repeat-y",
      "repeat-round",
      "repeat-space",
      "no-repeat",
    ],
    subPrefixes: ["clip", "origin", "blend", "linear", "radial", "conic"],
  },
  {
    name: "border",
    kind: "colour",
    keywords: LINE_STYLES.concat(["collapse", "separate"]),
    sides: BORDER_SIDES,
    numeric: true,
    subPrefixes: ["spacing"],
  },
  { name: "caret", kind: "colour" },
  {
    name: "decoration",
    kind: "colour",
    keywords: LINE_STYLES.concat(["wavy", "auto", "from-font"]),
    numeric: true,
  },
  { name: "divide", kind: "colour", keywords: LINE_STYLES, sides: ["x", "y"], numeric: true },
  { name: "fill", kind: "colour", keywords: ["none"] },
  { name: "from", kind: "colour", numeric: true },
  { name: "inset-ring", kind: "colour", numeric: true },
  { name: "inset-shadow", kind: "colour", keywords: SHADOW_SIZES },
  {
    name: "outline",
    kind: "colour",
    keywords: LINE_STYLES,
    numeric: true,
    subPrefixes: ["offset"],
  },
  { name: "placeholder", kind: "colour" },
  { name: "ring", kind: "colour", numeric: true, subPrefixes: ["offset"] },
  { name: "shadow", kind: "colour", keywords: SHADOW_SIZES },
  { name: "stroke", kind: "colour", keywords: ["none"], numeric: true },
  {
    name: "text",
    kind: "colour",
    keywords: TEXT_SIZES.concat([
      "left",
      "center",
      "right",
      "justify",
      "start",
      "end",
      "wrap",
      "nowrap",
      "balance",
      "pretty",
      "ellipsis",
      "clip",
    ]),
  },
  { name: "text-shadow", kind: "colour", keywords: SHADOW_SIZES },
  { name: "to", kind: "colour", numeric: true },
  { name: "via", kind: "colour", numeric: true },
  { name: "font", kind: "font", keywords: WEIGHTS, numeric: true, subPrefixes: ["stretch"] },
  { name: "rounded", kind: "radius", keywords: ["full", "none"], sides: RADIUS_SIDES },
];

// Longest first, so `text-shadow-sm` and `inset-ring-2` are read as their own namespaces rather
// than as `text-` and `ring-`.
const MATCH_ORDER = [...NAMESPACES].sort((a, b) => b.name.length - a.name.length);

// --- reading the candidates out of the source -------------------------------------------------

// A hole stands in for a `${...}` in a template literal: it keeps the two halves of the class list
// apart, so `${base} px-6` yields `px-6` and not `base}px-6`, while still marking any name it is
// spliced into as one this script did not see whole.
const HOLE = "\u0000";

// The sentinel is unprintable, so a candidate goes back to looking like the source it came
// from before it is reported.
function readable(candidate) {
  return candidate.replaceAll(HOLE, "${…}");
}

// A hand-written scanner rather than a parser, because the shape wanted is narrow: the text of
// every string, character by character, with comments and JSX prose left out. Comment handling is
// the load-bearing part — a comment carrying an apostrophe or a `"` would otherwise open a string
// that swallows the rest of the file.
function stringLiterals(source) {
  const found = [];
  let line = 1;
  let i = 0;

  function take(terminator) {
    const from = line;
    let text = "";
    i += 1;
    while (i < source.length && source[i] !== terminator) {
      if (source[i] === "\\") {
        text += source[i + 1] ?? "";
        i += 2;
        continue;
      }
      if (terminator === "`" && source[i] === "$" && source[i + 1] === "{") {
        found.push({ text: `${text}${HOLE}`, line: from });
        text = HOLE;
        i += 2;
        for (let depth = 1; i < source.length && depth > 0; i += 1) {
          if (source[i] === "{") depth += 1;
          else if (source[i] === "}") depth -= 1;
          else if (source[i] === "\n") line += 1;
        }
        continue;
      }
      if (source[i] === "\n") line += 1;
      text += source[i];
      i += 1;
    }
    i += 1;
    found.push({ text, line: from });
  }

  while (i < source.length) {
    const c = source[i];
    if (c === "\n") line += 1;
    if (c === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
        if (source[i] === "\n") line += 1;
        i += 1;
      }
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      take(c);
      continue;
    }
    i += 1;
  }
  return found;
}

function sourceFiles(relative, found = []) {
  for (const entry of readdirSync(`${ROOT}${relative}`).sort()) {
    const child = `${relative}/${entry}`;
    if (statSync(`${ROOT}${child}`).isDirectory()) sourceFiles(child, found);
    else if (child.endsWith(".ts") || child.endsWith(".tsx")) found.push(child);
  }
  return found;
}

// --- classifying one candidate ----------------------------------------------------------------

const OK = { verdict: "ok" };
const IGNORED = { verdict: "ignored" };
function problem(message) {
  return { verdict: "fail", message };
}
function unclear(message) {
  return { verdict: "unclassified", message };
}

// Splits on `separator` only where no bracket or paren is open, so `aria-[pressed=false]:m3-state`
// loses its variant while `[--mark-width:104px]` and `bg-[url(a:b)]` keep their insides.
function splitOutside(candidate, separator) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const c of candidate) {
    if (c === "[" || c === "(") depth += 1;
    else if (c === "]" || c === ")") depth -= 1;
    if (c === separator && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += c;
  }
  parts.push(current);
  return parts;
}

function matchNamespace(base) {
  return MATCH_ORDER.find(({ name }) => base === name || base.startsWith(`${name}-`)) ?? null;
}

function isArbitrary(value) {
  return value.startsWith("[") || value.startsWith("(");
}

function isNumeric(value) {
  return /^\d+(\.\d+)?$/.test(value);
}

// The value of a colour, radius or font utility, once its namespace has been taken off the front.
function checkValue(namespace, value, scope) {
  if (value === "") return OK;
  if (isArbitrary(value)) return OK;
  if (COLOUR_KEYWORDS.includes(value)) return OK;
  if (namespace.keywords?.includes(value)) return OK;
  if (namespace.numeric && isNumeric(value)) return OK;
  if (namespace.subPrefixes?.some((prefix) => value.startsWith(`${prefix}-`))) return OK;
  if (scope.has(value)) return OK;
  return null;
}

function checkColour(namespace, value) {
  const direct = checkValue(namespace, value, colours);
  if (direct) return direct;

  // `border-b-0` and `divide-y-reverse`: a side, then the same vocabulary again.
  const [side, ...rest] = value.split("-");
  if (namespace.sides?.includes(side)) {
    const remainder = rest.join("-");
    if (remainder === "reverse") return OK;
    if (checkValue(namespace, remainder, colours)) return OK;
  }
  return problem(`no --color-${value} in the theme map, and ${namespace.name}- takes a colour`);
}

// `rounded-l` and `rounded-s` are each both a side and a step of this scale, and either reading
// resolves via the `direct` check below before this ever looks at sides. A side with nothing
// after it is not so lucky: it wants the bare `--radius` DEFAULT that `--radius-*: initial`
// clears (`globals.css`'s own comment records this), and compiling the theme map confirms the
// outcome rather than leaving it open — `rounded`, `rounded-t`, `rounded-r`, `rounded-b`,
// `rounded-e` and the rest of `RADIUS_SIDES` with nothing after them all compile to nothing, so
// this is a real failure and not a judgement call.
function checkRadius(namespace, value) {
  const cleared =
    "no step named, so it reaches for the bare --radius DEFAULT that --radius-*: initial cleared, and Tailwind emits nothing for it";
  if (value === "") return problem(cleared);

  const direct = checkValue(namespace, value, radii);
  if (direct) return direct;

  const [side, ...rest] = value.split("-");
  if (namespace.sides.includes(side)) {
    const remainder = rest.join("-");
    if (remainder === "") return problem(cleared);
    if (checkValue(namespace, remainder, radii)) return OK;
  }
  return problem(`no --radius-${value} in the theme map`);
}

function classify(candidate) {
  for (const [, property] of candidate.matchAll(/var\(\s*(--[a-z0-9-]+)/g)) {
    if (!properties.has(property)) {
      return problem(`${property} is neither declared nor read anywhere in ${CSS_PATH}`);
    }
  }

  if (candidate.includes(HOLE)) {
    const visible = candidate.replaceAll(HOLE, "");
    if (matchNamespace(visible) === null) return IGNORED;
    return unclear("spliced together from a template hole, so the whole name was never in view");
  }

  // Variants first (`hover:`, `min-[860px]:`, `group-aria-pressed:` and any stack of them), then
  // the `!` important marker at either end, then the `/` modifier — `bg-primary/50`'s opacity and
  // `text-sm/6`'s line height both leave the name in front of the slash to check.
  const variants = splitOutside(candidate, ":");
  const marked = variants[variants.length - 1];
  const modified = splitOutside(marked.replace(/^!|!$/g, ""), "/")[0];
  if (modified === "") return IGNORED;

  // Prose and code are read out of the same string literals as class lists, so anything carrying a
  // character no Tailwind candidate uses outside brackets — a capital, a comma, a full stop — is
  // left alone. `bg-[color-mix(in_srgb,…)]` keeps its commas because they are inside brackets.
  if (splitOutside(modified, "[")[0].match(/[^a-z0-9.*&>~+_-]/)) return IGNORED;

  const namespace = matchNamespace(modified);
  if (namespace === null) {
    if (utilities.has(modified)) return OK;
    const family = modified.split("-")[0];
    if (modified.includes("-") && utilityFamilies.has(family)) {
      return problem(`no @utility ${modified} in ${CSS_PATH}, and ${family}- is its namespace`);
    }
    return IGNORED;
  }

  const value = modified.slice(namespace.name.length).replace(/^-/, "");
  if (value === "") {
    // The namespace word on its own: `border`'s own 1px utility, or the English words `text`,
    // `fill` and `from` in a string that was never a class list. Neither reaches for a token, so
    // neither is counted. `rounded` alone is the exception — it wants a DEFAULT that is gone.
    return namespace.kind === "radius" ? checkRadius(namespace, value) : IGNORED;
  }
  if (namespace.kind === "radius") return checkRadius(namespace, value);
  if (namespace.kind === "font") {
    return checkValue(namespace, value, fonts) ?? problem(`no --font-${value} in the theme map`);
  }
  return checkColour(namespace, value);
}

// --- the scan -----------------------------------------------------------------------------------

console.log(`check-utilities — ${SRC_PATH} against the theme map in ${CSS_PATH}\n`);
console.log("THEME");
console.log(`  --color-*   ${String(colours.size).padStart(3)} roles`);
console.log(`  --radius-*  ${String(radii.size).padStart(3)} steps`);
console.log(`  --font-*    ${String(fonts.size).padStart(3)} families`);
console.log(
  `  @utility    ${String(utilities.size).padStart(3)} names in ${utilityFamilies.size} families`,
);
console.log(`  properties  ${String(properties.size).padStart(3)} declared or read`);

const unclassified = [];
let checked = 0;
let ignored = 0;

console.log("\nCANDIDATES — files with at least one, everything else is prose or plain TypeScript");

for (const file of sourceFiles(SRC_PATH)) {
  const problems = [];
  let seen = 0;

  for (const { text, line } of stringLiterals(readFileSync(`${ROOT}${file}`, "utf8"))) {
    for (const candidate of text.split(/\s+/).filter(Boolean)) {
      const result = classify(candidate);
      if (result.verdict === "ignored") {
        ignored += 1;
      } else if (result.verdict === "unclassified") {
        unclassified.push(`${file}:${line}  ${readable(candidate)} — ${result.message}`);
      } else {
        seen += 1;
        checked += 1;
        if (result.verdict === "fail") {
          problems.push(fail(`${file}:${line}  ${readable(candidate)} — ${result.message}`));
        }
      }
    }
  }

  if (seen === 0 && problems.length === 0) continue;
  const verdict = problems.length === 0 ? "ok" : `${problems.length} problem(s)`;
  console.log(`  ${file.padEnd(62)} ${String(seen).padStart(3)}  ${verdict}`);
  for (const message of problems) console.log(`    ${message}`);
}

console.log("\nUNCLASSIFIED — read but not judged, and no part of the exit code");
if (unclassified.length === 0) console.log("  (none)");
for (const message of unclassified) console.log(`  ${message}`);

// --- verdict ------------------------------------------------------------------------------------

if (failures.length === 0) {
  console.log(
    `\nOK — ${checked} candidates all name a colour, radius, font, custom property or utility that ${CSS_PATH} declares. ${ignored} candidates outside those namespaces were ignored.`,
  );
} else {
  console.log(`\n${failures.length} FAILURE(S)`);
  for (const message of failures) console.log(`  ${message}`);
  process.exitCode = 1;
}
