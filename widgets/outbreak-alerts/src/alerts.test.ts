import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAlerts, type ThresholdLookup } from './alerts.ts'

/** One prediction entry; `q` is the quantile and `v` its predicted value */
const entry = (orgUnit: string, period: string, [q, v]: [number, number]) => ({
    orgUnit,
    period,
    quantile: q,
    value: v,
})

/** Median 40 / upper 60 in 202401, median 20 / upper 30 in 202402 */
const oneOrgUnit = [
    entry('ou1', '202401', [0.5, 40]),
    entry('ou1', '202401', [0.9, 60]),
    entry('ou1', '202402', [0.5, 20]),
    entry('ou1', '202402', [0.9, 30]),
]

const fixedThreshold =
    (threshold: number | undefined): ThresholdLookup =>
    () =>
        threshold

test('a median at or above the threshold is an alert, with its multiple', () => {
    const [alert] = buildAlerts(oneOrgUnit, fixedThreshold(20))
    assert.equal(alert.status, 'above')
    assert.equal(alert.period, '202401')
    assert.equal(alert.median, 40)
    assert.equal(alert.threshold, 20)
    assert.equal(alert.ratio, 2)
})

test('an upper quantile crossing alone is only possible', () => {
    const [alert] = buildAlerts(oneOrgUnit, fixedThreshold(50))
    assert.equal(alert.status, 'possible')
    assert.equal(alert.period, '202401')
})

test('an interval entirely under the threshold is below', () => {
    const [alert] = buildAlerts(oneOrgUnit, fixedThreshold(100))
    assert.equal(alert.status, 'below')
})

test('a missing threshold is reported, never treated as safe', () => {
    const [alert] = buildAlerts(oneOrgUnit, fixedThreshold(undefined))
    assert.equal(alert.status, 'no-threshold')
    assert.equal(alert.threshold, null)
    assert.equal(alert.ratio, null)
})

test('the worst period wins, not the busiest one', () => {
    // 202402 is the smaller forecast but the only one over its threshold.
    const thresholds: ThresholdLookup = (_orgUnit, period) =>
        period === '202401' ? 100 : 10
    const [alert] = buildAlerts(oneOrgUnit, thresholds)
    assert.equal(alert.period, '202402')
    assert.equal(alert.status, 'above')
    assert.equal(alert.ratio, 2)
})

test('org units rank by exceedance, not by raw case count', () => {
    const entries = [
        ...oneOrgUnit,
        // Twice the cases of ou1, but only just over its own threshold.
        entry('ou2', '202401', [0.5, 80]),
        entry('ou2', '202401', [0.9, 90]),
    ]
    const thresholds: ThresholdLookup = (orgUnit) =>
        orgUnit === 'ou1' ? 20 : 70
    const [first, second] = buildAlerts(entries, thresholds)
    assert.equal(first.orgUnitId, 'ou1')
    assert.equal(second.orgUnitId, 'ou2')
})

test('alerts outrank possibles, which outrank quiet org units', () => {
    const entries = [
        entry('below', '202401', [0.5, 1]),
        entry('below', '202401', [0.9, 2]),
        entry('above', '202401', [0.5, 15]),
        entry('above', '202401', [0.9, 20]),
        entry('possible', '202401', [0.5, 5]),
        entry('possible', '202401', [0.9, 12]),
    ]
    assert.deepEqual(
        buildAlerts(entries, fixedThreshold(10)).map(
            (alert) => alert.orgUnitId
        ),
        ['above', 'possible', 'below']
    )
})

test('a zero threshold alerts on any cases without dividing by zero', () => {
    const [alert] = buildAlerts(oneOrgUnit, fixedThreshold(0))
    assert.equal(alert.status, 'above')
    assert.equal(alert.ratio, null)
})

test('org units the prediction has no median for are left out', () => {
    const alerts = buildAlerts(
        [entry('ou1', '202401', [0.9, 60])],
        fixedThreshold(20)
    )
    assert.deepEqual(alerts, [])
})
