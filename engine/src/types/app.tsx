import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertLogItem,
  Candle,
  CandleColors,
  ChartLayerState,
  EconomicNewsEvent,
  PaperPosition,
  PersistedWorkspaceState,
  RiskSettings,
  StrategyId,
  StrategyToggleState,
  SymbolAnalysis,
  SymbolId,
  TelegramConfig,
  ThemeId,
  Timeframe,
  TradeJournalEntry,
  TradeSetup,
} from './types/trading';
import {
  applyLiveQuotesToStore,
  generateDailyNewsCalendar,
  generateInitialMarketStore,
  INSTRUMENTS,
  isTradFiMarketOpen,
  MarketStore,
  roundTo,
  sanitizeAndSortCandles,
  stepMarketStore,
  SYMBOL_LIST,
  tickLiveCandle,
} from './engine/marketData';
import { analyzeSymbol, computeIntermarketSnapshot } from './engine/quantAnalysis';
import {
  calculateExecutionCostUsd,
  countTradesOpenedTodayUtc,
  evaluateAndRankSetups,
  getTodayUtcDateString,
  manageOpenPositions,
  normalizeLeverage,
  openPaperPosition,
  STRICT_DAILY_MAX_TRADES,
  toJournalEntry,
} from './engine/riskAndBacktest';
import { TerminalWorkspace } from './components/TerminalWorkspace';
import { IntermarketDashboard } from './components/IntermarketDashboard';
import { StrategiesAndRiskView } from './components/StrategiesAndRiskView';
import { BacktestAndWalkForwardView } from './components/BacktestAndWalkForwardView';
import { MacroSentimentAlertsView } from './components/MacroSentimentAlertsView';
import { JournalAndProbationView } from './components/JournalAndProbationView';
import { AiQuantCopilotView } from './components/AiQuantCopilotView';
import {
  Activity,
  BarChart3,
  BookOpen,
  BrainCircuit,
  CandlestickChart,
  Globe,
  Lock,
  Menu,
  Palette,
  ShieldCheck,
  Sliders,
  X,
} from 'lucide-react';

type NavTab =
  | 'terminal'
  | 'ai_copilot'
  | 'intermarket'
  | 'strategies_risk'
  | 'backtest'
  | 'macro_alerts'
  | 'journal';

const NAV_ITEMS: { id: NavTab; label: string; breadcrumb: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'terminal', label: 'Terminal & Scanner', breadcrumb: 'Terminal / SMC & Top-3 Qualitative Scanner', icon: CandlestickChart },
  { id: 'ai_copilot', label: 'AI Quant Co-Pilot', breadcrumb: 'Intelligence / AI Quant Strategist & Co-Pilot', icon: BrainCircuit },
  { id: 'intermarket', label: 'Intermarket Matrix', breadcrumb: 'Macro / Intermarket Correlations', icon: Globe },
  { id: 'strategies_risk', label: 'Strategies & Risk', breadcrumb: 'Engine / Strategies & Guardrails', icon: ShieldCheck },
  { id: 'backtest', label: 'Backtest & Walk-Fwd', breadcrumb: 'Research / Backtest & Walk-Forward', icon: BarChart3 },
  { id: 'macro_alerts', label: 'COT, Wyckoff & Alerts', breadcrumb: 'Sentiment / COT & Telegram Alerts', icon: Sliders },
  { id: 'journal', label: 'Journal & Probation', breadcrumb: 'Analytics / Paper Probation & Ledger', icon: BookOpen },
];

const SEED_JOURNAL: TradeJournalEntry[] = [
  {
    id: 'seed-1',
    symbol: 'XAUUSD',
    direction: 'LONG',
    strategyLabel: 'MTF H4 + SMC OTE',
    confluenceScore: 84,
    mlProbability: 0.78,
    entryPrice: 2631.4,
    exitPrice: 2652.8,
    stopLoss: 2622.1,
    takeProfit: 2652.8,
    lots: 0.55,
    pnl: 932.0,
    rMultiple: 1.86,
    openedAt: Date.now() - 86400000 * 3,
    closedAt: Date.now() - 86400000 * 3 + 7200000,
    exitReason: 'TP2_HIT',
    partial1RBooked: true,
    session: 'LONDON',
    rationale: ['BOS Long + Bullish OB', 'Price inside 0.618–0.786 OTE Zone', 'DXY softening tailwind'],
  },
  {
    id: 'seed-2',
    symbol: 'NAS100',
    direction: 'LONG',
    strategyLabel: 'Killzone Range Breakout',
    confluenceScore: 79,
    mlProbability: 0.72,
    entryPrice: 20810.0,
    exitPrice: 20945.0,
    stopLoss: 20752.0,
    takeProfit: 20945.0,
    lots: 0.85,
    pnl: 812.5,
    rMultiple: 1.62,
    openedAt: Date.now() - 86400000 * 2,
    closedAt: Date.now() - 86400000 * 2 + 5400000,
    exitReason: 'TRAILING_STOP',
    partial1RBooked: true,
    session: 'NEW_YORK',
    rationale: ['Asian Range Bullish Breakout', 'Anchored VWAP bounce', 'Risk-On VIX compression'],
  },
  {
    id: 'seed-3',
    symbol: 'EURUSD',
    direction: 'SHORT',
    strategyLabel: 'EMA 50/200 + ADX Trend',
    confluenceScore: 73,
    mlProbability: 0.69,
    entryPrice: 1.0882,
    exitPrice: 1.0906,
    stopLoss: 1.0906,
    takeProfit: 1.083,
    lots: 2.05,
    pnl: -492.0,
    rMultiple: -1.0,
    openedAt: Date.now() - 86400000 * 1,
    closedAt: Date.now() - 86400000 * 1 + 3600000,
    exitReason: 'STOP_LOSS',
    partial1RBooked: false,
    session: 'LONDON',
    rationale: ['Bearish Pin Bar at Supply', 'H4 EMA 50/200 aligned short'],
  },
];

