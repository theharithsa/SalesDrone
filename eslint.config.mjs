import js from "@eslint/js";
import ts from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
import a11y from "eslint-plugin-jsx-a11y";
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
    files: ["functions/src/**/*.js", "scripts/**/*.mjs", "services/ingress/src/**/*.js"],
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
    plugins: { "react-hooks": hooks, "jsx-a11y": a11y },
    rules: {
      ...Object.fromEntries(
        Object.entries(a11y.configs.recommended.rules).map(([name, rule]) => [
          name,
          Array.isArray(rule)
            ? [
                rule[0] === 0 || rule[0] === "off" ? "off" : "warn",
                ...rule.slice(1),
              ]
            : rule === 0 || rule === "off"
              ? "off"
              : "warn",
        ]),
      ),
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
    files: ["functions/src/**/*.js", "scripts/**/*.mjs", "services/ingress/src/**/*.js"],
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
