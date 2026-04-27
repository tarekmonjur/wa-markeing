import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { ExportFormat } from './entities/export-job.entity';
import { CurrentUser } from '../common/decorators';
import { User } from '../users/entities/user.entity';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Aggregated daily stats for the user dashboard (last N days)' })
  async getOverview(
    @CurrentUser() user: User,
    @Query('days') days?: number,
  ) {
    return this.analyticsService.getOverview(user.id, days ?? 30);
  }

  @Get('campaigns')
  @ApiOperation({ summary: 'List campaigns with pre-aggregated stats' })
  async listCampaigns(
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
  ) {
    return this.analyticsService.listCampaignsWithStats(
      user.id,
      page,
      limit,
      startDate,
      endDate,
      status,
    );
  }

  @Get('campaigns/:id')
  @ApiOperation({ summary: 'Get pre-aggregated stats for one campaign' })
  async getCampaignStats(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.analyticsService.getCampaignStats(user.id, id);
  }

  @Get('campaigns/:id/contacts')
  @ApiOperation({ summary: 'Per-contact delivery status (paginated)' })
  async getCampaignContacts(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.analyticsService.getCampaignContacts(user.id, id, page, limit);
  }

  @Post('campaigns/:id/export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger async CSV or PDF export job' })
  async createExport(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('format') format?: string,
  ) {
    const fmt = format === 'pdf' ? ExportFormat.PDF : ExportFormat.CSV;
    return this.analyticsService.createExportJob(user.id, id, fmt);
  }

  @Get('exports/:jobId')
  @ApiOperation({ summary: 'Poll export job status' })
  async getExportJob(
    @CurrentUser() user: User,
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ) {
    return this.analyticsService.getExportJob(user.id, jobId);
  }
}
