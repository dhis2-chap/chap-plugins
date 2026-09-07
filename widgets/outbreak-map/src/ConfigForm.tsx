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
import {
    DEFAULT_THRESHOLD_PARAMS,
    DEFAULT_THRESHOLD_STRATEGY,
    type Config,
    type ThresholdParams,
    type ThresholdStrategy,
} from './config'
import styles from './ConfigForm.module.css'

const LATEST = 'latest'

type FormValues = {
    stdMultiplier: string
    lowerPercentile: string
    upperPercentile: string
    baselineYears: string
}

type FormErrors = Partial<Record<keyof FormValues, string>>

const formatPercent = (fraction: number): string =>
    String(Math.round(fraction * 1000) / 10)

const toFormValues = (params: ThresholdParams): FormValues => {
    const seasonal =
        params.type === 'seasonal' ? params : DEFAULT_THRESHOLD_PARAMS.seasonal
    const percentile =
        params.type === 'percentile'
            ? params
            : DEFAULT_THRESHOLD_PARAMS.percentile
    return {
        stdMultiplier: String(seasonal.stdMultiplier),
        lowerPercentile: formatPercent(percentile.quantile[0]),
        upperPercentile: formatPercent(percentile.quantile[1]),
        baselineYears:
            percentile.baselineYears === null
                ? ''
                : String(percentile.baselineYears),
    }
}

const parseNumber = (raw: string): number | undefined => {
    const trimmed = raw.trim()
    if (trimmed === '') {
        return undefined
    }
    const value = Number(trimmed)
    return Number.isFinite(value) ? value : undefined
}

/**
 * Turn the raw form fields of one strategy into threshold params, or into
 * per-field messages. Mirrors the modeling app's parsing, including the
 * empty-baseline-means-all-history convention.
 */
const parseThresholdParams = (
    strategy: ThresholdStrategy,
    values: FormValues
): { params?: ThresholdParams; errors?: FormErrors } => {
    if (strategy === 'seasonal') {
        const stdMultiplier = parseNumber(values.stdMultiplier)
        if (stdMultiplier === undefined || stdMultiplier < 0) {
            return {
                errors: {
                    stdMultiplier: i18n.t('Enter a number of 0 or more'),
                },
            }
        }
        return { params: { type: 'seasonal', stdMultiplier } }
    }

    const errors: FormErrors = {}
    const lower = parseNumber(values.lowerPercentile)
    const upper = parseNumber(values.upperPercentile)
    const outOfRange = i18n.t('Enter a percentage between 0 and 100')

    if (lower === undefined || lower < 0 || lower > 100) {
        errors.lowerPercentile = outOfRange
    }
    if (upper === undefined || upper < 0 || upper > 100) {
        errors.upperPercentile = outOfRange
    }
    if (lower !== undefined && upper !== undefined && lower >= upper) {
        errors.lowerPercentile = i18n.t(
            'Must be lower than the upper percentile'
        )
    }

    let baselineYears: number | null = null
    if (values.baselineYears.trim() !== '') {
        const parsed = parseNumber(values.baselineYears)
        if (parsed === undefined || !Number.isInteger(parsed) || parsed < 1) {
            errors.baselineYears = i18n.t(
                'Enter a whole number of 1 or more, or leave empty to use all history'
            )
        } else {
            baselineYears = parsed
        }
    }

    if (Object.keys(errors).length > 0) {
        return { errors }
    }
    return {
        params: {
            type: 'percentile',
            quantile: [(lower as number) / 100, (upper as number) / 100],
            baselineYears,
        },
    }
}

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
    const [strategy, setStrategy] = useState<ThresholdStrategy>(
        config?.threshold.type ?? DEFAULT_THRESHOLD_STRATEGY
    )
    const [values, setValues] = useState<FormValues>(() =>
        toFormValues(
            config?.threshold ??
                DEFAULT_THRESHOLD_PARAMS[DEFAULT_THRESHOLD_STRATEGY]
        )
    )

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
    const { params, errors } = parseThresholdParams(strategy, values)

    const update = (field: keyof FormValues) => (value: string) =>
        setValues((current) => ({ ...current, [field]: value }))

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
            <SingleSelectField
                label={i18n.t('Endemic threshold')}
                helpText={i18n.t(
                    'Computed from the dataset’s own history, the same way the modeling app computes it.'
                )}
                selected={strategy}
                onChange={({ selected }) =>
                    setStrategy(selected as ThresholdStrategy)
                }
            >
                <SingleSelectOption
                    value="seasonal"
                    label={i18n.t('Seasonal mean + standard deviations')}
                />
                <SingleSelectOption
                    value="percentile"
                    label={i18n.t('Seasonal percentile (endemic channel)')}
                />
            </SingleSelectField>
            {strategy === 'seasonal' ? (
                <InputField
                    label={i18n.t('Standard deviations above the mean')}
                    type="number"
                    value={values.stdMultiplier}
                    error={!!errors?.stdMultiplier}
                    validationText={errors?.stdMultiplier}
                    onChange={({ value }) =>
                        update('stdMultiplier')(value ?? '')
                    }
                />
            ) : (
                <>
                    <InputField
                        label={i18n.t('Lower percentile (%)')}
                        type="number"
                        value={values.lowerPercentile}
                        error={!!errors?.lowerPercentile}
                        validationText={errors?.lowerPercentile}
                        onChange={({ value }) =>
                            update('lowerPercentile')(value ?? '')
                        }
                    />
                    <InputField
                        label={i18n.t('Upper percentile (%)')}
                        helpText={i18n.t(
                            'The upper line is the alert threshold the map colors against.'
                        )}
                        type="number"
                        value={values.upperPercentile}
                        error={!!errors?.upperPercentile}
                        validationText={errors?.upperPercentile}
                        onChange={({ value }) =>
                            update('upperPercentile')(value ?? '')
                        }
                    />
                    <InputField
                        label={i18n.t('Baseline years')}
                        helpText={i18n.t(
                            'Leave empty to use all available history.'
                        )}
                        type="number"
                        value={values.baselineYears}
                        error={!!errors?.baselineYears}
                        validationText={errors?.baselineYears}
                        onChange={({ value }) =>
                            update('baselineYears')(value ?? '')
                        }
                    />
                </>
            )}
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
                disabled={!selectionIsValid || !params}
                onClick={() => {
                    if (!params) {
                        return
                    }
                    onSave({
                        version: 1,
                        widget: 'chap-widget-outbreak-map',
                        title: title.trim() || undefined,
                        predictionId:
                            selection === LATEST ? LATEST : Number(selection),
                        showBasemap,
                        threshold: params,
                    })
                }}
            >
                {i18n.t('Save')}
            </Button>
        </div>
    )
}
