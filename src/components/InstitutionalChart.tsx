import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Candle,
  CandleColors,
  ChartLayerState,
  SymbolAnalysis,
  ThemeId,
  Timeframe,
  TradeSetup,
} from '../types/trading';
import {
  extractSessionWindows,
  getCandleCountdownLabel,
  getLiveSessionOverlayInfo,
  getTimeframeCandles,
  isMarketOpen,
  MarketStore,
  sanitizeAndSortCandles,
  TIMEFRAME_LIST,
  TIMEFRAME_SECONDS,
} from '../engine/marketData';
import {
  computeATR,
  computeAutoFibSwing,
  computeBollinger,
  computeEMA,
  computeMultiTimeframeBias,
  computeVolumeFlow,
  detectSMC,
  detectSwings,
} from '../engine/quantAnalysis';
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Crosshair,
  Minus,
  MousePointer2,
  Palette,
  PenTool,
  Percent,
  RotateCcw,
  Ruler,
  Trash2,
  TrendingDown,
  TrendingUp,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

export type DrawingToolId =
  | 'pan'
  | 'crosshair'
  | 'trendline'
  | 'hline'
  | 'fib'
  | 'long_rr'
  | 'short_rr'
  | 'ruler';

interface ChartDrawing {
  id: string;
  tool: Exclude<DrawingToolId, 'pan' | 'crosshair'>;
  symbol: string;
  startIdx: number;
  startPrice: number;
  endIdx: number;
  endPrice: number;
}

interface InstitutionalChartProps {
  store: MarketStore;
  analysis: SymbolAnalysis;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  layers: ChartLayerState;
  onToggleLayer: (key: keyof ChartLayerState) => void;
  activeSetup: TradeSetup | null;
  externalCandles?: Candle[] | null;
  feedSourceLabel?: string;
  theme?: ThemeId;
  candleColors?: CandleColors | null;
  onChangeCandleColors?: (colors: CandleColors | null) => void;
}

interface SvgPalette {
  canvas: string;
  grid: string;
  divider: string;
  bull: string;
  bear: string;
  accent: string;
  accentText: string;
  axisText: string;
  crosshairTagBg: string;
  crosshairTagStroke: string;
}

const SVG_PALETTES: Record<ThemeId, SvgPalette> = {
  obsidian_gold: {
    canvas: '#08090D',
    grid: '#161922',
    divider: '#232734',
    bull: '#14B8A6',
    bear: '#F43F5E',
    accent: '#D9A441',
    accentText: '#F3C96B',
    axisText: '#94A3B8',
    crosshairTagBg: '#1C202B',
    crosshairTagStroke: '#475569',
  },
  emerald_carbon: {
    canvas: '#070B0A',
    grid: '#13201E',
    divider: '#1D2E2B',
    bull: '#10B981',
    bear: '#FB7185',
    accent: '#10B981',
    accentText: '#5EEAD4',
    axisText: '#94A3B8',
    crosshairTagBg: '#162421',
    crosshairTagStroke: '#2B4540',
  },
  slate_cobalt: {
    canvas: '#0B0F17',
    grid: '#162032',
    divider: '#1E293B',
    bull: '#10B981',
    bear: '#EF4444',
    accent: '#3B82F6',
    accentText: '#93C5FD',
    axisText: '#94A3B8',
    crosshairTagBg: '#1E293B',
    crosshairTagStroke: '#475569',
  },
};

function formatAxisTime(unixSec: number, tf: Timeframe, full = false, includeDate = false): string {
  const d = new Date(unixSec * 1000);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getUTCDate()).padStart(2, '0');
  const mon = months[d.getUTCMonth()];
  const yr = String(d.getUTCFullYear()).slice(-2);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');

  if (tf === '1M') return `${mon} '${yr}`;
  if (tf === '1D' || tf === '1W') return full ? `${day} ${mon} '${yr}` : `${day} ${mon}`;
  if (full || includeDate) return `${day} ${mon} ${hh}:${mm}`;
  return `${hh}:${mm}`;
}

