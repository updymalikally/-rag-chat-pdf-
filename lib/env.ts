/** Read a required environment variable or fail with a message that says which one is missing. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}. Add it to .env.local (see .env.example).`);
  }
  return value;
}
