import { Injectable, BadRequestException } from '@nestjs/common';

const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  IMAGE: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  VIDEO: ['video/mp4', 'video/3gpp'],
  AUDIO: ['audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/amr', 'audio/ogg'],
  DOCUMENT: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
};

const MAX_SIZES: Record<string, number> = {
  IMAGE: 16 * 1024 * 1024,
  VIDEO: 100 * 1024 * 1024,
  AUDIO: 16 * 1024 * 1024,
  DOCUMENT: 100 * 1024 * 1024,
};

// Magic byte signatures for common file types
const MAGIC_BYTES: { type: string; bytes: number[]; offset?: number }[] = [
  { type: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { type: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { type: 'image/gif', bytes: [0x47, 0x49, 0x46] },
  { type: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 },
  { type: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  { type: 'video/mp4', bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },
];

@Injectable()
export class MediaValidationService {
  /**
   * Validate file MIME type from magic bytes (not from extension).
   * Returns the detected media category (IMAGE, VIDEO, AUDIO, DOCUMENT).
   */
  validateFile(
    buffer: Buffer,
    declaredMime: string,
    fileSize: number,
  ): { mediaType: string; mimeType: string } {
    // Try to detect from magic bytes
    const detected = this.detectMimeFromBytes(buffer as any);
    const mimeToCheck = detected ?? declaredMime;

    // Find the category
    const category = this.getCategory(mimeToCheck);
    if (!category) {
      throw new BadRequestException(
        `File type "${mimeToCheck}" is not allowed. Supported: images, videos, audio, documents.`,
      );
    }

    // Check size limit
    const maxSize = MAX_SIZES[category];
    if (fileSize > maxSize) {
      throw new BadRequestException(
        `File too large. ${category} files must be under ${maxSize / (1024 * 1024)}MB.`,
      );
    }

    return { mediaType: category, mimeType: mimeToCheck };
  }

  private detectMimeFromBytes(buffer: { length: number; [index: number]: number }): string | null {
    for (const sig of MAGIC_BYTES) {
      const offset = sig.offset ?? 0;
      if (buffer.length < offset + sig.bytes.length) continue;
      const match = sig.bytes.every(
        (byte, i) => buffer[offset + i] === byte,
      );
      if (match) return sig.type;
    }
    return null;
  }

  private getCategory(mime: string): string | null {
    for (const [category, mimes] of Object.entries(ALLOWED_MIME_TYPES)) {
      if (mimes.includes(mime)) return category;
    }
    return null;
  }
}
