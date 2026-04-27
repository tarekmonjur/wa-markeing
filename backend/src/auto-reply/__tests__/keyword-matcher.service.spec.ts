import { BadRequestException } from '@nestjs/common';
import { KeywordMatcherService } from '../keyword-matcher.service';
import { AutoReplyRule, MatchType } from '../entities/auto-reply-rule.entity';

const makeRule = (overrides: Partial<AutoReplyRule> = {}): AutoReplyRule =>
  ({
    id: 'r1',
    userId: 'u1',
    keyword: 'hello',
    matchType: MatchType.CONTAINS,
    replyBody: 'hi there',
    isActive: true,
    priority: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as AutoReplyRule);

describe('KeywordMatcherService', () => {
  let service: KeywordMatcherService;

  beforeEach(() => {
    service = new KeywordMatcherService();
  });

  it('EXACT match: "stop" matches "STOP" case-insensitively', () => {
    const rule = makeRule({ keyword: 'stop', matchType: MatchType.EXACT });
    const result = service.matchRules('STOP', [rule]);
    expect(result).toBe(rule);
  });

  it('EXACT match: does not match partial text', () => {
    const rule = makeRule({ keyword: 'stop', matchType: MatchType.EXACT });
    const result = service.matchRules('please stop now', [rule]);
    expect(result).toBeNull();
  });

  it('CONTAINS match: "order" matches message "my order is wrong"', () => {
    const rule = makeRule({ keyword: 'order', matchType: MatchType.CONTAINS });
    const result = service.matchRules('my order is wrong', [rule]);
    expect(result).toBe(rule);
  });

  it('CONTAINS match: does not match when keyword absent', () => {
    const rule = makeRule({ keyword: 'pricing', matchType: MatchType.CONTAINS });
    const result = service.matchRules('my order is wrong', [rule]);
    expect(result).toBeNull();
  });

  it('STARTS_WITH match: "hi" matches "Hi can you help"', () => {
    const rule = makeRule({ keyword: 'hi', matchType: MatchType.STARTS_WITH });
    const result = service.matchRules('Hi can you help', [rule]);
    expect(result).toBe(rule);
  });

  it('STARTS_WITH match: does not match if keyword is in the middle', () => {
    const rule = makeRule({ keyword: 'help', matchType: MatchType.STARTS_WITH });
    const result = service.matchRules('I need help', [rule]);
    expect(result).toBeNull();
  });

  it('higher priority rule wins when multiple rules match', () => {
    const lowPriority = makeRule({
      id: 'r1',
      keyword: 'order',
      matchType: MatchType.CONTAINS,
      replyBody: 'low priority reply',
      priority: 1,
    });
    const highPriority = makeRule({
      id: 'r2',
      keyword: 'order',
      matchType: MatchType.CONTAINS,
      replyBody: 'high priority reply',
      priority: 10,
    });

    const result = service.matchRules('check my order status', [lowPriority, highPriority]);
    expect(result).toBe(highPriority);
  });

  it('REGEX: valid pattern matches correctly', () => {
    const rule = makeRule({ keyword: 'order\\s+\\d+', matchType: MatchType.REGEX });
    const result = service.matchRules('check order 12345', [rule]);
    expect(result).toBe(rule);
  });

  it('REGEX: does not match when pattern doesn\'t match text', () => {
    const rule = makeRule({ keyword: '^hello$', matchType: MatchType.REGEX });
    const result = service.matchRules('say hello world', [rule]);
    expect(result).toBeNull();
  });

  it('REGEX: invalid pattern returns no match (does not throw)', () => {
    const rule = makeRule({ keyword: '[invalid', matchType: MatchType.REGEX });
    const result = service.matchRules('test', [rule]);
    expect(result).toBeNull();
  });

  it('REGEX: ReDoS pattern (e.g. ^(a+)+$) is rejected on save with 400', () => {
    expect(() => service.validateRegex('^(a+)+$')).toThrow(BadRequestException);
  });

  it('REGEX: nested alternation ReDoS pattern is rejected', () => {
    expect(() => service.validateRegex('(a|b)+')).toThrow(BadRequestException);
  });

  it('REGEX: valid pattern passes validation', () => {
    expect(() => service.validateRegex('^hello\\s+world$')).not.toThrow();
  });

  it('REGEX: invalid syntax pattern is rejected on validation', () => {
    expect(() => service.validateRegex('[invalid')).toThrow(BadRequestException);
  });

  it('returns null when no rules match', () => {
    const rule = makeRule({ keyword: 'foo', matchType: MatchType.EXACT });
    const result = service.matchRules('bar', [rule]);
    expect(result).toBeNull();
  });

  it('returns null when rules array is empty', () => {
    const result = service.matchRules('hello', []);
    expect(result).toBeNull();
  });

  it('Bangla keyword match: "বন্ধ" works with CONTAINS', () => {
    const rule = makeRule({ keyword: 'বন্ধ', matchType: MatchType.CONTAINS });
    const result = service.matchRules('বন্ধ করুন', [rule]);
    expect(result).toBe(rule);
  });
});
