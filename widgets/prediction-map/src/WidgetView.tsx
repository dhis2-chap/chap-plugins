import {
    PredictionsService,
    useOrgUnitGeometries,
    LoadingState,
    PassiveState,
    ErrorState,
    STANDARD_QUANTILES,
    buildChartPeriods,
    formatPeriodLabel,
    type PredictionEntry,
} from '@chap-widgets/shared'
import i18n from '@dhis2/d2-i18n'
import { Button, IconChevronLeft16, IconChevronRight16 } from '@dhis2/ui'
import { useQuery } from '@tanstack/react-query'
import type { FeatureCollection, Geometry } from 'geojson'
import {
    LngLatBounds,
    Map as MaplibreMap,
    NavigationControl,
    Popup,
    setWorkerUrl,
    type GeoJSONSource,
    type MapLayerMouseEvent,
    type StyleSpecification,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { type Config } from './config'
import styles from './WidgetView.module.css'

/**
 * Sequential single-hue ramp (light → dark = fewer → more predicted cases).
 * 5 steps, colorblind-safe and monotone in lightness on a light surface.
 */
// MapLibre resolves its worker as `maplibre-gl-worker.mjs` next to the main
// module at runtime — a file no bundler emits (silent 404, GeoJSON sources
// then never finish loading). Point it at the vite-bundled worker instead.
setWorkerUrl(maplibreWorkerUrl)

const CLASS_COLORS = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#0d366b']
const NO_DATA_COLOR = '#d9d7d2'
const SOURCE_ID = 'org-units'

type OrgUnitStats = { median: number; low: number; high: number }
/** `bounds` has one more entry than `colors`; class i covers bounds[i]..bounds[i+1] */
type Scale = { bounds: number[]; colors: string[] }

const formatValue = (value: number): string =>
    value < 10
        ? String(Math.round(value * 10) / 10)
        : Math.round(value).toLocaleString()

/** period → orgUnit → {median, low, high} from raw quantile entries */
const buildStatsByPeriod = (entries: PredictionEntry[]) => {
    const raw = new Map<string, Map<string, Map<number, number>>>()
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
        perQuantile.set(entry.quantile, entry.value)
    }
    const stats = new Map<string, Map<string, OrgUnitStats>>()
    for (const [period, perOrgUnit] of raw) {
        const perOrgUnitStats = new Map<string, OrgUnitStats>()
        for (const [orgUnit, perQuantile] of perOrgUnit) {
            const median = perQuantile.get(0.5)
            if (median === undefined) {
                continue
            }
            perOrgUnitStats.set(orgUnit, {
                median,
                low: perQuantile.get(0.1) ?? median,
                high: perQuantile.get(0.9) ?? median,
            })
        }
        stats.set(period, perOrgUnitStats)
    }
    return stats
}

/**
 * Quantile class breaks over the medians of ALL periods, so colors stay
 * comparable while stepping through periods. Duplicate breaks (common with
 * many zero-predictions) collapse into fewer classes.
 */
const buildScale = (
    statsByPeriod: Map<string, Map<string, OrgUnitStats>>
): Scale | null => {
    const medians: number[] = []
    for (const perOrgUnit of statsByPeriod.values()) {
        for (const stats of perOrgUnit.values()) {
            medians.push(stats.median)
        }
    }
    if (medians.length === 0) {
        return null
    }
    medians.sort((a, b) => a - b)
    const min = medians[0]
    const max = medians[medians.length - 1]
    const bounds = [min]
    for (let i = 1; i < CLASS_COLORS.length; i++) {
        const quantile =
            medians[
                Math.min(
                    medians.length - 1,
                    Math.floor((i / CLASS_COLORS.length) * medians.length)
                )
            ]
        if (quantile > bounds[bounds.length - 1] && quantile < max) {
            bounds.push(quantile)
        }
    }
    if (max > bounds[bounds.length - 1]) {
        bounds.push(max)
    }
    const classCount = Math.max(1, bounds.length - 1)
    if (bounds.length === 1) {
        bounds.push(min)
    }
    const colors =
        classCount === 1
            ? [CLASS_COLORS[2]]
            : Array.from(
                  { length: classCount },
                  (_, i) =>
                      CLASS_COLORS[
                          Math.round(
                              (i * (CLASS_COLORS.length - 1)) / (classCount - 1)
                          )
                      ]
              )
    return { bounds, colors }
}

