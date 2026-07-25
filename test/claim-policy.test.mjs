import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getClaimFlowStep,
  getRegistrationVisualState,
} from '../src/claim-policy.js'

test('a claimed ScanDrop account stops before wallet connection', () => {
  assert.equal(
    getClaimFlowStep({
      registrationId: 'registration-1',
      claimStatus: 'claimed',
      connectedWallet: '',
    }),
    'complete',
  )
})

test('a claimed ScanDrop account never returns to the claim step', () => {
  assert.equal(
    getClaimFlowStep({
      registrationId: 'registration-1',
      claimStatus: 'claimed',
      connectedWallet: '0x50f19e7c4dda3f406c37d38ba742712543d34c81',
    }),
    'complete',
  )
})

test('new and unclaimed accounts follow the normal registration flow', () => {
  assert.equal(
    getClaimFlowStep({
      registrationId: '',
      claimStatus: 'registered',
      connectedWallet: '',
    }),
    'register',
  )
  assert.equal(
    getClaimFlowStep({
      registrationId: 'registration-1',
      claimStatus: 'registered',
      connectedWallet: '',
    }),
    'connect',
  )
  assert.equal(
    getClaimFlowStep({
      registrationId: 'registration-1',
      claimStatus: 'wallet_connected',
      connectedWallet: '0x50f19e7c4dda3f406c37d38ba742712543d34c81',
    }),
    'claim',
  )
})

test('a newly created registration uses the green success state', () => {
  assert.equal(
    getRegistrationVisualState({
      registrationOrigin: 'new',
      claimStatus: 'registered',
    }),
    'success',
  )
})

test('an existing or claimed registration uses the orange existing state', () => {
  assert.equal(
    getRegistrationVisualState({
      registrationOrigin: 'existing',
      claimStatus: 'registered',
    }),
    'existing',
  )
  assert.equal(
    getRegistrationVisualState({
      registrationOrigin: 'new',
      claimStatus: 'claimed',
    }),
    'existing',
  )
})
