import { defineConfig } from "vitest/config";

// JSX is handled via tsconfig.json ("jsx": "react-jsx",
// "jsxImportSource": "preact"); no bundler JSX override is needed here.
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    // The components import stylesheets for their side effects only; the tests
    // never assert on styling, so skip CSS processing.
    css: false,
  },
});
