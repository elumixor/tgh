/**
 * One-time script to obtain a Google OAuth refresh token.
 *
 * Usage:
 *   bun run scripts/google-auth.ts <client_id> <client_secret>
 *
 * Steps:
 *   1. Opens a browser for Google sign-in
 *   2. After consent, Google redirects to localhost with an auth code
 *   3. Script exchanges the code for tokens and prints the refresh token
 */
import { google } from "googleapis";

const [clientId, clientSecret] = process.argv.slice(2);
if (!clientId || !clientSecret) {
  console.error("Usage: bun run scripts/google-auth.ts <client_id> <client_secret>");
  process.exit(1);
}

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/calendar",
];
const REDIRECT_URI = "http://localhost:3333";

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

const authUrl = oauth2.generateAuthUrl({
  access_type: "offline",
  scope: SCOPES,
  prompt: "consent",
  login_hint: "ceo@atmagaming.com",
});

console.log("\nOpening browser for Google sign-in...\n");

// Open browser
const proc = Bun.spawn(["open", authUrl]);
await proc.exited;

// Start local server to capture the redirect
const server = Bun.serve({
  port: 3333,
  async fetch(req) {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
      console.error(`\nAuth error: ${error}`);
      setTimeout(() => server.stop(), 100);
      return new Response(`<h2>Error: ${error}</h2>`, { headers: { "content-type": "text/html" } });
    }

    if (!code) return new Response("Waiting for auth...", { status: 400 });

    try {
      const { tokens } = await oauth2.getToken(code);

      console.log("\n=== Success! ===\n");
      console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
      console.log("Add these env vars to your .env / Render:\n");
      console.log(`  GOOGLE_CLIENT_ID=${clientId}`);
      console.log(`  GOOGLE_CLIENT_SECRET=${clientSecret}`);
      console.log(`  GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);

      setTimeout(() => {
        server.stop();
        process.exit(0);
      }, 100);

      return new Response(
        "<h2>Auth successful!</h2><p>You can close this tab. Check the terminal for your refresh token.</p>",
        { headers: { "content-type": "text/html" } },
      );
    } catch (err) {
      console.error("Token exchange failed:", err);
      setTimeout(() => server.stop(), 100);
      return new Response(`<h2>Token exchange failed</h2><pre>${err}</pre>`, {
        headers: { "content-type": "text/html" },
      });
    }
  },
});

console.log("Listening on http://localhost:3333 for OAuth redirect...");
