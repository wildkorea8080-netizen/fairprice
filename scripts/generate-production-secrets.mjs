import { randomBytes } from "node:crypto";

function token(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

function password() {
  const prefix = "Fairprice!";
  const suffix = randomBytes(18).toString("base64url");

  return `${prefix}${suffix}`;
}

const values = {
  FAIRPRICE_ADMIN_PASSWORD: password(),
  FAIRPRICE_AUTH_SECRET: token(48),
  CRON_SECRET: token(48),
};

console.log("# Add these values to .env.production. Do not commit real secrets.");

for (const [key, value] of Object.entries(values)) {
  console.log(`${key}=${value}`);
}
