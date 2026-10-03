import CronExpressionParser from '../src';
import { CronDayOfMonth } from '../src/fields';

describe('Quartz nearest weekday ("W") day-of-month modifier', () => {
  describe('parsing', () => {
    test('parses a single day with W', () => {
      const interval = CronExpressionParser.parse('0 0 9 15W * ?');
      expect(interval.fields.dayOfMonth).toBeInstanceOf(CronDayOfMonth);
      expect(interval.fields.dayOfMonth.values).toEqual([15]);
      expect(interval.fields.dayOfMonth.nearestWeekday).toBe(true);
      expect(interval.fields.dayOfMonth.hasLastChar).toBe(false);
    });

    test('parses LW as the last weekday of the month', () => {
      const interval = CronExpressionParser.parse('0 0 18 LW * ?');
      expect(interval.fields.dayOfMonth.values).toEqual(['L']);
      expect(interval.fields.dayOfMonth.nearestWeekday).toBe(true);
      expect(interval.fields.dayOfMonth.hasLastChar).toBe(true);
    });

    test.each([
      '0 0 9 15W,1W * ?',
      '0 0 9 1W,16 * ?',
      '0 0 9 1W-15W * ?',
      '0 0 9 10W/5 * ?',
      '0 0 9 *W * ?',
      '0 0 9 W * ?',
      '0 0 9 WL * ?',
      '0 0 9 L1W * ?',
      '0 0 9 L-1W * ?',
      '0 0 9 1W/2 * ?',
    ])('rejects combinations Quartz does not support: %s', (expression) => {
      expect(() => CronExpressionParser.parse(expression)).toThrow(/"W" modifier/);
    });

    test('rejects a W day outside the 1-31 range', () => {
      expect(() => CronExpressionParser.parse('0 0 9 0W * ?')).toThrow(/expected range 1-31/);
      expect(() => CronExpressionParser.parse('0 0 9 32W * ?')).toThrow(/expected range 1-31/);
    });

    test('rejects a lower case w', () => {
      expect(() => CronExpressionParser.parse('0 0 9 15w * ?')).toThrow(/Invalid characters/);
    });

    test('rejects W in the day-of-week field', () => {
      expect(() => CronExpressionParser.parse('0 0 9 ? * W')).toThrow(/Invalid characters/);
    });

    test('a plain day without W does not use the nearest-weekday logic', () => {
      const interval = CronExpressionParser.parse('0 0 9 15 * ?');
      expect(interval.fields.dayOfMonth.nearestWeekday).toBe(false);
    });
  });

  describe('nW fires on the nearest weekday', () => {
    test('15W never falls on a weekend', () => {
      const interval = CronExpressionParser.parse('0 0 0 15W * ?', {
        currentDate: new Date('2026-01-01T00:00:00Z'),
      });
      for (const date of interval.take(48)) {
        const dow = date.getDay();
        expect(dow).not.toBe(0);
        expect(dow).not.toBe(6);
      }
    });

    test('15W resolves to the expected days (verified against Quartz 2.3)', () => {
      const interval = CronExpressionParser.parse('0 0 9 15W * ?', {
        currentDate: new Date('2026-01-01T00:00:00Z'),
      });
      expect(interval.take(12).map((d) => d.toISOString())).toEqual([
        '2026-01-15T09:00:00.000Z',
        '2026-02-16T09:00:00.000Z', // 15th is Sunday -> Monday
        '2026-03-16T09:00:00.000Z', // 15th is Sunday -> Monday
        '2026-04-15T09:00:00.000Z',
        '2026-05-15T09:00:00.000Z',
        '2026-06-15T09:00:00.000Z',
        '2026-07-15T09:00:00.000Z',
        '2026-08-14T09:00:00.000Z', // 15th is Saturday -> Friday
        '2026-09-15T09:00:00.000Z',
        '2026-10-15T09:00:00.000Z',
        '2026-11-16T09:00:00.000Z',
        '2026-12-15T09:00:00.000Z',
      ]);
    });

    test('1W does not jump across the month start', () => {
      const interval = CronExpressionParser.parse('0 0 0 1W * ?', {
        currentDate: new Date('2025-11-01T00:00:00Z'),
      });
      expect(interval.take(5).map((d) => d.toISOString())).toEqual([
        '2025-11-03T00:00:00.000Z', // Sunday the 1st -> Monday the 3rd
        '2025-12-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z',
        '2026-02-02T00:00:00.000Z', // Sunday the 1st -> Monday the 2nd
        '2026-03-02T00:00:00.000Z',
      ]);
    });

    test('a Saturday 1st goes forward to Monday', () => {
      const interval = CronExpressionParser.parse('0 0 0 1W * ?', {
        currentDate: new Date('2026-07-15T00:00:00Z'),
      });
      // Saturday 2026-08-01 -> Monday 2026-08-03
      expect(interval.next().toISOString()).toBe('2026-08-03T00:00:00.000Z');
    });

    test('28W/29W/30W skip short months that do not contain the day', () => {
      const interval = CronExpressionParser.parse('0 0 0 31W * ?', {
        currentDate: new Date('2026-01-01T00:00:00Z'),
      });
      expect(interval.take(8).map((d) => d.toISOString())).toEqual([
        '2026-01-30T00:00:00.000Z',
        '2026-03-31T00:00:00.000Z', // February skipped
        '2026-05-29T00:00:00.000Z', // Sunday the 31st -> Friday the 29th; April skipped
        '2026-07-31T00:00:00.000Z', // June skipped
        '2026-08-31T00:00:00.000Z',
        '2026-10-30T00:00:00.000Z', // Saturday the 31st -> Friday the 30th; September skipped
        '2026-12-31T00:00:00.000Z', // November skipped
        '2027-01-29T00:00:00.000Z', // Sunday the 31st -> Friday the 29th
      ]);
    });

    test('31W fires on a Friday ending a 30-day month (Quartz lenient-calendar behaviour)', () => {
      const interval = CronExpressionParser.parse('0 0 0 31W * ?', {
        currentDate: new Date('2027-04-01T00:00:00Z'),
      });
      // April 2027 has 30 days ending on a Friday: Quartz fires on that Friday.
      expect(interval.next().toISOString()).toBe('2027-04-30T00:00:00.000Z');
    });

    test('29W skips non-leap February but fires in leap February', () => {
      const interval = CronExpressionParser.parse('0 0 0 29W * ?', {
        currentDate: new Date('1996-01-01T00:00:00Z'),
      });
      const dates = interval.take(4).map((d) => d.toISOString());
      expect(dates).toEqual([
        '1996-01-29T00:00:00.000Z',
        '1996-02-29T00:00:00.000Z', // Thursday
        '1996-03-29T00:00:00.000Z',
        '1996-04-29T00:00:00.000Z',
      ]);
      const nonLeap = CronExpressionParser.parse('0 0 0 29W * ?', {
        currentDate: new Date('1997-01-01T00:00:00Z'),
      });
      expect(nonLeap.next().toISOString()).toBe('1997-01-29T00:00:00.000Z');
      expect(nonLeap.next().toISOString()).toBe('1997-03-28T00:00:00.000Z'); // February skipped
    });

    test('W with a restricted month rejects days that never exist in that month', () => {
      expect(() => CronExpressionParser.parse('0 0 0 31W 2 ?')).toThrow(/does not exist in month 2/);
      expect(() => CronExpressionParser.parse('0 0 0 30W 2 ?')).toThrow(/does not exist in month 2/);
      expect(() => CronExpressionParser.parse('0 0 0 31W 4 ?')).toThrow(/does not exist in month 4/);
    });

    test('29W restricted to February uses the same nearest-weekday predicate', () => {
      const interval = CronExpressionParser.parse('0 0 0 29W 2 ?', {
        currentDate: new Date('1990-01-01T00:00:00Z'),
      });
      expect(interval.take(6).map((d) => d.toISOString()!.slice(0, 10))).toEqual([
        '1992-02-28', // leap Feb 29 is a Saturday -> Friday 28
        '1996-02-29', // leap Feb 29 is a Thursday
        '2000-02-29', // leap Feb 29 is a Tuesday
        '2004-02-27', // leap Feb 29 is a Sunday -> Friday 27
        '2008-02-29', // leap Feb 29 is a Friday
        '2012-02-29', // leap Feb 29 is a Wednesday
      ]);
    });
  });

  describe('LW fires on the last weekday of the month', () => {
    test('LW resolves to the last weekday of each month (verified against Quartz 2.3)', () => {
      const interval = CronExpressionParser.parse('0 0 18 LW * ?', {
        currentDate: new Date('2026-01-01T00:00:00Z'),
      });
      expect(interval.take(12).map((d) => d.toISOString())).toEqual([
        '2026-01-30T18:00:00.000Z', // last day Saturday -> Friday
        '2026-02-27T18:00:00.000Z',
        '2026-03-31T18:00:00.000Z',
        '2026-04-30T18:00:00.000Z',
        '2026-05-29T18:00:00.000Z', // Sunday the 31st -> Friday
        '2026-06-30T18:00:00.000Z',
        '2026-07-31T18:00:00.000Z',
        '2026-08-31T18:00:00.000Z',
        '2026-09-30T18:00:00.000Z',
        '2026-10-30T18:00:00.000Z', // Saturday the 31st -> Friday
        '2026-11-30T18:00:00.000Z',
        '2026-12-31T18:00:00.000Z',
      ]);
    });

    test('LW never falls on a weekend, including February', () => {
      const interval = CronExpressionParser.parse('0 0 0 LW * ?', {
        currentDate: new Date('2024-01-01T00:00:00Z'),
      });
      for (const date of interval.take(36)) {
        const dow = date.getDay();
        expect(dow).toBeGreaterThan(0);
        expect(dow).toBeLessThan(6);
      }
    });
  });

  describe('prev / take / hasNext / hasPrev', () => {
    test('iterating backwards returns the same schedule as forwards', () => {
      for (const cron of ['0 0 9 15W * ?', '0 0 18 LW * ?', '0 0 0 31W * ?']) {
        const forward = CronExpressionParser.parse(cron, {
          currentDate: new Date('2020-01-01T00:00:00Z'),
        }).take(100);

        const backwards = CronExpressionParser.parse(cron, {
          currentDate: new Date(forward[forward.length - 1].getTime() + 1000),
        })
          .take(-100)
          .reverse();

        expect(backwards.map((d) => d.toISOString())).toEqual(forward.map((d) => d.toISOString()));
      }
    });

    test('hasNext and hasPrev report availability inside the time span', () => {
      const interval = CronExpressionParser.parse('0 0 9 15W * ?', {
        currentDate: new Date('2026-02-01T00:00:00Z'),
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-02-20T00:00:00Z'),
      });
      expect(interval.hasNext()).toBe(true); // Feb 16 is still in the span
      expect(interval.hasPrev()).toBe(true); // Jan 15 is in the span
      interval.next();
      expect(interval.hasNext()).toBe(false); // the next fire (Mar 16) is past endDate
    });

    test('take(n) forwards and take(-n) backwards walk the schedule', () => {
      const interval = CronExpressionParser.parse('0 0 18 LW * ?', {
        currentDate: new Date('2026-05-31T19:00:00Z'),
      });
      expect(interval.take(2).map((d) => d.toISOString())).toEqual([
        '2026-06-30T18:00:00.000Z',
        '2026-07-31T18:00:00.000Z',
      ]);
      expect(interval.take(-2).map((d) => d.toISOString())).toEqual([
        '2026-06-30T18:00:00.000Z',
        '2026-05-29T18:00:00.000Z',
      ]);
    });
  });

  describe('includesDate', () => {
    test('is true exactly on scheduled fire dates', () => {
      const interval = CronExpressionParser.parse('0 0 9 15W * ?', { tz: 'UTC' });
      expect(interval.includesDate(new Date('2026-02-16T09:00:00Z'))).toBe(true); // Monday
      expect(interval.includesDate(new Date('2026-02-15T09:00:00Z'))).toBe(false); // Sunday
      expect(interval.includesDate(new Date('2026-02-17T09:00:00Z'))).toBe(false); // Tuesday
      expect(interval.includesDate(new Date('2026-02-16T10:00:00Z'))).toBe(false); // wrong hour
    });

    test('matches the iterator output for LW over multiple years', () => {
      const tz = 'UTC';
      const iterator = CronExpressionParser.parse('0 30 7 LW * ?', {
        currentDate: new Date('2022-01-01T00:00:00Z'),
        tz,
      });
      const probe = CronExpressionParser.parse('0 30 7 LW * ?', { tz });
      for (const fire of iterator.take(48)) {
        expect(probe.includesDate(fire.toDate())).toBe(true);
        expect(probe.includesDate(new Date(fire.getTime() + 86_400_000))).toBe(false);
      }
    });
  });

  describe('stringify', () => {
    test.each([
      ['0 0 9 15W * ?', '0 0 9 15W * ?'],
      ['0 0 18 LW * ?', '0 0 18 LW * ?'],
      ['0 30 7 1W * ?', '0 30 7 1W * ?'],
      ['0 0 0 31W * ?', '0 0 0 31W * ?'],
    ])('preserves the W notation: %s', (expression, expected) => {
      const interval = CronExpressionParser.parse(expression);
      expect(interval.stringify(true)).toBe(expected);
    });

    test('re-parsing the stringified expression gives the same schedule', () => {
      const first = CronExpressionParser.parse('0 0 9 15W * ?', {
        currentDate: new Date('2026-01-01T00:00:00Z'),
      }).take(36);
      const reparsed = CronExpressionParser.parse(CronExpressionParser.parse('0 0 9 15W * ?').stringify(true), {
        currentDate: new Date('2026-01-01T00:00:00Z'),
      }).take(36);
      expect(reparsed.map((d) => d.toISOString())).toEqual(first.map((d) => d.toISOString()));
    });
  });

  describe('timezone support', () => {
    test('W resolves in the cron timezone (Asia/Tokyo has no DST)', () => {
      const interval = CronExpressionParser.parse('0 0 18 LW * ?', {
        currentDate: new Date('2026-01-01T00:00:00Z'),
        tz: 'Asia/Tokyo',
      });
      expect(interval.take(6).map((d) => d.toISOString())).toEqual([
        '2026-01-30T09:00:00.000Z', // 18:00 JST = 09:00 UTC
        '2026-02-27T09:00:00.000Z',
        '2026-03-31T09:00:00.000Z',
        '2026-04-30T09:00:00.000Z',
        '2026-05-29T09:00:00.000Z',
        '2026-06-30T09:00:00.000Z',
      ]);
    });

    test('nW uses local calendar days with a non-UTC timezone', () => {
      const interval = CronExpressionParser.parse('0 0 9 15W * ?', {
        currentDate: new Date('2026-02-01T00:00:00Z'),
        tz: 'America/New_York',
      });
      // 2026-02-15 is a Sunday in New York -> fires Monday the 16th at 09:00 local (14:00 UTC, EST).
      expect(interval.next().toISOString()).toBe('2026-02-16T14:00:00.000Z');
    });
  });
});
