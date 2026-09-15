import { useQuery } from '@tanstack/react-query'
import type { PredictionInfo } from '../chap-api'
import { PredictionsService } from '../chap-api'

const PREDICTIONS_STALE_TIME = 5 * 60 * 1000

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
 * Resolve an optional pinned prediction id. When no id is configured, the
 * prediction list is refreshed periodically and the newest run is selected.
 *
 * The list is fetched for a pinned id too, so callers that need more of the
 * prediction than its id — its dataset, to ask CHAP for thresholds — get the
 * record itself. It is one extra shared query key, and a pinned widget still
 * never waits on it: `isLoading` and `isError` stay false there, since the id
 * it renders from is already known.
 */
export const useResolvedPredictionId = (configuredPredictionId?: number) => {
    const followsLatest = configuredPredictionId === undefined
    const predictionsQuery = useQuery({
        queryKey: ['chap', 'predictions'],
        queryFn: () => PredictionsService.getPredictionsV1CrudPredictionsGet(),
        staleTime: PREDICTIONS_STALE_TIME,
        refetchInterval: followsLatest ? PREDICTIONS_STALE_TIME : false,
    })
    const predictions = predictionsQuery.data ?? []
    const latestPrediction = getLatestPrediction(predictions)

    return {
        predictionId: configuredPredictionId ?? latestPrediction?.id,
        /** The resolved prediction record, once the list has arrived */
        prediction: followsLatest
            ? latestPrediction
            : predictions.find(
                  (prediction) => prediction.id === configuredPredictionId
              ),
        latestPrediction,
        isLoading:
            followsLatest && predictionsQuery.isLoading && !latestPrediction,
        isError: followsLatest && predictionsQuery.isError && !latestPrediction,
    }
}
