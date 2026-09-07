import assert from 'node:assert/strict'
import test from 'node:test'
import { buildThresholdMap, getThresholdLineRoles } from './thresholds.ts'

test('getThresholdLineRoles reads a percentile band as lower + upper', () => {
    assert.deepEqual(
        getThresholdLineRoles({ type: 'percentile', quantile: [0.25, 0.75] }),
        { lowerIndex: 0, upperIndex: 1 }
    )
})

test('getThresholdLineRoles follows the order the response echoes back', () => {
    assert.deepEqual(
        getThresholdLineRoles({ type: 'percentile', quantile: [0.75, 0.25] }),
        { lowerIndex: 1, upperIndex: 0 }
    )
})

test('getThresholdLineRoles reads a seasonal band from stdMultiplier', () => {
    assert.deepEqual(
        getThresholdLineRoles({ type: 'seasonal', stdMultiplier: [1, 2] }),
        { lowerIndex: 0, upperIndex: 1 }
    )
})

test('getThresholdLineRoles treats a scalar parameter as a single line', () => {
    assert.deepEqual(
        getThresholdLineRoles({ type: 'percentile', quantile: 0.75 }),
        { upperIndex: 0 }
    )
    assert.deepEqual(
        getThresholdLineRoles({ type: 'seasonal', stdMultiplier: 2 }),
        { upperIndex: 0 }
    )
})

test('getThresholdLineRoles falls back to the first line for unusable params', () => {
    assert.deepEqual(getThresholdLineRoles({ type: 'seasonal' }), {
        upperIndex: 0,
    })
    assert.deepEqual(
        getThresholdLineRoles({ type: 'percentile', quantile: [0.5, 0.5] }),
        { upperIndex: 0 }
    )
})

test('buildThresholdMap keys upper thresholds by org unit and canonical period', () => {
    const map = buildThresholdMap({
        params: { type: 'percentile', quantile: [0.25, 0.75] },
        entries: [
            { period: '2024W03', location: 'ou1', values: [10, 40] },
            { period: '2024W4', location: 'ou1', values: [11, 44] },
            { period: '2024W03', location: 'ou2', values: [1, 2] },
        ],
    })
    assert.equal(map.get('ou1')?.get('2024W3'), 40)
    assert.equal(map.get('ou1')?.get('2024W4'), 44)
    assert.equal(map.get('ou2')?.get('2024W3'), 2)
})

test('buildThresholdMap omits thresholds that could not be computed', () => {
    const map = buildThresholdMap({
        params: { type: 'seasonal', stdMultiplier: 2 },
        entries: [
            { period: '202410', location: 'ou1', values: [null] },
            { period: '202411', location: 'ou1', values: [] },
            { period: '202412', location: 'ou1', values: [7] },
        ],
    })
    assert.equal(map.get('ou1')?.has('202410'), false)
    assert.equal(map.get('ou1')?.has('202411'), false)
    assert.equal(map.get('ou1')?.get('202412'), 7)
})

test('buildThresholdMap ignores a non-finite threshold', () => {
    const map = buildThresholdMap({
        params: { type: 'seasonal', stdMultiplier: 2 },
        entries: [{ period: '202410', location: 'ou1', values: [NaN] }],
    })
    // No usable line anywhere, so the org unit is absent rather than present
    // with an empty period map — callers read "missing" as "no threshold".
    assert.equal(map.size, 0)
})
