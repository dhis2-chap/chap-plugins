import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
    UID_RE,
    appKeyToWidget,
    generateUid,
    validateSeed,
    widgetAppKey,
} from './seed-core.mjs'

const validSeed = () => ({
    dashboard: { name: 'CHAP Widgets', code: 'CHAP_WIDGETS' },
    items: [
        {
            id: 'a1234567890',
            widget: 'prediction-chart',
            layout: { x: 0, y: 0, w: 29, h: 24 },
            config: { version: 1 },
        },
        {
            id: 'b1234567890',
            widget: 'model-status',
            layout: { x: 30, y: 0, w: 30, h: 24 },
            config: null,
        },
    ],
})

test('generateUid produces distinct valid DHIS2 UIDs', () => {
    const uids = new Set(Array.from({ length: 100 }, () => generateUid()))
    assert.equal(uids.size, 100)
    for (const uid of uids) {
        assert.match(uid, UID_RE)
    }
})

test('widgetAppKey and appKeyToWidget round-trip', () => {
    assert.equal(
        widgetAppKey('prediction-chart'),
        'chap-widget-prediction-chart'
    )
    assert.equal(
        appKeyToWidget('chap-widget-prediction-chart'),
        'prediction-chart'
    )
    assert.equal(appKeyToWidget('line-listing'), null)
    assert.equal(appKeyToWidget(undefined), null)
})

test('validateSeed accepts a valid seed', () => {
    assert.doesNotThrow(() => validateSeed(validSeed()))
})

test('validateSeed rejects bad shapes with pointed messages', () => {
    assert.throws(() => validateSeed(null), /root must be an object/)

    const noName = validSeed()
    noName.dashboard.name = ''
    assert.throws(() => validateSeed(noName), /dashboard\.name/)

    const badUid = validSeed()
    badUid.items[0].id = 'not-a-uid'
    assert.throws(() => validateSeed(badUid), /items\[0\]\.id/)

    const dupId = validSeed()
    dupId.items[1].id = dupId.items[0].id
    assert.throws(() => validateSeed(dupId), /duplicated/)

    const dupWidget = validSeed()
    dupWidget.items[1].widget = dupWidget.items[0].widget
    assert.throws(() => validateSeed(dupWidget), /duplicated/)

    const overflow = validSeed()
    overflow.items[0].layout = { x: 50, y: 0, w: 20, h: 10 }
    assert.throws(() => validateSeed(overflow), /60-column grid/)

    const fractional = validSeed()
    fractional.items[0].layout.y = 1.5
    assert.throws(() => validateSeed(fractional), /layout\.y/)

    const arrayConfig = validSeed()
    arrayConfig.items[0].config = []
    assert.throws(() => validateSeed(arrayConfig), /config/)
})
