/**
 * How a single (org unit, period) forecast sits against its endemic
 * threshold. Pure, so it carries unit tests of its own — the map's whole
 * message is decided here. Value imports would make `node --test` load the
 * shared package's JSX, so keep every import in this module type-only.
 */
import type { OrgUnitStats } from '@chap-widgets/shared'

/**
 * Lower bound of each colour class, as a multiple of the threshold. The last
 * class is open-ended. Fixed rather than derived from the data so the legend
 * means the same thing on every period, prediction and dashboard.
 */
export const RATIO_BREAKS = [1, 1.25, 1.5, 2, 3]

export type ExceedanceStatus =
    /** Predicted median is at or above the threshold */
    | 'above'
    /** Median is under, but the 90th percentile crosses the threshold */
    | 'possible'
    /** Whole prediction interval stays under the threshold */
    | 'below'
    /** No threshold could be computed (the org unit has no usable history) */
    | 'no-threshold'
    /** The prediction has no entry for this org unit and period */
    | 'no-prediction'

export type Exceedance = {
    status: ExceedanceStatus
    /** median ÷ threshold, or null when there is nothing to divide by */
    ratio: number | null
    /** Index into {@link RATIO_BREAKS}, or null when not above the threshold */
    classIndex: number | null
}

const classIndexForRatio = (ratio: number): number => {
    let index = 0
    for (let i = 1; i < RATIO_BREAKS.length; i++) {
        if (ratio >= RATIO_BREAKS[i]) {
            index = i
        }
    }
    return index
}

/**
 * Classify a forecast against its threshold.
 *
 * A zero or negative threshold cannot produce a meaningful multiple, so any
 * predicted cases there land in the top class rather than dividing by zero;
 * no predicted cases against a zero threshold is not an outbreak.
 */
export const classifyExceedance = (
    stats: OrgUnitStats | undefined,
    threshold: number | undefined
): Exceedance => {
    if (!stats) {
        return { status: 'no-prediction', ratio: null, classIndex: null }
    }
    if (threshold === undefined || !Number.isFinite(threshold)) {
        return { status: 'no-threshold', ratio: null, classIndex: null }
    }

    if (threshold <= 0) {
        return stats.median > 0
            ? {
                  status: 'above',
                  ratio: null,
                  classIndex: RATIO_BREAKS.length - 1,
              }
            : { status: 'below', ratio: null, classIndex: null }
    }

    const ratio = stats.median / threshold
    if (stats.median >= threshold) {
        return { status: 'above', ratio, classIndex: classIndexForRatio(ratio) }
    }
    return {
        status: stats.high >= threshold ? 'possible' : 'below',
        ratio,
        classIndex: null,
    }
}
