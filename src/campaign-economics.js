export const GAS_RESERVE_PER_CLAIM_AVAX = 0.0025
export const MINIMUM_GAS_RESERVE_AVAX = 0.01

function positiveNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

export function estimatedClaimCount(fundingAmountAvax, rewardAmountAvax) {
  const funding = positiveNumber(fundingAmountAvax)
  const reward = positiveNumber(rewardAmountAvax)
  return funding && reward ? Math.floor(funding / reward) : 0
}

export function calculateGasSponsorReserveAvax(
  fundingAmountAvax,
  rewardAmountAvax,
) {
  const claims = estimatedClaimCount(fundingAmountAvax, rewardAmountAvax)
  if (!claims) return '0'

  const reserve = Math.max(
    MINIMUM_GAS_RESERVE_AVAX,
    claims * GAS_RESERVE_PER_CLAIM_AVAX,
  )

  return (Math.ceil(reserve * 1000) / 1000).toFixed(3)
}

export function calculateGasSponsorTopUpAvax(
  remainingClaims,
  currentRelayerBalanceAvax,
) {
  const claims = Math.max(0, Math.floor(Number(remainingClaims) || 0))
  const currentBalance = Math.max(0, Number(currentRelayerBalanceAvax) || 0)
  const target = Math.max(
    MINIMUM_GAS_RESERVE_AVAX,
    claims * GAS_RESERVE_PER_CLAIM_AVAX,
  )
  const deficit = Math.max(0, target - currentBalance)
  return deficit ? (Math.ceil(deficit * 1000) / 1000).toFixed(3) : '0'
}
