import { env } from "env";

export function parseArgs() {
  // Check for --verbose or -v flag
  const args = process.argv.slice(2);
  const verboseIndex = args.findIndex((a) => a === "--verbose" || a === "-v");
  const verbose = verboseIndex !== -1 || !!env.VERBOSE;
  if (verboseIndex !== -1) args.splice(verboseIndex, 1);

  return { verbose, args };
}
