import './style.css'
import QRCode from 'qrcode'
import {
  FUJI_NETWORK,
  REWARD_CAMPAIGN_ADDRESS,
  claimReward,
  clearRewardCampaignAddress,
  connectWallet,
  contractUrl,
  deployRewardCampaign,
  formatAddress,
  fundGasSponsor,
  hasInjectedWallet,
  isContractConfigured,
  readCampaign,
  setRewardCampaignAddress,
  transactionUrl,
} from './web3.js'
import {
  calculateGasSponsorReserveAvax,
  calculateGasSponsorTopUpAvax,
} from './campaign-economics.js'
import {
  connectWalletConnect,
  disconnectWalletConnect,
  isWalletConnectConfigured,
  preloadWalletConnect,
} from './walletconnect.js'
import {
  activateGaslessCampaign,
  getActiveCampaign,
  linkRegistrationWallet,
  requestGaslessClaim,
  recordRegistrationClaim,
  registerScanDropProfile,
} from './registration.js'
import { getClaimFlowStep } from './claim-policy.js'

const icons = {
  overview: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z"/></svg>',
  campaigns: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 13 1.4 1.4L12 7.8l4.6 4.6L20 9v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-4Z"/><path d="M16 4h4v4"/></svg>',
  audience: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 6.5a2.5 2.5 0 0 1 0 5M16.5 15a4 4 0 0 1 4 4"/></svg>',
  rewards: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="14" rx="3"/><path d="M16 13h5M7 6V5a3 3 0 0 1 5.2-2"/></svg>',
  automation: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 7v5l3 2M16 3h5v5"/></svg>',
  settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>',
}

const campaign = {
  id: 'web3nz-welcome',
  name: 'Web3NZ AVAX Welcome Drop',
  sponsor: 'Web3NZ Hackathon',
  reward: 0.001,
  currency: 'AVAX',
  budget: 5,
  spent: 1.4,
  claimers: 140,
  remaining: 360,
  status: isContractConfigured ? 'Live on Fuji' : 'Contract ready',
}

const routeParams = new URLSearchParams(window.location.search)
const isClaimRoute = routeParams.has('campaign')
const adminWalletAddress = (
  import.meta.env.VITE_ADMIN_WALLET_ADDRESS?.trim() ||
  '0x4ee6b577a6e122bc3c92be2d64ca907af865d813'
).toLowerCase()

const walletState = {
  address: '',
  balance: '',
  signer: null,
  campaign: null,
  connectionType: '',
  busy: false,
  error: '',
}

const adminState = {
  busy: false,
  error: '',
  unlocked: false,
}

let campaignLoadError = ''

const profileStorageKey = 'scandrop:profile'

function loadSavedProfile() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(profileStorageKey) || 'null')
    return saved?.campaignId === campaign.id ? saved : null
  } catch {
    return null
  }
}

const savedProfile = loadSavedProfile()
const accountState = {
  registrationId: savedProfile?.registrationId || '',
  userId: savedProfile?.userId || '',
  email: savedProfile?.email || '',
  displayName: savedProfile?.displayName || '',
  campaignId: savedProfile?.campaignId || campaign.id,
  walletAddress: savedProfile?.walletAddress || '',
  walletLinked: Boolean(savedProfile?.walletAddress),
  claimStatus: savedProfile?.claimStatus || 'registered',
  busy: false,
  error: '',
}

function saveProfile() {
  const profile = {
    registrationId: accountState.registrationId,
    userId: accountState.userId,
    email: accountState.email,
    displayName: accountState.displayName,
    campaignId: accountState.campaignId,
    walletAddress: accountState.walletAddress,
    claimStatus: accountState.claimStatus,
  }

  try {
    window.localStorage.setItem(profileStorageKey, JSON.stringify(profile))
  } catch {
    // The D1 database remains authoritative if browser storage is unavailable.
  }
}

const app = document.querySelector('#app')

