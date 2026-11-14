export type AssetCategory = 'Forex' | 'Metals' | 'Energy' | 'Indices' | 'Crypto';

export type SymbolId =
  | 'EURUSD'
  | 'GBPUSD'
  | 'USDJPY'
  | 'USDCAD'
  | 'XAUUSD'
  | 'XAGUSD'
  | 'USOIL'
  | 'UKOIL'
  | 'US30'
  | 'NAS100'
  | 'SPX500'
  | 'BTCUSD'
  | 'ETHUSD'
  | 'SOLUSD'
  | 'BNBUSD'
  | 'XRPUSD';

export type BenchmarkId =
  | 'DXY'
  | 'US10Y'
  | 'VIX'
  | 'USOIL'
  | 'XAUUSD'
  | 'EURUSD'
  | 'GBPUSD'
  | 'USDCAD'
  | 'NAS100'
  | 'US30'
  | 'BTCUSD';

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '12h' | '1D' | '1W' | '1M';

export type Direction = 'LONG' | 'SHORT';

export type StrategyId = 'trend_following' | 'session_breakout' | 'mean_reversion' | 'mtf_smc';

export interface Candle {
  time: number; // Unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  session: 'ASIAN' | 'LONDON' | 'NEW_YORK' | 'OFF_PEAK';
}

export interface InstrumentMeta {
  id: SymbolId;
  name: string;
  category: AssetCategory;
  decimals: number;
  pipSize: number;
  tickValuePerLot: number;
  typicalSpread: number; // in price units
  correlationGroup: string;
  basePrice: number;
  volatility: number;
}

export interface StructurePoint {
  index: number;
  time: number;
  price: number;
  type: 'SWING_HIGH' | 'SWING_LOW';
}

export interface StructureBreak {
  index: number;
  time: number;
  price: number;
  label: 'BOS' | 'CHoCH';
  direction: Direction;
  fromIndex: number;
}

export interface OrderBlock {
  id: string;
  startIndex: number;
  startTime: number;
  high: number;
  low: number;
  direction: Direction;
  mitigated: boolean;
  strength: number;
}

export interface FairValueGap {
  id: string;
  startIndex: number;
  startTime: number;
  top: number;
  bottom: number;
  direction: Direction;
  filled: boolean;
  fillPct: number;
}

export interface LiquiditySweep {
  index: number;
  time: number;
  price: number;
  type: 'BSL_SWEEP' | 'SSL_SWEEP'; // Buy-side or Sell-side liquidity
  label: string;
}

export interface Zone {
  id: string;
  top: number;
  bottom: number;
  kind: 'SUPPLY' | 'DEMAND' | 'SUPPORT' | 'RESISTANCE';
  touches: number;
  active: boolean;
}

export interface CandlePatternHit {
  index: number;
  time: number;
  name: 'Bullish Engulfing' | 'Bearish Engulfing' | 'Bullish Pin Bar' | 'Bearish Pin Bar' | 'Inside Bar' | 'Morning Star' | 'Evening Star';
  direction: Direction;
  atZone: boolean;
}

export interface FibLevel {
  ratio: number;
  label: string;
  price: number;
  isOTE: boolean;
}

export interface AutoFibSwing {
  direction: Direction; // LONG = retracing a bullish impulse (swingLow -> swingHigh); SHORT = retracing bearish impulse (swingHigh -> swingLow)
  anchorStartIndex: number;
  anchorEndIndex: number;
  anchorStartTime: number;
  anchorEndTime: number;
  swingHigh: number;
  swingLow: number;
  oteTop: number;
  oteBottom: number;
  currentRetracement: number;
  inOTE: boolean;
  invalidated?: boolean;
  levels: FibLevel[];
}

export interface VolumeProfileBucket {
  priceMid: number;
  priceLow: number;
  priceHigh: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
}

export interface VolumeFlowData {
  poc: number;
  vah: number;
  val: number;
  vwapSeries: number[];
  anchoredVwapSeries: number[];
  anchoredStartIndex: number;
  buckets: VolumeProfileBucket[];
}

