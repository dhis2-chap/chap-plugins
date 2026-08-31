import {
    BacktestsService,
    FanChart,
    buildFanChartData,
    formatPeriodLabel,
    LoadingState,
    PassiveState,
    ErrorState,
    STANDARD_QUANTILES,
} from '@chap-widgets/shared'
import i18n from '@dhis2/d2-i18n'
import { useQuery } from '@tanstack/react-query'
import React from 'react'
import { type Config } from './config'
import styles from './WidgetView.module.css'

/**
 * Plots predicted quantile bands against the observed actuals for one
 * train/test split of a backtest — how well would the model have done.
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
    // "latest" (unset) resolves to the backtest's last split period
    const splitPeriod =
        config.splitPeriod ?? backtestQuery.data?.splitPeriods?.at(-1)

    const entriesQuery = useQuery({
        queryKey: [
            'chap',
            'evaluation-entries',
            config.backtestId,
            splitPeriod,
            config.orgUnitId,
        ],
        enabled: splitPeriod !== undefined,
        queryFn: () =>
            BacktestsService.getEvaluationEntriesV1AnalyticsEvaluationEntryGet(
                config.backtestId,
                STANDARD_QUANTILES,
                splitPeriod,
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

    const data = buildFanChartData({
        entries: entriesQuery.data ?? [],
        orgUnitId: config.orgUnitId,
        actuals: actualsQuery.data?.data ?? [],
    })

    if (data.median.every((value) => value === null)) {
        return (
            <PassiveState title={i18n.t('No evaluation data')}>
                {i18n.t(
                    'The backtest has no evaluation entries for the configured organisation unit and split.'
                )}
            </PassiveState>
        )
    }

    const backtestName =
        backtestQuery.data?.name ?? `Backtest ${config.backtestId}`

    return (
        <div className={styles.view}>
            <div className={styles.subtitle}>
                {config.orgUnitName ?? config.orgUnitId} — {backtestName}
                {splitPeriod
                    ? ` — ${i18n.t('split {{period}}', { period: formatPeriodLabel(splitPeriod) })}`
                    : ''}
            </div>
            <FanChart data={data} />
        </div>
    )
}
