import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "**/dist", "apps/api-next/.next", "backend/dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: ["apps/staff-web/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/apps/borrower-mobile/**", "@phinduloans/borrower-mobile/**"],
              message: "Staff web must not import from borrower-mobile.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["apps/borrower-mobile/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/apps/staff-web/**", "@phinduloans/staff-web/**"],
              message: "Borrower mobile must not import from staff-web.",
            },
            {
              group: ["**/components/admin/**"],
              message: "Borrower mobile must not import admin components.",
            },
          ],
        },
      ],
    },
  },
);