export interface AsianRangeBox {
  startIndex: number;
  endIndex: number;
  high: number;
  low: number;
  mid: number;
  status: 'FORMING' | 'INSIDE' | 'LONDON_BREAKOUT_UP' | 'LONDON_BREAKOUT_DOWN' | 'BULL_FAKEOUT' | 'BEAR_FAKEOUT';
}

export type WyckoffPhase = 'Accumulation' | 'Markup' | 'Distribution' | 'Markdown';

export interface WyckoffAnalysis {
  phase: WyckoffPhase;
  confidence: number;
  subStage: string;
  rationale: string;
}

export interface SentimentData {
  symbol: SymbolId;
  cotInstitutionalLongPct: number;
  cotInstitutionalShortPct: number;
  cotNetContracts: number;
  cotWeeklyChange: number;
  retailLongPct: number;
  retailShortPct: number;
  contrarianSignal: Direction | 'NEUTRAL';
}

export interface ConfluenceBreakdown {
  smcStructure: number; // /20
  zoneAndCandle: number; // /15
  fibOTE: number; // /15
  mtfH4Bias: number; // /15
  sessionKillzone: number; // /10
  volumeVwAp: number; // /10
  intermarketRegime: number; // /10
  sentimentCot: number; // /5
}

export interface MLFilterOutput {
  probability: number; // 0..1
  decision: 'PASS' | 'BLOCK';
  features: {
    adxNormalized: number;
    volatilityZ: number;
    vwapDistanceAtr: number;
    oteAlignment: number;
    sessionWinPrior: number;
  };
  reason: string;
}

export interface BacktestStatsSummary {
  winRate: number;
  expectancy: number;
  sharpeRatio: number;
  maxDrawdownPct: number;
  profitFactor: number;
  trades: number;
  lowSample?: boolean;
}

export interface TradeSetup {
  id: string;
  symbol: SymbolId;
  direction: Direction;
  strategy: StrategyId;
  strategyLabel: string;
  score: number; // 0-100
  breakdown: ConfluenceBreakdown;
  mlFilter: MLFilterOutput;
  backtestStats?: BacktestStatsSummary;
  netCostEstimate?: number;
  htfConflict?: boolean;
  htfSummary?: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number; // 1R partial
  takeProfit2: number; // >= 2R final
  riskReward: number;
  atr: number;
  h4Trend: Direction | 'RANGING';
  session: string;
  candleConfirmation: string;
  reasons: string[];
  blockedReasons: string[]; // Risk guardrails (news, correlation, ML block, daily limit, etc.)
  eligible: boolean;
  timestamp: number;
}

export interface TimeframeBiasItem {
  timeframe: Timeframe;
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  strength: 'STRONG' | 'MODERATE' | 'WEAK';
  confidencePct: number;
  rsi14: number;
  adx14: number;
  emaAligned: boolean;
  emaStatus: 'EMA↑' | 'EMA↓';
  structureStatus: 'HH/HL' | 'LH/LL' | 'Range';
  price: number;
  reason: string;
}

export interface SymbolAnalysis {
  meta: InstrumentMeta;
  marketOpen?: boolean;
  marketStatusLabel?: string;
  m15: Candle[];
  h4: Candle[];
  currentPrice: number;
  changePct: number;
  ema50: number[];
  ema200: number[];
  bbUpper: number[];
  bbMiddle: number[];
  bbLower: number[];
  rsi14: number[];
  adx14: number;
  atr14: number;
  h4Trend: Direction | 'RANGING';
  htfBiasSummary?: {
    direction: Direction | 'NEUTRAL';
    label: string;
    h1: string;
    h4: string;
    d1: string;
    w1: string;
  };
  swings: StructurePoint[];
  structureBreaks: StructureBreak[];
  orderBlocks: OrderBlock[];
  fvgs: FairValueGap[];
  liquiditySweeps: LiquiditySweep[];
  zones: Zone[];
  candlePatterns: CandlePatternHit[];
  autoFib: AutoFibSwing;
  volumeFlow: VolumeFlowData;
  asianRange: AsianRangeBox | null;
  wyckoff: WyckoffAnalysis;
  sentiment: SentimentData;
  backtestStats?: BacktestStatsSummary;
  bestSetup: TradeSetup | null;
}

