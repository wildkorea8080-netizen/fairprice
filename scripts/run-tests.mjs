import { readdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const scriptsDir = dirname(fileURLToPath(import.meta.url));

/**
 * Discovers test files instead of listing them, so a new scripts/test-*.mjs is
 * covered by the gate the moment it lands. Registering each one by hand in
 * package.json is how eleven of the thirteen suites ended up running nowhere.
 *
 * smoke-test.mjs is excluded: it needs a server to talk to and belongs to
 * verify:deploy, not to the offline suite.
 */
function findTestFiles(filter) {
  return readdirSync(scriptsDir)
    .filter((name) => name.startsWith("test-") && name.endsWith(".mjs"))
    .filter((name) => !filter || name.includes(filter))
    .sort();
}

function run(file) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(
      process.execPath,
      ["--no-warnings", "--experimental-strip-types", join(scriptsDir, file)],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });

    child.on("error", (error) => {
      resolve({ durationMs: Date.now() - started, file, ok: false, output: String(error) });
    });

    child.on("exit", (code) => {
      resolve({
        durationMs: Date.now() - started,
        file,
        ok: code === 0,
        output,
      });
    });
  });
}

const filter = process.argv[2];
const files = findTestFiles(filter);

if (files.length === 0) {
  console.error(
    filter
      ? `No test files matched "${filter}".`
      : "No test files found in scripts/.",
  );
  process.exit(1);
}

const results = [];

for (const file of files) {
  const result = await run(file);
  results.push(result);
  console.log(
    `${result.ok ? "PASS" : "FAIL"}  ${file.padEnd(36)} ${result.durationMs}ms`,
  );

  if (!result.ok) {
    console.log(
      result.output
        .trimEnd()
        .split("\n")
        .map((line) => `      ${line}`)
        .join("\n"),
    );
  }
}

const failed = results.filter((result) => !result.ok);

console.log(
  `\n${results.length - failed.length}/${results.length} suites passed.`,
);

if (failed.length > 0) {
  console.log(`Failed: ${failed.map((result) => result.file).join(", ")}`);
  process.exitCode = 1;
}
