/**
 * How every widget stores *which* prediction it renders, plus the ordering
 * rules for resolving "the latest one".
 *
 * Deliberately free of React and of value imports from the generated client,
 * so `node --test` can load it directly.
 */
import { z } from 'zod'
import type { PredictionInfo } from '../chap-api'

/** Config value meaning "whichever prediction CHAP ran most recently" */
export const LATEST_PREDICTION = 'latest'

/**
 * Which prediction a widget renders: the literal `'latest'` to follow new
 * runs, or a prediction id to pin one.
 *
 * A required field with an explicit literal, rather than an optional id whose
 * absence means "latest". Following the newest run is a choice the user made,
 * so it gets written down — and a config that merely *omits* the key is then
 * a config that failed to write, which renders as "not configured" instead of
 * silently following whatever CHAP happened to run last.
 */
export const PredictionSelectionSchema = z.union([
    z.literal(LATEST_PREDICTION),
    z.number(),
])

export type PredictionSelection = z.infer<typeof PredictionSelectionSchema>

/**
 * Orders two predictions newest-first by `created`, with the id as tiebreak —
 * and as the whole comparison when a timestamp is missing or unparseable, so
 * the answer never depends on the order CHAP happened to return them in.
 */
const comparePredictionRecency = (
    first: PredictionInfo,
    second: PredictionInfo
) => {
    const createdDifference =
        Date.parse(first.created) - Date.parse(second.created)

    return Number.isNaN(createdDifference)
        ? first.id - second.id
        : createdDifference || first.id - second.id
}

/** Return a new array with the most recently created prediction first. */
export const sortPredictionsNewestFirst = (
    predictions: PredictionInfo[]
): PredictionInfo[] =>
    [...predictions].sort((a, b) => comparePredictionRecency(b, a))

/** Resolve the newest prediction without relying on API response ordering. */
export const getLatestPrediction = (
    predictions: PredictionInfo[]
): PredictionInfo | undefined => sortPredictionsNewestFirst(predictions)[0]

/**
 * Resolve a selection against the prediction list. Returns `undefined` when
 * CHAP has no predictions at all, or when a pinned one has been deleted —
 * callers tell those apart by the selection they passed in.
 */
export const resolvePrediction = (
    predictions: PredictionInfo[],
    selection: PredictionSelection
): PredictionInfo | undefined =>
    selection === LATEST_PREDICTION
        ? getLatestPrediction(predictions)
        : predictions.find((prediction) => prediction.id === selection)
