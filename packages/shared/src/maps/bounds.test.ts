import assert from 'node:assert/strict'
import test from 'node:test'
import type { Feature, Geometry } from 'geojson'
import { boundsOfFeatures } from './bounds.ts'

const feature = (geometry: Geometry): Feature => ({
    type: 'Feature',
    geometry,
    properties: {},
})

const polygon = feature({
    type: 'Polygon',
    coordinates: [
        [
            [10, 60],
            [12, 60],
            [12, 62],
            [10, 62],
            [10, 60],
        ],
    ],
})

test('boundsOfFeatures spans a single polygon', () => {
    assert.deepEqual(boundsOfFeatures([polygon]), {
        west: 10,
        south: 60,
        east: 12,
        north: 62,
    })
})

test('boundsOfFeatures spans several features of mixed geometry type', () => {
    const point = feature({ type: 'Point', coordinates: [30, 58] })
    assert.deepEqual(boundsOfFeatures([polygon, point]), {
        west: 10,
        south: 58,
        east: 30,
        north: 62,
    })
})

test('boundsOfFeatures walks arbitrarily nested coordinates', () => {
    const multiPolygon = feature({
        type: 'MultiPolygon',
        coordinates: [
            [
                [
                    [-5, -1],
                    [-4, -1],
                    [-4, 0],
                    [-5, -1],
                ],
            ],
        ],
    })
    assert.deepEqual(boundsOfFeatures([multiPolygon]), {
        west: -5,
        south: -1,
        east: -4,
        north: 0,
    })
})

test('boundsOfFeatures returns null when nothing has coordinates', () => {
    assert.equal(boundsOfFeatures([]), null)
    assert.equal(
        boundsOfFeatures([
            feature({ type: 'GeometryCollection', geometries: [] }),
        ]),
        null
    )
})

test('boundsOfFeatures ignores malformed coordinates', () => {
    const broken = {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[[10], ['x', 'y']]] },
        properties: {},
    } as unknown as Feature
    assert.equal(boundsOfFeatures([broken]), null)
})
