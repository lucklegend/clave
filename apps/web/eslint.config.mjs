// The shared base is framework-neutral by design, so `apps/web` is where it meets Next.
// `eslint-config-next` exports flat configs natively — no `FlatCompat` needed.
import { defineConfig } from "eslint/config";
import base from "@clavehq/config/eslint";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

// Next's config sets only plugin-namespaced rules and no formatting rules, so
// `eslint-config-prettier` at the tail of `base` still wins where it matters. It also
// carries the `.next/**`, `out/**`, `build/**` and `next-env.d.ts` global ignores.
export default defineConfig([...base, ...nextCoreWebVitals]);
