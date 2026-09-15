import { PredictionSelectionSchema } from '@chap-widgets/shared'
import { z } from 'zod'

/**
 * Per-dashboard-item configuration for this widget, stored in the DHIS2
 * datastore under dataStore/chap-widgets/<dashboardItemId>. Bump `version`
 * (and handle migration or fall back to unconfigured) when the shape changes.
 */
export const ConfigSchema = z.object({
    version: z.literal(1),
    widget: z.literal('chap-widget-prediction-chart'),
    title: z.string().optional(),
    /** Which prediction to render: 'latest' follows new runs, a number pins one */
    predictionId: PredictionSelectionSchema,
    /** Org unit (as used in the prediction entries) to plot */
    orgUnitId: z.string(),
    /** Display name snapshot so the view doesn't depend on metadata access */
    orgUnitName: z.string().optional(),
})

export type Config = z.infer<typeof ConfigSchema>
