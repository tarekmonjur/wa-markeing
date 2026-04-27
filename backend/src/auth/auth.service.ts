import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { User } from '../users/entities/user.entity';
import { RegisterDto, LoginDto } from './dto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly BCRYPT_ROUNDS = 12;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<{ id: string; email: string }> {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase() },
      withDeleted: true,
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);

    const user = this.userRepository.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      name: dto.name,
      isEmailVerified: true, // For MVP; real email verification comes later
    });

    const saved = await this.userRepository.save(user);
    this.logger.log(`User registered: ${saved.email}`);

    return { id: saved.id, email: saved.email };
  }

  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Email not verified');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokenPair(user);
    await this.storeRefreshTokenHash(user.id, tokens.refreshToken);

    this.logger.log(`User login: ${user.email}`);
    return tokens;
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    let payload: { sub: string; type: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Verify the refresh token hash matches (rotation: one-time use)
    const tokenHash = this.hashToken(refreshToken);
    if (tokenHash !== user.refreshTokenHash) {
      // Token reuse detected — invalidate all tokens for this user
      await this.userRepository.update(user.id, { refreshTokenHash: '' });
      this.logger.warn(`Refresh token reuse detected for user ${user.id}`);
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    const newTokens = await this.generateTokenPair(user);
    await this.storeRefreshTokenHash(user.id, newTokens.refreshToken);

    return newTokens;
  }

  async logout(userId: string): Promise<void> {
    await this.userRepository.update(userId, { refreshTokenHash: '' });
  }

  private async generateTokenPair(user: User): Promise<TokenPair> {
    const jwtPayload = { sub: user.id, email: user.email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(jwtPayload, {
        expiresIn: this.configService.getOrThrow<string>('JWT_EXPIRES_IN'),
      }),
      this.jwtService.signAsync(
        { ...jwtPayload, type: 'refresh' },
        {
          expiresIn: this.configService.getOrThrow<string>(
            'JWT_REFRESH_EXPIRES_IN',
          ),
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private async storeRefreshTokenHash(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const hash = this.hashToken(refreshToken);
    await this.userRepository.update(userId, { refreshTokenHash: hash });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
