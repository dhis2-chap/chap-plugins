import assert from 'node:assert/strict'
import test from 'node:test'
import { canonicalizePeriodId, comparePeriods } from './periods.ts'

test('canonicalizePeriodId strips a weekly week number’s leading zeroes', () => {
    assert.equal(canonicalizePeriodId('2024W03'), '2024W3')
    assert.equal(canonicalizePeriodId('2024W3'), '2024W3')
    assert.equal(canonicalizePeriodId('2024W52'), '2024W52')
})

test('canonicalizePeriodId keeps a weekly start-day offset', () => {
    assert.equal(canonicalizePeriodId('2024SunW03'), '2024SunW3')
    assert.equal(canonicalizePeriodId('2024WedW7'), '2024WedW7')
})

test('canonicalizePeriodId normalizes bi-weekly ids', () => {
    assert.equal(canonicalizePeriodId('2024BiW04'), '2024BiW4')
})

test('canonicalizePeriodId leaves monthly and unknown ids alone', () => {
    assert.equal(canonicalizePeriodId('202410'), '202410')
    assert.equal(canonicalizePeriodId('2024'), '2024')
    assert.equal(canonicalizePeriodId('  202410  '), '202410')
})

test('comparePeriods orders numerically, not lexicographically', () => {
    assert.ok(comparePeriods('2024W9', '2024W10') < 0)
    assert.ok(comparePeriods('202409', '202410') < 0)
})
