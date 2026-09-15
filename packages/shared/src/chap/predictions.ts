import { useQuery } from '@tanstack/react-query'
import { PredictionsService } from '../chap-api'
// Explicit extension so `node --test` can load this module's tests directly
import {
    LATEST_PREDICTION,
    resolvePrediction,
    type PredictionSelection,
} from './predictionSelection.ts'

const PREDICTIONS_STALE_TIME = 5 * 60 * 1000

/**
 * Resolve a widget's {@link PredictionSelection} to the prediction it should
 * render. While following the latest run the list is refetched periodically,
 * so a dashboard left open picks up new CHAP runs on its own.
 *
 * Every selection resolves through the list, a pinned id included, so that a
 * prediction deleted in CHAP is reported as missing rather than requested and
 * failed. That costs nothing extra: `['chap', 'predictions']` is one query key
 * shared by every widget on the dashboard.
 */
export const useResolvedPredictionId = (selection: PredictionSelection) => {
    const followsLatest = selection === LATEST_PREDICTION
    const predictionsQuery = useQuery({
        queryKey: ['chap', 'predictions'],
        queryFn: () => PredictionsService.getPredictionsV1CrudPredictionsGet(),
        staleTime: PREDICTIONS_STALE_TIME,
        refetchInterval: followsLatest ? PREDICTIONS_STALE_TIME : false,
    })
    const prediction = resolvePrediction(predictionsQuery.data ?? [], selection)

    return {
        /** The resolved prediction, once the list has arrived */
        prediction,
        /** Shorthand for `prediction?.id` — undefined until it resolves */
        predictionId: prediction?.id,
        /** Whether the widget tracks new runs, for the "nothing to show" copy */
        followsLatest,
        isLoading: predictionsQuery.isLoading,
        isError: predictionsQuery.isError,
    }
}
