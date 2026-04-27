import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { PromptBuilderService } from './prompt-builder.service';
import { PromptSanitizerService } from './prompt-sanitizer.service';
import { CostLimiterService } from './cost-limiter.service';
import { OpenAiProvider } from './providers/openai.provider';
import { OllamaProvider } from './providers/ollama.provider';

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    PromptBuilderService,
    PromptSanitizerService,
    CostLimiterService,
    OpenAiProvider,
    OllamaProvider,
  ],
  exports: [AiService],
})
export class AiModule {}
