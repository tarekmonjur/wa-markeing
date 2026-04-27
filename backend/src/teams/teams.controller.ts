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
import { TeamsService, InviteMemberDto } from './teams.service';
import { CurrentUser } from '../common/decorators';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from './entities/team-member.entity';
import { User } from '../users/entities/user.entity';

@ApiTags('Teams')
@ApiBearerAuth()
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post('members')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Invite a new team member' })
  async inviteMember(
    @CurrentUser() user: User,
    @Body() dto: InviteMemberDto,
  ) {
    return this.teamsService.inviteMember(user.id, dto);
  }

  @Get('members')
  @ApiOperation({ summary: 'List team members' })
  async getMembers(@CurrentUser() user: User) {
    return this.teamsService.getMembers(user.id);
  }

  @Patch('members/:id/role')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a team member role' })
  async updateRole(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('role') role: UserRole,
  ) {
    return this.teamsService.updateRole(user.id, id, role);
  }

  @Delete('members/:id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a team member' })
  async removeMember(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.teamsService.removeMember(user.id, id);
  }
}