const STORAGE_KEY = 'apexsmc_workspace_v1';

const DEFAULT_RISK: RiskSettings = {
  accountBalance: 50000,
  peakAccountBalance: 50000,
  maxDrawdownKillSwitchPct: 6.0,
  riskPerTradePct: 1.0,
  minRiskReward: 2.0,
  dailyMaxTrades: 3,
  dailyMaxLossPct: 2.0,
  minAccuracyPct: 65,
  atrStopMultiplier: 1.5,
  leverage: 20,
  enableCorrelationGuard: true,
  enableNewsFilter: true,
  enableMlFilter: true,
  enablePartial1R: true,
  enableTrailingStop: true,
  enableNewsAutoExit: true,
  paperMode: true,
  probationDaysCompleted: 42,
  probationTargetDays: 60,
};

const DEFAULT_STRATEGIES: StrategyToggleState = {
  mtf_smc: true,
  trend_following: true,
  session_breakout: true,
  mean_reversion: true,
};

const DEFAULT_LAYERS: ChartLayerState = {
  smc: true,
  fibOte: true,
  volumeVwap: true,
  sessions: true,
  emaBb: false,
  tradeLevels: true,
};

const DEFAULT_TELEGRAM: TelegramConfig = {
  enabled: true,
  botToken: '',
  chatId: '',
  alertOnEntry: true,
  alertOnPartial: true,
  alertOnExit: true,
  alertOnKillSwitch: true,
};

function migrateRiskSettings(savedRisk: Partial<RiskSettings> | undefined, savedVersion?: number): RiskSettings {
  const merged: RiskSettings = {
    ...DEFAULT_RISK,
    ...(savedRisk ?? {}),
    leverage: normalizeLeverage(savedRisk?.leverage),
    dailyMaxTrades: STRICT_DAILY_MAX_TRADES,
  };
  if (!savedVersion || savedVersion < 2) {
    merged.minAccuracyPct = 65;
    if (!savedRisk?.accountBalance || savedRisk.accountBalance === 10250.5 || savedRisk.accountBalance === 10000) {
      merged.accountBalance = 50000;
    }
  }
  if (!savedVersion || savedVersion < 3) {
    merged.maxDrawdownKillSwitchPct = merged.maxDrawdownKillSwitchPct ?? 6.0;
    merged.peakAccountBalance = Math.max(merged.accountBalance, savedRisk?.peakAccountBalance ?? 50000);
  }
  return merged;
}

