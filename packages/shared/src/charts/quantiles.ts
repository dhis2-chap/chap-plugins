import type { DataElement } from '../chap-api'
import { buildChartPeriods, comparePeriods } from './periods'

/** The quantiles every widget requests — matches the modeling app */
export const STANDARD_QUANTILES = [0.1, 0.25, 0.5, 0.75, 0.9]

/** One prediction/evaluation data point as returned by the analytics endpoints */
export type QuantileEntry = {
    orgUnit: string
    period: string
    quantile: number
    value: number
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
 * don't dwarf it.
 */
export const buildFanChartData = ({
    entries,
    orgUnitId,
    actuals = [],
    maxActualPeriods = 12,
}: {
    entries: QuantileEntry[]
    orgUnitId: string
    actuals?: DataElement[]
    maxActualPeriods?: number
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
    const actualPeriods =
        firstPrediction === undefined
            ? allActualPeriods.slice(-maxActualPeriods)
            : [
                  ...allActualPeriods
                      .filter(
                          (period) =>
                              comparePeriods(period, firstPrediction) < 0
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