function formatDurationSeconds(sec: number): string {
  const abs = Math.max(0, Math.round(sec));
  const d = Math.floor(abs / 86400);
  const h = Math.floor((abs % 86400) / 3600);
  const m = Math.floor((abs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const CANDLE_COLOR_PRESETS: Array<{ id: string; label: string; bull: string; bear: string }> = [
  { id: 'teal_rose', label: 'Teal / Rose', bull: '#14B8A6', bear: '#F43F5E' },
  { id: 'green_red', label: 'Green / Red', bull: '#22C55E', bear: '#EF4444' },
  { id: 'blue_orange', label: 'Blue / Orange', bull: '#3B82F6', bear: '#F97316' },
  { id: 'gold_crimson', label: 'Gold / Crimson', bull: '#F59E0B', bear: '#E11D48' },
  { id: 'ice_slate', label: 'Ice / Slate', bull: '#E2E8F0', bear: '#64748B' },
];

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  return `rgba(20, 184, 166, ${alpha})`;
}

export const InstitutionalChart: React.FC<InstitutionalChartProps> = ({
  store,
  analysis,
  timeframe,
  onTimeframeChange,
  layers,
  onToggleLayer,
  activeSetup,
  externalCandles,
  feedSourceLabel,
  theme = 'obsidian_gold',
  candleColors,
  onChangeCandleColors,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const colorPopoverRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 920, height: 490 });
  const [barWindow, setBarWindow] = useState<number>(74);
  const [panBars, setPanBars] = useState<number>(0);
  const [yScaleFactor, setYScaleFactor] = useState<number>(1.0);
  const [fibSensitivity, setFibSensitivity] = useState<number>(72);
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number } | null>(null);
  const [activeTool, setActiveTool] = useState<DrawingToolId>('pan');
  const [drawings, setDrawings] = useState<ChartDrawing[]>([]);
  const [draftDrawing, setDraftDrawing] = useState<ChartDrawing | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [localCandleColors, setLocalCandleColors] = useState<CandleColors | null>(null);

  const basePalette = SVG_PALETTES[theme];
  const activeCandleColors = candleColors !== undefined ? candleColors : localCandleColors;
  const palette: SvgPalette = {
    ...basePalette,
    bull: activeCandleColors?.bull || basePalette.bull,
    bear: activeCandleColors?.bear || basePalette.bear,
  };

  const applyCandleColors = (next: CandleColors | null) => {
    if (onChangeCandleColors) {
      onChangeCandleColors(next);
    } else {
      setLocalCandleColors(next);
    }
  };

  useEffect(() => {
    if (!colorMenuOpen) return;
    const onDocDown = (e: MouseEvent) => {
      if (colorPopoverRef.current && !colorPopoverRef.current.contains(e.target as Node)) {
        setColorMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [colorMenuOpen]);

  // Live 1-second clock for candle close countdown & live session overlay
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(300, Math.floor(entry.contentRect.width));
        const h = Math.max(440, Math.floor(entry.contentRect.height));
        setSize({ width: w, height: h });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const usingExternal = Boolean(externalCandles && externalCandles.length >= 25);
  const marketStatus = isMarketOpen(analysis.meta.id, nowMs);

  const allCandles: Candle[] = useMemo(() => {
    if (externalCandles && externalCandles.length >= 25) {
      const sorted = sanitizeAndSortCandles(externalCandles.map((c) => ({ ...c })));
      if (sorted.length > 0 && marketStatus.open) {
        const last = sorted[sorted.length - 1];
        const priceDiffPct = Math.abs(last.close - analysis.currentPrice) / Math.max(1e-9, last.close);
        if (priceDiffPct < 0.03) {
          last.close = analysis.currentPrice;
          last.high = Math.max(last.high, analysis.currentPrice);
          last.low = Math.min(last.low, analysis.currentPrice);
        }
      }
      return sorted;
    }
    return sanitizeAndSortCandles(getTimeframeCandles(analysis.meta.id, timeframe, store, 260));
  }, [externalCandles, analysis.meta.id, analysis.currentPrice, timeframe, store, marketStatus.open]);

  const pad = { top: 22, right: 86, bottom: 30, left: 8 };
  const plotW = Math.max(160, size.width - pad.left - pad.right);
  const plotH = Math.max(200, size.height - pad.top - pad.bottom);

  // Inertial physics + smooth zoom refs
  const physicsRef = useRef({
    pan: 0,
    targetPan: 0,
    window: 74,
    targetWindow: 74,
    yScale: 1.0,
    targetYScale: 1.0,
    velocityPan: 0,
    isDragging: false,
    maxPan: 180,
    rafId: 0 as number,
    lastFrameTime: 0,
  });

  const maxPan = Math.max(0, allCandles.length - Math.max(14, Math.floor(barWindow * 0.45)));
  physicsRef.current.maxPan = maxPan;

  const ensurePhysicsLoop = () => {
    if (physicsRef.current.rafId) return;
    physicsRef.current.lastFrameTime = performance.now();

    const step = (now: number) => {
      const p = physicsRef.current;
      const dt = Math.min(0.05, Math.max(0.004, (now - p.lastFrameTime) / 1000));
      p.lastFrameTime = now;
      const frames60 = dt * 60;
      let keepRunning = false;

      // 1. Inertial coasting after drag release
      if (!p.isDragging && Math.abs(p.velocityPan) > 0.015) {
        p.targetPan = Math.max(0, Math.min(p.maxPan, p.targetPan + p.velocityPan * dt));
        p.pan = p.targetPan;
        p.velocityPan *= Math.pow(0.91, frames60);
        if (p.targetPan <= 0 || p.targetPan >= p.maxPan) {
          p.velocityPan = 0;
        }
        keepRunning = true;
      } else if (!p.isDragging) {
        p.velocityPan = 0;
      }

      // 2. Smooth exponential easing toward targetPan
      const panDiff = p.targetPan - p.pan;
      if (Math.abs(panDiff) > 0.004) {
        const ease = 1 - Math.pow(1 - 0.28, frames60);
        p.pan += panDiff * ease;
        keepRunning = true;
      } else {
        p.pan = p.targetPan;
      }

      // 3. Smooth exponential easing toward targetWindow (scroll-to-zoom)
      const winDiff = p.targetWindow - p.window;
      if (Math.abs(winDiff) > 0.02) {
        const ease = 1 - Math.pow(1 - 0.25, frames60);
        p.window += winDiff * ease;
        keepRunning = true;
      } else {
        p.window = p.targetWindow;
      }

      // 4. Smooth Y-scale easing
      const yDiff = p.targetYScale - p.yScale;
      if (Math.abs(yDiff) > 0.002) {
        const ease = 1 - Math.pow(1 - 0.26, frames60);
        p.yScale += yDiff * ease;
        keepRunning = true;
      } else {
        p.yScale = p.targetYScale;
      }

      p.pan = Math.max(0, Math.min(p.maxPan, p.pan));
      p.targetPan = Math.max(0, Math.min(p.maxPan, p.targetPan));

      setPanBars(p.pan);
      setBarWindow(p.window);
      setYScaleFactor(p.yScale);

      if (keepRunning) {
        p.rafId = requestAnimationFrame(step);
      } else {
        p.rafId = 0;
      }
    };

    physicsRef.current.rafId = requestAnimationFrame(step);
  };

  useEffect(() => {
    return () => {
      if (physicsRef.current.rafId) cancelAnimationFrame(physicsRef.current.rafId);
    };
  }, []);

  // Reset pan/zoom smoothly when switching symbol or timeframe
  useEffect(() => {
    const p = physicsRef.current;
    p.velocityPan = 0;
    p.targetPan = 0;
    p.targetWindow = 74;
    p.targetYScale = 1.0;
    ensurePhysicsLoop();
  }, [analysis.meta.id, timeframe]);

  // Escape key returns to Pan mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDraftDrawing(null);
        setActiveTool('pan');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const tfAnalytics = useMemo(() => {
    if (!usingExternal && timeframe === '15m' && fibSensitivity === 72) {
      return {
        ema50: analysis.ema50,
        ema200: analysis.ema200,
        bbUpper: analysis.bbUpper,
        bbLower: analysis.bbLower,
        structureBreaks: analysis.structureBreaks,
        orderBlocks: analysis.orderBlocks,
        fvgs: analysis.fvgs,
        liquiditySweeps: analysis.liquiditySweeps,
        autoFib: analysis.autoFib,
        volumeFlow: analysis.volumeFlow,
        sessionWindows: extractSessionWindows(allCandles, timeframe),
      };
    }

    const closes = allCandles.map((c) => c.close);
    const ema50 = computeEMA(closes, 50);
    const ema200 = computeEMA(closes, 200);
    const { upper: bbUpper, lower: bbLower } = computeBollinger(closes, 20, 2);
    const atrSeries = computeATR(allCandles, 14);
    const atr = atrSeries[atrSeries.length - 1] || analysis.atr14;
    const swings = detectSwings(allCandles, timeframe === '1W' || timeframe === '1M' ? 3 : 4);
    const smc = detectSMC(allCandles, swings, atr);
    const autoFib = computeAutoFibSwing(allCandles, swings, analysis.meta, Math.min(allCandles.length, fibSensitivity));
    const volumeFlow = computeVolumeFlow(allCandles, swings, analysis.meta);
    const sessionWindows = extractSessionWindows(allCandles, timeframe);

    return {
      ema50,
      ema200,
      bbUpper,
      bbLower,
      structureBreaks: smc.structureBreaks,
      orderBlocks: smc.orderBlocks,
      fvgs: smc.fvgs,
      liquiditySweeps: smc.liquiditySweeps,
      autoFib,
      volumeFlow,
      sessionWindows,
    };
  }, [usingExternal, allCandles, analysis, timeframe, fibSensitivity]);

  const mtfBiasList = useMemo(
    () =>
      computeMultiTimeframeBias(
        analysis.meta.id,
        store,
        timeframe,
        usingExternal ? allCandles : null
      ),
    [analysis.meta.id, store, timeframe, usingExternal, allCandles]
  );
  const activeTfBias = mtfBiasList.find((b) => b.timeframe === timeframe) ?? mtfBiasList[2];
  const bullishCount = mtfBiasList.filter((b) => b.bias === 'BULLISH').length;
  const bearishCount = mtfBiasList.filter((b) => b.bias === 'BEARISH').length;
  const neutralCount = mtfBiasList.filter((b) => b.bias === 'NEUTRAL').length;
  const overallBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' =
    bullishCount === bearishCount ? 'NEUTRAL' : bullishCount > bearishCount ? 'BULLISH' : 'BEARISH';

  const clampedPan = Math.max(0, Math.min(maxPan, panBars));
  const exactEndFloat = allCandles.length - 1 - clampedPan;
  const exactStartFloat = exactEndFloat - (barWindow - 1);
  const visStartIdx = Math.max(0, Math.floor(exactStartFloat) - 1);
  const visEndIdx = Math.min(allCandles.length - 1, Math.ceil(exactEndFloat) + 1);

  const stepX = plotW / Math.max(1, barWindow);
  const globalIndexToX = (gIdx: number) => pad.left + (gIdx - exactStartFloat + 0.5) * stepX;
  const xToGlobalIndex = (x: number) => (x - pad.left) / Math.max(0.5, stepX) - 0.5 + exactStartFloat;

  const visibleSlice = useMemo(
    () => allCandles.slice(visStartIdx, visEndIdx + 1),
    [allCandles, visStartIdx, visEndIdx]
  );

  const { minPrice, maxPrice } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const c of visibleSlice) {
      if (c.low < lo) lo = c.low;
      if (c.high > hi) hi = c.high;
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
      lo = analysis.currentPrice * 0.99;
      hi = analysis.currentPrice * 1.01;
    }
    if (layers.tradeLevels && activeSetup && clampedPan < 10) {
      lo = Math.min(lo, activeSetup.stopLoss);
      hi = Math.max(hi, activeSetup.takeProfit2);
    }
    const rawSpan = Math.max(analysis.meta.pipSize * 8, hi - lo);
    const mid = (hi + lo) / 2;
    const adjustedHalfSpan = ((rawSpan * 1.18) / 2) / Math.max(0.35, yScaleFactor);
    return {
      minPrice: mid - adjustedHalfSpan,
      maxPrice: mid + adjustedHalfSpan,
    };
  }, [visibleSlice, layers.tradeLevels, activeSetup, clampedPan, analysis.currentPrice, analysis.meta.pipSize, yScaleFactor]);

  const priceToY = (p: number) => {
    const ratio = (maxPrice - p) / Math.max(1e-9, maxPrice - minPrice);
    return pad.top + ratio * plotH;
  };

  const yToPrice = (y: number) => {
    const ratio = (y - pad.top) / Math.max(1, plotH);
    return maxPrice - ratio * (maxPrice - minPrice);
  };

  const dec = analysis.meta.decimals;
  const liveCandle = allCandles[allCandles.length - 1];
  const livePrice = liveCandle.close;
  const liveIsBull = liveCandle.close >= liveCandle.open;
  const countdownText = getCandleCountdownLabel(timeframe, nowMs);
  const liveSession = getLiveSessionOverlayInfo(nowMs);

  // Active live session range from today's candles for Live Session Overlay HUD
  const latestSessionStats = useMemo(() => {
    const lastWin = tfAnalytics.sessionWindows[tfAnalytics.sessionWindows.length - 1];
    if (!lastWin) return null;
    const rangePips = Math.round((lastWin.high - lastWin.low) / analysis.meta.pipSize);
    return {
      label: lastWin.label,
      high: lastWin.high,
      low: lastWin.low,
      rangePips,
    };
  }, [tfAnalytics.sessionWindows, analysis.meta.pipSize]);

  // Pointer drag state & inertial velocity ring buffer
  const dragRef = useRef<{
    mode: 'NONE' | 'PAN_X' | 'SCALE_Y' | 'DRAW';
    startX: number;
    startY: number;
    startPan: number;
    startYScale: number;
    samples: Array<{ pan: number; t: number }>;
  }>({ mode: 'NONE', startX: 0, startY: 0, startPan: 0, startYScale: 1, samples: [] });
  const pinchRef = useRef<{ dist: number; startWindow: number } | null>(null);
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());

  const hoveredBarInfo = useMemo(() => {
    if (!pointerPos) return null;
    if (pointerPos.x < pad.left || pointerPos.x > pad.left + plotW) return null;
    const rawIdx = Math.round(xToGlobalIndex(pointerPos.x));
    const idx = Math.max(0, Math.min(allCandles.length - 1, rawIdx));
    const candle = allCandles[idx];
    const clampedY = Math.max(pad.top, Math.min(pad.top + plotH, pointerPos.y));
    return {
      idx,
      candle,
      x: globalIndexToX(idx),
      y: clampedY,
      price: yToPrice(clampedY),
    };
  }, [pointerPos, pad.left, pad.top, plotW, plotH, stepX, exactStartFloat, allCandles, minPrice, maxPrice]);

  const headerCandle = hoveredBarInfo ? hoveredBarInfo.candle : liveCandle;

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;

    e.currentTarget.setPointerCapture(e.pointerId);
    activePointersRef.current.set(e.pointerId, { x: localX, y: localY });

    // Multi-touch pinch zoom
    if (activePointersRef.current.size === 2) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchRef.current = { dist, startWindow: physicsRef.current.targetWindow };
      dragRef.current.mode = 'NONE';
      physicsRef.current.isDragging = false;
      return;
    }

    // Stop active inertial coast immediately on touch/click
    physicsRef.current.velocityPan = 0;

    // Right Y-axis gutter -> vertical scale drag
    if (localX >= pad.left + plotW) {
      dragRef.current = {
        mode: 'SCALE_Y',
        startX: localX,
        startY: localY,
        startPan: physicsRef.current.pan,
        startYScale: physicsRef.current.yScale,
        samples: [],
      };
      return;
    }

    // Active Drawing Tool placement (trendline, hline, fib, long_rr, short_rr, ruler)
    if (activeTool !== 'pan' && activeTool !== 'crosshair') {
      const idx = xToGlobalIndex(localX);
      const price = yToPrice(Math.max(pad.top, Math.min(pad.top + plotH, localY)));

      if (activeTool === 'hline') {
        const created: ChartDrawing = {
          id: `drw-${Date.now()}`,
          tool: 'hline',
          symbol: analysis.meta.id,
          startIdx: idx,
          startPrice: price,
          endIdx: idx,
          endPrice: price,
        };
        setDrawings((prev) => [...prev, created]);
        return;
      }

      if (activeTool === 'long_rr' || activeTool === 'short_rr') {
        const atrSpan = Math.max(analysis.meta.pipSize * 8, analysis.atr14 * 1.4);
        const slPrice = activeTool === 'long_rr' ? price - atrSpan : price + atrSpan;
        const tpPrice = activeTool === 'long_rr' ? price + atrSpan * 2.2 : price - atrSpan * 2.2;
        const created: ChartDrawing = {
          id: `drw-${Date.now()}`,
          tool: activeTool,
          symbol: analysis.meta.id,
          startIdx: idx,
          startPrice: price,
          endIdx: idx + 14,
          endPrice: tpPrice,
        };
        // Store SL implicitly via endPrice? Let's allow dragging SL or default 1:2.2 RR cleanly
        void slPrice;
        setDraftDrawing(created);
        dragRef.current = {
          mode: 'DRAW',
          startX: localX,
          startY: localY,
          startPan: physicsRef.current.pan,
          startYScale: physicsRef.current.yScale,
          samples: [],
        };
        return;
      }

      const draft: ChartDrawing = {
        id: `drw-${Date.now()}`,
        tool: activeTool,
        symbol: analysis.meta.id,
        startIdx: idx,
        startPrice: price,
        endIdx: idx,
        endPrice: price,
      };
      setDraftDrawing(draft);
      dragRef.current = {
        mode: 'DRAW',
        startX: localX,
        startY: localY,
        startPan: physicsRef.current.pan,
        startYScale: physicsRef.current.yScale,
        samples: [],
      };
      return;
    }

    // Smooth Inertial Drag-to-Pan
    physicsRef.current.isDragging = true;
    const now = performance.now();
    dragRef.current = {
      mode: 'PAN_X',
      startX: localX,
      startY: localY,
      startPan: physicsRef.current.pan,
      startYScale: physicsRef.current.yScale,
      samples: [{ pan: physicsRef.current.pan, t: now }],
    };
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;

    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: localX, y: localY });
    }

    if (activePointersRef.current.size === 2 && pinchRef.current) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.max(10, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
      const scale = pinchRef.current.dist / dist;
      physicsRef.current.targetWindow = Math.max(18, Math.min(190, pinchRef.current.startWindow * scale));
      ensurePhysicsLoop();
      return;
    }

    setPointerPos({ x: localX, y: localY });

    if (dragRef.current.mode === 'PAN_X') {
      const dx = localX - dragRef.current.startX;
      const deltaBars = dx / Math.max(2, stepX);
      const nextPan = Math.max(0, Math.min(maxPan, dragRef.current.startPan + deltaBars));
      const now = performance.now();

      physicsRef.current.pan = nextPan;
      physicsRef.current.targetPan = nextPan;
      setPanBars(nextPan);

      dragRef.current.samples.push({ pan: nextPan, t: now });
      // Keep only last 100ms of samples for crisp inertial throw velocity
      dragRef.current.samples = dragRef.current.samples.filter((s) => now - s.t <= 100);
    } else if (dragRef.current.mode === 'SCALE_Y') {
      const dy = dragRef.current.startY - localY;
      const nextScale = Math.max(0.4, Math.min(2.8, dragRef.current.startYScale * Math.exp(dy / 140)));
      physicsRef.current.yScale = nextScale;
      physicsRef.current.targetYScale = nextScale;
      setYScaleFactor(nextScale);
    } else if (dragRef.current.mode === 'DRAW' && draftDrawing) {
      const idx = xToGlobalIndex(localX);
      const price = yToPrice(Math.max(pad.top, Math.min(pad.top + plotH, localY)));
      setDraftDrawing({ ...draftDrawing, endIdx: idx, endPrice: price });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size < 2) pinchRef.current = null;

    if (dragRef.current.mode === 'PAN_X') {
      physicsRef.current.isDragging = false;
      const samples = dragRef.current.samples;
      const now = performance.now();
      if (samples.length >= 2) {
        const first = samples[0];
        const last = samples[samples.length - 1];
        const dtSec = (last.t - first.t) / 1000;
        if (now - last.t < 65 && dtSec > 0.008) {
          const rawVel = (last.pan - first.pan) / dtSec;
          physicsRef.current.velocityPan = Math.max(-180, Math.min(180, rawVel));
          ensurePhysicsLoop();
        }
      }
    } else if (dragRef.current.mode === 'DRAW' && draftDrawing) {
      let finalized = draftDrawing;
      // If user clicked once for Long/Short RR without dragging far, auto-size clean 1:2.2 box
      if (
        (draftDrawing.tool === 'long_rr' || draftDrawing.tool === 'short_rr') &&
        Math.abs(draftDrawing.endPrice - draftDrawing.startPrice) < analysis.meta.pipSize * 4
      ) {
        const atrSpan = Math.max(analysis.meta.pipSize * 8, analysis.atr14 * 1.4);
        finalized = {
          ...draftDrawing,
          endIdx: draftDrawing.startIdx + 14,
          endPrice:
            draftDrawing.tool === 'long_rr'
              ? draftDrawing.startPrice + atrSpan * 2.2
              : draftDrawing.startPrice - atrSpan * 2.2,
        };
      }
      if (
        finalized.tool === 'long_rr' ||
        finalized.tool === 'short_rr' ||
        Math.abs(finalized.endIdx - finalized.startIdx) > 0.4 ||
        Math.abs(finalized.endPrice - finalized.startPrice) > analysis.meta.pipSize * 0.5
      ) {
        setDrawings((prev) => [...prev, finalized]);
      }
      setDraftDrawing(null);
    }

    dragRef.current.mode = 'NONE';
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  // Smooth Cursor-Anchored Scroll-to-Zoom + Trackpad Horizontal Pan with Inertial Easing
  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const p = physicsRef.current;

    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.15) {
      const deltaBars = -e.deltaX / Math.max(4, stepX);
      p.targetPan = Math.max(0, Math.min(p.maxPan, p.targetPan + deltaBars));
      ensurePhysicsLoop();
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const anchorRatio = Math.max(0.05, Math.min(0.95, (localX - pad.left) / Math.max(1, plotW)));

    const oldWin = p.targetWindow;
    const zoomFactor = Math.exp(e.deltaY * 0.0014);
    const nextWin = Math.max(18, Math.min(190, oldWin * zoomFactor));

    // Anchor zoom so the candle under the cursor stays stationary while zooming
    const panShift = (oldWin - nextWin) * (1 - anchorRatio);
    p.targetWindow = nextWin;
    p.targetPan = Math.max(0, Math.min(p.maxPan, p.targetPan + panShift));
    ensurePhysicsLoop();
  };

  const smoothZoomBy = (factor: number) => {
    const p = physicsRef.current;
    p.targetWindow = Math.max(18, Math.min(190, p.targetWindow * factor));
    ensurePhysicsLoop();
  };

  const smoothResetView = () => {
    const p = physicsRef.current;
    p.velocityPan = 0;
    p.targetPan = 0;
    p.targetWindow = 74;
    p.targetYScale = 1.0;
    ensurePhysicsLoop();
  };

  const buildPolyline = (series: number[], startLimit = 0) => {
    const pts: string[] = [];
    for (let i = Math.max(visStartIdx, startLimit); i <= visEndIdx; i++) {
      if (series[i] === undefined) continue;
      pts.push(`${globalIndexToX(i).toFixed(1)},${priceToY(series[i]).toFixed(1)}`);
    }
    return pts.join(' ');
  };

  const priceTicks = useMemo(() => {
    const count = 6;
    const ticks: number[] = [];
    for (let i = 0; i <= count; i++) {
      ticks.push(minPrice + ((maxPrice - minPrice) * i) / count);
    }
    return ticks;
  }, [minPrice, maxPrice]);

  const maxVpVol = useMemo(
    () => Math.max(1, ...tfAnalytics.volumeFlow.buckets.map((b) => b.volume)),
    [tfAnalytics.volumeFlow.buckets]
  );

  const maxBarVol = useMemo(
    () => Math.max(1, ...visibleSlice.map((c) => c.volume)),
    [visibleSlice]
  );

  const includeDateOnAxis = useMemo(() => {
    if (timeframe === '1D' || timeframe === '1W' || timeframe === '1M') return false;
    const firstBar = allCandles[Math.max(0, visStartIdx)];
    const lastBar = allCandles[Math.min(allCandles.length - 1, visEndIdx)];
    if (!firstBar || !lastBar) return false;
    const spanSec = lastBar.time - firstBar.time;
    const d1 = new Date(firstBar.time * 1000).getUTCDate();
    const d2 = new Date(lastBar.time * 1000).getUTCDate();
    return spanSec > 16 * 3600 || d1 !== d2;
  }, [allCandles, visStartIdx, visEndIdx, timeframe]);

  // Non-overlapping chronological X-axis time labels computed dynamically from actual pixel width
  const timeTicks = useMemo(() => {
    const ticks: number[] = [];
    const minGapPx =
      timeframe === '1D' || timeframe === '1W' || timeframe === '1M'
        ? 78
        : includeDateOnAxis
          ? 98
          : 66;
    let lastDrawnX = -Infinity;
    const startLoop = Math.max(0, visStartIdx);
    const endLoop = Math.min(allCandles.length - 1, visEndIdx);

    for (let i = startLoop; i <= endLoop; i++) {
      const x = globalIndexToX(i);
      if (x < pad.left + 32 || x > pad.left + plotW - 34) continue;
      if (x - lastDrawnX >= minGapPx) {
        ticks.push(i);
        lastDrawnX = x;
      }
    }
    return ticks;
  }, [visStartIdx, visEndIdx, allCandles.length, plotW, pad.left, timeframe, includeDateOnAxis, stepX, exactStartFloat]);

  const showIntradaySessions =
    layers.sessions && ['1m', '5m', '15m', '30m', '1h', '4h'].includes(timeframe);

  const symbolDrawings = useMemo(
    () => drawings.filter((d) => d.symbol === analysis.meta.id),
    [drawings, analysis.meta.id]
  );

  const allRenderDrawings = draftDrawing ? [...symbolDrawings, draftDrawing] : symbolDrawings;

  const toolButtons: Array<{
    id: DrawingToolId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'pan', label: 'Pan', icon: MousePointer2 },
    { id: 'crosshair', label: 'Crosshair', icon: Crosshair },
    { id: 'trendline', label: 'Trendline', icon: TrendingUp },
    { id: 'hline', label: 'H-Line', icon: Minus },
    { id: 'fib', label: 'Fib Tool', icon: Percent },
    { id: 'long_rr', label: 'Long RR', icon: ArrowUpRight },
    { id: 'short_rr', label: 'Short RR', icon: ArrowDownRight },
    { id: 'ruler', label: 'Measure', icon: Ruler },
  ];

  return (
    <div className="flex flex-col border border-[var(--border-hairline)] bg-[var(--bg-surface)] rounded-lg overflow-hidden">
      {/* Row 1: Instrument + Full 10-Timeframe Selector + Zoom Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-[var(--border-hairline)] bg-[var(--bg-elevated)]">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display font-semibold text-slate-100 text-sm whitespace-nowrap">
              {analysis.meta.id}
            </span>
            <span
              className="font-mono text-sm font-semibold tabular-nums"
              style={{ color: liveIsBull ? palette.bull : palette.bear }}
            >
              {livePrice.toFixed(dec)}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-mono font-semibold border whitespace-nowrap ${
                activeTfBias?.bias === 'BULLISH'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : activeTfBias?.bias === 'NEUTRAL'
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                    : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
              }`}
            >
              {activeTfBias?.bias === 'BULLISH' ? (
                <TrendingUp className="w-3 h-3" />
              ) : activeTfBias?.bias === 'NEUTRAL' ? (
                <Minus className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {timeframe} {activeTfBias?.bias}
            </span>
            <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
              · {feedSourceLabel || (usingExternal ? 'Yahoo Live' : 'Calibrated Live')}
            </span>
            {marketStatus.open ? (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-[var(--accent-text)] whitespace-nowrap">
                · <Clock className="w-3 h-3" /> {countdownText}
              </span>
            ) : (
              <span
                title={marketStatus.reason}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-[10.5px] font-mono font-semibold text-amber-300 whitespace-nowrap"
              >
                {marketStatus.badge}
              </span>
            )}
          </div>

          <div className="flex flex-nowrap sm:flex-wrap items-center gap-0.5 overflow-x-auto max-w-full bg-[var(--bg-inset)] p-0.5 rounded border border-[var(--border-hairline)]">
            {TIMEFRAME_LIST.map((tf) => {
              const tfBias = mtfBiasList.find((b) => b.timeframe === tf);
              const isBull = tfBias?.bias === 'BULLISH';
              const isNeut = tfBias?.bias === 'NEUTRAL';
              return (
                <button
                  key={tf}
                  onClick={() => onTimeframeChange(tf)}
                  title={`${tf}: ${tfBias?.bias ?? 'NEUTRAL'} (${tfBias?.confidencePct ?? 50}%)`}
                  className={`flex items-center gap-1 px-2 py-1 text-[11px] font-mono rounded transition-colors whitespace-nowrap shrink-0 ${
                    timeframe === tf
                      ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      timeframe === tf
                        ? 'bg-current opacity-85'
                        : isBull
                          ? 'bg-emerald-400'
                          : isNeut
                            ? 'bg-amber-400'
                            : 'bg-rose-400'
                    }`}
                  />
                  {tf}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => smoothZoomBy(0.76)}
            title="Zoom In"
            className="p-1.5 rounded bg-[var(--bg-inset)] border border-[var(--border-hairline)] text-slate-300 hover:text-white hover:border-[var(--border-strong)]"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => smoothZoomBy(1.32)}
            title="Zoom Out"
            className="p-1.5 rounded bg-[var(--bg-inset)] border border-[var(--border-hairline)] text-slate-300 hover:text-white hover:border-[var(--border-strong)]"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          {(Math.abs(yScaleFactor - 1) > 0.04 || clampedPan > 0.5 || Math.abs(barWindow - 74) > 3) && (
            <button
              onClick={smoothResetView}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono rounded bg-[var(--bg-inset)] border border-[var(--border-strong)] text-[var(--accent-text)] hover:text-white whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              Reset View
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Trading Tools Bar (Streamlined on Mobile, Full Inline on Desktop) + Overlay Layers */}
      <div className="px-3 sm:px-4 py-2 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 flex-wrap">
            {toolButtons.map((tb) => {
              const Icon = tb.icon;
              const active = activeTool === tb.id;
              const isPrimaryOnMobile = tb.id === 'pan' || tb.id === 'crosshair';
              return (
                <button
                  key={tb.id}
                  onClick={() => {
                    setDraftDrawing(null);
                    setActiveTool(tb.id);
                  }}
                  className={`${isPrimaryOnMobile ? 'flex' : 'hidden sm:flex'} items-center gap-1 px-2 py-1 text-[11px] rounded border transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)] font-medium'
                      : 'bg-[var(--bg-inset)] border-[var(--border-hairline)] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{tb.label}</span>
                </button>
              );
            })}

            {/* Mobile Draw Tools Toggle */}
            <button
              type="button"
              onClick={() => setMobileToolsOpen((v) => !v)}
              className={`sm:hidden flex items-center gap-1 px-2 py-1 text-[11px] rounded border transition-colors whitespace-nowrap shrink-0 ${
                mobileToolsOpen || (activeTool !== 'pan' && activeTool !== 'crosshair')
                  ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)] font-medium'
                  : 'bg-[var(--bg-inset)] border-[var(--border-hairline)] text-slate-300'
              }`}
            >
              <PenTool className="w-3 h-3" />
              <span>
                {activeTool !== 'pan' && activeTool !== 'crosshair'
                  ? toolButtons.find((t) => t.id === activeTool)?.label ?? 'Draw'
                  : 'Draw Tools'}
              </span>
            </button>

            {symbolDrawings.length > 0 && (
              <>
                <button
                  onClick={() =>
                    setDrawings((prev) => {
                      const idx = [...prev].reverse().findIndex((d) => d.symbol === analysis.meta.id);
                      if (idx === -1) return prev;
                      const removeAt = prev.length - 1 - idx;
                      return prev.filter((_, i) => i !== removeAt);
                    })
                  }
                  title="Undo Last Drawing"
                  className="flex items-center gap-1 px-2 py-1 text-[11px] rounded border bg-[var(--bg-inset)] border-[var(--border-hairline)] text-slate-300 hover:text-white whitespace-nowrap shrink-0"
                >
                  <Undo2 className="w-3 h-3" />
                  <span className="hidden sm:inline">Undo</span>
                </button>
                <button
                  onClick={() => setDrawings((prev) => prev.filter((d) => d.symbol !== analysis.meta.id))}
                  title="Clear Drawings"
                  className="flex items-center gap-1 px-2 py-1 text-[11px] rounded border bg-[var(--bg-inset)] border-[var(--border-hairline)] text-rose-300 hover:bg-rose-500/15 whitespace-nowrap shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear ({symbolDrawings.length})</span>
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 max-w-full overflow-x-auto sm:overflow-visible sm:flex-wrap pb-0.5 sm:pb-0">
            {/* Candle Color Picker Popover */}
            <div className="relative shrink-0" ref={colorPopoverRef}>
              <button
                type="button"
                onClick={() => setColorMenuOpen((v) => !v)}
                title="Change Candle Colors"
                className={`flex items-center gap-1.5 px-2 py-1 text-[11px] rounded border transition-colors whitespace-nowrap shrink-0 ${
                  colorMenuOpen || activeCandleColors
                    ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)]'
                    : 'bg-[var(--bg-inset)] border-[var(--border-hairline)] text-slate-300 hover:text-white'
                }`}
              >
                <Palette className="w-3 h-3" />
                <span>Candles</span>
                <span className="inline-flex items-center gap-0.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: palette.bull }} />
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: palette.bear }} />
                </span>
              </button>

              {colorMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-64 p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-strong)] shadow-xl z-40 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-display font-semibold text-slate-100">Candle Colors</span>
                    {activeCandleColors && (
                      <button
                        type="button"
                        onClick={() => applyCandleColors(null)}
                        className="text-[11px] font-mono text-[var(--accent-text)] hover:underline"
                      >
                        Reset Default
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[10px] font-mono text-slate-400 uppercase">Presets</div>
                    <div className="grid grid-cols-1 gap-1">
                      {CANDLE_COLOR_PRESETS.map((preset) => {
                        const selected =
                          palette.bull.toLowerCase() === preset.bull.toLowerCase() &&
                          palette.bear.toLowerCase() === preset.bear.toLowerCase();
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => applyCandleColors({ bull: preset.bull, bear: preset.bear })}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded border text-left transition-colors ${
                              selected
                                ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-slate-100'
                                : 'bg-[var(--bg-inset)] border-[var(--border-hairline)] text-slate-300 hover:text-white'
                            }`}
                          >
                            <span>{preset.label}</span>
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: preset.bull }} />
                              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: preset.bear }} />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[var(--border-hairline)] grid grid-cols-2 gap-2.5">
                    <label className="block space-y-1">
                      <span className="text-[10px] font-mono text-slate-400">Bull (Up)</span>
                      <div className="flex items-center gap-1.5 bg-[var(--bg-inset)] border border-[var(--border-hairline)] rounded px-1.5 py-1">
                        <input
                          type="color"
                          value={palette.bull}
                          onChange={(e) => applyCandleColors({ bull: e.target.value, bear: palette.bear })}
                          className="w-6 h-5 bg-transparent border-0 cursor-pointer p-0"
                        />
                        <span className="text-[10px] font-mono text-slate-300 uppercase">{palette.bull}</span>
                      </div>
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[10px] font-mono text-slate-400">Bear (Down)</span>
                      <div className="flex items-center gap-1.5 bg-[var(--bg-inset)] border border-[var(--border-hairline)] rounded px-1.5 py-1">
                        <input
                          type="color"
                          value={palette.bear}
                          onChange={(e) => applyCandleColors({ bull: palette.bull, bear: e.target.value })}
                          className="w-6 h-5 bg-transparent border-0 cursor-pointer p-0"
                        />
                        <span className="text-[10px] font-mono text-slate-300 uppercase">{palette.bear}</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {(
              [
                { key: 'sessions', label: 'Live Sessions' },
                { key: 'smc', label: 'SMC' },
                { key: 'fibOte', label: 'Fib OTE' },
                { key: 'volumeVwap', label: 'VP/VWAP' },
                { key: 'emaBb', label: 'EMA/BB' },
                { key: 'tradeLevels', label: 'SL/TP' },
              ] as { key: keyof ChartLayerState; label: string }[]
            ).map((item) => (
              <button
                key={item.key}
                onClick={() => onToggleLayer(item.key)}
                className={`px-2 py-1 text-[11px] rounded border transition-colors whitespace-nowrap shrink-0 ${
                  layers[item.key]
                    ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)]'
                    : 'bg-[var(--bg-inset)] border-[var(--border-hairline)] text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Collapsible Mobile Draw Tools Tray */}
        {mobileToolsOpen && (
          <div className="sm:hidden flex flex-wrap items-center gap-1.5 pt-2 border-t border-[var(--border-hairline)]">
            {toolButtons
              .filter((tb) => tb.id !== 'pan' && tb.id !== 'crosshair')
              .map((tb) => {
                const Icon = tb.icon;
                const active = activeTool === tb.id;
                return (
                  <button
                    key={`mob-${tb.id}`}
                    onClick={() => {
                      setDraftDrawing(null);
                      setActiveTool(tb.id);
                      setMobileToolsOpen(false);
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 text-[11px] rounded border transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)] font-medium'
                        : 'bg-[var(--bg-inset)] border-[var(--border-hairline)] text-slate-300'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{tb.label}</span>
                  </button>
                );
              })}
          </div>
        )}
      </div>

      {/* Row 3: Live OHLCV + Time + Auto-Fib OTE Status Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-1.5 border-b border-[var(--border-hairline)] bg-[var(--bg-inset)] text-xs font-mono tabular-nums">
        <div className="flex flex-wrap items-center gap-3 text-slate-400">
          <span className="text-[var(--accent-text)] font-semibold">
            {formatAxisTime(headerCandle.time, timeframe, true)} UTC
          </span>
          <span>
            O <span className="text-slate-200">{headerCandle.open.toFixed(dec)}</span>
          </span>
          <span>
            H <span className="text-slate-200">{headerCandle.high.toFixed(dec)}</span>
          </span>
          <span>
            L <span className="text-slate-200">{headerCandle.low.toFixed(dec)}</span>
          </span>
          <span>
            C{' '}
            <span style={{ color: headerCandle.close >= headerCandle.open ? palette.bull : palette.bear }}>
              {headerCandle.close.toFixed(dec)}
            </span>
          </span>
          <span>
            Vol <span className="text-slate-200">{headerCandle.volume.toLocaleString()}</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-slate-400">
            Fib ({tfAnalytics.autoFib.direction}):{' '}
            <span
              className={
                tfAnalytics.autoFib.inOTE
                  ? 'text-[var(--accent-text)] font-semibold'
                  : tfAnalytics.autoFib.invalidated
                    ? 'text-slate-400'
                    : 'text-slate-300'
              }
            >
              {tfAnalytics.autoFib.invalidated
                ? 'Impulse Swept (Awaiting New Leg)'
                : tfAnalytics.autoFib.inOTE
                  ? `IN OTE (${tfAnalytics.autoFib.oteBottom.toFixed(dec)}–${tfAnalytics.autoFib.oteTop.toFixed(dec)})`
                  : `${Math.min(100, Math.max(0, tfAnalytics.autoFib.currentRetracement * 100)).toFixed(1)}% Retrace`}
            </span>
          </span>
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-slate-500">Swing:</span>
            {[
              { label: 'Short', val: 45 },
              { label: 'Auto', val: 72 },
              { label: 'Major', val: 120 },
            ].map((s) => (
              <button
                key={s.val}
                onClick={() => setFibSensitivity(s.val)}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  fibSensitivity === s.val
                    ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3b: Session Shading Legend when Intraday Zones Enabled */}
      {layers.sessions && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-1 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[10.5px] font-mono text-slate-400">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-400/30 border border-amber-400/70 inline-block" />
              <span className="text-amber-300">Asian</span> 00:00–06:30 UTC
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-teal-400/30 border border-teal-400/70 inline-block" />
              <span className="text-teal-300">London</span> 07:00–16:00 UTC
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-blue-400/30 border border-blue-400/70 inline-block" />
              <span className="text-blue-300">New York</span> 12:30–21:00 UTC
            </span>
          </div>
          <span className="text-slate-500">
            {showIntradaySessions
              ? `${tfAnalytics.sessionWindows.length} ${timeframe} session zones mapped`
              : `Switch TF ≤ 4h for intraday background zones (${timeframe})`}
          </span>
        </div>
      )}

      {/* Interactive SVG Canvas */}
      <div
        ref={containerRef}
        className="relative w-full h-[460px] sm:h-[510px] select-none overflow-hidden"
        style={{ backgroundColor: palette.canvas }}
      >
        <svg
          width={size.width}
          height={size.height}
          style={{ touchAction: 'none' }}
          className={`block ${
            activeTool === 'pan'
              ? 'cursor-grab active:cursor-grabbing'
              : 'cursor-crosshair'
          }`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const localX = e.clientX - rect.left;
            if (localX >= pad.left + plotW) {
              physicsRef.current.targetYScale = 1.0;
              ensurePhysicsLoop();
            } else {
              smoothResetView();
            }
          }}
          onPointerLeave={() => {
            if (dragRef.current.mode === 'NONE') setPointerPos(null);
          }}
          onWheel={handleWheel}
        >
          <defs>
            <clipPath id="chart-plot-clip">
              <rect x={pad.left} y={pad.top} width={plotW} height={plotH} />
            </clipPath>
          </defs>

          {/* Shaded Background Session Zones (Full-Height Asian, London, New York Zones Behind Grid & Price) */}
          <g clipPath="url(#chart-plot-clip)">
            {showIntradaySessions &&
              tfAnalytics.sessionWindows.map((sw, idx) => {
                if (sw.endIndex < visStartIdx - 1 || sw.startIndex > visEndIdx + 1) return null;
                const isLatest = idx === tfAnalytics.sessionWindows.length - 1;
                const x1 = globalIndexToX(sw.startIndex) - stepX * 0.48;
                const x2 = globalIndexToX(sw.endIndex) + stepX * 0.48;
                const zoneW = Math.max(4, x2 - x1);
                const yTop = priceToY(sw.high);
                const yBot = priceToY(sw.low);
                const pips = Math.round((sw.high - sw.low) / analysis.meta.pipSize);

                const bgFill =
                  sw.session === 'ASIAN'
                    ? isLatest
                      ? 'rgba(245, 158, 11, 0.11)'
                      : 'rgba(245, 158, 11, 0.065)'
                    : sw.session === 'LONDON'
                      ? isLatest
                        ? 'rgba(20, 184, 166, 0.115)'
                        : 'rgba(20, 184, 166, 0.065)'
                      : isLatest
                        ? 'rgba(59, 130, 246, 0.12)'
                        : 'rgba(59, 130, 246, 0.07)';

                const headerFill =
                  sw.session === 'ASIAN'
                    ? 'rgba(245, 158, 11, 0.22)'
                    : sw.session === 'LONDON'
                      ? 'rgba(20, 184, 166, 0.22)'
                      : 'rgba(59, 130, 246, 0.24)';

                const railStroke =
                  sw.session === 'ASIAN'
                    ? 'rgba(245, 158, 11, 0.48)'
                    : sw.session === 'LONDON'
                      ? 'rgba(20, 184, 166, 0.48)'
                      : 'rgba(59, 130, 246, 0.50)';

                const textFill =
                  sw.session === 'ASIAN' ? '#FBBF24' : sw.session === 'LONDON' ? '#2DD4BF' : '#60A5FA';

                // Stagger New York header row slightly below London so overlapping LDN/NY headers stay crisp
                const headerY = sw.session === 'NEW_YORK' ? pad.top + 17 : pad.top;

                return (
                  <g key={`sess-${sw.session}-${sw.startIndex}`}>
                    {/* Full-height shaded background zone */}
                    <rect x={x1} y={pad.top} width={zoneW} height={plotH} fill={bgFill} />

                    {/* Top session header band */}
                    <rect x={x1} y={headerY} width={zoneW} height={16} fill={headerFill} />
                    <line x1={x1} x2={x2} y1={headerY} y2={headerY} stroke={railStroke} strokeWidth={1.2} />

                    {/* Vertical start & end session boundary lines */}
                    <line
                      x1={x1}
                      x2={x1}
                      y1={pad.top}
                      y2={pad.top + plotH}
                      stroke={railStroke}
                      strokeWidth={0.85}
                      strokeDasharray="3 3"
                    />
                    <line
                      x1={x2}
                      x2={x2}
                      y1={pad.top}
                      y2={pad.top + plotH}
                      stroke={railStroke}
                      strokeWidth={0.65}
                      strokeDasharray="2 4"
                      opacity={0.75}
                    />

                    {/* Session High / Low range bracket rails */}
                    <line
                      x1={x1}
                      x2={isLatest ? pad.left + plotW : x2}
                      y1={yTop}
                      y2={yTop}
                      stroke={railStroke}
                      strokeWidth={isLatest ? 1 : 0.75}
                      strokeDasharray="4 3"
                    />
                    <line
                      x1={x1}
                      x2={isLatest ? pad.left + plotW : x2}
                      y1={yBot}
                      y2={yBot}
                      stroke={railStroke}
                      strokeWidth={isLatest ? 1 : 0.75}
                      strokeDasharray="4 3"
                    />

                    {/* Crisp session label inside header band when wide enough */}
                    {zoneW >= 34 && (
                      <text
                        x={Math.max(pad.left + 4, x1 + 5)}
                        y={headerY + 11.5}
                        fill={textFill}
                        fontSize="9"
                        fontWeight="700"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {zoneW >= 82
                          ? `${sw.label.toUpperCase()} · ${pips}p${isLatest ? ' LIVE' : ''}`
                          : sw.session === 'ASIAN'
                            ? 'ASN'
                            : sw.session === 'LONDON'
                              ? 'LDN'
                              : 'NY'}
                      </text>
                    )}
                  </g>
                );
              })}
          </g>

          {/* Horizontal Price Grid + Right Y-Axis Price Ticks */}
          {priceTicks.map((tick, i) => {
            const y = priceToY(tick);
            return (
              <g key={`hgrid-${i}`}>
                <line x1={pad.left} x2={pad.left + plotW} y1={y} y2={y} stroke={palette.grid} strokeWidth={1} />
                <text
                  x={pad.left + plotW + 7}
                  y={y + 4}
                  fill={palette.axisText}
                  fontSize="10.5"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {tick.toFixed(dec)}
                </text>
              </g>
            );
          })}

          {/* Vertical Gridlines Aligned With Non-Overlapping Time Ticks */}
          {timeTicks.map((gIdx) => {
            const x = globalIndexToX(gIdx);
            return (
              <line
                key={`vgrid-${gIdx}`}
                x1={x}
                x2={x}
                y1={pad.top}
                y2={pad.top + plotH}
                stroke={palette.grid}
                strokeWidth={0.8}
              />
            );
          })}

          {/* Clipped Plot Area */}
          <g clipPath="url(#chart-plot-clip)">

            {/* Subtle Bottom Volume Histogram */}
            {visibleSlice.map((c, localI) => {
              const gIdx = visStartIdx + localI;
              const x = globalIndexToX(gIdx);
              const bw = Math.max(2, Math.min(11, stepX * 0.6));
              const vh = (c.volume / maxBarVol) * (plotH * 0.11);
              const isUp = c.close >= c.open;
              return (
                <rect
                  key={`vol-${c.time}`}
                  x={x - bw / 2}
                  y={pad.top + plotH - vh}
                  width={bw}
                  height={vh}
                  fill={isUp ? hexToRgba(palette.bull, 0.18) : hexToRgba(palette.bear, 0.18)}
                />
              );
            })}

            {/* Volume Profile Histogram & POC */}
            {layers.volumeVwap && (
              <g opacity={0.48}>
                {tfAnalytics.volumeFlow.buckets.map((b, i) => {
                  const yTop = priceToY(b.priceHigh);
                  const yBot = priceToY(b.priceLow);
                  const h = Math.max(2, yBot - yTop - 1);
                  const w = (b.volume / maxVpVol) * Math.min(100, plotW * 0.13);
                  const isPoc = Math.abs(b.priceMid - tfAnalytics.volumeFlow.poc) < analysis.meta.pipSize * 2;
                  return (
                    <rect
                      key={`vp-${i}`}
                      x={pad.left + plotW - w}
                      y={yTop}
                      width={w}
                      height={h}
                      fill={isPoc ? palette.accent : '#334155'}
                      rx={1}
                    />
                  );
                })}
                <line
                  x1={pad.left}
                  x2={pad.left + plotW}
                  y1={priceToY(tfAnalytics.volumeFlow.poc)}
                  y2={priceToY(tfAnalytics.volumeFlow.poc)}
                  stroke={palette.accent}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
              </g>
            )}

            {/* SMC Order Blocks, FVG, BOS/CHoCH */}
            {layers.smc && (
              <g>
                {tfAnalytics.orderBlocks.map((ob) => {
                  const x1 = globalIndexToX(ob.startIndex);
                  const y1 = priceToY(ob.high);
                  const y2 = priceToY(ob.low);
                  const isBull = ob.direction === 'LONG';
                  return (
                    <g key={ob.id}>
                      <rect
                        x={x1}
                        y={y1}
                        width={Math.max(12, pad.left + plotW - x1)}
                        height={Math.max(4, y2 - y1)}
                        fill={isBull ? 'rgba(20, 184, 166, 0.12)' : 'rgba(244, 63, 94, 0.12)'}
                        stroke={isBull ? 'rgba(20, 184, 166, 0.4)' : 'rgba(244, 63, 94, 0.4)'}
                      />
                      <text
                        x={Math.max(pad.left + 6, x1 + 4)}
                        y={y1 + 11}
                        fill={isBull ? '#2DD4BF' : '#FB7185'}
                        fontSize="9.5"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {isBull ? 'Bull OB' : 'Bear OB'}
                      </text>
                    </g>
                  );
                })}

                {tfAnalytics.fvgs.map((fvg) => {
                  const x1 = globalIndexToX(fvg.startIndex);
                  const y1 = priceToY(fvg.top);
                  const y2 = priceToY(fvg.bottom);
                  const isBull = fvg.direction === 'LONG';
                  return (
                    <g key={fvg.id}>
                      <rect
                        x={x1}
                        y={y1}
                        width={Math.max(16, pad.left + plotW - x1)}
                        height={Math.max(3, y2 - y1)}
                        fill={isBull ? 'rgba(56, 189, 248, 0.11)' : 'rgba(251, 146, 60, 0.11)'}
                        stroke={isBull ? 'rgba(56, 189, 248, 0.35)' : 'rgba(251, 146, 60, 0.35)'}
                        strokeDasharray="2 2"
                      />
                      <text
                        x={pad.left + plotW - 64}
                        y={y1 + 10}
                        fill={isBull ? '#38BDF8' : '#FB923C'}
                        fontSize="9"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        FVG ({fvg.fillPct}%)
                      </text>
                    </g>
                  );
                })}

                {tfAnalytics.structureBreaks.map((sb, i) => {
                  const x1 = globalIndexToX(sb.fromIndex);
                  const x2 = globalIndexToX(sb.index);
                  const y = priceToY(sb.price);
                  const color = sb.direction === 'LONG' ? palette.bull : palette.bear;
                  return (
                    <g key={`sb-${i}`}>
                      <line x1={x1} x2={x2} y1={y} y2={y} stroke={color} strokeWidth={1.3} strokeDasharray="4 2" />
                      <text
                        x={(x1 + x2) / 2 - 14}
                        y={sb.direction === 'LONG' ? y - 4 : y + 11}
                        fill={color}
                        fontSize="10"
                        fontWeight="600"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {sb.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            )}

            {/* Automatic Swing Fibonacci Retracement & 0.618–0.786 OTE Highlight Zone */}
            {layers.fibOte && (() => {
              const fib = tfAnalytics.autoFib;
              const startX = Math.max(pad.left, globalIndexToX(fib.anchorStartIndex));
              const endX = pad.left + plotW;
              const yOteTop = priceToY(fib.oteTop);
              const yOteBot = priceToY(fib.oteBottom);
              const anchorStartY = priceToY(fib.direction === 'LONG' ? fib.swingLow : fib.swingHigh);
              const anchorEndX = globalIndexToX(fib.anchorEndIndex);
              const anchorEndY = priceToY(fib.direction === 'LONG' ? fib.swingHigh : fib.swingLow);

              return (
                <g>
                  <line
                    x1={globalIndexToX(fib.anchorStartIndex)}
                    y1={anchorStartY}
                    x2={anchorEndX}
                    y2={anchorEndY}
                    stroke={palette.accent}
                    strokeWidth={1.2}
                    strokeDasharray="5 3"
                    opacity={0.75}
                  />
                  <rect
                    x={startX}
                    y={Math.min(yOteTop, yOteBot)}
                    width={Math.max(20, endX - startX)}
                    height={Math.max(4, Math.abs(yOteBot - yOteTop))}
                    fill="rgba(217, 164, 65, 0.14)"
                    stroke="rgba(217, 164, 65, 0.5)"
                    strokeWidth={1}
                  />
                  <text
                    x={startX + 8}
                    y={Math.min(yOteTop, yOteBot) + Math.abs(yOteBot - yOteTop) / 2 + 3}
                    fill={palette.accentText}
                    fontSize="10"
                    fontWeight="600"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    OTE ZONE (0.618 – 0.786)
                  </text>
                  {fib.levels.map((lvl) => {
                    const y = priceToY(lvl.price);
                    const stroke = lvl.isOTE ? palette.accent : lvl.ratio === 0.5 ? '#94A3B8' : '#475569';
                    return (
                      <g key={lvl.ratio}>
                        <line
                          x1={startX}
                          x2={endX}
                          y1={y}
                          y2={y}
                          stroke={stroke}
                          strokeWidth={lvl.isOTE ? 1.2 : 0.8}
                          strokeDasharray={lvl.isOTE ? undefined : '3 3'}
                          opacity={lvl.isOTE ? 0.9 : 0.6}
                        />
                        <text
                          x={endX - 142}
                          y={y - 3}
                          fill={lvl.isOTE ? palette.accentText : '#94A3B8'}
                          fontSize="9.5"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {lvl.label} · {lvl.price.toFixed(dec)}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })()}

            {/* EMA 50/200 & Bollinger Bands */}
            {layers.emaBb && (
              <g>
                <polyline fill="none" stroke="#38BDF8" strokeWidth={1.3} points={buildPolyline(tfAnalytics.ema50)} />
                <polyline fill="none" stroke="#A855F7" strokeWidth={1.4} points={buildPolyline(tfAnalytics.ema200)} />
                <polyline
                  fill="none"
                  stroke="#64748B"
                  strokeWidth={0.9}
                  strokeDasharray="2 2"
                  points={buildPolyline(tfAnalytics.bbUpper)}
                />
                <polyline
                  fill="none"
                  stroke="#64748B"
                  strokeWidth={0.9}
                  strokeDasharray="2 2"
                  points={buildPolyline(tfAnalytics.bbLower)}
                />
              </g>
            )}

            {/* VWAP & Anchored VWAP */}
            {layers.volumeVwap && (
              <g>
                <polyline
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth={1.4}
                  points={buildPolyline(tfAnalytics.volumeFlow.vwapSeries)}
                />
                <polyline
                  fill="none"
                  stroke="#EC4899"
                  strokeWidth={1.2}
                  strokeDasharray="4 2"
                  points={buildPolyline(
                    tfAnalytics.volumeFlow.anchoredVwapSeries,
                    tfAnalytics.volumeFlow.anchoredStartIndex
                  )}
                />
              </g>
            )}

            {/* Candlesticks */}
            {visibleSlice.map((c, localI) => {
              const gIdx = visStartIdx + localI;
              const x = globalIndexToX(gIdx);
              const yHigh = priceToY(c.high);
              const yLow = priceToY(c.low);
              const yOpen = priceToY(c.open);
              const yClose = priceToY(c.close);
              const isUp = c.close >= c.open;
              const color = isUp ? palette.bull : palette.bear;
              const bodyW = Math.max(2.2, Math.min(13, stepX * 0.66));
              const bodyTop = Math.min(yOpen, yClose);
              const bodyH = Math.max(1.5, Math.abs(yClose - yOpen));

              return (
                <g key={c.time}>
                  <line x1={x} x2={x} y1={yHigh} y2={yLow} stroke={color} strokeWidth={1.15} />
                  <rect x={x - bodyW / 2} y={bodyTop} width={bodyW} height={bodyH} fill={color} rx={0.6} />
                </g>
              );
            })}

            {/* Liquidity Sweeps */}
            {layers.smc &&
              tfAnalytics.liquiditySweeps.map((ls, i) => {
                if (ls.index < visStartIdx || ls.index > visEndIdx) return null;
                const x = globalIndexToX(ls.index);
                const y = priceToY(ls.price);
                return (
                  <g key={`ls-${i}`}>
                    <circle cx={x} cy={y} r={3.5} fill={palette.accent} />
                    <text
                      x={x - 18}
                      y={ls.type === 'BSL_SWEEP' ? y - 7 : y + 14}
                      fill={palette.accentText}
                      fontSize="9"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {ls.label}
                    </text>
                  </g>
                );
              })}

            {/* Setup SL / TP Lines */}
            {layers.tradeLevels && activeSetup && (
              <g>
                {[
                  { price: activeSetup.takeProfit2, label: `TP2 (1:${activeSetup.riskReward})`, color: palette.bull },
                  { price: activeSetup.takeProfit1, label: 'TP1 (1R Partial)', color: '#34D399' },
                  { price: activeSetup.entryPrice, label: `ENTRY ${activeSetup.direction}`, color: palette.accentText },
                  { price: activeSetup.stopLoss, label: 'SL (ATR)', color: palette.bear },
                ].map((lvl) => {
                  const y = priceToY(lvl.price);
                  return (
                    <g key={lvl.label}>
                      <line
                        x1={pad.left}
                        x2={pad.left + plotW}
                        y1={y}
                        y2={y}
                        stroke={lvl.color}
                        strokeWidth={1.1}
                        strokeDasharray="5 3"
                      />
                      <text
                        x={pad.left + 8}
                        y={y - 4}
                        fill={lvl.color}
                        fontSize="9.5"
                        fontWeight="600"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {lvl.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            )}

            {/* User Trading Tools Drawings (Trendline, H-Line, Manual Fib, Risk-Reward Box, Measure Ruler) */}
            {allRenderDrawings.map((dr) => {
              const x1 = globalIndexToX(dr.startIdx);
              const y1 = priceToY(dr.startPrice);
              const x2 = globalIndexToX(dr.endIdx);
              const y2 = priceToY(dr.endPrice);

              if (dr.tool === 'hline') {
                return (
                  <g key={dr.id}>
                    <line
                      x1={pad.left}
                      x2={pad.left + plotW}
                      y1={y1}
                      y2={y1}
                      stroke={palette.accentText}
                      strokeWidth={1.4}
                      strokeDasharray="6 3"
                    />
                    <text
                      x={pad.left + 8}
                      y={y1 - 4}
                      fill={palette.accentText}
                      fontSize="9.5"
                      fontWeight="600"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      Ray {dr.startPrice.toFixed(dec)}
                    </text>
                  </g>
                );
              }

              if (dr.tool === 'trendline') {
                return (
                  <g key={dr.id}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={palette.accentText} strokeWidth={1.8} />
                    <circle cx={x1} cy={y1} r={3.5} fill={palette.accent} />
                    <circle cx={x2} cy={y2} r={3.5} fill={palette.accent} />
                  </g>
                );
              }

              if (dr.tool === 'fib') {
                const leftX = Math.min(x1, x2);
                const widthX = Math.max(40, Math.abs(x2 - x1));
                const spanP = dr.endPrice - dr.startPrice;
                const ratios = [0, 0.382, 0.5, 0.618, 0.786, 1];
                const y618 = priceToY(dr.endPrice - spanP * 0.618);
                const y786 = priceToY(dr.endPrice - spanP * 0.786);

                return (
                  <g key={dr.id}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={palette.accent} strokeDasharray="3 3" />
                    <rect
                      x={leftX}
                      y={Math.min(y618, y786)}
                      width={widthX}
                      height={Math.max(3, Math.abs(y786 - y618))}
                      fill="rgba(56, 189, 248, 0.14)"
                      stroke="rgba(56, 189, 248, 0.45)"
                    />
                    {ratios.map((r) => {
                      const lvlPrice = dr.endPrice - spanP * r;
                      const ly = priceToY(lvlPrice);
                      const isOte = r === 0.618 || r === 0.786;
                      return (
                        <g key={r}>
                          <line
                            x1={leftX}
                            x2={leftX + widthX}
                            y1={ly}
                            y2={ly}
                            stroke={isOte ? '#38BDF8' : '#64748B'}
                            strokeWidth={isOte ? 1.2 : 0.8}
                          />
                          <text
                            x={leftX + 4}
                            y={ly - 3}
                            fill={isOte ? '#7DD3FC' : '#94A3B8'}
                            fontSize="9"
                            fontFamily="JetBrains Mono, monospace"
                          >
                            {r.toFixed(3)} ({lvlPrice.toFixed(dec)})
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              }

              if (dr.tool === 'long_rr' || dr.tool === 'short_rr') {
                const isLong = dr.tool === 'long_rr';
                const leftX = Math.min(x1, x2);
                const widthX = Math.max(64, Math.abs(x2 - x1));
                const tpDelta = Math.max(analysis.meta.pipSize * 4, Math.abs(dr.endPrice - dr.startPrice));
                const tpPrice = isLong ? dr.startPrice + tpDelta : dr.startPrice - tpDelta;
                const slDelta = tpDelta / 2.2;
                const slPrice = isLong ? dr.startPrice - slDelta : dr.startPrice + slDelta;
                const yEntry = priceToY(dr.startPrice);
                const yTp = priceToY(tpPrice);
                const ySl = priceToY(slPrice);
                const rr = tpDelta / Math.max(1e-9, slDelta);

                return (
                  <g key={dr.id}>
                    <rect
                      x={leftX}
                      y={Math.min(yEntry, yTp)}
                      width={widthX}
                      height={Math.max(4, Math.abs(yTp - yEntry))}
                      fill="rgba(20, 184, 166, 0.16)"
                      stroke="rgba(20, 184, 166, 0.55)"
                    />
                    <rect
                      x={leftX}
                      y={Math.min(yEntry, ySl)}
                      width={widthX}
                      height={Math.max(4, Math.abs(ySl - yEntry))}
                      fill="rgba(244, 63, 94, 0.16)"
                      stroke="rgba(244, 63, 94, 0.55)"
                    />
                    <line x1={leftX} x2={leftX + widthX} y1={yEntry} y2={yEntry} stroke="#E2E8F0" strokeWidth={1.2} />
                    <text
                      x={leftX + 5}
                      y={yEntry - 4}
                      fill="#F8FAFC"
                      fontSize="9.5"
                      fontWeight="600"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {isLong ? 'LONG' : 'SHORT'} 1:{rr.toFixed(1)} · TP {tpPrice.toFixed(dec)} · SL {slPrice.toFixed(dec)}
                    </text>
                  </g>
                );
              }

              // Ruler / Measure tool
              const diff = dr.endPrice - dr.startPrice;
              const pct = (diff / Math.max(1e-9, dr.startPrice)) * 100;
              const barsCount = Math.max(1, Math.round(Math.abs(dr.endIdx - dr.startIdx)));
              const elapsedSec = barsCount * TIMEFRAME_SECONDS[timeframe];
              const leftX = Math.min(x1, x2);
              const topY = Math.min(y1, y2);
              const boxW = Math.max(6, Math.abs(x2 - x1));
              const boxH = Math.max(6, Math.abs(y2 - y1));
              const isPos = diff >= 0;

              return (
                <g key={dr.id}>
                  <rect
                    x={leftX}
                    y={topY}
                    width={boxW}
                    height={boxH}
                    fill={isPos ? 'rgba(20, 184, 166, 0.14)' : 'rgba(244, 63, 94, 0.14)'}
                    stroke={isPos ? '#14B8A6' : '#F43F5E'}
                    strokeDasharray="3 2"
                  />
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={isPos ? '#2DD4BF' : '#FB7185'} strokeWidth={1.2} />
                  <rect
                    x={leftX + boxW / 2 - 86}
                    y={Math.max(pad.top + 4, topY - 24)}
                    width={172}
                    height={20}
                    rx={3}
                    fill="#11131A"
                    stroke={isPos ? '#14B8A6' : '#F43F5E'}
                  />
                  <text
                    x={leftX + boxW / 2}
                    y={Math.max(pad.top + 17, topY - 10.5)}
                    textAnchor="middle"
                    fill="#F8FAFC"
                    fontSize="9.5"
                    fontWeight="600"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {diff >= 0 ? '+' : ''}
                    {diff.toFixed(dec)} ({pct >= 0 ? '+' : ''}
                    {pct.toFixed(2)}%) · {barsCount}b · {formatDurationSeconds(elapsedSec)}
                  </text>
                </g>
              );
            })}

            {/* Live Market Price Line */}
            <line
              x1={pad.left}
              x2={pad.left + plotW}
              y1={priceToY(livePrice)}
              y2={priceToY(livePrice)}
              stroke={liveIsBull ? palette.bull : palette.bear}
              strokeWidth={1.2}
              strokeDasharray="2 2"
            />
          </g>

          {/* Axis Dividers */}
          <line x1={pad.left + plotW} x2={pad.left + plotW} y1={pad.top} y2={pad.top + plotH} stroke={palette.divider} />
          <line x1={pad.left} x2={pad.left + plotW} y1={pad.top + plotH} y2={pad.top + plotH} stroke={palette.divider} />

          {/* Live Price Tag + Market Status / Candle Countdown Timer on Right Y-Axis */}
          {(() => {
            const clampedLiveY = Math.max(pad.top + 10, Math.min(pad.top + plotH - 22, priceToY(livePrice)));
            const badgeColor = !marketStatus.open ? '#F59E0B' : liveIsBull ? palette.bull : palette.bear;
            return (
              <g>
                <rect x={pad.left + plotW + 2} y={clampedLiveY - 11} width={82} height={32} fill={badgeColor} rx={3} />
                <text
                  x={pad.left + plotW + 7}
                  y={clampedLiveY + 2}
                  fill="#08090D"
                  fontSize="10.5"
                  fontWeight="700"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {livePrice.toFixed(dec)}
                </text>
                <text
                  x={pad.left + plotW + 7}
                  y={clampedLiveY + 15}
                  fill="#08090D"
                  fontSize="9.5"
                  fontWeight="600"
                  opacity={0.85}
                  fontFamily="JetBrains Mono, monospace"
                >
                  {marketStatus.open ? `⏱ ${countdownText}` : 'CLOSED'}
                </text>
              </g>
            );
          })()}

          {/* Bottom X-Axis Non-Overlapping Chronological Time Labels */}
          {timeTicks.map((gIdx) => {
            const x = globalIndexToX(gIdx);
            return (
              <g key={`tm-${gIdx}`}>
                <line x1={x} x2={x} y1={pad.top + plotH} y2={pad.top + plotH + 4} stroke={palette.divider} />
                <text
                  x={x}
                  y={size.height - 9}
                  textAnchor="middle"
                  fill={palette.axisText}
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {formatAxisTime(allCandles[gIdx].time, timeframe, false, includeDateOnAxis)}
                </text>
              </g>
            );
          })}

          {/* Dynamic Crosshair + Floating Y-Axis Price Tag + Floating X-Axis Time Tag */}
          {hoveredBarInfo && (
            <g pointerEvents="none">
              <line
                x1={hoveredBarInfo.x}
                x2={hoveredBarInfo.x}
                y1={pad.top}
                y2={pad.top + plotH}
                stroke="#64748B"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <line
                x1={pad.left}
                x2={pad.left + plotW}
                y1={hoveredBarInfo.y}
                y2={hoveredBarInfo.y}
                stroke="#64748B"
                strokeWidth={1}
                strokeDasharray="3 3"
              />

              <rect
                x={pad.left + plotW + 2}
                y={hoveredBarInfo.y - 10}
                width={82}
                height={20}
                fill={palette.crosshairTagBg}
                stroke={palette.crosshairTagStroke}
                rx={3}
              />
              <text
                x={pad.left + plotW + 7}
                y={hoveredBarInfo.y + 3.5}
                fill="#F8FAFC"
                fontSize="10.5"
                fontWeight="600"
                fontFamily="JetBrains Mono, monospace"
              >
                {hoveredBarInfo.price.toFixed(dec)}
              </text>

              <rect
                x={Math.max(pad.left, Math.min(pad.left + plotW - 96, hoveredBarInfo.x - 48))}
                y={pad.top + plotH + 4}
                width={96}
                height={20}
                fill={palette.crosshairTagBg}
                stroke={palette.crosshairTagStroke}
                rx={3}
              />
              <text
                x={Math.max(pad.left + 48, Math.min(pad.left + plotW - 48, hoveredBarInfo.x))}
                y={pad.top + plotH + 17.5}
                textAnchor="middle"
                fill="#F8FAFC"
                fontSize="10"
                fontWeight="600"
                fontFamily="JetBrains Mono, monospace"
              >
                {formatAxisTime(hoveredBarInfo.candle.time, timeframe, true)}
              </text>
            </g>
          )}
        </svg>

        {/* Live Session Overlay HUD directly on the chart canvas */}
        {layers.sessions && (
          <div className="pointer-events-none absolute top-3 left-3 max-w-[270px] rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)]/90 backdrop-blur-md px-3 py-2 text-[11px] font-mono tabular-nums">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-[var(--accent-text)]">{liveSession.activeLabel}</span>
              <span className="text-slate-300">{liveSession.gmtClock}</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-slate-400">
              <span>{liveSession.nextTransition}</span>
              <span>{liveSession.localClock}</span>
            </div>
            <div className="mt-1.5 w-full h-1 rounded bg-[var(--bg-inset)] overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] transition-all duration-500"
                style={{ width: `${liveSession.sessionProgressPct}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px]">
              <span className={liveSession.asian ? 'text-amber-300 font-semibold' : 'text-slate-500'}>ASN</span>
              <span className={liveSession.london ? 'text-teal-300 font-semibold' : 'text-slate-500'}>LDN</span>
              <span className={liveSession.newYork ? 'text-blue-300 font-semibold' : 'text-slate-500'}>NY</span>
              {latestSessionStats && (
                <span className="text-slate-300 truncate">
                  {latestSessionStats.label} {latestSessionStats.rangePips}p
                </span>
              )}
            </div>
          </div>
        )}

        {/* Snap-to-Latest Button when panned into history */}
        {clampedPan > 0.5 && (
          <button
            onClick={() => {
              physicsRef.current.velocityPan = 0;
              physicsRef.current.targetPan = 0;
              ensurePhysicsLoop();
            }}
            className="absolute bottom-10 right-24 px-3 py-1.5 text-xs font-mono font-semibold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] rounded shadow-lg transition-colors"
          >
            Latest ▸
          </button>
        )}

        {/* Y-Axis Scale Reset Hint when manually stretched */}
        {Math.abs(yScaleFactor - 1) > 0.05 && (
          <button
            onClick={() => {
              physicsRef.current.targetYScale = 1.0;
              ensurePhysicsLoop();
            }}
            className="absolute top-3 right-24 px-2.5 py-1 text-[11px] font-mono bg-[var(--bg-elevated)] hover:bg-slate-800 text-slate-200 rounded border border-[var(--border-strong)]"
          >
            Auto Scale
          </button>
        )}
      </div>

      {/* All-Timeframe Market Bias Indicator Below Price Action (EMA Alignment & Price Structure) */}
      <div className="border-t border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display font-semibold text-slate-100">
              {analysis.meta.id} Multi-Timeframe Bias Indicator
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              · EMA 20/50 Alignment + Swing Price Structure
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] tabular-nums">
            <span className="text-emerald-400 font-semibold">{bullishCount} Bullish</span>
            {neutralCount > 0 && (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-amber-300 font-semibold">{neutralCount} Neutral</span>
              </>
            )}
            <span className="text-slate-600">·</span>
            <span className="text-rose-400 font-semibold">{bearishCount} Bearish</span>
            <span
              className={`px-2 py-0.5 rounded border font-semibold ${
                overallBias === 'BULLISH'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : overallBias === 'NEUTRAL'
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                    : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
              }`}
            >
              Overall {overallBias}
            </span>
          </div>
        </div>

        {/* Visual Bullish vs Neutral vs Bearish Alignment Bar */}
        <div className="w-full h-1.5 rounded-full bg-rose-500/35 overflow-hidden flex">
          <div
            className="h-full bg-emerald-400 transition-all duration-300"
            style={{ width: `${Math.round((bullishCount / Math.max(1, mtfBiasList.length)) * 100)}%` }}
          />
          {neutralCount > 0 && (
            <div
              className="h-full bg-amber-400/70 transition-all duration-300"
              style={{ width: `${Math.round((neutralCount / Math.max(1, mtfBiasList.length)) * 100)}%` }}
            />
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
          {mtfBiasList.map((item) => {
            const isBull = item.bias === 'BULLISH';
            const isNeut = item.bias === 'NEUTRAL';
            const isActive = item.timeframe === timeframe;
            return (
              <button
                key={item.timeframe}
                type="button"
                onClick={() => onTimeframeChange(item.timeframe)}
                title={`${item.timeframe}: ${item.bias} (${item.confidencePct}%) — ${item.reason}`}
                className={`p-2 rounded border text-left transition-colors ${
                  isActive
                    ? 'bg-[var(--accent-soft)] border-[var(--accent-border)]'
                    : isBull
                      ? 'bg-emerald-500/[0.06] border-emerald-500/25 hover:border-emerald-500/50'
                      : isNeut
                        ? 'bg-amber-500/[0.06] border-amber-500/25 hover:border-amber-500/50'
                        : 'bg-rose-500/[0.06] border-rose-500/25 hover:border-rose-500/50'
                }`}
              >
                <div className="flex items-center justify-between gap-1 text-[11px] font-mono">
                  <span className={isActive ? 'font-bold text-[var(--accent-text)]' : 'font-semibold text-slate-200'}>
                    {item.timeframe}
                  </span>
                  <span className="text-[10px] text-slate-400 tabular-nums">{item.confidencePct}%</span>
                </div>
                <div
                  className={`mt-1 flex items-center gap-1 text-[11px] font-mono font-bold ${
                    isBull ? 'text-emerald-400' : isNeut ? 'text-amber-300' : 'text-rose-400'
                  }`}
                >
                  {isBull ? (
                    <TrendingUp className="w-3 h-3 shrink-0" />
                  ) : isNeut ? (
                    <Minus className="w-3 h-3 shrink-0" />
                  ) : (
                    <TrendingDown className="w-3 h-3 shrink-0" />
                  )}
                  <span>{item.bias}</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-1 text-[9.5px] font-mono text-slate-400 tabular-nums">
                  <span className={item.emaStatus === 'EMA↑' ? 'text-emerald-300/90' : 'text-rose-300/90'}>
                    {item.emaStatus}
                  </span>
                  <span>{item.structureStatus}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
