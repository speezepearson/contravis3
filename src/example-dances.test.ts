import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it } from 'vitest';
import { DanceSchema } from './types';

const dir = resolve(__dirname, '../example-dances');
const files = readdirSync(dir).filter(f => f.endsWith('.json'));

describe('example dances', () => {
  it.each(files)('%s parses as a valid Dance', (file) => {
    const raw = JSON.parse(readFileSync(resolve(dir, file), 'utf-8'));
    const result = DanceSchema.safeParse(raw);
    if (!result.success) {
      throw new Error(result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('\n'));
    }
  });
});
