import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AutoReplyService } from '../auto-reply.service';
import { KeywordMatcherService } from '../keyword-matcher.service';
import { MatchType } from '../entities/auto-reply-rule.entity';

function createMockRepository() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    findAndCount: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
      getOne: jest.fn(),
      getManyAndCount: jest.fn(),
      select: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
    })),
    metadata: { columns: [], relations: [] },
  };
}

describe('AutoReplyService', () => {
  let service: AutoReplyService;
  let ruleRepo: any;
  let keywordMatcher: KeywordMatcherService;

  beforeEach(() => {
    ruleRepo = createMockRepository();
    keywordMatcher = new KeywordMatcherService();
    service = new AutoReplyService(ruleRepo, keywordMatcher);
  });

  describe('create()', () => {
    it('creates a CONTAINS rule successfully', async () => {
      const dto = { keyword: 'price', matchType: MatchType.CONTAINS, replyBody: 'Our prices...' };
      ruleRepo.create.mockReturnValue({ id: 'r1', userId: 'u1', ...dto });
      ruleRepo.save.mockResolvedValue({ id: 'r1', userId: 'u1', ...dto });

      const result = await service.create('u1', dto as any);
      expect(result.keyword).toBe('price');
      expect(ruleRepo.save).toHaveBeenCalled();
    });

    it('validates REGEX pattern before saving', async () => {
      const dto = { keyword: '^(a+)+$', matchType: MatchType.REGEX, replyBody: 'test' };

      await expect(service.create('u1', dto as any)).rejects.toThrow(BadRequestException);
    });

    it('allows valid REGEX patterns', async () => {
      const dto = { keyword: '^hello\\s+\\w+$', matchType: MatchType.REGEX, replyBody: 'hi' };
      ruleRepo.create.mockReturnValue({ id: 'r1', userId: 'u1', ...dto });
      ruleRepo.save.mockResolvedValue({ id: 'r1', userId: 'u1', ...dto });

      const result = await service.create('u1', dto as any);
      expect(result.keyword).toBe('^hello\\s+\\w+$');
    });
  });

  describe('remove()', () => {
    it('prevents deletion of system STOP rule', async () => {
      ruleRepo.findOne.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        keyword: 'stop',
        priority: 9999,
      });

      await expect(service.remove('u1', 'r1')).rejects.toThrow(NotFoundException);
    });

    it('allows deletion of regular rules', async () => {
      const rule = { id: 'r2', userId: 'u1', keyword: 'order', priority: 5 };
      ruleRepo.findOne.mockResolvedValue(rule);
      ruleRepo.remove.mockResolvedValue(rule);

      await expect(service.remove('u1', 'r2')).resolves.not.toThrow();
      expect(ruleRepo.remove).toHaveBeenCalled();
    });
  });

  describe('findMatch()', () => {
    it('returns matching rule for inbound text', async () => {
      const rule = {
        id: 'r1',
        userId: 'u1',
        keyword: 'price',
        matchType: MatchType.CONTAINS,
        replyBody: 'Our prices...',
        isActive: true,
        priority: 5,
        sessionId: null,
      };
      ruleRepo.find.mockResolvedValue([rule]);

      const result = await service.findMatch('u1', 'what is the price?');
      expect(result).toBe(rule);
    });

    it('filters rules by session when sessionId provided', async () => {
      const rule1 = {
        id: 'r1',
        keyword: 'test',
        matchType: MatchType.CONTAINS,
        isActive: true,
        priority: 5,
        sessionId: 'other-session',
      };
      const rule2 = {
        id: 'r2',
        keyword: 'test',
        matchType: MatchType.CONTAINS,
        isActive: true,
        priority: 3,
        sessionId: null,
      };
      ruleRepo.find.mockResolvedValue([rule1, rule2]);

      const result = await service.findMatch('u1', 'test message', 'my-session');
      // rule1 has a different sessionId, so only rule2 (null = all sessions) matches
      expect(result?.id).toBe('r2');
    });

    it('returns null when no rules match', async () => {
      ruleRepo.find.mockResolvedValue([
        {
          keyword: 'unique-keyword',
          matchType: MatchType.EXACT,
          isActive: true,
          priority: 1,
          sessionId: null,
        },
      ]);

      const result = await service.findMatch('u1', 'totally different message');
      expect(result).toBeNull();
    });
  });

  describe('ensureStopRule()', () => {
    it('creates STOP rule if none exists', async () => {
      ruleRepo.findOne.mockResolvedValue(null);
      ruleRepo.create.mockImplementation((data: any) => data);
      ruleRepo.save.mockResolvedValue({});

      await service.ensureStopRule('u1');

      expect(ruleRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          keyword: 'stop',
          matchType: MatchType.EXACT,
          priority: 9999,
        }),
      );
    });

    it('does not create duplicate STOP rule', async () => {
      ruleRepo.findOne.mockResolvedValue({ keyword: 'stop', priority: 9999 });

      await service.ensureStopRule('u1');

      expect(ruleRepo.save).not.toHaveBeenCalled();
    });
  });
});
