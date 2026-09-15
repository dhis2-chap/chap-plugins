import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFanChartData, buildStatsByPeriod } from './quantiles.ts'

const entry = (
    orgUnit: string,
    period: string,
    [quantile, value]: [number, number]
) => ({ orgUnit, period, quantile, value })

test('buildStatsByPeriod groups quantiles by period and org unit', () => {
    const stats = buildStatsByPeriod([
        entry('ou1', '202410', [0.1, 4]),
        entry('ou1', '202410', [0.5, 10]),
        entry('ou1', '202410', [0.9, 22]),
        entry('ou2', '202410', [0.5, 3]),
        entry('ou1', '202411', [0.5, 12]),
    ])

    assert.deepEqual(stats.get('202410')?.get('ou1'), {
        median: 10,
        low: 4,
        high: 22,
    })
    assert.equal(stats.get('202410')?.get('ou2')?.median, 3)
    assert.equal(stats.get('202411')?.get('ou1')?.median, 12)
})

test('buildStatsByPeriod falls back to the median for a missing interval', () => {
    const stats = buildStatsByPeriod([entry('ou1', '202410', [0.5, 10])])
    assert.deepEqual(stats.get('202410')?.get('ou1'), {
        median: 10,
        low: 10,
        high: 10,
    })
})

test('buildStatsByPeriod drops an org unit with no median', () => {
    const stats = buildStatsByPeriod([
        entry('ou1', '202410', [0.9, 22]),
        entry('ou2', '202410', [0.5, 3]),
    ])
    assert.equal(stats.get('202410')?.has('ou1'), false)
    assert.equal(stats.get('202410')?.size, 1)
})

test('buildStatsByPeriod is empty for no entries', () => {
    assert.equal(buildStatsByPeriod([]).size, 0)
})

const actual = (ou: string, pe: string, value: number | null) => ({
    ou,
    pe,
    value,
})

/** Actuals over six periods, a forecast covering only the middle two */
const series = {
    orgUnitId: 'ou1',
    entries: [
        entry('ou1', '202403', [0.5, 30]),
        entry('ou1', '202404', [0.5, 33]),
    ],
    actuals: [
        actual('ou1', '202401', 10),
        actual('ou1', '202402', 12),
        actual('ou1', '202403', 31),
        actual('ou1', '202404', 35),
        actual('ou1', '202405', 20),
        actual('ou1', '202406', 18),
    ],
}

test('buildFanChartData windows the history around the forecast by default', () => {
    const data = buildFanChartData({ ...series, maxActualPeriods: 1 })

    // One period of run-up, the forecast itself, and nothing after it
    assert.deepEqual(data.periods, ['202402', '202403', '202404'])
})

test('buildFanChartData spans every observed period on full history', () => {
    const data = buildFanChartData({ ...series, fullActualHistory: true })

    assert.deepEqual(data.periods, [
        '202401',
        '202402',
        '202403',
        '202404',
        '202405',
        '202406',
    ])
    assert.deepEqual(data.actuals, [10, 12, 31, 35, 20, 18])
    // The prediction travels across that fixed axis instead of resizing it
    assert.deepEqual(data.median, [null, null, 30, 33, null, null])
})

test('buildFanChartData keeps the axis fixed as the forecast moves', () => {
    const early = buildFanChartData({
        ...series,
        entries: [entry('ou1', '202402', [0.5, 11])],
        fullActualHistory: true,
    })
    const late = buildFanChartData({ ...series, fullActualHistory: true })

    assert.deepEqual(early.periods, late.periods)
    assert.deepEqual(early.median, [null, 11, null, null, null, null])
})
