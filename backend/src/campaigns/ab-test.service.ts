import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as seedrandom from 'seedrandom';
import { AbTest, AbStatus } from './entities/ab-test.entity';
import { AbResult } from './entities/ab-result.entity';
import { Campaign } from './entities/campaign.entity';
import { SignificanceService } from '../analytics/significance.service';

export interface CreateAbTestDto {
  campaignId: string;
  variantA: string;
  variantB: string;
  splitRatio?: number;
}

@Injectable()
export class AbTestService {
  constructor(
    @InjectRepository(AbTest)
    private readonly abTestRepo: Repository<AbTest>,
    @InjectRepository(AbResult)
    private readonly abResultRepo: Repository<AbResult>,
    @InjectRepository(Campaign)
    private readonly campaignRepo: Repository<Campaign>,
    private readonly significanceService: SignificanceService,
  ) {}

  async create(userId: string, dto: CreateAbTestDto): Promise<AbTest> {
    const campaign = await this.campaignRepo.findOne({
      where: { id: dto.campaignId, userId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const existing = await this.abTestRepo.findOne({
      where: { campaignId: dto.campaignId },
    });
    if (existing) throw new BadRequestException('Campaign already has an A/B test');

    const abTest = this.abTestRepo.create({
      campaignId: dto.campaignId,
      variantA: dto.variantA,
      variantB: dto.variantB,
      splitRatio: dto.splitRatio ?? 0.5,
    });
    const saved = await this.abTestRepo.save(abTest);

    // Create result rows for each variant
    await this.abResultRepo.save([
      { abTestId: saved.id, variant: 'A' },
      { abTestId: saved.id, variant: 'B' },
    ]);

    return this.findById(userId, saved.id);
  }

  async findById(userId: string, id: string): Promise<AbTest> {
    const test = await this.abTestRepo.findOne({
      where: { id },
      relations: ['results', 'campaign'],
    });
    if (!test) throw new NotFoundException('A/B test not found');
    // Verify ownership
    if (test.campaign?.userId !== userId) {
      throw new NotFoundException('A/B test not found');
    }
    return test;
  }

  async findByCampaignId(userId: string, campaignId: string): Promise<AbTest | null> {
    const test = await this.abTestRepo.findOne({
      where: { campaignId },
      relations: ['results', 'campaign'],
    });
    if (test && test.campaign?.userId !== userId) return null;
    return test;
  }

  async getResults(userId: string, abTestId: string) {
    const test = await this.findById(userId, abTestId);
    const resultA = test.results.find((r) => r.variant === 'A');
    const resultB = test.results.find((r) => r.variant === 'B');

    const significance = this.significanceService.computeSignificance(
      { delivered: resultA?.delivered ?? 0, read: resultA?.read ?? 0 },
      { delivered: resultB?.delivered ?? 0, read: resultB?.read ?? 0 },
    );

    return { test, significance };
  }

  async completeTest(abTestId: string): Promise<void> {
    const test = await this.abTestRepo.findOne({
      where: { id: abTestId },
      relations: ['results'],
    });
    if (!test) return;

    const resultA = test.results.find((r) => r.variant === 'A');
    const resultB = test.results.find((r) => r.variant === 'B');

    const significance = this.significanceService.computeSignificance(
      { delivered: resultA?.delivered ?? 0, read: resultA?.read ?? 0 },
      { delivered: resultB?.delivered ?? 0, read: resultB?.read ?? 0 },
    );

    const winnerId =
      significance.winner === 'A'
        ? test.variantA
        : significance.winner === 'B'
          ? test.variantB
          : undefined;

    await this.abTestRepo.update(abTestId, {
      status: AbStatus.COMPLETED,
      completedAt: new Date(),
      winnerId,
    });
  }

  /**
   * Deterministic Fisher-Yates shuffle with seeded PRNG.
   */
  splitContacts(
    contactIds: string[],
    splitRatio: number,
    seed: string,
  ): { a: string[]; b: string[] } {
    const rng = seedrandom(seed);
    const arr = [...contactIds];

    // Fisher-Yates shuffle
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    const splitAt = Math.floor(arr.length * splitRatio);
    return { a: arr.slice(0, splitAt), b: arr.slice(splitAt) };
  }

  async incrementResult(
    abTestId: string,
    variant: 'A' | 'B',
    field: 'sent' | 'delivered' | 'read' | 'replied',
  ): Promise<void> {
    await this.abResultRepo
      .createQueryBuilder()
      .update(AbResult)
      .set({ [field]: () => `"${field}" + 1` })
      .where('"abTestId" = :abTestId AND variant = :variant', { abTestId, variant })
      .execute();
  }
}
