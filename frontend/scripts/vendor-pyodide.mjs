/**
 * vendor-pyodide.mjs — self-host the pinned Pyodide runtime.
 *
 * D1 (CONFIRMED): no third-party CDN at runtime. This downloads the pinned
 * Pyodide release at BUILD time (GitHub, build-time only) and extracts it into
 * public/pyodide/, so every visitor loads numpy/scipy/pandas from our own
 * Vercel origin. Runs as a `prebuild` step; idempotent (skips if present).
 *
 * public/pyodide/ is gitignored — regenerated on every build, never committed.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  rmSync,
  readdirSync,
  readFileSync,
  createWriteStream,
} from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = process.env.PYODIDE_VERSION || "0.27.7";

// Pinned sha256 of the GitHub release tarball for the default VERSION. The
// downloaded runtime executes in every visitor's browser, so a swapped or
// MITM'd artifact would be arbitrary code on every device. Verify before
// extracting. Override VERSION only alongside its matching hash.
const EXPECTED_SHA256 = {
  "0.27.7":
    "08dd7f4fc4710110ea0fe2a7daa95bdf76001e596545267bc16dd760436ea755",
};
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const destDir = join(root, "public", "pyodide");
const marker = join(destDir, `.vendored-${VERSION}`);

if (existsSync(marker)) {
  console.log(`[vendor-pyodide] ${VERSION} already vendored — skipping.`);
  process.exit(0);
}

const url = `https://github.com/pyodide/pyodide/releases/download/${VERSION}/pyodide-${VERSION}.tar.bz2`;
const tmp = join(root, `pyodide-${VERSION}.tar.bz2`);

console.log(`[vendor-pyodide] downloading ${url}`);
const res = await fetch(url);
if (!res.ok) {
  console.error(`[vendor-pyodide] download failed: HTTP ${res.status}`);
  process.exit(1);
}
await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));

// Integrity gate: the tarball becomes the WASM runtime served to every
// visitor. Refuse to extract anything we can't verify against a pinned hash.
const expected = EXPECTED_SHA256[VERSION];
if (!expected) {
  console.error(
    `[vendor-pyodide] no pinned sha256 for ${VERSION} — add it to ` +
      `EXPECTED_SHA256 before building.`,
  );
  rmSync(tmp, { force: true });
  process.exit(1);
}
const actual = createHash("sha256").update(readFileSync(tmp)).digest("hex");
if (actual !== expected) {
  console.error(
    `[vendor-pyodide] sha256 MISMATCH for ${VERSION}\n` +
      `  expected ${expected}\n  actual   ${actual}\n` +
      `Refusing to extract a potentially tampered runtime.`,
  );
  rmSync(tmp, { force: true });
  process.exit(1);
}
console.log(`[vendor-pyodide] sha256 verified (${VERSION})`);

console.log("[vendor-pyodide] extracting…");
rmSync(destDir, { recursive: true, force: true });
mkdirSync(destDir, { recursive: true });
// Tarball top-level dir is "pyodide/"; strip it so files land in destDir.
execFileSync("tar", ["-xjf", tmp, "-C", destDir, "--strip-components=1"], {
  stdio: "inherit",
});
rmSync(tmp, { force: true });

// Prune to the runtime core + the numpy/scipy/pandas dependency closure.
// The full release ships ~250 packages + per-package test tarballs (~770 MB);
// we serve only what the worker imports (~70 MB) so the Vercel deploy stays
// lean. loadPackage resolves by file_name from pyodide-lock.json, so keeping
// just the closure's files is sufficient.
console.log("[vendor-pyodide] pruning to required packages…");
const lock = JSON.parse(
  readFileSync(join(destDir, "pyodide-lock.json"), "utf8"),
);
const need = new Set();
const addClosure = (name) => {
  const n = name.toLowerCase();
  const p = lock.packages[n];
  if (need.has(n) || !p) return;
  need.add(n);
  (p.depends || []).forEach(addClosure);
};
["numpy", "scipy", "pandas"].forEach(addClosure);

const keep = new Set([
  // Runtime core — required to boot Pyodide.
  "pyodide.asm.js",
  "pyodide.asm.wasm",
  "pyodide.mjs",
  "pyodide.mjs.map",
  "pyodide.js",
  "pyodide.js.map",
  "pyodide.d.ts",
  "ffi.d.ts",
  "python_stdlib.zip",
  "python_cli_entry.mjs",
  "pyodide-lock.json",
  "package.json",
  `.vendored-${VERSION}`,
]);
for (const n of need) keep.add(lock.packages[n].file_name);

let removed = 0;
for (const entry of readdirSync(destDir)) {
  if (keep.has(entry)) continue;
  rmSync(join(destDir, entry), { recursive: true, force: true });
  removed++;
}
console.log(
  `[vendor-pyodide] kept ${keep.size} files (closure: ${[...need]
    .sort()
    .join(", ")}); removed ${removed}`,
);

execFileSync("touch", [marker]);
console.log(`[vendor-pyodide] done → public/pyodide (${VERSION})`);
