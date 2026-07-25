export const PROOF_MAX_AGE_MS = 10 * 60 * 1000

function required(value, label) {
  const normalized = String(value || '').trim()
  if (!normalized) throw new Error(`${label} is required.`)
  return normalized
}

export function createWalletLinkMessage({
  registrationId,
  walletAddress,
  issuedAt,
}) {
  return [
    'ScanDrop wallet link',
    `Registration: ${required(registrationId, 'Registration')}`,
    `Wallet: ${required(walletAddress, 'Wallet').toLowerCase()}`,
    `Issued at: ${required(issuedAt, 'Issued at')}`,
    'Network: Avalanche Fuji C-Chain (43113)',
  ].join('\n')
}

export function createCampaignActivationMessage({
  campaignId,
  contractAddress,
  deploymentTransactionHash,
  issuedAt,
}) {
  return [
    'ScanDrop campaign activation',
    `Campaign: ${required(campaignId, 'Campaign')}`,
    `Contract: ${required(contractAddress, 'Contract').toLowerCase()}`,
    `Deployment transaction: ${required(
      deploymentTransactionHash,
      'Deployment transaction',
    ).toLowerCase()}`,
    `Issued at: ${required(issuedAt, 'Issued at')}`,
    'Network: Avalanche Fuji C-Chain (43113)',
  ].join('\n')
}

export function isFreshProof(issuedAt, now = Date.now()) {
  const timestamp = Date.parse(String(issuedAt || ''))
  return (
    Number.isFinite(timestamp) &&
    timestamp <= now + 30_000 &&
    now - timestamp <= PROOF_MAX_AGE_MS
  )
}
