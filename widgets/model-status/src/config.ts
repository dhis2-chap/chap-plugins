import { z } from 'zod'

/**
 * Per-dashboard-item configuration for this widget, stored in the DHIS2
 * datastore under dataStore/chap-widgets/<dashboardItemId>. Bump `version`
 * (and handle migration or fall back to unconfigured) when the shape changes.
 */
export const ConfigSchema = z.object({
    version: z.literal(1),
    widget: z.literal('chap-widget-model-status'),
    title: z.string().optional(),
    /** How many recent jobs to list */
    jobLimit: z.number().int().positive().default(8),
})

export type Config = z.infer<typeof ConfigSchema>