app.innerHTML = `
  <div class="app-shell">
    <aside class="sidebar">
      <a class="brand" href="#" aria-label="ScanDrop home">
        <span class="brand-mark"><span></span><span></span><span></span></span>
        <span>scandrop</span>
      </a>

      <nav class="main-nav" aria-label="Main navigation">
        <button class="nav-item active" data-section="Overview">${icons.overview}<span>Overview</span></button>
        <button class="nav-item" data-section="Campaigns">${icons.campaigns}<span>Campaigns</span><span class="count">3</span></button>
        <button class="nav-item" data-section="Audience">${icons.audience}<span>Audience</span></button>
        <button class="nav-item" data-section="Rewards">${icons.rewards}<span>Rewards</span></button>
        <button class="nav-item" data-section="Automations">${icons.automation}<span>Automations</span><span class="live-dot"></span></button>
      </nav>

      <div class="side-card avalanche-card">
        <span class="eyebrow">AVALANCHE NATIVE</span>
        <strong>Fuji reward rail.</strong>
        <p>Native test AVAX, one claim per wallet, enforced by Solidity on C-Chain.</p>
        <div class="protocol-row"><span>AVAX</span><span>FUJI</span><span>43113</span></div>
      </div>

      <div class="sidebar-foot">
        <button class="nav-item">${icons.settings}<span>Settings</span></button>
        <div class="workspace-avatar">W3</div>
        <div><strong>Web3NZ Team</strong><small>Hackathon workspace</small></div>
      </div>
    </aside>

    <main class="main-content">
      <header class="topbar">
        <div>
          <span class="mobile-brand">scandrop</span>
          <span class="workspace-label">Workspace / <strong id="section-name">Overview</strong></span>
        </div>
        <div class="top-actions">
          <span class="network-status"><i></i> Avalanche Fuji</span>
          <button class="ghost-button" id="preview-claim">Connect & claim</button>
          <button class="primary-button" id="create-campaign"><span>＋</span> New campaign</button>
        </div>
      </header>

      <section class="content-wrap">
        <div class="hero-copy">
          <div>
            <span class="date-label">WEB3NZ HACKATHON · AVALANCHE C-CHAIN</span>
            <h1>Turn every scan into<br><em>an on-chain relationship.</em></h1>
          </div>
          <p>Launch instant AVAX reward drops, prove every claim on Fuji, and bring the right people back.</p>
        </div>

        <div class="chain-banner ${isContractConfigured ? 'connected' : ''}" id="contract-banner">
          <div class="chain-orb">A</div>
          <div>
            <span class="eyebrow">SMART CONTRACT</span>
            <strong id="contract-title">${isContractConfigured ? 'Fuji contract connected' : 'Fuji integration compiled and ready'}</strong>
            <small id="contract-address">${isContractConfigured ? formatAddress(REWARD_CAMPAIGN_ADDRESS) : 'Deploy the contract to activate live claims'}</small>
          </div>
          <span class="chain-badge" id="contract-badge">${isContractConfigured ? '● ON-CHAIN' : '○ DEPLOYMENT PENDING'}</span>
        </div>

        <div class="metric-grid">
          <article class="metric-card">
            <div class="metric-top"><span>Unique claimers</span><span class="metric-icon lime">${icons.audience}</span></div>
            <strong id="claimer-count">${campaign.claimers}</strong>
            <small><b>On-chain protected</b> one wallet, one claim</small>
          </article>
          <article class="metric-card">
            <div class="metric-top"><span>7-day return</span><span class="metric-icon violet">${icons.automation}</span></div>
            <strong>17.1%</strong>
            <small><b>↑ 4.8%</b> 120 people returned</small>
          </article>
          <article class="metric-card">
            <div class="metric-top"><span>Cost per retained user</span><span class="metric-icon cyan">${icons.rewards}</span></div>
            <strong>0.042 AVAX</strong>
            <small><b>↓ 12.6%</b> more efficient</small>
          </article>
          <article class="metric-card">
            <div class="metric-top"><span>Reward budget</span><span class="metric-icon orange">${icons.campaigns}</span></div>
            <strong id="budget-used">${campaign.spent.toFixed(2)} AVAX</strong>
            <small>of <span id="budget-total">${campaign.budget.toFixed(2)} AVAX</span> funded</small>
          </article>
        </div>

        <div class="dashboard-grid">
          <article class="panel campaign-panel">
            <div class="panel-heading">
              <div>
                <span class="eyebrow">FUJI CAMPAIGN</span>
                <h2 id="campaign-title">${campaign.name}</h2>
              </div>
              <button class="icon-button" aria-label="Campaign options">•••</button>
            </div>
            <div class="campaign-body">
              <div class="qr-wrap">
                <canvas id="campaign-qr" aria-label="Scannable Avalanche reward campaign QR code"></canvas>
                <div class="qr-unavailable" id="qr-unavailable" hidden>
                  <strong>QR unavailable</strong>
                  <span>Load or deploy an active gasless campaign.</span>
                </div>
                <span class="scan-corners"></span>
              </div>
              <div class="campaign-info">
                <div class="reward-pill"><span>Instant reward</span><strong id="reward-value">${campaign.reward.toFixed(3)} ${campaign.currency}</strong></div>
                <dl>
                  <div><dt>Claim rule</dt><dd>Once per wallet</dd></div>
                  <div><dt>Network</dt><dd>Fuji C-Chain</dd></div>
                  <div><dt>Status</dt><dd><span class="status-pill" id="contract-status-label">● ${campaign.status}</span></dd></div>
                  <div><dt>Gas sponsor</dt><dd><span id="gas-sponsor-health">Checking…</span></dd></div>
                </dl>
                <button class="dark-button" id="open-claim">Open wallet experience <span>↗</span></button>
                <button class="sponsor-top-up" id="fund-gas-sponsor" hidden>Refill gas sponsor</button>
              </div>
            </div>
            <div class="budget-row">
              <div><span>Campaign funding</span><strong><span id="budget-spent-label">${campaign.spent.toFixed(2)} AVAX</span> / <span id="budget-label">${campaign.budget.toFixed(2)} AVAX</span></strong></div>
              <div class="progress-track"><span id="budget-progress" style="width:${(campaign.spent / campaign.budget) * 100}%"></span></div>
              <div class="budget-meta"><span id="successful-claims">${campaign.claimers} successful claims</span><span id="remaining-claims">${campaign.remaining} rewards remaining</span></div>
            </div>
          </article>

          <article class="panel funnel-panel">
            <div class="panel-heading">
              <div><span class="eyebrow">RETENTION FUNNEL</span><h2>From scan to loyalty</h2></div>
              <span class="period-pill">Last 30 days⌄</span>
            </div>
            <div class="funnel-chart">
              <div class="funnel-row">
                <div><span>Unique scans</span><strong>1,000</strong></div>
                <div class="funnel-bar"><span style="width:100%"></span></div><b>100%</b>
              </div>
              <div class="funnel-row">
                <div><span>Wallet connected</span><strong>700</strong></div>
                <div class="funnel-bar"><span style="width:70%"></span></div><b>70%</b>
              </div>
              <div class="funnel-row">
                <div><span>Day 7 return</span><strong>120</strong></div>
                <div class="funnel-bar"><span style="width:34%"></span></div><b>17.1%</b>
              </div>
              <div class="funnel-row">
                <div><span>Day 30 active</span><strong>50</strong></div>
                <div class="funnel-bar"><span style="width:19%"></span></div><b>7.1%</b>
              </div>
            </div>
            <div class="funnel-insight"><span>↗</span><p><strong>Every reward is publicly verifiable.</strong><br>Fuji events become a trusted campaign audit trail.</p></div>
          </article>
        </div>

        <div class="lower-grid">
          <article class="panel journey-panel">
            <div class="panel-heading">
              <div><span class="eyebrow">AUTOMATED JOURNEY</span><h2>Reward the right moments</h2></div>
              <button class="text-button">Edit journey →</button>
            </div>
            <div class="journey">
              <div class="journey-step active"><span class="step-icon">⌁</span><div><small>DAY 0</small><strong>Instant AVAX drop</strong><p>0.001 AVAX after a unique scan</p></div><b>700</b></div>
              <div class="journey-line"></div>
              <div class="journey-step"><span class="step-icon">✉</span><div><small>DAY 3</small><strong>Product introduction</strong><p>Show what is waiting for them</p></div><b>482</b></div>
              <div class="journey-line"></div>
              <div class="journey-step"><span class="step-icon">↻</span><div><small>DAY 7</small><strong>Interest-based return</strong><p>0.03 AVAX for a meaningful visit</p></div><b>120</b></div>
              <div class="journey-line"></div>
              <div class="journey-step"><span class="step-icon">✦</span><div><small>DAY 30</small><strong>High-intent reward</strong><p>0.05 AVAX for qualified users</p></div><b>50</b></div>
            </div>
          </article>

          <article class="panel audience-panel">
            <div class="panel-heading">
              <div><span class="eyebrow">AVALANCHE ACTIVITY</span><h2>What is on-chain?</h2></div>
              <a class="text-button explorer-link" href="${FUJI_NETWORK.explorerUrl}" target="_blank" rel="noreferrer">Fuji explorer →</a>
            </div>
            <div class="audience-list chain-list">
              <div><span class="audience-dot web3">01</span><p><strong>Wallet ownership</strong><small>Signed by the connected account</small></p><b>Verified</b></div>
              <div><span class="audience-dot games">02</span><p><strong>Unique claim</strong><small>Enforced by the Solidity mapping</small></p><b>Atomic</b></div>
              <div><span class="audience-dot local">03</span><p><strong>Reward transfer</strong><small>Native test AVAX on Fuji</small></p><b>On-chain</b></div>
              <div><span class="audience-dot other">04</span><p><strong>Campaign balance</strong><small>Limited by contract funding</small></p><b>Public</b></div>
            </div>
          </article>
        </div>
      </section>
    </main>
  </div>

  <dialog id="claim-dialog" class="claim-dialog">
    <button class="dialog-close" data-close aria-label="Close">×</button>
    <div class="phone-shell">
      <div class="phone-top"><span>9:41</span><span>● ◒ ▰</span></div>
      <div class="claim-brand"><span class="brand-mark small"><span></span><span></span><span></span></span>scandrop</div>
      <div id="claim-content"></div>
    </div>
  </dialog>

  <dialog id="campaign-dialog" class="campaign-dialog">
    <button class="dialog-close" data-close aria-label="Close">×</button>
    <span class="eyebrow">NEW FUJI CAMPAIGN</span>
    <h2>Deploy an AVAX reward drop</h2>
    <p>Set the campaign economics, connect the organiser wallet, and confirm one Fuji deployment transaction in Core.</p>
    <form id="campaign-form">
      <label>Campaign name<input name="name" value="Web3NZ AVAX Welcome Drop" required></label>
      <div class="form-row">
        <label>Reward per wallet<div class="input-unit"><span>◆</span><input name="reward" type="number" min="0.001" step="0.001" value="0.001" required><b>AVAX</b></div></label>
        <label>Contract funding<div class="input-unit"><span>◆</span><input name="budget" type="number" min="0.01" step="0.01" value="0.01" required><b>AVAX</b></div></label>
      </div>
      <label>Campaign duration<div class="input-unit duration-unit"><span>◷</span><input name="duration" type="number" min="1" step="1" value="30" required><b>DAYS</b></div></label>
      <div class="rule-preview"><span>✓</span><div><strong>One wallet, one reward</strong><p>The RewardCampaign contract rejects every duplicate claim.</p></div></div>
      <div class="rule-preview"><span>⚡</span><div><strong>Gasless for every funded reward</strong><p><b id="gas-reserve-preview">0.025</b> AVAX is reserved for ScanDrop's relayer, based on the campaign capacity.</p></div></div>
      <div class="deployment-summary">
        <span>Fuji testnet only</span>
        <span>No real-money value</span>
        <span>Wallet confirmation required</span>
      </div>
      <div class="deployment-status" id="deployment-status" hidden></div>
      <button class="primary-button full" id="deploy-campaign" type="submit">Connect Core & deploy on Fuji</button>
      <small class="deployment-note">Core will show contract funding + <b id="gas-reserve-note">0.025</b> AVAX for the gas sponsor + deployment gas. Claiming users need no AVAX.</small>
    </form>
  </dialog>

  <dialog id="admin-auth-dialog" class="admin-auth-dialog">
    <div id="admin-auth-content"></div>
  </dialog>

  <div class="toast" id="toast" role="status"></div>
`

