export interface IAiProvider {
  generateMarketingCopy(prompt: string): Promise<string>;
}
