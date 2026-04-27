import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, PlanFeature } from '../common/decorators';
import { User } from '../users/entities/user.entity';
import { CampaignsService } from '../campaigns/campaigns.service';
import { ContactsService } from '../contacts/contacts.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { PublicApiSendDto } from './dto/public-api-send.dto';
import { PublicApiCampaignDto } from './dto/public-api-campaign.dto';
import { PublicApiContactDto } from './dto/public-api-contact.dto';
import { PublicApiService } from './public-api.service';

@ApiTags('Public API')
@ApiBearerAuth()
@PlanFeature('canUseApi')
@Throttle({ default: { ttl: 60_000, limit: 60 } })
@Controller({ path: 'api/v1', version: '1' })
export class PublicApiController {
  constructor(
    private readonly publicApiService: PublicApiService,
    private readonly campaignsService: CampaignsService,
    private readonly contactsService: ContactsService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  @Post('messages/send')
  async sendMessage(
    @CurrentUser() user: User,
    @Body() dto: PublicApiSendDto,
  ) {
    return this.publicApiService.sendSingleMessage(user.id, dto);
  }

  @Post('campaigns')
  async createCampaign(
    @CurrentUser() user: User,
    @Body() dto: PublicApiCampaignDto,
  ) {
    return this.publicApiService.createCampaign(user.id, dto);
  }

  @Get('campaigns')
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async listCampaigns(
    @CurrentUser() user: User,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.campaignsService.findAll(user.id, page, limit);
  }

  @Get('campaigns/:id')
  async getCampaign(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.campaignsService.findById(user.id, id);
  }

  @Post('contacts')
  async upsertContact(
    @CurrentUser() user: User,
    @Body() dto: PublicApiContactDto,
  ) {
    return this.publicApiService.upsertContact(user.id, dto);
  }

  @Get('contacts/:phoneOrId')
  async getContact(
    @CurrentUser() user: User,
    @Param('phoneOrId') phoneOrId: string,
  ) {
    return this.publicApiService.getContact(user.id, phoneOrId);
  }

  @Delete('contacts/:id/unsubscribe')
  async unsubscribeContact(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.publicApiService.unsubscribeContact(user.id, id);
  }

  @Get('analytics/campaigns/:id')
  async getCampaignAnalytics(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.analyticsService.getCampaignStats(user.id, id);
  }
}
