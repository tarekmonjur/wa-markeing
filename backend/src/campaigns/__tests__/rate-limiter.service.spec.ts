import { ConfigService } from '@nestjs/config';
import { RateLimiterService } from '../rate-limiter.service';

describe('RateLimiterService', () => {
  let service: RateLimiterService;

  beforeEach(() => {
    const configService = { get: jest.fn() } as unknown as ConfigService;
    service = new RateLimiterService(configService);
  });

  it('should return 0 wait time on first call', async () => {
    const wait = await service.acquireToken('session-1');
    expect(wait).toBe(0);
  });

  it('should return positive wait time on immediate second call', async () => {
    await service.acquireToken('session-1');
    const wait = await service.acquireToken('session-1');
    expect(wait).toBeGreaterThan(0);
  });

  it('should track daily count after recordSend', () => {
    expect(service.getDailyCount('s1')).toBe(0);
    service.recordSend('s1');
    expect(service.getDailyCount('s1')).toBe(1);
  });

  it('should return -1 when daily cap exceeded', async () => {
    const sessionId = 'cap-test';
    for (let i = 0; i < 200; i++) {
      service.recordSend(sessionId);
    }
    const result = await service.acquireToken(sessionId);
    expect(result).toBe(-1);
  });

  it('should return daily cap of 200', () => {
    expect(service.getDailyCap()).toBe(200);
  });

  it('should isolate sessions', async () => {
    await service.acquireToken('s1');
    const wait = await service.acquireToken('s2');
    expect(wait).toBe(0);
  });
});
