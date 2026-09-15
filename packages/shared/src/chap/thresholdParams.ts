/**
 * The endemic-threshold strategies CHAP's `/v1/analytics/thresholds` endpoint
 * offers, as a config schema plus the form parsing every widget that lets a
 * user pick one needs. Mirrors the modeling app's own `ThresholdParams`, so
 * identical values produce identical thresholds there and here — which is the
 * whole reason this lives in the shared package rather than in one widget.
 */
import i18n from '@dhis2/d2-i18n'
import { z } from 'zod'

const percentileFraction = z.number().min(0).max(1)

export const ThresholdParamsSchema = z
    .discriminatedUnion('type', [
        z.object({
            type: z.literal('seasonal'),
            /** Standard deviations above the seasonal mean */
            stdMultiplier: z.number().min(0),
        }),
        z.object({
            type: z.literal('percentile'),
            /** [lower, upper] percentiles of same-season history, as fractions */
            quantile: z.tuple([percentileFraction, percentileFraction]),
            /** Years of history the baseline uses; null uses all of it */
            baselineYears: z.number().int().min(1).nullable(),
        }),
    ])
    .refine(
        (params) =>
            params.type !== 'percentile' ||
            params.quantile[0] < params.quantile[1],
        { message: 'Lower percentile must be below the upper percentile' }
    )

export type ThresholdParams = z.infer<typeof ThresholdParamsSchema>
export type ThresholdStrategy = ThresholdParams['type']

/**
 * The modeling app's defaults, so an unconfigured widget and an untouched
 * prediction chart draw the same threshold. Seasonal is its default strategy;
 * percentile intentionally asks for the 25th–75th endemic-channel band.
 */
export const DEFAULT_THRESHOLD_PARAMS: {
    [K in ThresholdStrategy]: Extract<ThresholdParams, { type: K }>
} = {
    seasonal: { type: 'seasonal', stdMultiplier: 2 },
    percentile: {
        type: 'percentile',
        quantile: [0.25, 0.75],
        baselineYears: 5,
    },
}

export const DEFAULT_THRESHOLD_STRATEGY: ThresholdStrategy = 'seasonal'

/** The params a widget starts from when it has never been configured */
export const DEFAULT_THRESHOLD: ThresholdParams =
    DEFAULT_THRESHOLD_PARAMS[DEFAULT_THRESHOLD_STRATEGY]

const formatPercent = (fraction: number): string =>
    String(Math.round(fraction * 1000) / 10)

/** One-line summary of a threshold definition, for forms and views */
export const describeThresholdParams = (params: ThresholdParams): string => {
    if (params.type === 'seasonal') {
        return i18n.t('{{stdMultiplier}}σ above the seasonal mean', {
            stdMultiplier: params.stdMultiplier,
        })
    }
    const upper = formatPercent(params.quantile[1])
    return params.baselineYears === null
        ? i18n.t('{{upper}}th percentile, all-history baseline', { upper })
        : i18n.t('{{upper}}th percentile, {{count}}-year baseline', {
              upper,
              count: params.baselineYears,
          })
}

/** Raw text of every threshold field, for both strategies at once */
export type ThresholdFormValues = {
    stdMultiplier: string
    lowerPercentile: string
    upperPercentile: string
    baselineYears: string
}

export type ThresholdFormErrors = Partial<
    Record<keyof ThresholdFormValues, string>
>

/**
 * Seed the form from saved params. Fields of the strategy that is *not* saved
 * fall back to the defaults, so switching strategy in the form never lands on
 * an empty, unsaveable field.
 */
export const toThresholdFormValues = (
    params: ThresholdParams
): ThresholdFormValues => {
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

const parseSeasonal = (
    values: ThresholdFormValues
): { params?: ThresholdParams; errors?: ThresholdFormErrors } => {
    const stdMultiplier = parseNumber(values.stdMultiplier)
    if (stdMultiplier === undefined || stdMultiplier < 0) {
        return {
            errors: { stdMultiplier: i18n.t('Enter a number of 0 or more') },
        }
    }
    return { params: { type: 'seasonal', stdMultiplier } }
}

const parsePercentile = (
    values: ThresholdFormValues
): { params?: ThresholdParams; errors?: ThresholdFormErrors } => {
    const errors: ThresholdFormErrors = {}
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

/**
 * Turn the raw form fields of one strategy into threshold params, or into
 * per-field messages. Mirrors the modeling app's parsing, including the
 * empty-baseline-means-all-history convention.
 */
export const parseThresholdParams = (
    strategy: ThresholdStrategy,
    values: ThresholdFormValues
): { params?: ThresholdParams; errors?: ThresholdFormErrors } =>
    strategy === 'seasonal' ? parseSeasonal(values) : parsePercentile(values)
