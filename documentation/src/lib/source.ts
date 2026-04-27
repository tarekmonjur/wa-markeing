import { docs } from '../../.source';
import { loader } from 'fumadocs-core/source';
import { i18n } from '@/lib/i18n';

const rawSource = docs.toFumadocsSource();

export const source = loader({
  baseUrl: '/docs',
  source: {
    files: typeof rawSource.files === 'function' ? rawSource.files() : rawSource.files,
  },
  i18n: {
    ...i18n,
    parser: 'dir',
  },
});
