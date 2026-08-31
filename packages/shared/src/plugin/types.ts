/**
 * Props the DHIS2 Dashboard app passes to a DASHBOARD-type plugin entrypoint.
 * (Same shape the uncertainty-dashboard-plugin uses in production.)
 */
export type DashboardPluginProps = {
    /** Stable id of the dashboard item hosting this plugin — the config storage key */
    dashboardItemId?: string
    /** Dashboard-level filters (ou, pe, …) as set in the Dashboard app */
    dashboardItemFilters?: Record<string, unknown>
    dashboardMode?: 'view' | 'edit' | 'print'
    /** Lets the plugin set its item title and a cleanup hook for item removal */
    setDashboardItemDetails?: (details: {
        itemTitle?: string
        appUrl?: string
        onRemove?: () => Promise<void>
    }) => void
    cacheId?: string
    isParentCached?: boolean
}
