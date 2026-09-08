// Framework-neutral: this package is imported by `apps/web` today and by `apps/mobile` later,
// so it composes the shared base and nothing Next-specific.
import { defineConfig } from "eslint/config";
import base from "@clavehq/config/eslint";

export default defineConfig([
  ...base,
  {
    // The theme generator scripts are hand-run Node programs, not library code, so they get
    // Node's globals. Scoped to the folder rather than added to the base config, which is
    // shared with a React Native package that has no `console.log` to declare.
    files: ["src/theme/*.mjs"],
    languageOptions: { globals: { console: "readonly" } },
  },
]);
