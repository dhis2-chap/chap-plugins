import {
    PredictionsService,
    PredictionSelectField,
    ThresholdParamsFields,
    resolvePrediction,
    DEFAULT_THRESHOLD,
    LATEST_PREDICTION,
    LoadingState,
    ErrorState,
    type ConfigFormProps,
    type PredictionSelection,
    type ThresholdParams,
} from '@chap-widgets/shared'
import i18n from '@dhis2/d2-i18n'
import { Button, InputField } from '@dhis2/ui'
import { useQuery } from '@tanstack/react-query'
import React, { useState } from 'react'
import { type Config } from './config'
import styles from './ConfigForm.module.css'

export const ConfigForm = ({
    config,
    onSave,
    isSaving,
}: ConfigFormProps<Config>) => {
    const [title, setTitle] = useState(config?.title ?? '')
    const [selection, setSelection] = useState<PredictionSelection>(
        config?.predictionId ?? LATEST_PREDICTION
    )
    const [threshold, setThreshold] = useState<ThresholdParams | undefined>(
        config?.threshold ?? DEFAULT_THRESHOLD
    )

    const predictionsQuery = useQuery({
        queryKey: ['chap', 'predictions'],
        queryFn: () => PredictionsService.getPredictionsV1CrudPredictionsGet(),
    })
    const predictions = predictionsQuery.data ?? []
    const selectedPrediction = resolvePrediction(predictions, selection)

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

    const canSave = !!selectedPrediction && !!threshold

    return (
        <div className={styles.form}>
            <PredictionSelectField
                predictions={predictions}
                value={selection}
                onChange={setSelection}
            />
            <ThresholdParamsFields
                params={config?.threshold}
                onChange={setThreshold}
            />
            <InputField
                label={i18n.t('Widget title (optional)')}
                value={title}
                onChange={({ value }) => setTitle(value ?? '')}
            />
            <Button
                primary
                loading={isSaving}
                disabled={!canSave}
                onClick={() => {
                    if (!selectedPrediction || !threshold) {
                        return
                    }
                    onSave({
                        version: 1,
                        widget: 'chap-widget-outbreak-alerts',
                        title: title.trim() || undefined,
                        predictionId: selection,
                        threshold,
                    })
                }}
            >
                {i18n.t('Save')}
            </Button>
        </div>
    )
}
