import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutoReplyRule, MatchType } from './entities/auto-reply-rule.entity';
import { KeywordMatcherService } from './keyword-matcher.service';
import { CreateAutoReplyRuleDto, UpdateAutoReplyRuleDto } from './dto';

@Injectable()
export class AutoReplyService {
  private readonly logger = new Logger(AutoReplyService.name);

  constructor(
    @InjectRepository(AutoReplyRule)
    private readonly ruleRepository: Repository<AutoReplyRule>,
    private readonly keywordMatcher: KeywordMatcherService,
  ) {}

  async create(
    userId: string,
    dto: CreateAutoReplyRuleDto,
  ): Promise<AutoReplyRule> {
    if (dto.matchType === MatchType.REGEX) {
      this.keywordMatcher.validateRegex(dto.keyword);
    }

    const rule = this.ruleRepository.create({
      userId,
      ...dto,
    });
    return this.ruleRepository.save(rule);
  }

  async findAll(userId: string): Promise<AutoReplyRule[]> {
    return this.ruleRepository.find({
      where: { userId },
      order: { priority: 'DESC', createdAt: 'DESC' },
    });
  }

  async findById(userId: string, id: string): Promise<AutoReplyRule> {
    const rule = await this.ruleRepository.findOne({
      where: { id, userId },
    });
    if (!rule) throw new NotFoundException('Auto-reply rule not found');
    return rule;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateAutoReplyRuleDto,
  ): Promise<AutoReplyRule> {
    const rule = await this.findById(userId, id);

    if (dto.matchType === MatchType.REGEX && dto.keyword) {
      this.keywordMatcher.validateRegex(dto.keyword);
    }

    Object.assign(rule, dto);
    return this.ruleRepository.save(rule);
  }

  async remove(userId: string, id: string): Promise<void> {
    const rule = await this.findById(userId, id);
    // Prevent deletion of system STOP rule
    if (rule.keyword.toLowerCase() === 'stop' && rule.priority >= 9999) {
      throw new NotFoundException('System STOP rule cannot be deleted');
    }
    await this.ruleRepository.remove(rule);
  }

  /**
   * Find matching auto-reply for an inbound message.
   */
  async findMatch(
    userId: string,
    inboundText: string,
    sessionId?: string,
  ): Promise<AutoReplyRule | null> {
    const rules = await this.ruleRepository.find({
      where: { userId, isActive: true },
      order: { priority: 'DESC' },
    });

    // Filter rules: include rules for specific session or for all sessions
    const applicable = rules.filter(
      (r) => !r.sessionId || r.sessionId === sessionId,
    );

    return this.keywordMatcher.matchRules(inboundText, applicable);
  }

  /**
   * Ensure system STOP rule exists for a user.
   */
  async ensureStopRule(userId: string): Promise<void> {
    const existing = await this.ruleRepository.findOne({
      where: { userId, keyword: 'stop', priority: 9999 },
    });
    if (!existing) {
      await this.ruleRepository.save(
        this.ruleRepository.create({
          userId,
          keyword: 'stop',
          matchType: MatchType.EXACT,
          replyBody:
            'You have been unsubscribed. Reply START to re-subscribe.',
          priority: 9999,
          isActive: true,
        }),
      );
    }
  }
}
