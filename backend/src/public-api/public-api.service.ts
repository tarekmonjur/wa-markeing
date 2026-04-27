import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { Contact } from '../contacts/entities/contact.entity';
import { PublicApiSendDto } from './dto/public-api-send.dto';
import { PublicApiCampaignDto } from './dto/public-api-campaign.dto';
import { PublicApiContactDto } from './dto/public-api-contact.dto';
import { CampaignsService } from '../campaigns/campaigns.service';

@Injectable()
export class PublicApiService {
  constructor(
    @InjectRepository(Contact)
    private readonly contactRepo: Repository<Contact>,
    @InjectQueue('campaign')
    private readonly campaignQueue: Queue,
    private readonly campaignsService: CampaignsService,
  ) {}

  async sendSingleMessage(userId: string, dto: PublicApiSendDto) {
    const jobId = uuidv4();

    await this.campaignQueue.add(
      'send-message',
      {
        campaignId: `api-${jobId}`,
        contactId: '',
        sessionId: dto.sessionId,
        messageLogId: '',
        phone: dto.phone,
        body: dto.body,
        mediaUrl: dto.mediaUrl,
        mediaType: dto.mediaType,
        idempotencyKey: `api-${jobId}`,
      },
      {
        removeOnComplete: { count: 5000 },
        removeOnFail: { count: 1000 },
      },
    );

    return { messageId: jobId, status: 'queued' };
  }

  async createCampaign(userId: string, dto: PublicApiCampaignDto) {
    const campaign = await this.campaignsService.create(userId, {
      name: dto.name,
      sessionId: dto.sessionId,
      templateId: dto.templateId,
      groupId: dto.groupId,
    });

    if (dto.autoStart) {
      await this.campaignsService.start(userId, campaign.id);
    }

    return campaign;
  }

  async upsertContact(userId: string, dto: PublicApiContactDto) {
    let contact = await this.contactRepo.findOne({
      where: { userId, phone: dto.phone },
    });

    if (contact) {
      if (dto.name !== undefined) contact.name = dto.name;
      if (dto.email !== undefined) contact.email = dto.email;
      if (dto.customFields) {
        contact.customFields = {
          ...contact.customFields,
          ...dto.customFields,
        };
      }
      return this.contactRepo.save(contact);
    }

    contact = this.contactRepo.create({
      userId,
      phone: dto.phone,
      name: dto.name,
      email: dto.email,
      customFields: dto.customFields || {},
    });
    return this.contactRepo.save(contact);
  }

  async getContact(userId: string, phoneOrId: string) {
    // Try UUID first
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        phoneOrId,
      );

    const contact = isUuid
      ? await this.contactRepo.findOne({ where: { id: phoneOrId, userId } })
      : await this.contactRepo.findOne({ where: { phone: phoneOrId, userId } });

    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async unsubscribeContact(userId: string, id: string) {
    const contact = await this.contactRepo.findOne({
      where: { id, userId },
    });
    if (!contact) throw new NotFoundException('Contact not found');

    contact.optedOut = true;
    contact.optedOutAt = new Date();
    await this.contactRepo.save(contact);

    return { status: 'unsubscribed', contactId: id };
  }
}
