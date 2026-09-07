import i18n from '@dhis2/d2-i18n'
import { z } from 'zod'

const percentileFraction = z.number().min(0).max(1)

/**
 * Endemic-threshold strategy parameters, mirroring the modeling app's own
 * `ThresholdParams` so the same numbers produce the same thresholds here as
 * on its prediction charts. `type` selects the strategy for the CHAP request.
 */
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
 * Per-dashboard-item configuration for this widget, stored in the DHIS2
 * datastore under dataStore/chap-widgets/<dashboardItemId>. Bump `version`
 * (and handle migration or fall back to unconfigured) when the shape changes.
 */
export const ConfigSchema = z.object({
    version: z.literal(1),
    widget: z.literal('chap-widget-outbreak-map'),
    title: z.string().optional(),
    /** 'latest' follows the most recently run prediction; a number pins one */
    predictionId: z.union([z.literal('latest'), z.number()]),
    /** Render OpenStreetMap tiles under the choropleth */
    showBasemap: z.boolean().default(true),
    /** How the endemic threshold each org unit is compared against is computed */
    threshold: ThresholdParamsSchema,
})

export type Config = z.infer<typeof ConfigSchema>

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

const formatPercent = (fraction: number): string =>
    String(Math.round(fraction * 1000) / 10)

/** One-line summary of a threshold definition, for the form and the view */
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
