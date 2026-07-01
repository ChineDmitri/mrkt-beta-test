export default [
  {
    ignores: ["node_modules/**", "coverage/**", "dist/**"],
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        AbortController: "readonly",
        DOMParser: "readonly",
        GM_addStyle: "readonly",
        URL: "readonly",
        document: "readonly",
        fetch: "readonly",
        localStorage: "readonly",
        window: "readonly",
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      curly: ["error", "multi-line"],
      eqeqeq: ["error", "always"],
      "no-console": "warn",
      "no-undef": "error",
      "no-unused-vars": "error",
      "no-var": "error",
      "prefer-const": "error",
      quotes: ["error", "double", { avoidEscape: true }],
      semi: ["error", "always"],
    },
  },
];
