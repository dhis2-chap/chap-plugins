import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseDashboardFlag } from './args.mjs'

test('parseDashboardFlag returns null name when the flag is absent', () => {
    assert.deepEqual(parseDashboardFlag(['local', '--no-build']), {
        name: null,
        rest: ['local', '--no-build'],
    })
})

test('parseDashboardFlag extracts a space-separated value', () => {
    assert.deepEqual(parseDashboardFlag(['local', '--dashboard', 'edvin']), {
        name: 'edvin',
        rest: ['local'],
    })
})

test('parseDashboardFlag extracts an equals-form value', () => {
    assert.deepEqual(
        parseDashboardFlag(['--dashboard=my board', 'demo', 'chart']),
        { name: 'my board', rest: ['demo', 'chart'] }
    )
})

test('parseDashboardFlag rejects a missing value', () => {
    assert.throws(
        () => parseDashboardFlag(['local', '--dashboard']),
        /--dashboard requires a name/
    )
    assert.throws(
        () => parseDashboardFlag(['--dashboard', '--pull']),
        /--dashboard requires a name/
    )
    assert.throws(
        () => parseDashboardFlag(['--dashboard=']),
        /--dashboard requires a name/
    )
})
