# cron-parser

Run tests: `npm run build && TZ=UTC npx jest`

## Quartz "W" day-of-month modifier

In the day-of-month field, a specific day followed by `W` (e.g. `15W`) fires on
the weekday (Monday–Friday) nearest to that day without leaving the month: a
weekend day moves to the adjacent Friday or Monday, and a month that does not
contain the day is skipped. `LW` fires on the last weekday of the month (e.g.
`0 0 18 LW * ?`). The `W` modifier cannot be combined with lists, ranges, steps
or other special characters; such expressions fail to parse.
