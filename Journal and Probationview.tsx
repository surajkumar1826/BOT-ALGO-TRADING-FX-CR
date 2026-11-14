import React, { useMemo, useState } from 'react';
import { RiskSettings, TradeJournalEntry } from '../types/trading';
import { CheckCircle2, Download, Lock, RotateCcw } from 'lucide-react';

interface JournalAndProbationViewProps {
  journal: TradeJournalEntry[];
  risk: RiskSettings;
  todayTradesCount: number;
  lastSavedAt: number | null;
  onAdvanceProbationDay: () => void;
  onResetHistory: () => void;
}

interface EquityCurveNode {
  index: number;
  equity: number;
  peak: number;
  ddPct: number;
  label: string;
  subText: string;
  isPositive: boolean;
}

function buildSmoothCurvePath(coords: { x: number; y: number }[]): string {
  if (coords.length === 0) return '';
  if (coords.length === 1) return `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[Math.max(0, i - 1)];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[Math.min(coords.length - 1, i + 2)];
    const tension = 0.22;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function computeEquityStats(
  items: { pnl: number; symbol: string; direction: string; rMultiple: number }[],
  startBal = 50000
) {
  let eq = startBal;
  let peak = eq;
  let maxDd = 0;
  const nodes: EquityCurveNode[] = [
    {
      index: 0,
      equity: startBal,
      peak: startBal,
      ddPct: 0,
      label: 'Start',
      subText: `Initial Capital $${startBal.toLocaleString()}`,
      isPositive: true,
    },
  ];
  const returns: number[] = [];

  const chronological = [...items].reverse();
  for (let i = 0; i < chronological.length; i++) {
    const j = chronological[i];
    const prev = eq;
    eq += j.pnl;
    peak = Math.max(peak, eq);
    const dd = peak > 0 ? ((peak - eq) / peak) * 100 : 0;
    maxDd = Math.max(maxDd, dd);
    returns.push(j.pnl / Math.max(1, prev));
    nodes.push({
      index: i + 1,
      equity: eq,
      peak,
      ddPct: dd,
      label: `#${i + 1} ${j.symbol}`,
      subText: `${j.direction} ${j.pnl >= 0 ? '+' : ''}$${j.pnl.toFixed(2)} (${j.rMultiple >= 0 ? '+' : ''}${j.rMultiple.toFixed(2)}R) · DD -${dd.toFixed(1)}%`,
      isPositive: j.pnl >= 0,
    });
  }

  const wins = chronological.filter((j) => j.pnl > 0).length;
  const total = chronological.length;
  const winRate = total > 0 ? (wins / total) * 100 : 0;
  const netProfit = eq - startBal;
  const returnPct = (netProfit / startBal) * 100;
  const mean = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const std =
    returns.length > 1
      ? Math.sqrt(returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1))
      : 0.01;
  const sharpe = std > 1e-6 && total > 1 ? (mean / std) * Math.sqrt(252) : 0;

  return { startBal, eq, peak, netProfit, returnPct, maxDd, winRate, sharpe, total, nodes };
}

