import test from 'node:test'
import assert from 'node:assert/strict'
import artifact from '../src/contracts/RewardCampaign.json' with { type: 'json' }

test('compiled campaign exposes gasless and duplicate-claim protections', () => {
  const functions = artifact.abi
    .filter((entry) => entry.type === 'function')
    .map((entry) => entry.name)

  assert.ok(artifact.bytecode.startsWith('0x'))
  assert.ok(artifact.bytecode.length > 100)
  assert.ok(functions.includes('claimFor'))
  assert.ok(functions.includes('hasClaimed'))
  assert.ok(functions.includes('remainingClaims'))
  assert.ok(functions.includes('relayer'))
})
