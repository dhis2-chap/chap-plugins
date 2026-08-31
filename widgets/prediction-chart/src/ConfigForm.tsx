import {
    PredictionsService,
    useOrgUnitNames,
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
    const [orgUnitId, setOrgUnitId] = useState<string | undefined>(
        config?.orgUnitId
    )

    const predictionsQuery = useQuery({
        queryKey: ['chap', 'predictions'],
        queryFn: () => PredictionsService.getPredictionsV1CrudPredictionsGet(),
    })
    const predictions = predictionsQuery.data ?? []
    const selectedPrediction = predictions.find(
        (prediction) => prediction.id === predictionId
    )
    const orgUnitIds =
        selectedPrediction?.orgUnits ??
        selectedPrediction?.dataset.orgUnits ??
        []
    const orgUnitNamesQuery = useOrgUnitNames(orgUnitIds)

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

    const orgUnitName = (id: string) => orgUnitNamesQuery.data?.get(id) ?? id
    const canSave = predictionId !== undefined && !!orgUnitId

    return (
        <div className={styles.form}>
            <SingleSelectField
                label={i18n.t('Prediction')}
                selected={
                    selectedPrediction
                        ? String(selectedPrediction.id)
                        : undefined
                }
                onChange={({ selected }) => {
                    setPredictionId(Number(selected))
                    setOrgUnitId(undefined)
                }}
            >
                {predictions.map((prediction) => (
                    <SingleSelectOption
                        key={prediction.id}
                        value={String(prediction.id)}
                        label={`${prediction.name} (${prediction.modelId})`}
                    />
                ))}
            </SingleSelectField>
            <SingleSelectField
                label={i18n.t('Organisation unit')}
                disabled={!selectedPrediction}
                selected={
                    orgUnitId && orgUnitIds.includes(orgUnitId)
                        ? orgUnitId
                        : undefined
                }
                onChange={({ selected }) => setOrgUnitId(selected)}
            >
                {orgUnitIds.map((id) => (
                    <SingleSelectOption
                        key={id}
                        value={id}
                        label={orgUnitName(id)}
                    />
                ))}
            </SingleSelectField>
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
                    if (predictionId === undefined || !orgUnitId) {
                        return
                    }
                    onSave({
                        version: 1,
                        widget: 'chap-widget-prediction-chart',
                        title: title.trim() || undefined,
                        predictionId,
                        orgUnitId,
                        orgUnitName: orgUnitNamesQuery.data?.get(orgUnitId),
                    })
                }}
            >
                {i18n.t('Save')}
            </Button>
        </div>
    )
}
