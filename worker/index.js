const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: jsonHeaders,
  })
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isWalletAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function isTransactionHash(value) {
  return /^0x[a-fA-F0-9]{64}$/.test(value)
}

async function readJson(request) {
  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > 4096) {
    throw new Error('PAYLOAD_TOO_LARGE')
  }

  return request.json()
}

async function registerUser(request, env) {
  const payload = await readJson(request)
  const email = String(payload.email || '').trim().toLowerCase()
  const displayName = String(payload.displayName || '').trim().slice(0, 80)
  const campaignId = String(payload.campaignId || '').trim().slice(0, 120)
  const marketingConsent = payload.marketingConsent === true

  if (!isEmail(email) || email.length > 254) {
    return json({ error: 'Enter a valid email address.' }, 400)
  }
  if (!campaignId) {
    return json({ error: 'Campaign information is missing.' }, 400)
  }
  if (!marketingConsent) {
    return json(
      { error: 'Consent is required for ScanDrop reward and product updates.' },
      400,
    )
  }

  let user = await env.DB.prepare(
    'SELECT id, email, display_name AS displayName FROM users WHERE email = ?1',
  )
    .bind(email)
    .first()

  if (!user) {
    user = {
      id: crypto.randomUUID(),
      email,
      displayName,
    }
    await env.DB.prepare(
      `INSERT INTO users
        (id, email, display_name, marketing_consent)
       VALUES (?1, ?2, ?3, 1)`,
    )
      .bind(user.id, email, displayName)
      .run()
  } else {
    await env.DB.prepare(
      `UPDATE users
       SET display_name = ?1, marketing_consent = 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?2`,
    )
      .bind(displayName || user.displayName, user.id)
      .run()
  }

  let registration = await env.DB.prepare(
    `SELECT id, campaign_id AS campaignId, wallet_address AS walletAddress,
            claim_status AS claimStatus
     FROM campaign_registrations
     WHERE user_id = ?1 AND campaign_id = ?2`,
  )
    .bind(user.id, campaignId)
    .first()

  if (!registration) {
    registration = {
      id: crypto.randomUUID(),
      campaignId,
      walletAddress: null,
      claimStatus: 'registered',
    }
    await env.DB.prepare(
      `INSERT INTO campaign_registrations
        (id, user_id, campaign_id)
       VALUES (?1, ?2, ?3)`,
    )
      .bind(registration.id, user.id, campaignId)
      .run()
  }

  return json(
    {
      registration: {
        id: registration.id,
        userId: user.id,
        email,
        displayName: displayName || user.displayName || '',
        campaignId: registration.campaignId,
        walletAddress: registration.walletAddress,
        claimStatus: registration.claimStatus,
      },
    },
    201,
  )
}

async function linkWallet(request, env) {
  const payload = await readJson(request)
  const registrationId = String(payload.registrationId || '').trim()
  const walletAddress = String(payload.walletAddress || '').trim().toLowerCase()

  if (!registrationId || !isWalletAddress(walletAddress)) {
    return json({ error: 'A valid registration and wallet are required.' }, 400)
  }

  const registration = await env.DB.prepare(
    `SELECT wallet_address AS walletAddress
     FROM campaign_registrations
     WHERE id = ?1`,
  )
    .bind(registrationId)
    .first()

  if (!registration) {
    return json({ error: 'Registration not found.' }, 404)
  }

  if (
    registration.walletAddress &&
    registration.walletAddress.toLowerCase() !== walletAddress
  ) {
    return json(
      { error: 'This ScanDrop account is already linked to a different wallet for this campaign.' },
      409,
    )
  }

  try {
    const result = await env.DB.prepare(
      `UPDATE campaign_registrations
       SET wallet_address = ?1, wallet_linked_at = CURRENT_TIMESTAMP,
           claim_status = CASE
             WHEN claim_status = 'claimed' THEN claim_status
             ELSE 'wallet_connected'
           END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?2`,
    )
      .bind(walletAddress, registrationId)
      .run()

    if (!result.meta?.changes) return json({ error: 'Wallet link was not saved.' }, 409)
  } catch (error) {
    if (String(error?.message || error).includes('UNIQUE')) {
      return json(
        { error: 'This wallet is already linked to a ScanDrop account for this campaign.' },
        409,
      )
    }
    throw error
  }

  return json({ ok: true, walletAddress })
}

async function recordClaim(request, env) {
  const payload = await readJson(request)
  const registrationId = String(payload.registrationId || '').trim()
  const walletAddress = String(payload.walletAddress || '').trim().toLowerCase()
  const transactionHash = String(payload.transactionHash || '').trim()

  if (
    !registrationId ||
    !isWalletAddress(walletAddress) ||
    !isTransactionHash(transactionHash)
  ) {
    return json({ error: 'Valid registration, wallet, and transaction details are required.' }, 400)
  }

  const result = await env.DB.prepare(
    `UPDATE campaign_registrations
     SET wallet_address = ?1, claim_tx_hash = ?2, claim_status = 'claimed',
         claimed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?3 AND wallet_address = ?1`,
  )
    .bind(walletAddress, transactionHash, registrationId)
    .run()

  if (!result.meta?.changes) {
    return json({ error: 'The wallet is not linked to this registration.' }, 409)
  }

  return json({ ok: true, claimStatus: 'claimed' })
}

async function handleApi(request, env, url) {
  if (!env.DB) {
    return json({ error: 'ScanDrop registration storage is unavailable.' }, 503)
  }

  try {
    if (request.method === 'POST' && url.pathname === '/api/registrations') {
      return await registerUser(request, env)
    }
    if (
      request.method === 'POST' &&
      url.pathname === '/api/registrations/wallet'
    ) {
      return await linkWallet(request, env)
    }
    if (
      request.method === 'POST' &&
      url.pathname === '/api/registrations/claim'
    ) {
      return await recordClaim(request, env)
    }

    return json({ error: 'Not found.' }, 404)
  } catch (error) {
    if (error?.message === 'PAYLOAD_TOO_LARGE') {
      return json({ error: 'Request is too large.' }, 413)
    }
    if (error instanceof SyntaxError) {
      return json({ error: 'Invalid request.' }, 400)
    }

    console.error('ScanDrop registration API failed:', error?.message || error)
    return json({ error: 'Registration service is temporarily unavailable.' }, 500)
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env, url)
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request)
    }

    return new Response('ScanDrop is ready, but its static assets are unavailable.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  },
}
