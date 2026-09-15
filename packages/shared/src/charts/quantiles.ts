import type { DataElement } from '../chap-api'
// Explicit extension so `node --test` can load this module's tests directly
import { buildChartPeriods, comparePeriods } from './periods.ts'

/** The quantiles every widget requests — matches the modeling app */
export const STANDARD_QUANTILES = [0.1, 0.25, 0.5, 0.75, 0.9]

/** One prediction/evaluation data point as returned by the analytics endpoints */
export type QuantileEntry = {
    orgUnit: string
    period: string
    quantile: number
    value: number
}

/** The predicted median and 80% interval for one org unit and period */
export type OrgUnitStats = {
    /** 0.5 quantile */
    median: number
    /** 0.1 quantile, falling back to the median when it was not requested */
    low: number
    /** 0.9 quantile, falling back to the median when it was not requested */
    high: number
}

export type FanChartData = {
    /** Sorted period ids forming the x-axis (actuals ∪ predictions) */
    periods: string[]
    median: Array<number | null>
    /** [low, high] per period from the 0.25/0.75 quantiles */
    range50: Array<[number | null, number | null]>
    /** [low, high] per period from the 0.1/0.9 quantiles */
    range80: Array<[number | null, number | null]>
    actuals: Array<number | null>
}

const quantileKey = (quantile: number) => quantile.toFixed(4)

/**
 * Shapes flat quantile entries (and optional observed actual cases) for one
 * org unit into aligned FanChart series. Actual-case history is capped to the
 * `maxActualPeriods` observations leading into the forecast so old observations
 * don't dwarf it — unless `fullActualHistory` asks for the whole series.
 */
export const buildFanChartData = ({
    entries,
    orgUnitId,
    actuals = [],
    maxActualPeriods = 12,
    fullActualHistory = false,
}: {
    entries: QuantileEntry[]
    orgUnitId: string
    actuals?: DataElement[]
    maxActualPeriods?: number
    /**
     * Span every observed period instead of a window around the forecast, so
     * the x-axis stays put when the forecast moves along the series and only
     * the prediction travels across it. What the modeling app's evaluation
     * plots do.
     */
    fullActualHistory?: boolean
}): FanChartData => {
    const quantilesByPeriod = new Map<string, Map<string, number>>()
    for (const entry of entries) {
        if (entry.orgUnit !== orgUnitId) {
            continue
        }
        const forPeriod =
            quantilesByPeriod.get(entry.period) ?? new Map<string, number>()
        forPeriod.set(quantileKey(entry.quantile), entry.value)
        quantilesByPeriod.set(entry.period, forPeriod)
    }

    const predictionPeriods = buildChartPeriods(quantilesByPeriod.keys())
    const allActualPeriods = buildChartPeriods(
        actuals
            .filter((actual) => actual.ou === orgUnitId)
            .map((actual) => actual.pe)
    )

    // The history window is anchored on the forecast, not on the end of the
    // series: the run-up to the first predicted period plus whatever actually
    // happened during the forecast. Anchoring on the end would pair an early
    // evaluation split with history from years later.
    const firstPrediction = predictionPeriods[0]
    const lastPrediction = predictionPeriods[predictionPeriods.length - 1]
    const actualPeriods = fullActualHistory
        ? allActualPeriods
        : firstPrediction === undefined
          ? allActualPeriods.slice(-maxActualPeriods)
          : [
                ...allActualPeriods
                    .filter(
                        (period) => comparePeriods(period, firstPrediction) < 0
                    )
                    .slice(-maxActualPeriods),
                ...allActualPeriods.filter(
                    (period) =>
                        comparePeriods(period, firstPrediction) >= 0 &&
                        comparePeriods(period, lastPrediction) <= 0
                ),
            ]

    const inWindow = new Set(actualPeriods)
    const actualsByPeriod = new Map<string, number | null>()
    for (const actual of actuals) {
        if (actual.ou === orgUnitId && inWindow.has(actual.pe)) {
            actualsByPeriod.set(actual.pe, actual.value)
        }
    }

    const periods = buildChartPeriods([...actualPeriods, ...predictionPeriods])

    const valueAt = (period: string, quantile: number): number | null =>
        quantilesByPeriod.get(period)?.get(quantileKey(quantile)) ?? null

    return {
        periods,
        median: periods.map((period) => valueAt(period, 0.5)),
        range50: periods.map((period) => [
            valueAt(period, 0.25),
            valueAt(period, 0.75),
        ]),
        range80: periods.map((period) => [
            valueAt(period, 0.1),
            valueAt(period, 0.9),
        ]),
        actuals: periods.map((period) => actualsByPeriod.get(period) ?? null),
    }
}

/**
 * Index flat quantile entries as period → org unit → median and interval —
 * the shape a map or table needs, where a fan chart needs one org unit across
 * every period. Org units without a median are left out: there is nothing to
 * draw for them.
 */
export const buildStatsByPeriod = (
    entries: QuantileEntry[]
): Map<string, Map<string, OrgUnitStats>> => {
    const raw = new Map<string, Map<string, Map<string, number>>>()
    for (const entry of entries) {
        let perOrgUnit = raw.get(entry.period)
        if (!perOrgUnit) {
            perOrgUnit = new Map()
            raw.set(entry.period, perOrgUnit)
        }
        let perQuantile = perOrgUnit.get(entry.orgUnit)
        if (!perQuantile) {
            perQuantile = new Map()
            perOrgUnit.set(entry.orgUnit, perQuantile)
        }
        perQuantile.set(quantileKey(entry.quantile), entry.value)
    }

    const stats = new Map<string, Map<string, OrgUnitStats>>()
    for (const [period, perOrgUnit] of raw) {
        const perOrgUnitStats = new Map<string, OrgUnitStats>()
        for (const [orgUnit, perQuantile] of perOrgUnit) {
            const median = perQuantile.get(quantileKey(0.5))
            if (median === undefined) {
                continue
            }
            perOrgUnitStats.set(orgUnit, {
                median,
                low: perQuantile.get(quantileKey(0.1)) ?? median,
                high: perQuantile.get(quantileKey(0.9)) ?? median,
            })
        }
        stats.set(period, perOrgUnitStats)
    }
    return stats
}
