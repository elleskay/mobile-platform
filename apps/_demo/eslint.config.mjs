import base from "../../eslint.config.base.mjs";

export default [
  ...base,
  {
    ignores: [".expo/**", "android/**", "ios/**", "dist/**"],
  },
];
