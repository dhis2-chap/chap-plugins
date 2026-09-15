import {
    PredictionsService,
    PredictionSelectField,
    LATEST_PREDICTION,
    LoadingState,
    ErrorState,
    type ConfigFormProps,
    type PredictionSelection,
} from '@chap-widgets/shared'
import i18n from '@dhis2/d2-i18n'
import { Button, Checkbox, InputField } from '@dhis2/ui'
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
    const [showBasemap, setShowBasemap] = useState(config?.showBasemap ?? true)

    const predictionsQuery = useQuery({
        queryKey: ['chap', 'predictions'],
        queryFn: () => PredictionsService.getPredictionsV1CrudPredictionsGet(),
    })

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

    const predictions = predictionsQuery.data ?? []
    const selectionIsValid =
        selection === LATEST_PREDICTION ||
        predictions.some((prediction) => prediction.id === selection)

    return (
        <div className={styles.form}>
            <PredictionSelectField
                predictions={predictions}
                value={selection}
                onChange={setSelection}
            />
            <Checkbox
                label={i18n.t('Show background map (OpenStreetMap tiles)')}
                checked={showBasemap}
                onChange={({ checked }) => setShowBasemap(!!checked)}
            />
            <InputField
                label={i18n.t('Widget title (optional)')}
                value={title}
                onChange={({ value }) => setTitle(value ?? '')}
            />
            <Button
                primary
                loading={isSaving}
                disabled={!selectionIsValid}
                onClick={() => {
                    onSave({
                        version: 1,
                        widget: 'chap-widget-prediction-map',
                        title: title.trim() || undefined,
                        predictionId: selection,
                        showBasemap,
                    })
                }}
            >
                {i18n.t('Save')}
            </Button>
        </div>
    )
}
