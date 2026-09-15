import {
    BacktestsService,
    PredictionsService,
    FanChart,
    buildFanChartData,
    LoadingState,
    PassiveState,
    ErrorState,
    STANDARD_QUANTILES,
    useResolvedPredictionId,
} from '@chap-widgets/shared'
import i18n from '@dhis2/d2-i18n'
import { useQuery } from '@tanstack/react-query'
import React from 'react'
import { type Config } from './config'
import styles from './WidgetView.module.css'

export const WidgetView = ({ config }: { config: Config }) => {
    const resolvedPrediction = useResolvedPredictionId(config.predictionId)
    const predictionId = resolvedPrediction.predictionId
    const predictionQuery = useQuery({
        queryKey: ['chap', 'prediction', predictionId],
        enabled: predictionId !== undefined,
        queryFn: () => {
            if (predictionId === undefined) {
                throw new Error('Prediction id has not been resolved')
            }
            return PredictionsService.getPredictionV1CrudPredictionsPredictionIdGet(
                predictionId
            )
        },
        staleTime: 5 * 60 * 1000,
    })
    const entriesQuery = useQuery({
        queryKey: ['chap', 'prediction-entries', predictionId],
        enabled: predictionId !== undefined,
        queryFn: () => {
            if (predictionId === undefined) {
                throw new Error('Prediction id has not been resolved')
            }
            return PredictionsService.getPredictionEntriesV1AnalyticsPredictionEntryPredictionIdGet(
                predictionId,
                STANDARD_QUANTILES
            )
        },
        staleTime: 5 * 60 * 1000,
    })
    const datasetId = predictionQuery.data?.datasetId
    const actualsQuery = useQuery({
        queryKey: ['chap', 'actual-cases', datasetId, config.orgUnitId],
        enabled: datasetId !== undefined,
        queryFn: () =>
            BacktestsService.getActualCasesAliasV1AnalyticsActualCasesBacktestIdGet(
                datasetId as number,
                [config.orgUnitId],
                true // datasetId, not backtestId
            ),
        staleTime: 5 * 60 * 1000,
    })

    if (
        resolvedPrediction.isLoading ||
        (predictionId !== undefined && predictionQuery.isLoading) ||
        (predictionId !== undefined && entriesQuery.isLoading) ||
        (datasetId !== undefined && actualsQuery.isLoading)
    ) {
        return <LoadingState />
    }
    if (
        resolvedPrediction.isError ||
        entriesQuery.isError ||
        predictionQuery.isError
    ) {
        return (
            <ErrorState title={i18n.t('Could not load prediction')}>
                {i18n.t(
                    'Fetching the prediction from the CHAP backend failed. It may have been deleted.'
                )}
            </ErrorState>
        )
    }

    if (predictionId === undefined) {
        return (
            <PassiveState title={i18n.t('No predictions available')}>
                {i18n.t('Create a prediction in CHAP to populate this widget.')}
            </PassiveState>
        )
    }

    const data = buildFanChartData({
        entries: entriesQuery.data ?? [],
        orgUnitId: config.orgUnitId,
        actuals: actualsQuery.data?.data ?? [],
    })

    if (data.median.every((value) => value === null)) {
        return (
            <PassiveState title={i18n.t('No prediction data')}>
                {i18n.t(
                    'The prediction has no forecast entries for the configured organisation unit.'
                )}
            </PassiveState>
        )
    }

    return (
        <div className={styles.view}>
            <div className={styles.subtitle}>
                {config.orgUnitName ?? config.orgUnitId} —{' '}
                {predictionQuery.data?.name}
            </div>
            <FanChart data={data} />
        </div>
    )
}
