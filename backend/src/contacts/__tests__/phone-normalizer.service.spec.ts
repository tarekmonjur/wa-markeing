import { PhoneNormalizerService } from '../phone-normalizer.service';

describe('PhoneNormalizerService', () => {
  let service: PhoneNormalizerService;

  beforeEach(() => {
    service = new PhoneNormalizerService();
  });

  describe('normalize', () => {
    it('should normalize BD local number to E.164', () => {
      expect(service.normalize('01712345001')).toBe('+8801712345001');
    });

    it('should keep already E.164 BD number', () => {
      expect(service.normalize('+8801812345002')).toBe('+8801812345002');
    });

    it('should strip non-digit characters', () => {
      expect(service.normalize('017-1234-5001')).toBe('+8801712345001');
    });

    it('should handle number with spaces', () => {
      expect(service.normalize('017 1234 5001')).toBe('+8801712345001');
    });

    it('should handle number with country code without +', () => {
      expect(service.normalize('8801712345001')).toBe('+8801712345001');
    });

    it('should return null for empty string', () => {
      expect(service.normalize('')).toBeNull();
    });

    it('should return null for invalid number', () => {
      expect(service.normalize('123')).toBeNull();
    });

    it('should return null for non-numeric junk', () => {
      expect(service.normalize('abcdef')).toBeNull();
    });
  });

  describe('toWhatsAppJid', () => {
    it('should convert E.164 to JID', () => {
      expect(service.toWhatsAppJid('+8801712345001')).toBe(
        '8801712345001@s.whatsapp.net',
      );
    });
  });

  describe('toLocalFormat', () => {
    it('should format E.164 to national format', () => {
      const result = service.toLocalFormat('+8801712345001');
      expect(result).toBeDefined();
      expect(result).not.toBe('+8801712345001');
    });

    it('should return input if parsing fails', () => {
      expect(service.toLocalFormat('invalid')).toBe('invalid');
    });
  });
});
