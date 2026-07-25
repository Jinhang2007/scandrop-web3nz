import { connectEip1193Wallet } from './web3.js'

const defaultProjectId = '4bb6f3a43c511fbcedad4b5feff468d0'
const projectId =
  import.meta.env.VITE_REOWN_PROJECT_ID?.trim() || defaultProjectId

export const isWalletConnectConfigured = projectId.length > 0

let appKit
let fujiNetwork
let appKitPromise
const sessionResetTimeoutMs = 4_000

async function getAppKit() {
  if (appKit) return appKit
  if (appKitPromise) return appKitPromise

  appKitPromise = Promise.all([
    import('@reown/appkit'),
    import('@reown/appkit-adapter-ethers'),
    import('@reown/appkit/networks'),
  ]).then(([{ createAppKit }, { EthersAdapter }, { avalancheFuji }]) => {
    fujiNetwork = avalancheFuji
    const origin = window.location.origin

    appKit = createAppKit({
      adapters: [new EthersAdapter()],
      networks: [avalancheFuji],
      defaultNetwork: avalancheFuji,
      projectId,
      metadata: {
        name: 'ScanDrop',
        description: 'One-wallet-one-reward campaigns on Avalanche Fuji.',
        url: origin,
        icons: [`${origin}/favicon.svg`],
      },
      enableNetworkSwitch: false,
      enableMobileFullScreen: true,
      features: {
        analytics: false,
        email: false,
        socials: [],
        onramp: false,
        swaps: false,
      },
      themeMode: 'light',
      themeVariables: {
        '--w3m-accent': '#e84142',
        '--w3m-border-radius-master': '2px',
      },
    })

    return appKit
  }).catch((error) => {
    appKitPromise = null
    throw error
  })

  return appKitPromise
}

export async function preloadWalletConnect() {
  if (!isWalletConnectConfigured) return
  await getAppKit()
}

function getConnectedProvider(modal) {
  const provider = modal.getWalletProvider?.()
  const account = modal.getAccount?.('eip155')
  return provider && account?.isConnected && account.address ? provider : null
}

function delay(timeoutMs) {
  return new Promise((resolve) => window.setTimeout(resolve, timeoutMs))
}

async function waitForSessionState(modal, shouldBeConnected) {
  const deadline = Date.now() + sessionResetTimeoutMs

  while (Date.now() < deadline) {
    const isConnected = Boolean(getConnectedProvider(modal))
    if (isConnected === shouldBeConnected) return
    await delay(100)
  }

  if (!shouldBeConnected && getConnectedProvider(modal)) {
    throw new Error(
      'ScanDrop could not clear the previous Core session. Disconnect ScanDrop in Core and try again.',
    )
  }
}

async function resetWalletConnectSession(modal) {
  await Promise.resolve(modal.close()).catch(() => {})

  const account = modal.getAccount?.('eip155')
  if (account?.status === 'reconnecting' || account?.status === 'connecting') {
    await waitForSessionState(modal, true).catch(() => {})
  }

  if (getConnectedProvider(modal)) {
    await modal.disconnect('eip155')
    await waitForSessionState(modal, false)
  }
}

async function finishConnection(modal, provider) {
  await modal.switchNetwork(fujiNetwork)
  return connectEip1193Wallet(provider, { requestAccounts: false })
}

export async function connectWalletConnect({ forceNewSession = false } = {}) {
  if (!isWalletConnectConfigured) {
    throw new Error(
      'WalletConnect needs a Reown Project ID before mobile wallets can connect.',
    )
  }

  const modal = await getAppKit()
  if (forceNewSession) {
    await resetWalletConnectSession(modal)
  }

  const connectedProvider = forceNewSession
    ? null
    : getConnectedProvider(modal)
  if (connectedProvider) {
    return finishConnection(modal, connectedProvider)
  }

  return new Promise((resolve, reject) => {
    let connecting = false
    let settled = false
    let currentProvider
    let connectedAddress
    let unsubscribeProviders
    let unsubscribeAccount
    let unsubscribeState
    let modalWasOpened = false

    const timeout = window.setTimeout(() => {
      finishWithError(
        new Error('WalletConnect timed out. Open Core and approve the connection.'),
      )
    }, 60000)

    function cleanup() {
      window.clearTimeout(timeout)
      if (typeof unsubscribeProviders === 'function') unsubscribeProviders()
      if (typeof unsubscribeAccount === 'function') unsubscribeAccount()
      if (typeof unsubscribeState === 'function') unsubscribeState()
    }

    function finishWithError(error) {
      if (settled) return
      settled = true
      cleanup()
      Promise.resolve(modal.close()).catch(() => {})
      reject(error)
    }

    async function finishWithProvider(provider) {
      if (settled || connecting || !provider) return
      connecting = true

      try {
        const wallet = await finishConnection(modal, provider)
        settled = true
        cleanup()
        resolve(wallet)
      } catch (error) {
        finishWithError(error)
      }
    }

    function tryFinishConnection() {
      if (currentProvider && connectedAddress) {
        finishWithProvider(currentProvider)
      }
    }

    unsubscribeProviders = modal.subscribeProviders((providers) => {
      currentProvider = providers.eip155 || null
      tryFinishConnection()
    })

    unsubscribeAccount = modal.subscribeAccount((account) => {
      connectedAddress =
        account?.isConnected && account.address ? account.address : ''
      tryFinishConnection()
    }, 'eip155')

    unsubscribeState = modal.subscribeState(({ open }) => {
      if (open) {
        modalWasOpened = true
        return
      }

      if (!modalWasOpened || settled || connecting) return

      window.setTimeout(() => {
        if (settled || connecting) return

        const account = modal.getAccount?.('eip155')
        const provider = modal.getWalletProvider?.()
        if (account?.isConnected && account.address && provider) {
          currentProvider = provider
          connectedAddress = account.address
          tryFinishConnection()
        } else {
          finishWithError(new Error('Wallet connection was cancelled.'))
        }
      }, 300)
    })

    Promise.resolve(modal.open({ view: 'Connect', namespace: 'eip155' })).catch(
      finishWithError,
    )
  })
}

export async function disconnectWalletConnect() {
  const modal = appKit || (await getAppKit())
  await resetWalletConnectSession(modal)
}
