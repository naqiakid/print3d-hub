import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Catch unbounded requestAnimationFrame loops.
      // Every rAF call must have a corresponding cancelAnimationFrame reachable
      // in the same scope (typically a useEffect cleanup). The fix pattern is:
      //   let id = requestAnimationFrame(fn)
      //   return () => cancelAnimationFrame(id)
      "no-restricted-syntax": [
        "warn",
        {
          // Flag any function that calls requestAnimationFrame on itself
          // (i.e. the recursive "animate calls animate" pattern) without an
          // obvious cancel guard — the message reminds devs to use render-on-demand.
          selector:
            "CallExpression[callee.name='requestAnimationFrame'] > :first-child[type='Identifier']",
          message:
            "requestAnimationFrame: ensure cancelAnimationFrame is called in cleanup and consider render-on-demand instead of an uncapped loop.",
        },
      ],
    },
  },
]);

export default eslintConfig;
