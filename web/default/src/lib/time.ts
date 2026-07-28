/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
/**
 * Time utility functions for consistent time handling across the application
 */
import dayjs from '@/lib/dayjs'

/**
 * Time granularity type
 */
export type TimeGranularity = 'hour' | 'day' | 'week'

/**
 * Convert Date object to Unix timestamp (seconds)
 */
export function dateToUnixTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000)
}

/**
 * Get start of day for a Unix timestamp (seconds)
 * Sets time to 00:00:00
 */
export function toStartOfDay(tsSec: number): number {
  const d = new Date(tsSec * 1000)
  d.setHours(0, 0, 0, 0)
  return Math.floor(d.getTime() / 1000)
}

/**
 * Get start of day for a Date object
 * Returns new Date with time set to 00:00:00
 */
export function getStartOfDay(date: Date = new Date()): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Get end of day for a Date object
 * Returns new Date with time set to 23:59:59.999
 */
export function getEndOfDay(date: Date = new Date()): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

/**
 * Calculate date range with start and end of day normalization
 * @param days Number of days to go back
 * @param fromDate Starting point (defaults to now)
 * @returns Object with normalized start (00:00:00) and end (23:59:59) dates
 */
export function getNormalizedDateRange(
  days: number,
  fromDate: Date = new Date()
): { start: Date; end: Date } {
  const end = new Date(fromDate)
  const start = new Date(fromDate)
  start.setDate(end.getDate() - days)

  return {
    start: getStartOfDay(start),
    end: getEndOfDay(end),
  }
}

/**
 * Calculate a rolling date range ending at the current moment.
 * Example: 1 day means the last 24 hours, not yesterday 00:00 to today 23:59.
 */
export function getRollingDateRange(
  days: number,
  fromDate: Date = new Date()
): { start: Date; end: Date } {
  const end = new Date(fromDate)
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)

  return { start, end }
}

/**
 * Compute time range as Unix timestamps (seconds)
 * @param days Default number of days if no dates provided
 * @param startDate Optional start date
 * @param endDate Optional end date
 * @param useStartOfDay Whether to normalize to start/end of day
 * @returns Object with start_timestamp and end_timestamp in seconds
 */
export function computeTimeRange(
  days: number,
  startDate?: Date,
  endDate?: Date,
  useStartOfDay = false
): { start_timestamp: number; end_timestamp: number } {
  const now = Math.floor(Date.now() / 1000)

  if (useStartOfDay) {
    const defaultEnd = toStartOfDay(now)
    const end = endDate
      ? toStartOfDay(dateToUnixTimestamp(endDate))
      : defaultEnd
    const start = startDate
      ? toStartOfDay(dateToUnixTimestamp(startDate))
      : end - days * 24 * 3600

    return {
      start_timestamp: start,
      end_timestamp: end + 24 * 3600 - 1, // End of day
    }
  }

  // Normal mode without day normalization
  // Round end time up to the next whole hour so the current hour's
  // data bucket is fully covered.  The backend truncates created_at
  // to the hour, so requesting up to the *next* hour boundary
  // guarantees the current hour's bucket is included without
  // fetching a non-existent future bucket.
  const end = endDate ? dateToUnixTimestamp(endDate) : now + 3600 - (now % 3600)
  const start = startDate
    ? dateToUnixTimestamp(startDate)
    : end - days * 24 * 3600

  return { start_timestamp: start, end_timestamp: end }
}

/**
 * Format Unix timestamp (seconds) to YYYY-MM-DD
 */
export function formatDate(tsSec: number): string {
  return dayjs(tsSec * 1000).format('YYYY-MM-DD')
}

/**
 * Format Date object to YYYY-MM-DD HH:mm:ss
 */
export function formatDateTimeObject(date: Date): string {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

/**
 * Format timestamp for chart display based on time granularity.
 *
 * For 'week' granularity the label must be stable for every day within
 * the same ISO week, otherwise the chart would create one bucket per
 * day-of-week instead of one bucket per actual week.  We anchor every
 * week key to the Monday of its ISO week, so Monday–Sunday all produce
 * the identical "MM-DD - MM-DD" label.
 *
 * @param timestamp Unix timestamp in seconds
 * @param granularity Time granularity: 'hour', 'day', or 'week'
 * @returns Formatted string suitable for chart axis
 */
export function formatChartTime(
  timestamp: number,
  granularity: TimeGranularity = 'day'
): string {
  const d = dayjs(timestamp * 1000)

  if (granularity === 'hour') {
    return d.format('MM-DD HH:00')
  }

  if (granularity === 'week') {
    // Anchor to the Monday of the ISO week so that every day in the
    // same week produces the exact same label (e.g. "06-23 - 06-29").
    const monday = d.startOf('isoWeek')
    const sunday = monday.add(6, 'day')
    return `${monday.format('MM-DD')} - ${sunday.format('MM-DD')}`
  }

  return d.format('MM-DD')
}

/**
 * Add time duration to a date
 * @param months Number of months to add
 * @param days Number of days to add
 * @param hours Number of hours to add
 * @param baseDate Base date to add time to (defaults to now)
 * @returns New date with added time, or undefined if all parameters are 0
 */
export function addTimeToDate(
  months: number,
  days: number,
  hours: number,
  baseDate: Date = new Date()
): Date | undefined {
  if (months === 0 && days === 0 && hours === 0) {
    return undefined
  }

  const result = new Date(baseDate)
  result.setMonth(result.getMonth() + months)
  result.setDate(result.getDate() + days)
  result.setHours(result.getHours() + hours)

  return result
}
