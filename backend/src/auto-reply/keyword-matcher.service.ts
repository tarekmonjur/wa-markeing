import { Injectable, BadRequestException } from '@nestjs/common';
import { AutoReplyRule, MatchType } from './entities/auto-reply-rule.entity';

@Injectable()
export class KeywordMatcherService {
  matchRules(
    inboundText: string,
    rules: AutoReplyRule[],
  ): AutoReplyRule | null {
    const sorted = [...rules].sort((a, b) => b.priority - a.priority);
    const text = inboundText.toLowerCase().trim();

    for (const rule of sorted) {
      if (this.matches(text, rule)) return rule;
    }
    return null;
  }

  private matches(text: string, rule: AutoReplyRule): boolean {
    const keyword = rule.keyword.toLowerCase();

    switch (rule.matchType) {
      case MatchType.EXACT:
        return text === keyword;
      case MatchType.CONTAINS:
        return text.includes(keyword);
      case MatchType.STARTS_WITH:
        return text.startsWith(keyword);
      case MatchType.REGEX:
        try {
          const regex = new RegExp(rule.keyword, 'i');
          return regex.test(text);
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  /**
   * Validate regex pattern before saving — reject ReDoS-prone patterns.
   */
  validateRegex(pattern: string): void {
    // Reject patterns with nested quantifiers (common ReDoS vectors)
    const redosPatterns = [
      /\(.*[+*].*\)[+*]/,        // (a+)+
      /\(.*\|.*\)[+*]/,           // (a|b)+
      /\(.*[+*].*\){2,}/,         // (a+){2,}
    ];

    for (const bad of redosPatterns) {
      if (bad.test(pattern)) {
        throw new BadRequestException(
          'Regex pattern rejected: potential ReDoS vulnerability. Avoid nested quantifiers.',
        );
      }
    }

    // Test compilation
    try {
      new RegExp(pattern, 'i');
    } catch {
      throw new BadRequestException('Invalid regex pattern');
    }
  }
}
