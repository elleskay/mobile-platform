import base from "../../eslint.config.base.mjs";

export default [
  ...base,
  {
    rules: {
      // NestJS leans on decorators and constructor DI; these defaults are noisy
      // against that pattern.
      "@typescript-eslint/no-extraneous-class": "off",
      "@typescript-eslint/no-unsafe-declaration-merging": "off",
    },
  },
  {
    ignores: ["dist/**"],
  },
];
