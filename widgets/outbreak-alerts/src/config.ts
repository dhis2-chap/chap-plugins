import { z } from 'zod'

/**
 * Per-dashboard-item configuration for this widget, stored in the DHIS2
 * datastore under dataStore/chap-widgets/<dashboardItemId>. Bump `version`
 * (and handle migration or fall back to unconfigured) when the shape changes.
 */
export const ConfigSchema = z.object({
    version: z.literal(1),
    widget: z.literal('chap-widget-outbreak-alerts'),
    title: z.string().optional(),
    /** CHAP prediction to rank org units from */
    predictionId: z.number(),
    /** Case-count threshold that marks an org unit as an outbreak alert */
    threshold: z.number().nonnegative(),
})

export type Config = z.infer<typeof ConfigSchema>
