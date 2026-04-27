import { Repository } from 'typeorm';
import { ApiKeyService } from '../api-key.service';
import { ApiKey } from '../entities/api-key.entity';
import { createHash } from 'crypto';

describe('ApiKeyService', () => {
  let service: ApiKeyService;
  let repo: Partial<Repository<ApiKey>>;
  let savedKey: ApiKey;

  beforeEach(() => {
    savedKey = {} as ApiKey;
    repo = {
      create: jest.fn().mockImplementation((data) => ({ ...data, id: 'key-1' })),
      save: jest.fn().mockImplementation((data) => {
        savedKey = { ...data };
        return Promise.resolve(savedKey);
      }),
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockResolvedValue([]),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    service = new ApiKeyService(repo as any);
  });

  it('generates key with wam_ prefix', async () => {
    const result = await service.create('user-1', { name: 'Test' });
    expect(result.key).toMatch(/^wam_/);
  });

  it('stores only SHA-256 hash — raw key not persisted to DB', async () => {
    const result = await service.create('user-1', { name: 'Test' });
    const expectedHash = createHash('sha256').update(result.key).digest('hex');
    expect((repo.create as jest.Mock).mock.calls[0][0].keyHash).toBe(expectedHash);
    // Verify no rawKey field saved
    expect(savedKey).not.toHaveProperty('rawKey');
  });

  it('validateApiKey returns user for valid unexpired key', async () => {
    const rawKey = 'wam_testkey123';
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const mockUser = { id: 'user-1', email: 'test@test.com' };
    (repo.findOne as jest.Mock).mockResolvedValue({
      id: 'key-1',
      isActive: true,
      expiresAt: null,
      user: mockUser,
    });

    const result = await service.validateApiKey(rawKey);
    expect(result).toEqual(mockUser);
  });

  it('validateApiKey returns null for expired key', async () => {
    const rawKey = 'wam_expired123';
    (repo.findOne as jest.Mock).mockResolvedValue({
      id: 'key-1',
      isActive: true,
      expiresAt: new Date('2020-01-01'),
      user: { id: 'user-1' },
    });

    const result = await service.validateApiKey(rawKey);
    expect(result).toBeNull();
  });

  it('validateApiKey returns null for inactive key', async () => {
    const rawKey = 'wam_inactive123';
    (repo.findOne as jest.Mock).mockResolvedValue({
      id: 'key-1',
      isActive: false,
      user: { id: 'user-1' },
    });

    const result = await service.validateApiKey(rawKey);
    expect(result).toBeNull();
  });

  it('validateApiKey returns null for non-existent hash', async () => {
    (repo.findOne as jest.Mock).mockResolvedValue(null);
    const result = await service.validateApiKey('wam_doesnotexist');
    expect(result).toBeNull();
  });

  it('updates lastUsedAt on successful validation', async () => {
    const rawKey = 'wam_active123';
    (repo.findOne as jest.Mock).mockResolvedValue({
      id: 'key-1',
      isActive: true,
      expiresAt: null,
      user: { id: 'user-1' },
    });

    await service.validateApiKey(rawKey);
    // Wait for async update
    await new Promise((r) => setTimeout(r, 10));
    expect(repo.update).toHaveBeenCalledWith('key-1', expect.objectContaining({ lastUsedAt: expect.any(Date) }));
  });
});
