/**
 * How each org unit's forecast sits against its own endemic threshold. Pure,
 * so it carries unit tests of its own — the table's whole message is decided
 * here. Value imports would make `node --test` load the shared package's JSX,
 * so keep every import in this module type-only.
 */
import type { QuantileEntry } from '@chap-widgets/shared'

const MEDIAN_QUANTILE = 0.5
const UPPER_QUANTILE = 0.9

export type AlertStatus =
    /** Predicted median is at or above the threshold */
    | 'above'
    /** Median is under, but the 90th percentile crosses the threshold */
    | 'possible'
    /** The whole prediction interval stays under the threshold */
    | 'below'
    /** No threshold could be computed (the org unit has no usable history) */
    | 'no-threshold'

export type OrgUnitAlert = {
    orgUnitId: string
    /** The period driving the status: the worst the forecast window gets */
    period: string
    /** Predicted median in that period */
    median: number
    /** Endemic threshold for that org unit and period */
    threshold: number | null
    /** median ÷ threshold, or null when there is nothing to divide by */
    ratio: number | null
    status: AlertStatus
}

/** Endemic threshold for one (org unit, period), or undefined when there is none */
export type ThresholdLookup = (
    orgUnit: string,
    period: string
) => number | undefined

const STATUS_RANK: Record<AlertStatus, number> = {
    above: 3,
    possible: 2,
    below: 1,
    'no-threshold': 0,
}

/**
 * Most alarming first: status, then how far over the threshold, then size.
 * Comparing ratios rather than raw cases is the point of a per-org-unit
 * threshold — a small district 3× over its baseline outranks a big one that
 * is merely busy.
 */
const compareSeverity = (a: OrgUnitAlert, b: OrgUnitAlert): number =>
    STATUS_RANK[b.status] - STATUS_RANK[a.status] ||
    (b.ratio ?? 0) - (a.ratio ?? 0) ||
    b.median - a.median ||
    a.orgUnitId.localeCompare(b.orgUnitId)

/**
 * Classify one period's forecast against its threshold.
 *
 * A zero or negative threshold cannot produce a meaningful multiple, so any
 * predicted cases there are an alert without a ratio rather than a division
 * by zero; no predicted cases against a zero threshold is not an outbreak.
 */
const classify = (
    forecast: { median: number; high: number },
    threshold: number | undefined
): Pick<OrgUnitAlert, 'status' | 'ratio' | 'threshold'> => {
    if (threshold === undefined || !Number.isFinite(threshold)) {
        return { status: 'no-threshold', ratio: null, threshold: null }
    }
    if (threshold <= 0) {
        return {
            status: forecast.median > 0 ? 'above' : 'below',
            ratio: null,
            threshold,
        }
    }
    const ratio = forecast.median / threshold
    if (forecast.median >= threshold) {
        return { status: 'above', ratio, threshold }
    }
    return {
        status: forecast.high >= threshold ? 'possible' : 'below',
        ratio,
        threshold,
    }
}

const collectForecasts = (
    entries: QuantileEntry[]
): Map<string, Map<string, { median: number; high: number }>> => {
    const byOrgUnit = new Map<
        string,
        Map<string, { median: number; high: number }>
    >()
    for (const entry of entries) {
        if (
            entry.quantile !== MEDIAN_QUANTILE &&
            entry.quantile !== UPPER_QUANTILE
        ) {
            continue
        }
        let periods = byOrgUnit.get(entry.orgUnit)
        if (!periods) {
            periods = new Map()
            byOrgUnit.set(entry.orgUnit, periods)
        }
        const forecast = periods.get(entry.period) ?? { median: NaN, high: NaN }
        if (entry.quantile === MEDIAN_QUANTILE) {
            forecast.median = entry.value
        } else {
            forecast.high = entry.value
        }
        periods.set(entry.period, forecast)
    }
    return byOrgUnit
}

/**
 * One row per org unit — the worst period of its forecast window, judged
 * against that org unit's own threshold for that period — most alarming first.
 * Org units whose median the prediction never reports are left out entirely.
 */
export const buildAlerts = (
    entries: QuantileEntry[],
    lookupThreshold: ThresholdLookup
): OrgUnitAlert[] => {
    const alerts: OrgUnitAlert[] = []

    for (const [orgUnitId, periods] of collectForecasts(entries)) {
        let worst: OrgUnitAlert | undefined
        for (const [period, forecast] of periods) {
            if (!Number.isFinite(forecast.median)) {
                continue
            }
            const high = Number.isFinite(forecast.high)
                ? forecast.high
                : forecast.median
            const candidate: OrgUnitAlert = {
                orgUnitId,
                period,
                median: forecast.median,
                ...classify(
                    { median: forecast.median, high },
                    lookupThreshold(orgUnitId, period)
                ),
            }
            if (!worst || compareSeverity(candidate, worst) < 0) {
                worst = candidate
            }
        }
        if (worst) {
            alerts.push(worst)
        }
    }

    return alerts.sort(compareSeverity)
}
