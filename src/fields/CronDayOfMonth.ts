import { CronDate } from '../CronDate';
import { CronField, CronFieldOptions } from './CronField';
import { CronChars, CronMax, CronMin, DayOfMonthRange } from './types';

const MIN_DAY = 1;
const MAX_DAY = 31;
const DAY_CHARS = Object.freeze(['L', 'W']) as CronChars[];

/**
 * Represents the "day of the month" field within a cron expression.
 * @class CronDayOfMonth
 * @extends CronField
 */
export class CronDayOfMonth extends CronField {
  static get min(): CronMin {
    return MIN_DAY;
  }

  static get max(): CronMax {
    return MAX_DAY;
  }

  static get chars(): CronChars[] {
    return DAY_CHARS;
  }
  static get validChars(): RegExp {
    return /^[?,*\dLWH/-]+$|^.*H\(\d+-\d+\)\/\d+.*$|^.*H\(\d+-\d+\).*$|^.*H\/\d+.*$/;
  }
  /**
   * CronDayOfMonth constructor. Initializes the "day of the month" field with the provided values.
   * @param {DayOfMonthRange[]} values - Values for the "day of the month" field
   * @param {CronFieldOptions} [options] - Options provided by the parser
   * @throws {Error} if validation fails
   */
  constructor(values: DayOfMonthRange[], options?: CronFieldOptions) {
    super(values, options);
    this.validate();
  }

  /**
   * Indicates whether this field uses the Quartz "W" nearest-weekday modifier
   * (`<day>W`, e.g. `15W`) or the `LW` "last weekday of the month" modifier.
   * @returns {boolean}
   */
  get hasWeekdayChar(): boolean {
    return this.options.rawValue.includes('W');
  }

  /**
   * Indicates whether this field is the `LW` "last weekday of the month" expression.
   * @returns {boolean}
   */
  get isLastWeekday(): boolean {
    return this.hasWeekdayChar && this.hasLastChar;
  }

  /**
   * Returns an array of allowed values for the "day of the month" field.
   * @returns {DayOfMonthRange[]}
   */
  get values(): DayOfMonthRange[] {
    return super.values as DayOfMonthRange[];
  }

  /**
   * Returns the numeric target day of a `<day>W` expression (e.g. 15 for
   * `15W`), or null for `LW` and expressions without the "W" modifier.
   * @returns {number | null}
   */
  get weekdayTarget(): number | null {
    if (this.hasWeekdayChar && !this.isLastWeekday) {
      return parseInt(this.values[0] as string, 10);
    }
    return null;
  }

  /**
   * Returns the day of month that a `W` expression resolves to for the given
   * date's month and year, following Quartz semantics: the weekday (Mon-Fri)
   * nearest to the specified day, never crossing a month boundary. For `LW`
   * the target day is the last day of the month.
   *
   * @param {CronDate} date - Date providing the month and year to resolve in
   * @returns {number | null} The resolved day of month, or null when a
   *   `<day>W` target does not exist in a short month (e.g. `31W` in February)
   */
  nearestWeekdayInMonth(date: CronDate): number | null {
    // For "<day>W" the parser keeps the raw atom (e.g. "15W") in values;
    // for "LW" the anchor is the last day of the month.
    const target = this.isLastWeekday ? date.daysInMonth() : parseInt(this.values[0] as string, 10);
    return date.getNearestWeekdayOfMonth(target);
  }

  /**
   * Validates the field values against the allowed range and special characters.
   * In addition to the base checks, enforces the Quartz restrictions on the "W"
   * modifier: it may only be used on its own as `<day>W` (1-31) or as `LW`, and
   * cannot be combined with lists, ranges, steps or wildcards.
   * @throws {Error} if validation fails
   */
  validate(): void {
    if (this.hasWeekdayChar) {
      const rawValue = this.options.rawValue;
      // The parser strips "?" / "*" wildcards into numeric ranges before constructing
      // the field, so they can only reach validation through the raw value.
      const isStandaloneNearestWeekday = /^(?:0?[1-9]|[12]\d|3[01])W$/.test(rawValue);
      const isLastWeekday = rawValue === 'LW';
      if (!isStandaloneNearestWeekday && !isLastWeekday) {
        throw new Error(
          `${this.constructor.name} Validation error, the 'W' modifier is only supported as '<day>W' (1-31) or 'LW', got value: ${rawValue}`,
        );
      }
      // The base validation only accepts single special chars (e.g. "L"), not
      // multi-character modifiers such as "LW"; the parsed numeric value of a
      // valid "<day>W" is already covered by the regex above.
      return;
    }

    super.validate();
  }
}
