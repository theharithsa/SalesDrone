import { ESLint } from 'eslint';
import ts from 'typescript-eslint';
import a11y from 'eslint-plugin-jsx-a11y';
import { fileURLToPath } from 'node:url';

// Keep this plugin inside its supported ESLint peer boundary. Main lint uses v10.
export function accessibilityLinter() {
  return new ESLint({
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    overrideConfigFile: true,
    overrideConfig: [{
      files: ['apps/web/src/**/*.{ts,tsx}'],
      languageOptions: { parser: ts.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
      plugins: { 'jsx-a11y': a11y },
      rules: Object.fromEntries(Object.entries(a11y.configs.recommended.rules).map(([name, rule]) => [
        name, Array.isArray(rule)
          ? [rule[0] === 0 || rule[0] === 'off' ? 'off' : 'warn', ...rule.slice(1)]
          : rule === 0 || rule === 'off' ? 'off' : 'warn',
      ])),
    }],
  });
}
