// Generated CHAP OpenAPI client (regenerate with `pnpm regen-api`)
export * from './chap-api'
export { enableQueue, disableQueue, getQueue } from './chap-api/core/request'

// CHAP route plumbing
export { ChapProvider } from './chap/ChapProvider'
export { ChapGuard, useChapSystemInfo } from './chap/ChapGuard'
export { useResolvedPredictionId } from './chap/predictions'
export {
    LATEST_PREDICTION,
    PredictionSelectionSchema,
    getLatestPrediction,
    resolvePrediction,
    sortPredictionsNewestFirst,
} from './chap/predictionSelection'
export type { PredictionSelection } from './chap/predictionSelection'
export { PredictionSelectField } from './chap/PredictionSelectField'
export type { PredictionSelectFieldProps } from './chap/PredictionSelectField'
export { MissingPredictionState } from './chap/MissingPredictionState'

export { buildThresholdMap, getThresholdLineRoles } from './chap/thresholds'
export type { ThresholdLineRoles, ThresholdMap } from './chap/thresholds'
export {
    ThresholdParamsSchema,
    DEFAULT_THRESHOLD,
    DEFAULT_THRESHOLD_PARAMS,
    DEFAULT_THRESHOLD_STRATEGY,
    describeThresholdParams,
    parseThresholdParams,
    toThresholdFormValues,
} from './chap/thresholdParams'
export type {
    ThresholdFormErrors,
    ThresholdFormValues,
    ThresholdParams,
    ThresholdStrategy,
} from './chap/thresholdParams'
export { ThresholdParamsFields } from './chap/ThresholdParamsFields'
export type { ThresholdParamsFieldsProps } from './chap/ThresholdParamsFields'

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
export {
    useOrgUnitGeometries,
    useOrgUnitGeometryContext,
} from './dhis2/useOrgUnitGeometries'
export type {
    OrgUnitFeature,
    OrgUnitGeometry,
    OrgUnitGeometryContext,
} from './dhis2/useOrgUnitGeometries'

// Charts
export { FanChart } from './charts/FanChart'
export type { FanChartProps } from './charts/FanChart'
export {
    buildFanChartData,
    buildStatsByPeriod,
    STANDARD_QUANTILES,
} from './charts/quantiles'
export type {
    FanChartData,
    OrgUnitStats,
    QuantileEntry,
} from './charts/quantiles'
export {
    buildChartPeriods,
    canonicalizePeriodId,
    comparePeriods,
    formatPeriodLabel,
} from './charts/periods'
export { registerHighchartsModules } from './charts/registerHighchartsModules'
