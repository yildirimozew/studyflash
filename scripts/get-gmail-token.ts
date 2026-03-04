/**
 * One-time script to obtain a Gmail OAuth2 refresh token.
 *
 * Setup (one time only):
 *   1. Go to Google Cloud Console → APIs & Services → Credentials
 *   2. Open your OAuth 2.0 Client ID
 *   3. Under "Authorized redirect URIs", add:  http://localhost:3001/callback
 *   4. Save, then run this script:
 *
 *      npx tsx scripts/get-gmail-token.ts
 *
 *   5. Copy the printed GMAIL_REFRESH_TOKEN into your .env file.
 */
import "dotenv/config";
import { google } from "googleapis";
import * as http from "http";
import * as url from "url";

const PORT = 3001;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
];

async function main() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("❌  GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env");
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // forces refresh_token to be returned every time
  });

  console.log("\n=== Gmail OAuth2 Token Setup ===\n");
  console.log("Prerequisite: make sure the following URI is listed under");
  console.log('"Authorized redirect URIs" in your Google Cloud Console OAuth client:\n');
  console.log(`  ${REDIRECT_URI}\n`);
  console.log("Opening authorization URL — sign in as the support Gmail account:\n");
  console.log(authUrl);
  console.log("\nWaiting for Google to redirect back...\n");

  // Spin up a temporary server to catch the OAuth callback
  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const parsed = url.parse(req.url ?? "", true);
      const code = parsed.query.code as string | undefined;
      const error = parsed.query.error as string | undefined;

      if (error) {
        res.end(`<h2>Authorization failed: ${error}</h2><p>You can close this tab.</p>`);
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (code) {
        res.end("<h2>✓ Authorization successful!</h2><p>You can close this tab and check your terminal.</p>");
        server.close();
        resolve(code);
      } else {
        res.end("<h2>Waiting...</h2>");
      }
    });

    server.listen(PORT, () => {
      console.log(`Listening on http://localhost:${PORT}/callback ...`);
    });

    server.on("error", reject);
  });

  const { tokens } = await oauth2Client.getToken(code);

  console.log("\n✓ Tokens received!\n");

  if (tokens.refresh_token) {
    console.log("Add these to your .env file:");
    console.log(`\nGMAIL_REFRESH_TOKEN="${tokens.refresh_token}"`);
    console.log(`GMAIL_ADDRESS="<the Gmail address you just authorized>"\n`);
  } else {
    console.log("⚠  No refresh_token returned.");
    console.log("This usually means a refresh token already exists for this client/account pair.");
    console.log("To force a new one:");
    console.log("  1. Go to https://myaccount.google.com/permissions");
    console.log("  2. Revoke access for your app");
    console.log("  3. Run this script again\n");
  }
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
