import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve as resolvePath } from "node:path";
import { existsSync } from "node:fs";

const projectRoot = resolvePath(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const srcDir = join(projectRoot, "src");

/**
 * Next.js resolves two things for application code that plain Node does not:
 *
 *   "server-only"  a bundler marker. It is not installed as a package at all,
 *                  so importing it outside Next throws "Cannot find package".
 *   "@/*"          the tsconfig path alias for src/*.
 *
 * Unit tests avoid both by only importing pure modules, where every "@/" import
 * happens to be `import type` and disappears with type stripping. Integration
 * tests reach the modules that actually talk to the database, which import
 * neither of those things optionally.
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only" || specifier === "client-only") {
    return {
      shortCircuit: true,
      url: pathToFileURL(
        join(projectRoot, "scripts", "integration", "empty-module.mjs"),
      ).href,
    };
  }

  if (specifier.startsWith("@/")) {
    const base = join(srcDir, specifier.slice(2));

    for (const candidate of [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      join(base, "index.ts"),
    ]) {
      if (existsSync(candidate)) {
        return { shortCircuit: true, url: pathToFileURL(candidate).href };
      }
    }
  }

  return nextResolve(specifier, context);
}