const claimDialog = document.querySelector('#claim-dialog')
const campaignDialog = document.querySelector('#campaign-dialog')
const adminAuthDialog = document.querySelector('#admin-auth-dialog')
const toast = document.querySelector('#toast')

function campaignUrl() {
  const url = new URL(window.location.href)
  url.search = ''
  url.searchParams.set('campaign', campaign.id)
  if (isContractConfigured) {
    url.searchParams.set('contract', REWARD_CAMPAIGN_ADDRESS)
  }
  return url.toString()
}

async function renderQr() {
  const canvas = document.querySelector('#campaign-qr')
  const unavailable = document.querySelector('#qr-unavailable')
  const claimButton = document.querySelector('#open-claim')

  if (!isContractConfigured) {
    canvas.hidden = true
    unavailable.hidden = false
    claimButton.disabled = true
    return
  }

  canvas.hidden = false
  unavailable.hidden = true
  claimButton.disabled = false
  await QRCode.toCanvas(canvas, campaignUrl(), {
    width: 184,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#0b0d0c', light: '#efffc5' },
  })
}

function showToast(message) {
  toast.textContent = message
  toast.classList.add('show')
  window.setTimeout(() => toast.classList.remove('show'), 2800)
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function friendlyWalletError(error) {
  if (error?.code === 4001 || error?.code === 'ACTION_REJECTED') {
    return 'The wallet request was cancelled.'
  }

  const message = error?.shortMessage || error?.reason || error?.message || 'Wallet request failed.'
  if (message.includes('AlreadyClaimed')) return 'This wallet has already claimed this reward.'
  if (message.includes('InsufficientCampaignBalance')) return 'The campaign has run out of AVAX.'
  if (message.toLowerCase().includes('insufficient funds')) {
    return 'The ScanDrop gas sponsor needs more Fuji AVAX. Please ask the organiser to refill it.'
  }
  if (message.includes('could not coalesce error')) {
    return 'The Fuji transaction service could not complete the request. Please try again.'
  }
  if (message.includes('CampaignPaused')) return 'This campaign is currently paused.'
  if (message.includes('CampaignEnded')) return 'This campaign has ended.'
  return message.replace('execution reverted: ', '')
}

function renderAdminGate() {
  const content = document.querySelector('#admin-auth-content')
  if (!content) return

  content.innerHTML = `
    <span class="eyebrow">SCANDROP ADMIN</span>
    <div class="admin-lock">SD</div>
    <h2>Organiser wallet required.</h2>
    <p>The campaign dashboard is restricted to the wallet that owns the Fuji reward contract.</p>
    <div class="admin-wallet-rule">
      <small>Allowed organiser</small>
      <strong>${formatAddress(adminWalletAddress)}</strong>
    </div>
    ${adminState.error ? `<div class="wallet-error">${escapeHtml(adminState.error)}</div>` : ''}
    <div class="wallet-connect-options">
      <button class="claim-button walletconnect-button" id="admin-walletconnect" ${adminState.busy || !isWalletConnectConfigured ? 'disabled' : ''}>
        <span class="connect-icon">◎</span>
        <span><strong>${adminState.busy ? 'Waiting for wallet…' : 'Continue with Core mobile'}</strong><small>Connect the organiser wallet to continue</small></span>
      </button>
      <button class="extension-button" id="admin-extension" ${adminState.busy || !hasInjectedWallet() ? 'disabled' : ''}>
        <span class="connect-icon">◇</span>
        <span><strong>Continue with browser wallet</strong><small>${hasInjectedWallet() ? 'Core or MetaMask detected' : 'Available in a wallet-enabled desktop browser'}</small></span>
      </button>
    </div>
    <small class="admin-sign-note">Connecting does not send AVAX or approve spending. Every funding action still requires confirmation in Core.</small>
  `

  document.querySelector('#admin-walletconnect').addEventListener('click', () => {
    handleAdminSignIn('walletconnect')
  })
  document.querySelector('#admin-extension').addEventListener('click', () => {
    handleAdminSignIn('injected')
  })
}

async function handleAdminSignIn(connectionType) {
  adminState.busy = true
  adminState.error = ''
  renderAdminGate()

  if (connectionType === 'walletconnect' && adminAuthDialog.open) {
    adminAuthDialog.close()
  }

  try {
    const wallet =
      connectionType === 'walletconnect'
        ? await connectWalletConnect()
        : await connectWallet()
    const connectedAddress = wallet.address.toLowerCase()

    if (connectedAddress !== adminWalletAddress) {
      if (connectionType === 'walletconnect') {
        await disconnectWalletConnect().catch(() => {})
      }
      throw new Error(
        `This wallet is not the ScanDrop organiser. Connect ${formatAddress(adminWalletAddress)} instead.`,
      )
    }

    walletState.address = wallet.address
    walletState.balance = wallet.balance
    walletState.signer = wallet.signer
    walletState.connectionType = connectionType
    walletState.campaign = await readCampaign(wallet.address).catch(() => null)
    adminState.unlocked = true
    document.body.classList.remove('admin-locked')
    adminAuthDialog.close()
    updateDeploymentButton()
    showToast('ScanDrop organiser verified.')
  } catch (error) {
    adminState.error = friendlyWalletError(error)
  } finally {
    adminState.busy = false
    if (!adminState.unlocked) {
      renderAdminGate()
      if (!adminAuthDialog.open) adminAuthDialog.showModal()
    }
  }
}

function claimAvailability() {
  const snapshot = walletState.campaign
  if (!accountState.walletLinked) return { label: 'ScanDrop account link required', disabled: true }
  if (!isContractConfigured) return { label: 'Contract deployment required', disabled: true }
  if (!snapshot) return { label: 'Checking eligibility…', disabled: true }
  if (snapshot.paused) return { label: 'Campaign paused', disabled: true }
  if (snapshot.endTime < new Date()) return { label: 'Campaign ended', disabled: true }
  if (snapshot.hasClaimed) return { label: 'Reward already claimed', disabled: true }
  if (snapshot.remainingClaims < 1) return { label: 'Campaign fully claimed', disabled: true }
  return {
    label: snapshot.gasless
      ? `Receive ${Number(snapshot.rewardAmount).toFixed(3)} AVAX · Gas paid`
      : `Claim ${Number(snapshot.rewardAmount).toFixed(3)} AVAX`,
    disabled: false,
  }
}

async function handleRegistrationSubmit(event) {
  event.preventDefault()
  if (campaignLoadError || !isContractConfigured) {
    accountState.error =
      'Registration is paused until the active reward campaign is available.'
    renderClaimExperience()
    return
  }
  const data = new FormData(event.currentTarget)
  accountState.busy = true
  accountState.error = ''
  renderClaimExperience()

  try {
    const registration = await registerScanDropProfile({
      email: data.get('email'),
      displayName: data.get('displayName'),
      campaignId: campaign.id,
      marketingConsent: data.get('marketingConsent') === 'on',
    })

    accountState.registrationId = registration.id
    accountState.userId = registration.userId
    accountState.email = registration.email
    accountState.displayName = registration.displayName
    accountState.campaignId = registration.campaignId
    accountState.walletAddress = registration.walletAddress || ''
    accountState.walletLinked = Boolean(registration.walletAddress)
    accountState.claimStatus = registration.claimStatus || 'registered'
    saveProfile()
  } catch (error) {
    accountState.error = error?.message || 'ScanDrop registration failed.'
  } finally {
    accountState.busy = false
    renderClaimExperience()
  }
}

async function changeScanDropProfile() {
  if (walletState.connectionType === 'walletconnect') {
    await disconnectWalletConnect().catch(() => {})
  }

  Object.assign(accountState, {
    registrationId: '',
    userId: '',
    email: '',
    displayName: '',
    campaignId: campaign.id,
    walletAddress: '',
    walletLinked: false,
    claimStatus: 'registered',
    busy: false,
    error: '',
  })
  try {
    window.localStorage.removeItem(profileStorageKey)
  } catch {
    // Continue with the in-memory reset when browser storage is unavailable.
  }

  walletState.address = ''
  walletState.balance = ''
  walletState.signer = null
  walletState.campaign = null
  walletState.connectionType = ''
  walletState.error = ''
  renderClaimExperience()
}

function renderClaimExperience() {
  const content = document.querySelector('#claim-content')
  const flowStep = getClaimFlowStep({
    registrationId: accountState.registrationId,
    claimStatus: accountState.claimStatus,
    connectedWallet: walletState.address,
  })

  if (flowStep === 'register') {
    content.innerHTML = `
      <span class="drop-badge">STEP 1 OF 3 · SCANDROP ACCOUNT</span>
      <div class="profile-orbit"><span>SD</span></div>
      <h2>Create your ScanDrop profile.</h2>
      <p>Register once so this reward can become the start of a longer relationship.</p>
      ${campaignLoadError ? `<div class="wallet-error">${escapeHtml(campaignLoadError)}</div>` : ''}
      ${accountState.error ? `<div class="wallet-error">${escapeHtml(accountState.error)}</div>` : ''}
      <form class="registration-form" id="registration-form">
        <label>
          <span>Name <small>optional</small></span>
          <input name="displayName" autocomplete="name" maxlength="80" value="${escapeHtml(accountState.displayName)}" placeholder="Your name">
        </label>
        <label>
          <span>Email</span>
          <input name="email" type="email" autocomplete="email" maxlength="254" value="${escapeHtml(accountState.email)}" placeholder="you@example.com" required>
        </label>
        <label class="consent-row">
          <input name="marketingConsent" type="checkbox" required>
          <span>I agree to receive ScanDrop reward reminders and product updates. I can unsubscribe later.</span>
        </label>
        <button class="claim-button" type="submit" ${accountState.busy || campaignLoadError ? 'disabled' : ''}>
          ${campaignLoadError ? 'Campaign unavailable' : accountState.busy ? 'Creating account…' : 'Create account & continue'}
        </button>
      </form>
      <small class="claim-note">Test profile only · No password required · Email delivery will be connected later.</small>
    `
    document
      .querySelector('#registration-form')
      .addEventListener('submit', handleRegistrationSubmit)
    return
  }

  if (flowStep === 'complete') {
    content.innerHTML = `
      <span class="drop-badge success">REWARD STATUS · COMPLETED</span>
      <div class="profile-orbit complete-profile"><span>✓</span></div>
      <h2>This account has already claimed.</h2>
      <p><strong>${escapeHtml(accountState.email)}</strong> has already received its one reward for this campaign. No wallet connection or transaction is needed.</p>
      <div class="profile-chip completed-profile-chip">
        <span>SD</span>
        <div><small>ScanDrop account</small><strong>${escapeHtml(accountState.email)}</strong></div>
        <b>Reward used</b>
      </div>
      <div class="claim-complete-notice">
        <span>✓</span>
        <div>
          <strong>No further action is required</strong>
          <p>ScanDrop has stopped the claim flow to prevent a duplicate reward.</p>
        </div>
      </div>
      <a class="claim-button home-button" href="/">Return to ScanDrop home</a>
      <button class="switch-account" id="change-profile">Use a different ScanDrop account</button>
      <small class="claim-note">One ScanDrop account · one campaign reward</small>
    `
    document
      .querySelector('#change-profile')
      .addEventListener('click', changeScanDropProfile)
    return
  }

  if (flowStep === 'connect') {
    content.innerHTML = `
      <span class="drop-badge">STEP 2 OF 3 · CONNECT WALLET</span>
      <div class="coin-orbit avax-orbit"><span class="coin avax-coin">A</span><i></i><i></i><i></i></div>
      <h2>Claim native test AVAX.</h2>
      <p><strong>${escapeHtml(accountState.email)}</strong> is registered. ${
        accountState.walletAddress
          ? `Reconnect ${formatAddress(accountState.walletAddress)} to continue.`
          : 'Connect Core mobile and ScanDrop will switch you to Fuji.'
      }</p>
      ${walletState.error ? `<div class="wallet-error">${escapeHtml(walletState.error)}</div>` : ''}
      <div class="wallet-connect-options">
        <button class="claim-button walletconnect-button" id="connect-walletconnect" ${walletState.busy || !isWalletConnectConfigured ? 'disabled' : ''}>
          <span class="connect-icon">◎</span>
          <span><strong>${walletState.busy ? 'Waiting for wallet…' : 'Core mobile / WalletConnect'}</strong><small>Open Core on this phone or scan on desktop</small></span>
        </button>
        <button class="extension-button" id="connect-extension" ${walletState.busy || !hasInjectedWallet() ? 'disabled' : ''}>
          <span class="connect-icon">◇</span>
          <span><strong>Browser wallet extension</strong><small>${hasInjectedWallet() ? 'Core or MetaMask detected' : 'Available in a wallet-enabled desktop browser'}</small></span>
        </button>
      </div>
      ${!isWalletConnectConfigured ? `
        <div class="walletconnect-setup">
          <strong>WalletConnect code is ready</strong>
          <span>Add a Reown Project ID to activate the mobile connection.</span>
        </div>
      ` : ''}
      <div class="walletconnect-setup">
        <strong>No AVAX is required to claim</strong>
        <span>For gasless campaigns, ScanDrop submits and pays for the Fuji transaction.</span>
      </div>
      <button class="switch-account" id="change-profile">Use a different ScanDrop account</button>
      <small class="claim-note">Fuji tokens are for testing only and have no real-world value.</small>
    `
    document.querySelector('#connect-walletconnect').addEventListener('click', () => {
      handleWalletConnect('walletconnect')
    })
    document.querySelector('#connect-extension').addEventListener('click', () => {
      handleWalletConnect('injected')
    })
    document.querySelector('#change-profile').addEventListener('click', changeScanDropProfile)
    return
  }

  const availability = claimAvailability()
  const eligibilityLabel = walletState.campaign?.hasClaimed
    ? 'Already claimed'
    : isContractConfigured
      ? 'Eligible'
      : 'Setup pending'
  const rewardAmount = Number(walletState.campaign?.rewardAmount || campaign.reward)
  const isGasless = Boolean(walletState.campaign?.gasless)

  content.innerHTML = `
    <span class="drop-badge">STEP 3 OF 3 · CLAIM REWARD</span>
    <div class="coin-orbit compact-orbit"><span class="coin avax-coin">A</span><i></i><i></i><i></i></div>
    <h2>${rewardAmount.toFixed(3)} AVAX is waiting.</h2>
    <p>${
      isGasless
        ? 'ScanDrop will pay the Fuji network fee and send the claim transaction for you.'
        : 'Your connected wallet is on Fuji. The smart contract will enforce one successful claim per address.'
    }</p>
    <div class="wallet-card">
      <span class="wallet-avatar avax-avatar">A</span>
      <div><small>Fuji wallet · ${Number(walletState.balance).toFixed(4)} AVAX</small><strong>${formatAddress(walletState.address)}</strong></div>
      <span class="eligible ${availability.disabled ? 'used' : ''}">${eligibilityLabel}</span>
    </div>
    <div class="profile-chip"><span>SD</span><div><small>ScanDrop account</small><strong>${escapeHtml(accountState.email)}</strong></div><b>Registered</b></div>
    ${!isContractConfigured ? `
      <div class="contract-pending">
        <span>◌</span>
        <div><strong>Contract deployment pending</strong><p>The wallet connection is live. Add the Fuji contract address to enable claims.</p></div>
      </div>
    ` : ''}
    ${walletState.error ? `<div class="wallet-error">${escapeHtml(walletState.error)}</div>` : ''}
    <button class="claim-button" id="claim-reward" ${availability.disabled || walletState.busy ? 'disabled' : ''}>
      ${walletState.busy ? 'Waiting for Fuji confirmation…' : availability.label}
    </button>
    <button class="switch-account" id="disconnect-view">Connect a different wallet</button>
    <button class="switch-account" id="change-profile">Use a different ScanDrop account</button>
    <small class="claim-note">${
      isGasless ? 'Gas sponsored by ScanDrop · ' : ''
    }Network: Avalanche Fuji C-Chain · Chain ID 43113</small>
  `

  document.querySelector('#claim-reward').addEventListener('click', handleOnChainClaim)
  document.querySelector('#disconnect-view').addEventListener('click', async () => {
    if (walletState.connectionType === 'walletconnect') {
      await disconnectWalletConnect()
    }
    walletState.address = ''
    walletState.balance = ''
    walletState.signer = null
    walletState.campaign = null
    walletState.connectionType = ''
    walletState.error = ''
    renderClaimExperience()
  })
  document.querySelector('#change-profile').addEventListener('click', changeScanDropProfile)
}

async function handleWalletConnect(connectionType) {
  walletState.busy = true
  walletState.error = ''
  renderClaimExperience()

  if (connectionType === 'walletconnect' && claimDialog.open) {
    claimDialog.close()
  }

  try {
    const wallet =
      connectionType === 'walletconnect'
        ? await connectWalletConnect()
        : await connectWallet()
    await applyConnectedWallet(wallet, connectionType)
  } catch (error) {
    walletState.error = friendlyWalletError(error)
  } finally {
    walletState.busy = false
    if (!claimDialog.open) claimDialog.showModal()
    renderClaimExperience()
  }
}

async function applyConnectedWallet(wallet, connectionType, { linkProfile = true } = {}) {
  if (linkProfile && accountState.registrationId) {
    await linkRegistrationWallet(
      accountState.registrationId,
      wallet.address,
      wallet.signer,
    )
    accountState.walletAddress = wallet.address.toLowerCase()
    accountState.walletLinked = true
    accountState.claimStatus =
      accountState.claimStatus === 'claimed' ? 'claimed' : 'wallet_connected'
    saveProfile()
  }

  walletState.address = wallet.address
  walletState.balance = wallet.balance
  walletState.signer = wallet.signer
  walletState.campaign = await readCampaign(wallet.address)
  if (walletState.campaign?.rewardAmount) {
    campaign.reward = Number(walletState.campaign.rewardAmount)
  }
  walletState.connectionType = connectionType
}

async function handleOnChainClaim() {
  walletState.busy = true
  walletState.error = ''
  renderClaimExperience()

  try {
    let result
    let profileSynced = true

    if (walletState.campaign?.gasless) {
      const gaslessResult = await requestGaslessClaim(accountState.registrationId)
      result = {
        hash: gaslessResult.transactionHash,
        blockNumber: gaslessResult.blockNumber,
        gasless: true,
      }
      accountState.claimStatus = 'claimed'
      saveProfile()
    } else {
      result = await claimReward(walletState.signer)

      try {
        await recordRegistrationClaim(
          accountState.registrationId,
          walletState.address,
          result.hash,
        )
        accountState.claimStatus = 'claimed'
        saveProfile()
      } catch {
        profileSynced = false
      }
    }

    walletState.campaign = await readCampaign(walletState.address)
    renderClaimSuccess(result, profileSynced)
    await syncCampaignFromChain()
  } catch (error) {
    walletState.error = friendlyWalletError(error)
    walletState.busy = false
    renderClaimExperience()
  }
}

function renderClaimSuccess(result, profileSynced) {
  walletState.busy = false
  document.querySelector('#claim-content').innerHTML = `
    <span class="drop-badge success">FUJI TRANSACTION CONFIRMED</span>
    <div class="success-ring avax-success"><span>✓</span></div>
    <h2>Your AVAX arrived.</h2>
    <p>${
      result.gasless
        ? 'ScanDrop paid the network fee. Your wallet received AVAX without submitting a transaction.'
        : 'The native test AVAX reward was transferred by the ScanDrop smart contract.'
    }</p>
    <div class="receipt">
      <div><span>ScanDrop account</span><strong>${escapeHtml(accountState.email)}</strong></div>
      <div><span>Wallet</span><strong>${formatAddress(walletState.address)}</strong></div>
      <div><span>Status</span><strong class="confirmed">● Confirmed</strong></div>
      <div><span>Block</span><strong>${result.blockNumber}</strong></div>
      <div><span>Network</span><strong>Avalanche Fuji</strong></div>
    </div>
    ${profileSynced ? `
      <div class="profile-sync success">✓ Reward saved to your ScanDrop profile</div>
    ` : `
      <div class="profile-sync warning">The AVAX transfer succeeded, but ScanDrop could not save the receipt. Your explorer transaction remains the proof.</div>
    `}
    <a class="claim-button explorer-button" href="${transactionUrl(result.hash)}" target="_blank" rel="noreferrer">View transaction ↗</a>
    <button class="switch-account" id="finish-claim">${isClaimRoute ? 'Reward claimed' : 'Done'}</button>
    <small class="claim-note">${
      result.gasless ? 'Gas sponsored by ScanDrop · ' : ''
    }The RewardClaimed event is now part of the public campaign record.</small>
  `
  document.querySelector('#finish-claim').addEventListener('click', () => {
    if (!isClaimRoute) claimDialog.close()
  })
  showToast('Fuji reward confirmed on-chain.')
}

async function syncCampaignFromChain() {
  if (!isContractConfigured) return

  try {
    const snapshot = await readCampaign()
    campaign.reward = Number(snapshot.rewardAmount)
    campaign.claimers = snapshot.totalClaims
    campaign.spent = snapshot.totalClaims * campaign.reward
    campaign.budget = Number(snapshot.contractBalance) + campaign.spent
    campaign.remaining = snapshot.remainingClaims

    const sponsorHealth = document.querySelector('#gas-sponsor-health')
    const sponsorButton = document.querySelector('#fund-gas-sponsor')
    if (sponsorHealth && sponsorButton && snapshot.gasless) {
      const topUpAmount = calculateGasSponsorTopUpAvax(
        snapshot.remainingClaims,
        snapshot.relayerBalance,
      )
      const needsTopUp = Number(topUpAmount) > 0
      sponsorHealth.textContent = `${Number(snapshot.relayerBalance).toFixed(4)} AVAX${needsTopUp ? ' · LOW' : ' · READY'}`
      sponsorHealth.classList.toggle('low', needsTopUp)
      sponsorButton.hidden = !needsTopUp
      sponsorButton.dataset.amount = topUpAmount
      sponsorButton.textContent = `Refill ${topUpAmount} AVAX gas`
    }

    if (!document.querySelector('#claimer-count')) return

    document.querySelector('#claimer-count').textContent = campaign.claimers.toLocaleString()
    document.querySelector('#reward-value').textContent = `${campaign.reward.toFixed(3)} AVAX`
    document.querySelector('#budget-used').textContent = `${campaign.spent.toFixed(3)} AVAX`
    document.querySelector('#budget-total').textContent = `${campaign.budget.toFixed(3)} AVAX`
    document.querySelector('#budget-spent-label').textContent = `${campaign.spent.toFixed(3)} AVAX`
    document.querySelector('#budget-label').textContent = `${campaign.budget.toFixed(3)} AVAX`
    document.querySelector('#budget-progress').style.width =
      `${campaign.budget ? Math.min(100, (campaign.spent / campaign.budget) * 100) : 0}%`
    document.querySelector('#successful-claims').textContent =
      `${campaign.claimers.toLocaleString()} successful claims`
    document.querySelector('#remaining-claims').textContent =
      `${campaign.remaining.toLocaleString()} rewards remaining`
  } catch {
    const statusLabel = document.querySelector('#contract-status-label')
    if (statusLabel) statusLabel.textContent = '● Fuji RPC unavailable'
  }
}

function openClaim() {
  walletState.error = ''
  renderClaimExperience()
  claimDialog.showModal()
  preloadWalletConnect().catch(() => {})
}

document.querySelectorAll('#open-claim, #preview-claim').forEach((button) => {
  button.addEventListener('click', openClaim)
})

document.querySelector('#fund-gas-sponsor')?.addEventListener('click', async (event) => {
  const button = event.currentTarget
  const amount = button.dataset.amount
  if (!walletState.signer || !amount) {
    showToast('Connect the organiser wallet before refilling the gas sponsor.')
    return
  }

  button.disabled = true
  button.textContent = 'Waiting for Core confirmation…'
  try {
    await fundGasSponsor(walletState.signer, amount)
    await syncCampaignFromChain()
    showToast('Gas sponsor refilled on Fuji.')
  } catch (error) {
    button.textContent = `Retry ${amount} AVAX gas refill`
    showToast(friendlyWalletError(error))
  } finally {
    button.disabled = false
  }
})

function setDeploymentStatus(type, message) {
  const status = document.querySelector('#deployment-status')
  status.hidden = false
  status.className = `deployment-status ${type}`
  status.innerHTML = message
}

function clearDeploymentStatus() {
  const status = document.querySelector('#deployment-status')
  status.hidden = true
  status.className = 'deployment-status'
  status.textContent = ''
}

function updateDeploymentButton() {
  const button = document.querySelector('#deploy-campaign')
  if (button.disabled) return
  button.textContent = walletState.signer
    ? `Deploy with ${formatAddress(walletState.address)}`
    : 'Connect Core & deploy on Fuji'
}

function updateContractBanner() {
  const banner = document.querySelector('#contract-banner')
  banner.classList.toggle('connected', isContractConfigured)
  document.querySelector('#contract-title').textContent = isContractConfigured
    ? 'Fuji contract connected'
    : campaignLoadError
      ? 'Active campaign unavailable'
      : 'Fuji integration compiled and ready'
  document.querySelector('#contract-address').textContent = isContractConfigured
    ? formatAddress(REWARD_CAMPAIGN_ADDRESS)
    : campaignLoadError || 'Deploy the contract to activate live claims'
  document.querySelector('#contract-badge').textContent = isContractConfigured
    ? '● ON-CHAIN'
    : '○ DEPLOYMENT PENDING'
  document.querySelector('#contract-status-label').textContent = isContractConfigured
    ? '● Live on Fuji'
    : campaignLoadError
      ? '● QR disabled'
      : '● Contract ready'
}

function applyCampaignDraft(data) {
  campaign.name = data.get('name')
  campaign.reward = Number(data.get('reward'))
  campaign.budget = Number(data.get('budget'))
  campaign.spent = 0
  campaign.claimers = 0
  campaign.remaining = Math.floor(campaign.budget / campaign.reward)

  document.querySelector('#campaign-title').textContent = campaign.name
  document.querySelector('#reward-value').textContent = `${campaign.reward.toFixed(3)} AVAX`
  document.querySelector('#budget-total').textContent = `${campaign.budget.toFixed(2)} AVAX`
  document.querySelector('#budget-label').textContent = `${campaign.budget.toFixed(2)} AVAX`
  document.querySelector('#budget-spent-label').textContent = '0.00 AVAX'
  document.querySelector('#budget-progress').style.width = '0%'
  document.querySelector('#claimer-count').textContent = '0'
  document.querySelector('#budget-used').textContent = '0.00 AVAX'
  document.querySelector('#successful-claims').textContent = '0 successful claims'
  document.querySelector('#remaining-claims').textContent =
    `${campaign.remaining.toLocaleString()} rewards available`
}

document.querySelector('#create-campaign').addEventListener('click', () => {
  clearDeploymentStatus()
  updateDeploymentButton()
  campaignDialog.showModal()
  preloadWalletConnect().catch(() => {})
})

document.querySelectorAll('[data-close]').forEach((button) => {
  button.addEventListener('click', () => button.closest('dialog').close())
})

document.querySelectorAll('dialog').forEach((dialog) => {
  dialog.addEventListener('click', (event) => {
    if (
      event.target === dialog &&
      dialog !== adminAuthDialog &&
      !(isClaimRoute && dialog === claimDialog)
    ) {
      dialog.close()
    }
  })
})

adminAuthDialog.addEventListener('cancel', (event) => event.preventDefault())
claimDialog.addEventListener('cancel', (event) => {
  if (isClaimRoute) event.preventDefault()
})

document.querySelectorAll('.nav-item[data-section]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.nav-item[data-section]').forEach((item) => {
      item.classList.remove('active')
    })
    button.classList.add('active')
    document.querySelector('#section-name').textContent = button.dataset.section
    showToast(`${button.dataset.section} is represented in this Hackathon MVP.`)
  })
})

