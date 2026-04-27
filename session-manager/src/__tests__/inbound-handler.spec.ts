import { InboundHandler } from '../InboundHandler';

// Mock ioredis and bullmq
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    disconnect: jest.fn(),
  }));
});

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue(undefined),
    close: jest.fn(),
  })),
}));

const makeBaileysMessage = (id: string, body: string, fromJid: string) => ({
  key: { id, remoteJid: fromJid, fromMe: false },
  message: { conversation: body },
  messageTimestamp: Math.floor(Date.now() / 1000),
});

describe('InboundHandler deduplication', () => {
  let handler: InboundHandler;
  let mockRedis: any;
  let mockQueue: any;
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as any;

  beforeEach(() => {
    handler = new InboundHandler(logger, 'redis://localhost:6379');
    // Access internal mocks
    mockRedis = (handler as any).redis;
    mockQueue = (handler as any).inboundQueue;
  });

  it('processes first occurrence of a waMessageId', async () => {
    // NX returns 'OK' for first time
    mockRedis.set.mockResolvedValue('OK');

    const msg = makeBaileysMessage('msg-001', 'hello', '8801712345678@s.whatsapp.net');
    await handler.handleMessages('session-1', [msg]);

    expect(mockRedis.set).toHaveBeenCalledWith(
      'dedup:inbound:msg-001',
      '1',
      'EX',
      86400,
      'NX',
    );
    expect(mockQueue.add).toHaveBeenCalledWith(
      'process-inbound',
      expect.objectContaining({
        sessionId: 'session-1',
        waMessageId: 'msg-001',
        body: 'hello',
      }),
      expect.any(Object),
    );
  });

  it('skips second occurrence of the same waMessageId (Redis key exists)', async () => {
    // NX returns null when key already exists
    mockRedis.set.mockResolvedValue(null);

    const msg = makeBaileysMessage('msg-001', 'hello', '8801712345678@s.whatsapp.net');
    await handler.handleMessages('session-1', [msg]);

    expect(mockRedis.set).toHaveBeenCalled();
    expect(mockQueue.add).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.objectContaining({ waMessageId: 'msg-001' }),
      expect.stringContaining('Duplicate'),
    );
  });

  it('skips fromMe messages', async () => {
    const msg = {
      key: { id: 'msg-002', remoteJid: 'test@s.whatsapp.net', fromMe: true },
      message: { conversation: 'outgoing' },
      messageTimestamp: Date.now(),
    };
    await handler.handleMessages('session-1', [msg]);

    expect(mockRedis.set).not.toHaveBeenCalled();
    expect(mockQueue.add).not.toHaveBeenCalled();
  });

  it('skips messages without content', async () => {
    const msg = {
      key: { id: 'msg-003', remoteJid: 'test@s.whatsapp.net', fromMe: false },
      message: null,
      messageTimestamp: Date.now(),
    };
    await handler.handleMessages('session-1', [msg]);

    expect(mockRedis.set).not.toHaveBeenCalled();
    expect(mockQueue.add).not.toHaveBeenCalled();
  });

  it('processes multiple unique messages in a batch', async () => {
    mockRedis.set.mockResolvedValue('OK');

    const messages = [
      makeBaileysMessage('msg-a', 'first', '8801700000001@s.whatsapp.net'),
      makeBaileysMessage('msg-b', 'second', '8801700000002@s.whatsapp.net'),
    ];

    await handler.handleMessages('session-1', messages);

    expect(mockQueue.add).toHaveBeenCalledTimes(2);
  });
});
