import {
    PredictionsService,
    PredictionSelectField,
    resolvePrediction,
    useOrgUnitNames,
    LATEST_PREDICTION,
    LoadingState,
    ErrorState,
    type ConfigFormProps,
    type PredictionSelection,
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
    const [selection, setSelection] = useState<PredictionSelection>(
        config?.predictionId ?? LATEST_PREDICTION
    )
    const [orgUnitId, setOrgUnitId] = useState<string | undefined>(
        config?.orgUnitId
    )

    const predictionsQuery = useQuery({
        queryKey: ['chap', 'predictions'],
        queryFn: () => PredictionsService.getPredictionsV1CrudPredictionsGet(),
    })
    const predictions = predictionsQuery.data ?? []
    const selectedPrediction = resolvePrediction(predictions, selection)
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
    const canSave = !!selectedPrediction && !!orgUnitId

    return (
        <div className={styles.form}>
            <PredictionSelectField
                predictions={predictions}
                value={selection}
                onChange={(next) => {
                    setSelection(next)
                    setOrgUnitId(undefined)
                }}
            />
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
                    if (!selectedPrediction || !orgUnitId) {
                        return
                    }
                    onSave({
                        version: 1,
                        widget: 'chap-widget-prediction-chart',
                        title: title.trim() || undefined,
                        predictionId: selection,
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
