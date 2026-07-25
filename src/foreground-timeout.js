export function createForegroundTimeout({
  timeoutMs,
  resumeGraceMs = 0,
  isHidden = () => false,
  onTimeout,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  now = Date.now,
}) {
  let timerId = null
  let startedAt = 0
  let remainingMs = timeoutMs
  let stopped = false

  function pause() {
    if (timerId === null) return

    clearTimer(timerId)
    timerId = null
    remainingMs = Math.max(0, remainingMs - (now() - startedAt))
    startedAt = 0
  }

  function resume({ withGrace = false } = {}) {
    if (stopped || isHidden() || timerId !== null) return

    if (withGrace) {
      remainingMs = Math.max(remainingMs, resumeGraceMs)
    }

    if (remainingMs <= 0) {
      onTimeout()
      return
    }

    startedAt = now()
    timerId = setTimer(() => {
      timerId = null
      startedAt = 0
      if (!stopped) onTimeout()
    }, remainingMs)
  }

  function stop() {
    stopped = true
    if (timerId !== null) clearTimer(timerId)
    timerId = null
    startedAt = 0
  }

  return {
    pause,
    resume,
    stop,
    remaining: () => remainingMs,
  }
}
