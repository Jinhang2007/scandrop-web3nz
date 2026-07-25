export function getClaimFlowStep({
  registrationId,
  claimStatus,
  connectedWallet,
}) {
  if (!registrationId) return 'register'
  if (claimStatus === 'claimed') return 'complete'
  if (!connectedWallet) return 'connect'
  return 'claim'
}
