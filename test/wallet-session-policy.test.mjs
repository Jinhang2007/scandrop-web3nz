import assert from 'node:assert/strict'
import test from 'node:test'

import { shouldStartFreshWalletSession } from '../src/wallet-session-policy.js'

test('a new ScanDrop profile always starts a fresh wallet session', () => {
  assert.equal(
    shouldStartFreshWalletSession({
      linkedWalletAddress: '',
      previousConnectionError: '',
    }),
    true,
  )
})

test('a known wallet may reuse its session when reconnecting', () => {
  assert.equal(
    shouldStartFreshWalletSession({
      linkedWalletAddress: '0x50f19e7c4dda3f406c37d38ba742712543d34c81',
      previousConnectionError: '',
    }),
    false,
  )
})

test('a wallet-link conflict forces the next connection to start fresh', () => {
  assert.equal(
    shouldStartFreshWalletSession({
      linkedWalletAddress: '0x50f19e7c4dda3f406c37d38ba742712543d34c81',
      previousConnectionError:
        'This wallet is already linked to a ScanDrop account.',
    }),
    true,
  )
})
