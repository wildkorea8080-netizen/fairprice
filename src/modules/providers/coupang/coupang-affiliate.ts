import { createCoupangDeeplinks } from "@/lib/coupang/client";
import type { AffiliateProvider } from "@/modules/deal-engine/ports/affiliate-provider";
import { COUPANG_SOURCE } from "@/modules/providers/coupang/coupang-mapper";

const COUPANG_HOSTS = new Set(["coupang.com", "www.coupang.com"]);

export class CoupangAffiliateProvider implements AffiliateProvider {
  readonly source = COUPANG_SOURCE;

  async generateLink(url: string) {
    const normalizedUrl = this.normalizeUrl(url);
    const [deeplink] = await createCoupangDeeplinks([normalizedUrl]);

    return deeplink?.shortenUrl || deeplink?.landingUrl || normalizedUrl;
  }

  normalizeUrl(url: string) {
    const parsed = new URL(url);

    if (!this.validateLink(parsed.toString())) {
      throw new Error("지원하지 않는 쿠팡 URL입니다.");
    }

    parsed.protocol = "https:";
    parsed.hash = "";

    return parsed.toString();
  }

  validateLink(url: string) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" && COUPANG_HOSTS.has(parsed.hostname);
    } catch {
      return false;
    }
  }
}
