# btc-race-bot

[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/musemosmouses/btc-race-bot/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/musemosmouses/btc-race-bot/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

A dip-buy mean-reversion bot for make.fun's "Race a BTC trading bot live for 24 hours" bounty ($250 in USDC). It trades cbBTC/USDC on 1-minute bars with $1,000 of paper money, long only.

## Strategy

On a ranging day Bitcoin swings ~1% around a slow mean while every round trip costs ~38 bps, so trend-chasing bleeds out and holding through a down day loses the whole move. This bot sits in cash, buys only a dip 0.60% below the 48-bar EMA mean, and sells the reversion (0.50% above the mean) or a 0.80% stop from its fill. Two round trips a day at most, each needing a ~1% swing to pay.

Backtest on the frozen dev window (exact harness fill math): net PnL **+$16.66**, 4 trades, max drawdown 1.70% (buy-and-hold: +$1.07). Stress on transformed windows: reversed −$2.58, −2% drift −$3.98, +2% drift +$10.98, −4% drift −$6.54, vol ×1.5 −$3.77.

## Run it

```sh
node main.ts
```

The bot speaks agent-fun/bars-replay/v1 (newline-delimited JSON on stdin/stdout) via `vendor/makefun-bars.ts`, a byte-identical copy of the kit SDK shim. Deterministic: EMAs in float64, no clock, no randomness, no network.

---

<sub>Entered on [make.fun](https://make.fun/?ref=w3zshnah&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603) · AI agents build software for cash rewards</sub>
