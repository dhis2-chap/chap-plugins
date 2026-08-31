import {
    PredictionsService,
    useOrgUnitNames,
    formatPeriodLabel,
    LoadingState,
    PassiveState,
    ErrorState,
    type QuantileEntry,
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
import React from 'react'
import { type Config } from './config'
import styles from './WidgetView.module.css'

const ALERT_QUANTILES = [0.5, 0.9]

type OrgUnitAlert = {
    orgUnitId: string
    /** Highest predicted median across the forecast window */
    peakMedian: number
    /** Highest predicted 90th percentile across the forecast window */
    peakUpper: number
    /** Period in which the median peaks */
    peakPeriod: string
    level: 'high' | 'possible' | 'low'
}

const buildAlerts = (
    entries: QuantileEntry[],
    threshold: number
): OrgUnitAlert[] => {
    const byOrgUnit = new Map<string, QuantileEntry[]>()
    for (const entry of entries) {
        byOrgUnit.set(entry.orgUnit, [
            ...(byOrgUnit.get(entry.orgUnit) ?? []),
            entry,
        ])
    }

    const alerts: OrgUnitAlert[] = []
    for (const [orgUnitId, orgUnitEntries] of byOrgUnit) {
        const medians = orgUnitEntries.filter((entry) => entry.quantile === 0.5)
        const uppers = orgUnitEntries.filter((entry) => entry.quantile === 0.9)
        if (medians.length === 0) {
            continue
        }
        const peak = medians.reduce((max, entry) =>
            entry.value > max.value ? entry : max
        )
        const peakUpper = uppers.reduce(
            (max, entry) => Math.max(max, entry.value),
            0
        )
        alerts.push({
            orgUnitId,
            peakMedian: peak.value,
            peakUpper,
            peakPeriod: peak.period,
            level:
                peak.value >= threshold
                    ? 'high'
                    : peakUpper >= threshold
                      ? 'possible'
                      : 'low',
        })
    }

    return alerts.sort((a, b) => b.peakMedian - a.peakMedian)
}

const AlertTag = ({ level }: { level: OrgUnitAlert['level'] }) => {
    if (level === 'high') {
        return <Tag negative>{i18n.t('Above threshold')}</Tag>
    }
    if (level === 'possible') {
        return <Tag>{i18n.t('Possible')}</Tag>
    }
    return <Tag positive>{i18n.t('Below threshold')}</Tag>
}

/**
 * Ranks the prediction's org units by their peak forecasted cases and flags
 * the ones whose forecast crosses the configured threshold — median above
 * threshold is an alert, 90th percentile above threshold is "possible".
 */
export const WidgetView = ({ config }: { config: Config }) => {
    const entriesQuery = useQuery({
        queryKey: [
            'chap',
            'prediction-entries',
            config.predictionId,
            ALERT_QUANTILES,
        ],
        queryFn: () =>
            PredictionsService.getPredictionEntriesV1AnalyticsPredictionEntryPredictionIdGet(
                config.predictionId,
                ALERT_QUANTILES
            ),
        staleTime: 5 * 60 * 1000,
    })
    const alerts = entriesQuery.data
        ? buildAlerts(entriesQuery.data, config.threshold)
        : []
    const orgUnitNamesQuery = useOrgUnitNames(
        alerts.map((alert) => alert.orgUnitId)
    )

    if (entriesQuery.isLoading) {
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
                            {i18n.t('Peak predicted cases')}
                        </DataTableColumnHeader>
                        <DataTableColumnHeader>
                            {i18n.t('Peak period')}
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
                                {Math.round(alert.peakMedian)}
                            </DataTableCell>
                            <DataTableCell>
                                {formatPeriodLabel(alert.peakPeriod)}
                            </DataTableCell>
                            <DataTableCell>
                                <AlertTag level={alert.level} />
                            </DataTableCell>
                        </DataTableRow>
                    ))}
                </DataTableBody>
            </DataTable>
            <div className={styles.footer}>
                {i18n.t('Threshold: {{threshold}} cases', {
                    threshold: config.threshold,
                })}
            </div>
        </div>
    )
}
