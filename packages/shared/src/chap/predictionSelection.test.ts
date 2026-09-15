import assert from 'node:assert/strict'
import test from 'node:test'
import type { PredictionInfo } from '../chap-api'
import {
    LATEST_PREDICTION,
    PredictionSelectionSchema,
    getLatestPrediction,
    resolvePrediction,
    sortPredictionsNewestFirst,
} from './predictionSelection.ts'

/** Only the fields the ordering rules read; the rest of PredictionInfo is joined metadata. */
const prediction = (id: number, created: string): PredictionInfo =>
    ({ id, created }) as PredictionInfo

const ids = (predictions: PredictionInfo[]) => predictions.map((p) => p.id)

test('sortPredictionsNewestFirst orders by created, newest first', () => {
    const sorted = sortPredictionsNewestFirst([
        prediction(1, '2026-01-01T00:00:00Z'),
        prediction(2, '2026-03-01T00:00:00Z'),
        prediction(3, '2026-02-01T00:00:00Z'),
    ])

    assert.deepEqual(ids(sorted), [2, 3, 1])
})

test('sortPredictionsNewestFirst does not mutate its input', () => {
    const predictions = [
        prediction(1, '2026-01-01T00:00:00Z'),
        prediction(2, '2026-03-01T00:00:00Z'),
    ]
    sortPredictionsNewestFirst(predictions)

    assert.deepEqual(ids(predictions), [1, 2])
})

test('predictions created in the same instant fall back to the higher id', () => {
    const sorted = sortPredictionsNewestFirst([
        prediction(7, '2026-01-01T00:00:00Z'),
        prediction(9, '2026-01-01T00:00:00Z'),
        prediction(8, '2026-01-01T00:00:00Z'),
    ])

    assert.deepEqual(ids(sorted), [9, 8, 7])
})

test('an unparseable timestamp orders by id instead of dropping the entry', () => {
    const sorted = sortPredictionsNewestFirst([
        prediction(4, 'not a timestamp'),
        prediction(6, '2026-01-01T00:00:00Z'),
    ])

    assert.deepEqual(ids(sorted), [6, 4])
})

test('getLatestPrediction returns undefined when CHAP has no predictions', () => {
    assert.equal(getLatestPrediction([]), undefined)
})

test("resolvePrediction follows the newest run for 'latest'", () => {
    const predictions = [
        prediction(1, '2026-01-01T00:00:00Z'),
        prediction(2, '2026-03-01T00:00:00Z'),
    ]

    assert.equal(
        resolvePrediction(predictions, LATEST_PREDICTION)?.id,
        2,
        'expected the most recently created prediction'
    )
})

test('resolvePrediction pins to the configured id', () => {
    const predictions = [
        prediction(1, '2026-01-01T00:00:00Z'),
        prediction(2, '2026-03-01T00:00:00Z'),
    ]

    assert.equal(resolvePrediction(predictions, 1)?.id, 1)
})

test('resolvePrediction reports a deleted pinned prediction as missing', () => {
    assert.equal(
        resolvePrediction([prediction(1, '2026-01-01T00:00:00Z')], 99),
        undefined
    )
})

test("PredictionSelectionSchema accepts 'latest' and ids, rejects anything else", () => {
    assert.equal(PredictionSelectionSchema.parse(LATEST_PREDICTION), 'latest')
    assert.equal(PredictionSelectionSchema.parse(12), 12)
    assert.equal(PredictionSelectionSchema.safeParse('12').success, false)
    assert.equal(PredictionSelectionSchema.safeParse(undefined).success, false)
})
