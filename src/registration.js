import {
  createCampaignActivationMessage,
  createWalletLinkMessage,
} from './proofs.js'

const requestTimeoutMs = 12_000

function apiError(message, status, payload = {}) {
  const error = new Error(message)
  error.status = status
  error.code = payload.code || ''
  error.payload = payload
  return error
}

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
      throw apiError(
        result.error || 'ScanDrop registration request failed.',
        response.status,
        result,
      )
    }

    return result
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw apiError(
        'ScanDrop request timed out. Checking its on-chain status…',
        408,
        { code: 'REQUEST_TIMEOUT' },
      )
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

async function get(path, timeoutMs = requestTimeoutMs) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(path, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw apiError(
        result.error || 'ScanDrop request failed.',
        response.status,
        result,
      )
    }
    return result
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw apiError('ScanDrop status check timed out.', 408, {
        code: 'REQUEST_TIMEOUT',
      })
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

function delay(timeoutMs) {
  return new Promise((resolve) => window.setTimeout(resolve, timeoutMs))
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

export async function linkRegistrationWallet(
  registrationId,
  walletAddress,
  signer,
) {
  if (!signer) throw new Error('The connected wallet cannot sign this link.')
  const issuedAt = new Date().toISOString()
  const message = createWalletLinkMessage({
    registrationId,
    walletAddress,
    issuedAt,
  })
  const signature = await signer.signMessage(message)

  return post('/api/registrations/wallet', {
    registrationId,
    walletAddress,
    issuedAt,
    signature,
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
  signer,
}) {
  if (!signer) {
    throw new Error('The organiser wallet must sign the campaign activation.')
  }
  const issuedAt = new Date().toISOString()
  const message = createCampaignActivationMessage({
    campaignId,
    contractAddress,
    deploymentTransactionHash,
    issuedAt,
  })
  const signature = await signer.signMessage(message)

  const result = await post('/api/campaigns/activate', {
    campaignId,
    contractAddress,
    deploymentTransactionHash,
    issuedAt,
    signature,
  }, 30_000)
  return result.campaign
}

export async function getGaslessClaimStatus(registrationId) {
  return get(`/api/claims/${encodeURIComponent(registrationId)}`, 15_000)
}

async function waitForGaslessClaim(registrationId, attempts = 20) {
  let latest = null

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    latest = await getGaslessClaimStatus(registrationId)
    if (latest.claimStatus === 'claimed') return latest
    if (
      latest.claimStatus === 'failed' ||
      latest.claimStatus === 'wallet_connected'
    ) {
      return latest
    }
    await delay(2_500)
  }

  return latest
}

export async function requestGaslessClaim(registrationId) {
  let lastError

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const result = await post(
        '/api/claims/gasless',
        { registrationId },
        45_000,
      )
      if (result.claimStatus === 'claimed') return result

      const recovered = await waitForGaslessClaim(registrationId)
      if (recovered?.claimStatus === 'claimed') return recovered
    } catch (error) {
      lastError = error
      const recoverable =
        error?.status === 408 ||
        error?.status === 429 ||
        error?.code === 'RELAYER_BUSY'
      if (!recoverable) throw error

      const recovered = await waitForGaslessClaim(registrationId)
      if (recovered?.claimStatus === 'claimed') return recovered
    }

    await delay(2_000)
  }

  throw (
    lastError ||
    new Error('The gasless claim is still processing. Please try again shortly.')
  )
}

export async function getActiveCampaign(campaignId) {
  const result = await get(
    `/api/campaigns/${encodeURIComponent(campaignId)}`,
    12_000,
  )
  return result.campaign
}
