import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { mergeConfig } from "vitest/config";
import base from "../vitest.config.ts";

// Compare the existing provider parity suite with HEAD without checking out,
// stashing, resetting or overwriting the shared working tree.
const root = resolve(import.meta.dirname, "..");
const changed = execFileSync(
  "git",
  ["diff", "--name-only", "HEAD", "--", "frontend/src"],
  { cwd: resolve(root, ".."), encoding: "utf8" },
)
  .trim()
  .split(/\r?\n/)
  .filter((path) => /\.[cm]?[jt]sx?$/.test(path));
const sources = new Map(
  changed.map((path) => [
    resolve(root, "..", path).replaceAll("\\", "/"),
    execFileSync("git", ["show", `HEAD:${path}`], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
    }),
  ]),
);
const config = mergeConfig(base, {
  plugins: [
    {
      name: "vib-92-head-baseline",
      enforce: "pre",
      load(id) {
        return sources.get(id.split("?")[0].replaceAll("\\", "/"));
      },
    },
  ],
});
config.test!.include = [
  "tests/provider-dashboard.test.tsx",
  "tests/provider-helpers.test.ts",
];
export default config;
