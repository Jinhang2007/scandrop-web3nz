# ScanDrop

ScanDrop is a Web3NZ Hackathon prototype that helps organisations turn QR-code scans into measurable, returning customers through instant rewards and automated retention journeys.

> Scan once. Claim instantly. One account, one reward.

## Live Demo

[Open the ScanDrop demo](https://scandrop-web3nz.jinhang2007.chatgpt.site/)

## Product Idea

An organisation creates a reward campaign and receives a unique QR code. A user scans the code, connects an account, and immediately receives a small reward.

Each account can only claim once per campaign. ScanDrop then uses interest-based follow-ups and progressively higher rewards to identify users who are genuinely interested in the product.

The intended funnel is:

1. Day 0: instant welcome reward after a unique scan.
2. Day 3: product introduction and education.
3. Day 7: interest-based return campaign.
4. Day 30: higher-value reward for qualified users.
5. Long term: relevant campaigns, loyalty benefits, and community rewards.

## Current Features

- Create a QR reward campaign.
- Configure the reward amount and total campaign budget.
- Generate a real, scannable QR code.
- Preview the mobile reward-claim experience.
- Enforce one claim per demo account and campaign.
- Switch between demo accounts to test account uniqueness.
- Simulate USDC reward payments with a local ledger.
- View acquisition and retention funnel metrics.
- View Day 0, Day 3, Day 7, and Day 30 automation stages.
- Review audience interest and return-rate segments.
- Responsive dashboard and mobile claim interface.

## Demo Limitations

This version is an interactive Hackathon prototype:

- No real cryptocurrency is transferred.
- Account uniqueness is simulated in browser storage.
- Email automation is represented in the interface but is not yet connected to an email provider.
- Campaign and audience data use realistic demonstration values.
- A production version would enforce uniqueness, budgets, and claims on a backend database.

## Planned Web3 Integration

The application is designed to keep the reward protocol replaceable. A future version can add adapters such as:

```js
PaymentAdapter.sendReward()
IdentityAdapter.verifyAccount()
```

Potential integrations include:

- Avalanche C-Chain for testnet or stablecoin transactions.
- NewMoney for payment and stablecoin infrastructure.
- Wallet signature authentication.
- A digital identity or proof-of-personhood service for stronger Sybil resistance.

## Technology

- Vite
- Vanilla JavaScript
- CSS
- `qrcode` for generating scannable campaign codes
- Cloudflare-compatible worker entry point for deployment

## Run Locally

Requirements:

- Node.js
- npm

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local address printed in the terminal, normally:

```text
http://127.0.0.1:5173/
```

Do not open `index.html` directly with a `file://` address. Vite projects must run through the development server.

## Production Build

```bash
npm run build
```

The generated site is written to the `dist` directory.

## Project Structure

```text
web3-learning/
├── public/                 Static icons and assets
├── src/
│   ├── assets/             Image assets
│   ├── main.js             Application interface and interactions
│   └── style.css           Product styling and responsive layout
├── worker/
│   └── index.js            Deployment worker entry point
├── index.html              HTML entry point
├── package.json            Dependencies and scripts
└── vite.config.js          Vite build configuration
```

## Reward Safety Rules

The production version should include:

- A unique database constraint on `campaign_id + account_id`.
- A total campaign budget and daily spending limit.
- Atomic claim and budget updates.
- Rate limiting and suspicious-account detection.
- Verified email or wallet ownership.
- Clear email consent and unsubscribe controls.
- No user deposit requirement and no multi-level commission structure.

## Hackathon Team

Built for the Web3NZ Hackathon.

GitHub owner: [Jinhang2007](https://github.com/Jinhang2007)

