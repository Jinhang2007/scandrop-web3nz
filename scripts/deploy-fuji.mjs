import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ContractFactory, JsonRpcProvider, Wallet, formatEther, parseEther } from 'ethers'

const rpcUrl = process.env.FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc'
const privateKey = process.env.FUJI_DEPLOYER_PRIVATE_KEY
const rewardAmount = process.env.REWARD_AMOUNT_AVAX || '0.001'
const campaignFunding = process.env.CAMPAIGN_FUNDING_AVAX || '0.01'
const relayerAddress = process.env.GASLESS_RELAYER_ADDRESS
const relayerGasFunding = process.env.RELAYER_GAS_FUNDING_AVAX || '0.005'
const durationDays = Number(process.env.CAMPAIGN_DURATION_DAYS || '30')

if (!privateKey) {
  throw new Error('Set FUJI_DEPLOYER_PRIVATE_KEY before deploying. Use a test-only wallet.')
}
if (!relayerAddress) {
  throw new Error('Set GASLESS_RELAYER_ADDRESS before deploying.')
}

if (!Number.isFinite(durationDays) || durationDays <= 0) {
  throw new Error('CAMPAIGN_DURATION_DAYS must be a positive number.')
}

const artifactPath = path.join(process.cwd(), 'src', 'contracts', 'RewardCampaign.json')
const artifact = JSON.parse(await readFile(artifactPath, 'utf8'))
const provider = new JsonRpcProvider(rpcUrl)
const network = await provider.getNetwork()

if (network.chainId !== 43113n) {
  throw new Error(`Expected Avalanche Fuji chain ID 43113, received ${network.chainId}.`)
}

const wallet = new Wallet(privateKey, provider)
const balance = await provider.getBalance(wallet.address)
const fundingWei = parseEther(campaignFunding)
const relayerGasFundingWei = parseEther(relayerGasFunding)
const totalDeploymentValue = fundingWei + relayerGasFundingWei

if (balance <= totalDeploymentValue) {
  throw new Error(
    `The deployer has ${formatEther(balance)} AVAX. Add enough test AVAX for funding and gas.`,
  )
}

const endTime = Math.floor(Date.now() / 1000) + durationDays * 24 * 60 * 60
const factory = new ContractFactory(artifact.abi, artifact.bytecode, wallet)

console.log(`Deploying from ${wallet.address} on Avalanche Fuji...`)
const contract = await factory.deploy(
  parseEther(rewardAmount),
  endTime,
  relayerAddress,
  relayerGasFundingWei,
  { value: totalDeploymentValue },
)

await contract.waitForDeployment()
const address = await contract.getAddress()
const deploymentTransaction = contract.deploymentTransaction()

console.log(`RewardCampaign deployed: ${address}`)
console.log(`Transaction: https://testnet.snowtrace.io/tx/${deploymentTransaction.hash}`)
console.log(`Set VITE_REWARD_CAMPAIGN_ADDRESS=${address}`)
