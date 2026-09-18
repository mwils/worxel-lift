// ESLint flat config for the whole pnpm workspace. Run from the repo root:
//   pnpm lint        # CI mode, warnings fail
//   pnpm lint:fix
//
// One config, three environments: browser React apps (web, marketing),
// Node Lambdas + shared package, and repo tooling (sst.config.ts, scripts).
// Rules are the recommended sets from @eslint/js, typescript-eslint, and
// react-hooks, with a few pragmatic adjustments noted inline. Type-aware
// linting is intentionally off — `pnpm -r typecheck` covers types and keeps
// lint fast enough to run on every save.
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

export default defineConfig(
  globalIgnores([
    "**/node_modules/",
    "**/dist/",
    "**/dist-ssr/",
    "**/build/",
    "**/.sst/",
    "**/coverage/",
    "**/sst-env.d.ts",
    "apps/web/dev-dist/",
    "apps/web/public/",
  ]),

  // ── Everything ───────────────────────────────────────────────────
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    linterOptions: { reportUnusedDisableDirectives: "error" },
    rules: {
      // Underscore-prefixed names are the conventional "intentionally unused"
      // marker (e.g. `_stub`, `catch (_err)`, destructuring out a field).
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      // `any` is a smell, not a bug — surface it without failing CI on the
      // handful of boundary casts (API error bodies, gtag, Stripe events).
      "@typescript-eslint/no-explicit-any": "warn",
      // Empty catch blocks are used deliberately for localStorage/private mode.
      "no-empty": ["error", { allowEmptyCatch: true }],
      // Console is the Lambda logger; warn/error/info are all legitimate.
      "no-console": "off",
      eqeqeq: ["error", "smart"],
      "prefer-const": "error",
      "no-var": "error",
    },
  },

  // ── Browser React apps ───────────────────────────────────────────
  {
    files: ["apps/web/src/**/*.{ts,tsx}", "apps/marketing/src/**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat.recommended],
    plugins: { "react-refresh": reactRefresh },
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      // Vite HMR only preserves state for modules that export components.
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // React Compiler-derived rule, new in react-hooks v7. The codebase has
      // ~20 "sync local state from props in an effect" sites that predate it.
      // Off until those are refactored (derive during render or key the
      // component); rules-of-hooks and exhaustive-deps still gate.
      "react-hooks/set-state-in-effect": "off",
    },
  },

  // ── SST config ───────────────────────────────────────────────────
  {
    files: ["sst.config.ts"],
    rules: {
      // SST's generated globals ($config, sst, aws) come from this reference.
      "@typescript-eslint/triple-slash-reference": "off",
    },
  },

  // ── Node: Lambdas, shared package, infra, scripts ────────────────
  {
    files: [
      "apps/api/**/*.{ts,mjs,js}",
      "packages/shared/**/*.{ts,mjs,js}",
      "sst.config.ts",
      "**/scripts/**/*.{ts,mjs,js,cjs}",
      "**/*.config.{ts,mjs,js,cjs}",
      "**/postcss.config.cjs",
    ],
    languageOptions: { globals: { ...globals.node } },
  },

  // ── CommonJS tooling files ───────────────────────────────────────
  {
    files: ["**/*.cjs"],
    languageOptions: { sourceType: "commonjs" },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
);
