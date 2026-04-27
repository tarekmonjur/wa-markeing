import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeamMember, UserRole } from './entities/team-member.entity';
import { User } from '../users/entities/user.entity';

export class InviteMemberDto {
  email: string;
  role: UserRole;
}

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(
    @InjectRepository(TeamMember)
    private readonly memberRepo: Repository<TeamMember>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async inviteMember(ownerId: string, dto: InviteMemberDto): Promise<TeamMember> {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user) throw new NotFoundException('User not found with that email');

    if (user.id === ownerId) {
      throw new BadRequestException('Cannot add yourself as a team member');
    }

    const existing = await this.memberRepo.findOne({
      where: { userId: user.id, teamId: ownerId },
    });
    if (existing) throw new BadRequestException('User is already a team member');

    const member = this.memberRepo.create({
      userId: user.id,
      teamId: ownerId,
      role: dto.role,
    });

    return this.memberRepo.save(member);
  }

  async getMembers(ownerId: string): Promise<TeamMember[]> {
    return this.memberRepo.find({
      where: { teamId: ownerId },
      relations: ['user'],
    });
  }

  async updateRole(
    ownerId: string,
    memberId: string,
    role: UserRole,
  ): Promise<TeamMember> {
    const member = await this.memberRepo.findOne({
      where: { userId: memberId, teamId: ownerId },
    });
    if (!member) throw new NotFoundException('Team member not found');

    member.role = role;
    return this.memberRepo.save(member);
  }

  async removeMember(ownerId: string, memberId: string): Promise<void> {
    const member = await this.memberRepo.findOne({
      where: { userId: memberId, teamId: ownerId },
    });
    if (!member) throw new NotFoundException('Team member not found');

    await this.memberRepo.remove(member);
  }
}
