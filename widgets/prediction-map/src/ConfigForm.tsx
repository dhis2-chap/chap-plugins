import {
    PredictionsService,
    LoadingState,
    ErrorState,
    type ConfigFormProps,
} from '@chap-widgets/shared'
import i18n from '@dhis2/d2-i18n'
import {
    Button,
    Checkbox,
    InputField,
    SingleSelectField,
    SingleSelectOption,
} from '@dhis2/ui'
import { useQuery } from '@tanstack/react-query'
import React, { useState } from 'react'
import { type Config } from './config'
import styles from './ConfigForm.module.css'

const LATEST = 'latest'

export const ConfigForm = ({
    config,
    onSave,
    isSaving,
}: ConfigFormProps<Config>) => {
    const [title, setTitle] = useState(config?.title ?? '')
    const [selection, setSelection] = useState<string>(
        config === null || config.predictionId === LATEST
            ? LATEST
            : String(config.predictionId)
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

    const predictions = [...(predictionsQuery.data ?? [])].sort((a, b) =>
        b.created.localeCompare(a.created)
    )
    const selectionIsValid =
        selection === LATEST ||
        predictions.some((prediction) => String(prediction.id) === selection)

    return (
        <div className={styles.form}>
            <SingleSelectField
                label={i18n.t('Prediction')}
                helpText={i18n.t(
                    '“Latest prediction” switches to new runs automatically.'
                )}
                selected={selectionIsValid ? selection : undefined}
                onChange={({ selected }) => setSelection(selected)}
            >
                <SingleSelectOption
                    value={LATEST}
                    label={i18n.t('Latest prediction (automatic)')}
                />
                {predictions.map((prediction) => (
                    <SingleSelectOption
                        key={prediction.id}
                        value={String(prediction.id)}
                        label={`${prediction.name} (${prediction.modelId})`}
                    />
                ))}
            </SingleSelectField>
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
                        predictionId:
                            selection === LATEST ? LATEST : Number(selection),
                        showBasemap,
                    })
                }}
            >
                {i18n.t('Save')}
            </Button>
        </div>
    )
}
