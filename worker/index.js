import { Contract, JsonRpcProvider, Wallet, verifyMessage } from 'ethers'
import rewardCampaignArtifact from '../src/contracts/RewardCampaign.json'
import {
  createCampaignActivationMessage,
  createWalletLinkMessage,
  isFreshProof,
} from '../src/proofs.js'

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

const defaultFujiRpcUrl = 'https://api.avax-test.network/ext/bc/C/rpc'
const defaultAdminWallet = '0x4ee6b577a6e122bc3c92be2d64ca907af865d813'
const processingLeaseMs = 90_000
const relayLockTtlSeconds = 45

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

function isSignature(value) {
  return /^0x[a-fA-F0-9]{130}$/.test(value)
}

function recoverProofAddress(message, signature) {
  try {
    return verifyMessage(message, signature).toLowerCase()
  } catch {
    return ''
  }
}

function databaseTimestampMs(value) {
  if (!value) return 0
  const normalized = String(value).includes('T')
    ? String(value)
    : `${String(value).replace(' ', 'T')}Z`
  return Date.parse(normalized) || 0
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
  const issuedAt = String(payload.issuedAt || '').trim()
  const signature = String(payload.signature || '').trim()

  if (
    !registrationId ||
    !isWalletAddress(walletAddress) ||
    !isSignature(signature) ||
    !isFreshProof(issuedAt)
  ) {
    return json({ error: 'A valid registration and wallet are required.' }, 400)
  }

  const message = createWalletLinkMessage({
    registrationId,
    walletAddress,
    issuedAt,
  })
  if (recoverProofAddress(message, signature) !== walletAddress) {
    return json({ error: 'The connected wallet did not authorize this link.' }, 401)
  }

  const registration = await env.DB.prepare(
    `SELECT wallet_address AS walletAddress, campaign_id AS campaignId
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

  const registration = await env.DB.prepare(
    `SELECT cr.wallet_address AS walletAddress,
            c.contract_address AS contractAddress
     FROM campaign_registrations cr
     JOIN campaigns c ON c.id = cr.campaign_id
     WHERE cr.id = ?1 AND c.status = 'active'`,
  )
    .bind(registrationId)
    .first()

  if (
    !registration ||
    String(registration.walletAddress || '').toLowerCase() !== walletAddress
  ) {
    return json({ error: 'The wallet is not linked to this registration.' }, 409)
  }

  const provider = new JsonRpcProvider(env.FUJI_RPC_URL || defaultFujiRpcUrl)
  const contract = new Contract(
    registration.contractAddress,
    rewardCampaignArtifact.abi,
    provider,
  )
  const receipt = await provider.getTransactionReceipt(transactionHash)
  if (
    !receiptContainsClaim(contract, receipt, walletAddress) ||
    String(receipt.to || '').toLowerCase() !==
      String(registration.contractAddress).toLowerCase()
  ) {
    return json(
      { error: 'The Fuji reward transaction could not be verified.' },
      400,
    )
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

async function getCampaign(env, campaignId) {
  const campaign = await env.DB.prepare(
    `SELECT id, contract_address AS contractAddress,
            owner_address AS ownerAddress, relayer_address AS relayerAddress,
            reward_amount_wei AS rewardAmountWei, status
     FROM campaigns
     WHERE id = ?1 AND status = 'active'`,
  )
    .bind(campaignId)
    .first()

  if (!campaign) {
    return json({ error: 'Gasless campaign not found.' }, 404)
  }

  return json({ campaign })
}

async function activateCampaign(request, env) {
  const payload = await readJson(request)
  const campaignId = String(payload.campaignId || '').trim().slice(0, 120)
  const contractAddress = String(payload.contractAddress || '').trim().toLowerCase()
  const deploymentTxHash = String(payload.deploymentTransactionHash || '').trim()
  const issuedAt = String(payload.issuedAt || '').trim()
  const signature = String(payload.signature || '').trim()

  if (
    !campaignId ||
    !isWalletAddress(contractAddress) ||
    !isTransactionHash(deploymentTxHash) ||
    !isSignature(signature) ||
    !isFreshProof(issuedAt)
  ) {
    return json({ error: 'Valid campaign deployment details are required.' }, 400)
  }
  if (!env.GASLESS_RELAYER_ADDRESS) {
    return json({ error: 'The ScanDrop gas sponsor is not configured.' }, 503)
  }

  const provider = new JsonRpcProvider(env.FUJI_RPC_URL || defaultFujiRpcUrl)
  const contract = new Contract(
    contractAddress,
    rewardCampaignArtifact.abi,
    provider,
  )
  const [owner, relayer, rewardAmount, receipt] = await Promise.all([
    contract.owner(),
    contract.relayer(),
    contract.rewardAmount(),
    provider.getTransactionReceipt(deploymentTxHash),
  ])
  const allowedOwner = String(env.ADMIN_WALLET_ADDRESS || defaultAdminWallet).toLowerCase()
  const allowedRelayer = String(env.GASLESS_RELAYER_ADDRESS).toLowerCase()
  const activationMessage = createCampaignActivationMessage({
    campaignId,
    contractAddress,
    deploymentTransactionHash: deploymentTxHash,
    issuedAt,
  })
  const authorizedOwner = recoverProofAddress(activationMessage, signature)

  if (String(owner).toLowerCase() !== allowedOwner) {
    return json({ error: 'The deployed contract is not owned by the ScanDrop organiser.' }, 403)
  }
  if (String(relayer).toLowerCase() !== allowedRelayer) {
    return json({ error: 'The deployed contract does not use the ScanDrop gas sponsor.' }, 403)
  }
  if (authorizedOwner !== allowedOwner) {
    return json({ error: 'The ScanDrop organiser did not authorize this campaign.' }, 401)
  }
  if (
    !receipt ||
    Number(receipt.status) !== 1 ||
    String(receipt.contractAddress || '').toLowerCase() !== contractAddress ||
    String(receipt.from || '').toLowerCase() !== allowedOwner
  ) {
    return json({ error: 'The Fuji deployment transaction could not be verified.' }, 400)
  }

  await env.DB.prepare(
    `INSERT INTO campaigns
      (id, contract_address, owner_address, relayer_address,
       deployment_tx_hash, deployment_block, reward_amount_wei, status)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'active')
     ON CONFLICT(id) DO UPDATE SET
       contract_address = excluded.contract_address,
       owner_address = excluded.owner_address,
       relayer_address = excluded.relayer_address,
       deployment_tx_hash = excluded.deployment_tx_hash,
       deployment_block = excluded.deployment_block,
       reward_amount_wei = excluded.reward_amount_wei,
       status = 'active',
       updated_at = CURRENT_TIMESTAMP`,
  )
    .bind(
      campaignId,
      contractAddress,
      String(owner).toLowerCase(),
      String(relayer).toLowerCase(),
      deploymentTxHash,
      receipt.blockNumber,
      rewardAmount.toString(),
    )
    .run()

  return json({
    campaign: {
      id: campaignId,
      contractAddress,
      ownerAddress: String(owner).toLowerCase(),
      relayerAddress: String(relayer).toLowerCase(),
      rewardAmountWei: rewardAmount.toString(),
      status: 'active',
    },
  })
}

async function loadRegistration(env, registrationId) {
  return env.DB.prepare(
    `SELECT cr.id, cr.wallet_address AS walletAddress,
            cr.claim_status AS claimStatus, cr.claim_tx_hash AS claimTxHash,
            cr.updated_at AS updatedAt,
            c.contract_address AS contractAddress,
            c.relayer_address AS relayerAddress,
            c.deployment_tx_hash AS deploymentTxHash,
            c.deployment_block AS deploymentBlock
     FROM campaign_registrations cr
     JOIN campaigns c ON c.id = cr.campaign_id
     WHERE cr.id = ?1 AND c.status = 'active'`,
  )
    .bind(registrationId)
    .first()
}

function receiptContainsClaim(contract, receipt, walletAddress) {
  if (!receipt || Number(receipt.status) !== 1) return false

  return receipt.logs.some((log) => {
    if (
      String(log.address || '').toLowerCase() !==
      String(contract.target).toLowerCase()
    ) {
      return false
    }

    try {
      const parsed = contract.interface.parseLog(log)
      return (
        parsed?.name === 'RewardClaimed' &&
        String(parsed.args.account).toLowerCase() === walletAddress.toLowerCase()
      )
    } catch {
      return false
    }
  })
}

async function findOnChainClaim(provider, contract, registration) {
  if (isTransactionHash(registration.claimTxHash || '')) {
    const receipt = await provider.getTransactionReceipt(registration.claimTxHash)
    if (receiptContainsClaim(contract, receipt, registration.walletAddress)) {
      return {
        transactionHash: registration.claimTxHash,
        blockNumber: receipt.blockNumber,
      }
    }
  }

  if (!(await contract.hasClaimed(registration.walletAddress))) return null

  let fromBlock = Number(registration.deploymentBlock || 0)
  if (!fromBlock && isTransactionHash(registration.deploymentTxHash || '')) {
    const deploymentReceipt = await provider.getTransactionReceipt(
      registration.deploymentTxHash,
    )
    fromBlock = Number(deploymentReceipt?.blockNumber || 0)
  }

  const logs = await contract.queryFilter(
    contract.filters.RewardClaimed(registration.walletAddress),
    fromBlock,
    'latest',
  )
  const log = logs.at(-1)
  if (!log) return null

  return {
    transactionHash: log.transactionHash,
    blockNumber: log.blockNumber,
  }
}

async function markClaimed(env, registration, claim) {
  await env.DB.prepare(
    `UPDATE campaign_registrations
     SET claim_tx_hash = ?1, claim_status = 'claimed',
         claimed_at = COALESCE(claimed_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?2 AND wallet_address = ?3`,
  )
    .bind(
      claim.transactionHash,
      registration.id,
      registration.walletAddress,
    )
    .run()
}

async function reconcileClaim(env, provider, contract, registration) {
  const claim = await findOnChainClaim(provider, contract, registration)
  if (!claim) return null
  await markClaimed(env, registration, claim)
  return claim
}

function claimedResponse(registration, claim) {
  return {
    ok: true,
    claimStatus: 'claimed',
    transactionHash: claim.transactionHash,
    blockNumber: claim.blockNumber || null,
    walletAddress: registration.walletAddress,
    recovered: Boolean(claim.recovered),
  }
}

function processingIsFresh(registration) {
  return (
    registration.claimStatus === 'processing' &&
    Date.now() - databaseTimestampMs(registration.updatedAt) < processingLeaseMs
  )
}

async function acquireRelayLock(env, holder) {
  const now = Math.floor(Date.now() / 1000)
  const expiresAt = now + relayLockTtlSeconds

  await env.DB.prepare(
    `INSERT OR IGNORE INTO relay_locks (id, holder, expires_at)
     VALUES ('fuji-relayer', '', 0)`,
  ).run()

  const result = await env.DB.prepare(
    `UPDATE relay_locks
     SET holder = ?1, expires_at = ?2, updated_at = CURRENT_TIMESTAMP
     WHERE id = 'fuji-relayer'
       AND (holder = '' OR expires_at < ?3 OR holder = ?1)`,
  )
    .bind(holder, expiresAt, now)
    .run()

  return Boolean(result.meta?.changes)
}

async function releaseRelayLock(env, holder) {
  await env.DB.prepare(
    `UPDATE relay_locks
     SET holder = '', expires_at = 0, updated_at = CURRENT_TIMESTAMP
     WHERE id = 'fuji-relayer' AND holder = ?1`,
  )
    .bind(holder)
    .run()
}

async function resetRegistrationForRetry(env, registrationId) {
  await env.DB.prepare(
    `UPDATE campaign_registrations
     SET claim_status = 'wallet_connected', updated_at = CURRENT_TIMESTAMP
     WHERE id = ?1 AND claim_status = 'processing'
       AND claim_tx_hash IS NULL`,
  )
    .bind(registrationId)
    .run()
}

async function getClaimStatus(env, registrationId) {
  let registration = await loadRegistration(env, registrationId)
  if (!registration) {
    return json({ error: 'ScanDrop registration not found.' }, 404)
  }

  if (isWalletAddress(registration.walletAddress || '')) {
    const provider = new JsonRpcProvider(env.FUJI_RPC_URL || defaultFujiRpcUrl)
    const contract = new Contract(
      registration.contractAddress,
      rewardCampaignArtifact.abi,
      provider,
    )
    const claim = await reconcileClaim(env, provider, contract, registration)
    if (claim) return json(claimedResponse(registration, { ...claim, recovered: true }))

    if (
      registration.claimStatus === 'processing' &&
      !processingIsFresh(registration)
    ) {
      await env.DB.prepare(
        `UPDATE campaign_registrations
         SET claim_status = 'failed', updated_at = CURRENT_TIMESTAMP
         WHERE id = ?1 AND claim_status = 'processing'`,
      )
        .bind(registrationId)
        .run()
      registration = { ...registration, claimStatus: 'failed' }
    }
  }

  return json({
    ok: registration.claimStatus === 'claimed',
    claimStatus: registration.claimStatus,
    transactionHash: registration.claimTxHash || null,
    walletAddress: registration.walletAddress || null,
  })
}

async function gaslessClaim(request, env) {
  const payload = await readJson(request)
  const registrationId = String(payload.registrationId || '').trim()

  if (!registrationId) {
    return json({ error: 'A valid ScanDrop registration is required.' }, 400)
  }
  if (!env.RELAYER_PRIVATE_KEY || !env.GASLESS_RELAYER_ADDRESS) {
    return json({ error: 'The ScanDrop gas sponsor is not ready.' }, 503)
  }

  let registration = await loadRegistration(env, registrationId)
  if (!registration || !isWalletAddress(registration.walletAddress || '')) {
    return json({ error: 'Connect the registered wallet before claiming.' }, 409)
  }

  const provider = new JsonRpcProvider(env.FUJI_RPC_URL || defaultFujiRpcUrl)
  const relayerWallet = new Wallet(env.RELAYER_PRIVATE_KEY, provider)
  const expectedRelayer = String(env.GASLESS_RELAYER_ADDRESS).toLowerCase()
  const contract = new Contract(
    registration.contractAddress,
    rewardCampaignArtifact.abi,
    relayerWallet,
  )

  const reconciled = await reconcileClaim(env, provider, contract, registration)
  if (reconciled) {
    return json(claimedResponse(registration, { ...reconciled, recovered: true }))
  }
  if (registration.claimStatus === 'claimed') {
    return json(
      claimedResponse(registration, {
        transactionHash: registration.claimTxHash,
        blockNumber: null,
      }),
    )
  }
  if (processingIsFresh(registration)) {
    return json(
      {
        ok: false,
        claimStatus: 'processing',
        transactionHash: registration.claimTxHash || null,
      },
      202,
    )
  }
  if (registration.claimStatus === 'processing') {
    await env.DB.prepare(
      `UPDATE campaign_registrations
       SET claim_status = 'failed', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?1 AND claim_status = 'processing'`,
    )
      .bind(registrationId)
      .run()
    registration = { ...registration, claimStatus: 'failed' }
  }

  const registrationLock = await env.DB.prepare(
    `UPDATE campaign_registrations
     SET claim_status = 'processing', claim_tx_hash = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?1 AND claim_status IN ('wallet_connected', 'failed')`,
  )
    .bind(registrationId)
    .run()

  if (!registrationLock.meta?.changes) {
    return json({ error: 'This registration is not ready for a gasless claim.' }, 409)
  }

  if (
    relayerWallet.address.toLowerCase() !== expectedRelayer ||
    String(registration.relayerAddress).toLowerCase() !== expectedRelayer
  ) {
    await resetRegistrationForRetry(env, registrationId)
    return json({ error: 'The ScanDrop gas sponsor configuration does not match.' }, 503)
  }

  const lockHolder = crypto.randomUUID()
  let relayLockHeld = false
  let transactionHash = ''

  try {
    relayLockHeld = await acquireRelayLock(env, lockHolder)
    if (!relayLockHeld) {
      await resetRegistrationForRetry(env, registrationId)
      return json(
        {
          error: 'The gas sponsor is processing another reward. Retrying shortly.',
          code: 'RELAYER_BUSY',
          retryAfterSeconds: 3,
        },
        429,
      )
    }

    const claimBeforeSend = await reconcileClaim(
      env,
      provider,
      contract,
      registration,
    )
    if (claimBeforeSend) {
      return json(
        claimedResponse(registration, {
          ...claimBeforeSend,
          recovered: true,
        }),
      )
    }

    const transaction = await contract.claimFor(registration.walletAddress)
    transactionHash = transaction.hash
    await env.DB.prepare(
      `UPDATE campaign_registrations
       SET claim_tx_hash = ?1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?2 AND claim_status = 'processing'`,
    )
      .bind(transactionHash, registrationId)
      .run()

    await releaseRelayLock(env, lockHolder)
    relayLockHeld = false

    const receipt = await provider.waitForTransaction(
      transactionHash,
      1,
      40_000,
    )
    if (!receipt) {
      return json(
        {
          ok: false,
          claimStatus: 'processing',
          transactionHash,
          walletAddress: registration.walletAddress,
        },
        202,
      )
    }
    if (Number(receipt.status) !== 1) {
      throw new Error('The sponsored Fuji transaction reverted.')
    }

    const claim = {
      transactionHash,
      blockNumber: receipt.blockNumber,
    }
    await markClaimed(env, registration, claim)
    return json(claimedResponse(registration, claim))
  } catch (error) {
    const recovered = await reconcileClaim(
      env,
      provider,
      contract,
      { ...registration, claimTxHash: transactionHash || registration.claimTxHash },
    ).catch(() => null)
    if (recovered) {
      return json(claimedResponse(registration, { ...recovered, recovered: true }))
    }

    if (transactionHash) {
      const pendingReceipt = await provider
        .getTransactionReceipt(transactionHash)
        .catch(() => null)
      if (!pendingReceipt) {
        return json(
          {
            ok: false,
            claimStatus: 'processing',
            transactionHash,
            walletAddress: registration.walletAddress,
          },
          202,
        )
      }
    }

    await env.DB.prepare(
      `UPDATE campaign_registrations
       SET claim_status = 'failed', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?1 AND claim_status = 'processing'`,
    )
      .bind(registrationId)
      .run()

    const technicalMessage =
      error?.shortMessage || error?.reason || error?.message || 'Unknown error'
    const normalizedMessage = String(technicalMessage).toLowerCase()
    let publicMessage = 'ScanDrop could not sponsor this claim. Please try again.'

    if (normalizedMessage.includes('alreadyclaimed') || normalizedMessage.includes('already claimed')) {
      publicMessage = 'This wallet has already claimed this reward.'
    } else if (
      normalizedMessage.includes('insufficientcampaignbalance') ||
      normalizedMessage.includes('campaign balance')
    ) {
      publicMessage = 'This campaign has run out of AVAX rewards.'
    } else if (normalizedMessage.includes('insufficient funds')) {
      publicMessage = 'The ScanDrop gas sponsor needs more Fuji AVAX.'
    } else if (normalizedMessage.includes('campaignended')) {
      publicMessage = 'This campaign has ended.'
    } else if (normalizedMessage.includes('campaignpaused')) {
      publicMessage = 'This campaign is paused.'
    }

    console.error('Gasless Fuji claim failed:', technicalMessage)
    return json({ error: publicMessage }, 502)
  } finally {
    if (relayLockHeld) {
      await releaseRelayLock(env, lockHolder).catch(() => {})
    }
  }
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
    if (
      request.method === 'POST' &&
      url.pathname === '/api/campaigns/activate'
    ) {
      return await activateCampaign(request, env)
    }
    if (
      request.method === 'POST' &&
      url.pathname === '/api/claims/gasless'
    ) {
      return await gaslessClaim(request, env)
    }
    if (request.method === 'GET' && url.pathname.startsWith('/api/claims/')) {
      const registrationId = decodeURIComponent(
        url.pathname.slice('/api/claims/'.length),
      )
      return await getClaimStatus(env, registrationId)
    }
    if (request.method === 'GET' && url.pathname.startsWith('/api/campaigns/')) {
      const campaignId = decodeURIComponent(url.pathname.slice('/api/campaigns/'.length))
      return await getCampaign(env, campaignId)
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
    if (url.pathname === '/favicon.ico') {
      return Response.redirect(new URL('/favicon.svg', url), 302)
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
