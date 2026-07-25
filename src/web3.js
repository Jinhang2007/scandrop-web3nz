import {
  BrowserProvider,
  Contract,
  ContractFactory,
  JsonRpcProvider,
  formatEther,
  parseEther,
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

const campaignAddressStorageKey = 'scandrop:reward-campaign-address'
const defaultCampaignAddress = '0xd326af1c80d190ba230a0a358781fcfa8ef08d99'
const configuredCampaignAddress =
  import.meta.env.VITE_REWARD_CAMPAIGN_ADDRESS?.trim() || defaultCampaignAddress
const linkedCampaignAddress = new URLSearchParams(window.location.search)
  .get('contract')
  ?.trim()
const savedCampaignAddress =
  window.localStorage.getItem(campaignAddressStorageKey)?.trim() || ''

function isAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(value || '')
}

export let REWARD_CAMPAIGN_ADDRESS = [
  linkedCampaignAddress,
  configuredCampaignAddress,
  savedCampaignAddress,
].find(isAddress) || ''

export let isContractConfigured = isAddress(REWARD_CAMPAIGN_ADDRESS)

export function setRewardCampaignAddress(address) {
  if (!isAddress(address)) {
    throw new Error('The deployed contract address is invalid.')
  }

  REWARD_CAMPAIGN_ADDRESS = address
  isContractConfigured = true
  window.localStorage.setItem(campaignAddressStorageKey, address)

  const url = new URL(window.location.href)
  url.searchParams.set('contract', address)
  window.history.replaceState({}, '', url)
}

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

export function contractUrl(address) {
  return `${FUJI_NETWORK.explorerUrl}/address/${address}`
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

export async function deployRewardCampaign(
  signer,
  { rewardAmountAvax, fundingAmountAvax, durationDays },
) {
  if (!signer) {
    throw new Error('Connect the organiser wallet before deploying.')
  }

  const rewardAmount = Number(rewardAmountAvax)
  const fundingAmount = Number(fundingAmountAvax)
  const duration = Number(durationDays)

  if (
    !Number.isFinite(rewardAmount) ||
    rewardAmount <= 0 ||
    !Number.isFinite(fundingAmount) ||
    fundingAmount <= 0 ||
    rewardAmount > fundingAmount ||
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    throw new Error('Enter a valid reward, funding amount, and campaign duration.')
  }

  const provider = signer.provider
  const network = await provider.getNetwork()
  if (network.chainId !== BigInt(FUJI_NETWORK.chainId)) {
    throw new Error('Switch your wallet to Avalanche Fuji and try again.')
  }

  const owner = await signer.getAddress()
  const balance = await provider.getBalance(owner)
  const fundingWei = parseEther(String(fundingAmountAvax))
  if (balance <= fundingWei) {
    throw new Error(
      `Your wallet has ${Number(formatEther(balance)).toFixed(4)} AVAX. Add enough Fuji AVAX for the campaign funding plus gas.`,
    )
  }

  const endTime =
    Math.floor(Date.now() / 1000) + Math.round(duration * 24 * 60 * 60)
  const factory = new ContractFactory(
    rewardCampaignArtifact.abi,
    rewardCampaignArtifact.bytecode,
    signer,
  )
  const contract = await factory.deploy(
    parseEther(String(rewardAmountAvax)),
    endTime,
    { value: fundingWei },
  )
  const deploymentTransaction = contract.deploymentTransaction()

  await contract.waitForDeployment()
  const receipt = await deploymentTransaction.wait(1)
  const ownerBalance = await provider.getBalance(owner)

  return {
    address: await contract.getAddress(),
    hash: deploymentTransaction.hash,
    blockNumber: receipt.blockNumber,
    ownerBalance: formatEther(ownerBalance),
  }
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
