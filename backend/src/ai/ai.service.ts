import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PromptBuilderService, GeneratePromptDto } from './prompt-builder.service';
import { CostLimiterService } from './cost-limiter.service';
import { OpenAiProvider } from './providers/openai.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { IAiProvider } from './interfaces/ai-provider.interface';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly defaultProvider: string;

  constructor(
    private readonly promptBuilder: PromptBuilderService,
    private readonly costLimiter: CostLimiterService,
    private readonly openai: OpenAiProvider,
    private readonly ollama: OllamaProvider,
    private readonly config: ConfigService,
  ) {
    // Default to ollama if OPENAI_API_KEY is not set
    const hasOpenAi = !!this.config.get<string>('OPENAI_API_KEY');
    this.defaultProvider = hasOpenAi ? 'openai' : 'ollama';
  }

  async generateCopy(
    userId: string,
    plan: string,
    dto: GeneratePromptDto,
    provider?: string,
  ): Promise<{ copy: string; provider: string; remaining: number }> {
    // Check quota
    const quota = this.costLimiter.checkQuota(userId, plan);
    if (!quota.allowed) {
      throw new HttpException(
        `Daily AI generation limit reached (${this.costLimiter.getLimit(plan)}/${plan} plan). Upgrade for more.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const prompt = this.promptBuilder.build(dto);
    const providerName = provider ?? this.defaultProvider;
    const aiProvider: IAiProvider =
      providerName === 'openai' ? this.openai : this.ollama;

    try {
      const copy = await aiProvider.generateMarketingCopy(prompt);
      this.costLimiter.recordUsage(userId);

      return {
        copy,
        provider: providerName,
        remaining: quota.remaining - 1,
      };
    } catch (err) {
      this.logger.error(`AI generation failed (${providerName}): ${err}`);

      // Fallback: try the other provider
      if (providerName === 'openai') {
        try {
          const copy = await this.ollama.generateMarketingCopy(prompt);
          this.costLimiter.recordUsage(userId);
          return { copy, provider: 'ollama', remaining: quota.remaining - 1 };
        } catch {
          // Both failed
        }
      }

      throw new HttpException(
        'AI generation failed. Please try again later.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
