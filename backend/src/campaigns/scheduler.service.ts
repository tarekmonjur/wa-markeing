import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from './entities/campaign.entity';
import { CampaignStatus } from '../database/enums';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectQueue('campaign-launch')
    private readonly campaignLaunchQueue: Queue,
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
  ) {}

  async scheduleCampaign(
    campaignId: string,
    scheduledAt: Date,
  ): Promise<void> {
    const delay = scheduledAt.getTime() - Date.now();
    if (delay <= 0) {
      throw new BadRequestException('scheduledAt must be in the future');
    }

    await this.campaignLaunchQueue.add(
      'launch-campaign',
      { campaignId },
      {
        delay,
        jobId: `launch-${campaignId}`,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    await this.campaignRepository.update(campaignId, {
      status: CampaignStatus.SCHEDULED,
      scheduledAt,
    });

    this.logger.log(
      `Campaign ${campaignId} scheduled for ${scheduledAt.toISOString()} (delay: ${delay}ms)`,
    );
  }

  async cancelScheduledCampaign(campaignId: string): Promise<void> {
    const job = await this.campaignLaunchQueue.getJob(
      `launch-${campaignId}`,
    );
    if (job) await job.remove();

    await this.campaignRepository.update(campaignId, {
      status: CampaignStatus.DRAFT,
      scheduledAt: null as any,
    });

    this.logger.log(`Campaign ${campaignId} schedule cancelled`);
  }

  async rescheduleCampaign(
    campaignId: string,
    newScheduledAt: Date,
  ): Promise<void> {
    // Remove existing job
    const existingJob = await this.campaignLaunchQueue.getJob(
      `launch-${campaignId}`,
    );
    if (existingJob) await existingJob.remove();

    // Schedule new
    await this.scheduleCampaign(campaignId, newScheduledAt);
  }
}