export const JournalAndProbationView: React.FC<JournalAndProbationViewProps> = ({
  journal,
  risk,
  todayTradesCount,
  lastSavedAt,
  onAdvanceProbationDay,
  onResetHistory,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const realStats = useMemo(() => computeEquityStats(journal, 50000), [journal]);

  const probationPct = Math.min(100, Math.round((risk.probationDaysCompleted / risk.probationTargetDays) * 100));
  const liveEligible =
    risk.probationDaysCompleted >= risk.probationTargetDays && realStats.sharpe >= 1.0 && realStats.maxDd <= 8.0;

  return (
    <div className="space-y-6">
      {/* 2-3 Month Paper Trading Validation Gate */}
      <div className="border border-[var(--border-hairline)] bg-[var(--bg-surface)] rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>Real Market Execution Mode</span>
              <span aria-hidden="true">·</span>
              <span className={todayTradesCount >= 3 ? 'text-amber-400 font-semibold font-mono' : 'text-emerald-400 font-semibold font-mono'}>
                Today: {todayTradesCount} / 3 Trades (All Markets Combined)
              </span>
              <span aria-hidden="true">·</span>
              <span className={liveEligible ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                {liveEligible ? 'Live Capital Eligible' : '2–3 Month Probation Active'}
              </span>
            </div>
            <h2 className="text-base font-display font-semibold text-slate-100 mt-1">
              Real Market Validation Gate ({risk.probationDaysCompleted} / {risk.probationTargetDays} Trading Days)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Requires minimum 60 trading days, Sharpe &ge; 1.0, Max Drawdown &le; 8%, and strict max 3 trades/day across all assets.
            </p>
          </div>
          <button
            onClick={onAdvanceProbationDay}
            className="px-3.5 py-2 text-xs font-medium bg-[var(--bg-elevated)] hover:bg-[var(--border-strong)] border border-[var(--border-strong)] text-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            Log Completed Paper Session (+1 Day)
          </button>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1.5">
            <span>Validation Progress</span>
            <span>{probationPct}%</span>
          </div>
          <div className="w-full h-2.5 bg-[var(--bg-inset)] border border-[var(--border-hairline)] rounded overflow-hidden">
            <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${probationPct}%` }} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 mt-4 pt-3 border-t border-slate-800/80 text-xs">
          <span className="flex items-center gap-1.5 text-slate-300">
            {risk.probationDaysCompleted >= 60 ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-slate-500" />
            )}
            60-Day Track Record ({risk.probationDaysCompleted}/60)
          </span>
          <span className="flex items-center gap-1.5 text-slate-300">
            {realStats.sharpe >= 1.0 ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-slate-500" />
            )}
            Sharpe &ge; 1.0 ({realStats.sharpe.toFixed(2)})
          </span>
          <span className="flex items-center gap-1.5 text-slate-300">
            {realStats.maxDd <= 8.0 ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-slate-500" />
            )}
            Max Drawdown &le; 8% (-{realStats.maxDd.toFixed(2)}%)
          </span>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Real Market Equity', val: `$${realStats.eq.toFixed(2)}`, cls: 'text-slate-100' },
          {
            label: 'Realized Net P&L',
            val: `${realStats.netProfit >= 0 ? '+' : ''}$${realStats.netProfit.toFixed(2)}`,
            cls: realStats.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400',
          },
          { label: 'Win Rate', val: `${realStats.winRate.toFixed(1)}%`, cls: 'text-slate-100' },
          { label: 'Max Drawdown', val: `-${realStats.maxDd.toFixed(2)}%`, cls: 'text-rose-400' },
          { label: 'Annualized Sharpe', val: realStats.sharpe.toFixed(2), cls: 'text-[var(--accent-text)]' },
        ].map((k) => (
          <div key={k.label} className="border border-[var(--border-hairline)] bg-[var(--bg-surface)] rounded-lg p-3.5">
            <div className="text-xs text-slate-400">{k.label}</div>
            <div className={`text-lg font-mono font-semibold mt-1 tabular-nums ${k.cls}`}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Equity Curve */}
      <div className="border border-[var(--border-hairline)] bg-[var(--bg-surface)] rounded-lg p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-display font-semibold text-slate-100">Real Market Account Equity Curve</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Smooth equity growth with high-water mark, drawdown shading, and trade markers (hover points for details)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums">
            <span className="text-slate-400">
              Start <span className="text-slate-200">${realStats.startBal.toLocaleString()}</span>
            </span>
            <span className="text-slate-400">
              Peak <span className="text-[var(--accent-text)]">${realStats.peak.toFixed(2)}</span>
            </span>
            <span className={realStats.returnPct >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
              {realStats.returnPct >= 0 ? '+' : ''}
              {realStats.returnPct.toFixed(2)}% ({realStats.total} Trades)
            </span>
          </div>
        </div>

        <div className="bg-[var(--bg-inset)] border border-[var(--border-hairline)] rounded-md p-3">
          <svg viewBox="0 0 760 230" className="w-full h-56 select-none" onMouseLeave={() => setHoveredIdx(null)}>
            {(() => {
              const nodes = realStats.nodes;
              const pad = { top: 20, right: 20, bottom: 30, left: 66 };
              const plotW = 760 - pad.left - pad.right;
              const plotH = 230 - pad.top - pad.bottom;

              const allVals = [...nodes.map((n) => n.equity), ...nodes.map((n) => n.peak), realStats.startBal];
              const rawMin = Math.min(...allVals);
              const rawMax = Math.max(...allVals);
              const rangePad = Math.max(40, (rawMax - rawMin) * 0.18);
              const minE = rawMin - rangePad;
              const maxE = rawMax + rangePad;
              const span = Math.max(10, maxE - minE);

              const toX = (i: number) =>
                nodes.length <= 1 ? pad.left + plotW / 2 : pad.left + (i / (nodes.length - 1)) * plotW;
              const toY = (v: number) => pad.top + ((maxE - v) / span) * plotH;

              const coords = nodes.map((n, i) => ({ x: toX(i), y: toY(n.equity) }));
              const peakCoords = nodes.map((n, i) => ({ x: toX(i), y: toY(n.peak) }));

              const smoothLine = buildSmoothCurvePath(coords);
              const baselineY = toY(realStats.startBal);
              const areaPath =
                coords.length > 1
                  ? `${smoothLine} L ${coords[coords.length - 1].x.toFixed(1)} ${(pad.top + plotH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(pad.top + plotH).toFixed(1)} Z`
                  : '';
              const peakLine = peakCoords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
              const drawdownPoly =
                coords.length > 1
                  ? `${peakCoords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} ${[...coords]
                      .reverse()
                      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
                      .join(' ')}`
                  : '';

              const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => minE + (maxE - minE) * t);
              const activeIdx = hoveredIdx !== null && nodes[hoveredIdx] ? hoveredIdx : nodes.length - 1;
              const activeNode = nodes[activeIdx];
              const activeCoord = coords[activeIdx];
              const isNetPositive = realStats.eq >= realStats.startBal;

              return (
                <g>
                  <defs>
                    <linearGradient id="realEquityAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={isNetPositive ? '#10B981' : '#F43F5E'} stopOpacity="0.30" />
                      <stop offset="85%" stopColor={isNetPositive ? '#10B981' : '#F43F5E'} stopOpacity="0.02" />
                    </linearGradient>
                  </defs>

                  {yTicks.map((tick, idx) => {
                    const y = toY(tick);
                    return (
                      <g key={idx}>
                        <line x1={pad.left} x2={pad.left + plotW} y1={y} y2={y} stroke="#1E293B" strokeWidth={1} />
                        <text
                          x={pad.left - 8}
                          y={y + 3.5}
                          textAnchor="end"
                          fill="#94A3B8"
                          fontSize="10"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          ${Math.round(tick).toLocaleString()}
                        </text>
                      </g>
                    );
                  })}

                  <line
                    x1={pad.left}
                    x2={pad.left + plotW}
                    y1={baselineY}
                    y2={baselineY}
                    stroke="#64748B"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />

                  {areaPath && <path d={areaPath} fill="url(#realEquityAreaGrad)" />}
                  {drawdownPoly && <polygon points={drawdownPoly} fill="rgba(244, 63, 94, 0.10)" />}
                  {peakLine && (
                    <polyline
                      fill="none"
                      stroke="rgba(217, 164, 65, 0.55)"
                      strokeWidth={1.1}
                      strokeDasharray="3 3"
                      points={peakLine}
                    />
                  )}

                  <path
                    d={smoothLine}
                    fill="none"
                    stroke={isNetPositive ? '#10B981' : '#F43F5E'}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />

                  {nodes.map((n, i) => {
                    const showLabel =
                      nodes.length <= 8 || i === 0 || i === nodes.length - 1 || i % Math.ceil(nodes.length / 6) === 0;
                    if (!showLabel) return null;
                    return (
                      <text
                        key={`xl-${n.index}`}
                        x={toX(i)}
                        y={pad.top + plotH + 18}
                        textAnchor="middle"
                        fill="#64748B"
                        fontSize="10"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {i === 0 ? 'Start' : `T${n.index}`}
                      </text>
                    );
                  })}

                  {activeCoord && (
                    <line
                      x1={activeCoord.x}
                      x2={activeCoord.x}
                      y1={pad.top}
                      y2={pad.top + plotH}
                      stroke="#475569"
                      strokeWidth={1}
                      strokeDasharray="2 2"
                    />
                  )}

                  {nodes.map((n, i) => {
                    const c = coords[i];
                    const isHover = i === activeIdx;
                    const dotColor = i === 0 ? '#94A3B8' : n.isPositive ? '#10B981' : '#F43F5E';
                    return (
                      <g
                        key={`pt-${n.index}`}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredIdx(i)}
                        onClick={() => setHoveredIdx(i)}
                      >
                        <circle cx={c.x} cy={c.y} r={14} fill="transparent" />
                        <circle
                          cx={c.x}
                          cy={c.y}
                          r={isHover ? 5.2 : 3.4}
                          fill={dotColor}
                          stroke="#0B0F17"
                          strokeWidth={1.6}
                        />
                      </g>
                    );
                  })}

                  {activeNode &&
                    activeCoord &&
                    (() => {
                      const tipW = 224;
                      const tipH = 48;
                      const tipX = Math.min(pad.left + plotW - tipW, Math.max(pad.left + 6, activeCoord.x - tipW / 2));
                      const tipY = Math.max(pad.top + 4, activeCoord.y - tipH - 12);
                      return (
                        <g pointerEvents="none">
                          <rect
                            x={tipX}
                            y={tipY}
                            width={tipW}
                            height={tipH}
                            rx={5}
                            fill="#0F172A"
                            stroke="#334155"
                            strokeWidth={1}
                          />
                          <text
                            x={tipX + 9}
                            y={tipY + 15}
                            fill="#F8FAFC"
                            fontSize="10.5"
                            fontWeight="700"
                            fontFamily="JetBrains Mono, monospace"
                          >
                            {activeNode.label} · ${activeNode.equity.toFixed(2)}
                          </text>
                          <text
                            x={tipX + 9}
                            y={tipY + 32}
                            fill={activeNode.index === 0 ? '#94A3B8' : activeNode.isPositive ? '#34D399' : '#FB7185'}
                            fontSize="9.5"
                            fontFamily="JetBrains Mono, monospace"
                          >
                            {activeNode.subText}
                          </text>
                        </g>
                      );
                    })()}
                </g>
              );
            })()}
          </svg>

          <div className="mt-2 pt-2 border-t border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-slate-400">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-emerald-400 inline-block" />
                Equity Curve
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t border-dashed border-amber-400 inline-block" />
                High-Water Mark
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-500/20 border border-rose-500/40 inline-block" />
                Drawdown Zone
              </span>
            </div>
            <span>Baseline: $50,000.00</span>
          </div>
        </div>
      </div>

      {/* Real Market Trade Ledger */}
      <div className="border border-[var(--border-hairline)] bg-[var(--bg-surface)] rounded-lg p-5 overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-sm font-display font-semibold text-slate-100">
              Real Market Trade Journal ({journal.length} Closed Trades)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Automatically persisted to server &amp; browser storage
              {lastSavedAt
                ? ` · Last saved ${new Date(lastSavedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}`
                : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const headers = [
                  'Symbol',
                  'Direction',
                  'Strategy',
                  'Score',
                  'Entry',
                  'Exit',
                  'StopLoss',
                  'TakeProfit',
                  'Lots',
                  'RMultiple',
                  'PnL',
                  'ExitReason',
                  'OpenedAt',
                  'ClosedAt',
                  'Rationale',
                ];
                const rows = journal.map((j) => [
                  j.symbol,
                  j.direction,
                  `"${j.strategyLabel}"`,
                  j.confluenceScore,
                  j.entryPrice,
                  j.exitPrice,
                  j.stopLoss,
                  j.takeProfit,
                  j.lots,
                  j.rMultiple,
                  j.pnl,
                  j.exitReason,
                  new Date(j.openedAt).toISOString(),
                  new Date(j.closedAt).toISOString(),
                  `"${j.rationale.join(' | ').replace(/"/g, '""')}"`,
                ]);
                const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `fx_futures_real_market_journal_${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--bg-elevated)] hover:bg-[var(--border-strong)] border border-[var(--border-strong)] text-slate-200 rounded transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button
              onClick={onResetHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--bg-inset)] hover:bg-rose-500/15 border border-[var(--border-strong)] hover:border-rose-500/40 text-slate-300 hover:text-rose-300 rounded transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Saved History
            </button>
          </div>
        </div>
        <table className="w-full min-w-[780px] text-xs font-mono tabular-nums">
          <thead className="bg-[var(--bg-elevated)] text-slate-400">
            <tr>
              <th className="p-2.5 text-left">Symbol</th>
              <th className="p-2.5 text-left">Side</th>
              <th className="p-2.5 text-left">Strategy</th>
              <th className="p-2.5 text-right">Score</th>
              <th className="p-2.5 text-right">Entry / Exit</th>
              <th className="p-2.5 text-right">R-Mult</th>
              <th className="p-2.5 text-right">P&amp;L</th>
              <th className="p-2.5 text-left">Exit Reason</th>
              <th className="p-2.5 text-left">Logged Rationale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {journal.map((j) => (
              <tr key={j.id} className="hover:bg-slate-800/30 align-top">
                <td className="p-2.5 font-semibold text-slate-100">{j.symbol}</td>
                <td className={`p-2.5 font-semibold ${j.direction === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {j.direction}
                </td>
                <td className="p-2.5 font-sans text-slate-300">{j.strategyLabel}</td>
                <td className="p-2.5 text-right text-[var(--accent-text)]">{j.confluenceScore}/100</td>
                <td className="p-2.5 text-right text-slate-300">
                  {j.entryPrice} → {j.exitPrice}
                </td>
                <td className={`p-2.5 text-right ${j.rMultiple >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {j.rMultiple >= 0 ? '+' : ''}
                  {j.rMultiple.toFixed(2)}R
                </td>
                <td className={`p-2.5 text-right font-semibold ${j.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {j.pnl >= 0 ? '+' : ''}${j.pnl.toFixed(2)}
                </td>
                <td className="p-2.5 text-slate-400">{j.exitReason.replace(/_/g, ' ')}</td>
                <td className="p-2.5 font-sans text-slate-400 max-w-xs">{j.rationale.slice(0, 3).join(' · ')}</td>
              </tr>
            ))}
            {journal.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-slate-500 font-sans">
                  No real-market trades logged yet. Execute a setup from the Terminal &amp; Scanner tab.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
