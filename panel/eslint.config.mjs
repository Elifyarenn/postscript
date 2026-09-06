// eslint-config-next ships a ready-made flat config array, so it is spread in
import next from "eslint-config-next";

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "drizzle/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  ...next,
  {
    rules: {
      // This project is App Router only; there is no pages/ directory to check
      "@next/next/no-html-link-for-pages": "off",
    },
  },
];

export default config;
