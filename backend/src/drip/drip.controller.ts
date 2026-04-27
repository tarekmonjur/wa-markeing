import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DripService } from './drip.service';
import {
  CreateDripSequenceDto,
  UpdateDripSequenceDto,
  CreateDripStepDto,
  EnrollContactsDto,
} from './dto';
import { CurrentUser } from '../common/decorators';
import { User } from '../users/entities/user.entity';

@ApiTags('Drip Sequences')
@ApiBearerAuth()
@Controller('drip-sequences')
export class DripController {
  constructor(private readonly dripService: DripService) {}

  @Post()
  @ApiOperation({ summary: 'Create a drip sequence' })
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateDripSequenceDto,
  ) {
    return this.dripService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all drip sequences' })
  async findAll(@CurrentUser() user: User) {
    return this.dripService.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get drip sequence with steps and enrollments' })
  async findOne(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.dripService.findById(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update drip sequence' })
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDripSequenceDto,
  ) {
    return this.dripService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete drip sequence' })
  async remove(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.dripService.remove(user.id, id);
  }

  @Post(':id/steps')
  @ApiOperation({ summary: 'Add a step to a drip sequence' })
  async addStep(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDripStepDto,
  ) {
    return this.dripService.addStep(user.id, id, dto);
  }

  @Delete(':id/steps/:stepId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a step from a drip sequence' })
  async removeStep(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stepId', ParseUUIDPipe) stepId: string,
  ) {
    await this.dripService.removeStep(user.id, id, stepId);
  }

  @Post(':id/enroll')
  @ApiOperation({ summary: 'Enroll contacts into a drip sequence' })
  async enroll(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EnrollContactsDto,
  ) {
    return this.dripService.enroll(user.id, id, dto);
  }
}
