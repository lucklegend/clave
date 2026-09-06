// Framework-neutral: this package is imported by `apps/web` today and by `apps/mobile` later,
// so it composes the shared base and nothing Next-specific.
import { defineConfig } from "eslint/config";
import base from "@clavehq/config/eslint";

export default defineConfig([...base]);
