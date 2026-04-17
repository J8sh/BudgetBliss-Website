import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/__tests__/**",
    "jest.config.ts",
    "jest.setup.ts",
  ]),
  {
    rules: {
      // Enforce strict TypeScript — no any
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
      // Enforce API error handling patterns
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // Import hygiene
      "import/no-duplicates": "error",
    },
  },
]);

export default eslintConfig;
