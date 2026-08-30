import assert from "node:assert/strict";
import { getTelegramConfig } from "../src/lib/telegram-config.ts";
import {
  buildDealMessage,
  escapeTelegramHtml,
} from "../src/lib/telegram-message.ts";

const token = "123456789:AAfakefakefakefakefakefakefakefake";

// Config: both values present and a plausible token.
assert.deepEqual(
  getTelegramConfig({ TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: "@fairprice_deals" }),
  { botToken: token, chatId: "@fairprice_deals" },
);

// Numeric chat ids for private channels are fine too.
assert.ok(
  getTelegramConfig({ TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: "-1001234567890" }),
);

// Half-configured or malformed disables the step rather than erroring later.
assert.equal(getTelegramConfig({ TELEGRAM_BOT_TOKEN: token }), null);
assert.equal(getTelegramConfig({ TELEGRAM_CHAT_ID: "@x" }), null);
assert.equal(getTelegramConfig({}), null);
assert.equal(
  getTelegramConfig({ TELEGRAM_BOT_TOKEN: "not-a-token", TELEGRAM_CHAT_ID: "@x" }),
  null,
  "a pasted username or URL must not pass as a token",
);
assert.equal(
  getTelegramConfig({ TELEGRAM_BOT_TOKEN: "123:short", TELEGRAM_CHAT_ID: "@x" }),
  null,
);

// Escaping: exactly the three HTML entities Telegram parses.
assert.equal(escapeTelegramHtml("A&B <C> D"), "A&amp;B &lt;C&gt; D");
assert.equal(escapeTelegramHtml("평범한 제목"), "평범한 제목");

// Message: seller titles with markup characters must not break the HTML.
const message = buildDealMessage({
  discountRate: 23,
  headline: null,
  price: 9900,
  productUrl: "https://fairprice.kr/products/abc",
  title: "코멧 물티슈 <캡형> & 리필",
});
assert.ok(message.includes("<b>코멧 물티슈 &lt;캡형&gt; &amp; 리필</b>"));
assert.ok(message.includes("9,900원"));
assert.ok(message.includes("↓23%"));
assert.ok(message.includes("https://fairprice.kr/products/abc"));

// A headline replaces the title in the heading, and the title still appears.
const headlined = buildDealMessage({
  discountRate: 0,
  headline: "역대 관측 최저가 갱신",
  price: 12000,
  productUrl: "https://fairprice.kr/products/x",
  title: "어떤 상품",
});
assert.ok(headlined.includes("<b>역대 관측 최저가 갱신</b>"));
assert.ok(headlined.includes("어떤 상품"));
// Zero discount omits the marker instead of printing ↓0%.
assert.ok(!headlined.includes("↓0%"));

console.log("Telegram tests passed.");
