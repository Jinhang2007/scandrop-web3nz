export function shouldStartFreshWalletSession({
  linkedWalletAddress,
  previousConnectionError,
}) {
  if (!String(linkedWalletAddress || '').trim()) return true

  const error = String(previousConnectionError || '').toLowerCase()
  return (
    error.includes('already linked') ||
    error.includes('different wallet') ||
    error.includes('previous core session')
  )
}
