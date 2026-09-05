// Framework-neutral ESLint flat config shared by every workspace package.
// No `eslint-config-next` here — this base is also consumed by a future
// `apps/mobile`. `apps/web` composes this with `next/core-web-vitals` itself.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Must stay last: turns off any stylistic rule above that Prettier owns.
  prettier,
);
