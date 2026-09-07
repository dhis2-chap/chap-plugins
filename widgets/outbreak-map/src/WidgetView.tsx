import {
    DatasetsService,
    PredictionsService,
    useOrgUnitGeometryContext,
    LoadingState,
    PassiveState,
    ErrorState,
    STANDARD_QUANTILES,
    buildChartPeriods,
    buildStatsByPeriod,
    buildThresholdMap,
    canonicalizePeriodId,
    formatPeriodLabel,
} from '@chap-widgets/shared'
import {
    ChoroplethMap,
    MapLegend,
    createMapPopup,
    type MapLegendRow,
    type MapPopupRow,
} from '@chap-widgets/shared/maps'
import i18n from '@dhis2/d2-i18n'
import { Button, IconChevronLeft16, IconChevronRight16 } from '@dhis2/ui'
import { useQuery } from '@tanstack/react-query'
import type { FeatureCollection, GeoJsonProperties, Geometry } from 'geojson'
import React, { useEffect, useMemo, useState } from 'react'
import { describeThresholdParams, type Config } from './config'
import {
    RATIO_BREAKS,
    classifyExceedance,
    type Exceedance,
    type ExceedanceStatus,
} from './exceedance'
import styles from './WidgetView.module.css'

/**
 * Sequential reds, one per {@link RATIO_BREAKS} class: the further a district's
 * predicted median is above its endemic threshold, the deeper the red. Amber
 * marks a district whose median stays under but whose 90th percentile crosses,
 * and the greys are deliberately not on the red ramp — only an exceedance
 * should read as an alert.
 */
const RATIO_COLORS = ['#fcbba1', '#fc8d59', '#ef3b2c', '#cb181d', '#67000d']
const POSSIBLE_COLOR = '#fee391'
const BELOW_COLOR = '#dfe3e8'
const NO_THRESHOLD_COLOR = '#b8bcc2'
const NO_PREDICTION_COLOR = '#eceef0'

const STATUS_COLORS: Record<Exclude<ExceedanceStatus, 'above'>, string> = {
    possible: POSSIBLE_COLOR,
    below: BELOW_COLOR,
    'no-threshold': NO_THRESHOLD_COLOR,
    'no-prediction': NO_PREDICTION_COLOR,
}

const colorFor = (exceedance: Exceedance): string =>
    exceedance.status === 'above'
        ? RATIO_COLORS[exceedance.classIndex ?? 0]
        : STATUS_COLORS[exceedance.status]

const formatValue = (value: number): string =>
    value < 10
        ? String(Math.round(value * 10) / 10)
        : Math.round(value).toLocaleString()

const formatRatio = (ratio: number): string => `${Math.round(ratio * 10) / 10}×`

const formatBreak = (index: number): string => {
    const lower = RATIO_BREAKS[index]
    const upper = RATIO_BREAKS[index + 1]
    return upper === undefined
        ? i18n.t('{{lower}}× or more', { lower })
        : i18n.t('{{lower}}–{{upper}}×', { lower, upper })
}

const buildLegendRows = (present: Set<ExceedanceStatus>): MapLegendRow[] => {
    const rows: MapLegendRow[] = RATIO_COLORS.map((color, index) => ({
        color,
        label: formatBreak(index),
    }))
    if (present.has('possible')) {
        rows.push({
            color: POSSIBLE_COLOR,
            label: i18n.t('Possible (80% interval crosses)'),
        })
    }
    if (present.has('below')) {
        rows.push({ color: BELOW_COLOR, label: i18n.t('Below threshold') })
    }
    if (present.has('no-threshold')) {
        rows.push({
            color: NO_THRESHOLD_COLOR,
            label: i18n.t('No threshold (too little history)'),
        })
    }
    if (present.has('no-prediction')) {
        rows.push({
            color: NO_PREDICTION_COLOR,
            label: i18n.t('No prediction'),
        })
    }
    return rows
}

const STATUS_HEADLINES: Record<ExceedanceStatus, string> = {
    above: i18n.t('Above the endemic threshold'),
    possible: i18n.t('Possible outbreak'),
    below: i18n.t('Below the endemic threshold'),
    'no-threshold': i18n.t('No threshold available'),
    'no-prediction': i18n.t('No prediction for this period'),
}

