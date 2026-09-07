/**
 * Minimal DHIS2 period-id helpers. CHAP returns consistent period ids per
 * dataset (all monthly `YYYYMM` or all weekly `YYYYWn`), so lexicographic /
 * numeric-aware sorting is sufficient here — no full period engine needed.
 */

const MONTH_LABELS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
]

const stripLeadingZeroes = (value: string): string =>
    value.replace(/^0+(?=\d)/, '')

/**
 * Normalize a period id so ids that name the same period compare equal.
 * CHAP and DHIS2 can spell the same week `2024W3` or `2024W03`, and matching
 * predictions against per-period thresholds on the raw ids silently loses
 * every row. Monthly and unrecognized ids are returned trimmed and unchanged.
 */
export const canonicalizePeriodId = (periodId: string): string => {
    const trimmed = periodId.trim()

    const weekly = /^(\d{4})([A-Z][a-z]{2})?W0*(\d+)$/.exec(trimmed)
    if (weekly) {
        const [, year, startDay = '', week] = weekly
        return `${year}${startDay}W${stripLeadingZeroes(week)}`
    }

    const biWeekly = /^(\d{4})BiW0*(\d+)$/.exec(trimmed)
    if (biWeekly) {
        return `${biWeekly[1]}BiW${stripLeadingZeroes(biWeekly[2])}`
    }

    return trimmed
}

export const comparePeriods = (a: string, b: string): number =>
    a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' })

/** Deduplicates and sorts period ids into chart-axis order */
export const buildChartPeriods = (periodIds: Iterable<string>): string[] =>
    Array.from(new Set(periodIds)).sort(comparePeriods)

/** `202401` → `Jan 2024`, `2024W5` → `2024 W5`, anything else → as-is */
export const formatPeriodLabel = (periodId: string): string => {
    const monthly = /^(\d{4})(\d{2})$/.exec(periodId)
    if (monthly) {
        const monthIndex = Number(monthly[2]) - 1
        if (monthIndex >= 0 && monthIndex < 12) {
            return `${MONTH_LABELS[monthIndex]} ${monthly[1]}`
        }
    }
    const weekly = /^(\d{4})W(\d{1,2})$/.exec(periodId)
    if (weekly) {
        return `${weekly[1]} W${weekly[2]}`
    }
    return periodId
}