const campaignForm = document.querySelector('#campaign-form')

function updateGasReservePreview() {
  const data = new FormData(campaignForm)
  const reserve = calculateGasSponsorReserveAvax(
    data.get('budget'),
    data.get('reward'),
  )
  document.querySelector('#gas-reserve-preview').textContent = reserve
  document.querySelector('#gas-reserve-note').textContent = reserve
  return reserve
}

campaignForm
  .querySelectorAll('input[name="reward"], input[name="budget"]')
  .forEach((input) => input.addEventListener('input', updateGasReservePreview))
updateGasReservePreview()

campaignForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  const data = new FormData(event.currentTarget)
  const deployButton = document.querySelector('#deploy-campaign')
  applyCampaignDraft(data)
  deployButton.disabled = true
  let deployedResult = null

  try {
    if (!walletState.signer) {
      setDeploymentStatus(
        'pending',
        '<strong>Step 1 of 2 · Connect organiser wallet</strong><span>Choose Core, then approve the Fuji connection.</span>',
      )
      campaignDialog.close()

      const connectionType = hasInjectedWallet() ? 'injected' : 'walletconnect'
      const wallet =
        connectionType === 'injected'
          ? await connectWallet()
          : await connectWalletConnect()
      await applyConnectedWallet(wallet, connectionType, { linkProfile: false })
      campaignDialog.showModal()
    }

    setDeploymentStatus(
      'pending',
      '<strong>Step 2 of 2 · Confirm deployment in Core</strong><span>Core will show the contract funding and network fee before you approve.</span>',
    )
    deployButton.textContent = 'Waiting for Core confirmation…'
    const relayerGasFundingAvax = calculateGasSponsorReserveAvax(
      data.get('budget'),
      data.get('reward'),
    )

    const result = await deployRewardCampaign(walletState.signer, {
      rewardAmountAvax: data.get('reward'),
      fundingAmountAvax: data.get('budget'),
      durationDays: data.get('duration'),
      relayerGasFundingAvax,
    })
    deployedResult = result

    setRewardCampaignAddress(result.address)
    setDeploymentStatus(
      'pending',
      '<strong>Contract confirmed · Authorize activation</strong><span>Approve one free organiser signature in Core so ScanDrop can activate the campaign.</span>',
    )
    await activateGaslessCampaign({
      campaignId: campaign.id,
      contractAddress: result.address,
      deploymentTransactionHash: result.hash,
      signer: walletState.signer,
    })
    walletState.balance = result.ownerBalance
    walletState.campaign = await readCampaign(walletState.address)
    campaignLoadError = ''
    campaign.status = 'Live on Fuji'
    updateContractBanner()
    await syncCampaignFromChain()
    await renderQr()
    renderClaimExperience()

    setDeploymentStatus(
      'success',
      `<strong>Gasless campaign deployed on Fuji</strong>
       <span>${formatAddress(result.address)} · Block ${result.blockNumber}</span>
       <a href="${contractUrl(result.address)}" target="_blank" rel="noreferrer">View contract on Fuji Explorer ↗</a>`,
    )
    deployButton.textContent = 'Campaign is live on Fuji'
    showToast('RewardCampaign deployed and added to the QR code.')
  } catch (error) {
    if (!campaignDialog.open) campaignDialog.showModal()
    const submittedTransaction = error?.transactionHash
    setDeploymentStatus(
      'error',
      deployedResult
        ? `<strong>The contract deployed, but gasless activation needs attention</strong>
           <span>${formatAddress(deployedResult.address)} · ${escapeHtml(friendlyWalletError(error))}</span>
           <a href="${contractUrl(deployedResult.address)}" target="_blank" rel="noreferrer">View deployed contract ↗</a>`
        : submittedTransaction
          ? `<strong>The transaction was submitted and is still confirming</strong>
             <span>${escapeHtml(friendlyWalletError(error))}</span>
             <a href="${transactionUrl(submittedTransaction)}" target="_blank" rel="noreferrer">Check transaction before retrying ↗</a>`
        : `<strong>Deployment was not completed</strong><span>${escapeHtml(friendlyWalletError(error))}</span>`,
    )
    deployButton.disabled = false
    updateDeploymentButton()
  }
})