const renderPopup = (properties: GeoJsonProperties): HTMLElement => {
    const title = String(properties?.name ?? '')
    const status = String(properties?.status ?? '') as ExceedanceStatus
    const rows: MapPopupRow[] = [
        { text: STATUS_HEADLINES[status] ?? STATUS_HEADLINES['no-prediction'] },
    ]

    if (typeof properties?.median === 'number') {
        rows.push({
            text:
                typeof properties.ratio === 'number'
                    ? i18n.t(
                          'Predicted {{value}} cases ({{ratio}} threshold)',
                          {
                              value: formatValue(properties.median),
                              ratio: formatRatio(properties.ratio),
                          }
                      )
                    : i18n.t('Predicted {{value}} cases', {
                          value: formatValue(properties.median),
                      }),
        })
        if (
            typeof properties.low === 'number' &&
            typeof properties.high === 'number'
        ) {
            rows.push({
                text: i18n.t('80% interval: {{low}} – {{high}}', {
                    low: formatValue(properties.low),
                    high: formatValue(properties.high),
                }),
                muted: true,
            })
        }
    }
    if (typeof properties?.threshold === 'number') {
        rows.push({
            text: i18n.t('Threshold: {{value}} cases', {
                value: formatValue(properties.threshold),
            }),
            muted: true,
        })
    }

    return createMapPopup(title, rows)
}

/**
 * Maps a prediction's org units against their endemic threshold: red where the
 * predicted median crosses it, deepening with the multiple by which it does.
 * Thresholds come from CHAP's own threshold endpoint, using the modeling app's
 * strategies and defaults, so the map agrees with its prediction charts.
 */
