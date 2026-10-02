// The GitHub token a build script uses: the environment's, or, on a developer's machine, the GitHub
// CLI's sign-in, so `npm run data` and `npm run sync` work locally without exporting anything.
import { execFileSync } from "node:child_process";

/** The GitHub CLI's token, or null when it is not installed or not signed in. */
export function cliToken() {
  try {
    const token = execFileSync("gh", ["auth", "token"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return token || null;
  } catch {
    return null;
  }
}

/** The first token available, with where it came from: the named variables in order, then the CLI. */
export function findToken(names, env = process.env, cli = cliToken) {
  for (const name of names) if (env[name]) return { token: env[name], from: name };
  const token = cli();
  return token ? { token, from: "the GitHub CLI" } : null;
}
