export interface AffiliateProvider {
  readonly source: string;
  generateLink(url: string): Promise<string>;
  normalizeUrl(url: string): string;
  validateLink(url: string): boolean;
}
