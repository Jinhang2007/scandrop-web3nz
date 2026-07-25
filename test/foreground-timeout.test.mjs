import assert from 'node:assert/strict'
import test from 'node:test'

import { createForegroundTimeout } from '../src/foreground-timeout.js'

function createHarness({ timeoutMs = 60_000, resumeGraceMs = 30_000 } = {}) {
  let now = 0
  let hidden = false
  let timer
  let expired = 0

  const foregroundTimeout = createForegroundTimeout({
    timeoutMs,
    resumeGraceMs,
    isHidden: () => hidden,
    onTimeout: () => {
      expired += 1
    },
    setTimer: (callback, delay) => {
      timer = { callback, delay }
      return timer
    },
    clearTimer: () => {
      timer = undefined
    },
    now: () => now,
  })

  return {
    foregroundTimeout,
    advance: (milliseconds) => {
      now += milliseconds
    },
    currentDelay: () => timer?.delay,
    expire: () => {
      const callback = timer?.callback
      timer = undefined
      callback?.()
    },
    expired: () => expired,
    setHidden: (value) => {
      hidden = value
    },
  }
}

test('the connection timeout pauses while the wallet app is open', () => {
  const harness = createHarness()

  harness.foregroundTimeout.resume()
  harness.advance(10_000)
  harness.setHidden(true)
  harness.foregroundTimeout.pause()
  harness.advance(120_000)
  harness.setHidden(false)
  harness.foregroundTimeout.resume()

  assert.equal(harness.currentDelay(), 50_000)
  assert.equal(harness.expired(), 0)
})

test('returning from the wallet app receives a minimum foreground grace period', () => {
  const harness = createHarness()

  harness.foregroundTimeout.resume()
  harness.advance(55_000)
  harness.setHidden(true)
  harness.foregroundTimeout.pause()
  harness.setHidden(false)
  harness.foregroundTimeout.resume({ withGrace: true })

  assert.equal(harness.currentDelay(), 30_000)
})

test('stopping the timeout prevents a late pairing timeout', () => {
  const harness = createHarness()

  harness.foregroundTimeout.resume()
  harness.foregroundTimeout.stop()
  harness.expire()

  assert.equal(harness.expired(), 0)
})
