import { z } from 'zod'

/**
 * Per-dashboard-item configuration for this widget, stored in the DHIS2
 * datastore under dataStore/chap-widgets/<dashboardItemId>. Bump `version`
 * (and handle migration or fall back to unconfigured) when the shape changes.
 */
export const ConfigSchema = z.object({
    version: z.literal(1),
    widget: z.literal('chap-widget-evaluation-compare'),
    title: z.string().optional(),
    /** CHAP backtest (evaluation) to plot */
    backtestId: z.number(),
    /** Org unit (as used in the evaluation entries) to plot */
    orgUnitId: z.string(),
    /** Display name snapshot so the view doesn't depend on metadata access */
    orgUnitName: z.string().optional(),
    /** Train/test split period to plot; defaults to the backtest's last split */
    splitPeriod: z.string().optional(),
})

export type Config = z.infer<typeof ConfigSchema>
