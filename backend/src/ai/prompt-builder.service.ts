import { Injectable } from '@nestjs/common';
import { PromptSanitizerService } from './prompt-sanitizer.service';

export interface GeneratePromptDto {
  businessName: string;
  product: string;
  goal: string;
  tone: string;
}

@Injectable()
export class PromptBuilderService {
  constructor(private readonly sanitizer: PromptSanitizerService) {}

  build(dto: GeneratePromptDto): string {
    const businessName = this.sanitizer.sanitize(dto.businessName);
    const product = this.sanitizer.sanitize(dto.product);
    const goal = this.sanitizer.sanitize(dto.goal);
    const tone = this.sanitizer.sanitize(dto.tone);

    return `You are a WhatsApp marketing copywriter. Write a SHORT, conversational, engaging WhatsApp message (max 160 characters) for the following:

Business: ${businessName}
Product/Service: ${product}
Goal: ${goal}
Tone: ${tone}
Include a call-to-action.
Output ONLY the message text, no explanation, no quotes.`;
  }
}
