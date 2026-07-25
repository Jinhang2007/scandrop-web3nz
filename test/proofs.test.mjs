import test from 'node:test'
import assert from 'node:assert/strict'
import { Wallet, verifyMessage } from 'ethers'
import {
  PROOF_MAX_AGE_MS,
  createCampaignActivationMessage,
  createWalletLinkMessage,
  isFreshProof,
} from '../src/proofs.js'

test('wallet link proof recovers the signing wallet', async () => {
  const wallet = Wallet.createRandom()
  const issuedAt = new Date().toISOString()
  const message = createWalletLinkMessage({
    registrationId: 'registration-1',
    walletAddress: wallet.address,
    issuedAt,
  })
  const signature = await wallet.signMessage(message)

  assert.equal(verifyMessage(message, signature), wallet.address)
})

test('campaign activation proof includes deployment identity', async () => {
  const wallet = Wallet.createRandom()
  const issuedAt = new Date().toISOString()
  const message = createCampaignActivationMessage({
    campaignId: 'web3nz-welcome',
    contractAddress: '0x1111111111111111111111111111111111111111',
    deploymentTransactionHash:
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    issuedAt,
  })
  const signature = await wallet.signMessage(message)

  assert.equal(verifyMessage(message, signature), wallet.address)
  assert.match(message, /web3nz-welcome/)
  assert.match(message, /Avalanche Fuji C-Chain \(43113\)/)
})

test('proof timestamps expire and reject future timestamps', () => {
  const now = Date.now()
  assert.equal(isFreshProof(new Date(now).toISOString(), now), true)
  assert.equal(
    isFreshProof(new Date(now - PROOF_MAX_AGE_MS - 1).toISOString(), now),
    false,
  )
  assert.equal(isFreshProof(new Date(now + 31_000).toISOString(), now), false)
})
