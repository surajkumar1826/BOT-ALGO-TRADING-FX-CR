import {
  BenchmarkId,
  Candle,
  EconomicNewsEvent,
  InstrumentMeta,
  SentimentData,
  SymbolId,
  Timeframe,
} from '../types/trading';

export const TIMEFRAME_LIST: Timeframe[] = ['1m', '5m', '15m', '30m', '1h', '4h', '12h', '1D', '1W', '1M'];

export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '4h': 14400,
  '12h': 43200,
  '1D': 86400,
  '1W': 604800,
  '1M': 2592000,
};

export const INSTRUMENTS: Record<SymbolId, InstrumentMeta> = {
  EURUSD: {
    id: 'EURUSD',
    name: 'Euro / US Dollar',
    category: 'Forex',
    decimals: 5,
    pipSize: 0.0001,
    tickValuePerLot: 10,
    typicalSpread: 0.00012,
    correlationGroup: 'USD_INVERSE_FX',
    basePrice: 1.0845,
    volatility: 0.00065,
  },
  GBPUSD: {
    id: 'GBPUSD',
    name: 'British Pound / US Dollar',
    category: 'Forex',
    decimals: 5,
    pipSize: 0.0001,
    tickValuePerLot: 10,
    typicalSpread: 0.00015,
    correlationGroup: 'USD_INVERSE_FX',
    basePrice: 1.2692,
    volatility: 0.00078,
  },
  USDJPY: {
    id: 'USDJPY',
    name: 'US Dollar / Japanese Yen',
    category: 'Forex',
    decimals: 3,
    pipSize: 0.01,
    tickValuePerLot: 6.8,
    typicalSpread: 0.014,
    correlationGroup: 'USD_LONG_FX',
    basePrice: 152.45,
    volatility: 0.00072,
  },
  USDCAD: {
    id: 'USDCAD',
    name: 'US Dollar / Canadian Dollar',
    category: 'Forex',
    decimals: 5,
    pipSize: 0.0001,
    tickValuePerLot: 7.4,
    typicalSpread: 0.00018,
    correlationGroup: 'USD_LONG_FX',
    basePrice: 1.3912,
    volatility: 0.00058,
  },
  XAUUSD: {
    id: 'XAUUSD',
    name: 'Gold Spot / US Dollar',
    category: 'Metals',
    decimals: 2,
    pipSize: 0.1,
    tickValuePerLot: 10,
    typicalSpread: 0.25,
    correlationGroup: 'PRECIOUS_METALS',
    basePrice: 2648.5,
    volatility: 0.00145,
  },
  XAGUSD: {
    id: 'XAGUSD',
    name: 'Silver Spot / US Dollar',
    category: 'Metals',
    decimals: 3,
    pipSize: 0.01,
    tickValuePerLot: 50,
    typicalSpread: 0.025,
    correlationGroup: 'PRECIOUS_METALS',
    basePrice: 31.42,
    volatility: 0.0019,
  },
  USOIL: {
    id: 'USOIL',
    name: 'WTI Crude Oil',
    category: 'Energy',
    decimals: 2,
    pipSize: 0.01,
    tickValuePerLot: 10,
    typicalSpread: 0.03,
    correlationGroup: 'CRUDE_OIL',
    basePrice: 70.85,
    volatility: 0.0018,
  },
  UKOIL: {
    id: 'UKOIL',
    name: 'Brent Crude Oil',
    category: 'Energy',
    decimals: 2,
    pipSize: 0.01,
    tickValuePerLot: 10,
    typicalSpread: 0.035,
    correlationGroup: 'CRUDE_OIL',
    basePrice: 74.62,
    volatility: 0.0017,
  },
  US30: {
    id: 'US30',
    name: 'Dow Jones 30 Index',
    category: 'Indices',
    decimals: 1,
    pipSize: 1.0,
    tickValuePerLot: 1,
    typicalSpread: 1.8,
    correlationGroup: 'US_EQUITIES',
    basePrice: 43820.0,
    volatility: 0.0011,
  },
  NAS100: {
    id: 'NAS100',
    name: 'Nasdaq 100 Tech Index',
    category: 'Indices',
    decimals: 1,
    pipSize: 1.0,
    tickValuePerLot: 1,
    typicalSpread: 1.4,
    correlationGroup: 'US_EQUITIES',
    basePrice: 20940.0,
    volatility: 0.00155,
  },
  SPX500: {
    id: 'SPX500',
    name: 'S&P 500 Index',
    category: 'Indices',
    decimals: 1,
    pipSize: 0.1,
    tickValuePerLot: 5,
    typicalSpread: 0.5,
    correlationGroup: 'US_EQUITIES',
    basePrice: 5985.5,
    volatility: 0.00115,
  },
  BTCUSD: {
    id: 'BTCUSD',
    name: 'Bitcoin / US Dollar',
    category: 'Crypto',
    decimals: 1,
    pipSize: 1.0,
    tickValuePerLot: 1,
    typicalSpread: 18.0,
    correlationGroup: 'CRYPTO',
    basePrice: 91250.0,
    volatility: 0.0031,
  },
  ETHUSD: {
    id: 'ETHUSD',
    name: 'Ethereum / US Dollar',
    category: 'Crypto',
    decimals: 2,
    pipSize: 0.1,
    tickValuePerLot: 1,
    typicalSpread: 1.4,
    correlationGroup: 'CRYPTO',
    basePrice: 3180.0,
    volatility: 0.0036,
  },
  SOLUSD: {
    id: 'SOLUSD',
    name: 'Solana / US Dollar',
    category: 'Crypto',
    decimals: 2,
    pipSize: 0.01,
    tickValuePerLot: 1,
    typicalSpread: 0.12,
    correlationGroup: 'CRYPTO',
    basePrice: 215.4,
    volatility: 0.0044,
  },
  BNBUSD: {
    id: 'BNBUSD',
    name: 'BNB / US Dollar',
    category: 'Crypto',
    decimals: 2,
    pipSize: 0.1,
    tickValuePerLot: 1,
    typicalSpread: 0.45,
    correlationGroup: 'CRYPTO',
    basePrice: 628.5,
    volatility: 0.0032,
  },
  XRPUSD: {
    id: 'XRPUSD',
    name: 'XRP / US Dollar',
    category: 'Crypto',
    decimals: 4,
    pipSize: 0.0001,
    tickValuePerLot: 10,
    typicalSpread: 0.0012,
    correlationGroup: 'CRYPTO',
    basePrice: 0.885,
    volatility: 0.0042,
  },
};

export const SYMBOL_LIST = Object.keys(INSTRUMENTS) as SymbolId[];

// ── Market Hours Schedule (Crypto 24/7 Live · TradFi Closed Fri 22:00 – Sun 22:00 UTC) ──

export function isTradFiMarketOpen(nowMs = Date.now()): boolean {
  const d = new Date(nowMs);
  const day = d.getUTCDay(); // 0 = Sun, 5 = Fri, 6 = Sat
  const hour = d.getUTCHours() + d.getUTCMinutes() / 60;
  if (day === 6) return false; // Saturday UTC: always closed
  if (day === 5 && hour >= 22.0) return false; // Friday after NY close
  if (day === 0 && hour < 22.0) return false; // Sunday before Sydney/Globex open
  return true;
}

export function isMarketOpen(
  symbol: SymbolId,
  nowMs = Date.now()
): { open: boolean; reason: string; badge: string } {
  const meta = INSTRUMENTS[symbol];
  if (meta.category === 'Crypto') {
    return { open: true, reason: 'Crypto 24/7 Live Market', badge: '24/7 LIVE' };
  }
  if (!isTradFiMarketOpen(nowMs)) {
    return {
      open: false,
      reason: 'Market Closed (Weekend — Reopens Sun 22:00 UTC)',
      badge: 'MARKET CLOSED',
    };
  }
  return { open: true, reason: 'Active Institutional Session', badge: 'LIVE' };
}

