import { spawn } from "node:child_process";

function run(command, args, env = process.env) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      env,
      stdio: "inherit",
    });

    child.on("error", (error) => {
      console.error(error instanceof Error ? error.message : error);
      resolve(1);
    });

    child.on("exit", (code) => {
      resolve(code ?? 1);
    });
  });
}

const nodeOptions = [
  process.env.NODE_OPTIONS,
  "--max-old-space-size=4096",
]
  .filter(Boolean)
  .join(" ");

const prismaGenerateCode = await run(process.execPath, [
  "./node_modules/prisma/build/index.js",
  "generate",
]);

if (prismaGenerateCode !== 0) {
  process.exitCode = prismaGenerateCode;
} else {
  process.exitCode = await run(
    process.execPath,
    ["./node_modules/next/dist/bin/next", "build"],
    {
      ...process.env,
      NODE_OPTIONS: nodeOptions,
    },
  );
}
