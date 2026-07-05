import { spawn } from "node:child_process";

const nodeOptions = [
  process.env.NODE_OPTIONS,
  "--max-old-space-size=4096",
]
  .filter(Boolean)
  .join(" ");

const child = spawn(
  process.execPath,
  ["./node_modules/next/dist/bin/next", "build"],
  {
    env: {
      ...process.env,
      NODE_OPTIONS: nodeOptions,
    },
    stdio: "inherit",
  },
);

child.on("error", (error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
