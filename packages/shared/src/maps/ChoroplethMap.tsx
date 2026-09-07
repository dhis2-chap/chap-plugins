import type { Feature, FeatureCollection, GeoJsonProperties } from 'geojson'
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
import React, { useEffect, useRef, useState } from 'react'
import { boundsOfFeatures } from './bounds'
import styles from './ChoroplethMap.module.css'

// MapLibre resolves its worker as `maplibre-gl-worker.mjs` next to the main
// module at runtime — a file no bundler emits (silent 404, GeoJSON sources
// then never finish loading). Point it at the vite-bundled worker instead.
setWorkerUrl(maplibreWorkerUrl)

/** Fill for a feature the widget has no value for */
export const MAP_NO_DATA_COLOR = '#d9d7d2'

const SOURCE_ID = 'choropleth'
const CONTEXT_SOURCE_ID = 'choropleth-context'
const FILL_LAYER_ID = 'choropleth-fills'
const OUTLINE_LAYER_ID = 'choropleth-outlines'
const POINT_LAYER_ID = 'choropleth-points'
const CONTEXT_FILL_LAYER_ID = 'choropleth-context-fill'
const CONTEXT_OUTLINE_LAYER_ID = 'choropleth-context-outline'

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

const addChoroplethLayers = (
    map: MaplibreMap,
    renderPopup: (properties: GeoJsonProperties) => HTMLElement
) => {
    map.addLayer({
        id: FILL_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.8 },
    })
    map.addLayer({
        id: OUTLINE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'line-color': '#ffffff', 'line-width': 1 },
    })
    map.addLayer({
        id: POINT_LAYER_ID,
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
    for (const layerId of [FILL_LAYER_ID, POINT_LAYER_ID]) {
        map.on('mousemove', layerId, (event: MapLayerMouseEvent) => {
            const feature = event.features?.[0]
            if (!feature) {
                return
            }
            map.getCanvas().style.cursor = 'pointer'
            popup
                .setLngLat(event.lngLat)
                .setDOMContent(renderPopup(feature.properties))
                .addTo(map)
        })
        map.on('mouseleave', layerId, () => {
            map.getCanvas().style.cursor = ''
            popup.remove()
        })
    }
}

const addContextLayers = (map: MaplibreMap) => {
    map.addLayer({
        id: CONTEXT_FILL_LAYER_ID,
        type: 'fill',
        source: CONTEXT_SOURCE_ID,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.45 },
    })
    map.addLayer({
        id: CONTEXT_OUTLINE_LAYER_ID,
        type: 'line',
        source: CONTEXT_SOURCE_ID,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'line-color': '#4a5768', 'line-width': 2 },
    })
}

const removeContextLayers = (map: MaplibreMap) => {
    for (const layerId of [CONTEXT_OUTLINE_LAYER_ID, CONTEXT_FILL_LAYER_ID]) {
        if (map.getLayer(layerId)) {
            map.removeLayer(layerId)
        }
    }
    if (map.getSource(CONTEXT_SOURCE_ID)) {
        map.removeSource(CONTEXT_SOURCE_ID)
    }
}

export type ChoroplethMapProps = {
    /** Features to fill; each one's `color` property paints it */
    featureCollection: FeatureCollection
    /** Optional geographic context (e.g. the shared ancestor) drawn beneath */
    contextFeature?: Feature
    /** Render OpenStreetMap raster tiles beneath the choropleth */
    showBasemap: boolean
    /** Hover popup content for a feature's properties */
    renderPopup: (properties: GeoJsonProperties) => HTMLElement
}

/**
 * MapLibre choropleth of pre-colored GeoJSON features: the map lifecycle,
 * layers, hover popup and viewport fitting, with no opinion about what the
 * colors mean. Callers compute `color` per feature and render the popup.
 *
 * The viewport is fitted once per feature set — to the context feature when
 * there is one — so stepping through periods never moves the map.
 */
export const ChoroplethMap = ({
    featureCollection,
    contextFeature,
    showBasemap,
    renderPopup,
}: ChoroplethMapProps) => {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const mapRef = useRef<MaplibreMap | null>(null)
    const fittedRef = useRef<string | null>(null)
    // Kept in a ref so a re-rendered popup renderer cannot force the map,
    // its layers and its event handlers to be torn down and rebuilt.
    const renderPopupRef = useRef(renderPopup)
    renderPopupRef.current = renderPopup
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

        if (contextFeature) {
            const contextSource = map.getSource(CONTEXT_SOURCE_ID) as
                GeoJSONSource | undefined
            if (contextSource) {
                contextSource.setData(contextFeature)
            } else {
                map.addSource(CONTEXT_SOURCE_ID, {
                    type: 'geojson',
                    data: contextFeature,
                })
                addContextLayers(map)
            }
        } else {
            removeContextLayers(map)
        }

        const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined
        if (source) {
            source.setData(featureCollection)
        } else {
            map.addSource(SOURCE_ID, {
                type: 'geojson',
                data: featureCollection,
            })
            addChoroplethLayers(map, (properties) =>
                renderPopupRef.current(properties)
            )
        }

        // Fit once per context/feature set (not on each period step)
        const signature = [
            contextFeature ? String(contextFeature.id) : '',
            ...featureCollection.features.map((feature) => String(feature.id)),
        ].join(',')
        if (signature && fittedRef.current !== signature) {
            fittedRef.current = signature
            const box = boundsOfFeatures(
                contextFeature ? [contextFeature] : featureCollection.features
            )
            if (box) {
                map.fitBounds(
                    new LngLatBounds(
                        [box.west, box.south],
                        [box.east, box.north]
                    ),
                    { padding: 24, duration: 0, maxZoom: 9 }
                )
            }
        }
    }, [contextFeature, featureCollection, mapReady])

    return <div ref={containerRef} className={styles.map} />
}