export interface IntermarketSnapshot {
  timestamp: number;
  regime: 'RISK_ON' | 'RISK_OFF' | 'TRANSITION';
  regimeSummary: string;
  preferredBias: string;
  assets: {
    id: BenchmarkId;
    label: string;
    price: number;
    changePct: number;
    trend: Direction | 'NEUTRAL';
    series: number[]; // Normalized 60-bar closes for correlation & overlay
  }[];
  matrix: Record<BenchmarkId, Record<BenchmarkId, number>>;
  keyRelationships: {
    pairA: BenchmarkId;
    pairB: BenchmarkId;
    correlation: number;
    nature: 'DIRECT' | 'INVERSE' | 'UNCORRELATED';
    driver: string;
  }[];
}

export interface EconomicNewsEvent {
  id: string;
  timeGmt: string; // HH:MM
  currency: 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CAD';
  title: string;
  impact: 'HIGH' | 'MEDIUM';
  minutesUntil: number; // negative if already passed
  inBlackout: boolean;
  affectedSymbols: SymbolId[];
  timestampMs?: number;
  schedule?: string;
  notes?: string;
}

export type LeverageLevel = 10 | 20 | 30 | 40 | 50;

export const LEVERAGE_OPTIONS: LeverageLevel[] = [10, 20, 30, 40, 50];

export interface CandleColors {
  bull: string;
  bear: string;
}

export interface RiskSettings {
  accountBalance: number; // default 50000
  peakAccountBalance?: number; // high-water mark for max drawdown kill-switch
  maxDrawdownKillSwitchPct?: number; // default 6.0%
  riskPerTradePct: number; // default 1.0
  minRiskReward: number; // default 2.0
  dailyMaxTrades: number; // default 3
  dailyMaxLossPct: number; // default 2.0
  minAccuracyPct?: number; // default 65 (> 65% qualitative accuracy gate)
  atrStopMultiplier: number; // default 1.5
  leverage: LeverageLevel; // strictly 10, 20, 30, 40, or 50x
  enableCorrelationGuard: boolean;
  enableNewsFilter: boolean;
  enableMlFilter: boolean;
  enablePartial1R: boolean;
  enableTrailingStop: boolean;
  enableNewsAutoExit: boolean;
  paperMode: boolean;
  probationDaysCompleted: number;
  probationTargetDays: number; // 60 days (~3 months)
}

export interface StrategyToggleState {
  trend_following: boolean;
  session_breakout: boolean;
  mean_reversion: boolean;
  mtf_smc: boolean;
}

export interface PaperPosition {
  id: string;
  symbol: SymbolId;
  direction: Direction;
  strategyLabel: string;
  confluenceScore: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  initialStopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  lots: number;
  leverage?: LeverageLevel;
  marginUsed?: number;
  remainingPct: number; // 100 or 50 after 1R partial
  partialBooked: boolean;
  breakevenMoved: boolean;
  trailingActive: boolean;
  unrealizedPnl: number;
  realizedPnl: number;
  rMultiple: number;
  openedAt: number;
  reasons: string[];
}

export interface TradeJournalEntry {
  id: string;
  symbol: SymbolId;
  direction: Direction;
  strategyLabel: string;
  confluenceScore: number;
  mlProbability: number;
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  takeProfit: number;
  lots: number;
  leverage?: LeverageLevel;
  pnl: number;
  rMultiple: number;
  openedAt: number;
  closedAt: number;
  exitReason: 'TP2_HIT' | 'TRAILING_STOP' | 'STOP_LOSS' | 'BREAKEVEN_STOP' | 'NEWS_AUTO_EXIT' | 'MANUAL_CLOSE';
  partial1RBooked: boolean;
  session: string;
  rationale: string[];
}

export interface BacktestJournalEntry {
  id: string;
  runId: string;
  symbol: SymbolId;
  timeframe: Timeframe;
  strategy: StrategyId;
  strategyLabel: string;
  direction: Direction;
  entryPrice: number;
  exitPrice: number;
  rMultiple: number;
  pnl: number;
  costs: number;
  reason: string;
  winRate: number;
  sharpeRatio: number;
  loggedAt: number;
}

