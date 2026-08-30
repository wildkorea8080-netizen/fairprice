export type TelegramConfig = {
  botToken: string;
  chatId: string;
};

/**
 * Reads the Telegram channel settings. The bot token comes from @BotFather;
 * the chat id is the channel's @username for a public channel or its numeric
 * -100... id for a private one, and the bot must be an admin of the channel
 * to post.
 *
 * Null unless both are present, so a half-configured deployment skips the
 * step silently instead of failing on every pipeline run.
 */
export function getTelegramConfig(
  env: Record<string, string | undefined> = process.env,
): TelegramConfig | null {
  const botToken = env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  const chatId = env.TELEGRAM_CHAT_ID?.trim() ?? "";

  if (!botToken || !chatId) {
    return null;
  }

  // BotFather tokens look like "123456789:AAf...". Refusing anything else
  // catches the common paste mistakes (a URL, the bot's username) before they
  // turn into opaque 401s from the API.
  if (!/^\d+:[A-Za-z0-9_-]{30,}$/.test(botToken)) {
    return null;
  }

  return { botToken, chatId };
}
