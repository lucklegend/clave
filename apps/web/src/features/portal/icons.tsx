/**
 * Material Symbols Outlined, self-hosted through `next/font/local` (`app/fonts.ts`) and drawn at
 * the M3 axis defaults `globals.css`'s `m3-icon` utility pins (FILL 0, wght 400, GRAD 0, opsz 24).
 *
 * Every glyph is addressed by its private-use-area codepoint, never by ligature name — the
 * obvious `<span className="material-symbols-outlined">search</span>` renders the literal word
 * "search" until the font arrives, and self-hosting narrows that window without closing it. A
 * codepoint has no fallback glyph to fall back to, so there is nothing to read before the font
 * paints. Codepoints below are transcribed from Google's published
 * `MaterialSymbolsOutlined[FILL,GRAD,opsz,wght].codepoints` map, matched by icon name, not typed
 * from memory.
 *
 * Every glyph here is decorative: `Glyph` bakes in `aria-hidden="true"` so no exported icon can
 * lose it, and the accessible name lives on the control the icon sits inside (a button's
 * `aria-label`, a nav link's visible text) — never on the glyph. Do not add an `aria-label` to one
 * of these; there is nothing here for a screen reader to announce.
 *
 * `codepoint` is a number, not a `"\uXXXX"` string literal: this build's compiler re-serialises a
 * private-use-area character back out as generated source, and gets the escape wrong doing it --
 * confirmed against the compiled chunk, a one-character source string for U+EF7A came out the
 * other side as the six literal characters backslash-u-e-f-7-a, and that literal text is what
 * reached the browser, not the glyph. `String.fromCodePoint` builds the character at runtime
 * instead, so there is no string literal carrying an escape for the printer to mishandle.
 */

type GlyphProps = {
  codepoint: number;
};

function Glyph({ codepoint }: GlyphProps) {
  return (
    <span className="m3-icon" aria-hidden="true">
      {String.fromCodePoint(codepoint)}
    </span>
  );
}

// --- the eleven nav destinations ----------------------------------------------------------------

// space_dashboard, e66b — one large rect plus two small ones, not the four-square grid `dashboard`
// draws.
export function DashboardIcon() {
  return <Glyph codepoint={0xe66b} />;
}

// campaign, ef49 — the megaphone.
export function AnnouncementsIcon() {
  return <Glyph codepoint={0xef49} />;
}

// group, ea21 — one full figure with a second, partial figure behind it. `groups` draws three and
// is not this.
export function ResidentsIcon() {
  return <Glyph codepoint={0xea21} />;
}

// home_work, f030 — a peaked-roof house sharing a base with a taller windowed building.
export function UnitsIcon() {
  return <Glyph codepoint={0xf030} />;
}

// payments, ef63 — a card with a coin overlapping its corner.
export function PaymentsIcon() {
  return <Glyph codepoint={0xef63} />;
}

// receipt_long, ef6e — the torn-edge receipt.
export function BillingIcon() {
  return <Glyph codepoint={0xef6e} />;
}

// pool, eb48 — wave lines under a diving board.
export function AmenitiesIcon() {
  return <Glyph codepoint={0xeb48} />;
}

// calendar_month, ebcc — a month grid with a day dot picked out.
export function BookingsIcon() {
  return <Glyph codepoint={0xebcc} />;
}

// warning, f083 — the triangle, not the octagon `report` draws.
export function ReportsIcon() {
  return <Glyph codepoint={0xf083} />;
}

// tune, e429 — stacked adjustment sliders.
export function SettingsIcon() {
  return <Glyph codepoint={0xe429} />;
}

// shield_person, f650 — literally a shield with a person inside it.
export function RolesAndAccessIcon() {
  return <Glyph codepoint={0xf650} />;
}

// --- the shell's own controls: menu, search, notifications, chevrons -----------------------------

// menu, e5d2 — the three-bar hamburger the sidebar toggle draws, in both the drawer header and
// the app bar's leading slot.
export function MenuIcon() {
  return <Glyph codepoint={0xe5d2} />;
}

// search, ef7a.
export function SearchIcon() {
  return <Glyph codepoint={0xef7a} />;
}

// notifications, e7f5 — the bell.
export function NotificationsIcon() {
  return <Glyph codepoint={0xe7f5} />;
}

// expand_more, e5cf — the village pill's dropdown chevron.
export function ChevronDownIcon() {
  return <Glyph codepoint={0xe5cf} />;
}

// chevron_right, e5cc — a work-queue row's disclosure, and the month grid's "next" arrow.
export function ChevronRightIcon() {
  return <Glyph codepoint={0xe5cc} />;
}

// chevron_left, e5cb, is not exported: it was drawn for the month grid's "previous" arrow, but
// `AmenityCalendar` has no working month step to attach one to and correctly draws no arrows at
// all rather than an inert pair. No consumer exists, so there is nothing here for the next reader
// to evaluate. Add it back the day the calendar gains a working month step.
