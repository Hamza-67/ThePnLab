/**
 * margin.js — miroir frontend des formules de backend/app/services/margin.py.
 * Sert au preview live (marge, prix de liquidation) dans le panneau d'ordre.
 * IMPORTANT : garder synchro avec le backend — c'est lui qui fait foi.
 */

export const MAINTENANCE_MARGIN_RATIO = 0.5
export const CFD_FINANCING_RATE = 0.08        // annuel
export const FUTURES_MARGIN_RATIO = 0.10

export const LEVERAGE_MIN = 2
export const LEVERAGE_MAX_STOCK = 20
export const LEVERAGE_MAX_CRYPTO = 5

export const isCrypto = (ticker) => ticker.includes('-USD')

export function leverageCap(ticker) {
  return isCrypto(ticker) ? LEVERAGE_MAX_CRYPTO : LEVERAGE_MAX_STOCK
}

// Marge initiale CFD : M = N / L
export function initialMarginCfd(notional, leverage) {
  return notional / leverage
}

// Prix de liquidation : long p0·(1−(1−mm)/L), short p0·(1+(1−mm)/L)
export function liquidationPrice(direction, entry, leverage, mm = MAINTENANCE_MARGIN_RATIO) {
  const move = (1 - mm) / leverage
  return direction === 'LONG' ? entry * (1 - move) : entry * (1 + move)
}

// Frais overnight CFD par nuit : N · 0.08/365
export function overnightFinancing(notional) {
  return notional * CFD_FINANCING_RATE / 365
}
