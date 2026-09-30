/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AlertApproval } from '../models/AlertApproval';
import type { AlertApprovalRequest } from '../models/AlertApprovalRequest';
import type { AlertIdsResponse } from '../models/AlertIdsResponse';
import type { AlertRead } from '../models/AlertRead';
import type { AlertsCreate } from '../models/AlertsCreate';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AlertsService {
    /**
     * Record alerts raised against a policy
     * ⚠️ **Experimental:** behavior and response shape may change without notice.
     *
     * Record a batch of alerts — one run raises many at once, so they are written together.
     *
     * Every alert names a level its policy actually defines; a level name only means
     * something against its policy. Alerts land in the `pending` state, waiting for a
     * reviewer to clear them for dissemination. The batch is validated before anything is
     * written, so it fails whole. 422 if a policy, level or prediction is unknown.
     * @param requestBody
     * @returns AlertIdsResponse Successful Response
     * @throws ApiError
     */
    public static createAlertsV1CrudAlertsPost(
        requestBody: AlertsCreate,
    ): CancelablePromise<AlertIdsResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/v1/crud/alerts',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Browse alerts, or pull the review queue
     * ⚠️ **Experimental:** behavior and response shape may change without notice.
     *
     * List alerts, narrowed by whichever filters you pass.
     *
     * `approved=pending` is the review queue: everything nobody has decided on yet.
     * `approved=approved` is what dissemination should be sending.
     * @param alertPolicyId
     * @param predictionId
     * @param orgUnit
     * @param approved
     * @returns AlertRead Successful Response
     * @throws ApiError
     */
    public static listAlertsV1CrudAlertsGet(
        alertPolicyId?: (number | null),
        predictionId?: (number | null),
        orgUnit?: (string | null),
        approved?: (AlertApproval | null),
    ): CancelablePromise<Array<AlertRead>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/v1/crud/alerts',
            query: {
                'alertPolicyId': alertPolicyId,
                'predictionId': predictionId,
                'orgUnit': orgUnit,
                'approved': approved,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * View one alert
     * ⚠️ **Experimental:** behavior and response shape may change without notice.
     *
     * Read a single alert, including where it stands in the release gate. 404 if the id is unknown.
     * @param alertId
     * @returns AlertRead Successful Response
     * @throws ApiError
     */
    public static getAlertV1CrudAlertsAlertIdGet(
        alertId: number,
    ): CancelablePromise<AlertRead> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/v1/crud/alerts/{alertId}',
            path: {
                'alertId': alertId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Clear a set of alerts for release, or decline them
     * ⚠️ **Experimental:** behavior and response shape may change without notice.
     *
     * Move a set of alerts through the release gate in one go.
     *
     * Reviewers work through a queue and decide on several alerts at a time, so the whole
     * set is applied atomically — if any id is unknown, nothing is written and you get a
     * 404. `approved` clears them for dissemination; `declined` records a deliberate
     * decision not to release, so they do not come back around for re-triage.
     *
     * This gate is about dissemination, not epidemiology: it says a human cleared the
     * alert to go out, not that the outbreak turned out to be real.
     * @param requestBody
     * @returns AlertRead Successful Response
     * @throws ApiError
     */
    public static approveAlertsV1CrudAlertsApprovePost(
        requestBody: AlertApprovalRequest,
    ): CancelablePromise<Array<AlertRead>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/v1/crud/alerts/$approve',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
