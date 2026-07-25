import './style.css'
import QRCode from 'qrcode'
import {
  FUJI_NETWORK,
  REWARD_CAMPAIGN_ADDRESS,
  claimReward,
  connectWallet,
  formatAddress,
  hasInjectedWallet,
  isContractConfigured,
  readCampaign,
  transactionUrl,
} from './web3.js'
import {
  connectWalletConnect,
  disconnectWalletConnect,
  isWalletConnectConfigured,
} from './walletconnect.js'

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
  reward: 0.01,
  currency: 'AVAX',
  budget: 5,
  spent: 1.4,
  claimers: 140,
  remaining: 360,
  status: isContractConfigured ? 'Live on Fuji' : 'Contract ready',
}

const walletState = {
  address: '',
  balance: '',
  signer: null,
  campaign: null,
  connectionType: '',
  busy: false,
  error: '',
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

        <div class="chain-banner ${isContractConfigured ? 'connected' : ''}">
          <div class="chain-orb">A</div>
          <div>
            <span class="eyebrow">SMART CONTRACT</span>
            <strong>${isContractConfigured ? 'Fuji contract connected' : 'Fuji integration compiled and ready'}</strong>
            <small id="contract-address">${isContractConfigured ? formatAddress(REWARD_CAMPAIGN_ADDRESS) : 'Deploy the contract to activate live claims'}</small>
          </div>
          <span class="chain-badge">${isContractConfigured ? '● ON-CHAIN' : '○ DEPLOYMENT PENDING'}</span>
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
                <span class="scan-corners"></span>
              </div>
              <div class="campaign-info">
                <div class="reward-pill"><span>Instant reward</span><strong id="reward-value">${campaign.reward.toFixed(3)} ${campaign.currency}</strong></div>
                <dl>
                  <div><dt>Claim rule</dt><dd>Once per wallet</dd></div>
                  <div><dt>Network</dt><dd>Fuji C-Chain</dd></div>
                  <div><dt>Status</dt><dd><span class="status-pill" id="contract-status-label">● ${campaign.status}</span></dd></div>
                </dl>
                <button class="dark-button" id="open-claim">Open wallet experience <span>↗</span></button>
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
              <div class="journey-step active"><span class="step-icon">⌁</span><div><small>DAY 0</small><strong>Instant AVAX drop</strong><p>0.01 AVAX after a unique scan</p></div><b>700</b></div>
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
    <h2>Draft an AVAX reward drop</h2>
    <p>Set the economics here, then deploy a RewardCampaign contract to activate on-chain claims.</p>
    <form id="campaign-form">
      <label>Campaign name<input name="name" value="Community AVAX Welcome Drop" required></label>
      <div class="form-row">
        <label>Reward per wallet<div class="input-unit"><span>◆</span><input name="reward" type="number" min="0.001" step="0.001" value="0.01" required><b>AVAX</b></div></label>
        <label>Contract funding<div class="input-unit"><span>◆</span><input name="budget" type="number" min="0.1" step="0.1" value="5" required><b>AVAX</b></div></label>
      </div>
      <div class="rule-preview"><span>✓</span><div><strong>One wallet, one reward</strong><p>The RewardCampaign contract rejects every duplicate claim.</p></div></div>
      <button class="primary-button full" type="submit">Save campaign draft & generate QR</button>
    </form>
  </dialog>

  <div class="toast" id="toast" role="status"></div>
`

const claimDialog = document.querySelector('#claim-dialog')
const campaignDialog = document.querySelector('#campaign-dialog')
const toast = document.querySelector('#toast')

function campaignUrl() {
  const url = new URL(window.location.href)
  url.search = ''
  url.searchParams.set('campaign', campaign.id)
  return url.toString()
}

async function renderQr() {
  await QRCode.toCanvas(document.querySelector('#campaign-qr'), campaignUrl(), {
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

function friendlyWalletError(error) {
  if (error?.code === 4001 || error?.code === 'ACTION_REJECTED') {
    return 'The wallet request was cancelled.'
  }

  const message = error?.shortMessage || error?.reason || error?.message || 'Wallet request failed.'
  if (message.includes('AlreadyClaimed')) return 'This wallet has already claimed this reward.'
  if (message.includes('InsufficientCampaignBalance')) return 'The campaign has run out of AVAX.'
  if (message.includes('CampaignPaused')) return 'This campaign is currently paused.'
  if (message.includes('CampaignEnded')) return 'This campaign has ended.'
  return message.replace('execution reverted: ', '')
}

function claimAvailability() {
  const snapshot = walletState.campaign
  if (!isContractConfigured) return { label: 'Contract deployment required', disabled: true }
  if (!snapshot) return { label: 'Checking eligibility…', disabled: true }
  if (snapshot.paused) return { label: 'Campaign paused', disabled: true }
  if (snapshot.endTime < new Date()) return { label: 'Campaign ended', disabled: true }
  if (snapshot.hasClaimed) return { label: 'Reward already claimed', disabled: true }
  if (snapshot.remainingClaims < 1) return { label: 'Campaign fully claimed', disabled: true }
  return { label: `Claim ${Number(snapshot.rewardAmount).toFixed(3)} AVAX`, disabled: false }
}

function renderClaimExperience() {
  const content = document.querySelector('#claim-content')

  if (!walletState.address) {
    content.innerHTML = `
      <span class="drop-badge">AVALANCHE FUJI DROP</span>
      <div class="coin-orbit avax-orbit"><span class="coin avax-coin">A</span><i></i><i></i><i></i></div>
      <h2>Claim native test AVAX.</h2>
      <p>Connect Core mobile through WalletConnect, or use a browser wallet extension. ScanDrop will switch you to Fuji.</p>
      ${walletState.error ? `<div class="wallet-error">${walletState.error}</div>` : ''}
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
      <a class="switch-account faucet-link" href="${FUJI_NETWORK.faucetUrl}" target="_blank" rel="noreferrer">Get test AVAX for gas ↗</a>
      <small class="claim-note">Fuji tokens are for testing only and have no real-world value.</small>
    `
    document.querySelector('#connect-walletconnect').addEventListener('click', () => {
      handleWalletConnect('walletconnect')
    })
    document.querySelector('#connect-extension').addEventListener('click', () => {
      handleWalletConnect('injected')
    })
    return
  }

  const availability = claimAvailability()
  const eligibilityLabel = walletState.campaign?.hasClaimed
    ? 'Already claimed'
    : isContractConfigured
      ? 'Eligible'
      : 'Setup pending'

  content.innerHTML = `
    <span class="drop-badge">AVALANCHE FUJI DROP</span>
    <div class="coin-orbit compact-orbit"><span class="coin avax-coin">A</span><i></i><i></i><i></i></div>
    <h2>${campaign.reward.toFixed(3)} AVAX is waiting.</h2>
    <p>Your connected wallet is on Fuji. The smart contract will enforce one successful claim per address.</p>
    <div class="wallet-card">
      <span class="wallet-avatar avax-avatar">A</span>
      <div><small>Fuji wallet · ${Number(walletState.balance).toFixed(4)} AVAX</small><strong>${formatAddress(walletState.address)}</strong></div>
      <span class="eligible ${availability.disabled ? 'used' : ''}">${eligibilityLabel}</span>
    </div>
    ${!isContractConfigured ? `
      <div class="contract-pending">
        <span>◌</span>
        <div><strong>Contract deployment pending</strong><p>The wallet connection is live. Add the Fuji contract address to enable claims.</p></div>
      </div>
    ` : ''}
    ${walletState.error ? `<div class="wallet-error">${walletState.error}</div>` : ''}
    <button class="claim-button" id="claim-reward" ${availability.disabled || walletState.busy ? 'disabled' : ''}>
      ${walletState.busy ? 'Waiting for Fuji confirmation…' : availability.label}
    </button>
    <button class="switch-account" id="disconnect-view">Connect a different wallet</button>
    <small class="claim-note">Network: Avalanche Fuji C-Chain · Chain ID 43113</small>
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
}

