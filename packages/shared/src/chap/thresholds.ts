import type { ThresholdResponse } from '../chap-api'
// Explicit extension so `node --test` can load this module's tests directly
import { canonicalizePeriodId } from '../charts/periods.ts'

/** Which of an entry's `values` is the upper (alert) line, and the lower one */
export type ThresholdLineRoles = {
    upperIndex: number
    lowerIndex?: number
}

/** orgUnit → canonical period id → upper threshold */
export type ThresholdMap = Map<string, Map<string, number>>

/**
 * Work out which line of a threshold entry is the alert threshold.
 *
 * A request can ask for several lines at once (`quantile: [0.25, 0.75]` is the
 * endemic channel's band), and the response's `lines` states the parameter
 * value behind each position of every entry's `values`. Derive the roles from
 * the *response*, never from the params that were requested: a response in
 * flight belongs to the previous request, and reading it with the new roles
 * silently mislabels which line is the threshold.
 */
export const getThresholdLineRoles = (
    lines: Array<number>
): ThresholdLineRoles => {
    if (lines.length < 2) {
        return { upperIndex: 0 }
    }

    let lowerIndex = 0
    let upperIndex = 0
    lines.forEach((value, index) => {
        if (value < lines[lowerIndex]) {
            lowerIndex = index
        }
        if (value > lines[upperIndex]) {
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
    const { upperIndex } = getThresholdLineRoles(response.lines)
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
