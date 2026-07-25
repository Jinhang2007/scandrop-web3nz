import {
  BrowserProvider,
  Contract,
  ContractFactory,
  JsonRpcProvider,
  formatEther,
  parseEther,
} from 'ethers'
import rewardCampaignArtifact from './contracts/RewardCampaign.json'
import { calculateGasSponsorReserveAvax } from './campaign-economics.js'
import { shouldSwitchNetwork } from './network-policy.js'

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

export const GASLESS_RELAYER_ADDRESS =
  import.meta.env.VITE_GASLESS_RELAYER_ADDRESS?.trim() ||
  '0x1c510e360696E199A896c07311b3fA6807763aE4'

const campaignAddressStorageKey = 'scandrop:reward-campaign-address'
const configuredCampaignAddress =
  import.meta.env.VITE_REWARD_CAMPAIGN_ADDRESS?.trim() || ''
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
  savedCampaignAddress,
  configuredCampaignAddress,
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

export function clearRewardCampaignAddress() {
  REWARD_CAMPAIGN_ADDRESS = ''
  isContractConfigured = false
  window.localStorage.removeItem(campaignAddressStorageKey)

  const url = new URL(window.location.href)
  url.searchParams.delete('contract')
  window.history.replaceState({}, '', url)
}

function withTimeout(promise, timeoutMs, message, details = {}) {
  let timeout
  const timeoutPromise = new Promise((_, reject) => {
    timeout = window.setTimeout(() => {
      const error = new Error(message)
      Object.assign(error, details)
      reject(error)
    }, timeoutMs)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    window.clearTimeout(timeout)
  })
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

  let provider = new BrowserProvider(ethereum)
  let network = await provider.getNetwork()

  if (shouldSwitchNetwork(network.chainId, FUJI_NETWORK.chainId)) {
    await switchProviderToFuji(ethereum)
    provider = new BrowserProvider(ethereum)
    network = await provider.getNetwork()
  }

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
  {
    rewardAmountAvax,
    fundingAmountAvax,
    durationDays,
    relayerGasFundingAvax,
  },
) {
  if (!signer) {
    throw new Error('Connect the organiser wallet before deploying.')
  }

  const rewardAmount = Number(rewardAmountAvax)
  const fundingAmount = Number(fundingAmountAvax)
  const duration = Number(durationDays)
  const resolvedRelayerGasFundingAvax =
    relayerGasFundingAvax ||
    calculateGasSponsorReserveAvax(fundingAmountAvax, rewardAmountAvax)
  const relayerGasFunding = Number(resolvedRelayerGasFundingAvax)

  if (
    !Number.isFinite(rewardAmount) ||
    rewardAmount <= 0 ||
    !Number.isFinite(fundingAmount) ||
    fundingAmount <= 0 ||
    rewardAmount > fundingAmount ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    !Number.isFinite(relayerGasFunding) ||
    relayerGasFunding <= 0 ||
    !isAddress(GASLESS_RELAYER_ADDRESS)
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
  const relayerGasFundingWei = parseEther(
    String(resolvedRelayerGasFundingAvax),
  )
  const totalDeploymentValue = fundingWei + relayerGasFundingWei
  if (balance <= totalDeploymentValue) {
    throw new Error(
      `Your wallet has ${Number(formatEther(balance)).toFixed(4)} AVAX. Add enough Fuji AVAX for the campaign funding, the ${resolvedRelayerGasFundingAvax} AVAX gas sponsor reserve, and deployment gas.`,
    )
  }

  const endTime =
    Math.floor(Date.now() / 1000) + Math.round(duration * 24 * 60 * 60)
  const factory = new ContractFactory(
    rewardCampaignArtifact.abi,
    rewardCampaignArtifact.bytecode,
    signer,
  )
  const contract = await withTimeout(
    factory.deploy(
      parseEther(String(rewardAmountAvax)),
      endTime,
      GASLESS_RELAYER_ADDRESS,
      relayerGasFundingWei,
      { value: totalDeploymentValue },
    ),
    90_000,
    'Core did not return the deployment transaction in time. Reconnect Core and check Activity before trying again.',
  )
  const deploymentTransaction = contract.deploymentTransaction()
  const predictedAddress = await contract.getAddress()

  const receipt = await withTimeout(
    deploymentTransaction.wait(1),
    120_000,
    'The deployment was submitted but confirmation is taking longer than expected. Check the transaction in Fuji Explorer before retrying.',
    {
      transactionHash: deploymentTransaction.hash,
      contractAddress: predictedAddress,
    },
  )
  const ownerBalance = await provider.getBalance(owner)

  return {
    address: predictedAddress,
    hash: deploymentTransaction.hash,
    blockNumber: receipt.blockNumber,
    ownerBalance: formatEther(ownerBalance),
    relayer: GASLESS_RELAYER_ADDRESS,
    relayerGasFunding: String(resolvedRelayerGasFundingAvax),
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

  let relayer = ''
  let relayerBalance = '0'
  try {
    relayer = await contract.relayer()
    relayerBalance = formatEther(await provider.getBalance(relayer))
  } catch {
    // Contracts deployed before gasless claims do not expose a relayer.
  }

  return {
    rewardAmount: formatEther(rewardAmount),
    endTime: new Date(Number(endTime) * 1000),
    totalClaims: Number(totalClaims),
    paused,
    hasClaimed,
    contractBalance: formatEther(balance),
    remainingClaims: Number(remainingClaims),
    relayer,
    relayerBalance,
    gasless: isAddress(relayer),
  }
}

export async function fundGasSponsor(signer, amountAvax) {
  if (!signer || !isAddress(GASLESS_RELAYER_ADDRESS)) {
    throw new Error('Connect the organiser wallet before refilling the gas sponsor.')
  }

  const amount = Number(amountAvax)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Enter a valid gas sponsor amount.')
  }

  const transaction = await withTimeout(
    signer.sendTransaction({
      to: GASLESS_RELAYER_ADDRESS,
      value: parseEther(String(amountAvax)),
    }),
    90_000,
    'Core did not return the gas sponsor transaction in time. Check Activity before trying again.',
  )
  const receipt = await withTimeout(
    transaction.wait(1),
    120_000,
    'The gas sponsor top-up was submitted and is still confirming on Fuji.',
    { transactionHash: transaction.hash },
  )

  return {
    hash: transaction.hash,
    blockNumber: receipt.blockNumber,
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
