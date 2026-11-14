import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AiChatMessage,
  AiTradeAnalysisReport,
  EconomicNewsEvent,
  IntermarketSnapshot,
  PaperPosition,
  RiskSettings,
  SymbolAnalysis,
  SymbolId,
  Timeframe,
  TradeJournalEntry,
  TradeSetup,
} from '../types/trading';
import { getLiveSessionOverlayInfo, MarketStore, SYMBOL_LIST } from '../engine/marketData';
import { computeMultiTimeframeBias } from '../engine/quantAnalysis';
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Loader2,
  Send,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

interface AiQuantCopilotViewProps {
  store?: MarketStore;
  selectedSymbol: SymbolId;
  onSelectSymbol: (sym: SymbolId) => void;
  timeframe: Timeframe;
  analyses: Record<SymbolId, SymbolAnalysis>;
  rankedSetups: TradeSetup[];
  intermarket: IntermarketSnapshot;
  openPositions: PaperPosition[];
  journal: TradeJournalEntry[];
  risk: RiskSettings;
  newsEvents?: EconomicNewsEvent[];
  autoTriggerKey?: number;
}

const QUICK_PROMPTS = [
  'Explain this chart setup in simple words',
  'Which top setup looks cleanest right now?',
  'How are USD, yields & VIX affecting this?',
  'Check my open trades & daily risk limit',
];

