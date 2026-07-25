import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import solc from 'solc'

const projectRoot = process.cwd()
const sourcePath = path.join(projectRoot, 'contracts', 'RewardCampaign.sol')
const outputDirectory = path.join(projectRoot, 'src', 'contracts')
const outputPath = path.join(outputDirectory, 'RewardCampaign.json')
const source = await readFile(sourcePath, 'utf8')

const input = {
  language: 'Solidity',
  sources: {
    'RewardCampaign.sol': { content: source },
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
    evmVersion: 'cancun',
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'],
      },
    },
  },
}

const output = JSON.parse(solc.compile(JSON.stringify(input)))
const diagnostics = output.errors ?? []

for (const diagnostic of diagnostics) {
  const destination = diagnostic.severity === 'error' ? console.error : console.warn
  destination(diagnostic.formattedMessage)
}

if (diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
  throw new Error('RewardCampaign compilation failed.')
}

const compiled = output.contracts['RewardCampaign.sol'].RewardCampaign
const artifact = {
  contractName: 'RewardCampaign',
  compilerVersion: solc.version(),
  network: 'Avalanche Fuji C-Chain',
  chainId: 43113,
  abi: compiled.abi,
  bytecode: `0x${compiled.evm.bytecode.object}`,
  deployedBytecode: `0x${compiled.evm.deployedBytecode.object}`,
}

await mkdir(outputDirectory, { recursive: true })
await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`)
console.log(`Compiled RewardCampaign with ${artifact.compilerVersion}`)
