import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
    UID_RE,
    appKeyToWidget,
    applyBoardLayout,
    applyCapturedConfigs,
    autoAddWidgets,
    buildDashboardItems,
    generateUid,
    mergePulledDashboard,
    serializeSeed,
    sortItems,
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

test('autoAddWidgets appends missing widgets below existing items, 3 per row', () => {
    const seed = validSeed() // items end at y+h = 24
    const { seed: next, added } = autoAddWidgets(seed, [
        'prediction-chart',
        'model-status',
        'outbreak-alerts',
        'evaluation-compare',
        'a-fourth-widget',
        'z-fifth-widget',
    ])
    assert.deepEqual(added, [
        'a-fourth-widget',
        'evaluation-compare',
        'outbreak-alerts',
        'z-fifth-widget',
    ])
    const layouts = next.items
        .slice(2)
        .map((item) => [item.widget, item.layout])
    assert.deepEqual(layouts, [
        ['a-fourth-widget', { x: 0, y: 24, w: 20, h: 20 }],
        ['evaluation-compare', { x: 20, y: 24, w: 20, h: 20 }],
        ['outbreak-alerts', { x: 40, y: 24, w: 20, h: 20 }],
        ['z-fifth-widget', { x: 0, y: 44, w: 20, h: 20 }],
    ])
    for (const item of next.items.slice(2)) {
        assert.match(item.id, UID_RE)
        assert.equal(item.config, null)
    }
    validateSeed(next)
})

test('autoAddWidgets is a no-op when every widget is present', () => {
    const seed = validSeed()
    const { seed: next, added } = autoAddWidgets(seed, [
        'prediction-chart',
        'model-status',
    ])
    assert.equal(next, seed)
    assert.deepEqual(added, [])
})

test('buildDashboardItems maps seed items to APP dashboard items', () => {
    assert.deepEqual(buildDashboardItems(validSeed())[0], {
        id: 'a1234567890',
        type: 'APP',
        appKey: 'chap-widget-prediction-chart',
        x: 0,
        y: 0,
        width: 29,
        height: 24,
    })
})

test('serializeSeed sorts items by y, x and ends with a newline', () => {
    const seed = validSeed()
    seed.items.reverse()
    const output = serializeSeed(seed)
    assert.ok(output.endsWith('}\n'))
    const parsed = JSON.parse(output)
    assert.deepEqual(
        parsed.items.map((item) => item.widget),
        ['prediction-chart', 'model-status']
    )
    assert.deepEqual(sortItems(seed.items), parsed.items)
})

test('mergePulledDashboard converts live items, keeps code, adopts live name', () => {
    const { seed, skipped } = mergePulledDashboard({
        code: 'CHAP_WIDGETS',
        dashboard: {
            name: 'CHAP Widgets (renamed)',
            dashboardItems: [
                {
                    id: 'c1234567890',
                    type: 'APP',
                    appKey: 'chap-widget-outbreak-alerts',
                    x: 0,
                    y: 10,
                    width: 20,
                    height: 20,
                },
                {
                    id: 'd1234567890',
                    type: 'APP',
                    appKey: 'chap-widget-model-status',
                    x: 0,
                    y: 0,
                    width: 20,
                    height: 10,
                },
                { id: 'e1234567890', type: 'VISUALIZATION' },
                {
                    id: 'f1234567890',
                    type: 'APP',
                    appKey: 'line-listing',
                    x: 20,
                    y: 0,
                    width: 20,
                    height: 10,
                },
            ],
        },
        configs: { d1234567890: { version: 1, jobLimit: 10 } },
        knownWidgets: ['outbreak-alerts', 'model-status'],
    })
    assert.equal(seed.dashboard.name, 'CHAP Widgets (renamed)')
    assert.equal(seed.dashboard.code, 'CHAP_WIDGETS')
    assert.deepEqual(skipped, ['VISUALIZATION', 'line-listing'])
    assert.deepEqual(seed.items, [
        {
            id: 'd1234567890',
            widget: 'model-status',
            layout: { x: 0, y: 0, w: 20, h: 10 },
            config: { version: 1, jobLimit: 10 },
        },
        {
            id: 'c1234567890',
            widget: 'outbreak-alerts',
            layout: { x: 0, y: 10, w: 20, h: 20 },
            config: null,
        },
    ])
    validateSeed(seed)
})

test('mergePulledDashboard takes a bare code string, not a seed object', () => {
    const { seed, skipped } = mergePulledDashboard({
        code: 'SOME_OTHER_CODE',
        dashboard: { name: 'Fresh Dashboard', dashboardItems: [] },
        configs: {},
        knownWidgets: [],
    })
    assert.deepEqual(skipped, [])
    assert.deepEqual(seed, {
        dashboard: { name: 'Fresh Dashboard', code: 'SOME_OTHER_CODE' },
        items: [],
    })
})

test('applyBoardLayout applies layouts by item id', () => {
    const result = applyBoardLayout(validSeed(), [
        { id: 'a1234567890', x: 5, y: 10, w: 25, h: 12 },
        { id: 'b1234567890', x: 30, y: 10, w: 20, h: 12 },
    ])
    assert.deepEqual(result.items[0].layout, { x: 5, y: 10, w: 25, h: 12 })
    assert.deepEqual(result.items[1].layout, { x: 30, y: 10, w: 20, h: 12 })
    assert.deepEqual(result.items[0].config, { version: 1 })
})

test('applyBoardLayout leaves unmentioned items unchanged', () => {
    const result = applyBoardLayout(validSeed(), [
        { id: 'b1234567890', x: 0, y: 40, w: 15, h: 8 },
    ])
    assert.deepEqual(result.items[0].layout, { x: 0, y: 0, w: 29, h: 24 })
    assert.deepEqual(result.items[1].layout, { x: 0, y: 40, w: 15, h: 8 })
})

test('applyBoardLayout rejects unknown item ids', () => {
    assert.throws(
        () =>
            applyBoardLayout(validSeed(), [
                { id: 'Zzzzzzzzzz9', x: 0, y: 0, w: 10, h: 10 },
            ]),
        /unknown item id "Zzzzzzzzzz9"/
    )
})

test('applyBoardLayout does not mutate its input', () => {
    const seed = validSeed()
    applyBoardLayout(seed, [{ id: 'a1234567890', x: 5, y: 5, w: 10, h: 10 }])
    assert.deepEqual(seed, validSeed())
})

test('applyCapturedConfigs sets objects and keeps failed captures', () => {
    const seed = validSeed()
    seed.items[1].config = { version: 2 }
    const result = applyCapturedConfigs(seed, {
        a1234567890: { version: 9, jobLimit: 5 },
        // b1234567890 absent → capture failed → previous config kept
    })
    assert.deepEqual(result.items[0].config, { version: 9, jobLimit: 5 })
    assert.deepEqual(result.items[1].config, { version: 2 })
})

test('applyCapturedConfigs writes null for missing datastore entries', () => {
    const result = applyCapturedConfigs(validSeed(), { a1234567890: null })
    assert.equal(result.items[0].config, null)
})
