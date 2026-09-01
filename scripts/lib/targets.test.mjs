import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveTarget } from './targets.mjs'

test('local target defaults to localhost:8090 with admin/district', () => {
    assert.deepEqual(resolveTarget('local', {}), {
        url: 'http://localhost:8090',
        username: 'admin',
        password: 'district',
    })
})

test('local target honors DHIS2_LOCAL_URL and D2_* overrides', () => {
    assert.deepEqual(
        resolveTarget('local', {
            DHIS2_LOCAL_URL: 'http://localhost:9999',
            D2_USERNAME: 'user',
            D2_PASSWORD: 'pass',
        }),
        { url: 'http://localhost:9999', username: 'user', password: 'pass' }
    )
})

test('demo target requires DHIS2_DEMO_URL', () => {
    assert.throws(() => resolveTarget('demo', {}), /DHIS2_DEMO_URL/)
})

test('demo target uses DHIS2_DEMO_URL and D2_* credentials', () => {
    assert.deepEqual(
        resolveTarget('demo', {
            DHIS2_DEMO_URL: 'https://demo.example',
            D2_USERNAME: 'user',
            D2_PASSWORD: 'pass',
        }),
        { url: 'https://demo.example', username: 'user', password: 'pass' }
    )
})

test('any other target is treated as an explicit URL', () => {
    assert.deepEqual(
        resolveTarget('https://x.example', {
            D2_USERNAME: 'user',
            D2_PASSWORD: 'pass',
        }),
        { url: 'https://x.example', username: 'user', password: 'pass' }
    )
})
