import {
    BacktestsService,
    FanChart,
    buildChartPeriods,
    buildFanChartData,
    formatPeriodLabel,
    LoadingState,
    PassiveState,
    ErrorState,
    STANDARD_QUANTILES,
    type EvaluationEntry,
} from '@chap-widgets/shared'
import i18n from '@dhis2/d2-i18n'
import { useQuery } from '@tanstack/react-query'
import React, { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { type Config } from './config'
import { SplitPeriodSlider } from './SplitPeriodSlider'
import styles from './WidgetView.module.css'

/** Headroom above the tallest value so the pinned y-axis doesn't clip a peak */
const Y_AXIS_HEADROOM = 1.05

/**
 * Plots predicted quantile bands against the observed actuals for one
 * train/test split of a backtest — how well would the model have done.
 *
 * Every split is fetched up front so the slider can walk the forecast window
 * along the series without another round-trip per step, and the y-axis is
 * pinned across splits so only the data moves while scrubbing.
 */
export const WidgetView = ({ config }: { config: Config }) => {
    const backtestQuery = useQuery({
        queryKey: ['chap', 'backtest', config.backtestId],
        queryFn: () =>
            BacktestsService.getBacktestInfoV1CrudBacktestsBacktestIdGet(
                config.backtestId
            ),
        staleTime: 5 * 60 * 1000,
    })
    const entriesQuery = useQuery({
        queryKey: [
            'chap',
            'evaluation-entries',
            config.backtestId,
            'all-splits',
            config.orgUnitId,
        ],
        queryFn: () =>
            BacktestsService.getEvaluationEntriesV1AnalyticsEvaluationEntryGet(
                config.backtestId,
                STANDARD_QUANTILES,
                undefined,
                [config.orgUnitId]
            ),
        staleTime: 5 * 60 * 1000,
    })
    const actualsQuery = useQuery({
        queryKey: [
            'chap',
            'actual-cases-backtest',
            config.backtestId,
            config.orgUnitId,
        ],
        queryFn: () =>
            BacktestsService.getActualCasesAliasV1AnalyticsActualCasesBacktestIdGet(
                config.backtestId,
                [config.orgUnitId]
            ),
        staleTime: 5 * 60 * 1000,
    })

    const entriesBySplit = useMemo(() => {
        const bySplit = new Map<string, EvaluationEntry[]>()
        for (const entry of entriesQuery.data ?? []) {
            if (entry.orgUnit !== config.orgUnitId) {
                continue
            }
            const forSplit = bySplit.get(entry.splitPeriod)
            if (forSplit) {
                forSplit.push(entry)
            } else {
                bySplit.set(entry.splitPeriod, [entry])
            }
        }
        return bySplit
    }, [entriesQuery.data, config.orgUnitId])

    // Only splits with entries for this org unit — no dead slider positions
    const splitPeriods = useMemo(
        () => buildChartPeriods(entriesBySplit.keys()),
        [entriesBySplit]
    )

    // Scrubbing is view state: it starts at the configured split but is never
    // written back, since dashboard viewers don't own the item's config.
    const [scrubbedSplit, setScrubbedSplit] = useState(config.splitPeriod)
    useEffect(() => {
        setScrubbedSplit(config.splitPeriod)
    }, [config.backtestId, config.orgUnitId, config.splitPeriod])

    const selectedIndex =
        scrubbedSplit && splitPeriods.includes(scrubbedSplit)
            ? splitPeriods.indexOf(scrubbedSplit)
            : splitPeriods.length - 1
    // Let the thumb keep up with the pointer while Highcharts catches up
    const renderedIndex = useDeferredValue(selectedIndex)

    const horizonLength = useMemo(() => {
        let longest = 1
        for (const entries of entriesBySplit.values()) {
            const periods = new Set(entries.map((entry) => entry.period))
            longest = Math.max(longest, periods.size)
        }
        return longest
    }, [entriesBySplit])

    const data = useMemo(
        () =>
            buildFanChartData({
                entries: entriesBySplit.get(splitPeriods[renderedIndex]) ?? [],
                orgUnitId: config.orgUnitId,
                actuals: actualsQuery.data?.data ?? [],
            }),
        [
            entriesBySplit,
            splitPeriods,
            renderedIndex,
            config.orgUnitId,
            actualsQuery.data,
        ]
    )

    // Pinned across every split so the axis doesn't rescale mid-drag
    const yMax = useMemo(() => {
        let highest = 0
        for (const entry of entriesQuery.data ?? []) {
            if (entry.orgUnit === config.orgUnitId) {
                highest = Math.max(highest, entry.value)
            }
        }
        for (const actual of actualsQuery.data?.data ?? []) {
            if (actual.ou === config.orgUnitId && actual.value !== null) {
                highest = Math.max(highest, actual.value)
            }
        }
        return highest > 0 ? Math.ceil(highest * Y_AXIS_HEADROOM) : undefined
    }, [entriesQuery.data, actualsQuery.data, config.orgUnitId])

    if (
        backtestQuery.isLoading ||
        entriesQuery.isLoading ||
        actualsQuery.isLoading
    ) {
        return <LoadingState />
    }
    if (backtestQuery.isError || entriesQuery.isError) {
        return (
            <ErrorState title={i18n.t('Could not load evaluation')}>
                {i18n.t(
                    'Fetching the backtest from the CHAP backend failed. It may have been deleted.'
                )}
            </ErrorState>
        )
    }
    if (splitPeriods.length === 0) {
        return (
            <PassiveState title={i18n.t('No evaluation data')}>
                {i18n.t(
                    'The backtest has no evaluation entries for the configured organisation unit.'
                )}
            </PassiveState>
        )
    }

    const backtestName =
        backtestQuery.data?.name ?? `Backtest ${config.backtestId}`
    const activeWindow = buildChartPeriods(
        (entriesBySplit.get(splitPeriods[selectedIndex]) ?? []).map(
            (entry) => entry.period
        )
    )
    const hasSlider = splitPeriods.length > 1

    return (
        <div className={styles.view}>
            <div className={styles.subtitle}>
                {config.orgUnitName ?? config.orgUnitId} — {backtestName}
                {hasSlider
                    ? ''
                    : ` — ${i18n.t('split {{period}}', {
                          period: formatPeriodLabel(
                              splitPeriods[selectedIndex]
                          ),
                      })}`}
            </div>
            <FanChart data={data} yMax={yMax} />
            {hasSlider && (
                <SplitPeriodSlider
                    splitPeriods={splitPeriods}
                    selectedIndex={selectedIndex}
                    onChange={(index) => setScrubbedSplit(splitPeriods[index])}
                    horizonLength={horizonLength}
                    windowEnd={activeWindow[activeWindow.length - 1]}
                />
            )}
        </div>
    )
}