const colorFor = (value: number, scale: Scale): string => {
    let index = 0
    for (let i = 1; i < scale.bounds.length - 1; i++) {
        if (value >= scale.bounds[i]) {
            index = i
        }
    }
    return scale.colors[Math.min(index, scale.colors.length - 1)]
}

const buildMapStyle = (showBasemap: boolean): StyleSpecification =>
    showBasemap
        ? {
              version: 8,
              sources: {
                  osm: {
                      type: 'raster',
                      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                      tileSize: 256,
                      maxzoom: 19,
                      attribution: '© OpenStreetMap contributors',
                  },
              },
              layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
          }
        : {
              version: 8,
              sources: {},
              layers: [
                  {
                      id: 'background',
                      type: 'background',
                      paint: { 'background-color': '#f3f2ef' },
                  },
              ],
          }

const extendBounds = (bounds: LngLatBounds, coordinates: unknown) => {
    if (!Array.isArray(coordinates) || coordinates.length === 0) {
        return
    }
    if (typeof coordinates[0] === 'number') {
        bounds.extend([coordinates[0] as number, coordinates[1] as number])
        return
    }
    for (const nested of coordinates) {
        extendBounds(bounds, nested)
    }
}

const buildPopupContent = (
    properties: Record<string, unknown>
): HTMLElement => {
    const root = document.createElement('div')
    root.className = styles.popup
    const title = document.createElement('div')
    title.className = styles.popupTitle
    title.textContent = String(properties.name ?? '')
    root.appendChild(title)
    if (typeof properties.median === 'number') {
        const median = document.createElement('div')
        median.textContent = i18n.t('Median: {{value}} cases', {
            value: formatValue(properties.median),
        })
        root.appendChild(median)
        if (
            typeof properties.low === 'number' &&
            typeof properties.high === 'number'
        ) {
            const range = document.createElement('div')
            range.className = styles.popupRange
            range.textContent = i18n.t('80% interval: {{low}} – {{high}}', {
                low: formatValue(properties.low),
                high: formatValue(properties.high),
            })
            root.appendChild(range)
        }
    } else {
        const empty = document.createElement('div')
        empty.textContent = i18n.t('No prediction for this period')
        root.appendChild(empty)
    }
    return root
}

const addChoroplethLayers = (map: MaplibreMap) => {
    map.addLayer({
        id: 'org-unit-fills',
        type: 'fill',
        source: SOURCE_ID,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.8 },
    })
    map.addLayer({
        id: 'org-unit-outlines',
        type: 'line',
        source: SOURCE_ID,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'line-color': '#ffffff', 'line-width': 1 },
    })
    map.addLayer({
        id: 'org-unit-points',
        type: 'circle',
        source: SOURCE_ID,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
            'circle-color': ['get', 'color'],
            'circle-radius': 6,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 1.5,
        },
    })

    const popup = new Popup({
        closeButton: false,
        closeOnClick: false,
        maxWidth: '260px',
    })
    for (const layerId of ['org-unit-fills', 'org-unit-points']) {
        map.on('mousemove', layerId, (event: MapLayerMouseEvent) => {
            const feature = event.features?.[0]
            if (!feature) {
                return
            }
            map.getCanvas().style.cursor = 'pointer'
            popup
                .setLngLat(event.lngLat)
                .setDOMContent(buildPopupContent(feature.properties))
                .addTo(map)
        })
        map.on('mouseleave', layerId, () => {
            map.getCanvas().style.cursor = ''
            popup.remove()
        })
    }
}

