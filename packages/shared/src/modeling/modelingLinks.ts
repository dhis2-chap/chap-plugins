/**
 * Deep links from a widget into the CHAP modeling app.
 *
 * The modeling app is a hash router, so a link is its launch URL plus a
 * `#/path?query` fragment. Only destinations a widget can address *exactly*
 * belong here: landing a viewer on a list and making them hunt for the thing
 * they were already looking at is worse than offering no link at all.
 *
 * Notably absent are the prediction widgets. The modeling app's run page is
 * `#/predictions/:predictionSetupId/runs/:predictionId`, and while the page
 * itself only needs the prediction id, the route needs the setup id — which
 * `PredictionInfo` doesn't carry (chap-core keeps `prediction_setup_id` on the
 * row but omits it from the read model). The modeling app never hits this,
 * because you always reach a run by descending from its setup. Once chap-core
 * returns the setup id, a `predictionRunLink` belongs here — remembering that
 * it is nullable, so ad-hoc predictions will still have no run page.
 */

/**
 * The modeling app's `d2.config.js` id, which DHIS2 stores as `app_hub_id` on
 * the installed app. Stable across instances and renames, unlike the app key
 * (`dhis2-chapmodeling-app`) or its title.
 */
export const MODELING_APP_HUB_ID = 'a29851f9-82a7-4ecd-8b2c-58e0f220bc75'

export type EvaluationCompareLinkParams = {
    /** CHAP backtest to open as the comparison's base evaluation */
    backtestId: number
    /** Org unit to preselect */
    orgUnitId: string
    /** Train/test split to open on; omitted lets the app pick its default */
    splitPeriod?: string
}

/**
 * The modeling app's evaluation comparison, opened on one backtest, org unit
 * and split. The param names mirror the app's own `PARAMS_KEYS` in
 * `features/evaluation-compare/useSearchParamSelections.ts`.
 */
export const evaluationCompareLink = ({
    backtestId,
    orgUnitId,
    splitPeriod,
}: EvaluationCompareLinkParams): string => {
    const params = new URLSearchParams()
    params.set('baseEvaluation', String(backtestId))
    params.set('orgUnit', orgUnitId)
    if (splitPeriod) {
        params.set('splitPeriod', splitPeriod)
    }
    return `#/evaluate/compare?${params.toString()}`
}

/** The modeling app's job list — the same runs model-status summarises. */
export const jobsLink = (): string => '#/jobs'

/**
 * Joins an installed app's launch URL with one of the links above. Any hash
 * already on the launch URL is dropped, since the link carries its own.
 */
export const modelingAppUrl = (launchUrl: string, link: string): string =>
    `${launchUrl.split('#')[0]}${link}`
