import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DripService } from './drip.service';

@Processor('drip')
export class DripProcessor extends WorkerHost {
  private readonly logger = new Logger(DripProcessor.name);

  constructor(private readonly dripService: DripService) {
    super();
  }

  async process(
    job: Job<{ enrollmentId: string; stepNumber: number }>,
  ): Promise<void> {
    const { enrollmentId, stepNumber } = job.data;
    this.logger.debug(
      `Processing drip step ${stepNumber} for enrollment ${enrollmentId}`,
    );
    await this.dripService.processDripStep(enrollmentId, stepNumber);
  }
}
