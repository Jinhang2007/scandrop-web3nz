import './style.css'
import QRCode from 'qrcode'

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
  name: 'Web3NZ Welcome Drop',
  sponsor: 'Web3NZ Hackathon',
  reward: 0.2,
  currency: 'USDC',
  budget: 500,
  spent: 140,
  claimers: 700,
  status: 'Live',
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

      <div class="side-card">
        <span class="eyebrow">Protocol-ready</span>
        <strong>Built to plug in.</strong>
        <p>Swap the demo ledger for Avalanche or NewMoney when you are ready.</p>
        <div class="protocol-row"><span>AVAX</span><span>USDC</span><span>API</span></div>
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
          <span class="network-status"><i></i> Demo network</span>
          <button class="ghost-button" id="preview-claim">Preview claim</button>
          <button class="primary-button" id="create-campaign"><span>＋</span> New campaign</button>
        </div>
      </header>

      <section class="content-wrap">
        <div class="hero-copy">
          <div>
            <span class="date-label">SATURDAY, 25 JULY</span>
            <h1>Turn every scan into<br><em>a returning customer.</em></h1>
          </div>
          <p>Launch instant reward drops, learn what your audience wants, and bring the right people back.</p>
        </div>

        <div class="metric-grid">
          <article class="metric-card">
            <div class="metric-top"><span>Unique claimers</span><span class="metric-icon lime">${icons.audience}</span></div>
            <strong id="claimer-count">700</strong>
            <small><b>↑ 18.4%</b> vs last period</small>
          </article>
          <article class="metric-card">
            <div class="metric-top"><span>7-day return</span><span class="metric-icon violet">${icons.automation}</span></div>
            <strong>17.1%</strong>
            <small><b>↑ 4.8%</b> 120 people returned</small>
          </article>
          <article class="metric-card">
            <div class="metric-top"><span>Cost per retained user</span><span class="metric-icon cyan">${icons.rewards}</span></div>
            <strong>$2.50</strong>
            <small><b>↓ 12.6%</b> more efficient</small>
          </article>
          <article class="metric-card">
            <div class="metric-top"><span>Reward budget</span><span class="metric-icon orange">${icons.campaigns}</span></div>
            <strong id="budget-used">$140</strong>
            <small>of <span id="budget-total">$500</span> committed</small>
          </article>
        </div>

        <div class="dashboard-grid">
          <article class="panel campaign-panel">
            <div class="panel-heading">
              <div>
                <span class="eyebrow">LIVE CAMPAIGN</span>
                <h2 id="campaign-title">${campaign.name}</h2>
              </div>
              <button class="icon-button" aria-label="Campaign options">•••</button>
            </div>
            <div class="campaign-body">
              <div class="qr-wrap">
                <canvas id="campaign-qr" aria-label="Scannable campaign QR code"></canvas>
                <span class="scan-corners"></span>
              </div>
              <div class="campaign-info">
                <div class="reward-pill"><span>Instant reward</span><strong id="reward-value">$${campaign.reward.toFixed(2)} ${campaign.currency}</strong></div>
                <dl>
                  <div><dt>Claim rule</dt><dd>Once per account</dd></div>
                  <div><dt>Ends</dt><dd>23 Aug 2026</dd></div>
                  <div><dt>Status</dt><dd><span class="status-pill">● Live</span></dd></div>
                </dl>
                <button class="dark-button" id="open-claim">Open claim experience <span>↗</span></button>
              </div>
            </div>
            <div class="budget-row">
              <div><span>Campaign budget</span><strong><span id="budget-spent-label">$140.00</span> / <span id="budget-label">$500.00</span></strong></div>
              <div class="progress-track"><span id="budget-progress" style="width:28%"></span></div>
              <div class="budget-meta"><span>700 successful claims</span><span>1,800 rewards remaining</span></div>
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
                <div><span>Reward claimed</span><strong>700</strong></div>
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
            <div class="funnel-insight"><span>↗</span><p><strong>Your strongest audience is Web3 learners.</strong><br>They return 2.4× more often than average.</p></div>
          </article>
        </div>

        <div class="lower-grid">
          <article class="panel journey-panel">
            <div class="panel-heading">
              <div><span class="eyebrow">AUTOMATED JOURNEY</span><h2>Reward the right moments</h2></div>
              <button class="text-button">Edit journey →</button>
            </div>
            <div class="journey">
              <div class="journey-step active"><span class="step-icon">⌁</span><div><small>DAY 0</small><strong>Instant welcome drop</strong><p>$0.20 after a unique scan</p></div><b>700</b></div>
              <div class="journey-line"></div>
              <div class="journey-step"><span class="step-icon">✉</span><div><small>DAY 3</small><strong>Product introduction</strong><p>Show what is waiting for them</p></div><b>482</b></div>
              <div class="journey-line"></div>
              <div class="journey-step"><span class="step-icon">↻</span><div><small>DAY 7</small><strong>Interest-based return</strong><p>$1.00 for a meaningful visit</p></div><b>120</b></div>
              <div class="journey-line"></div>
              <div class="journey-step"><span class="step-icon">✦</span><div><small>DAY 30</small><strong>High-intent reward</strong><p>$2.00 for qualified users</p></div><b>50</b></div>
            </div>
          </article>

          <article class="panel audience-panel">
            <div class="panel-heading">
              <div><span class="eyebrow">AUDIENCE SIGNALS</span><h2>Who is staying?</h2></div>
              <button class="text-button">View all →</button>
            </div>
            <div class="audience-list">
              <div><span class="audience-dot web3">W3</span><p><strong>Web3 learners</strong><small>342 people</small></p><b>26.4% return</b></div>
              <div><span class="audience-dot games">GG</span><p><strong>Games & community</strong><small>196 people</small></p><b>18.1% return</b></div>
              <div><span class="audience-dot local">NZ</span><p><strong>Local events</strong><small>105 people</small></p><b>11.3% return</b></div>
              <div><span class="audience-dot other">＋</span><p><strong>Other interests</strong><small>57 people</small></p><b>7.8% return</b></div>
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
      <div id="claim-content">
        <span class="drop-badge">WEB3NZ WELCOME DROP</span>
        <div class="coin-orbit"><span class="coin">$</span><i></i><i></i><i></i></div>
        <h2>You found an instant reward.</h2>
        <p>Connect a demo account to claim <strong>$${campaign.reward.toFixed(2)} ${campaign.currency}</strong>. One claim per account.</p>
        <div class="wallet-card"><span class="wallet-avatar">0x</span><div><small>Demo account</small><strong id="wallet-address">0xA91F...72C4</strong></div><span class="eligible" id="eligibility">Eligible</span></div>
        <button class="claim-button" id="claim-reward">Claim $${campaign.reward.toFixed(2)} ${campaign.currency}</button>
        <button class="switch-account" id="switch-account">Try another demo account</button>
        <small class="claim-note">Demo rewards use a local ledger. No real funds move.</small>
      </div>
    </div>
  </dialog>

  <dialog id="campaign-dialog" class="campaign-dialog">
    <button class="dialog-close" data-close aria-label="Close">×</button>
    <span class="eyebrow">NEW CAMPAIGN</span>
    <h2>Launch an instant reward drop</h2>
    <p>Create the campaign now. A protocol adapter can replace the demo ledger later.</p>
    <form id="campaign-form">
      <label>Campaign name<input name="name" value="Community Welcome Drop" required></label>
      <div class="form-row">
        <label>Reward per person<div class="input-unit"><span>$</span><input name="reward" type="number" min="0.01" step="0.01" value="0.20" required><b>USDC</b></div></label>
        <label>Total budget<div class="input-unit"><span>$</span><input name="budget" type="number" min="1" step="1" value="500" required><b>USDC</b></div></label>
      </div>
      <div class="rule-preview"><span>✓</span><div><strong>One account, one reward</strong><p>A unique account can only claim once in this campaign.</p></div></div>
      <button class="primary-button full" type="submit">Create campaign & generate QR</button>
    </form>
  </dialog>

  <div class="toast" id="toast" role="status"></div>
