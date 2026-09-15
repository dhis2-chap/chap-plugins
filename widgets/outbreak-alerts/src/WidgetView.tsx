import {
    DatasetsService,
    PredictionsService,
    useOrgUnitNames,
    buildChartPeriods,
    buildThresholdMap,
    canonicalizePeriodId,
    describeThresholdParams,
    formatPeriodLabel,
    LoadingState,
    PassiveState,
    ErrorState,
    useResolvedPredictionId,
} from '@chap-widgets/shared'
import i18n from '@dhis2/d2-i18n'
import {
    DataTable,
    DataTableBody,
    DataTableCell,
    DataTableColumnHeader,
    DataTableHead,
    DataTableRow,
    Tag,
} from '@dhis2/ui'
import { useQuery } from '@tanstack/react-query'
import React, { useMemo } from 'react'
import { buildAlerts, type OrgUnitAlert } from './alerts'
import { type Config } from './config'
import styles from './WidgetView.module.css'

const ALERT_QUANTILES = [0.5, 0.9]

const formatCases = (value: number): string =>
    value < 10
        ? String(Math.round(value * 10) / 10)
        : Math.round(value).toLocaleString()

const AlertTag = ({ status }: { status: OrgUnitAlert['status'] }) => {
    if (status === 'above') {
        return <Tag negative>{i18n.t('Above threshold')}</Tag>
    }
    if (status === 'possible') {
        return <Tag>{i18n.t('Possible')}</Tag>
    }
    if (status === 'no-threshold') {
        return <Tag neutral>{i18n.t('No threshold')}</Tag>
    }
    return <Tag positive>{i18n.t('Below threshold')}</Tag>
}

/**
 * Ranks a prediction's org units by how far their forecast rises above their
 * own endemic threshold — median over the threshold is an alert, 90th
 * percentile over it is "possible". Thresholds come from CHAP's threshold
 * endpoint using the modeling app's strategies, so the table agrees with the
 * outbreak map and with the modeling app's prediction charts.
 */
export const WidgetView = ({ config }: { config: Config }) => {
    const resolvedPrediction = useResolvedPredictionId(config.predictionId)
    const { predictionId, prediction } = resolvedPrediction
    const entriesQuery = useQuery({
        queryKey: ['chap', 'prediction-entries', predictionId, ALERT_QUANTILES],
        enabled: predictionId !== undefined,
        queryFn: () => {
            if (predictionId === undefined) {
                throw new Error('Prediction id has not been resolved')
            }
            return PredictionsService.getPredictionEntriesV1AnalyticsPredictionEntryPredictionIdGet(
                predictionId,
                ALERT_QUANTILES
            )
        },
        staleTime: 5 * 60 * 1000,
    })
    const entries = entriesQuery.data

    const periods = useMemo(
        () => buildChartPeriods((entries ?? []).map((entry) => entry.period)),
        [entries]
    )
    const orgUnitIds = useMemo(
        () =>
            Array.from(new Set((entries ?? []).map((entry) => entry.orgUnit))),
        [entries]
    )

    // Thresholds are per (org unit, period), computed from the prediction's
    // own dataset history — so they are requested for exactly the periods and
    // org units the table lists.
    const datasetId = prediction?.datasetId
    const thresholdsQuery = useQuery({
        queryKey: [
            'chap',
            'thresholds',
            datasetId,
            periods,
            orgUnitIds,
            config.threshold,
        ],
        enabled:
            datasetId !== undefined &&
            periods.length > 0 &&
            orgUnitIds.length > 0,
        queryFn: () =>
            DatasetsService.computeThresholdsV1AnalyticsThresholdsPost({
                datasetId: datasetId as number,
                periodIds: periods,
                locations: orgUnitIds,
                params: config.threshold,
            }),
        staleTime: 30 * 60 * 1000,
    })
    const thresholds = useMemo(
        () =>
            thresholdsQuery.data
                ? buildThresholdMap(thresholdsQuery.data)
                : undefined,
        [thresholdsQuery.data]
    )

    const alerts = useMemo(
        () =>
            buildAlerts(entries ?? [], (orgUnit, period) =>
                thresholds?.get(orgUnit)?.get(canonicalizePeriodId(period))
            ),
        [entries, thresholds]
    )
    const orgUnitNamesQuery = useOrgUnitNames(
        alerts.map((alert) => alert.orgUnitId)
    )
    const aboveCount = alerts.filter((alert) => alert.status === 'above').length

    if (
        resolvedPrediction.isLoading ||
        (predictionId !== undefined && entriesQuery.isLoading) ||
        thresholdsQuery.isLoading
    ) {
        return <LoadingState />
    }
    if (resolvedPrediction.isError || entriesQuery.isError) {
        return (
            <ErrorState title={i18n.t('Could not load prediction')}>
                {i18n.t(
                    'Fetching the prediction from the CHAP backend failed. It may have been deleted.'
                )}
            </ErrorState>
        )
    }
    if (thresholdsQuery.isError) {
        return (
            <ErrorState title={i18n.t('Could not compute thresholds')}>
                {i18n.t(
                    'CHAP could not compute endemic thresholds for this prediction’s dataset. It needs historical disease cases to compare against.'
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
    if (alerts.length === 0) {
        return (
            <PassiveState title={i18n.t('No prediction data')}>
                {i18n.t('The prediction has no forecast entries to rank.')}
            </PassiveState>
        )
    }

    return (
        <div className={styles.view}>
            <DataTable>
                <DataTableHead>
                    <DataTableRow>
                        <DataTableColumnHeader>
                            {i18n.t('Organisation unit')}
                        </DataTableColumnHeader>
                        <DataTableColumnHeader>
                            {i18n.t('Predicted cases')}
                        </DataTableColumnHeader>
                        <DataTableColumnHeader>
                            {i18n.t('Threshold')}
                        </DataTableColumnHeader>
                        <DataTableColumnHeader>
                            {i18n.t('Period')}
                        </DataTableColumnHeader>
                        <DataTableColumnHeader>
                            {i18n.t('Status')}
                        </DataTableColumnHeader>
                    </DataTableRow>
                </DataTableHead>
                <DataTableBody>
                    {alerts.map((alert) => (
                        <DataTableRow key={alert.orgUnitId}>
                            <DataTableCell>
                                {orgUnitNamesQuery.data?.get(alert.orgUnitId) ??
                                    alert.orgUnitId}
                            </DataTableCell>
                            <DataTableCell>
                                {alert.ratio === null
                                    ? formatCases(alert.median)
                                    : i18n.t('{{cases}} ({{ratio}}×)', {
                                          cases: formatCases(alert.median),
                                          ratio:
                                              Math.round(alert.ratio * 10) / 10,
                                      })}
                            </DataTableCell>
                            <DataTableCell>
                                {alert.threshold === null
                                    ? '–'
                                    : formatCases(alert.threshold)}
                            </DataTableCell>
                            <DataTableCell>
                                {formatPeriodLabel(alert.period)}
                            </DataTableCell>
                            <DataTableCell>
                                <AlertTag status={alert.status} />
                            </DataTableCell>
                        </DataTableRow>
                    ))}
                </DataTableBody>
            </DataTable>
            <div className={styles.footer}>
                {i18n.t('{{count}} above threshold — {{threshold}}', {
                    count: aboveCount,
                    threshold: describeThresholdParams(config.threshold),
                })}
            </div>
        </div>
    )
}