function cleanSimpleText(raw: string): string {
  return raw
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*_]{3,}\s*$/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*\*\s+/gm, '- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function postJson<T>(path: string, payload: unknown): Promise<T> {
  const endpoint =
    typeof window !== 'undefined' && window.location?.origin
      ? `${window.location.origin}${path}`
      : path;

  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), 45000);

  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });

    const rawText = await resp.text();
    if (!rawText || !rawText.trim()) {
      throw new Error(`Empty response from server (HTTP ${resp.status}). Please try again.`);
    }

    let parsed: T & { ok?: boolean; error?: string };
    try {
      parsed = JSON.parse(rawText) as T & { ok?: boolean; error?: string };
    } catch {
      throw new Error(`Server returned an unexpected response (HTTP ${resp.status}). Please retry.`);
    }

    if (!resp.ok || parsed.ok === false) {
      throw new Error(parsed.error || `Request failed (HTTP ${resp.status}).`);
    }

    return parsed;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    if (err instanceof Error && /did not match the expected pattern/i.test(err.message)) {
      throw new Error('Connection or response format interrupted. Please try sending again.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const AiQuantCopilotView: React.FC<AiQuantCopilotViewProps> = ({
  store,
  selectedSymbol,
  onSelectSymbol,
  timeframe,
  analyses,
  rankedSetups,
  intermarket,
  openPositions,
  journal,
  risk,
  newsEvents = [],
  autoTriggerKey = 0,
}) => {
  const [depth, setDepth] = useState<'standard' | 'deep'>('deep');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [report, setReport] = useState<AiTradeAnalysisReport | null>(null);

  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const activeAnalysis = analyses[selectedSymbol];
  const activeSetup = rankedSetups.find((s) => s.symbol === selectedSymbol) ?? activeAnalysis.bestSetup;
  const sessionInfo = getLiveSessionOverlayInfo();

  const mtfBiasList = useMemo(
    () => (store ? computeMultiTimeframeBias(selectedSymbol, store, timeframe) : []),
    [store, selectedSymbol, timeframe]
  );

  const buildSymbolContext = useCallback(() => {
    const a = analyses[selectedSymbol];
    const setup = rankedSetups.find((s) => s.symbol === selectedSymbol) ?? a.bestSetup;
    const dec = a.meta.decimals;
    return {
      symbol: selectedSymbol,
      instrumentName: a.meta.name,
      category: a.meta.category,
      timeframe,
      currentPrice: Number(a.currentPrice.toFixed(dec)),
      changePct: a.changePct,
      h4Trend: a.h4Trend,
      allTimeframeBias: mtfBiasList.map((b) => ({
        timeframe: b.timeframe,
        bias: b.bias,
        strength: b.strength,
        confidencePct: b.confidencePct,
        rsi14: b.rsi14,
      })),
      adx14: Number(a.adx14.toFixed(2)),
      atr14: Number(a.atr14.toFixed(dec)),
      rsi14Latest: Number((a.rsi14[a.rsi14.length - 1] ?? 50).toFixed(2)),
      wyckoff: a.wyckoff,
      sentiment: a.sentiment,
      autoFib: {
        direction: a.autoFib.direction,
        swingHigh: Number(a.autoFib.swingHigh.toFixed(dec)),
        swingLow: Number(a.autoFib.swingLow.toFixed(dec)),
        oteTop: Number(a.autoFib.oteTop.toFixed(dec)),
        oteBottom: Number(a.autoFib.oteBottom.toFixed(dec)),
        currentRetracementPct: Number((a.autoFib.currentRetracement * 100).toFixed(1)),
        inOTE: a.autoFib.inOTE,
      },
      volumeFlow: {
        poc: Number(a.volumeFlow.poc.toFixed(dec)),
        vah: Number(a.volumeFlow.vah.toFixed(dec)),
        val: Number(a.volumeFlow.val.toFixed(dec)),
      },
      smcSummary: {
        recentStructureBreaks: a.structureBreaks.slice(-3),
        activeOrderBlocks: a.orderBlocks.filter((ob) => !ob.mitigated).slice(-3),
        unfilledFvgs: a.fvgs.filter((f) => !f.filled).slice(-3),
        recentSweeps: a.liquiditySweeps.slice(-3),
      },
      asianRange: a.asianRange,
      liveSession: sessionInfo,
      importantUsaNews: newsEvents
        .filter((ev) => ev.currency === 'USD')
        .map((ev) => ({
          title: ev.title,
          timeGmt: ev.timeGmt,
          impact: ev.impact,
          schedule: ev.schedule,
          minutesUntil: ev.minutesUntil,
          inBlackout: ev.inBlackout,
        })),
      intermarketRegime: {
        regime: intermarket.regime,
        summary: intermarket.regimeSummary,
        preferredBias: intermarket.preferredBias,
        benchmarks: intermarket.assets.slice(0, 6).map((b) => ({
          id: b.id,
          price: b.price,
          changePct: b.changePct,
          trend: b.trend,
        })),
      },
      evaluatedSetup: setup
        ? {
            direction: setup.direction,
            strategy: setup.strategyLabel,
            confluenceScore: setup.score,
            breakdown: setup.breakdown,
            mlFilter: setup.mlFilter,
            entryPrice: setup.entryPrice,
            stopLoss: setup.stopLoss,
            takeProfit1: setup.takeProfit1,
            takeProfit2: setup.takeProfit2,
            riskReward: setup.riskReward,
            eligible: setup.eligible,
            blockedReasons: setup.blockedReasons,
            reasons: setup.reasons,
          }
        : null,
    };
  }, [analyses, selectedSymbol, timeframe, rankedSetups, sessionInfo, intermarket, mtfBiasList]);

  const buildDeskSnapshot = useMemo(() => {
    const recentClosed = journal.slice(0, 6);
    const totalClosedPnl = journal.reduce((acc, j) => acc + j.pnl, 0);
    return {
      activeSymbolContext: buildSymbolContext(),
      topScannerSetups: rankedSetups.slice(0, 5).map((s) => ({
        symbol: s.symbol,
        direction: s.direction,
        strategy: s.strategyLabel,
        score: s.score,
        mlProbPct: Math.round(s.mlFilter.probability * 100),
        mlDecision: s.mlFilter.decision,
        riskReward: s.riskReward,
        eligible: s.eligible,
        blockedReasons: s.blockedReasons,
      })),
      accountRisk: {
        accountBalance: risk.accountBalance,
        riskPerTradePct: risk.riskPerTradePct,
        leverage: risk.leverage ?? 20,
        dailyMaxTrades: risk.dailyMaxTrades,
        minAccuracyPct: risk.minAccuracyPct ?? 65,
        dailyMaxLossPct: risk.dailyMaxLossPct,
        openPositionsCount: openPositions.length,
        openPositions: openPositions.map((p) => ({
          symbol: p.symbol,
          direction: p.direction,
          entry: p.entryPrice,
          current: p.currentPrice,
          stopLoss: p.stopLoss,
          tp2: p.takeProfit2,
          rMultiple: p.rMultiple,
          unrealizedPnl: p.unrealizedPnl,
          partialBooked: p.partialBooked,
          breakevenMoved: p.breakevenMoved,
        })),
        closedTradesCount: journal.length,
        cumulativeClosedPnl: Number(totalClosedPnl.toFixed(2)),
        recentClosedSymbols: recentClosed.map((c) => `${c.symbol} ${c.direction} ${c.rMultiple.toFixed(2)}R`),
      },
    };
  }, [buildSymbolContext, rankedSetups, risk, openPositions, journal]);

  const handleRunAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const json = await postJson<{
        ok?: boolean;
        error?: string;
        report?: AiTradeAnalysisReport;
      }>('/api/ai/analyze-setup', {
        symbol: selectedSymbol,
        timeframe,
        depth,
        context: buildSymbolContext(),
      });
      if (!json.report) {
        throw new Error(json.error || 'Unable to generate AI trade summary.');
      }
      setReport(json.report);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'AI analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  }, [selectedSymbol, timeframe, depth, buildSymbolContext]);

  const lastTriggeredRef = useRef<number>(0);
  useEffect(() => {
    if (autoTriggerKey > 0 && autoTriggerKey !== lastTriggeredRef.current) {
      lastTriggeredRef.current = autoTriggerKey;
      void handleRunAnalysis();
    }
  }, [autoTriggerKey, handleRunAnalysis]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, chatLoading]);

  const handleSendChat = async (customText?: string) => {
    const prompt = (customText ?? input).trim();
    if (!prompt || chatLoading) return;

    const userMsg: AiChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: prompt,
      timestamp: Date.now(),
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    if (!customText) setInput('');
    setChatLoading(true);
    setChatError(null);

    try {
      const json = await postJson<{
        ok?: boolean;
        reply?: string;
        error?: string;
        timestamp?: number;
      }>('/api/ai/chat', {
        message: prompt,
        history: messages.map((m) => ({ role: m.role, text: m.text })),
        deskSnapshot: buildDeskSnapshot,
      });
      const replyText = json.reply;
      if (!replyText) {
        throw new Error(json.error || 'AI Co-Pilot request failed.');
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: cleanSimpleText(replyText),
          timestamp: json.timestamp ?? Date.now(),
        },
      ]);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'AI Co-Pilot unavailable.');
    } finally {
      setChatLoading(false);
    }
  };

  const dec = activeAnalysis.meta.decimals;

  return (
    <div className="space-y-6">
      {/* Top Control & Telemetry Grounding Header */}
      <div className="border border-[var(--border-hairline)] bg-[var(--bg-surface)] rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-[var(--accent-text)]" />
              <h2 className="text-base font-display font-semibold text-slate-100">
                Advanced AI Quant Strategist & Desk Co-Pilot
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Synthesizes real-time SMC structure, Fib OTE, Wyckoff cycles, intermarket macro correlations & portfolio risk into actionable execution verdicts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedSymbol}
              onChange={(e) => onSelectSymbol(e.target.value as SymbolId)}
              className="bg-[var(--bg-inset)] border border-[var(--border-strong)] rounded px-2.5 py-1.5 text-xs font-mono text-slate-100"
            >
              {SYMBOL_LIST.map((sym) => (
                <option key={sym} value={sym}>
                  {sym}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1 bg-[var(--bg-inset)] p-1 rounded border border-[var(--border-hairline)] text-xs">
              <button
                onClick={() => setDepth('standard')}
                className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap shrink-0 ${
                  depth === 'standard'
                    ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Fast Scan
              </button>
              <button
                onClick={() => setDepth('deep')}
                className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap shrink-0 ${
                  depth === 'deep'
                    ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Deep Reasoning
              </button>
            </div>

            <button
              onClick={handleRunAnalysis}
              disabled={analyzing}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-60 text-[var(--accent-fg)] transition-colors whitespace-nowrap shrink-0"
            >
              {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {analyzing ? 'Synthesizing...' : `Analyze ${selectedSymbol} (${timeframe})`}
            </button>
          </div>
        </div>

        {/* Grounded Live Telemetry Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4 pt-4 border-t border-[var(--border-hairline)] text-xs font-mono tabular-nums">
          <div className="p-2.5 rounded bg-[var(--bg-inset)] border border-[var(--border-hairline)]">
            <div className="text-[10px] text-slate-500 font-sans">Live Spot</div>
            <div className="text-slate-100 font-semibold mt-0.5">{activeAnalysis.currentPrice.toFixed(dec)}</div>
          </div>
          <div className="p-2.5 rounded bg-[var(--bg-inset)] border border-[var(--border-hairline)]">
            <div className="text-[10px] text-slate-500 font-sans">Confluence</div>
            <div className="text-[var(--accent-text)] font-semibold mt-0.5">
              {activeSetup ? `${activeSetup.score}/100 · ${activeSetup.direction}` : 'Neutral'}
            </div>
          </div>
          <div className="p-2.5 rounded bg-[var(--bg-inset)] border border-[var(--border-hairline)]">
            <div className="text-[10px] text-slate-500 font-sans">ML Gate</div>
            <div
              className={`font-semibold mt-0.5 ${
                activeSetup?.mlFilter.decision === 'PASS' ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {activeSetup
                ? `${activeSetup.mlFilter.decision} (${Math.round(activeSetup.mlFilter.probability * 100)}%)`
                : 'N/A'}
            </div>
          </div>
          <div className="p-2.5 rounded bg-[var(--bg-inset)] border border-[var(--border-hairline)]">
            <div className="text-[10px] text-slate-500 font-sans">H4 / Wyckoff</div>
            <div className="text-slate-200 mt-0.5">
              {activeAnalysis.h4Trend} · {activeAnalysis.wyckoff.phase}
            </div>
          </div>
          <div className="p-2.5 rounded bg-[var(--bg-inset)] border border-[var(--border-hairline)]">
            <div className="text-[10px] text-slate-500 font-sans">Active Session</div>
            <div className="text-slate-200 mt-0.5 truncate">{sessionInfo.activeLabel}</div>
          </div>
          <div className="p-2.5 rounded bg-[var(--bg-inset)] border border-[var(--border-hairline)]">
            <div className="text-[10px] text-slate-500 font-sans">Macro Regime</div>
            <div
              className={`font-semibold mt-0.5 ${
                intermarket.regime === 'RISK_ON'
                  ? 'text-emerald-400'
                  : intermarket.regime === 'RISK_OFF'
                    ? 'text-rose-400'
                    : 'text-amber-400'
              }`}
            >
              {intermarket.regime.replace('_', ' ')}
            </div>
          </div>
        </div>

        {mtfBiasList.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[var(--border-hairline)] flex flex-wrap items-center gap-1.5 text-[10.5px] font-mono">
            <span className="text-slate-400 mr-1">Timeframes:</span>
            {mtfBiasList.map((item) => {
              const isBull = item.bias === 'BULLISH';
              const isNeut = item.bias === 'NEUTRAL';
              return (
                <span
                  key={item.timeframe}
                  className={`px-2 py-0.5 rounded border ${
                    isBull
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : isNeut
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {item.timeframe} {isBull ? 'Bullish' : isNeut ? 'Neutral' : 'Bearish'}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Split: Deep Trade Thesis Report (7 cols) + Interactive AI Co-Pilot Chat (5 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Structured AI Deep Quant Analysis Report */}
        <div className="xl:col-span-7 border border-[var(--border-hairline)] bg-[var(--bg-surface)] rounded-lg p-5 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-display font-semibold text-slate-100">
              AI Deep Quantitative Trade Thesis
            </h3>
            {report && (
              <span className="text-[11px] font-mono text-slate-400">
                {report.symbol} ({report.timeframe}) ·{' '}
                {new Date(report.generatedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            )}
          </div>

          {analysisError && (
            <div className="p-3.5 rounded border border-rose-500/40 bg-rose-500/10 text-xs text-rose-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">AI Analysis Request Issue</div>
                <div className="text-rose-300/90 mt-0.5">{analysisError}</div>
              </div>
            </div>
          )}

          {!report && !analyzing && (
            <div className="p-8 rounded border border-[var(--border-hairline)] bg-[var(--bg-inset)] text-center space-y-3">
              <BrainCircuit className="w-8 h-8 text-[var(--accent-text)] mx-auto opacity-80" />
              <div className="text-sm font-medium text-slate-200">
                Ready to evaluate {selectedSymbol} on {timeframe}
              </div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Click <span className="text-[var(--accent-text)] font-semibold">Analyze {selectedSymbol}</span> to run deep multi-factor reasoning across live SMC zones, Auto-Fib OTE, intermarket drivers, and risk guardrails.
              </p>
            </div>
          )}

          {analyzing && (
            <div className="p-10 rounded border border-[var(--border-hairline)] bg-[var(--bg-inset)] flex flex-col items-center justify-center gap-3 text-xs text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-text)]" />
              <span>Running {depth === 'deep' ? 'Deep Reasoning' : 'Fast Scan'} synthesis on {selectedSymbol} telemetry...</span>
            </div>
          )}

          {report && !analyzing && (
            <div className="space-y-4">
              {/* Verdict Header Card */}
              <div className="p-4 rounded-md bg-[var(--bg-inset)] border border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1 flex-1 min-w-[220px]">
                  <div className="flex items-center gap-2 text-xs font-mono">
                    {report.verdict === 'STRONG_EXECUTE' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : report.verdict === 'CONDITIONAL_WAIT' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-rose-400" />
                    )}
                    <span
                      className={`font-bold ${
                        report.verdict === 'STRONG_EXECUTE'
                          ? 'text-emerald-400'
                          : report.verdict === 'CONDITIONAL_WAIT'
                            ? 'text-amber-300'
                            : 'text-rose-400'
                      }`}
                    >
                      {report.verdict.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="text-sm font-display font-semibold text-slate-100">{report.headline}</div>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <div className="text-[10px] text-slate-500">AI Conviction</div>
                  <div className="text-xl font-bold text-[var(--accent-text)]">{report.confidencePct}%</div>
                </div>
              </div>

              {/* Structural & Macro Reasoning */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 rounded bg-[var(--bg-inset)] border border-[var(--border-hairline)] space-y-1.5">
                  <div className="text-[11px] font-mono text-[var(--accent-text)] font-semibold">
                    SMC Structure & Liquidity Thesis
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{report.smartMoneyThesis}</p>
                </div>
                <div className="p-3.5 rounded bg-[var(--bg-inset)] border border-[var(--border-hairline)] space-y-1.5">
                  <div className="text-[11px] font-mono text-[var(--accent-text)] font-semibold">
                    Intermarket, COT & Session Alignment
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{report.intermarketDriver}</p>
                </div>
              </div>

              {/* Tactical Execution Plan */}
              <div className="p-4 rounded bg-[var(--bg-elevated)] border border-[var(--border-hairline)] space-y-3">
                <div className="text-xs font-display font-semibold text-slate-100">Tactical Execution Blueprint</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-[10px] font-mono text-slate-400">Trigger Zone</div>
                    <div className="text-slate-200 mt-0.5">{report.executionPlan.triggerZone}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-rose-300">Invalidation Rule</div>
                    <div className="text-slate-200 mt-0.5">{report.executionPlan.invalidationRule}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-emerald-300">Target Management</div>
                    <div className="text-slate-200 mt-0.5">{report.executionPlan.targetPlan}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-[var(--accent-text)]">Position Sizing</div>
                    <div className="text-slate-200 mt-0.5">{report.executionPlan.positionSizingNote}</div>
                  </div>
                </div>
              </div>

              {/* Bull vs Bear Scenarios */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded bg-emerald-500/8 border border-emerald-500/30 space-y-1">
                  <div className="flex items-center gap-1.5 font-mono font-semibold text-emerald-300">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Bullish Path
                  </div>
                  <p className="text-slate-300 leading-relaxed">{report.bullCase}</p>
                </div>
                <div className="p-3.5 rounded bg-rose-500/8 border border-rose-500/30 space-y-1">
                  <div className="flex items-center gap-1.5 font-mono font-semibold text-rose-300">
                    <TrendingDown className="w-3.5 h-3.5" />
                    Bearish Path
                  </div>
                  <p className="text-slate-300 leading-relaxed">{report.bearCase}</p>
                </div>
              </div>

              {/* Risk Warnings */}
              {report.riskWarnings.length > 0 && (
                <div className="p-3.5 rounded bg-[var(--bg-inset)] border border-[var(--border-hairline)] space-y-1.5 text-xs">
                  <div className="font-mono text-amber-300 font-semibold text-[11px]">Key Risk & Guardrail Checks</div>
                  <ul className="space-y-1 text-slate-300">
                    {report.riskWarnings.map((w, i) => (
                      <li key={i}>· {w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Multi-Turn AI Quant Co-Pilot Terminal */}
        <div className="xl:col-span-5 border border-[var(--border-hairline)] bg-[var(--bg-surface)] rounded-lg p-5 flex flex-col h-[620px]">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--border-hairline)]">
            <div>
              <h3 className="text-sm font-display font-semibold text-slate-100">AI Quant Co-Pilot</h3>
              <p className="text-[11px] text-slate-400">
                Grounded in live desk quotes, top-3 qualitative setups (&gt;{risk.minAccuracyPct ?? 65}% accuracy), open trades &amp; macro matrix
              </p>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => {
                  setMessages([]);
                  setChatError(null);
                }}
                className="px-2 py-1 text-[11px] font-mono rounded bg-[var(--bg-inset)] border border-[var(--border-hairline)] text-slate-400 hover:text-slate-200 whitespace-nowrap shrink-0"
              >
                Clear Chat
              </button>
            )}
          </div>

          {/* Quick Prompt Chips */}
          <div className="flex flex-wrap gap-1.5 py-2.5 border-b border-[var(--border-hairline)]">
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                onClick={() => void handleSendChat(q)}
                disabled={chatLoading}
                className="px-2 py-1 text-[10.5px] rounded bg-[var(--bg-inset)] border border-[var(--border-hairline)] text-slate-300 hover:border-[var(--accent-border)] hover:text-[var(--accent-text)] transition-colors text-left"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Conversation Feed */}
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 space-y-2 text-xs text-slate-500">
                <Sparkles className="w-6 h-6 text-[var(--accent-text)] opacity-75" />
                <div>
                  Ask about any active setup, liquidity sweep, DXY divergence, session timing, or open paper trade risk.
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={`p-3 rounded-md text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-[var(--accent-soft)] border border-[var(--accent-border)] text-slate-100 ml-6'
                    : 'bg-[var(--bg-inset)] border border-[var(--border-hairline)] text-slate-200 mr-4'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                  <span className={m.role === 'assistant' ? 'text-[var(--accent-text)] font-semibold' : ''}>
                    {m.role === 'user' ? 'TRADER' : 'FX FUTURES AI'}
                  </span>
                  <span>
                    {new Date(m.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="whitespace-pre-wrap">
                  {m.role === 'assistant' ? cleanSimpleText(m.text) : m.text}
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="p-3 rounded-md bg-[var(--bg-inset)] border border-[var(--border-hairline)] mr-4 flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent-text)]" />
                <span>Evaluating live market telemetry...</span>
              </div>
            )}

            {chatError && (
              <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/40 text-xs text-rose-300">
                {chatError}
              </div>
            )}
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSendChat();
            }}
            className="pt-3 border-t border-[var(--border-hairline)] flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask AI about ${selectedSymbol}, macro or risk...`}
              className="flex-1 bg-[var(--bg-inset)] border border-[var(--border-strong)] rounded-md px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              type="submit"
              disabled={!input.trim() || chatLoading}
              className="px-3.5 py-2 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-[var(--accent-fg)] text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
