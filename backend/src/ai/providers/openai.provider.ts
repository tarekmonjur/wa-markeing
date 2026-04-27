import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAiProvider } from '../interfaces/ai-provider.interface';

@Injectable()
export class OpenAiProvider implements IAiProvider {
  private readonly logger = new Logger(OpenAiProvider.name);
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('OPENAI_API_KEY', '');
  }

  async generateMarketingCopy(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.8,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${res.status} ${JSON.stringify(err)}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? '';
  }
}
