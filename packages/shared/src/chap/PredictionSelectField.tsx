import i18n from '@dhis2/d2-i18n'
import { SingleSelectField, SingleSelectOption } from '@dhis2/ui'
import React from 'react'
import type { PredictionInfo } from '../chap-api'
import {
    LATEST_PREDICTION,
    sortPredictionsNewestFirst,
    type PredictionSelection,
} from './predictionSelection'

export type PredictionSelectFieldProps = {
    /** The prediction list as CHAP returned it; ordering is applied here */
    predictions: PredictionInfo[]
    value: PredictionSelection
    onChange: (selection: PredictionSelection) => void
}

/**
 * The "which prediction?" picker shared by every widget that renders one, so
 * the wording and the ordering of the list are the same in each config form.
 *
 * A pinned prediction that is no longer in the list leaves the field empty
 * rather than silently falling back to the latest run — the parent disables
 * saving on that, which is what makes the user pick again.
 */
export const PredictionSelectField = ({
    predictions,
    value,
    onChange,
}: PredictionSelectFieldProps) => {
    const sorted = sortPredictionsNewestFirst(predictions)
    const isResolvable =
        value === LATEST_PREDICTION ||
        sorted.some((prediction) => prediction.id === value)

    return (
        <SingleSelectField
            label={i18n.t('Prediction')}
            helpText={i18n.t(
                '“Latest prediction” follows new CHAP runs automatically; pinning keeps this widget on one prediction.'
            )}
            selected={isResolvable ? String(value) : undefined}
            onChange={({ selected }) =>
                onChange(
                    selected === LATEST_PREDICTION
                        ? LATEST_PREDICTION
                        : Number(selected)
                )
            }
        >
            <SingleSelectOption
                value={LATEST_PREDICTION}
                label={i18n.t('Latest prediction (automatic)')}
            />
            {sorted.map((prediction) => (
                <SingleSelectOption
                    key={prediction.id}
                    value={String(prediction.id)}
                    label={`${prediction.name} (${prediction.modelId})`}
                />
            ))}
        </SingleSelectField>
    )
}