export interface BacktestConfig {
  symbol: SymbolId;
  strategy: StrategyId;
  initialCapital: number;
  riskPerTradePct: number;
  minRR: number;
  spreadPips: number;
  slippagePips: number;
  commissionPerLot: number;
  useMlFilter: boolean;
  usePartial1R: boolean;
  barsCount: number;
}

export interface BacktestMetrics {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  netProfit: number;
  returnPct: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  profitFactor: number;
  avgR: number;
  expectancy: number;
  totalCostsPaid: number;
}

export interface BacktestResult {
  config: BacktestConfig;
  metrics: BacktestMetrics;
  equityCurve: { index: number; time: number; equity: number; drawdownPct: number }[];
  trades: {
    id: number;
    direction: Direction;
    entry: number;
    exit: number;
    rMultiple: number;
    pnl: number;
    costs: number;
    reason: string;
  }[];
}

export interface WalkForwardFold {
  fold: number;
  inSampleBars: string;
  outOfSampleBars: string;
  bestAtrMult: number;
  bestScoreThreshold: number;
  isSharpe: number;
  oosSharpe: number;
  isWinRate: number;
  oosWinRate: number;
  oosReturnPct: number;
  oosMaxDdPct: number;
}

export interface WalkForwardResult {
  symbol: SymbolId;
  strategy: StrategyId;
  folds: WalkForwardFold[];
  avgIsSharpe: number;
  avgOosSharpe: number;
  robustnessRatio: number; // OOS Sharpe / IS Sharpe
  verdict: 'ROBUST' | 'MODERATE' | 'OVERFIT_RISK';
  combinedOosEquity: { step: number; equity: number }[];
}

export type HeatmapAxisMode = 'atr_vs_rr' | 'atr_vs_ml';

export interface ParameterSweepCell {
  rowIdx: number;
  colIdx: number;
  atrMult: number;
  minRR: number;
  mlThresholdPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  plateauScore: number;
  winRate: number;
  returnPct: number;
  maxDrawdownPct: number;
  totalTrades: number;
}

export interface ParameterHeatmapResult {
  axisMode: HeatmapAxisMode;
  rowLabels: string[];
  colLabels: string[];
  cells: ParameterSweepCell[][];
  bestCell: ParameterSweepCell;
  mostRobustPlateau: ParameterSweepCell;
}

export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  chatId: string;
  alertOnEntry: boolean;
  alertOnPartial: boolean;
  alertOnExit: boolean;
  alertOnKillSwitch: boolean;
}

export interface AlertLogItem {
  id: string;
  timestamp: number;
  channel: 'TELEGRAM' | 'SYSTEM';
  title: string;
  message: string;
  delivered: boolean;
}

export interface ChartLayerState {
  smc: boolean;
  fibOte: boolean;
  volumeVwap: boolean;
  sessions: boolean;
  emaBb: boolean;
  tradeLevels: boolean;
}

export type ThemeId = 'obsidian_gold' | 'emerald_carbon' | 'slate_cobalt';

export interface PersistedWorkspaceState {
  version: number;
  savedAt: number;
  theme?: ThemeId;
  candleColors?: CandleColors | null;
  selectedSymbol: SymbolId;
  timeframe: Timeframe;
  chartLayers: ChartLayerState;
  risk: RiskSettings;
  strategies: StrategyToggleState;
  openPositions: PaperPosition[];
  journal: TradeJournalEntry[];
  backtestJournal?: BacktestJournalEntry[];
  lastTradeUtcDate?: string;
  todayTradesCount: number;
  todayRealizedPnl: number;
  alertLogs: AlertLogItem[];
  telegram: TelegramConfig;
}

export interface AiTradeAnalysisReport {
  symbol: SymbolId;
  timeframe: Timeframe;
  generatedAt: number;
  model: string;
  verdict: 'STRONG_EXECUTE' | 'CONDITIONAL_WAIT' | 'NO_TRADE_STAND_DOWN';
  confidencePct: number;
  headline: string;
  smartMoneyThesis: string;
  intermarketDriver: string;
  executionPlan: {
    triggerZone: string;
    invalidationRule: string;
    targetPlan: string;
    positionSizingNote: string;
  };
  bullCase: string;
  bearCase: string;
  riskWarnings: string[];
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}
