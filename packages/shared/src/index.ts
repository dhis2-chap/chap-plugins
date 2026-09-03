// Generated CHAP OpenAPI client (regenerate with `pnpm regen-api`)
export * from './chap-api'
export { enableQueue, disableQueue, getQueue } from './chap-api/core/request'

// CHAP route plumbing
export { ChapProvider } from './chap/ChapProvider'
export { ChapGuard, useChapSystemInfo } from './chap/ChapGuard'

// Dashboard plugin shell
export type { DashboardPluginProps } from './plugin/types'
export { WidgetShell } from './plugin/WidgetShell'
export type { WidgetShellProps, ConfigFormProps } from './plugin/WidgetShell'
export { LoadingState, PassiveState, ErrorState } from './plugin/states'

// Per-dashboard-item config persistence
export {
    DATASTORE_NAMESPACE,
    useDashboardItemConfig,
    useSaveDashboardItemConfig,
    useDeleteDashboardItemConfig,
} from './config/useDashboardItemConfig'
export { isDhis2NotFound } from './config/dhis2Error'

// DHIS2 metadata helpers
export { useOrgUnitNames } from './dhis2/useOrgUnitNames'
export { useOrgUnitGeometries } from './dhis2/useOrgUnitGeometries'
export type {
    OrgUnitFeature,
    OrgUnitGeometry,
} from './dhis2/useOrgUnitGeometries'

// Charts
export { FanChart } from './charts/FanChart'
export type { FanChartProps } from './charts/FanChart'
export { buildFanChartData, STANDARD_QUANTILES } from './charts/quantiles'
export type { FanChartData, QuantileEntry } from './charts/quantiles'
export {
    buildChartPeriods,
    comparePeriods,
    formatPeriodLabel,
} from './charts/periods'
export { registerHighchartsModules } from './charts/registerHighchartsModules'