export const WidgetView = ({ config }: { config: Config }) => {
    const predictionsQuery = useQuery({
        queryKey: ['chap', 'predictions'],
        queryFn: () => PredictionsService.getPredictionsV1CrudPredictionsGet(),
        staleTime: 60 * 1000,
    })
    const predictions = predictionsQuery.data
    const prediction = useMemo(() => {
        if (!predictions) {
            return undefined
        }
        if (config.predictionId === 'latest') {
            return [...predictions].sort(
                (a, b) => b.created.localeCompare(a.created) || b.id - a.id
            )[0]
        }
        return predictions.find((p) => p.id === config.predictionId)
    }, [predictions, config.predictionId])
    const predictionId = prediction?.id

    const entriesQuery = useQuery({
        queryKey: ['chap', 'prediction-entries', predictionId],
        enabled: predictionId !== undefined,
        queryFn: () =>
            PredictionsService.getPredictionEntriesV1AnalyticsPredictionEntryPredictionIdGet(
                predictionId as number,
                STANDARD_QUANTILES
            ),
        staleTime: 5 * 60 * 1000,
    })
    const entries = entriesQuery.data

    const statsByPeriod = useMemo(
        () => buildStatsByPeriod(entries ?? []),
        [entries]
    )
    const periods = useMemo(
        () => buildChartPeriods((entries ?? []).map((entry) => entry.period)),
        [entries]
    )

    const orgUnitIds = useMemo(() => {
        const ids = new Set<string>(
            prediction?.orgUnits ?? prediction?.dataset.orgUnits ?? []
        )
        for (const entry of entries ?? []) {
            ids.add(entry.orgUnit)
        }
        return Array.from(ids)
    }, [prediction, entries])
    const geometriesQuery = useOrgUnitGeometryContext(orgUnitIds)

    // Thresholds are per (org unit, period), computed from the prediction's own
    // dataset history — so they are requested for exactly the periods and org
    // units the map draws.
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

    const [periodIndex, setPeriodIndex] = useState(0)
    useEffect(() => {
        setPeriodIndex(0)
    }, [predictionId])
    const activeIndex = Math.min(periodIndex, Math.max(0, periods.length - 1))
    const activePeriod = periods[activeIndex]
    const activeStats = activePeriod
        ? statsByPeriod.get(activePeriod)
        : undefined

    const features = geometriesQuery.data?.features
    const contextFeature = geometriesQuery.data?.contextFeature
    const { featureCollection, statuses, aboveCount } = useMemo(() => {
        const canonicalPeriod = activePeriod
            ? canonicalizePeriodId(activePeriod)
            : undefined
        const present = new Set<ExceedanceStatus>()
        let above = 0
        const collection: FeatureCollection = {
            type: 'FeatureCollection',
            features: (features ?? []).map((feature) => {
                const stats = activeStats?.get(feature.id)
                const threshold =
                    canonicalPeriod === undefined
                        ? undefined
                        : thresholds?.get(feature.id)?.get(canonicalPeriod)
                const exceedance = classifyExceedance(stats, threshold)
                present.add(exceedance.status)
                if (exceedance.status === 'above') {
                    above++
                }
                return {
                    type: 'Feature' as const,
                    id: feature.id,
                    geometry: feature.geometry as unknown as Geometry,
                    properties: {
                        ...feature.properties,
                        color: colorFor(exceedance),
                        status: exceedance.status,
                        ratio: exceedance.ratio,
                        threshold: threshold ?? null,
                        median: stats?.median ?? null,
                        low: stats?.low ?? null,
                        high: stats?.high ?? null,
                    },
                }
            }),
        }
        return {
            featureCollection: collection,
            statuses: present,
            aboveCount: above,
        }
    }, [features, activeStats, activePeriod, thresholds])

    if (predictionsQuery.isLoading) {
        return <LoadingState />
    }
    if (predictionsQuery.isError) {
        return (
            <ErrorState title={i18n.t('Could not load predictions')}>
                {i18n.t(
                    'Fetching the prediction list from the CHAP backend failed.'
                )}
            </ErrorState>
        )
    }
    if (!prediction) {
        return config.predictionId === 'latest' ? (
            <PassiveState title={i18n.t('No predictions yet')}>
                {i18n.t(
                    'No predictions have been run on the CHAP backend yet.'
                )}
            </PassiveState>
        ) : (
            <PassiveState title={i18n.t('Prediction not found')}>
                {i18n.t(
                    'The configured prediction no longer exists. Reconfigure this widget while editing the dashboard.'
                )}
            </PassiveState>
        )
    }
    if (
        entriesQuery.isLoading ||
        thresholdsQuery.isLoading ||
        (orgUnitIds.length > 0 && geometriesQuery.isLoading)
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
    if (thresholdsQuery.isError) {
        return (
            <ErrorState title={i18n.t('Could not compute thresholds')}>
                {i18n.t(
                    'CHAP could not compute endemic thresholds for this prediction’s dataset. It needs historical disease cases to compare against.'
                )}
            </ErrorState>
        )
    }
    if (geometriesQuery.isError) {
        return (
            <ErrorState title={i18n.t('Could not load map geometry')}>
                {i18n.t(
                    'Fetching organisation unit geometry from DHIS2 failed.'
                )}
            </ErrorState>
        )
    }
    if (periods.length === 0) {
        return (
            <PassiveState title={i18n.t('No prediction data')}>
                {i18n.t('The prediction has no forecast entries.')}
            </PassiveState>
        )
    }
    if ((features ?? []).length === 0) {
        return (
            <PassiveState title={i18n.t('No map geometry')}>
                {i18n.t(
                    'None of the prediction’s organisation units have geometry in DHIS2.'
                )}
            </PassiveState>
        )
    }

    return (
        <div className={styles.view}>
            <div className={styles.header}>
                <div className={styles.subtitle}>
                    <span title={prediction.name}>
                        {i18n.t('{{count}} above threshold', {
                            count: aboveCount,
                        })}
                    </span>
                    <span className={styles.thresholdNote}>
                        {describeThresholdParams(config.threshold)}
                    </span>
                </div>
                <div className={styles.periodNav}>
                    <Button
                        small
                        secondary
                        icon={<IconChevronLeft16 />}
                        title={i18n.t('Previous period')}
                        disabled={activeIndex === 0}
                        onClick={() => setPeriodIndex(activeIndex - 1)}
                    />
                    <span className={styles.periodLabel}>
                        {formatPeriodLabel(activePeriod)}
                    </span>
                    <Button
                        small
                        secondary
                        icon={<IconChevronRight16 />}
                        title={i18n.t('Next period')}
                        disabled={activeIndex >= periods.length - 1}
                        onClick={() => setPeriodIndex(activeIndex + 1)}
                    />
                </div>
            </div>
            <div className={styles.mapWrap}>
                <ChoroplethMap
                    featureCollection={featureCollection}
                    contextFeature={
                        contextFeature
                            ? {
                                  ...contextFeature,
                                  geometry:
                                      contextFeature.geometry as unknown as Geometry,
                              }
                            : undefined
                    }
                    showBasemap={config.showBasemap}
                    renderPopup={renderPopup}
                />
                {contextFeature && (
                    <div className={styles.contextLabel}>
                        {contextFeature.properties.name}
                    </div>
                )}
                <MapLegend
                    title={i18n.t('Above threshold (× threshold)')}
                    rows={buildLegendRows(statuses)}
                />
            </div>
        </div>
    )
}
