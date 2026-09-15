import i18n from '@dhis2/d2-i18n'
import { InputField, SingleSelectField, SingleSelectOption } from '@dhis2/ui'
import React, { useState } from 'react'
import {
    DEFAULT_THRESHOLD,
    parseThresholdParams,
    toThresholdFormValues,
    type ThresholdFormValues,
    type ThresholdParams,
    type ThresholdStrategy,
} from './thresholdParams'

export type ThresholdParamsFieldsProps = {
    /** Saved params to seed the fields from; the defaults when never configured */
    params: ThresholdParams | undefined
    /** Parsed params on every edit, or `undefined` while a field is invalid */
    onChange: (params: ThresholdParams | undefined) => void
}

/**
 * The strategy picker and its parameter fields, shared by every widget that
 * compares a forecast against CHAP's endemic threshold. The parent holds the
 * parsed params — it gets `undefined` while the form is invalid and disables
 * saving on that — while the raw text of each field stays in here.
 *
 * The fields are seeded once, so the parent must start its own state from the
 * same saved params (or {@link DEFAULT_THRESHOLD}) for an untouched form to
 * save what it displays.
 */
export const ThresholdParamsFields = ({
    params,
    onChange,
}: ThresholdParamsFieldsProps) => {
    const [strategy, setStrategy] = useState<ThresholdStrategy>(
        params?.type ?? DEFAULT_THRESHOLD.type
    )
    const [values, setValues] = useState<ThresholdFormValues>(() =>
        toThresholdFormValues(params ?? DEFAULT_THRESHOLD)
    )
    const { errors } = parseThresholdParams(strategy, values)

    const apply = (
        nextStrategy: ThresholdStrategy,
        nextValues: ThresholdFormValues
    ) => {
        setStrategy(nextStrategy)
        setValues(nextValues)
        onChange(parseThresholdParams(nextStrategy, nextValues).params)
    }

    const update = (field: keyof ThresholdFormValues) => (value: string) =>
        apply(strategy, { ...values, [field]: value })

    return (
        <>
            <SingleSelectField
                label={i18n.t('Endemic threshold')}
                helpText={i18n.t(
                    'Computed from the dataset’s own history, the same way the modeling app computes it.'
                )}
                selected={strategy}
                onChange={({ selected }) =>
                    apply(selected as ThresholdStrategy, values)
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
                            'The upper line is the alert threshold; the lower one keeps the params identical to the modeling app’s endemic channel.'
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
        </>
    )
}
