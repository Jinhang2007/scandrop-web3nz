import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  formatEther,
} from 'ethers'
import rewardCampaignArtifact from './contracts/RewardCampaign.json'

export const FUJI_NETWORK = {
  chainId: 43113,
  chainIdHex: '0xA869',
  name: 'Avalanche Fuji C-Chain',
  rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
  currency: {
    name: 'Avalanche',
    symbol: 'AVAX',
    decimals: 18,
  },
  explorerUrl: 'https://testnet.snowtrace.io',
  faucetUrl: 'https://core.app/tools/testnet-faucet/',
}

export const REWARD_CAMPAIGN_ADDRESS =
  import.meta.env.VITE_REWARD_CAMPAIGN_ADDRESS?.trim() || ''

export const isContractConfigured = /^0x[a-fA-F0-9]{40}$/.test(
  REWARD_CAMPAIGN_ADDRESS,
)

function getInjectedProvider() {
  const provider = window.avalanche || window.ethereum

  if (!provider) {
    throw new Error('Install Core Wallet or MetaMask to connect.')
  }

  return provider
}

export function hasInjectedWallet() {
  return Boolean(window.avalanche || window.ethereum)
}

export function formatAddress(address) {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function transactionUrl(hash) {
  return `${FUJI_NETWORK.explorerUrl}/tx/${hash}`
}

async function switchProviderToFuji(ethereum) {
  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: FUJI_NETWORK.chainIdHex }],
    })
  } catch (error) {
    if (error.code !== 4902) throw error

    await ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: FUJI_NETWORK.chainIdHex,
          chainName: FUJI_NETWORK.name,
          nativeCurrency: FUJI_NETWORK.currency,
          rpcUrls: [FUJI_NETWORK.rpcUrl],
          blockExplorerUrls: [FUJI_NETWORK.explorerUrl],
        },
      ],
    })
  }
}

export async function switchToFuji() {
  await switchProviderToFuji(getInjectedProvider())
}

export async function connectEip1193Wallet(
  ethereum,
  { requestAccounts = true } = {},
) {
  if (requestAccounts) {
    await ethereum.request({ method: 'eth_requestAccounts' })
  }
  await switchProviderToFuji(ethereum)

  const provider = new BrowserProvider(ethereum)
  const network = await provider.getNetwork()

  if (network.chainId !== BigInt(FUJI_NETWORK.chainId)) {
    throw new Error('Switch your wallet to Avalanche Fuji and try again.')
  }

  const signer = await provider.getSigner()
  const address = await signer.getAddress()
  const balance = await provider.getBalance(address)

  return {
    address,
    balance: formatEther(balance),
    provider,
    signer,
  }
}

export async function connectWallet() {
  return connectEip1193Wallet(getInjectedProvider())
}

export async function readCampaign(account) {
  if (!isContractConfigured) return null

  const provider = new JsonRpcProvider(FUJI_NETWORK.rpcUrl)
  const contract = new Contract(
    REWARD_CAMPAIGN_ADDRESS,
    rewardCampaignArtifact.abi,
    provider,
  )

  const [rewardAmount, endTime, totalClaims, paused, hasClaimed, balance, remainingClaims] =
    await Promise.all([
      contract.rewardAmount(),
      contract.endTime(),
      contract.totalClaims(),
      contract.paused(),
      account ? contract.hasClaimed(account) : false,
      provider.getBalance(REWARD_CAMPAIGN_ADDRESS),
      contract.remainingClaims(),
    ])

  return {
    rewardAmount: formatEther(rewardAmount),
    endTime: new Date(Number(endTime) * 1000),
    totalClaims: Number(totalClaims),
    paused,
    hasClaimed,
    contractBalance: formatEther(balance),
    remainingClaims: Number(remainingClaims),
  }
}

export async function claimReward(signer) {
  if (!isContractConfigured) {
    throw new Error('The Fuji reward contract has not been deployed yet.')
  }

  const contract = new Contract(
    REWARD_CAMPAIGN_ADDRESS,
    rewardCampaignArtifact.abi,
    signer,
  )
  const transaction = await contract.claim()
  const receipt = await transaction.wait(1)

  return {
    hash: transaction.hash,
    blockNumber: receipt.blockNumber,
  }
}