const PredictionMap = ({
    featureCollection,
    showBasemap,
}: {
    featureCollection: FeatureCollection
    showBasemap: boolean
}) => {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const mapRef = useRef<MaplibreMap | null>(null)
    const fittedRef = useRef<string | null>(null)
    const [mapReady, setMapReady] = useState(false)

    useEffect(() => {
        const container = containerRef.current
        if (!container) {
            return
        }
        const map = new MaplibreMap({
            container,
            style: buildMapStyle(showBasemap),
            attributionControl: showBasemap ? { compact: true } : false,
            dragRotate: false,
        })
        map.addControl(
            new NavigationControl({ showCompass: false }),
            'top-right'
        )
        map.on('load', () => setMapReady(true))
        mapRef.current = map
        fittedRef.current = null
        return () => {
            mapRef.current = null
            setMapReady(false)
            map.remove()
        }
    }, [showBasemap])

    useEffect(() => {
        const map = mapRef.current
        if (!map || !mapReady) {
            return
        }
        const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined
        if (source) {
            source.setData(featureCollection)
        } else {
            map.addSource(SOURCE_ID, {
                type: 'geojson',
                data: featureCollection,
            })
            addChoroplethLayers(map)
        }
        // Fit once per distinct set of org units (not on every period step)
        const signature = featureCollection.features
            .map((feature) => String(feature.id))
            .join(',')
        if (signature && fittedRef.current !== signature) {
            fittedRef.current = signature
            const bounds = new LngLatBounds()
            for (const feature of featureCollection.features) {
                extendBounds(
                    bounds,
                    'coordinates' in feature.geometry
                        ? feature.geometry.coordinates
                        : undefined
                )
            }
            if (!bounds.isEmpty()) {
                map.fitBounds(bounds, { padding: 24, duration: 0, maxZoom: 9 })
            }
        }
    }, [featureCollection, mapReady])

    return <div ref={containerRef} className={styles.map} />
}

const Legend = ({
    scale,
    showNoData,
}: {
    scale: Scale
    showNoData: boolean
}) => (
    <div className={styles.legend}>
        <div className={styles.legendTitle}>
            {i18n.t('Predicted cases (median)')}
        </div>
        {scale.colors.map((color, index) => (
            <div key={index} className={styles.legendRow}>
                <span className={styles.swatch} style={{ background: color }} />
                <span>
                    {scale.bounds[index] === scale.bounds[index + 1]
                        ? formatValue(scale.bounds[index])
                        : `${formatValue(scale.bounds[index])} – ${formatValue(
                              scale.bounds[index + 1]
                          )}`}
                </span>
            </div>
        ))}
        {showNoData && (
            <div className={styles.legendRow}>
                <span
                    className={styles.swatch}
                    style={{ background: NO_DATA_COLOR }}
                />
                <span>{i18n.t('No data')}</span>
            </div>
        )}
    </div>
)

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

    const orgUnitIds = useMemo(() => {
        const ids = new Set<string>(
            prediction?.orgUnits ?? prediction?.dataset.orgUnits ?? []
        )
        for (const entry of entries ?? []) {
            ids.add(entry.orgUnit)
        }
        return Array.from(ids)
    }, [prediction, entries])
    const geometriesQuery = useOrgUnitGeometries(orgUnitIds)

    const statsByPeriod = useMemo(
        () => buildStatsByPeriod(entries ?? []),
        [entries]
    )
    const periods = useMemo(
        () => buildChartPeriods((entries ?? []).map((entry) => entry.period)),
        [entries]
    )
    const scale = useMemo(() => buildScale(statsByPeriod), [statsByPeriod])

    const [periodIndex, setPeriodIndex] = useState(0)
    useEffect(() => {
        setPeriodIndex(0)
    }, [predictionId])
    const activeIndex = Math.min(periodIndex, Math.max(0, periods.length - 1))
    const activePeriod = periods[activeIndex]
    const activeStats = activePeriod
        ? statsByPeriod.get(activePeriod)
        : undefined

    const features = geometriesQuery.data
    const featureCollection = useMemo<FeatureCollection>(
        () => ({
            type: 'FeatureCollection',
            features: (features ?? []).map((feature) => {
                const stats = activeStats?.get(feature.id)
                return {
                    type: 'Feature' as const,
                    id: feature.id,
                    geometry: feature.geometry as unknown as Geometry,
                    properties: {
                        ...feature.properties,
                        color:
                            stats && scale
                                ? colorFor(stats.median, scale)
                                : NO_DATA_COLOR,
                        median: stats?.median ?? null,
                        low: stats?.low ?? null,
                        high: stats?.high ?? null,
                    },
                }
            }),
        }),
        [features, activeStats, scale]
    )

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

    const missingData = (features ?? []).some(
        (feature) => !activeStats?.has(feature.id)
    )

    return (
        <div className={styles.view}>
            <div className={styles.header}>
                <div className={styles.subtitle} title={prediction.name}>
                    {prediction.name} · {prediction.modelId}
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
                <PredictionMap
                    featureCollection={featureCollection}
                    showBasemap={config.showBasemap}
                />
                {scale && <Legend scale={scale} showNoData={missingData} />}
            </div>
        </div>
    )
}
