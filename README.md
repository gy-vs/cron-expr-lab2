# cron-parser

Run tests: `npm run build && TZ=UTC npx jest`

## Quartz-compatible `W` modifier (day of month)

The day-of-month field supports the Quartz `W` modifier: `<day>W` (e.g. `15W`) fires on the weekday (Monday–Friday) nearest to that day of the month, never crossing a month boundary — so `1W` on a Saturday moves to Monday the 3rd rather than the previous month, and a Sunday on the last day moves back to Friday. `LW` fires on the last weekday of the month (e.g. `0 0 18 LW * ?`). Workdays are always Monday–Friday with no holiday calendar; `W` cannot be combined with lists, ranges, steps, wildcards, or a day-of-week restriction, and such expressions are rejected at parse time.
