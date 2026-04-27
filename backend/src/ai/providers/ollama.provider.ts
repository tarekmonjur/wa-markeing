import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAiProvider } from '../interfaces/ai-provider.interface';

@Injectable()
export class OllamaProvider implements IAiProvider {
  private readonly logger = new Logger(OllamaProvider.name);
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('OLLAMA_URL', 'http://ollama:11434');
    this.model = this.config.get<string>('OLLAMA_MODEL', 'llama3.2:3b');
  }

  async generateMarketingCopy(prompt: string): Promise<string> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: { num_predict: 200, temperature: 0.8 },
        }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (err) {
      throw new Error(
        `Ollama unreachable at ${this.baseUrl}: ${(err as Error).message}`,
      );
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Ollama API error ${res.status}: ${body}`);
    }

    const data = await res.json();
    return data.response?.trim() ?? '';
  }
}
