#!/usr/bin/env node
/**
 * npx handoff-cert — prefers dist (publish), else src (this repo, Node 22 type-strip).
 * Does not invent npm credentials. Does not take down preview :8080.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist", "cli.js");
const src = join(here, "..", "src", "cli.ts");
const target = existsSync(dist) ? dist : src;
const mod = await import(pathToFileURL(target).href);
const code = await mod.main(process.argv.slice(2));
process.exit(code);
