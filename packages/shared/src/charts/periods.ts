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
