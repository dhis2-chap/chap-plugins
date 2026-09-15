import { ThresholdParamsSchema } from '@chap-widgets/shared'
import { z } from 'zod'

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
