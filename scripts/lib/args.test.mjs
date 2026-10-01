import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseDashboardFlag, parseStarForFlags } from './args.mjs'

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

test('parseStarForFlags returns no usernames when the flag is absent', () => {
    assert.deepEqual(parseStarForFlags(['demo', '--star']), {
        usernames: [],
        rest: ['demo', '--star'],
    })
})

test('parseStarForFlags collects repeated flags in both forms, deduped', () => {
    assert.deepEqual(
        parseStarForFlags([
            'demo',
            '--star-for',
            'demo',
            '--grant-roles',
            '--star-for=guest',
            '--star-for=demo',
        ]),
        { usernames: ['demo', 'guest'], rest: ['demo', '--grant-roles'] }
    )
})

test('parseStarForFlags rejects a missing username', () => {
    assert.throws(
        () => parseStarForFlags(['--star-for', '--star']),
        /--star-for requires a username/
    )
    assert.throws(
        () => parseStarForFlags(['--star-for=']),
        /--star-for requires a username/
    )
})
