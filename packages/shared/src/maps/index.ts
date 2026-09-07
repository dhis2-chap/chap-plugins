/**
 * MapLibre building blocks, exposed as `@chap-widgets/shared/maps` rather
 * than from the package root: importing this module registers maplibre's web
 * worker as a side effect, which pins ~1 MB of maplibre into the importing
 * widget's bundle. Only widgets that actually draw a map should pay for it.
 */
export { ChoroplethMap, MAP_NO_DATA_COLOR } from './ChoroplethMap'
export type { ChoroplethMapProps } from './ChoroplethMap'
export { MapLegend } from './MapLegend'
export type { MapLegendProps, MapLegendRow } from './MapLegend'
export { createMapPopup } from './mapPopup'
export type { MapPopupRow } from './mapPopup'
export { boundsOfFeatures } from './bounds'
export type { BoundingBox } from './bounds'
