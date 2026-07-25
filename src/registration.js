const requestTimeoutMs = 12_000

async function post(path, payload, timeoutMs = requestTimeoutMs) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(result.error || 'ScanDrop registration request failed.')
    }

    return result
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('ScanDrop registration timed out. Please try again.')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function registerScanDropProfile({
  email,
  displayName,
  campaignId,
  marketingConsent,
}) {
  const result = await post('/api/registrations', {
    email,
    displayName,
    campaignId,
    marketingConsent,
  })
  return result.registration
}

export async function linkRegistrationWallet(registrationId, walletAddress) {
  return post('/api/registrations/wallet', {
    registrationId,
    walletAddress,
  })
}

export async function recordRegistrationClaim(
  registrationId,
  walletAddress,
  transactionHash,
) {
  return post('/api/registrations/claim', {
    registrationId,
    walletAddress,
    transactionHash,
  })
}

export async function activateGaslessCampaign({
  campaignId,
  contractAddress,
  deploymentTransactionHash,
}) {
  const result = await post('/api/campaigns/activate', {
    campaignId,
    contractAddress,
    deploymentTransactionHash,
  }, 30_000)
  return result.campaign
}

export async function requestGaslessClaim(registrationId) {
  return post('/api/claims/gasless', { registrationId }, 60_000)
}

export async function getActiveCampaign(campaignId) {
  const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}`, {
    headers: { accept: 'application/json' },
  })
  const result = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(result.error || 'ScanDrop campaign could not be loaded.')
  }

  return result.campaign
}
