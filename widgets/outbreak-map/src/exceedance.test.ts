import assert from 'node:assert/strict'
import test from 'node:test'
import { RATIO_BREAKS, classifyExceedance } from './exceedance.ts'

const stats = { median: 12, low: 4, high: 30 }

test('classifyExceedance reports how far above the threshold the median is', () => {
    const exceedance = classifyExceedance(stats, 6)
    assert.equal(exceedance.status, 'above')
    assert.equal(exceedance.ratio, 2)
    assert.equal(exceedance.classIndex, RATIO_BREAKS.indexOf(2))
})

test('classifyExceedance treats a median exactly at the threshold as above', () => {
    const exceedance = classifyExceedance(stats, 12)
    assert.equal(exceedance.status, 'above')
    assert.equal(exceedance.ratio, 1)
    assert.equal(exceedance.classIndex, 0)
})

test('classifyExceedance puts an extreme ratio in the open-ended top class', () => {
    const exceedance = classifyExceedance(stats, 0.5)
    assert.equal(exceedance.status, 'above')
    assert.equal(exceedance.ratio, 24)
    assert.equal(exceedance.classIndex, RATIO_BREAKS.length - 1)
})

test('classifyExceedance calls it possible when only the upper interval crosses', () => {
    const exceedance = classifyExceedance(stats, 20)
    assert.equal(exceedance.status, 'possible')
    assert.equal(exceedance.ratio, 0.6)
    assert.equal(exceedance.classIndex, null)
})

test('classifyExceedance calls it below when the whole interval stays under', () => {
    const exceedance = classifyExceedance(stats, 40)
    assert.equal(exceedance.status, 'below')
    assert.equal(exceedance.classIndex, null)
})

test('classifyExceedance has no opinion without a prediction', () => {
    assert.equal(classifyExceedance(undefined, 10).status, 'no-prediction')
})

test('classifyExceedance has no opinion without a threshold', () => {
    assert.equal(classifyExceedance(stats, undefined).status, 'no-threshold')
})

test('classifyExceedance reports no prediction ahead of no threshold', () => {
    assert.equal(
        classifyExceedance(undefined, undefined).status,
        'no-prediction'
    )
})

test('classifyExceedance handles a zero threshold without dividing by it', () => {
    const above = classifyExceedance(stats, 0)
    assert.equal(above.status, 'above')
    assert.equal(above.ratio, null)
    assert.equal(above.classIndex, RATIO_BREAKS.length - 1)

    const noCases = classifyExceedance({ median: 0, low: 0, high: 0 }, 0)
    assert.equal(noCases.status, 'below')
})

test('classifyExceedance ignores a missing upper quantile for the possible tier', () => {
    const exceedance = classifyExceedance({ median: 5, low: 5, high: 5 }, 8)
    assert.equal(exceedance.status, 'below')
})
