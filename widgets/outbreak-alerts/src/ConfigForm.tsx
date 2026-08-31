import {
    PredictionsService,
    LoadingState,
    ErrorState,
    type ConfigFormProps,
} from '@chap-widgets/shared'
import i18n from '@dhis2/d2-i18n'
import {
    Button,
    InputField,
    SingleSelectField,
    SingleSelectOption,
} from '@dhis2/ui'
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
    const [predictionId, setPredictionId] = useState<number | undefined>(
        config?.predictionId
    )
    const [threshold, setThreshold] = useState(
        config ? String(config.threshold) : ''
    )

    const predictionsQuery = useQuery({
        queryKey: ['chap', 'predictions'],
        queryFn: () => PredictionsService.getPredictionsV1CrudPredictionsGet(),
    })
    const predictions = predictionsQuery.data ?? []
    const selectedPrediction = predictions.find(
        (prediction) => prediction.id === predictionId
    )

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

    const parsedThreshold = Number(threshold)
    const canSave =
        predictionId !== undefined &&
        threshold !== '' &&
        Number.isFinite(parsedThreshold) &&
        parsedThreshold >= 0

    return (
        <div className={styles.form}>
            <SingleSelectField
                label={i18n.t('Prediction')}
                selected={
                    selectedPrediction
                        ? String(selectedPrediction.id)
                        : undefined
                }
                onChange={({ selected }) => setPredictionId(Number(selected))}
            >
                {predictions.map((prediction) => (
                    <SingleSelectOption
                        key={prediction.id}
                        value={String(prediction.id)}
                        label={`${prediction.name} (${prediction.modelId})`}
                    />
                ))}
            </SingleSelectField>
            <InputField
                label={i18n.t('Alert threshold (predicted cases)')}
                type="number"
                value={threshold}
                onChange={({ value }) => setThreshold(value ?? '')}
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
                    if (predictionId === undefined) {
                        return
                    }
                    onSave({
                        version: 1,
                        widget: 'chap-widget-outbreak-alerts',
                        title: title.trim() || undefined,
                        predictionId,
                        threshold: parsedThreshold,
                    })
                }}
            >
                {i18n.t('Save')}
            </Button>
        </div>
    )
}