async function handleWalletConnect(connectionType) {
  walletState.busy = true
  walletState.error = ''
  renderClaimExperience()

  try {
    const wallet =
      connectionType === 'walletconnect'
        ? await connectWalletConnect()
        : await connectWallet()
    walletState.address = wallet.address
    walletState.balance = wallet.balance
    walletState.signer = wallet.signer
    walletState.campaign = await readCampaign(wallet.address)
    walletState.connectionType = connectionType
  } catch (error) {
    walletState.error = friendlyWalletError(error)
  } finally {
    walletState.busy = false
    renderClaimExperience()
  }
}

async function handleOnChainClaim() {
  walletState.busy = true
  walletState.error = ''
  renderClaimExperience()

  try {
    const result = await claimReward(walletState.signer)
    walletState.campaign = await readCampaign(walletState.address)
    renderClaimSuccess(result)
    await syncCampaignFromChain()
  } catch (error) {
    walletState.error = friendlyWalletError(error)
    walletState.busy = false
    renderClaimExperience()
  }
}

function renderClaimSuccess(result) {
  walletState.busy = false
  document.querySelector('#claim-content').innerHTML = `
    <span class="drop-badge success">FUJI TRANSACTION CONFIRMED</span>
    <div class="success-ring avax-success"><span>✓</span></div>
    <h2>Your AVAX arrived.</h2>
    <p>The native test AVAX reward was transferred by the ScanDrop smart contract.</p>
    <div class="receipt">
      <div><span>Wallet</span><strong>${formatAddress(walletState.address)}</strong></div>
      <div><span>Status</span><strong class="confirmed">● Confirmed</strong></div>
      <div><span>Block</span><strong>${result.blockNumber}</strong></div>
      <div><span>Network</span><strong>Avalanche Fuji</strong></div>
    </div>
    <a class="claim-button explorer-button" href="${transactionUrl(result.hash)}" target="_blank" rel="noreferrer">View transaction ↗</a>
    <button class="switch-account" id="finish-claim">Done</button>
    <small class="claim-note">The RewardClaimed event is now part of the public campaign record.</small>
  `
  document.querySelector('#finish-claim').addEventListener('click', () => claimDialog.close())
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
    document.querySelector('#contract-status-label').textContent = '● Fuji RPC unavailable'
  }
}

