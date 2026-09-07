import type { Feature } from 'geojson'

/** Geographic extent in degrees, ready to hand to `map.fitBounds` */
export type BoundingBox = {
    west: number
    south: number
    east: number
    north: number
}

const extend = (box: BoundingBox | null, lng: number, lat: number) =>
    box === null
        ? { west: lng, south: lat, east: lng, north: lat }
        : {
              west: Math.min(box.west, lng),
              south: Math.min(box.south, lat),
              east: Math.max(box.east, lng),
              north: Math.max(box.north, lat),
          }

/**
 * Walk a GeoJSON `coordinates` value of any nesting depth — Point through
 * MultiPolygon — without branching on the geometry type. Anything that is not
 * a numeric [lng, lat] pair is skipped: DHIS2 org unit geometry is
 * user-maintained and occasionally malformed, and a NaN in the box would
 * make `fitBounds` throw and take the whole map down.
 */
const extendWithCoordinates = (
    box: BoundingBox | null,
    coordinates: unknown
): BoundingBox | null => {
    if (!Array.isArray(coordinates) || coordinates.length === 0) {
        return box
    }
    if (typeof coordinates[0] === 'number') {
        const [lng, lat] = coordinates
        return typeof lat === 'number' &&
            Number.isFinite(lng) &&
            Number.isFinite(lat)
            ? extend(box, lng, lat)
            : box
    }
    return coordinates.reduce<BoundingBox | null>(
        (accumulated, nested) => extendWithCoordinates(accumulated, nested),
        box
    )
}

/** Bounding box covering every feature, or `null` if none has coordinates */
export const boundsOfFeatures = (
    features: Iterable<Feature>
): BoundingBox | null => {
    let box: BoundingBox | null = null
    for (const feature of features) {
        box = extendWithCoordinates(
            box,
            feature.geometry && 'coordinates' in feature.geometry
                ? feature.geometry.coordinates
                : undefined
        )
    }
    return box
}
