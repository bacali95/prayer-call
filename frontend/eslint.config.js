import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  { ignores: ["build", "node_modules", "e2e/screenshots", "playwright-report", "test-results"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { "react-refresh": reactRefresh },
    rules: {
      "react-refresh/only-export-components": ["error", { allowConstantExport: true }],
    },
  },
  {
    files: ["src/components/ui/**", "src/hooks/use-theme.tsx", "src/index.tsx", "src/**/*.test.tsx", "src/test/**"],
    rules: { "react-refresh/only-export-components": "off" },
  },
);
