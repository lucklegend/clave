// Generates the Material 3 colour scheme for claveHQ from the brand green, using Google's own
// Material Color Utilities so the tone pairs (and therefore the contrast guarantees) are the
// real ones and not an approximation.
//
// Run by hand, from the repo root, and only when the seed changes:
//   pnpm add -Dw @material/material-color-utilities && node packages/shared/src/theme/gen-scheme.mjs
// The package is deliberately not a repo dependency — `scheme.json` beside this file is
// generated, committed and consumed, so neither app derives a colour at build time.
import {
  argbFromHex,
  hexFromArgb,
  Hct,
  SchemeContent,
  SchemeTonalSpot,
  MaterialDynamicColors,
} from "@material/material-color-utilities";
import { writeFileSync } from "node:fs";
import { URL } from "node:url";

const SEED = "#8dc63f"; // --brand-green, the one colour the landing page and the mark share

const ROLES = [
  "primary",
  "onPrimary",
  "primaryContainer",
  "onPrimaryContainer",
  "secondary",
  "onSecondary",
  "secondaryContainer",
  "onSecondaryContainer",
  "tertiary",
  "onTertiary",
  "tertiaryContainer",
  "onTertiaryContainer",
  "error",
  "onError",
  "errorContainer",
  "onErrorContainer",
  "background",
  "onBackground",
  "surface",
  "onSurface",
  "surfaceVariant",
  "onSurfaceVariant",
  "surfaceDim",
  "surfaceBright",
  "surfaceContainerLowest",
  "surfaceContainerLow",
  "surfaceContainer",
  "surfaceContainerHigh",
  "surfaceContainerHighest",
  "outline",
  "outlineVariant",
  "inverseSurface",
  "inverseOnSurface",
  "inversePrimary",
  "scrim",
  "shadow",
];

function scheme(Ctor, dark) {
  const s = new Ctor(Hct.fromInt(argbFromHex(SEED)), dark, 0);
  const out = {};
  for (const role of ROLES) {
    const dc = MaterialDynamicColors[role];
    if (!dc) {
      out[role] = null;
      continue;
    }
    out[role] = hexFromArgb(dc.getArgb(s));
  }
  return out;
}

const TONES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 100];
function ramp(palette) {
  return Object.fromEntries(TONES.map((t) => [t, hexFromArgb(palette.tone(t))]));
}

const src = Hct.fromInt(argbFromHex(SEED));
const content = new SchemeContent(src, false, 0);

const palettes = {
  primary: ramp(content.primaryPalette),
  secondary: ramp(content.secondaryPalette),
  tertiary: ramp(content.tertiaryPalette),
  neutral: ramp(content.neutralPalette),
  neutralVariant: ramp(content.neutralVariantPalette),
  error: ramp(content.errorPalette),
};

const result = {
  seed: SEED,
  seedHct: { hue: +src.hue.toFixed(1), chroma: +src.chroma.toFixed(1), tone: +src.tone.toFixed(1) },
  palettes,
  content: { light: scheme(SchemeContent, false), dark: scheme(SchemeContent, true) },
  tonalSpot: { light: scheme(SchemeTonalSpot, false), dark: scheme(SchemeTonalSpot, true) },
};

writeFileSync(new URL("scheme.json", import.meta.url), JSON.stringify(result, null, 2), "utf8");

console.log(
  `seed ${SEED} -> HCT h${result.seedHct.hue} c${result.seedHct.chroma} t${result.seedHct.tone}\n`,
);
for (const variant of ["content", "tonalSpot"]) {
  const l = result[variant].light,
    d = result[variant].dark;
  console.log(variant.toUpperCase());
  console.log(
    `  light  primary ${l.primary}  onPrimary ${l.onPrimary}  primaryContainer ${l.primaryContainer}  surface ${l.surface}  surfaceContainer ${l.surfaceContainer}  onSurface ${l.onSurface}  outline ${l.outline}`,
  );
  console.log(
    `  dark   primary ${d.primary}  onPrimary ${d.onPrimary}  primaryContainer ${d.primaryContainer}  surface ${d.surface}  surfaceContainer ${d.surfaceContainer}  onSurface ${d.onSurface}  outline ${d.outline}`,
  );
}
console.log("\nprimary ramp:", TONES.map((t) => `${t}:${palettes.primary[t]}`).join(" "));
console.log("tertiary ramp:", TONES.map((t) => `${t}:${palettes.tertiary[t]}`).join(" "));