export function getTradFiCloseTimestampSec(nowMs = Date.now()): number {
  const nowSec = Math.floor(nowMs / 1000);
  const alignedNow = nowSec - (nowSec % 900);
  if (isTradFiMarketOpen(nowMs)) return alignedNow;

  const d = new Date(nowMs);
  const day = d.getUTCDay();
  let daysBack = 0;
  if (day === 6) daysBack = 1;
  else if (day === 0) daysBack = 2;
  else if (day === 5) daysBack = 0;

  const friCloseMs = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() - daysBack,
    21,
    45,
    0
  );
  return Math.floor(friCloseMs / 1000);
}

export function sanitizeAndSortCandles(candles: Candle[]): Candle[] {
  const map = new Map<number, Candle>();
  for (const c of candles) {
    if (!c || !Number.isFinite(c.time) || !Number.isFinite(c.open) || !Number.isFinite(c.close)) continue;
    map.set(c.time, c);
  }
  return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

// Deterministic pseudo-random generator for reproducible backtesting & correlated shocks
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussianFromRng(rng: () => number): number {
  const u1 = Math.max(1e-7, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export function classifySessionGmt(unixSec: number): Candle['session'] {
  const d = new Date(unixSec * 1000);
  const hour = d.getUTCHours() + d.getUTCMinutes() / 60;
  if (hour >= 0 && hour < 6.5) return 'ASIAN';
  if (hour >= 7 && hour <= 10.25) return 'LONDON';
  if (hour >= 12.5 && hour <= 15.5) return 'NEW_YORK';
  return 'OFF_PEAK';
}

function sessionVolMultiplier(session: Candle['session']): number {
  switch (session) {
    case 'ASIAN':
      return 0.48;
    case 'LONDON':
      return 1.38;
    case 'NEW_YORK':
      return 1.52;
    default:
      return 0.82;
  }
}

export interface MarketStore {
  m15: Record<SymbolId, Candle[]>;
  h4: Record<SymbolId, Candle[]>;
  benchmarks: Record<BenchmarkId, number[]>; // aligned 160 M15 close series
  benchmarkPrices: Record<BenchmarkId, number>;
  benchmarkChanges: Record<BenchmarkId, number>;
  lastUpdated: number;
}

export function generateInitialMarketStore(seedOffset = 42, barsM15 = 240): MarketStore {
  const rng = mulberry32(20261113 + seedOffset);

  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);
  const alignedCryptoEnd = nowSec - (nowSec % 900);
  const alignedTradFiEnd = getTradFiCloseTimestampSec(nowMs);

  // Generate shared macro latent factors (DXY factor, Yield factor, Risk-Appetite/VIX factor, Oil Supply factor)
  const dxyShocks: number[] = [];
  const yieldShocks: number[] = [];
  const riskShocks: number[] = [];
  const oilShocks: number[] = [];

  for (let i = 0; i < barsM15; i++) {
    // Include smooth trend waves + sudden institutional impulse legs so BOS/CHoCH, FVG, and Fib OTE appear organically
    const wave1 = Math.sin(i / 22) * 0.14;
    const wave2 = Math.cos(i / 38) * 0.11;
    const impulse = i === 185 || i === 186 ? -0.95 : i === 212 || i === 213 ? 0.65 : 0;
    dxyShocks.push(gaussianFromRng(rng) * 0.65 + wave1 * 0.2 + impulse * 0.45);
    yieldShocks.push(dxyShocks[i] * 0.55 + gaussianFromRng(rng) * 0.45 + wave2 * 0.15);
    riskShocks.push(-dxyShocks[i] * 0.35 - yieldShocks[i] * 0.3 + gaussianFromRng(rng) * 0.65);
    oilShocks.push(riskShocks[i] * 0.4 + gaussianFromRng(rng) * 0.72);
  }

  // Factor loadings per symbol [dxy, yield, risk, oil, idio]
  const loadings: Record<SymbolId, [number, number, number, number, number]> = {
    EURUSD: [-0.82, -0.2, 0.22, 0.05, 0.32],
    GBPUSD: [-0.74, -0.18, 0.28, 0.06, 0.38],
    USDJPY: [0.68, 0.58, 0.25, 0.0, 0.35],
    USDCAD: [0.62, 0.15, -0.2, -0.68, 0.32],
    XAUUSD: [-0.78, -0.45, -0.25, 0.15, 0.42],
    XAGUSD: [-0.72, -0.38, -0.15, 0.18, 0.48],
    USOIL: [-0.25, 0.05, 0.45, 0.85, 0.35],
    UKOIL: [-0.24, 0.04, 0.43, 0.83, 0.36],
    US30: [-0.28, -0.32, 0.82, 0.1, 0.35],
    NAS100: [-0.35, -0.58, 0.86, 0.05, 0.38],
    SPX500: [-0.32, -0.46, 0.88, 0.08, 0.28],
    BTCUSD: [-0.3, -0.36, 0.78, 0.06, 0.62],
    ETHUSD: [-0.28, -0.34, 0.76, 0.05, 0.68],
    SOLUSD: [-0.24, -0.28, 0.72, 0.04, 0.78],
    BNBUSD: [-0.22, -0.25, 0.68, 0.04, 0.58],
    XRPUSD: [-0.2, -0.22, 0.62, 0.03, 0.75],
  };

  const m15 = {} as Record<SymbolId, Candle[]>;
  const h4 = {} as Record<SymbolId, Candle[]>;

  for (const sym of SYMBOL_LIST) {
    const meta = INSTRUMENTS[sym];
    const [wDxy, wYld, wRsk, wOil, wIdio] = loadings[sym];
    const candles: Candle[] = [];
    let price = meta.basePrice * (0.992 + rng() * 0.008);
    const symEndSec = meta.category === 'Crypto' ? alignedCryptoEnd : alignedTradFiEnd;
    const symStartSec = symEndSec - (barsM15 - 1) * 900;

    // Build stylized institutional price action: range -> sweep -> impulse (FVG/BOS) -> OTE pullback -> continuation
    for (let i = 0; i < barsM15; i++) {
      const time = symStartSec + i * 900;
      const session = classifySessionGmt(time);
      const sessMult = sessionVolMultiplier(session);

      const macroDrive =
        wDxy * dxyShocks[i] +
        wYld * yieldShocks[i] +
        wRsk * riskShocks[i] +
        wOil * oilShocks[i] +
        wIdio * gaussianFromRng(rng);

      // Add subtle institutional swing choreography in the last 45 candles so Auto-Fib OTE & SMC triggers are crisp
      let choreo = 0;
      const tail = barsM15 - 1 - i; // 0 is latest bar
      if (tail <= 44 && tail >= 28) {
        // Leg 1: accumulation / base
        choreo = (rng() - 0.52) * 0.35;
      } else if (tail < 28 && tail >= 14) {
        // Leg 2: strong displacement impulse (creates BOS + FVG + Swing)
        const dir = sym === 'USDJPY' || sym === 'USDCAD' ? -1 : 1;
        choreo = dir * (0.65 + rng() * 0.45);
      } else if (tail < 14 && tail >= 3) {
        // Leg 3: controlled pullback into 0.618 - 0.786 OTE zone
        const dir = sym === 'USDJPY' || sym === 'USDCAD' ? 1 : -1;
        choreo = dir * (0.38 + rng() * 0.22);
      } else if (tail < 3) {
        // Leg 4: candle confirmation bounce out of OTE
        const dir = sym === 'USDJPY' || sym === 'USDCAD' ? -1 : 1;
        choreo = dir * (0.42 + rng() * 0.3);
      }

      const ret = (macroDrive * 0.55 + choreo * 0.85) * meta.volatility * sessMult;
      const open = price;
      const close = Math.max(meta.pipSize * 10, open * (1 + ret));
      const body = Math.abs(close - open);
      const wickScale = Math.max(open * meta.volatility * sessMult * 0.55, body * 0.45);
      const high = Math.max(open, close) + rng() * wickScale;
      const low = Math.min(open, close) - rng() * wickScale;
      const baseVol = session === 'ASIAN' ? 680 : session === 'LONDON' ? 1850 : session === 'NEW_YORK' ? 2150 : 950;
      const volume = Math.round(baseVol * (0.7 + rng() * 0.85) * (1 + Math.min(2.5, Math.abs(ret) / meta.volatility)));

      candles.push({
        time,
        open: roundTo(open, meta.decimals),
        high: roundTo(high, meta.decimals),
        low: roundTo(low, meta.decimals),
        close: roundTo(close, meta.decimals),
        volume,
        session,
      });
      price = close;
    }

    m15[sym] = candles;
    h4[sym] = synthesizeH4FromM15(candles, meta, rng);
  }

  // Generate aligned benchmark series for DXY, US10Y, VIX plus mirrors of major symbols
  const dxySeries: number[] = [];
  const us10ySeries: number[] = [];
  const vixSeries: number[] = [];
  let dxy = 104.2;
  let us10y = 4.38;
  let vix = 15.8;

  for (let i = 0; i < barsM15; i++) {
    dxy = Math.max(98, dxy * (1 + dxyShocks[i] * 0.00075));
    us10y = Math.max(3.1, us10y * (1 + yieldShocks[i] * 0.0014));
    vix = Math.max(10.5, vix * (1 - riskShocks[i] * 0.0038));
    dxySeries.push(roundTo(dxy, 3));
    us10ySeries.push(roundTo(us10y, 3));
    vixSeries.push(roundTo(vix, 2));
  }

  const tailLen = 90;
  const benchmarks: Record<BenchmarkId, number[]> = {
    DXY: dxySeries.slice(-tailLen),
    US10Y: us10ySeries.slice(-tailLen),
    VIX: vixSeries.slice(-tailLen),
    USOIL: m15.USOIL.slice(-tailLen).map((c) => c.close),
    XAUUSD: m15.XAUUSD.slice(-tailLen).map((c) => c.close),
    EURUSD: m15.EURUSD.slice(-tailLen).map((c) => c.close),
    GBPUSD: m15.GBPUSD.slice(-tailLen).map((c) => c.close),
    USDCAD: m15.USDCAD.slice(-tailLen).map((c) => c.close),
    NAS100: m15.NAS100.slice(-tailLen).map((c) => c.close),
    US30: m15.US30.slice(-tailLen).map((c) => c.close),
    BTCUSD: m15.BTCUSD.slice(-tailLen).map((c) => c.close),
  };

  const benchmarkPrices = {} as Record<BenchmarkId, number>;
  const benchmarkChanges = {} as Record<BenchmarkId, number>;
  (Object.keys(benchmarks) as BenchmarkId[]).forEach((b) => {
    const arr = benchmarks[b];
    const first = arr[0];
    const last = arr[arr.length - 1];
    benchmarkPrices[b] = last;
    benchmarkChanges[b] = roundTo(((last - first) / first) * 100, 2);
  });

  return {
    m15,
    h4,
    benchmarks,
    benchmarkPrices,
    benchmarkChanges,
    lastUpdated: Date.now(),
  };
}

function synthesizeH4FromM15(m15: Candle[], meta: InstrumentMeta, rng: () => number): Candle[] {
  // Build 120 H4 bars leading smoothly into the M15 window so EMA 50/200 on H4 has ample history
  const h4Candles: Candle[] = [];
  const prefixCount = 105;
  const firstM15 = m15[0];
  let price = firstM15.open * (0.978 + rng() * 0.02);
  const startH4 = firstM15.time - prefixCount * 14400;

  for (let i = 0; i < prefixCount; i++) {
    const time = startH4 + i * 14400;
    const drift = (firstM15.open - price) / Math.max(1, prefixCount - i) * 0.45;
    const shock = gaussianFromRng(rng) * price * meta.volatility * 2.4;
    const open = price;
    const close = Math.max(meta.pipSize * 10, open + drift + shock);
    const high = Math.max(open, close) + Math.abs(shock) * (0.3 + rng() * 0.7);
    const low = Math.min(open, close) - Math.abs(shock) * (0.3 + rng() * 0.7);
    h4Candles.push({
      time,
      open: roundTo(open, meta.decimals),
      high: roundTo(high, meta.decimals),
      low: roundTo(low, meta.decimals),
      close: roundTo(close, meta.decimals),
      volume: Math.round(14000 + rng() * 12000),
      session: classifySessionGmt(time),
    });
    price = close;
  }

  // Aggregate M15 candles in chunks of 16 into final H4 bars
  for (let i = 0; i < m15.length; i += 16) {
    const chunk = m15.slice(i, i + 16);
    if (chunk.length === 0) continue;
    const open = chunk[0].open;
    const close = chunk[chunk.length - 1].close;
    const high = Math.max(...chunk.map((c) => c.high));
    const low = Math.min(...chunk.map((c) => c.low));
    const volume = chunk.reduce((acc, c) => acc + c.volume, 0);
    h4Candles.push({
      time: chunk[0].time,
      open,
      high,
      low,
      close,
      volume,
      session: chunk[0].session,
    });
  }

  return h4Candles;
}

export function stepMarketStore(store: MarketStore): MarketStore {
  // Advance latest candle or roll a new 15m candle with correlated macro factor shock
  const dxyShock = (Math.random() - 0.5) * 0.0014;
  const yieldShock = dxyShock * 0.7 + (Math.random() - 0.5) * 0.0012;
  const riskShock = -dxyShock * 0.55 + (Math.random() - 0.5) * 0.0018;
  const oilShock = riskShock * 0.45 + (Math.random() - 0.5) * 0.0022;

  const nextM15 = { ...store.m15 };
  const nextH4 = { ...store.h4 };
  const nextBenchmarks = { ...store.benchmarks };

  const factorMap: Record<SymbolId, number> = {
    EURUSD: -dxyShock * 0.85 + (Math.random() - 0.5) * 0.0006,
    GBPUSD: -dxyShock * 0.78 + (Math.random() - 0.5) * 0.00075,
    USDJPY: dxyShock * 0.72 + yieldShock * 0.45 + (Math.random() - 0.5) * 0.0007,
    USDCAD: dxyShock * 0.62 - oilShock * 0.55 + (Math.random() - 0.5) * 0.00055,
    XAUUSD: -dxyShock * 0.82 - yieldShock * 0.35 + (Math.random() - 0.5) * 0.0014,
    XAGUSD: -dxyShock * 0.76 - yieldShock * 0.25 + (Math.random() - 0.5) * 0.0018,
    USOIL: oilShock * 0.95 + (Math.random() - 0.5) * 0.0012,
    UKOIL: oilShock * 0.92 + (Math.random() - 0.5) * 0.0012,
    US30: riskShock * 0.82 + (Math.random() - 0.5) * 0.0009,
    NAS100: riskShock * 0.96 - yieldShock * 0.35 + (Math.random() - 0.5) * 0.0013,
    SPX500: riskShock * 0.88 - yieldShock * 0.2 + (Math.random() - 0.5) * 0.001,
    BTCUSD: riskShock * 0.95 + (Math.random() - 0.5) * 0.0028,
    ETHUSD: riskShock * 1.02 + (Math.random() - 0.5) * 0.0034,
    SOLUSD: riskShock * 1.15 + (Math.random() - 0.5) * 0.0042,
    BNBUSD: riskShock * 0.85 + (Math.random() - 0.5) * 0.0026,
    XRPUSD: riskShock * 0.9 + (Math.random() - 0.5) * 0.0038,
  };

  for (const sym of SYMBOL_LIST) {
    const meta = INSTRUMENTS[sym];
    const arr = [...store.m15[sym]];
    const last = arr[arr.length - 1];
    const newClose = roundTo(Math.max(meta.pipSize * 10, last.close * (1 + factorMap[sym])), meta.decimals);
    const nextBar: Candle = {
      time: last.time + 900,
      open: last.close,
      high: roundTo(Math.max(last.close, newClose) + Math.abs(newClose - last.close) * (0.2 + Math.random() * 0.5), meta.decimals),
      low: roundTo(Math.min(last.close, newClose) - Math.abs(newClose - last.close) * (0.2 + Math.random() * 0.5), meta.decimals),
      close: newClose,
      volume: Math.round(last.volume * (0.85 + Math.random() * 0.35)),
      session: classifySessionGmt(last.time + 900),
    };
    arr.shift();
    arr.push(nextBar);
    nextM15[sym] = arr;

    const h4Arr = [...store.h4[sym]];
    const lastH4 = { ...h4Arr[h4Arr.length - 1] };
    lastH4.close = newClose;
    lastH4.high = Math.max(lastH4.high, nextBar.high);
    lastH4.low = Math.min(lastH4.low, nextBar.low);
    lastH4.volume += nextBar.volume;
    h4Arr[h4Arr.length - 1] = lastH4;
    nextH4[sym] = h4Arr;
  }

  const updateBench = (id: BenchmarkId, nextVal: number, dec: number) => {
    const arr = [...store.benchmarks[id]];
    arr.shift();
    arr.push(roundTo(nextVal, dec));
    nextBenchmarks[id] = arr;
  };

  const prevDxy = store.benchmarkPrices.DXY;
  const prev10y = store.benchmarkPrices.US10Y;
  const prevVix = store.benchmarkPrices.VIX;
  updateBench('DXY', prevDxy * (1 + dxyShock), 3);
  updateBench('US10Y', prev10y * (1 + yieldShock), 3);
  updateBench('VIX', prevVix * (1 - riskShock * 1.4), 2);
  updateBench('USOIL', nextM15.USOIL[nextM15.USOIL.length - 1].close, 2);
  updateBench('XAUUSD', nextM15.XAUUSD[nextM15.XAUUSD.length - 1].close, 2);
  updateBench('EURUSD', nextM15.EURUSD[nextM15.EURUSD.length - 1].close, 5);
  updateBench('GBPUSD', nextM15.GBPUSD[nextM15.GBPUSD.length - 1].close, 5);
  updateBench('USDCAD', nextM15.USDCAD[nextM15.USDCAD.length - 1].close, 5);
  updateBench('NAS100', nextM15.NAS100[nextM15.NAS100.length - 1].close, 1);
  updateBench('US30', nextM15.US30[nextM15.US30.length - 1].close, 1);
  updateBench('BTCUSD', nextM15.BTCUSD[nextM15.BTCUSD.length - 1].close, 1);

  const benchmarkPrices = {} as Record<BenchmarkId, number>;
  const benchmarkChanges = {} as Record<BenchmarkId, number>;
  (Object.keys(nextBenchmarks) as BenchmarkId[]).forEach((b) => {
    const arr = nextBenchmarks[b];
    benchmarkPrices[b] = arr[arr.length - 1];
    benchmarkChanges[b] = roundTo(((arr[arr.length - 1] - arr[0]) / arr[0]) * 100, 2);
  });

  return {
    m15: nextM15,
    h4: nextH4,
    benchmarks: nextBenchmarks,
    benchmarkPrices,
    benchmarkChanges,
    lastUpdated: Date.now(),
  };
}

export function getInstitutionalSentiment(symbol: SymbolId, h4Trend: 'LONG' | 'SHORT' | 'RANGING'): SentimentData {
  // Grounded deterministic COT + Retail sentiment profile derived from symbol + structural positioning
  const baseProfiles: Record<SymbolId, { cotLong: number; retailLong: number; net: number; wkChg: number }> = {
    EURUSD: { cotLong: 61, retailLong: 34, net: 48200, wkChg: 6400 },
    GBPUSD: { cotLong: 58, retailLong: 38, net: 29400, wkChg: 3100 },
    USDJPY: { cotLong: 39, retailLong: 71, net: -41500, wkChg: -5200 },
    USDCAD: { cotLong: 43, retailLong: 67, net: -19800, wkChg: -2800 },
    XAUUSD: { cotLong: 72, retailLong: 31, net: 214500, wkChg: 14200 },
    XAGUSD: { cotLong: 66, retailLong: 41, net: 46800, wkChg: 4100 },
    USOIL: { cotLong: 64, retailLong: 42, net: 189300, wkChg: 8700 },
    UKOIL: { cotLong: 62, retailLong: 44, net: 142000, wkChg: 5600 },
    US30: { cotLong: 65, retailLong: 36, net: 31200, wkChg: 2950 },
    NAS100: { cotLong: 69, retailLong: 29, net: 54800, wkChg: 6100 },
    SPX500: { cotLong: 67, retailLong: 33, net: 88400, wkChg: 7400 },
    BTCUSD: { cotLong: 71, retailLong: 35, net: 38600, wkChg: 5400 },
    ETHUSD: { cotLong: 66, retailLong: 42, net: 24100, wkChg: 3100 },
    SOLUSD: { cotLong: 68, retailLong: 39, net: 18400, wkChg: 2800 },
    BNBUSD: { cotLong: 60, retailLong: 46, net: 9600, wkChg: 1150 },
    XRPUSD: { cotLong: 56, retailLong: 64, net: -8200, wkChg: -1400 },
  };
  const p = baseProfiles[symbol];
  const trendAdj = h4Trend === 'LONG' ? 4 : h4Trend === 'SHORT' ? -6 : 0;
  const cotLong = Math.min(82, Math.max(22, p.cotLong + trendAdj));
  const retailLong = Math.min(80, Math.max(20, p.retailLong - trendAdj));

  let contrarianSignal: SentimentData['contrarianSignal'] = 'NEUTRAL';
  if (retailLong >= 62) contrarianSignal = 'SHORT';
  else if (retailLong <= 38) contrarianSignal = 'LONG';

  return {
    symbol,
    cotInstitutionalLongPct: cotLong,
    cotInstitutionalShortPct: 100 - cotLong,
    cotNetContracts: p.net,
    cotWeeklyChange: p.wkChg,
    retailLongPct: retailLong,
    retailShortPct: 100 - retailLong,
    contrarianSignal,
  };
}

const ALL_USD_MACRO_SYMBOLS: SymbolId[] = [
  'EURUSD',
  'GBPUSD',
  'USDJPY',
  'USDCAD',
  'XAUUSD',
  'XAGUSD',
  'US30',
  'NAS100',
  'SPX500',
];

export function generateDailyNewsCalendar(): EconomicNewsEvent[] {
  const now = new Date();
  const nowMins = now.getUTCHours() * 60 + now.getUTCMinutes();

  const rawEvents: Omit<EconomicNewsEvent, 'minutesUntil' | 'inBlackout'>[] = [
    {
      id: 'ev-gbp-gdp',
      timeGmt: '07:00',
      currency: 'GBP',
      title: 'UK Monthly GDP & Manufacturing Production',
      impact: 'MEDIUM',
      affectedSymbols: ['GBPUSD', 'EURUSD'],
      schedule: 'Monthly',
      notes: 'Key UK growth gauge affecting GBP pairs during London Open.',
    },
    {
      id: 'ev-eur-cpi',
      timeGmt: '10:00',
      currency: 'EUR',
      title: 'Eurozone Core CPI Flash Estimate y/y',
      impact: 'HIGH',
      affectedSymbols: ['EURUSD', 'GBPUSD', 'XAUUSD'],
      schedule: 'Monthly',
      notes: 'Primary Eurozone inflation print driving ECB rate expectations.',
    },
    {
      id: 'ev-usd-adp',
      timeGmt: '13:15',
      currency: 'USD',
      title: 'US ADP Non-Farm Employment Change',
      impact: 'HIGH',
      affectedSymbols: ALL_USD_MACRO_SYMBOLS,
      schedule: 'Monthly (Wed before NFP)',
      notes: 'Private payrolls preview that triggers early USD and Gold volatility.',
    },
    {
      id: 'ev-usd-nfp',
      timeGmt: '13:30',
      currency: 'USD',
      title: 'US Non-Farm Payrolls (NFP), Unemployment Rate & Avg Hourly Earnings',
      impact: 'HIGH',
      affectedSymbols: ALL_USD_MACRO_SYMBOLS,
      schedule: '1st Friday Monthly',
      notes: 'Top US labor & wage report; causes sharp spikes across USD, Gold, and Indices.',
    },
    {
      id: 'ev-usd-cpi',
      timeGmt: '13:30',
      currency: 'USD',
      title: 'US Core CPI m/m & Headline Consumer Price Index y/y',
      impact: 'HIGH',
      affectedSymbols: ALL_USD_MACRO_SYMBOLS,
      schedule: 'Monthly',
      notes: 'Major US inflation catalyst directly repricing Treasury yields and DXY.',
    },
    {
      id: 'ev-usd-ppi',
      timeGmt: '13:30',
      currency: 'USD',
      title: 'US Core PPI m/m & Producer Price Index',
      impact: 'HIGH',
      affectedSymbols: ALL_USD_MACRO_SYMBOLS,
      schedule: 'Monthly',
      notes: 'Wholesale inflation gauge signaling upstream CPI & Fed policy pressure.',
    },
    {
      id: 'ev-usd-pce',
      timeGmt: '13:30',
      currency: 'USD',
      title: 'US Core PCE Price Index m/m (Fed Preferred Inflation)',
      impact: 'HIGH',
      affectedSymbols: ALL_USD_MACRO_SYMBOLS,
      schedule: 'Monthly',
      notes: 'Federal Reserve’s primary inflation benchmark driving rate-cut/hike odds.',
    },
    {
      id: 'ev-usd-gdp',
      timeGmt: '13:30',
      currency: 'USD',
      title: 'US Advance / Final GDP q/q & GDP Price Index',
      impact: 'HIGH',
      affectedSymbols: ALL_USD_MACRO_SYMBOLS,
      schedule: 'Quarterly',
      notes: 'Broadest US economic output measure impacting Risk-On/Risk-Off flows.',
    },
    {
      id: 'ev-usd-retail',
      timeGmt: '13:30',
      currency: 'USD',
      title: 'US Core Retail Sales m/m & Advance Retail Sales',
      impact: 'HIGH',
      affectedSymbols: ALL_USD_MACRO_SYMBOLS,
      schedule: 'Monthly',
      notes: 'Consumer spending pulse moving US30, NAS100, SPX500, and USD.',
    },
    {
      id: 'ev-usd-claims',
      timeGmt: '13:30',
      currency: 'USD',
      title: 'US Initial Jobless Claims (Weekly)',
      impact: 'HIGH',
      affectedSymbols: ALL_USD_MACRO_SYMBOLS,
      schedule: 'Weekly (Every Thursday)',
      notes: 'High-frequency labor market health check during NY pre-market.',
    },
    {
      id: 'ev-usd-durable',
      timeGmt: '13:30',
      currency: 'USD',
      title: 'US Core Durable Goods Orders m/m',
      impact: 'MEDIUM',
      affectedSymbols: ['USDJPY', 'EURUSD', 'XAUUSD', 'US30', 'NAS100', 'SPX500'],
      schedule: 'Monthly',
      notes: 'Tracks US industrial & business capital expenditure momentum.',
    },
    {
      id: 'ev-cad-emp',
      timeGmt: '13:30',
      currency: 'CAD',
      title: 'Canada Employment Change & Ivey PMI',
      impact: 'HIGH',
      affectedSymbols: ['USDCAD', 'USOIL'],
      schedule: 'Monthly',
      notes: 'Drives sharp USDCAD volatility alongside US data.',
    },
    {
      id: 'ev-usd-sp-pmi',
      timeGmt: '14:45',
      currency: 'USD',
      title: 'US S&P Global Flash Manufacturing & Services PMI',
      impact: 'MEDIUM',
      affectedSymbols: ALL_USD_MACRO_SYMBOLS,
      schedule: 'Monthly',
      notes: 'Early private-sector business activity reading shortly after NY cash open.',
    },
    {
      id: 'ev-usd-ism-mfg',
      timeGmt: '15:00',
      currency: 'USD',
      title: 'US ISM Manufacturing PMI & ISM Prices Paid',
      impact: 'HIGH',
      affectedSymbols: ALL_USD_MACRO_SYMBOLS,
      schedule: '1st Business Day Monthly',
      notes: 'Institutional tier-1 manufacturing & inflation survey.',
    },
    {
      id: 'ev-usd-ism-svc',
      timeGmt: '15:00',
      currency: 'USD',
      title: 'US ISM Services (Non-Manufacturing) PMI',
      impact: 'HIGH',
      affectedSymbols: ALL_USD_MACRO_SYMBOLS,
      schedule: 'Monthly',
      notes: 'Covers ~70% of US economy; major NY session trend driver.',
    },
    {
      id: 'ev-usd-jolts',
      timeGmt: '15:00',
      currency: 'USD',
      title: 'US JOLTS Job Openings & CB Consumer Confidence',
      impact: 'HIGH',
      affectedSymbols: ALL_USD_MACRO_SYMBOLS,
      schedule: 'Monthly',
      notes: 'Labor demand & household optimism monitored closely by Fed officials.',
    },
    {
      id: 'ev-usd-uom',
      timeGmt: '15:00',
      currency: 'USD',
      title: 'US Prelim UoM Consumer Sentiment & Inflation Expectations',
      impact: 'MEDIUM',
      affectedSymbols: ['EURUSD', 'USDJPY', 'XAUUSD', 'US30', 'NAS100', 'SPX500'],
      schedule: 'Bi-Monthly (Friday)',
      notes: 'Consumer 1Y/5Y inflation expectations closely watched by bond desks.',
    },
    {
      id: 'ev-oil-inv',
      timeGmt: '15:30',
      currency: 'USD',
      title: 'US EIA Crude Oil Inventories & Cushing Stocks',
      impact: 'MEDIUM',
      affectedSymbols: ['USOIL', 'UKOIL', 'USDCAD'],
      schedule: 'Weekly (Every Wednesday)',
      notes: 'Primary weekly supply shock catalyst for WTI, Brent, and CAD.',
    },
    {
      id: 'ev-usd-fomc',
      timeGmt: '19:00',
      currency: 'USD',
      title: 'FOMC Federal Funds Rate Decision, Statement & Dot Plot',
      impact: 'HIGH',
      affectedSymbols: ALL_USD_MACRO_SYMBOLS,
      schedule: '8x Yearly (FOMC)',
      notes: 'Highest-impact US monetary policy event; triggers maximum blackout protection.',
    },
    {
      id: 'ev-usd-fomc-minutes',
      timeGmt: '19:00',
      currency: 'USD',
      title: 'FOMC Meeting Minutes Release',
      impact: 'HIGH',
      affectedSymbols: ALL_USD_MACRO_SYMBOLS,
      schedule: '3 Weeks Post-FOMC',
      notes: 'Reveals Fed voting split and internal rate path debate.',
    },
    {
      id: 'ev-usd-powell',
      timeGmt: '19:30',
      currency: 'USD',
      title: 'Fed Chair Powell Press Conference & Guidance',
      impact: 'HIGH',
      affectedSymbols: ALL_USD_MACRO_SYMBOLS,
      schedule: 'FOMC Days',
      notes: 'Live Q&A often reverses initial statement spikes across DXY, Gold, and Nasdaq.',
    },
  ];

  const dayOfWeek = now.getUTCDay();
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

  return rawEvents
    .map((ev) => {
      const [hh, mm] = ev.timeGmt.split(':').map(Number);
      const evMins = hh * 60 + mm;
      const diff = evMins - nowMins;
      const inBlackout = isWeekday && ev.impact === 'HIGH' && Math.abs(diff) <= 30;
      return {
        ...ev,
        minutesUntil: diff,
        inBlackout,
      };
    })
    .sort((a, b) => a.timeGmt.localeCompare(b.timeGmt));
}

export function roundTo(val: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(val * f) / f;
}

export interface SessionWindowBox {
  session: 'ASIAN' | 'LONDON' | 'NEW_YORK';
  label: string;
  startIndex: number;
  endIndex: number;
  high: number;
  low: number;
}

export function getActiveSessionsGmt(unixSec?: number): {
  gmtTimeLabel: string;
  asian: boolean;
  london: boolean;
  newYork: boolean;
  overlap: boolean;
  primaryLabel: string;
} {
  const d = unixSec ? new Date(unixSec * 1000) : new Date();
  const h = d.getUTCHours() + d.getUTCMinutes() / 60;
  const asian = h >= 0 && h < 6.5;
  const london = h >= 7 && h < 16;
  const newYork = h >= 12.5 && h < 21;
  const overlap = london && newYork;
  const active: string[] = [];
  if (asian) active.push('Asian');
  if (london) active.push('London');
  if (newYork) active.push('New York');
  const gmtTimeLabel = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} GMT`;
  return {
    gmtTimeLabel,
    asian,
    london,
    newYork,
    overlap,
    primaryLabel: overlap ? 'London / NY Overlap' : active.length > 0 ? active.join(' + ') : 'Off-Peak Rollover',
  };
}

export function getCandleCountdownLabel(timeframe: Timeframe, nowMs = Date.now()): string {
  const stepSec = TIMEFRAME_SECONDS[timeframe];
  const nowSec = Math.floor(nowMs / 1000);
  const rem = Math.max(0, stepSec - (nowSec % stepSec));

  if (stepSec <= 3600) {
    const mm = String(Math.floor(rem / 60)).padStart(2, '0');
    const ss = String(rem % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }
  if (stepSec <= 86400) {
    const hh = String(Math.floor(rem / 3600)).padStart(2, '0');
    const mm = String(Math.floor((rem % 3600) / 60)).padStart(2, '0');
    const ss = String(rem % 60).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  const days = Math.floor(rem / 86400);
  const hrs = Math.floor((rem % 86400) / 3600);
  return `${days}d ${String(hrs).padStart(2, '0')}h`;
}

export function getLiveSessionOverlayInfo(nowMs = Date.now()): {
  gmtClock: string;
  localClock: string;
  asian: boolean;
  london: boolean;
  newYork: boolean;
  overlap: boolean;
  activeLabel: string;
  nextTransition: string;
  sessionProgressPct: number;
} {
  const d = new Date(nowMs);
  const totalMins = d.getUTCHours() * 60 + d.getUTCMinutes();
  const h = totalMins / 60;

  const asian = h >= 0 && h < 6.5;
  const london = h >= 7 && h < 16;
  const newYork = h >= 12.5 && h < 21;
  const overlap = london && newYork;

  const gmtClock = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(
    d.getUTCSeconds()
  ).padStart(2, '0')} GMT`;
  const localClock = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} LOC`;

  const fmtDur = (mins: number) => {
    const m = Math.max(0, Math.round(mins));
    const hh = Math.floor(m / 60);
    const mm = m % 60;
    return hh > 0 ? `${hh}h ${String(mm).padStart(2, '0')}m` : `${mm}m`;
  };

  let activeLabel = 'Rollover Quiet';
  let nextTransition = `Asian opens in ${fmtDur(1440 - totalMins)}`;
  let sessionProgressPct = 0;

  if (overlap) {
    activeLabel = 'LDN + NY Overlap';
    nextTransition = `LDN closes in ${fmtDur(16 * 60 - totalMins)}`;
    sessionProgressPct = Math.round(((totalMins - 12.5 * 60) / (3.5 * 60)) * 100);
  } else if (london) {
    activeLabel = 'London Session';
    nextTransition = `NY opens in ${fmtDur(12.5 * 60 - totalMins)}`;
    sessionProgressPct = Math.round(((totalMins - 7 * 60) / (9 * 60)) * 100);
  } else if (newYork) {
    activeLabel = 'New York Session';
    nextTransition = `NY closes in ${fmtDur(21 * 60 - totalMins)}`;
    sessionProgressPct = Math.round(((totalMins - 12.5 * 60) / (8.5 * 60)) * 100);
  } else if (asian) {
    activeLabel = 'Asian Range';
    nextTransition = `London opens in ${fmtDur(7 * 60 - totalMins)}`;
    sessionProgressPct = Math.round((totalMins / (6.5 * 60)) * 100);
  } else if (h >= 6.5 && h < 7) {
    activeLabel = 'Pre-London';
    nextTransition = `London opens in ${fmtDur(7 * 60 - totalMins)}`;
    sessionProgressPct = Math.round(((totalMins - 6.5 * 60) / 30) * 100);
  } else {
    activeLabel = 'After-Hours';
    nextTransition = `Asian opens in ${fmtDur(1440 - totalMins)}`;
    sessionProgressPct = Math.round(((totalMins - 21 * 60) / (3 * 60)) * 100);
  }

  return {
    gmtClock,
    localClock,
    asian,
    london,
    newYork,
    overlap,
    activeLabel,
    nextTransition,
    sessionProgressPct: Math.max(0, Math.min(100, sessionProgressPct)),
  };
}

export function extractSessionWindows(
  candles: Candle[],
  timeframe: Timeframe = '15m'
): SessionWindowBox[] {
  const boxes: SessionWindowBox[] = [];
  if (candles.length < 2) return boxes;

  const barHours = TIMEFRAME_SECONDS[timeframe] / 3600;
  // Daily/Weekly/Monthly candles span >= 24h so intraday session shading is suppressed on macro HTFs
  if (barHours >= 24) return boxes;

  const specs: Array<{
    session: 'ASIAN' | 'LONDON' | 'NEW_YORK';
    label: string;
    startHour: number;
    endHour: number;
  }> = [
    { session: 'ASIAN', label: 'Asian', startHour: 0, endHour: 6.5 },
    { session: 'LONDON', label: 'London', startHour: 7, endHour: 16 },
    { session: 'NEW_YORK', label: 'New York', startHour: 12.5, endHour: 21 },
  ];

  // Group candle indices per UTC day + session spec so overlapping London/NY ranges stay intact
  const dayBuckets = new Map<
    string,
    { session: 'ASIAN' | 'LONDON' | 'NEW_YORK'; label: string; indices: number[] }
  >();

  for (let i = 0; i < candles.length; i++) {
    const d = new Date(candles[i].time * 1000);
    const dayKey = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
    const hStart = d.getUTCHours() + d.getUTCMinutes() / 60;
    const hEnd = hStart + Math.min(barHours, 12);

    for (const sp of specs) {
      // Overlap check between candle [hStart, hEnd) and session [sp.startHour, sp.endHour)
      const overlaps =
        barHours <= 1
          ? hStart >= sp.startHour && hStart < sp.endHour
          : Math.max(hStart, sp.startHour) < Math.min(hEnd, sp.endHour);

      if (overlaps) {
        const key = `${dayKey}_${sp.session}`;
        let entry = dayBuckets.get(key);
        if (!entry) {
          entry = { session: sp.session, label: sp.label, indices: [] };
          dayBuckets.set(key, entry);
        }
        entry.indices.push(i);
      }
    }
  }

  dayBuckets.forEach((entry) => {
    if (entry.indices.length < 1) return;
    const startIndex = entry.indices[0];
    const endIndex = entry.indices[entry.indices.length - 1];
    let high = -Infinity;
    let low = Infinity;
    for (const idx of entry.indices) {
      if (candles[idx].high > high) high = candles[idx].high;
      if (candles[idx].low < low) low = candles[idx].low;
    }
    boxes.push({
      session: entry.session,
      label: entry.label,
      startIndex,
      endIndex,
      high,
      low,
    });
  });

  boxes.sort((a, b) => a.startIndex - b.startIndex);
  return boxes.slice(-96);
}

export function getTimeframeCandles(
  symbol: SymbolId,
  timeframe: Timeframe,
  store: MarketStore,
  count = 260
): Candle[] {
  if (timeframe === '15m') return sanitizeAndSortCandles(store.m15[symbol]);
  if (timeframe === '4h') return sanitizeAndSortCandles(store.h4[symbol]);

  const meta = INSTRUMENTS[symbol];
  const m15 = sanitizeAndSortCandles(store.m15[symbol]);
  const latestBar = m15[m15.length - 1];
  const liveClose = latestBar.close;
  const stepSec = TIMEFRAME_SECONDS[timeframe];

  // Scale volatility realistically with sqrt(time ratio relative to 15m)
  const volScale = Math.sqrt(stepSec / 900);
  const symHash = symbol.split('').reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7);
  const tfHash = timeframe.split('').reduce((acc, ch) => acc * 17 + ch.charCodeAt(0), 13);
  const rng = mulberry32(symHash + tfHash * 97);

  // Generate raw random walk backward from liveClose so final bar aligns seamlessly with live market price
  const rawCloses: number[] = new Array(count);
  rawCloses[count - 1] = liveClose;
  for (let i = count - 2; i >= 0; i--) {
    const wave = Math.sin(i / 18) * 0.18 + Math.cos(i / 31) * 0.12;
    const ret = (gaussianFromRng(rng) * 0.72 + wave * 0.35) * meta.volatility * volScale;
    rawCloses[i] = Math.max(meta.pipSize * 10, rawCloses[i + 1] / (1 + ret));
  }

  const alignedEnd = latestBar.time - (latestBar.time % Math.min(stepSec, 86400));
  const candles: Candle[] = [];

  for (let i = 0; i < count; i++) {
    const time = alignedEnd - (count - 1 - i) * stepSec;
    const open = i === 0 ? rawCloses[0] * (1 + (rng() - 0.5) * meta.volatility * volScale * 0.5) : rawCloses[i - 1];
    const close = rawCloses[i];
    const body = Math.abs(close - open);
    const wickBase = Math.max(close * meta.volatility * volScale * 0.45, body * 0.4);
    const high = Math.max(open, close) + rng() * wickBase;
    const low = Math.min(open, close) - rng() * wickBase;
    const session = classifySessionGmt(time);
    const baseVol = session === 'LONDON' || session === 'NEW_YORK' ? 1900 : 850;
    const volume = Math.round(baseVol * Math.max(0.25, Math.sqrt(stepSec / 900)) * (0.7 + rng() * 0.8));

    candles.push({
      time,
      open: roundTo(open, meta.decimals),
      high: roundTo(high, meta.decimals),
      low: roundTo(low, meta.decimals),
      close: roundTo(close, meta.decimals),
      volume,
      session,
    });
  }

  // Ensure exact match with live M15 latest candle close
  candles[candles.length - 1] = {
    ...candles[candles.length - 1],
    close: liveClose,
    high: Math.max(candles[candles.length - 1].high, liveClose),
    low: Math.min(candles[candles.length - 1].low, liveClose),
  };

  return candles;
}

export function applyLiveQuotesToStore(
  store: MarketStore,
  quotes: Record<string, number>
): MarketStore {
  const nowMs = Date.now();
  const tradFiOpen = isTradFiMarketOpen(nowMs);
  const nextM15 = { ...store.m15 };
  const nextH4 = { ...store.h4 };
  const nextBenchmarks = { ...store.benchmarks };

  for (const sym of SYMBOL_LIST) {
    const liveQ = quotes[sym];
    if (typeof liveQ !== 'number' || !Number.isFinite(liveQ) || liveQ <= 0) continue;
    const meta = INSTRUMENTS[sym];
    const symOpen = isMarketOpen(sym, nowMs).open;
    const m15Arr = [...store.m15[sym]];
    const lastM15 = m15Arr[m15Arr.length - 1];
    const ratio = liveQ / Math.max(1e-9, lastM15.close);

    if (Math.abs(ratio - 1) > 0.015) {
      // Initial calibration to real market settlement / spot level (works cleanly even on weekends)
      nextM15[sym] = m15Arr.map((c) => ({
        ...c,
        open: roundTo(c.open * ratio, meta.decimals),
        high: roundTo(c.high * ratio, meta.decimals),
        low: roundTo(c.low * ratio, meta.decimals),
        close: roundTo(c.close * ratio, meta.decimals),
      }));
      nextH4[sym] = store.h4[sym].map((c) => ({
        ...c,
        open: roundTo(c.open * ratio, meta.decimals),
        high: roundTo(c.high * ratio, meta.decimals),
        low: roundTo(c.low * ratio, meta.decimals),
        close: roundTo(c.close * ratio, meta.decimals),
      }));
    } else if (symOpen) {
      // Only mutate intraday highs/lows/closes when that market is actively open
      const updatedLast: Candle = {
        ...lastM15,
        close: roundTo(liveQ, meta.decimals),
        high: roundTo(Math.max(lastM15.high, liveQ), meta.decimals),
        low: roundTo(Math.min(lastM15.low, liveQ), meta.decimals),
      };
      m15Arr[m15Arr.length - 1] = updatedLast;
      nextM15[sym] = m15Arr;

      const h4Arr = [...store.h4[sym]];
      const lastH4 = h4Arr[h4Arr.length - 1];
      h4Arr[h4Arr.length - 1] = {
        ...lastH4,
        close: roundTo(liveQ, meta.decimals),
        high: roundTo(Math.max(lastH4.high, liveQ), meta.decimals),
        low: roundTo(Math.min(lastH4.low, liveQ), meta.decimals),
      };
      nextH4[sym] = h4Arr;
    }
  }

  // Update benchmark series with live quotes (respecting TradFi weekend close for non-Crypto)
  (
    ['DXY', 'US10Y', 'VIX', 'USOIL', 'XAUUSD', 'EURUSD', 'GBPUSD', 'USDCAD', 'NAS100', 'US30', 'BTCUSD'] as BenchmarkId[]
  ).forEach((b) => {
    const liveQ = quotes[b];
    const arr = [...nextBenchmarks[b]];
    if (typeof liveQ === 'number' && Number.isFinite(liveQ) && liveQ > 0) {
      const ratio = liveQ / Math.max(1e-9, arr[arr.length - 1]);
      if (Math.abs(ratio - 1) > 0.025) {
        const dec = b === 'EURUSD' || b === 'GBPUSD' || b === 'USDCAD' ? 5 : b === 'BTCUSD' || b === 'NAS100' || b === 'US30' ? 1 : 2;
        nextBenchmarks[b] = arr.map((v) => roundTo(v * ratio, dec));
      } else if (b === 'BTCUSD' || tradFiOpen) {
        arr[arr.length - 1] = liveQ;
        nextBenchmarks[b] = arr;
      }
    }
  });

  const benchmarkPrices = {} as Record<BenchmarkId, number>;
  const benchmarkChanges = {} as Record<BenchmarkId, number>;
  (Object.keys(nextBenchmarks) as BenchmarkId[]).forEach((b) => {
    const arr = nextBenchmarks[b];
    benchmarkPrices[b] = arr[arr.length - 1];
    benchmarkChanges[b] = roundTo(((arr[arr.length - 1] - arr[0]) / arr[0]) * 100, 2);
  });

  return {
    m15: nextM15,
    h4: nextH4,
    benchmarks: nextBenchmarks,
    benchmarkPrices,
    benchmarkChanges,
    lastUpdated: Date.now(),
  };
}

export function tickLiveCandle(store: MarketStore): MarketStore {
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);
  const currentBarTime = nowSec - (nowSec % 900);
  const tradFiOpen = isTradFiMarketOpen(nowMs);

  const dxyShock = tradFiOpen ? (Math.random() - 0.5) * 0.00045 : 0;
  const yieldShock = tradFiOpen ? dxyShock * 0.65 + (Math.random() - 0.5) * 0.0004 : 0;
  const riskShock = tradFiOpen ? -dxyShock * 0.5 + (Math.random() - 0.5) * 0.0006 : (Math.random() - 0.5) * 0.0008;
  const oilShock = tradFiOpen ? riskShock * 0.4 + (Math.random() - 0.5) * 0.0007 : 0;

  const factorMap: Record<SymbolId, number> = {
    EURUSD: -dxyShock * 0.85 + (Math.random() - 0.5) * 0.0002,
    GBPUSD: -dxyShock * 0.78 + (Math.random() - 0.5) * 0.00024,
    USDJPY: dxyShock * 0.72 + yieldShock * 0.45 + (Math.random() - 0.5) * 0.00022,
    USDCAD: dxyShock * 0.62 - oilShock * 0.55 + (Math.random() - 0.5) * 0.00018,
    XAUUSD: -dxyShock * 0.82 - yieldShock * 0.35 + (Math.random() - 0.5) * 0.00042,
    XAGUSD: -dxyShock * 0.76 - yieldShock * 0.25 + (Math.random() - 0.5) * 0.00055,
    USOIL: oilShock * 0.95 + (Math.random() - 0.5) * 0.00045,
    UKOIL: oilShock * 0.92 + (Math.random() - 0.5) * 0.00045,
    US30: riskShock * 0.82 + (Math.random() - 0.5) * 0.00032,
    NAS100: riskShock * 0.96 - yieldShock * 0.35 + (Math.random() - 0.5) * 0.00045,
    SPX500: riskShock * 0.88 - yieldShock * 0.2 + (Math.random() - 0.5) * 0.00035,
    BTCUSD: riskShock * 0.85 + (Math.random() - 0.5) * 0.0014,
    ETHUSD: riskShock * 0.92 + (Math.random() - 0.5) * 0.0017,
    SOLUSD: riskShock * 1.05 + (Math.random() - 0.5) * 0.0021,
    BNBUSD: riskShock * 0.8 + (Math.random() - 0.5) * 0.0014,
    XRPUSD: riskShock * 0.85 + (Math.random() - 0.5) * 0.002,
  };

  const nextM15 = { ...store.m15 };
  const nextH4 = { ...store.h4 };
  const nextBenchmarks = { ...store.benchmarks };

  for (const sym of SYMBOL_LIST) {
    // Market-Hours Filter: NEVER move TradFi candles when the market is closed (e.g. Saturday/Sunday)!
    if (!isMarketOpen(sym, nowMs).open) {
      continue;
    }

    const meta = INSTRUMENTS[sym];
    const arr = [...store.m15[sym]];
    const last = arr[arr.length - 1];
    const newClose = roundTo(Math.max(meta.pipSize * 10, last.close * (1 + factorMap[sym])), meta.decimals);

    if (currentBarTime > last.time) {
      arr.shift();
      arr.push({
        time: currentBarTime,
        open: last.close,
        high: Math.max(last.close, newClose),
        low: Math.min(last.close, newClose),
        close: newClose,
        volume: 280,
        session: classifySessionGmt(currentBarTime),
      });
    } else {
      arr[arr.length - 1] = {
        ...last,
        close: newClose,
        high: roundTo(Math.max(last.high, newClose), meta.decimals),
        low: roundTo(Math.min(last.low, newClose), meta.decimals),
        volume: last.volume + Math.round(15 + Math.random() * 40),
      };
    }
    nextM15[sym] = arr;

    const h4Arr = [...store.h4[sym]];
    const lastH4 = { ...h4Arr[h4Arr.length - 1] };
    lastH4.close = newClose;
    lastH4.high = Math.max(lastH4.high, newClose);
    lastH4.low = Math.min(lastH4.low, newClose);
    lastH4.volume += 25;
    h4Arr[h4Arr.length - 1] = lastH4;
    nextH4[sym] = h4Arr;
  }

  const updateTickBench = (id: BenchmarkId, val: number, dec: number) => {
    const arr = [...store.benchmarks[id]];
    arr[arr.length - 1] = roundTo(val, dec);
    nextBenchmarks[id] = arr;
  };
  if (tradFiOpen) {
    updateTickBench('DXY', store.benchmarkPrices.DXY * (1 + dxyShock), 3);
    updateTickBench('US10Y', store.benchmarkPrices.US10Y * (1 + yieldShock), 3);
    updateTickBench('VIX', store.benchmarkPrices.VIX * (1 - riskShock * 1.4), 2);
    updateTickBench('USOIL', nextM15.USOIL[nextM15.USOIL.length - 1].close, 2);
    updateTickBench('XAUUSD', nextM15.XAUUSD[nextM15.XAUUSD.length - 1].close, 2);
    updateTickBench('EURUSD', nextM15.EURUSD[nextM15.EURUSD.length - 1].close, 5);
    updateTickBench('GBPUSD', nextM15.GBPUSD[nextM15.GBPUSD.length - 1].close, 5);
    updateTickBench('USDCAD', nextM15.USDCAD[nextM15.USDCAD.length - 1].close, 5);
    updateTickBench('NAS100', nextM15.NAS100[nextM15.NAS100.length - 1].close, 1);
    updateTickBench('US30', nextM15.US30[nextM15.US30.length - 1].close, 1);
  }
  // Crypto 24/7 benchmark stays live
  updateTickBench('BTCUSD', nextM15.BTCUSD[nextM15.BTCUSD.length - 1].close, 1);

  const benchmarkPrices = {} as Record<BenchmarkId, number>;
  const benchmarkChanges = {} as Record<BenchmarkId, number>;
  (Object.keys(nextBenchmarks) as BenchmarkId[]).forEach((b) => {
    const arr = nextBenchmarks[b];
    benchmarkPrices[b] = arr[arr.length - 1];
    benchmarkChanges[b] = roundTo(((arr[arr.length - 1] - arr[0]) / arr[0]) * 100, 2);
  });

  return {
    m15: nextM15,
    h4: nextH4,
    benchmarks: nextBenchmarks,
    benchmarkPrices,
    benchmarkChanges,
    lastUpdated: Date.now(),
  };
}

export function generatePastBacktestCandles(
  symbol: SymbolId,
  timeframe: Timeframe,
  count = 420
): Candle[] {
  const meta = INSTRUMENTS[symbol];
  const stepSec = TIMEFRAME_SECONDS[timeframe];
  const volScale = Math.sqrt(stepSec / 900);
  const symHash = symbol.split('').reduce((acc, ch) => acc * 41 + ch.charCodeAt(0), 11);
  const tfHash = timeframe.split('').reduce((acc, ch) => acc * 23 + ch.charCodeAt(0), 19);
  const rng = mulberry32(19990101 + symHash + tfHash * 131);

  // Anchor deep past historical end 7 days prior to live market
  const nowSec = Math.floor(Date.now() / 1000);
  const pastEnd = nowSec - (nowSec % Math.min(stepSec, 86400)) - 7 * 86400;
  let price = meta.basePrice * (0.94 + rng() * 0.12);
  const candles: Candle[] = [];

  for (let i = 0; i < count; i++) {
    const time = pastEnd - (count - 1 - i) * stepSec;
    const cycle = Math.sin(i / 24) * 0.22 + Math.cos(i / 43) * 0.16;
    const ret = (gaussianFromRng(rng) * 0.78 + cycle * 0.35) * meta.volatility * volScale;
    const open = price;
    const close = Math.max(meta.pipSize * 10, open * (1 + ret));
    const body = Math.abs(close - open);
    const wick = Math.max(open * meta.volatility * volScale * 0.5, body * 0.42);
    const high = Math.max(open, close) + rng() * wick;
    const low = Math.min(open, close) - rng() * wick;
    const session = classifySessionGmt(time);
    const volume = Math.round((session === 'LONDON' || session === 'NEW_YORK' ? 2100 : 900) * (0.6 + rng() * 0.9));

    candles.push({
      time,
      open: roundTo(open, meta.decimals),
      high: roundTo(high, meta.decimals),
      low: roundTo(low, meta.decimals),
      close: roundTo(close, meta.decimals),
      volume,
      session,
    });
    price = close;
  }

  return candles;
}


