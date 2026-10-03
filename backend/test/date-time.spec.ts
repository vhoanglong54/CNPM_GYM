import { describe, expect, it } from 'vitest';
import { appDayBounds, formatAppDateTime } from '../src/common/date-time.js';

describe('Asia/Ho_Chi_Minh business time', () => {
  it('uses the Vietnam calendar day instead of the server UTC day', () => {
    const reference = new Date('2026-10-02T18:30:00.000Z');
    const bounds = appDayBounds(reference);

    expect(bounds.start.toISOString()).toBe('2026-10-02T17:00:00.000Z');
    expect(bounds.end.toISOString()).toBe('2026-10-03T17:00:00.000Z');
  });

  it('formats timestamps in Vietnam time', () => {
    expect(formatAppDateTime(new Date('2026-10-03T00:00:00.000Z'))).toContain(
      '07:00:00',
    );
  });
});
