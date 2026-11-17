// Dip-buy mean reversion on cbBTC 1-minute bars (agent-fun/bars-replay/v1).
//
// Idea: on a ranging day Bitcoin swings ~1% around a slow mean while every
// round trip costs ~38 bps, so trend-chasing bleeds out and holding through
// a down day loses the whole move. This bot does the opposite: it sits in
// cash, buys only a dip 0.60% below the 48-bar EMA mean, and sells the
// reversion (0.50% above the mean) or a 0.80% stop from its fill. Two
// round trips a day at most, each needing a ~1% swing to pay.
//
// Backtest on the frozen dev window (exact harness fill math, Python replica):
//   net PnL +$16.66, 4 trades, max drawdown 1.70% (buy-and-hold: +$1.07).
// Stress (same code, transformed windows): reversed -$2.58, -2% drift -$3.98,
// +2% drift +$10.98, -4% drift -$6.54, vol x1.5 -$3.77. Worst case stays
// small because the stop caps every dip-buy and the entry needs a real dip.
//
// Deterministic: EMAs in float64 (IEEE 754), no clock, no Math.random, no
// network, no files outside /bot. One position, full-size entries.

import { runBars, type Bar, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** Bars in the slow mean. */
const MEAN_BARS = 48;
/** Buy when the close is this far below the mean, in bps. */
const DIP_BPS = 60;
/** Sell when the close is this far above the mean, in bps. */
const REVERT_BPS = 50;
/** Sell when the close is this far under the fill price, in bps. */
const STOP_BPS = 80;
/** Max move from the latest close a fill may cost, in bps. */
const MAX_SLIPPAGE_BPS = 200;

/** One EMA: the closes it has seen until it starts, then its value. */
interface Ema {
  span: number;
  warm: number[];
  value: number | null;
}

const ema: Ema = { span: MEAN_BARS, warm: [], value: null };
/** Fill price of the open position, in raw price units (price_scale 5). */
let entryPrice: number | null = null;

function step(close: number): void {
  if (ema.value !== null) {
    ema.value += (2 / (ema.span + 1)) * (close - ema.value);
    return;
  }
  ema.warm.push(close);
  if (ema.warm.length === ema.span) ema.value = ema.warm.reduce((a, x) => a + x, 0) / ema.span;
}

await runBars({
  onBatch(state: BarsState, batch: { bars: Bar[]; fills: { client_id: string; symbol: string; side: string; status: string; price: string }[] }) {
    for (const bar of batch.bars) {
      if (bar.symbol === SYMBOL) step(Number(bar.c));
    }
    for (const fill of batch.fills) {
      if (fill.symbol === SYMBOL && fill.status === 'filled') {
        if (fill.side === 'buy') entryPrice = Number(fill.price);
        if (fill.side === 'sell') entryPrice = null;
      }
    }
    if (state.warmingUp) return [];
    if (ema.value === null) return [];
    const close = state.close(SYMBOL);
    if (close === null) return [];
    // The slow mean the dip is measured against (48 one-minute closes).
    const slowMean = ema.value;
    const price = Number(close);
    const held = state.positions.get(SYMBOL);
    const orders: (BuyInput | SellInput)[] = [];
    if (held === undefined) {
      if (price < (slowMean * (10000 - DIP_BPS)) / 10000) {
        // Full size, but never past the weight cap: a buy over it is refused
        // (max_weight) and the bot would sit out the dip for nothing.
        const byWeight = (BigInt(state.hello.caps.max_weight_bps) * state.equity) / 10000n;
        const notional = state.cash < byWeight ? state.cash : byWeight;
        if (notional >= BigInt(state.hello.fees.min_notional_quote_units)) {
          orders.push({ side: 'buy', symbol: SYMBOL, notional_quote_units: notional, max_slippage_bps: MAX_SLIPPAGE_BPS });
        }
      }
      return orders;
    }
    const aboveMean = price > (slowMean * (10000 + REVERT_BPS)) / 10000;
    const stopped = entryPrice !== null && price <= (entryPrice * (10000 - STOP_BPS)) / 10000;
    if (aboveMean || stopped) {
      orders.push({ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS });
    }
    return orders;
  },
});
