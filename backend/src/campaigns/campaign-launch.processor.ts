import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CampaignsService } from './campaigns.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from './entities/campaign.entity';
import { CampaignStatus } from '../database/enums';

@Processor('campaign-launch')
export class CampaignLaunchProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignLaunchProcessor.name);

  constructor(
    private readonly campaignsService: CampaignsService,
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
  ) {
    super();
  }

  async process(job: Job<{ campaignId: string }>): Promise<void> {
    const { campaignId } = job.data;
    this.logger.log(`Launching scheduled campaign: ${campaignId}`);

    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId },
    });

    if (!campaign) {
      this.logger.warn(`Campaign ${campaignId} not found — skipping launch`);
      return;
    }

    if (campaign.status !== CampaignStatus.SCHEDULED) {
      this.logger.warn(
        `Campaign ${campaignId} is ${campaign.status}, not SCHEDULED — skipping launch`,
      );
      return;
    }

    try {
      await this.campaignsService.start(campaign.userId, campaignId);
      this.logger.log(`Scheduled campaign ${campaignId} launched successfully`);
    } catch (err) {
      this.logger.error(
        `Failed to launch scheduled campaign ${campaignId}: ${err}`,
      );
      await this.campaignRepository.update(campaignId, {
        status: CampaignStatus.FAILED,
      });
    }
  }
}
