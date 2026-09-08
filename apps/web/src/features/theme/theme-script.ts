import { THEME_STORAGE_KEY } from "./theme";

// Source text for the browser's parser, not TypeScript: it is inlined verbatim into the
// parser-blocking <script> in <head> (`app/layout.tsx`), so `data-theme` is on <html>
// before any content is parsed or painted. What that costs, and why each line is as it is —
//
//   * ES5-safe and dependency-free. Nothing in this string is compiled, bundled or polyfilled.
//   * The only interpolation is the storage key constant, escaped by `JSON.stringify` rather
//     than quoted by hand. Nothing runtime-derived is ever spliced into it.
//   * The `light` / `dark` whitelist is repeated rather than imported from `theme.ts` for the
//     same reason. A value off the list writes no attribute, and System is the absence of one.
//   * `try`/`catch` is load-bearing: reading storage throws in Safari private mode, and an
//     uncaught throw in a parser-blocking script takes the whole page down with it.
//   * It does not set `style.colorScheme` (the token blocks in `globals.css` own it) and does
//     not write to storage. Reading one key and setting one attribute is its entire job.
export const themeInitScript =
  `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});` +
  `if(t==="light"||t==="dark"){` +
  `document.documentElement.setAttribute("data-theme",t)}}catch(e){}})();`;
