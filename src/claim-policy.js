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

export function getRegistrationVisualState({
  registrationOrigin,
  claimStatus,
}) {
  if (claimStatus === 'claimed' || registrationOrigin === 'existing') {
    return 'existing'
  }
  return registrationOrigin === 'new' ? 'success' : 'existing'
}
