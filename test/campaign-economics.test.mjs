import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateGasSponsorReserveAvax,
  calculateGasSponsorTopUpAvax,
  estimatedClaimCount,
} from '../src/campaign-economics.js'

test('default 0.01 AVAX campaign reserves gas for all ten claims', () => {
  assert.equal(estimatedClaimCount('0.01', '0.001'), 10)
  assert.equal(calculateGasSponsorReserveAvax('0.01', '0.001'), '0.025')
})

test('small campaigns still receive the minimum sponsor reserve', () => {
  assert.equal(calculateGasSponsorReserveAvax('0.001', '0.001'), '0.010')
})

test('top-up calculation covers every remaining claim', () => {
  assert.equal(calculateGasSponsorTopUpAvax(9, '0.003412'), '0.020')
  assert.equal(calculateGasSponsorTopUpAvax(1, '0.02'), '0')
})
