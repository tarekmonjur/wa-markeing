import { Injectable } from '@nestjs/common';

@Injectable()
export class PromptSanitizerService {
  sanitize(input: string): string {
    let sanitized = input;

    // Strip injection patterns
    const patterns = [
      /ignore\s+(all\s+|previous\s+)?(instructions?|prompts?|context)/gi,
      /you\s+are\s+now/gi,
      /your\s+new\s+(role|task|persona)/gi,
      /forget\s+(all\s+|your\s+)?(instructions?|rules?|guidelines?)/gi,
      /disregard\s+(all\s+|previous\s+)?(instructions?|prompts?)/gi,
      /system\s*:\s*/gi,
      /\[INST\]/gi,
      /<<SYS>>/gi,
    ];

    for (const pattern of patterns) {
      sanitized = sanitized.replace(pattern, '');
    }

    // Strip HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, '');

    // Truncate to 500 characters
    if (sanitized.length > 500) {
      sanitized = sanitized.substring(0, 500);
    }

    return sanitized.trim();
  }
}