if (window.ethereum?.on) {
  window.ethereum.on('accountsChanged', () => {
    walletState.address = ''
    walletState.balance = ''
    walletState.signer = null
    walletState.campaign = null
    walletState.connectionType = ''
    if (claimDialog.open) renderClaimExperience()
  })
  window.ethereum.on('chainChanged', () => {
    walletState.address = ''
    walletState.balance = ''
    walletState.signer = null
    walletState.campaign = null
    walletState.connectionType = ''
    walletState.error = ''
    if (claimDialog.open) renderClaimExperience()
  })
}

if (isClaimRoute) {
  document.body.classList.add('claim-only-mode')
  document.querySelector('.app-shell')?.remove()
  document.querySelector('#campaign-dialog')?.remove()
  initializeClaimExperience()
} else {
  initializeAdminExperience()
}

async function initializeClaimExperience() {
  try {
    const activeCampaign = await getActiveCampaign(campaign.id)
    if (!activeCampaign?.contractAddress) {
      throw new Error('This ScanDrop campaign is not active.')
    }
    setRewardCampaignAddress(activeCampaign.contractAddress)
    campaignLoadError = ''
  } catch {
    clearRewardCampaignAddress()
    campaignLoadError =
      'This reward campaign is temporarily unavailable. Please ask the organiser for a refreshed QR code.'
  }

  window.setTimeout(openClaim, 150)
}

async function initializeAdminExperience() {
  document.body.classList.add('admin-locked')

  try {
    const activeCampaign = await getActiveCampaign(campaign.id)
    if (activeCampaign?.contractAddress) {
      setRewardCampaignAddress(activeCampaign.contractAddress)
      campaign.status = 'Live on Fuji'
      updateContractBanner()
    }
  } catch {
    clearRewardCampaignAddress()
    campaign.status = 'Campaign unavailable'
    campaignLoadError =
      'The active gasless campaign could not be loaded. QR sharing is disabled until it is restored.'
    updateContractBanner()
  }

  await renderQr()
  await syncCampaignFromChain()
  renderAdminGate()
  window.setTimeout(() => adminAuthDialog.showModal(), 100)
}
