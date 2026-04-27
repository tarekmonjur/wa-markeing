import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CampaignsService } from './campaigns.service';
import { AbTestService, CreateAbTestDto } from './ab-test.service';
import { CreateCampaignDto, UpdateCampaignDto, ScheduleCampaignDto } from './dto';
import { CurrentUser } from '../common/decorators';
import { User } from '../users/entities/user.entity';

@ApiTags('Campaigns')
@ApiBearerAuth()
@Controller('campaigns')
export class CampaignsController {
  constructor(
    private readonly campaignsService: CampaignsService,
    private readonly abTestService: AbTestService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a campaign' })
  async create(@CurrentUser() user: User, @Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List campaigns (paginated)' })
  async findAll(
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.campaignsService.findAll(user.id, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get campaign with live stats' })
  async findOne(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.campaignsService.findById(user.id, id);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get message logs for a campaign' })
  async getMessages(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.campaignsService.getMessageLogs(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a DRAFT campaign' })
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaignsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a DRAFT / COMPLETED / FAILED campaign' })
  async remove(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.campaignsService.remove(user.id, id);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start a campaign (enqueue messages)' })
  async start(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.campaignsService.start(user.id, id);
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause a running campaign' })
  async pause(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.campaignsService.pause(user.id, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a running/paused campaign' })
  async cancel(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.campaignsService.cancel(user.id, id);
  }

  @Post(':id/schedule')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Schedule a campaign for future delivery' })
  async schedule(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ScheduleCampaignDto,
  ) {
    return this.campaignsService.scheduleCampaign(user.id, id, dto);
  }

  @Post(':id/unschedule')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a scheduled campaign (back to DRAFT)' })
  async unschedule(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.campaignsService.cancelSchedule(user.id, id);
  }

  // ───── A/B Test Endpoints ─────

  @Post(':id/ab-test')
  @ApiOperation({ summary: 'Create an A/B test for a campaign' })
  async createAbTest(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Omit<CreateAbTestDto, 'campaignId'>,
  ) {
    return this.abTestService.create(user.id, { ...dto, campaignId: id });
  }

  @Get(':id/ab-test')
  @ApiOperation({ summary: 'Get A/B test for a campaign' })
  async getAbTest(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.abTestService.findByCampaignId(user.id, id);
  }

  @Get(':id/ab-test/results')
  @ApiOperation({ summary: 'Get A/B test results with significance' })
  async getAbTestResults(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const test = await this.abTestService.findByCampaignId(user.id, id);
    if (!test) return null;
    return this.abTestService.getResults(user.id, test.id);
  }
}
