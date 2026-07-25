export function shouldSwitchNetwork(currentChainId, targetChainId) {
  try {
    return BigInt(currentChainId) !== BigInt(targetChainId)
  } catch {
    return true
  }
}