`

const claimDialog = document.querySelector('#claim-dialog')
const campaignDialog = document.querySelector('#campaign-dialog')
const toast = document.querySelector('#toast')
const accounts = ['0xA91F...72C4', '0x7B20...0A18', '0xCE44...93F1']
let accountIndex = 0

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
  window.setTimeout(() => toast.classList.remove('show'), 2600)
}

function claimKey() {
  return `scandrop:${campaign.id}:${accounts[accountIndex]}`
}

function refreshEligibility() {
  const claimed = localStorage.getItem(claimKey()) === 'claimed'
  document.querySelector('#wallet-address').textContent = accounts[accountIndex]
  const eligibility = document.querySelector('#eligibility')
  const button = document.querySelector('#claim-reward')
  eligibility.textContent = claimed ? 'Already claimed' : 'Eligible'
  eligibility.classList.toggle('used', claimed)
  button.textContent = claimed ? 'Reward already claimed' : `Claim $${campaign.reward.toFixed(2)} ${campaign.currency}`
  button.disabled = claimed
}

function renderClaimExperience() {
  document.querySelector('#claim-content').innerHTML = `
    <span class="drop-badge">WEB3NZ WELCOME DROP</span>
    <div class="coin-orbit"><span class="coin">$</span><i></i><i></i><i></i></div>
    <h2>You found an instant reward.</h2>
    <p>Connect a demo account to claim <strong>$${campaign.reward.toFixed(2)} ${campaign.currency}</strong>. One claim per account.</p>
    <div class="wallet-card"><span class="wallet-avatar">0x</span><div><small>Demo account</small><strong id="wallet-address">${accounts[accountIndex]}</strong></div><span class="eligible" id="eligibility">Eligible</span></div>
    <button class="claim-button" id="claim-reward">Claim $${campaign.reward.toFixed(2)} ${campaign.currency}</button>
    <button class="switch-account" id="switch-account">Try another demo account</button>
    <small class="claim-note">Demo rewards use a local ledger. No real funds move.</small>
  `
  document.querySelector('#switch-account').addEventListener('click', () => {
    accountIndex = (accountIndex + 1) % accounts.length
    refreshEligibility()
  })
  document.querySelector('#claim-reward').addEventListener('click', handleClaim)
  refreshEligibility()
}

function handleClaim() {
  localStorage.setItem(claimKey(), 'claimed')
  const claimContent = document.querySelector('#claim-content')
  claimContent.innerHTML = `
    <span class="drop-badge success">REWARD CLAIMED</span>
    <div class="success-ring"><span>✓</span></div>
    <h2>It is yours.</h2>
    <p>Your <strong>$${campaign.reward.toFixed(2)} ${campaign.currency}</strong> demo reward has been added to this account.</p>
    <div class="receipt">
      <div><span>Account</span><strong>${accounts[accountIndex]}</strong></div>
      <div><span>Status</span><strong class="confirmed">● Confirmed</strong></div>
      <div><span>Network</span><strong>Demo ledger</strong></div>
    </div>
    <button class="claim-button" id="finish-claim">Explore more drops</button>
    <small class="claim-note">A day-7 return journey is now scheduled for this demo.</small>
  `
  document.querySelector('#finish-claim').addEventListener('click', () => claimDialog.close())
  campaign.claimers += 1
  campaign.spent += campaign.reward
  document.querySelector('#claimer-count').textContent = campaign.claimers.toLocaleString()
  document.querySelector('#budget-used').textContent = `$${campaign.spent.toFixed(1)}`
  showToast('Reward claimed. Day-7 journey scheduled.')
}

function openClaim() {
  renderClaimExperience()
  claimDialog.showModal()
}

document.querySelectorAll('#open-claim, #preview-claim').forEach((button) => {
  button.addEventListener('click', openClaim)
})

document.querySelector('#create-campaign').addEventListener('click', () => campaignDialog.showModal())

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
    document.querySelectorAll('.nav-item[data-section]').forEach((item) => item.classList.remove('active'))
    button.classList.add('active')
    document.querySelector('#section-name').textContent = button.dataset.section
    showToast(`${button.dataset.section} view is included in the next build.`)
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
  campaign.id = campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  document.querySelector('#campaign-title').textContent = campaign.name
  document.querySelector('#reward-value').textContent = `$${campaign.reward.toFixed(2)} ${campaign.currency}`
  document.querySelector('#budget-total').textContent = `$${campaign.budget.toFixed(0)}`
  document.querySelector('#budget-label').textContent = `$${campaign.budget.toFixed(2)}`
  document.querySelector('#budget-spent-label').textContent = '$0.00'
  document.querySelector('#budget-progress').style.width = '0%'
  document.querySelector('#claimer-count').textContent = '0'
  document.querySelector('#budget-used').textContent = '$0'
  await renderQr()
  campaignDialog.close()
  showToast('Campaign created. Your QR is ready to scan.')
})

renderQr()

if (new URLSearchParams(window.location.search).has('campaign')) {
  window.setTimeout(openClaim, 350)
}
