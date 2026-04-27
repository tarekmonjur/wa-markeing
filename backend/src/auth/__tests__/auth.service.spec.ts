import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth.service';
import { User } from '../../users/entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: Record<string, jest.Mock>;

  const mockUser: Partial<User> = {
    id: 'u1',
    email: 'test@example.com',
    passwordHash: '',
    isEmailVerified: true,
    refreshTokenHash: '',
  };

  beforeEach(async () => {
    mockUser.passwordHash = await bcrypt.hash('Test@1234', 4);

    userRepo = {
      findOne: jest.fn(),
      create: jest.fn((d) => ({ ...d, id: 'u1' })),
      save: jest.fn((d) => Promise.resolve({ ...d, id: 'u1' })),
      update: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('mock.jwt.token'),
            verify: jest.fn().mockReturnValue({ sub: 'u1', type: 'refresh' }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('test-secret-32-chars-minimum!!!'),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register', () => {
    it('should register a new user', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const result = await service.register({
        email: 'new@test.com',
        password: 'Strong@123',
        name: 'Test User',
      });
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
    });

    it('should throw ConflictException if email exists', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      await expect(
        service.register({
          email: 'test@example.com',
          password: 'Strong@123',
          name: 'Test',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should return tokens on valid credentials', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      const result = await service.login({
        email: 'test@example.com',
        password: 'Test@1234',
      });
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw on wrong password', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      await expect(
        service.login({ email: 'test@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw if user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(
        service.login({ email: 'none@test.com', password: 'any' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should clear refresh token hash', async () => {
      await service.logout('u1');
      expect(userRepo.update).toHaveBeenCalledWith('u1', {
        refreshTokenHash: '',
      });
    });
  });
});
