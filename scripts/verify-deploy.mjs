import { spawn } from "node:child_process";

function parseArgs(argv) {
  const options = {};

  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      continue;
    }

    const [key, value = "true"] = arg.slice(2).split("=");
    options[key] = value;
  }

  return options;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n> ${[command, ...args].join(" ")}`);

    const child = spawn(command, args, {
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
      }
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const envFile = args.envFile || ".env.production";
  const envStrict = args.envStrict ?? args.strict ?? "true";
  const baseUrl = args.baseUrl;
  const requireHsts = args.requireHsts;
  const skipTypecheck = args.skipTypecheck === "true";
  const skipLint = args.skipLint === "true";
  const skipBuild = args.skipBuild === "true";
  const skipUnitTests = args.skipUnitTests === "true";
  const skipSmoke = args.skipSmoke === "true";
  const skipReadiness = args.skipReadiness === "true";

  await run("node", [
    "scripts/check-production-env.mjs",
    `--envFile=${envFile}`,
    `--strict=${envStrict}`,
  ]);

  if (!skipTypecheck) {
    await run("node", ["node_modules/typescript/bin/tsc", "--noEmit"]);
  }

  if (!skipLint) {
    await run("node", ["node_modules/eslint/bin/eslint.js"]);
  }

  if (!skipUnitTests) {
    await run("node", ["scripts/run-tests.mjs"]);
  }

  if (!skipBuild) {
    await run("node", ["scripts/build.mjs"]);
  }

  if (!skipSmoke) {
    const smokeArgs = ["scripts/smoke-test.mjs"];

    if (baseUrl) {
      smokeArgs.push(`--baseUrl=${baseUrl}`);
    }

    if (requireHsts) {
      smokeArgs.push(`--requireHsts=${requireHsts}`);
    }

    await run("node", smokeArgs);
  }

  if (!skipReadiness) {
    const readinessArgs = ["scripts/check-readiness.mjs"];

    if (baseUrl) {
      readinessArgs.push(`--baseUrl=${baseUrl}`);
    }

    await run("node", readinessArgs);
  }

  console.log("\nDeployment verification completed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
