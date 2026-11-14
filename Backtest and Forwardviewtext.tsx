import React, { useEffect, useMemo, useState } from 'react';
import {
  BacktestConfig,
  Candle,
  HeatmapAxisMode,
  ParameterSweepCell,
  StrategyId,
  SymbolId,
  Timeframe,
} from '../types/trading';
import { generatePastBacktestCandles, INSTRUMENTS, SYMBOL_LIST } from '../engine/marketData';
import {
  runParameterSweepHeatmap,
  runStrategyBacktest,
  runWalkForwardAnalysis,
} from '../engine/riskAndBacktest';
import { Check, Grid, Play, ShieldAlert } from 'lucide-react';

interface BacktestAndWalkForwardViewProps {
  initialSymbol: SymbolId;
}

const BACKTEST_TIMEFRAMES: Timeframe[] = ['5m', '15m', '30m', '1h', '4h', '1D'];

export const BacktestAndWalkForwardView: React.FC<BacktestAndWalkForwardViewProps> = ({
  initialSymbol,
}) => {
  const [config, setConfig] = useState<BacktestConfig>({
    symbol: initialSymbol,
    strategy: 'mtf_smc',
    initialCapital: 50000,
    riskPerTradePct: 1.0,
    minRR: 2.2,
    spreadPips: 1.4,
    slippagePips: 0.4,
    commissionPerLot: 7.0,
    useMlFilter: true,
    usePartial1R: true,
    barsCount: 240,
  });

  const [atrMult, setAtrMult] = useState<number>(1.5);
  const [mlScoreGate, setMlScoreGate] = useState<number>(0);
  const [backtestTimeframe, setBacktestTimeframe] = useState<Timeframe>('15m');
  const [tab, setTab] = useState<'backtest' | 'walkforward'>('backtest');
  const [axisMode, setAxisMode] = useState<HeatmapAxisMode>('atr_vs_rr');
  const [selectedCell, setSelectedCell] = useState<ParameterSweepCell | null>(null);
  const [pastHistoryState, setPastHistoryState] = useState<{
    key: string;
    source: 'yahoo_live' | 'fallback';
    candles: Candle[];
    loading: boolean;
  }>({ key: '', source: 'fallback', candles: [], loading: true });

  useEffect(() => {
    let active = true;
    const reqKey = `${config.symbol}_${backtestTimeframe}`;
    setPastHistoryState((prev) => ({ ...prev, loading: true }));

    fetch(
      `/api/market/candles?symbol=${encodeURIComponent(config.symbol)}&timeframe=${encodeURIComponent(
        backtestTimeframe
      )}&mode=backtest`
    )
      .then((r) => r.json())
      .then((data: { ok?: boolean; source?: string; candles?: Candle[] }) => {
        if (!active) return;
        if (data.ok && Array.isArray(data.candles) && data.candles.length >= 180) {
          setPastHistoryState({
            key: reqKey,
            source: 'yahoo_live',
            candles: data.candles,
            loading: false,
          });
        } else {
          setPastHistoryState({
            key: reqKey,
            source: 'fallback',
            candles: [],
            loading: false,
          });
        }
      })
      .catch(() => {
        if (!active) return;
        setPastHistoryState({
          key: reqKey,
          source: 'fallback',
          candles: [],
          loading: false,
        });
      });

    return () => {
      active = false;
    };
  }, [config.symbol, backtestTimeframe]);

  const { pastCandles, historySourceLabel } = useMemo(() => {
    const reqKey = `${config.symbol}_${backtestTimeframe}`;
    if (pastHistoryState.key === reqKey && pastHistoryState.candles.length >= 180) {
      return {
        pastCandles: pastHistoryState.candles,
        historySourceLabel: `Real Past History (Yahoo OHLCV · ${pastHistoryState.candles.length} bars · ${backtestTimeframe})`,
      };
    }
    const fallbackBars = generatePastBacktestCandles(config.symbol, backtestTimeframe, 420);
    return {
      pastCandles: fallbackBars,
      historySourceLabel: pastHistoryState.loading
        ? `Loading Real Past History (${backtestTimeframe})...`
        : `Past Calibrated History (${fallbackBars.length} bars · ${backtestTimeframe})`,
    };
  }, [config.symbol, backtestTimeframe, pastHistoryState]);

  const btResult = useMemo(() => {
    return runStrategyBacktest(pastCandles, { ...config, barsCount: pastCandles.length }, atrMult, mlScoreGate);
  }, [pastCandles, config, atrMult, mlScoreGate]);

  const wfResult = useMemo(() => {
    return runWalkForwardAnalysis(pastCandles, config.symbol, config.strategy, config.initialCapital);
  }, [pastCandles, config.symbol, config.strategy, config.initialCapital]);

  const heatmap = useMemo(() => {
    return runParameterSweepHeatmap(pastCandles, { ...config, barsCount: pastCandles.length }, axisMode);
  }, [pastCandles, config, axisMode]);

  const inspectedCell = useMemo(() => {
    if (selectedCell) {
      return heatmap.cells[selectedCell.rowIdx]?.[selectedCell.colIdx] ?? heatmap.mostRobustPlateau;
    }
    return heatmap.mostRobustPlateau;
  }, [selectedCell, heatmap]);

  const ratioHeatStyle = (val: number, isPlateau: boolean) => {
    const ring = isPlateau ? 'ring-1 ring-[var(--accent)]' : '';
    if (val >= 2.2) return `bg-emerald-500/30 text-emerald-200 border border-emerald-500/45 ${ring}`;
    if (val >= 1.4) return `bg-emerald-500/18 text-emerald-300 border border-emerald-500/30 ${ring}`;
    if (val >= 0.6) return `bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)] ${ring}`;
    if (val >= 0) return `bg-amber-500/12 text-amber-300 border border-amber-500/25 ${ring}`;
    return `bg-rose-500/20 text-rose-300 border border-rose-500/30 ${ring}`;
  };

  const applyCellToSimulator = (cell: ParameterSweepCell) => {
    setAtrMult(cell.atrMult);
    if (heatmap.axisMode === 'atr_vs_rr') {
      setConfig((prev) => ({ ...prev, minRR: cell.minRR }));
    } else {
      setConfig((prev) => ({ ...prev, useMlFilter: cell.mlThresholdPct > 0 }));
      setMlScoreGate(cell.mlThresholdPct);
    }
    setTab('backtest');
  };

  return (
    <div className="space-y-6">
      {/* Control Bar */}
      <div className="border border-[var(--border-hairline)] bg-[var(--bg-surface)] rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-display font-semibold text-slate-100">
              Historical Strategy Backtest & Walk-Forward Engine
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Evaluates strategies strictly on past historical data ({historySourceLabel}) with realistic spread, slippage & commission.
            </p>
          </div>
          <div className="flex items-center gap-1 bg-[var(--bg-inset)] p-1 rounded border border-[var(--border-hairline)]">
            <button
              onClick={() => setTab('backtest')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                tab === 'backtest'
                  ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Backtest Simulator
            </button>
            <button
              onClick={() => setTab('walkforward')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                tab === 'walkforward'
                  ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Walk-Forward Validation
            </button>
          </div>
        </div>

        {/* Parameters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-10 gap-3">
          <label className="block">
            <span className="text-[11px] text-slate-400">Instrument</span>
            <select
              value={config.symbol}
              onChange={(e) => setConfig({ ...config, symbol: e.target.value as SymbolId })}
              className="mt-1 w-full bg-[var(--bg-inset)] border border-[var(--border-strong)] rounded px-2.5 py-1.5 text-xs font-mono text-slate-100"
            >
              {SYMBOL_LIST.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] text-slate-400">Past TF</span>
            <select
              value={backtestTimeframe}
              onChange={(e) => setBacktestTimeframe(e.target.value as Timeframe)}
              className="mt-1 w-full bg-[var(--bg-inset)] border border-[var(--border-strong)] rounded px-2.5 py-1.5 text-xs font-mono text-slate-100"
            >
              {BACKTEST_TIMEFRAMES.map((tf) => (
                <option key={tf} value={tf}>
                  {tf}
                </option>
              ))}
            </select>
          </label>
          <label className="block col-span-2 sm:col-span-2">
            <span className="text-[11px] text-slate-400">Strategy</span>
            <select
              value={config.strategy}
              onChange={(e) => setConfig({ ...config, strategy: e.target.value as StrategyId })}
              className="mt-1 w-full bg-[var(--bg-inset)] border border-[var(--border-strong)] rounded px-2.5 py-1.5 text-xs text-slate-100"
            >
              <option value="mtf_smc">MTF H4 + SMC Fib OTE</option>
              <option value="trend_following">EMA 50/200 + ADX Trend</option>
              <option value="session_breakout">London/NY Session Breakout</option>
              <option value="mean_reversion">RSI + BB Mean Reversion</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] text-slate-400">ATR Stop Mult</span>
            <input
              type="number"
              step="0.25"
              min="0.75"
              max="3.0"
              value={atrMult}
              onChange={(e) => setAtrMult(Math.max(0.5, Number(e.target.value)))}
              className="mt-1 w-full bg-[var(--bg-inset)] border border-[var(--border-strong)] rounded px-2.5 py-1.5 text-xs font-mono text-slate-100"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-slate-400">Risk %</span>
            <input
              type="number"
              step="0.1"
              min="0.2"
              max="2"
              value={config.riskPerTradePct}
              onChange={(e) => setConfig({ ...config, riskPerTradePct: Number(e.target.value) })}
              className="mt-1 w-full bg-[var(--bg-inset)] border border-[var(--border-strong)] rounded px-2.5 py-1.5 text-xs font-mono text-slate-100"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-slate-400">Min RR (1:X)</span>
            <input
              type="number"
              step="0.2"
              min="1.5"
              max="4"
              value={config.minRR}
              onChange={(e) => setConfig({ ...config, minRR: Number(e.target.value) })}
              className="mt-1 w-full bg-[var(--bg-inset)] border border-[var(--border-strong)] rounded px-2.5 py-1.5 text-xs font-mono text-slate-100"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-slate-400">Spread (pips)</span>
            <input
              type="number"
              step="0.2"
              min="0"
              max="8"
              value={config.spreadPips}
              onChange={(e) => setConfig({ ...config, spreadPips: Number(e.target.value) })}
              className="mt-1 w-full bg-[var(--bg-inset)] border border-[var(--border-strong)] rounded px-2.5 py-1.5 text-xs font-mono text-slate-100"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-slate-400">Slippage (pips)</span>
            <input
              type="number"
              step="0.1"
              min="0"
              max="5"
              value={config.slippagePips}
              onChange={(e) => setConfig({ ...config, slippagePips: Number(e.target.value) })}
              className="mt-1 w-full bg-[var(--bg-inset)] border border-[var(--border-strong)] rounded px-2.5 py-1.5 text-xs font-mono text-slate-100"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-slate-400">Comm ($/lot)</span>
            <input
              type="number"
              step="1"
              min="0"
              max="20"
              value={config.commissionPerLot}
              onChange={(e) => setConfig({ ...config, commissionPerLot: Number(e.target.value) })}
              className="mt-1 w-full bg-[var(--bg-inset)] border border-[var(--border-strong)] rounded px-2.5 py-1.5 text-xs font-mono text-slate-100"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-slate-800/80 text-xs">
          <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={config.useMlFilter}
              onChange={(e) => {
                setConfig({ ...config, useMlFilter: e.target.checked });
                if (!e.target.checked) setMlScoreGate(0);
              }}
              className="rounded border-slate-600 bg-[#0B0F17]"
            />
            Apply ML Signal Filter Gate {mlScoreGate > 0 ? `(>=${mlScoreGate}%)` : ''}
          </label>
          <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={config.usePartial1R}
              onChange={(e) => setConfig({ ...config, usePartial1R: e.target.checked })}
              className="rounded border-slate-600 bg-[#0B0F17]"
            />
            Book 50% at 1R + Move SL to Breakeven
          </label>
        </div>
      </div>

      {tab === 'backtest' ? (
        <>
          {/* Low Sample Warning Banner (< 20 Trades) */}
          {btResult.metrics.totalTrades < 20 && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-amber-300">
                  Low Sample Size Warning ({btResult.metrics.totalTrades} trades &lt; 20 minimum):
                </span>{' '}
                Win Rate ({btResult.metrics.winRate.toFixed(1)}%) and Sharpe ({btResult.metrics.sharpeRatio.toFixed(2)}) on fewer than 20 trades can reflect short-term variance rather than reliable statistical edge. Test a lower timeframe (5m/15m) or wider history before relying on these ratios.
              </div>
            </div>
          )}

          {/* KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-3">
            {[
              {
                label: 'Net Profit',
                val: `${btResult.metrics.netProfit >= 0 ? '+' : ''}$${btResult.metrics.netProfit.toFixed(2)}`,
                cls: btResult.metrics.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400',
              },
              {
                label: 'Return %',
                val: `${btResult.metrics.returnPct >= 0 ? '+' : ''}${btResult.metrics.returnPct.toFixed(2)}%`,
                cls: btResult.metrics.returnPct >= 0 ? 'text-emerald-400' : 'text-rose-400',
              },
              {
                label: 'Trades',
                val: `${btResult.metrics.totalTrades}`,
                cls: btResult.metrics.totalTrades < 20 ? 'text-amber-300' : 'text-slate-100',
                warn: btResult.metrics.totalTrades < 20 ? 'Low Sample (<20T)' : undefined,
              },
              {
                label: 'Win Rate',
                val: `${btResult.metrics.winRate.toFixed(1)}%`,
                cls: 'text-slate-100',
                warn: btResult.metrics.totalTrades < 20 ? 'Small Sample' : undefined,
              },
              {
                label: 'Sharpe Ratio',
                val: btResult.metrics.sharpeRatio.toFixed(2),
                cls: btResult.metrics.sharpeRatio > 0 ? 'text-[var(--accent-text)]' : 'text-rose-400',
                warn: btResult.metrics.totalTrades < 20 ? 'Small Sample' : undefined,
              },
              { label: 'Sortino Ratio', val: btResult.metrics.sortinoRatio.toFixed(2), cls: 'text-emerald-300' },
              { label: 'Max Drawdown', val: `-${btResult.metrics.maxDrawdownPct.toFixed(2)}%`, cls: 'text-rose-400' },
              { label: 'Profit Factor', val: btResult.metrics.profitFactor.toFixed(2), cls: 'text-slate-100' },
              { label: 'Friction Costs', val: `$${btResult.metrics.totalCostsPaid.toFixed(2)}`, cls: 'text-amber-300' },
            ].map((k) => (
              <div key={k.label} className="border border-[var(--border-hairline)] bg-[var(--bg-surface)] rounded-lg p-3">
                <div className="flex items-center justify-between gap-1 text-[11px] text-slate-400">
                  <span>{k.label}</span>
                  {'warn' in k && k.warn && (
                    <span className="text-[9.5px] font-mono text-amber-300">{k.warn}</span>
                  )}
                </div>
                <div className={`text-base font-mono font-semibold mt-1 tabular-nums ${k.cls}`}>{k.val}</div>
              </div>
            ))}
          </div>

          {/* Equity Curve & Trade List */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            <div className="xl:col-span-7 border border-[var(--border-hairline)] bg-[var(--bg-surface)] rounded-lg p-5">
              <h3 className="text-sm font-display font-semibold text-slate-100 mb-3">
                Simulated Equity Curve & Drawdown ({config.symbol})
              </h3>
              {btResult.equityCurve.length < 2 ? (
                <div className="h-56 flex items-center justify-center text-xs text-slate-500 border border-[var(--border-hairline)] rounded bg-[var(--bg-inset)] px-4 text-center">
                  Fewer than 2 signals triggered under current filters. Relax ML Gate or select MTF SMC.
                </div>
              ) : (
                <div className="bg-[var(--bg-inset)] border border-[var(--border-hairline)] rounded p-3">
                  <svg viewBox="0 0 600 220" className="w-full h-56">
                    {(() => {
                      const pts = btResult.equityCurve;
                      const eqs = [config.initialCapital, ...pts.map((p) => p.equity)];
                      const minE = Math.min(...eqs) * 0.995;
                      const maxE = Math.max(...eqs) * 1.005;
                      const span = Math.max(10, maxE - minE);
                      const toX = (i: number) => 16 + (i / (eqs.length - 1)) * 568;
                      const toY = (v: number) => 16 + ((maxE - v) / span) * 180;
                      const poly = eqs.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
                      const baseLineY = toY(config.initialCapital);
                      return (
                        <g>
                          <line x1={16} x2={584} y1={baseLineY} y2={baseLineY} stroke="#334155" strokeDasharray="3 3" />
                          <polyline fill="none" stroke="#10B981" strokeWidth={2.2} points={poly} />
                          <text x={20} y={24} fill="#94A3B8" fontSize="10" fontFamily="JetBrains Mono, monospace">
                            Peak ${Math.max(...eqs).toFixed(0)}
                          </text>
                          <text x={20} y={208} fill="#64748B" fontSize="10" fontFamily="JetBrains Mono, monospace">
                            Start ${config.initialCapital.toLocaleString()} · End ${eqs[eqs.length - 1].toFixed(2)}
                          </text>
                        </g>
                      );
                    })()}
                  </svg>
                </div>
              )}
            </div>

            <div className="xl:col-span-5 border border-[var(--border-hairline)] bg-[var(--bg-surface)] rounded-lg p-5">
              <h3 className="text-sm font-display font-semibold text-slate-100 mb-3">
                Backtest Execution Log ({btResult.trades.length} Trades)
              </h3>
              <div className="max-h-64 overflow-y-auto border border-[var(--border-hairline)] rounded bg-[var(--bg-inset)]">
                <table className="w-full text-xs font-mono tabular-nums">
                  <thead className="bg-[var(--bg-elevated)] text-slate-400 sticky top-0">
                    <tr>
                      <th className="p-2 text-left">#</th>
                      <th className="p-2 text-left">Side</th>
                      <th className="p-2 text-right">Entry</th>
                      <th className="p-2 text-right">R</th>
                      <th className="p-2 text-right">Net P&L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {btResult.trades.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-800/40">
                        <td className="p-2 text-slate-500">{t.id}</td>
                        <td className={`p-2 font-semibold ${t.direction === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {t.direction}
                        </td>
                        <td className="p-2 text-right text-slate-300">
                          {t.entry.toFixed(INSTRUMENTS[config.symbol].decimals)}
                        </td>
                        <td className={`p-2 text-right ${t.rMultiple >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {t.rMultiple >= 0 ? '+' : ''}
                          {t.rMultiple.toFixed(2)}R
                        </td>
                        <td className={`p-2 text-right ${t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    {btResult.trades.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-500 font-sans">
                          No historical triggers matched filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Walk-Forward Validation View */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="border border-[var(--border-hairline)] bg-[var(--bg-surface)] rounded-lg p-4">
              <div className="text-xs text-slate-400">Avg In-Sample Sharpe</div>
              <div className="text-xl font-mono font-semibold text-slate-100 mt-1">{wfResult.avgIsSharpe.toFixed(2)}</div>
            </div>
            <div className="border border-[var(--border-hairline)] bg-[var(--bg-surface)] rounded-lg p-4">
              <div className="text-xs text-slate-400">Avg Out-of-Sample Sharpe</div>
              <div className="text-xl font-mono font-semibold text-[var(--accent-text)] mt-1">
                {wfResult.avgOosSharpe.toFixed(2)}
              </div>
            </div>
            <div className="border border-[var(--border-hairline)] bg-[var(--bg-surface)] rounded-lg p-4">
              <div className="text-xs text-slate-400">WFE Robustness Ratio (OOS/IS)</div>
              <div className="text-xl font-mono font-semibold text-emerald-400 mt-1">
                {wfResult.robustnessRatio.toFixed(2)}
              </div>
            </div>
            <div className="border border-[var(--border-hairline)] bg-[var(--bg-surface)] rounded-lg p-4">
              <div className="text-xs text-slate-400">Overfitting Verdict</div>
              <div
                className={`text-base font-mono font-semibold mt-1.5 flex items-center gap-1.5 ${
                  wfResult.verdict === 'ROBUST'
                    ? 'text-emerald-400'
                    : wfResult.verdict === 'MODERATE'
                      ? 'text-amber-400'
                      : 'text-rose-400'
                }`}
              >
                {wfResult.verdict === 'ROBUST' ? (
                  <Play className="w-4 h-4" />
                ) : (
                  <ShieldAlert className="w-4 h-4" />
                )}
                {wfResult.verdict.replace('_', ' ')}
              </div>
            </div>
          </div>

          <div className="border border-[var(--border-hairline)] bg-[var(--bg-surface)] rounded-lg p-5 overflow-x-auto">
            <h3 className="text-sm font-display font-semibold text-slate-100 mb-3">
              Rolling 4-Fold Walk-Forward Matrix (In-Sample Optimization vs Out-of-Sample Validation)
            </h3>
            <table className="w-full min-w-[680px] text-xs font-mono tabular-nums">
              <thead className="bg-[var(--bg-elevated)] text-slate-400">
                <tr>
                  <th className="sticky left-0 z-10 bg-[var(--bg-elevated)] p-2.5 text-left border-r border-[var(--border-hairline)]">
                    Fold
                  </th>
                  <th className="p-2.5 text-left">IS Window</th>
                  <th className="p-2.5 text-left">OOS Window</th>
                  <th className="p-2.5 text-right">Opt ATR Mult</th>
                  <th className="p-2.5 text-right">IS Sharpe</th>
                  <th className="p-2.5 text-right">OOS Sharpe</th>
                  <th className="p-2.5 text-right">OOS Win Rate</th>
                  <th className="p-2.5 text-right">OOS Return</th>
                  <th className="p-2.5 text-right">OOS Max DD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {wfResult.folds.map((f) => (
                  <tr key={f.fold} className="hover:bg-slate-800/30">
                    <td className="sticky left-0 z-10 bg-[var(--bg-surface)] p-2.5 text-slate-200 font-semibold border-r border-[var(--border-hairline)] whitespace-nowrap">
                      Fold {f.fold}
                    </td>
                    <td className="p-2.5 text-slate-400 whitespace-nowrap">{f.inSampleBars}</td>
                    <td className="p-2.5 text-slate-400 whitespace-nowrap">{f.outOfSampleBars}</td>
                    <td className="p-2.5 text-right text-slate-200">{f.bestAtrMult.toFixed(1)}x</td>
                    <td className="p-2.5 text-right text-slate-300">{f.isSharpe.toFixed(2)}</td>
                    <td className={`p-2.5 text-right font-semibold ${f.oosSharpe >= 0 ? 'text-[var(--accent-text)]' : 'text-rose-400'}`}>
                      {f.oosSharpe.toFixed(2)}
                    </td>
                    <td className="p-2.5 text-right text-slate-200">{f.oosWinRate.toFixed(1)}%</td>
                    <td className={`p-2.5 text-right ${f.oosReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {f.oosReturnPct >= 0 ? '+' : ''}
                      {f.oosReturnPct.toFixed(2)}%
                    </td>
                    <td className="p-2.5 text-right text-rose-400">-{f.oosMaxDdPct.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Parameter Robustness Heatmap (Sharpe & Sortino Ratios Across 25 Combinations) */}
      <div className="border border-[var(--border-hairline)] bg-[var(--bg-surface)] rounded-lg p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Grid className="w-4 h-4 text-[var(--accent-text)]" />
              <h3 className="text-base font-display font-semibold text-slate-100">
                Sharpe & Sortino Parameter Robustness Heatmap ({config.symbol})
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Evaluates 25 parameter combinations to spotlight stable risk-adjusted plateaus (highlighted ring) rather than fragile single-point peaks.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-[var(--bg-inset)] p-1 rounded border border-[var(--border-hairline)]">
            <button
              onClick={() => {
                setAxisMode('atr_vs_rr');
                setSelectedCell(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                axisMode === 'atr_vs_rr'
                  ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ATR Stop × Min RR
            </button>
            <button
              onClick={() => {
                setAxisMode('atr_vs_ml');
                setSelectedCell(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                axisMode === 'atr_vs_ml'
                  ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ATR Stop × ML Gate
            </button>
          </div>
        </div>

        {/* Dual Side-by-Side Heatmaps: Sharpe Ratio & Sortino Ratio */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Sharpe Ratio Matrix */}
          <div className="bg-[var(--bg-inset)] border border-[var(--border-hairline)] rounded-md p-4 overflow-x-auto">
            <div className="flex items-center justify-between mb-3 gap-2">
              <span className="text-xs font-display font-semibold text-slate-200">
                Sharpe Ratio Surface (Total Return / Total Volatility)
              </span>
              <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
                Peak: {heatmap.bestCell.sharpeRatio.toFixed(2)}
              </span>
            </div>
            <table className="w-full min-w-[460px] border-collapse text-xs font-mono tabular-nums">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-[var(--bg-inset)] p-1.5 text-left text-slate-500 font-medium border-r border-[var(--border-hairline)]">
                    ATR \ Param
                  </th>
                  {heatmap.colLabels.map((lbl) => (
                    <th key={lbl} className="p-1.5 text-center text-slate-400 font-medium whitespace-nowrap">
                      {lbl}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.cells.map((row, rIdx) => (
                  <tr key={heatmap.rowLabels[rIdx]}>
                    <td className="sticky left-0 z-10 bg-[var(--bg-inset)] p-1.5 text-slate-300 font-semibold whitespace-nowrap border-r border-[var(--border-hairline)]">
                      {heatmap.rowLabels[rIdx]}
                    </td>
                    {row.map((cell) => {
                      const isPlateau =
                        cell.rowIdx === heatmap.mostRobustPlateau.rowIdx &&
                        cell.colIdx === heatmap.mostRobustPlateau.colIdx;
                      const isSelected =
                        inspectedCell.rowIdx === cell.rowIdx && inspectedCell.colIdx === cell.colIdx;
                      return (
                        <td key={`shp-${cell.rowIdx}-${cell.colIdx}`} className="p-1">
                          <button
                            onClick={() => setSelectedCell(cell)}
                            className={`w-full py-2 px-1.5 rounded text-center transition-transform hover:brightness-125 ${ratioHeatStyle(
                              cell.sharpeRatio,
                              isPlateau
                            )} ${isSelected ? 'outline-2 outline-white' : ''}`}
                          >
                            <div className="font-semibold">{cell.sharpeRatio.toFixed(2)}</div>
                            <div className="text-[10px] opacity-75">
                              {cell.totalTrades}T{cell.totalTrades < 20 ? '*' : ''}
                            </div>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sortino Ratio Matrix */}
          <div className="bg-[var(--bg-inset)] border border-[var(--border-hairline)] rounded-md p-4 overflow-x-auto">
            <div className="flex items-center justify-between mb-3 gap-2">
              <span className="text-xs font-display font-semibold text-slate-200">
                Sortino Ratio Surface (Downside-Adjusted Edge)
              </span>
              <span className="text-[11px] font-mono text-emerald-300 whitespace-nowrap">
                Plateau: {heatmap.mostRobustPlateau.sortinoRatio.toFixed(2)}
              </span>
            </div>
            <table className="w-full min-w-[460px] border-collapse text-xs font-mono tabular-nums">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-[var(--bg-inset)] p-1.5 text-left text-slate-500 font-medium border-r border-[var(--border-hairline)]">
                    ATR \ Param
                  </th>
                  {heatmap.colLabels.map((lbl) => (
                    <th key={lbl} className="p-1.5 text-center text-slate-400 font-medium whitespace-nowrap">
                      {lbl}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.cells.map((row, rIdx) => (
                  <tr key={heatmap.rowLabels[rIdx]}>
                    <td className="sticky left-0 z-10 bg-[var(--bg-inset)] p-1.5 text-slate-300 font-semibold whitespace-nowrap border-r border-[var(--border-hairline)]">
                      {heatmap.rowLabels[rIdx]}
                    </td>
                    {row.map((cell) => {
                      const isPlateau =
                        cell.rowIdx === heatmap.mostRobustPlateau.rowIdx &&
                        cell.colIdx === heatmap.mostRobustPlateau.colIdx;
                      const isSelected =
                        inspectedCell.rowIdx === cell.rowIdx && inspectedCell.colIdx === cell.colIdx;
                      return (
                        <td key={`srt-${cell.rowIdx}-${cell.colIdx}`} className="p-1">
                          <button
                            onClick={() => setSelectedCell(cell)}
                            className={`w-full py-2 px-1.5 rounded text-center transition-transform hover:brightness-125 ${ratioHeatStyle(
                              cell.sortinoRatio,
                              isPlateau
                            )} ${isSelected ? 'outline-2 outline-white' : ''}`}
                          >
                            <div className="font-semibold">{cell.sortinoRatio.toFixed(2)}</div>
                            <div className="text-[10px] opacity-75">
                              {cell.returnPct >= 0 ? '+' : ''}
                              {cell.returnPct.toFixed(1)}%
                            </div>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Walk-Forward Out-of-Sample Cross-Check Beside Best Plateau */}
        <div
          className={`flex flex-wrap items-center justify-between gap-4 p-4 rounded-md border text-xs ${
            wfResult.verdict === 'ROBUST'
              ? 'bg-emerald-500/8 border-emerald-500/35'
              : wfResult.verdict === 'MODERATE'
                ? 'bg-amber-500/8 border-amber-500/35'
                : 'bg-rose-500/10 border-rose-500/35'
          }`}
        >
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display font-semibold text-slate-100">
                Walk-Forward Out-of-Sample Reality Check (4 Folds)
              </span>
              <span
                className={`px-2 py-0.5 rounded font-mono text-[10.5px] font-semibold border ${
                  wfResult.verdict === 'ROBUST'
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : wfResult.verdict === 'MODERATE'
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                      : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                }`}
              >
                {wfResult.verdict.replace('_', ' ')}
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              {wfResult.verdict === 'OVERFIT_RISK'
                ? 'Warning: In-sample heatmap plateaus may be overfit — Out-of-Sample Sharpe drops sharply across unseen folds.'
                : wfResult.verdict === 'MODERATE'
                  ? 'Moderate OOS transferability. Prefer plateau center rather than peak cell and verify sample size >= 20T.'
                  : 'OOS validation confirms the heatmap plateau holds up on unseen data.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5 font-mono tabular-nums">
            <div>
              <div className="text-[10.5px] text-slate-400 font-sans">Avg IS Sharpe</div>
              <div className="text-slate-100 font-semibold">{wfResult.avgIsSharpe.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[10.5px] text-slate-400 font-sans">Avg OOS Sharpe</div>
              <div className={`font-semibold ${wfResult.avgOosSharpe >= 0.5 ? 'text-[var(--accent-text)]' : 'text-rose-400'}`}>
                {wfResult.avgOosSharpe.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-[10.5px] text-slate-400 font-sans">WFE (OOS/IS)</div>
              <div className="text-slate-100 font-semibold">{wfResult.robustnessRatio.toFixed(2)}</div>
            </div>
            <button
              type="button"
              onClick={() => setTab('walkforward')}
              className="px-3 py-1.5 rounded bg-[var(--bg-elevated)] hover:brightness-110 border border-[var(--border-strong)] text-[var(--accent-text)] font-sans text-xs whitespace-nowrap"
            >
              Inspect 4-Fold Matrix →
            </button>
          </div>
        </div>

        {/* Selected Cell / Plateau Robustness Summary & Apply Action */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-md bg-[var(--bg-inset)] border border-[var(--border-hairline)]">
          <div className="flex flex-wrap items-center gap-6 text-xs font-mono tabular-nums">
            <div>
              <div className="text-[11px] text-slate-500 font-sans">Selected Combination</div>
              <div className="text-slate-100 font-semibold mt-0.5">
                {inspectedCell.atrMult.toFixed(2)}x ATR ·{' '}
                {axisMode === 'atr_vs_rr'
                  ? `1:${inspectedCell.minRR.toFixed(1)} RR`
                  : inspectedCell.mlThresholdPct === 0
                    ? 'ML Off'
                    : `ML >= ${inspectedCell.mlThresholdPct}%`}
                {inspectedCell.rowIdx === heatmap.mostRobustPlateau.rowIdx &&
                  inspectedCell.colIdx === heatmap.mostRobustPlateau.colIdx && (
                    <span className="ml-2 text-[var(--accent-text)]">(Most Robust Plateau)</span>
                  )}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-sans">Sharpe</div>
              <div className="text-[var(--accent-text)] font-semibold mt-0.5">{inspectedCell.sharpeRatio.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-sans">Sortino</div>
              <div className="text-emerald-300 font-semibold mt-0.5">{inspectedCell.sortinoRatio.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-sans">Neighborhood Score</div>
              <div className="text-slate-200 font-semibold mt-0.5">{inspectedCell.plateauScore.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-sans">Win Rate / DD / Sample</div>
              <div className="text-slate-200 mt-0.5">
                {inspectedCell.winRate.toFixed(1)}% / -{inspectedCell.maxDrawdownPct.toFixed(2)}% ·{' '}
                <span className={inspectedCell.totalTrades < 20 ? 'text-amber-300' : 'text-slate-300'}>
                  {inspectedCell.totalTrades}T{inspectedCell.totalTrades < 20 ? ' (Low Sample)' : ''}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => applyCellToSimulator(inspectedCell)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Check className="w-3.5 h-3.5" />
            Apply Parameters to Backtest
          </button>
        </div>
      </div>
    </div>
  );
};
