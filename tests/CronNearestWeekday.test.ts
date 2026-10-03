import CronDate from '../src/CronDate';
import { CronDayOfMonth } from '../src/fields/CronDayOfMonth';
import { CronExpressionParser } from '../src/CronExpressionParser';

describe('Quartz "W" nearest weekday modifier', () => {
  const day = (date: CronDate) => date.toISOString()!.slice(0, 10);

  describe('next() with "<day>W"', () => {
    const nextDates = (expression: string, currentDate: string, steps = 12) =>
      CronExpressionParser.parse(expression, { currentDate: new Date(currentDate), tz: 'UTC' })
        .take(steps)
        .map(day);

    test('15W resolves to the weekday nearest to the 15th of every month', () => {
      // 2024: Jun 15 is Sat -> Fri 14; Sep 15 is Sun -> Mon 16; Dec 15 is Sun -> Mon 16
      expect(nextDates('0 0 0 15W * ?', '2024-01-01T00:00:00Z')).toEqual([
        '2024-01-15',
        '2024-02-15',
        '2024-03-15',
        '2024-04-15',
        '2024-05-15',
        '2024-06-14',
        '2024-07-15',
        '2024-08-15',
        '2024-09-16',
        '2024-10-15',
        '2024-11-15',
        '2024-12-16',
      ]);
    });

    test('1W never crosses a month boundary: a Saturday the 1st fires on Monday the 3rd', () => {
      // Feb 1 2025 is Sat -> Mon Feb 3 (not the previous month); Mar 1 is Sat -> Mon Mar 3
      // Nov 1 2025 is Sat -> Mon Nov 3; Jun 1 is Sun -> Mon Jun 2
      expect(nextDates('0 0 0 1W * ?', '2025-01-15T00:00:00Z', 11)).toEqual([
        '2025-02-03',
        '2025-03-03',
        '2025-04-01',
        '2025-05-01',
        '2025-06-02',
        '2025-07-01',
        '2025-08-01',
        '2025-09-01',
        '2025-10-01',
        '2025-11-03',
        '2025-12-01',
      ]);
    });

    test('a Sunday target that is not the 1st fires on the following Monday', () => {
      // 2024: Sep 1 is Sun -> Sep 2; Dec 1 is Sun -> Dec 2
      expect(nextDates('0 0 0 1W * ?', '2024-08-15T00:00:00Z', 4)).toEqual([
        '2024-09-02',
        '2024-10-01',
        '2024-11-01',
        '2024-12-02',
      ]);
    });

    test('31W fires at 09:00 and skips months shorter than 31 days', () => {
      const interval = CronExpressionParser.parse('0 0 9 31W * ?', {
        currentDate: new Date('2024-01-01T00:00:00Z'),
        tz: 'UTC',
      });
      // Jan 31 (Wed) 09:00; Feb has no 31st and is skipped; Mar 31 is Sun -> Fri Mar 29
      expect(interval.next().toISOString()).toEqual('2024-01-31T09:00:00.000Z');
      expect(interval.next().toISOString()).toEqual('2024-03-29T09:00:00.000Z');
      // Apr skipped; May 31 is Fri -> May 31
      expect(interval.next().toISOString()).toEqual('2024-05-31T09:00:00.000Z');
      // Jun skipped; Jul 31 is Wed; Aug 31 is Sat -> Fri Aug 30
      expect(interval.next().toISOString()).toEqual('2024-07-31T09:00:00.000Z');
      expect(interval.next().toISOString()).toEqual('2024-08-30T09:00:00.000Z');
    });

    test('30W skips February and applies the same weekday rules', () => {
      // Jan 30 (Tue); Feb has no 30th and is skipped; Mar 30 is Sat -> Fri Mar 29;
      // Apr 30 (Tue); May 30 (Thu); Jun 30 is Sun -> Fri Jun 28; Jul 30 (Tue); Aug 30 (Fri)
      expect(nextDates('0 0 0 30W * ?', '2024-01-01T00:00:00Z', 7)).toEqual([
        '2024-01-30',
        '2024-03-29',
        '2024-04-30',
        '2024-05-30',
        '2024-06-28',
        '2024-07-30',
        '2024-08-30',
      ]);
    });

    test('29W restricted to February only fires when February has 29 days', () => {
      const interval = CronExpressionParser.parse('0 0 0 29W 2 ?', {
        currentDate: new Date('2023-01-01T00:00:00Z'),
        tz: 'UTC',
      });
      // 2023/2025/... non-leap Februaries have no 29th and are skipped; 2024-02-29 is a Thursday
      expect(interval.next().toISOString()).toEqual('2024-02-29T00:00:00.000Z');
      // 2028-02-29 is a Tuesday
      expect(interval.next().toISOString()).toEqual('2028-02-29T00:00:00.000Z');
      // 2032-02-29 is a Sunday and is the last day of (leap) February, so it
      // moves back to Friday Feb 27 rather than crossing into March
      expect(interval.next().toISOString()).toEqual('2032-02-27T00:00:00.000Z');
    });

    test('31W skips every month shorter than 31 days in both directions', () => {
      const forward = CronExpressionParser.parse('0 0 0 31W * ?', {
        currentDate: new Date('2024-01-15T00:00:00Z'),
        tz: 'UTC',
      });
      // Jan 31 (Wed) first; Feb is skipped; Mar 31 is Sun -> Fri 29
      expect(day(forward.next())).toEqual('2024-01-31');
      expect(day(forward.next())).toEqual('2024-03-29');
      expect(day(forward.next())).toEqual('2024-05-31');

      const backward = CronExpressionParser.parse('0 0 0 31W * ?', {
        currentDate: new Date('2024-03-01T00:00:00Z'),
        tz: 'UTC',
      });
      // Jan 31 (Wed); Feb is skipped
      expect(day(backward.prev())).toEqual('2024-01-31');
      expect(day(backward.prev())).toEqual('2023-12-29'); // Dec 31 Sun -> Fri 29
    });
  });

  describe('next() with "LW"', () => {
    test('LW resolves to the last weekday (Mon-Fri) of every month at 18:00', () => {
      const interval = CronExpressionParser.parse('0 0 18 LW * ?', {
        currentDate: new Date('2024-01-01T00:00:00Z'),
        tz: 'UTC',
      });
      // Jan 31 Wed; Feb 29 Thu; Mar 31 Sun -> Fri Mar 29; Apr 30 Tue; May 31 Fri;
      // Jun 30 Sun -> Fri Jun 28
      expect(interval.take(6).map((date) => date.toISOString())).toEqual([
        '2024-01-31T18:00:00.000Z',
        '2024-02-29T18:00:00.000Z',
        '2024-03-29T18:00:00.000Z',
        '2024-04-30T18:00:00.000Z',
        '2024-05-31T18:00:00.000Z',
        '2024-06-28T18:00:00.000Z',
      ]);
    });

    test('LW handles a Saturday last day by firing on Friday the 30th', () => {
      const interval = CronExpressionParser.parse('0 0 0 LW * ?', {
        currentDate: new Date('2024-08-01T00:00:00Z'),
        tz: 'UTC',
      });
      // Aug 31 2024 is Sat -> Fri Aug 30; Nov 30 2024 is Sat -> Fri Nov 29
      expect(interval.next().toISOString()).toEqual('2024-08-30T00:00:00.000Z');
      expect(interval.next().toISOString()).toEqual('2024-09-30T00:00:00.000Z');
      expect(interval.next().toISOString()).toEqual('2024-10-31T00:00:00.000Z');
      expect(interval.next().toISOString()).toEqual('2024-11-29T00:00:00.000Z');
    });
  });

  describe('prev()', () => {
    test('prev() yields the previous nearest weekday and round-trips with next()', () => {
      const expression = '0 0 9 15W * ?';
      const interval = CronExpressionParser.parse(expression, {
        currentDate: new Date('2024-06-10T00:00:00Z'),
        tz: 'UTC',
      });
      expect(interval.next().toISOString()).toEqual('2024-06-14T09:00:00.000Z'); // Fri
      expect(interval.prev().toISOString()).toEqual('2024-05-15T09:00:00.000Z'); // Wed
      expect(interval.next().toISOString()).toEqual('2024-06-14T09:00:00.000Z');
    });

    test('prev() works for LW, including months ending on a weekend', () => {
      const interval = CronExpressionParser.parse('0 0 18 LW * ?', {
        currentDate: new Date('2024-07-01T00:00:00Z'),
        tz: 'UTC',
      });
      expect(interval.prev().toISOString()).toEqual('2024-06-28T18:00:00.000Z'); // Jun 30 Sun -> Fri 28
      expect(interval.next().toISOString()).toEqual('2024-07-31T18:00:00.000Z');
    });

    test('take() supports negative iteration for W expressions', () => {
      const interval = CronExpressionParser.parse('0 0 0 1W * ?', {
        currentDate: new Date('2025-03-03T00:00:00Z'),
        tz: 'UTC',
      });
      expect(interval.take(-3).map(day)).toEqual(['2025-02-03', '2025-01-01', '2024-12-02']);
    });
  });

  describe('hasNext() and hasPrev()', () => {
    test('report a next and previous schedule for W expressions', () => {
      const interval = CronExpressionParser.parse('0 0 9 15W * ?', {
        currentDate: new Date('2024-06-10T00:00:00Z'),
      });
      expect(interval.hasNext()).toBeTruthy();
      expect(interval.hasPrev()).toBeTruthy();
    });

    test('hasNext() does not advance the iterator state', () => {
      const interval = CronExpressionParser.parse('0 0 9 15W * ?', {
        currentDate: new Date('2024-06-10T00:00:00Z'),
      });
      interval.hasNext();
      expect(interval.next().toISOString()).toEqual('2024-06-14T09:00:00.000Z');
    });

    test('return false outside of the configured time span', () => {
      const interval = CronExpressionParser.parse('0 0 9 LW * ?', {
        currentDate: new Date('2024-06-29T00:00:00Z'),
        endDate: new Date('2024-06-29T00:00:00Z'),
      });
      expect(interval.hasNext()).toBeFalsy();
    });
  });

  describe('includesDate()', () => {
    test('matches only the resolved nearest weekday for 15W', () => {
      const interval = CronExpressionParser.parse('0 0 9 15W * ?', { tz: 'UTC' });
      // June 2024: 15th is a Saturday, so the schedule fires Friday the 14th
      expect(interval.includesDate(new Date('2024-06-14T09:00:00Z'))).toBeTruthy();
      expect(interval.includesDate(new Date('2024-06-15T09:00:00Z'))).toBeFalsy();
      expect(interval.includesDate(new Date('2024-06-13T09:00:00Z'))).toBeFalsy();
      // Wrong hour on the right day
      expect(interval.includesDate(new Date('2024-06-14T10:00:00Z'))).toBeFalsy();
      // September 2024: 15th is a Sunday, so the schedule fires Monday the 16th
      expect(interval.includesDate(new Date('2024-09-16T09:00:00Z'))).toBeTruthy();
      expect(interval.includesDate(new Date('2024-09-15T09:00:00Z'))).toBeFalsy();
    });

    test('matches only the last weekday of the month for LW', () => {
      const interval = CronExpressionParser.parse('0 0 18 LW * ?', { tz: 'UTC' });
      expect(interval.includesDate(new Date('2024-06-28T18:00:00Z'))).toBeTruthy(); // Fri
      expect(interval.includesDate(new Date('2024-06-30T18:00:00Z'))).toBeFalsy(); // Sun
      expect(interval.includesDate(new Date('2024-06-27T18:00:00Z'))).toBeFalsy(); // Thu
    });

    test('is consistent with next() for the resolved dates', () => {
      const interval = CronExpressionParser.parse('30 15 10 1W * ?', {
        currentDate: new Date('2025-01-01T00:00:00Z'),
        tz: 'UTC',
      });
      interval.take(12).forEach((date) => {
        expect(interval.includesDate(date.toDate())).toBeTruthy();
      });
    });
  });

  describe('stringify()', () => {
    test('preserves the W modifier and round-trips through parse()', () => {
      for (const expression of ['0 0 9 15W * ?', '0 0 18 LW * ?', '0 30 7 1W * ?']) {
        const parsed = CronExpressionParser.parse(expression);
        const stringified = parsed.stringify(true);
        expect(stringified).toEqual(expression);
        expect(CronExpressionParser.parse(stringified).stringify(true)).toEqual(expression);
      }
    });
  });

  describe('timezone support', () => {
    test('resolves weekdays and wall-clock time in Asia/Tokyo', () => {
      const interval = CronExpressionParser.parse('0 0 9 15W * ?', {
        currentDate: new Date('2024-06-01T00:00:00Z'),
        tz: 'Asia/Tokyo',
      });
      // Fri Jun 14 2024 09:00 JST (UTC+9)
      expect(interval.next().toISOString()).toEqual('2024-06-14T00:00:00.000Z');

      const lastWeekday = CronExpressionParser.parse('0 0 18 LW * ?', {
        currentDate: new Date('2024-06-01T00:00:00Z'),
        tz: 'Asia/Tokyo',
      });
      // Fri Jun 28 2024 18:00 JST
      expect(lastWeekday.next().toISOString()).toEqual('2024-06-28T09:00:00.000Z');
    });

    test('includesDate() evaluates the date in the configured timezone', () => {
      const interval = CronExpressionParser.parse('0 0 9 15W * ?', { tz: 'Asia/Tokyo' });
      // 2024-06-14 09:00 JST
      expect(interval.includesDate(new Date('2024-06-14T00:00:00Z'))).toBeTruthy();
      // 2024-06-13 09:00 JST is the Thursday before
      expect(interval.includesDate(new Date('2024-06-13T00:00:00Z'))).toBeFalsy();
    });
  });

  describe('invalid W combinations', () => {
    const invalidExpressions = [
      '0 0 9 1W,15W * ?', // W combined with another list entry
      '0 0 9 1W,15 * ?', // W combined with a plain day
      '0 0 9 15,1W * ?', // plain day followed by W
      '0 0 9 1-15W * ?', // W applied to a range
      '0 0 9 15W/2 * ?', // W applied to a step
      '0 0 9 *W * ?', // W with a wildcard
      '0 0 9 ?W * ?', // W with a question mark
      '0 0 9 W * ?', // bare W
      '0 0 9 15WW * ?', // duplicated W
      '0 0 9 WL * ?', // reversed LW
      '0 0 9 L1W * ?', // W on an L offset
      '0 0 9 32W * ?', // day out of range
      '0 0 9 0W * ?', // day below range
    ];

    invalidExpressions.forEach((expression) => {
      test(`throws a clear error for ${expression}`, () => {
        expect(() => CronExpressionParser.parse(expression)).toThrow(/'W' modifier/);
      });
    });

    test('throws when W is combined with a restricted day of week', () => {
      expect(() => CronExpressionParser.parse('0 0 9 15W * 1')).toThrow(
        "cannot specify 'W' in dayOfMonth together with a dayOfWeek expression",
      );
      expect(() => CronExpressionParser.parse('0 0 9 LW * 1-5')).toThrow(
        "cannot specify 'W' in dayOfMonth together with a dayOfWeek expression",
      );
    });

    test('throws at parse time when no allowed month contains the W target day', () => {
      expect(() => CronExpressionParser.parse('0 0 0 31W 2 ?')).toThrow('no allowed month has a day 31'); // February never has 31 days
      expect(() => CronExpressionParser.parse('0 0 0 30W 2 ?')).toThrow('no allowed month has a day 30'); // February never has 30 days
      expect(() => CronExpressionParser.parse('0 0 0 31W 2,4 ?')).toThrow('no allowed month has a day 31'); // neither February nor April has 31 days
    });

    test('throws when W is used outside the day-of-month field', () => {
      expect(() => CronExpressionParser.parse('0 0W * * * *')).toThrow('Invalid characters');
      expect(() => CronExpressionParser.parse('0 * * * * 1W')).toThrow('Invalid characters');
    });
  });

  describe('CronDayOfMonth field', () => {
    const parseField = (expression: string) => CronExpressionParser.parse(expression).fields.dayOfMonth;

    test('exposes the W modifiers through its getters', () => {
      const nearestWeekday = parseField('0 0 9 15W * ?');
      expect(nearestWeekday.hasWeekdayChar).toBeTruthy();
      expect(nearestWeekday.isLastWeekday).toBeFalsy();

      const lastWeekday = parseField('0 0 18 LW * ?');
      expect(lastWeekday.hasWeekdayChar).toBeTruthy();
      expect(lastWeekday.isLastWeekday).toBeTruthy();

      const plain = parseField('0 0 9 15 * ?');
      expect(plain.hasWeekdayChar).toBeFalsy();
      expect(plain.isLastWeekday).toBeFalsy();
    });

    test('nearestWeekdayInMonth resolves <day>W and LW for a given month', () => {
      // March 2024: the 15th is a Friday; the 31st is a Sunday (LW -> 29)
      const march = new CronDate(new Date(2024, 2, 1));
      expect(parseField('0 0 9 15W * ?').nearestWeekdayInMonth(march)).toBe(15);
      expect(parseField('0 0 18 LW * ?').nearestWeekdayInMonth(march)).toBe(29);

      // February 2024 (leap): 29th is Thursday, LW -> 29; 30W does not exist
      const february = new CronDate(new Date(2024, 1, 1));
      expect(parseField('0 0 0 29W * ?').nearestWeekdayInMonth(february)).toBe(29);
      expect(parseField('0 0 0 30W * ?').nearestWeekdayInMonth(february)).toBeNull();
    });

    test('constructing a field directly with an invalid W value throws', () => {
      expect(() => new CronDayOfMonth([15], { rawValue: '15W,16' })).toThrow(/'W' modifier/);
      expect(() => new CronDayOfMonth(['L' as any], { rawValue: 'WL' })).toThrow(/'W' modifier/);
    });

    test('exposes the numeric target of <day>W and null for LW and plain days', () => {
      expect(parseField('0 0 9 15W * ?').weekdayTarget).toBe(15);
      expect(parseField('0 0 18 LW * ?').weekdayTarget).toBeNull();
      expect(parseField('0 0 9 L * ?').weekdayTarget).toBeNull();
      expect(parseField('0 0 9 15 * ?').weekdayTarget).toBeNull();
    });

    test('29W is accepted for February (leap years) while 30W/31W are not', () => {
      expect(() => CronExpressionParser.parse('0 0 0 29W 2 ?')).not.toThrow();
      expect(() => CronExpressionParser.parse('0 0 0 LW 2 ?')).not.toThrow();
      expect(() => CronExpressionParser.parse('0 0 0 30W 4 ?')).not.toThrow();
    });
  });

  describe('existing L and # behavior is unchanged', () => {
    test('plain L still resolves to the last day of the month', () => {
      const interval = CronExpressionParser.parse('0 0 0 L * ?', {
        currentDate: new Date('2024-02-01T00:00:00Z'),
        tz: 'UTC',
      });
      expect(day(interval.next())).toEqual('2024-02-29');
      expect(day(interval.next())).toEqual('2024-03-31');
    });

    test('nth weekday # syntax still resolves independently of W support', () => {
      const interval = CronExpressionParser.parse('0 0 9 ? * 2#1', {
        currentDate: new Date('2024-06-01T00:00:00Z'),
        tz: 'UTC',
      });
      expect(interval.next().toISOString()).toEqual('2024-06-04T09:00:00.000Z');
    });
  });
});
