import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
    evaluationCompareLink,
    jobsLink,
    modelingAppUrl,
    MODELING_APP_HUB_ID,
} from './modelingLinks.ts'

const LAUNCH_URL =
    'http://localhost:8090/api/apps/dhis2-chapmodeling-app/index.html'

test('the hub id matches the modeling app d2.config id', () => {
    // Guards against a typo silently disabling every button, since an
    // unmatched id reads as "modeling app not installed"
    assert.equal(MODELING_APP_HUB_ID, 'a29851f9-82a7-4ecd-8b2c-58e0f220bc75')
})

test('evaluation compare link carries backtest, org unit and split', () => {
    const link = evaluationCompareLink({
        backtestId: 12,
        orgUnitId: 'abc',
        splitPeriod: '2024-06',
    })
    assert.equal(
        link,
        '#/evaluate/compare?baseEvaluation=12&orgUnit=abc&splitPeriod=2024-06'
    )
})

test('evaluation compare link omits an unset split', () => {
    const link = evaluationCompareLink({ backtestId: 3, orgUnitId: 'abc' })
    assert.equal(link, '#/evaluate/compare?baseEvaluation=3&orgUnit=abc')
    assert.ok(!link.includes('splitPeriod'))
})

test('evaluation compare link escapes org unit and split', () => {
    const link = evaluationCompareLink({
        backtestId: 1,
        orgUnitId: 'a&b=c',
        splitPeriod: '2024 W1',
    })
    assert.ok(link.includes('orgUnit=a%26b%3Dc'))
    assert.ok(link.includes('splitPeriod=2024+W1'))
})

test('jobs link points at the modeling app job list', () => {
    assert.equal(jobsLink(), '#/jobs')
})

test('modelingAppUrl joins a launch url with a link', () => {
    assert.equal(modelingAppUrl(LAUNCH_URL, jobsLink()), `${LAUNCH_URL}#/jobs`)
})

test('modelingAppUrl replaces a hash already on the launch url', () => {
    assert.equal(
        modelingAppUrl(`${LAUNCH_URL}#/dashboard`, jobsLink()),
        `${LAUNCH_URL}#/jobs`
    )
})
