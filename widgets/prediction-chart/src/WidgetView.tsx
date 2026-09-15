import {
    BacktestsService,
    PredictionsService,
    FanChart,
    buildFanChartData,
    LoadingState,
    PassiveState,
    ErrorState,
    MissingPredictionState,
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
    const { prediction, predictionId } = resolvedPrediction
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
    // The prediction list already carries the dataset, so the observed-case
    // history needs no separate lookup of the prediction itself.
    const datasetId = prediction?.datasetId
    const actualsQuery = useQuery({
        queryKey: ['chap', 'actual-cases', datasetId, config.orgUnitId],
        enabled: datasetId !== undefined,
        queryFn: () => {
            if (datasetId === undefined) {
                throw new Error('Dataset id has not been resolved')
            }
            return BacktestsService.getActualCasesAliasV1AnalyticsActualCasesBacktestIdGet(
                datasetId,
                [config.orgUnitId],
                true // datasetId, not backtestId
            )
        },
        staleTime: 5 * 60 * 1000,
    })

    if (resolvedPrediction.isLoading) {
        return <LoadingState />
    }
    if (resolvedPrediction.isError) {
        return (
            <ErrorState title={i18n.t('Could not load predictions')}>
                {i18n.t(
                    'Fetching the prediction list from the CHAP backend failed.'
                )}
            </ErrorState>
        )
    }
    if (!prediction) {
        return (
            <MissingPredictionState
                followsLatest={resolvedPrediction.followsLatest}
            />
        )
    }
    if (
        entriesQuery.isLoading ||
        (datasetId !== undefined && actualsQuery.isLoading)
    ) {
        return <LoadingState />
    }
    if (entriesQuery.isError) {
        return (
            <ErrorState title={i18n.t('Could not load prediction')}>
                {i18n.t(
                    'Fetching the prediction from the CHAP backend failed. It may have been deleted.'
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
                {config.orgUnitName ?? config.orgUnitId} — {prediction.name}
            </div>
            <FanChart data={data} />
        </div>
    )
}
