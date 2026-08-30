export type DealMessageInput = {
  discountRate: number;
  headline: string | null;
  price: number;
  productUrl: string;
  title: string;
};

const WON = new Intl.NumberFormat("ko-KR");

/**
 * Telegram HTML parse mode understands exactly these three entities; anything
 * else must arrive literal. Product titles routinely carry & and the
 * occasional angle bracket from sellers, and one bad character makes the API
 * reject the whole message.
 */
export function escapeTelegramHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * The message links to the Fairprice product page, not to Coupang. The channel
 * exists to bring people to the site - the price history and the verdict are
 * what differentiates it - and the affiliate redirect with its disclosure
 * happens there.
 */
export function buildDealMessage(input: DealMessageInput) {
  const heading = escapeTelegramHtml(input.headline?.trim() || input.title);
  const lines = [
    `🔥 <b>${heading}</b>`,
    "",
    `${WON.format(input.price)}원${
      input.discountRate > 0 ? ` (관측 최고가 대비 ↓${input.discountRate}%)` : ""
    }`,
  ];

  if (input.headline && input.headline.trim() !== input.title.trim()) {
    lines.push(escapeTelegramHtml(input.title));
  }

  lines.push("", `가격 이력 보기 → ${input.productUrl}`);

  return lines.join("\n");
}
