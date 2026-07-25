# ScanDrop

ScanDrop is a Web3NZ Hackathon prototype for turning QR-code scans into measurable, returning users with native AVAX rewards on Avalanche Fuji.

> Scan once. Register. Connect a wallet. Claim test AVAX once.

## Live Demo

[Open ScanDrop](https://scandrop-web3nz.jinhang2007.chatgpt.site/)

## Current Web3 Scope

This version implements the Avalanche path only:

- Avalanche Fuji C-Chain (`chainId 43113`)
- Native Fuji test AVAX rewards
- A Solidity campaign contract funded with AVAX
- One successful claim per wallet address
- Live wallet connection with Core Wallet or MetaMask
- Mobile Core connection through WalletConnect/Reown AppKit
- ScanDrop profile registration backed by a hosted D1 database
- One ScanDrop account and one wallet link per campaign
- Gasless claims submitted by a dedicated ScanDrop relayer
- Claim transaction receipts saved to the registered profile
- A public claim-only route that never exposes the organiser dashboard
- Organiser access gated by the connected campaign-owner wallet address
- Public transaction links through the Fuji explorer

USDC is not used in this test. The previously discussed NewMoney integration (step 8) is intentionally not included.

Fuji AVAX has no real-world value and is used only for testing.

## Reward Flow

1. The organiser deploys `RewardCampaign` to Avalanche Fuji and funds it with test AVAX.
2. ScanDrop generates a campaign QR code.
3. A user scans the code and creates a ScanDrop profile with an email address.
4. ScanDrop creates one registration record for that account and campaign.
5. The user connects Core Wallet or MetaMask. The wallet may have a zero AVAX balance.
6. ScanDrop links that wallet to the registration and switches it to Avalanche Fuji.
7. The ScanDrop backend verifies the registration and asks its protected relayer to submit `claimFor`.
8. The relayer pays the Fuji network fee; the new user does not sign or pay for the claim transaction.
9. The contract checks that the wallet has not claimed before and that funding remains, then transfers a fixed amount of native test AVAX directly to that wallet.
10. ScanDrop saves the confirmed transaction to the registered profile and displays the Fuji explorer link.

The database prevents the same email or wallet from creating multiple registrations in one campaign, and the contract independently enforces one successful claim per wallet address. This still does not prove that two emails and wallets belong to different people; stronger identity or Sybil protection is a later production concern.

This Hackathon account is a lightweight test profile, not a password-based
authentication system. Email delivery and account verification remain later
production integrations.

## Smart Contract

[`contracts/RewardCampaign.sol`](contracts/RewardCampaign.sol) provides:

- An immutable reward amount
- A campaign end time
- One-claim-per-wallet enforcement
- Gas-sponsored `claimFor(address)` restricted to the configured relayer
- An owner-controlled relayer address
- Contract-balance-based campaign limits
- Pause and campaign-extension controls for the owner
- Withdrawal of unused funds only after pause or expiry
- `RewardClaimed` events for a public campaign record

## Run Locally

Requirements:

- Node.js
- npm
- Core Wallet or MetaMask for the claim flow
- A free Reown Project ID for mobile WalletConnect

Install dependencies and start the site:

```bash
npm install
npm run dev
```

Open the local address printed in the terminal, normally:

```text
http://127.0.0.1:5173/
```

Do not open `index.html` with a `file://` address. Vite projects need the development server.

## Enable WalletConnect

Core mobile is not an injected browser wallet, so mobile connections use
WalletConnect through Reown AppKit.

1. Create a project at [Reown Dashboard](https://dashboard.reown.com/).
2. Add the ScanDrop website domain to that project.
3. Put the public project ID in `.env` to override the ScanDrop default:

```text
VITE_REOWN_PROJECT_ID=4bb6f3a43c511fbcedad4b5feff468d0
```

Restart or rebuild the website. The claim screen will then offer both
`Core mobile / WalletConnect` and a browser-extension option.

The Reown Project ID is a public application identifier. It is not a wallet
private key or seed phrase.

## Compile the Contract

```bash
npm run contract:compile
```

The generated ABI and bytecode are written to:

```text
src/contracts/RewardCampaign.json
```

## Deploy to Avalanche Fuji

The preferred Hackathon flow is built into the website:

1. Select **New campaign**.
2. Set the reward, contract funding, and campaign duration.
3. Select **Connect Core & deploy on Fuji**.
4. Approve the wallet connection and one deployment transaction in Core.
5. The deployment sends the campaign funding to the contract and a small gas reserve to the ScanDrop relayer.
6. ScanDrop verifies the owner and relayer on Fuji, activates the campaign, and adds the address to the campaign URL and QR code.

Use Fuji test AVAX only. The website never requests, stores, or transmits a
user or organiser wallet private key. The dedicated relayer key is stored as an
encrypted hosting secret and is never included in the website source.

For a command-line deployment, use a new test-only wallet. Never commit a
private key or paste one into chat.

1. Copy `.env.example` to `.env`.
2. Add Fuji test AVAX to the deployer wallet from the [Core testnet faucet](https://core.app/tools/testnet-faucet/).
3. Fill in the deployment values locally.
4. Load the values into your terminal and deploy:

```bash
set -a
source .env
set +a
npm run contract:deploy:fuji
```

After deployment, copy the reported address into:

```text
VITE_REWARD_CAMPAIGN_ADDRESS=0x...
```

Rebuild or restart the development server. The claim button will then use the live Fuji contract.

Default deployment settings in `.env.example`:

- Reward per wallet: `0.001 AVAX`
- Campaign funding: `0.01 AVAX`
- Relayer gas reserve: `0.005 AVAX`
- Duration: `30 days`

## Production Build

```bash
npm run build
```

The generated website is written to `dist`.

## Project Structure

```text
web3-learning/
├── contracts/
│   └── RewardCampaign.sol
├── db/
│   └── schema.ts
├── drizzle/
│   └── 0000_short_bromley.sql
├── scripts/
│   ├── compile-contract.mjs
│   └── deploy-fuji.mjs
├── src/
│   ├── contracts/RewardCampaign.json
│   ├── main.js
│   ├── registration.js
│   ├── style.css
│   ├── walletconnect.js
│   └── web3.js
├── worker/index.js
├── .env.example
├── index.html
├── package.json
└── vite.config.js
```

## Hackathon Safety Boundaries

- Testnet only; no real-money rewards
- One wallet can claim only once per campaign contract
- Claiming users can begin with zero AVAX; ScanDrop sponsors the network fee
- Campaign payouts cannot exceed the contract balance
- No deposit requirement
- No referral pyramid or multi-level commission
- Registration and claim receipts are stored; automated email sending remains a later integration
- NewMoney and company APIs remain out of scope for this version

Built for the Web3NZ Hackathon by [Jinhang2007](https://github.com/Jinhang2007).
