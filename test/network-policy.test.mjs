import assert from 'node:assert/strict'
import test from 'node:test'

import { shouldSwitchNetwork } from '../src/network-policy.js'

test('a wallet already on Fuji does not receive another switch request', () => {
  assert.equal(shouldSwitchNetwork(43113n, 43113), false)
  assert.equal(shouldSwitchNetwork('0xA869', 43113), false)
})

test('a wallet on another EVM network receives one Fuji switch request', () => {
  assert.equal(shouldSwitchNetwork(1n, 43113), true)
})

test('an unreadable network is treated as requiring a switch', () => {
  assert.equal(shouldSwitchNetwork('', 43113), true)
})
