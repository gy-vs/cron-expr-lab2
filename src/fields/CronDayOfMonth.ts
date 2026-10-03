import { CronField, CronFieldOptions } from './CronField';
import { CronChars, CronMax, CronMin, DayOfMonthRange } from './types';

const MIN_DAY = 1;
const MAX_DAY = 31;
const DAY_CHARS = Object.freeze(['L']) as CronChars[];

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
   * Returns an array of allowed values for the "day of the month" field.
   * @returns {DayOfMonthRange[]}
   */
  get values(): DayOfMonthRange[] {
    return super.values as DayOfMonthRange[];
  }

  /**
   * Indicates whether the field uses the Quartz "W" modifier ("nearest weekday").
   * When true, the field contains a single day ("15W") or "LW", and the actual
   * firing day is the weekday (Monday-Friday) nearest to that day within the same month.
   * @returns {boolean}
   */
  get nearestWeekday(): boolean {
    return this.options.nearestWeekday === true;
  }

  /**
   * Validates the field values against the allowed range and special characters.
   * @throws {Error} if validation fails
   */
  validate(): void {
    super.validate();
    if (
      this.nearestWeekday &&
      (this.values.length !== 1 || (typeof this.values[0] === 'string' && this.values[0] !== 'L'))
    ) {
      throw new Error(
        `${this.constructor.name} Validation error, the "W" modifier can only be applied to a single day (e.g. "15W") or to "LW"`,
      );
    }
  }
}
