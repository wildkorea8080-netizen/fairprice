export type VapidConfig = {
  privateKey: string;
  publicKey: string;
  subject: string;
};

/**
 * Web push needs a VAPID key pair. Generate one once with:
 *
 *   node -e "console.log(require('web-push').generateVAPIDKeys())"
 *
 * The public key is served to browsers and is not a secret; the private key
 * signs push requests and is. Returns null unless all three are present, so a
 * half-configured deployment renders no subscribe button rather than one that
 * fails when pressed.
 */
export function getVapidConfig(
  env: Record<string, string | undefined> = process.env,
): VapidConfig | null {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = env.VAPID_PRIVATE_KEY?.trim() ?? "";
  const contact = env.FAIRPRICE_CONTACT_EMAIL?.trim() ?? "";

  if (!publicKey || !privateKey || !contact) {
    return null;
  }

  // web-push requires the subject to be a mailto: or https: URL.
  const subject = contact.startsWith("mailto:") || contact.startsWith("https:")
    ? contact
    : `mailto:${contact}`;

  return { privateKey, publicKey, subject };
}

export function getVapidPublicKey(
  env: Record<string, string | undefined> = process.env,
) {
  return getVapidConfig(env)?.publicKey ?? null;
}
