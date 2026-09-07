import assert from 'node:assert/strict'
import test from 'node:test'
import { buildStatsByPeriod } from './quantiles.ts'

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
