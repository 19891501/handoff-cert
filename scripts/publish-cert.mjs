#!/usr/bin/env node
/**
 * Honest publish: never invent npm credentials.
 * If `npm whoami` fails, print the prepared export path and exit 1.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const pkgDir = join(dirname(fileURLToPath(import.meta.url)), "..", "packages", "cert");
const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));

const who = spawnSync("npm", ["whoami"], { encoding: "utf8" });
if (who.status !== 0) {
  process.stderr.write("npm whoami failed — no credentials. Not publishing.\n");
  process.stderr.write(
    `Prepared export path: ${pkg.name} exports['.'] → ${pkg.exports["."].import}\n`,
  );
  process.stderr.write("bin: npx handoff-cert → packages/cert/bin/handoff-cert.mjs\n");
  process.exit(1);
}

const pub = spawnSync("npm", ["publish", "--access", "public"], {
  cwd: pkgDir,
  encoding: "utf8",
  stdio: "inherit",
});
process.exit(pub.status === 0 ? 0 : pub.status ?? 1);
