import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fetchInstalledAppKeys, parseAppKeys } from './apps.mjs'

const jsonResponse = (body) => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
})

test('parseAppKeys reads a plain array of apps', () => {
    assert.deepEqual(
        parseAppKeys([
            {
                key: 'chap-widget-prediction-map',
                name: 'CHAP · Prediction Map',
            },
            { key: 'chap-widget-model-status', name: 'CHAP · Model Status' },
        ]),
        new Set([
            'chap-widget-prediction-map',
            'CHAP · Prediction Map',
            'chap-widget-model-status',
            'CHAP · Model Status',
        ])
    )
})

test('parseAppKeys reads a wrapped { apps: [...] } payload', () => {
    assert.ok(
        parseAppKeys({ apps: [{ key: 'chap-widget-outbreak-map' }] }).has(
            'chap-widget-outbreak-map'
        )
    )
})

test('parseAppKeys accepts the folderName/short_name spellings', () => {
    const keys = parseAppKeys([
        { folderName: 'chap-widget-a' },
        { short_name: 'chap-widget-b' },
    ])
    assert.ok(keys.has('chap-widget-a'))
    assert.ok(keys.has('chap-widget-b'))
})

test('parseAppKeys ignores junk entries and unusable payloads', () => {
    assert.deepEqual(
        parseAppKeys([null, 'nope', {}, { key: 42 }, { key: '' }]),
        new Set()
    )
    assert.deepEqual(parseAppKeys(null), new Set())
    assert.deepEqual(parseAppKeys({ apps: 'nope' }), new Set())
})

test('fetchInstalledAppKeys asks /api/apps with basic auth, no redirects', async () => {
    const calls = []
    const keys = await fetchInstalledAppKeys({
        url: 'https://demo.example/base/',
        username: 'user',
        password: 'pass',
        fetchImpl: async (endpoint, options) => {
            calls.push({ endpoint, options })
            return jsonResponse([{ key: 'chap-widget-prediction-chart' }])
        },
    })
    assert.equal(calls.length, 1)
    assert.equal(calls[0].endpoint, 'https://demo.example/base/api/apps')
    assert.equal(
        calls[0].options.headers.Authorization,
        `Basic ${Buffer.from('user:pass').toString('base64')}`
    )
    assert.equal(calls[0].options.redirect, 'manual')
    assert.ok(keys.has('chap-widget-prediction-chart'))
})

test('fetchInstalledAppKeys surfaces a login redirect as its status', async () => {
    await assert.rejects(
        fetchInstalledAppKeys({
            url: 'https://demo.example',
            username: 'user',
            password: 'pass',
            fetchImpl: async () => ({ ok: false, status: 302 }),
        }),
        /GET \/api\/apps → 302/
    )
})

test('fetchInstalledAppKeys surfaces a non-JSON body', async () => {
    await assert.rejects(
        fetchInstalledAppKeys({
            url: 'https://demo.example',
            username: 'user',
            password: 'pass',
            fetchImpl: async () => ({
                ok: true,
                status: 200,
                text: async () => '<!DOCTYPE html><html>login</html>',
            }),
        }),
        /unparseable JSON/
    )
})