function openClaim() {
  walletState.error = ''
  renderClaimExperience()
  claimDialog.showModal()
}

document.querySelectorAll('#open-claim, #preview-claim').forEach((button) => {
  button.addEventListener('click', openClaim)
})

document.querySelector('#create-campaign').addEventListener('click', () => {
  campaignDialog.showModal()
})

document.querySelectorAll('[data-close]').forEach((button) => {
  button.addEventListener('click', () => button.closest('dialog').close())
})

document.querySelectorAll('dialog').forEach((dialog) => {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close()
  })
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

document.querySelector('#campaign-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const data = new FormData(event.currentTarget)
  campaign.name = data.get('name')
  campaign.reward = Number(data.get('reward'))
  campaign.budget = Number(data.get('budget'))
  campaign.spent = 0
  campaign.claimers = 0
  campaign.remaining = Math.floor(campaign.budget / campaign.reward)
  campaign.id = campaign.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

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
    `${campaign.remaining.toLocaleString()} rewards available in this draft`

  await renderQr()
  campaignDialog.close()
  showToast('Campaign draft saved. Deploy RewardCampaign to activate it on Fuji.')
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

renderQr()
syncCampaignFromChain()

if (new URLSearchParams(window.location.search).has('campaign')) {
  window.setTimeout(openClaim, 350)
}