function readLocalWorkspace(): PersistedWorkspaceState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedWorkspaceState;
    if (!parsed || typeof parsed !== 'object' || !parsed.risk) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function App() {
  const initialSaved = useMemo(() => readLocalWorkspace(), []);

  const [activeTab, setActiveTab] = useState<NavTab>('terminal');
  const [aiAutoTriggerKey, setAiAutoTriggerKey] = useState<number>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [store, setStore] = useState<MarketStore>(() => generateInitialMarketStore());
  const [theme, setTheme] = useState<ThemeId>(initialSaved?.theme ?? 'obsidian_gold');
  const [candleColors, setCandleColors] = useState<CandleColors | null>(initialSaved?.candleColors ?? null);
  const [selectedSymbol, setSelectedSymbol] = useState<SymbolId>(initialSaved?.selectedSymbol ?? 'XAUUSD');
  const [timeframe, setTimeframe] = useState<Timeframe>(initialSaved?.timeframe ?? '15m');
  const [chartLayers, setChartLayers] = useState<ChartLayerState>(initialSaved?.chartLayers ?? DEFAULT_LAYERS);
  const [autoStream, setAutoStream] = useState<boolean>(true);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const [strategies, setStrategies] = useState<StrategyToggleState>(initialSaved?.strategies ?? DEFAULT_STRATEGIES);
  const [risk, setRisk] = useState<RiskSettings>(() => migrateRiskSettings(initialSaved?.risk, initialSaved?.version));

  const [simulatedNewsBlackout, setSimulatedNewsBlackout] = useState(false);
  const [openPositions, setOpenPositions] = useState<PaperPosition[]>(initialSaved?.openPositions ?? []);
  const currentUtcDate = getTodayUtcDateString();
  const initialSameDay = (initialSaved?.lastTradeUtcDate ?? currentUtcDate) === currentUtcDate;
  const [lastTradeUtcDate, setLastTradeUtcDate] = useState<string>(currentUtcDate);
  const [todayTradesCount, setTodayTradesCount] = useState(
    initialSameDay ? (initialSaved?.todayTradesCount ?? 0) : 0
  );
  const [todayRealizedPnl, setTodayRealizedPnl] = useState(
    initialSameDay ? (initialSaved?.todayRealizedPnl ?? 0) : 0
  );
  const [journal, setJournal] = useState<TradeJournalEntry[]>(initialSaved?.journal ?? SEED_JOURNAL);

  const [telegram, setTelegram] = useState<TelegramConfig>(initialSaved?.telegram ?? DEFAULT_TELEGRAM);
  const [alertLogs, setAlertLogs] = useState<AlertLogItem[]>(initialSaved?.alertLogs ?? []);
  const [liveFeedLabel, setLiveFeedLabel] = useState<string>('Live Market Sync');
  const [liveCandleCache, setLiveCandleCache] = useState<
    Record<string, { source: 'yahoo_live' | 'fallback'; candles: Candle[] }>
  >({});
  const [liveCalendarEvents, setLiveCalendarEvents] = useState<EconomicNewsEvent[] | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(initialSaved?.savedAt ?? null);
  const hydratedRef = useRef<boolean>(false);
  const userMutatedRef = useRef<boolean>(false);

  // Auto-rollover daily trade cap & P&L cleanly only when UTC calendar day changes
  useEffect(() => {
    const today = getTodayUtcDateString();
    if (lastTradeUtcDate !== today) {
      setLastTradeUtcDate(today);
      setTodayTradesCount(0);
      setTodayRealizedPnl(0);
    }
  }, [lastTradeUtcDate, store.lastUpdated]);

  // Hydrate newer workspace history from server if available (only if user hasn't already interacted)
  useEffect(() => {
    let active = true;
    fetch('/api/workspace/state')
      .then((r) => r.json())
      .then((res: { exists?: boolean; state?: PersistedWorkspaceState | null }) => {
        if (!active) return;
        const srv = res.state;
        const localSavedAt = initialSaved?.savedAt ?? 0;
        if (!userMutatedRef.current && res.exists && srv && srv.savedAt > localSavedAt) {
          if (srv.theme) setTheme(srv.theme);
          if (srv.candleColors !== undefined) setCandleColors(srv.candleColors);
          if (srv.selectedSymbol) setSelectedSymbol(srv.selectedSymbol);
          if (srv.timeframe) setTimeframe(srv.timeframe);
          if (srv.chartLayers) setChartLayers(srv.chartLayers);
          if (srv.risk) {
            setRisk(migrateRiskSettings(srv.risk, srv.version));
          }
          if (srv.strategies) setStrategies(srv.strategies);
          if (Array.isArray(srv.openPositions)) setOpenPositions(srv.openPositions);
          if (Array.isArray(srv.journal)) setJournal(srv.journal);
          const todayStr = getTodayUtcDateString();
          const srvSameDay = (srv.lastTradeUtcDate ?? todayStr) === todayStr;
          setLastTradeUtcDate(todayStr);
          if (srvSameDay && typeof srv.todayTradesCount === 'number') setTodayTradesCount(srv.todayTradesCount);
          if (srvSameDay && typeof srv.todayRealizedPnl === 'number') setTodayRealizedPnl(srv.todayRealizedPnl);
          if (Array.isArray(srv.alertLogs)) setAlertLogs(srv.alertLogs);
          if (srv.telegram) setTelegram(srv.telegram);
          setLastSavedAt(srv.savedAt);
        }
        hydratedRef.current = true;
      })
      .catch(() => {
        hydratedRef.current = true;
      });
    return () => {
      active = false;
    };
  }, [initialSaved?.savedAt]);

  const workspaceSnapshot = useMemo<PersistedWorkspaceState>(
    () => ({
      version: 4,
      savedAt: Date.now(),
      theme,
      candleColors,
      selectedSymbol,
      timeframe,
      chartLayers,
      risk,
      strategies,
      openPositions,
      journal,
      lastTradeUtcDate,
      todayTradesCount,
      todayRealizedPnl,
      alertLogs,
      telegram,
    }),
    [
      theme,
      candleColors,
      selectedSymbol,
      timeframe,
      chartLayers,
      risk,
      strategies,
      openPositions,
      journal,
      lastTradeUtcDate,
      todayTradesCount,
      todayRealizedPnl,
      alertLogs,
      telegram,
    ]
  );

  // Instant synchronous localStorage save on every mutation (prevents data loss on fast reload)
  useEffect(() => {
    if (!hydratedRef.current && !userMutatedRef.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaceSnapshot));
      setLastSavedAt(workspaceSnapshot.savedAt);
    } catch {
      // Ignore storage quota errors
    }
  }, [workspaceSnapshot]);

  // Debounced server persistence
  useEffect(() => {
    if (!hydratedRef.current && !userMutatedRef.current) return;
    const timer = setTimeout(() => {
      fetch('/api/workspace/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workspaceSnapshot),
      }).catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [workspaceSnapshot]);

  // Fetch live weekly Economic Calendar feed (ForexFactory JSON via backend)
  useEffect(() => {
    let active = true;
    const fetchCalendar = () => {
      fetch('/api/market/calendar')
        .then((r) => r.json())
        .then((data: { ok?: boolean; events?: EconomicNewsEvent[] }) => {
          if (!active) return;
          if (data.ok && Array.isArray(data.events) && data.events.length > 0) {
            setLiveCalendarEvents(data.events);
          }
        })
        .catch(() => {});
    };
    fetchCalendar();
    const id = setInterval(fetchCalendar, 15 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  // Fetch live OHLCV candles for the active symbol & timeframe
  useEffect(() => {
    let active = true;
    const cacheKey = `${selectedSymbol}_${timeframe}`;
    const fetchLiveCandles = () => {
      fetch(
        `/api/market/candles?symbol=${encodeURIComponent(selectedSymbol)}&timeframe=${encodeURIComponent(
          timeframe
        )}&mode=live`
      )
        .then((r) => r.json())
        .then((data: { ok?: boolean; source?: string; candles?: Candle[] }) => {
          if (!active) return;
          if (data.ok && Array.isArray(data.candles) && data.candles.length >= 25) {
            setLiveCandleCache((prev) => ({
              ...prev,
              [cacheKey]: { source: 'yahoo_live', candles: sanitizeAndSortCandles(data.candles!) },
            }));
          }
        })
        .catch(() => {
          // Keep calibrated live feed smoothly
        });
    };

    fetchLiveCandles();
    if (!autoStream) {
      return () => {
        active = false;
      };
    }
    const refreshId = setInterval(fetchLiveCandles, 30000);
    return () => {
      active = false;
      clearInterval(refreshId);
    };
  }, [selectedSymbol, timeframe, autoStream]);

  const newsEvents = useMemo(() => {
    const baseline = generateDailyNewsCalendar();
    if (!liveCalendarEvents || liveCalendarEvents.length === 0) return baseline;
    const weekdayLive = isTradFiMarketOpen();
    const nowMs = Date.now();
    const fallbackByCurrency: Record<string, SymbolId[]> = {
      USD: ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCAD', 'XAUUSD', 'XAGUSD', 'US30', 'NAS100', 'SPX500', 'BTCUSD', 'ETHUSD', 'SOLUSD'],
      EUR: ['EURUSD', 'GBPUSD', 'XAUUSD'],
      GBP: ['GBPUSD', 'EURUSD'],
      JPY: ['USDJPY', 'XAUUSD'],
      CAD: ['USDCAD', 'USOIL'],
    };
    const mappedLive: EconomicNewsEvent[] = liveCalendarEvents.map((ev) => {
      const minutesUntil =
        typeof ev.timestampMs === 'number' && Number.isFinite(ev.timestampMs)
          ? Math.round((ev.timestampMs - nowMs) / 60000)
          : typeof ev.minutesUntil === 'number' && Number.isFinite(ev.minutesUntil)
            ? ev.minutesUntil
            : 0;
      const affectedSymbols =
        Array.isArray(ev.affectedSymbols) && ev.affectedSymbols.length > 0
          ? ev.affectedSymbols
          : fallbackByCurrency[ev.currency] ?? fallbackByCurrency.USD;
      const inBlackout = weekdayLive && ev.impact === 'HIGH' && Math.abs(minutesUntil) <= 30;
      return {
        ...ev,
        minutesUntil,
        affectedSymbols,
        inBlackout,
      };
    });
    const titles = new Set(mappedLive.map((e) => e.title.toLowerCase()));
    return [...mappedLive, ...baseline.filter((b) => !titles.has(b.title.toLowerCase()))];
  }, [liveCalendarEvents, store.lastUpdated]);

  const intermarket = useMemo(() => computeIntermarketSnapshot(store), [store]);

  const analyses = useMemo(() => {
    const map = {} as Record<SymbolId, SymbolAnalysis>;
    for (const sym of SYMBOL_LIST) {
      map[sym] = analyzeSymbol(sym, store, intermarket, strategies, risk.atrStopMultiplier, risk.minRiskReward);
    }
    return map;
  }, [store, intermarket, strategies, risk.atrStopMultiplier, risk.minRiskReward]);

  const actualOpenedTodayUtc = useMemo(
    () => countTradesOpenedTodayUtc(openPositions, journal),
    [openPositions, journal, store.lastUpdated]
  );

  const effectiveTodayTradesCount = useMemo(
    () => Math.max(lastTradeUtcDate === getTodayUtcDateString() ? todayTradesCount : 0, actualOpenedTodayUtc),
    [lastTradeUtcDate, todayTradesCount, actualOpenedTodayUtc]
  );

  const { rankedSetups, top3Ids, botLocked, lockReason } = useMemo(
    () =>
      evaluateAndRankSetups(
        analyses,
        risk,
        openPositions,
        effectiveTodayTradesCount,
        todayRealizedPnl,
        newsEvents,
        simulatedNewsBlackout
      ),
    [analyses, risk, openPositions, effectiveTodayTradesCount, todayRealizedPnl, newsEvents, simulatedNewsBlackout]
  );

  const dispatchAlert = useCallback(
    async (title: string, message: string) => {
      let delivered = false;
      if (telegram.enabled && telegram.botToken && telegram.chatId) {
        try {
          const resp = await fetch('/api/telegram/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              botToken: telegram.botToken,
              chatId: telegram.chatId,
              text: `<b>${title}</b>\n${message}`,
            }),
          });
          const json = (await resp.json()) as { delivered?: boolean };
          delivered = Boolean(json.delivered);
        } catch {
          delivered = false;
        }
      }
      setAlertLogs((prev) => [
        {
          id: `alt-${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          channel: delivered ? 'TELEGRAM' : 'SYSTEM',
          title,
          message,
          delivered,
        },
        ...prev.slice(0, 39),
      ]);
    },
    [telegram]
  );

  const storeRef = useRef(store);
  storeRef.current = store;
  const openPositionsRef = useRef(openPositions);
  openPositionsRef.current = openPositions;
  const riskRef = useRef(risk);
  riskRef.current = risk;
  const strategiesRef = useRef(strategies);
  strategiesRef.current = strategies;
  const newsEventsRef = useRef(newsEvents);
  newsEventsRef.current = newsEvents;
  const simulatedNewsRef = useRef(simulatedNewsBlackout);
  simulatedNewsRef.current = simulatedNewsBlackout;
  const telegramRef = useRef(telegram);
  telegramRef.current = telegram;

  const commitStoreAndManagePositions = useCallback(
    (nextStore: MarketStore) => {
      storeRef.current = nextStore;
      setStore(nextStore);

      const currPositions = openPositionsRef.current;
      if (currPositions.length === 0) return;

      const currRisk = riskRef.current;
      const currStrats = strategiesRef.current;
      const nextInter = computeIntermarketSnapshot(nextStore);
      const nextAnalyses = {} as Record<SymbolId, SymbolAnalysis>;
      for (const sym of SYMBOL_LIST) {
        nextAnalyses[sym] = analyzeSymbol(
          sym,
          nextStore,
          nextInter,
          currStrats,
          currRisk.atrStopMultiplier,
          currRisk.minRiskReward
        );
      }

      const managed = manageOpenPositions(
        currPositions,
        nextAnalyses,
        currRisk,
        simulatedNewsRef.current,
        newsEventsRef.current
      );

      openPositionsRef.current = managed.updatedPositions;
      setOpenPositions(managed.updatedPositions);

      if (managed.closedEntries.length > 0) {
        userMutatedRef.current = true;
        const closedPnl = managed.closedEntries.reduce((a, b) => a + b.pnl, 0);
        setJournal((j) => [...managed.closedEntries, ...j]);
        setTodayRealizedPnl((p) => roundTo(p + closedPnl, 2));
        setRisk((r) => {
          const nextBal = roundTo(r.accountBalance + closedPnl, 2);
          return {
            ...r,
            accountBalance: nextBal,
            peakAccountBalance: Math.max(r.peakAccountBalance ?? nextBal, nextBal),
          };
        });
      }

      const tg = telegramRef.current;
      managed.events.forEach((ev) => {
        if (ev.type === 'PARTIAL_1R' && tg.alertOnPartial) {
          void dispatchAlert(`1R Partial + Breakeven: ${ev.symbol}`, ev.message);
        } else if (ev.type === 'EXIT' && tg.alertOnExit) {
          void dispatchAlert(`Position Closed: ${ev.symbol}`, ev.message);
        }
      });
    },
    [dispatchAlert]
  );

  const handleStepMarket = useCallback(() => {
    const nextStore = stepMarketStore(storeRef.current);
    commitStoreAndManagePositions(nextStore);
  }, [commitStoreAndManagePositions]);

  // Continuous Live Market Quotes Polling (every 5s) + Real-Time Candle Ticking (every 2s)
  useEffect(() => {
    let active = true;
    const syncQuotes = () => {
      fetch('/api/market/live-quotes')
        .then((r) => r.json())
        .then((data: { fetchedCount?: number; quotes?: Record<string, number> }) => {
          if (!active) return;
          if (data.quotes && Object.keys(data.quotes).length > 0) {
            setLiveFeedLabel(`Yahoo Live (${data.fetchedCount ?? Object.keys(data.quotes).length})`);
            const updatedStore = applyLiveQuotesToStore(storeRef.current, data.quotes);
            commitStoreAndManagePositions(updatedStore);
          } else {
            setLiveFeedLabel('Calibrated Live');
          }
        })
        .catch(() => {
          if (active) setLiveFeedLabel('Calibrated Live');
        });
    };

    syncQuotes();
    if (!autoStream) {
      return () => {
        active = false;
      };
    }

    const quotePollId = setInterval(syncQuotes, 5000);
    const liveTickId = setInterval(() => {
      const ticked = tickLiveCandle(storeRef.current);
      commitStoreAndManagePositions(ticked);
    }, 2000);

    return () => {
      active = false;
      clearInterval(quotePollId);
      clearInterval(liveTickId);
    };
  }, [autoStream, commitStoreAndManagePositions]);

  const handleExecuteSetup = (setup: TradeSetup) => {
    const remainingSlots = Math.max(0, STRICT_DAILY_MAX_TRADES - effectiveTodayTradesCount);
    if (botLocked || !setup.eligible || remainingSlots <= 0) return;
    userMutatedRef.current = true;
    const pos = openPaperPosition(setup, risk);
    setOpenPositions((prev) => [...prev, pos]);
    const nextCount = effectiveTodayTradesCount + 1;
    setLastTradeUtcDate(getTodayUtcDateString());
    setTodayTradesCount(nextCount);

    if (telegram.alertOnEntry) {
      void dispatchAlert(
        `ENTRY: ${setup.symbol} ${setup.direction}`,
        `Strategy: ${setup.strategyLabel}\nScore: ${setup.score}/100 | Lots: ${pos.lots}\nEntry: ${pos.entryPrice} | SL: ${pos.stopLoss} | TP2: ${pos.takeProfit2}\nReasons: ${setup.reasons.slice(0, 3).join('; ')}`
      );
    }

    if (nextCount >= STRICT_DAILY_MAX_TRADES && telegram.alertOnKillSwitch) {
      void dispatchAlert(
        `DAILY ${STRICT_DAILY_MAX_TRADES}-TRADE LIMIT LOCK`,
        `Bot executed ${nextCount}/${STRICT_DAILY_MAX_TRADES} trades today across all markets. Trading locked until tomorrow.`
      );
    }
  };

  const handleExecuteTop3 = () => {
    const remainingSlots = Math.max(0, STRICT_DAILY_MAX_TRADES - effectiveTodayTradesCount);
    if (botLocked || remainingSlots <= 0) return;
    const picks = rankedSetups.filter((s) => top3Ids.has(s.id) && s.eligible).slice(0, remainingSlots);
    if (picks.length === 0) return;

    userMutatedRef.current = true;
    const newPositions: PaperPosition[] = [];
    for (const setup of picks) {
      const pos = openPaperPosition(setup, risk);
      newPositions.push(pos);
      if (telegram.alertOnEntry) {
        void dispatchAlert(
          `TOP-3 ENTRY: ${setup.symbol} ${setup.direction}`,
          `Score: ${setup.score}/100 | Accuracy: ${(setup.mlFilter.probability * 100).toFixed(1)}% | ${setup.strategyLabel}\nEntry: ${pos.entryPrice} | SL: ${pos.stopLoss} | TP2: ${pos.takeProfit2}`
        );
      }
    }

    setOpenPositions((prev) => [...prev, ...newPositions]);
    const nextCount = effectiveTodayTradesCount + newPositions.length;
    setLastTradeUtcDate(getTodayUtcDateString());
    setTodayTradesCount(nextCount);
    if (nextCount >= STRICT_DAILY_MAX_TRADES && telegram.alertOnKillSwitch) {
      void dispatchAlert(
        `DAILY ${STRICT_DAILY_MAX_TRADES}-TRADE LIMIT LOCK`,
        `${nextCount}/${STRICT_DAILY_MAX_TRADES} qualitative daily trades deployed across all markets. Bot locked for session discipline.`
      );
    }
  };

  // Logs +1 completed probation day without ever bypassing today's strict 3-trade/day cap
  const handleAdvanceProbationDay = () => {
    userMutatedRef.current = true;
    setRisk((r) => ({ ...r, probationDaysCompleted: r.probationDaysCompleted + 1 }));
  };

  const handleClosePosition = (posId: string) => {
    const target = openPositions.find((p) => p.id === posId);
    if (!target) return;
    userMutatedRef.current = true;
    const meta = INSTRUMENTS[target.symbol];
    const analysis = analyses[target.symbol];
    const execCost = calculateExecutionCostUsd(target.symbol, target.lots);
    const totalPnl = roundTo(target.realizedPnl + target.unrealizedPnl - execCost, 2);
    const entry = toJournalEntry(
      target,
      analysis.currentPrice,
      totalPnl,
      target.rMultiple,
      'MANUAL_CLOSE',
      analysis.bestSetup?.mlFilter.probability ?? 0.65
    );
    setOpenPositions((prev) => prev.filter((p) => p.id !== posId));
    setJournal((prev) => [entry, ...prev]);
    setTodayRealizedPnl((p) => roundTo(p + totalPnl, 2));
    setRisk((r) => {
      const nextBal = roundTo(r.accountBalance + totalPnl, 2);
      return {
        ...r,
        accountBalance: nextBal,
        peakAccountBalance: Math.max(r.peakAccountBalance ?? nextBal, nextBal),
      };
    });

    if (telegram.alertOnExit) {
      void dispatchAlert(
        `MANUAL EXIT: ${target.symbol}`,
        `Closed @ ${analysis.currentPrice.toFixed(meta.decimals)} | Net P&L: ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`
      );
    }
  };

  const handleToggleStrategy = (id: StrategyId) => {
    setStrategies((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSendTestTelegram = async () => {
    const top = rankedSetups[0];
    const msg = top
      ? `Top Confluence Setup: ${top.symbol} ${top.direction} (${top.score}/100)\nStrategy: ${top.strategyLabel}\nEntry: ${top.entryPrice} | SL: ${top.stopLoss} | TP2: ${top.takeProfit2}`
      : 'FX Futures test heartbeat.';
    await dispatchAlert('FX FUTURES TEST ALERT', msg);
  };

  const currentNav = NAV_ITEMS.find((n) => n.id === activeTab)!;

  return (
    <div className="min-h-screen flex bg-[var(--bg-canvas)] text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-60 shrink-0 border-r border-[var(--border-hairline)] bg-[var(--bg-sidebar)]">
        <div className="h-14 px-5 flex items-center border-b border-[var(--border-hairline)]">
          <span className="font-display font-bold text-base tracking-tight text-[var(--accent-text)] whitespace-nowrap">
            FX Futures
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03] border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Theme Selector */}
        <div className="px-4 py-3 border-t border-[var(--border-hairline)] space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Palette className="w-3.5 h-3.5 text-[var(--accent-text)]" />
            <span>Desk Theme</span>
          </div>
          <div className="grid grid-cols-3 gap-1 bg-[var(--bg-inset)] p-1 rounded border border-[var(--border-hairline)] text-[10px] font-mono">
            {(
              [
                { id: 'obsidian_gold', label: 'Gold' },
                { id: 'emerald_carbon', label: 'Teal' },
                { id: 'slate_cobalt', label: 'Slate' },
              ] as { id: ThemeId; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`py-1 rounded transition-colors ${
                  theme === t.id
                    ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Paper Account Summary Block */}
        <div className="p-4 border-t border-[var(--border-hairline)] space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span>Paper Balance</span>
            <span className="font-mono font-semibold text-slate-100 tabular-nums">
              ${risk.accountBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Daily Cap (All Mkts)</span>
            <span
              className={`font-mono font-semibold tabular-nums ${
                effectiveTodayTradesCount >= STRICT_DAILY_MAX_TRADES ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {effectiveTodayTradesCount} / {STRICT_DAILY_MAX_TRADES}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Today P&L</span>
            <span
              className={`font-mono font-semibold tabular-nums ${
                todayRealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {todayRealizedPnl >= 0 ? '+' : ''}${todayRealizedPnl.toFixed(2)}
            </span>
          </div>
          <div className="pt-2 border-t border-[var(--border-hairline)] flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400 truncate" title={liveFeedLabel}>
              {isTradFiMarketOpen() ? liveFeedLabel : 'Crypto 24/7 Live · TradFi Closed'}
            </span>
            <button
              onClick={() => setAutoStream((s) => !s)}
              className={`flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded border transition-colors shrink-0 ${
                autoStream
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-[var(--bg-inset)] border-[var(--border-hairline)] text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3 h-3" />
              {autoStream ? 'Live 2s' : 'Paused'}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative z-10 w-64 bg-[var(--bg-sidebar)] border-r border-[var(--border-hairline)] p-4 flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[var(--border-hairline)]">
                <span className="font-display font-bold text-base text-[var(--accent-text)]">FX Futures</span>
                <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400 hover:text-slate-200">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="mt-4 space-y-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium ${
                        activeTab === item.id
                          ? 'bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)]'
                          : 'text-slate-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
            <div className="pt-4 border-t border-[var(--border-hairline)] space-y-2">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-[var(--border-hairline)]">
                <span className="text-slate-400">Paper Balance</span>
                <span className="font-mono font-semibold text-slate-100 tabular-nums">
                  ${risk.accountBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="text-[11px] text-slate-400">Desk Theme</div>
              <div className="grid grid-cols-3 gap-1 bg-[var(--bg-inset)] p-1 rounded border border-[var(--border-hairline)] text-[10px] font-mono">
                {(
                  [
                    { id: 'obsidian_gold', label: 'Gold' },
                    { id: 'emerald_carbon', label: 'Teal' },
                    { id: 'slate_cobalt', label: 'Slate' },
                  ] as { id: ThemeId; label: string }[]
                ).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`py-1 rounded transition-colors ${
                      theme === t.id
                        ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-14 px-5 border-b border-[var(--border-hairline)] bg-[var(--bg-sidebar)]/90 flex items-center justify-between gap-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded border border-[var(--border-strong)] text-slate-300"
              aria-label="Open navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="text-sm font-medium text-slate-200 truncate">{currentNav.breadcrumb}</div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-400">
              <span>All Markets Combined</span>
              <span aria-hidden="true">·</span>
              <span>
                Trades {effectiveTodayTradesCount}/{STRICT_DAILY_MAX_TRADES}
              </span>
            </div>

            {botLocked ? (
              <div className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-amber-500/15 border border-amber-500/40 text-amber-300 rounded-md whitespace-nowrap shrink-0">
                <Lock className="w-3.5 h-3.5" />
                Daily Limit Active ({effectiveTodayTradesCount}/{STRICT_DAILY_MAX_TRADES})
              </div>
            ) : (
              <button
                onClick={handleExecuteTop3}
                className="px-4 py-1.5 text-xs font-semibold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                Execute Top-3 Setups
              </button>
            )}
          </div>
        </header>

        {/* Viewport Canvas */}
        <main className="flex-1 p-5 max-w-[1600px] w-full mx-auto">
          {activeTab === 'terminal' && (
            <TerminalWorkspace
              store={store}
              selectedSymbol={selectedSymbol}
              onSelectSymbol={setSelectedSymbol}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              chartLayers={chartLayers}
              onToggleChartLayer={(key) => setChartLayers((prev) => ({ ...prev, [key]: !prev[key] }))}
              analyses={analyses}
              rankedSetups={rankedSetups}
              top3Ids={top3Ids}
              botLocked={botLocked}
              lockReason={lockReason}
              risk={risk}
              onUpdateRisk={(patch) =>
                setRisk((prev) => ({
                  ...prev,
                  ...patch,
                  leverage: normalizeLeverage(patch.leverage ?? prev.leverage),
                }))
              }
              openPositions={openPositions}
              intermarket={intermarket}
              newsEvents={newsEvents}
              onExecuteSetup={handleExecuteSetup}
              onClosePosition={handleClosePosition}
              onStepMarket={handleStepMarket}
              externalCandles={liveCandleCache[`${selectedSymbol}_${timeframe}`]?.candles ?? null}
              feedSourceLabel={
                liveCandleCache[`${selectedSymbol}_${timeframe}`]?.source === 'yahoo_live'
                  ? 'Yahoo Live OHLCV'
                  : liveFeedLabel
              }
              theme={theme}
              candleColors={candleColors}
              onChangeCandleColors={setCandleColors}
              todayTradesCount={effectiveTodayTradesCount}
              todayRealizedPnl={todayRealizedPnl}
              onOpenAiAnalysis={() => {
                setAiAutoTriggerKey((k) => k + 1);
                setActiveTab('ai_copilot');
              }}
            />
          )}

          {activeTab === 'ai_copilot' && (
            <AiQuantCopilotView
              store={store}
              selectedSymbol={selectedSymbol}
              onSelectSymbol={setSelectedSymbol}
              timeframe={timeframe}
              analyses={analyses}
              rankedSetups={rankedSetups}
              intermarket={intermarket}
              openPositions={openPositions}
              journal={journal}
              risk={risk}
              newsEvents={newsEvents}
              autoTriggerKey={aiAutoTriggerKey}
            />
          )}

          {activeTab === 'intermarket' && (
            <IntermarketDashboard
              intermarket={intermarket}
              onRefreshTick={handleStepMarket}
              analyses={analyses}
              onSelectSymbol={(sym) => {
                setSelectedSymbol(sym);
                setActiveTab('terminal');
              }}
            />
          )}

          {activeTab === 'strategies_risk' && (
            <StrategiesAndRiskView
              strategies={strategies}
              onToggleStrategy={handleToggleStrategy}
              risk={risk}
              onUpdateRisk={(patch) =>
                setRisk((prev) => ({
                  ...prev,
                  ...patch,
                  dailyMaxTrades: STRICT_DAILY_MAX_TRADES,
                  leverage: normalizeLeverage(patch.leverage ?? prev.leverage),
                }))
              }
              newsEvents={newsEvents}
              simulatedNewsBlackout={simulatedNewsBlackout}
              onToggleSimulatedNews={() => setSimulatedNewsBlackout((v) => !v)}
              selectedAnalysis={analyses[selectedSymbol]}
            />
          )}

          {activeTab === 'backtest' && (
            <BacktestAndWalkForwardView initialSymbol={selectedSymbol} />
          )}

          {activeTab === 'macro_alerts' && (
            <MacroSentimentAlertsView
              analyses={analyses}
              newsEvents={newsEvents}
              telegram={telegram}
              onUpdateTelegram={(patch) => setTelegram((prev) => ({ ...prev, ...patch }))}
              alertLogs={alertLogs}
              onSendTestTelegram={handleSendTestTelegram}
            />
          )}

          {activeTab === 'journal' && (
            <JournalAndProbationView
              journal={journal}
              risk={risk}
              todayTradesCount={effectiveTodayTradesCount}
              lastSavedAt={lastSavedAt}
              onAdvanceProbationDay={handleAdvanceProbationDay}
              onResetHistory={() => {
                userMutatedRef.current = true;
                setRisk({ ...DEFAULT_RISK, accountBalance: 50000, probationDaysCompleted: 0 });
                setStrategies(DEFAULT_STRATEGIES);
                setOpenPositions([]);
                setJournal([]);
                setTodayTradesCount(0);
                setTodayRealizedPnl(0);
                setLastTradeUtcDate(getTodayUtcDateString());
                setAlertLogs([]);
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}
