const requestTimeoutMs = 12_000

async function post(path, payload) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), requestTimeoutMs)

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
