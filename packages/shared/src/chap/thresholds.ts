import type {
    PercentileParams,
    SeasonalParams,
    ThresholdResponse,
} from '../chap-api'
// Explicit extension so `node --test` can load this module's tests directly
import { canonicalizePeriodId } from '../charts/periods.ts'

/** Which of an entry's `values` is the upper (alert) line, and the lower one */
export type ThresholdLineRoles = {
    upperIndex: number
    lowerIndex?: number
}

/** orgUnit → canonical period id → upper threshold */
export type ThresholdMap = Map<string, Map<string, number>>

const getLineParameter = (
    params: SeasonalParams | PercentileParams
): number | Array<number> | undefined => {
    if ('quantile' in params && params.quantile !== undefined) {
        return params.quantile
    }
    if ('stdMultiplier' in params && params.stdMultiplier !== undefined) {
        return params.stdMultiplier
    }
    return undefined
}

/**
 * Work out which line of a threshold entry is the alert threshold.
 *
 * A request can ask for several lines at once (`quantile: [0.25, 0.75]` is the
 * endemic channel's band), and each entry's `values` follow the order of that
 * list. Derive the roles from the params the *response* echoes back, never
 * from the params that were requested: a response in flight belongs to the
 * previous request, and reading it with the new roles silently mislabels
 * which line is the threshold.
 */
export const getThresholdLineRoles = (
    params: SeasonalParams | PercentileParams
): ThresholdLineRoles => {
    const lineParameter = getLineParameter(params)
    if (!Array.isArray(lineParameter) || lineParameter.length < 2) {
        return { upperIndex: 0 }
    }

    let lowerIndex = 0
    let upperIndex = 0
    lineParameter.forEach((value, index) => {
        if (value < lineParameter[lowerIndex]) {
            lowerIndex = index
        }
        if (value > lineParameter[upperIndex]) {
            upperIndex = index
        }
    })

    return lowerIndex === upperIndex
        ? { upperIndex }
        : { lowerIndex, upperIndex }
}

/**
 * Index a threshold response for lookup by org unit and period.
 *
 * Periods are keyed on their canonical id, since CHAP can spell the same week
 * differently in a prediction and in a threshold response. Entries whose line
 * could not be computed — an org unit with no usable history — are left out,
 * so a missing key means "no threshold", never "threshold of zero".
 */
export const buildThresholdMap = (
    response: ThresholdResponse
): ThresholdMap => {
    const { upperIndex } = getThresholdLineRoles(response.params)
    const map: ThresholdMap = new Map()

    for (const entry of response.entries) {
        const threshold = entry.values[upperIndex]
        if (typeof threshold !== 'number' || !Number.isFinite(threshold)) {
            continue
        }
        let perPeriod = map.get(entry.location)
        if (!perPeriod) {
            perPeriod = new Map()
            map.set(entry.location, perPeriod)
        }
        perPeriod.set(canonicalizePeriodId(entry.period), threshold)
    }

    return map
}
