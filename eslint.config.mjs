import js from "@eslint/js";
import ts from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
import globals from "globals";
export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.build/**",
      "test-results/**",
      "apps/web/public/**",
      "site/assets/**",
    ],
  },
  {
    files: ["functions/src/**/*.js", "scripts/**/*.mjs", "services/ingress/src/**/*.js", "tools/accessibility/*.mjs"],
    ...js.configs.recommended,
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  ...ts.configs.recommended.map((config) => ({
    ...config,
    files: ["apps/web/src/**/*.{ts,tsx}"],
  })),
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { "react-hooks": hooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "none",
          caughtErrors: "none",
          varsIgnorePattern: "^(_|React)$",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    files: ["functions/src/**/*.js", "scripts/**/*.mjs", "services/ingress/src/**/*.js", "tools/accessibility/*.mjs"],
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-unused-vars": [
        "error",
        {
          args: "none",
          caughtErrors: "none",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
];
