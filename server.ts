import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HISTORY_FILE = path.resolve(__dirname, '.apexsmc-history.json');

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

app.use(express.json({ limit: '2mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

// Persistent workspace & trading history routes
app.get('/api/workspace/state', async (_req, res) => {
  try {
    const raw = await fs.readFile(HISTORY_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    res.json({ exists: true, state: parsed });
  } catch {
    res.json({ exists: false, state: null });
  }
});

app.put('/api/workspace/state', async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      res.status(400).json({ ok: false, error: 'Invalid workspace state payload.' });
      return;
    }
    await fs.writeFile(HISTORY_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    res.json({ ok: true, savedAt: Date.now() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Failed to save history.' });
  }
});

app.delete('/api/workspace/state', async (_req, res) => {
  try {
    await fs.unlink(HISTORY_FILE);
  } catch {
    // Ignore if file did not exist
  }
  res.json({ ok: true });
});

// Live market quote & historical OHLCV fetcher (Yahoo Finance public endpoint with safe timeout & fallback)
const YAHOO_MAP: Record<string, string> = {
  EURUSD: 'EURUSD=X',
  GBPUSD: 'GBPUSD=X',
  USDJPY: 'USDJPY=X',
  USDCAD: 'USDCAD=X',
  XAUUSD: 'GC=F',
  XAGUSD: 'SI=F',
  USOIL: 'CL=F',
  UKOIL: 'BZ=F',
  US30: 'YM=F',
  NAS100: 'NQ=F',
  SPX500: 'ES=F',
  BTCUSD: 'BTC-USD',
  ETHUSD: 'ETH-USD',
  SOLUSD: 'SOL-USD',
  BNBUSD: 'BNB-USD',
  XRPUSD: 'XRP-USD',
  DXY: 'DX-Y.NYB',
  US10Y: '^TNX',
  VIX: '^VIX',
};

function classifySessionServer(unixSec: number): 'ASIAN' | 'LONDON' | 'NEW_YORK' | 'OFF_PEAK' {
  const d = new Date(unixSec * 1000);
  const hour = d.getUTCHours() + d.getUTCMinutes() / 60;
  if (hour >= 0 && hour < 6.5) return 'ASIAN';
  if (hour >= 7 && hour <= 10.25) return 'LONDON';
  if (hour >= 12.5 && hour <= 15.5) return 'NEW_YORK';
  return 'OFF_PEAK';
}

function getYahooIntervalAndRange(timeframe: string, mode: string): { interval: string; range: string; aggHours: number } {
  const isBacktest = mode === 'backtest';
  switch (timeframe) {
    case '1m':
      return { interval: '1m', range: isBacktest ? '5d' : '2d', aggHours: 0 };
    case '5m':
      return { interval: '5m', range: isBacktest ? '1mo' : '5d', aggHours: 0 };
    case '15m':
      return { interval: '15m', range: isBacktest ? '60d' : '1mo', aggHours: 0 };
    case '30m':
      return { interval: '30m', range: isBacktest ? '60d' : '1mo', aggHours: 0 };
    case '1h':
      return { interval: '1h', range: isBacktest ? '6mo' : '3mo', aggHours: 0 };
    case '4h':
      return { interval: '1h', range: isBacktest ? '1y' : '6mo', aggHours: 4 };
    case '12h':
      return { interval: '1h', range: isBacktest ? '1y' : '6mo', aggHours: 12 };
    case '1D':
      return { interval: '1d', range: isBacktest ? '5y' : '2y', aggHours: 0 };
    case '1W':
      return { interval: '1wk', range: isBacktest ? '10y' : '5y', aggHours: 0 };
    case '1M':
      return { interval: '1mo', range: '10y', aggHours: 0 };
    default:
      return { interval: '15m', range: '1mo', aggHours: 0 };
  }
}

interface RawCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  session: 'ASIAN' | 'LONDON' | 'NEW_YORK' | 'OFF_PEAK';
}

function aggregateHourlyCandles(hourly: RawCandle[], blockHours: number): RawCandle[] {
  const stepSec = blockHours * 3600;
  const out: RawCandle[] = [];
  let bucketStart = -1;
  let cur: RawCandle | null = null;

  for (const c of hourly) {
    const b = c.time - (c.time % stepSec);
    if (b !== bucketStart || !cur) {
      if (cur) out.push(cur);
      bucketStart = b;
      cur = { ...c, time: b, session: classifySessionServer(b) };
    } else {
      cur.high = Math.max(cur.high, c.high);
      cur.low = Math.min(cur.low, c.low);
      cur.close = c.close;
      cur.volume += c.volume;
    }
  }
  if (cur) out.push(cur);
  return out;
}

app.get('/api/market/candles', async (req, res) => {
  const symbol = String(req.query.symbol || 'XAUUSD');
  const timeframe = String(req.query.timeframe || '15m');
  const mode = String(req.query.mode || 'live');
  const ticker = YAHOO_MAP[symbol];

  if (!ticker) {
    res.status(400).json({ ok: false, error: 'Unsupported symbol' });
    return;
  }

  const { interval, range, aggHours } = getYahooIntervalAndRange(timeframe, mode);

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3500);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`;
    const resp = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    clearTimeout(timer);

    if (!resp.ok) {
      res.json({ ok: false, source: 'fallback', candles: [] });
      return;
    }

    const json = (await resp.json()) as {
      chart?: {
        result?: Array<{
          meta?: { regularMarketPrice?: number };
          timestamp?: number[];
          indicators?: {
            quote?: Array<{
              open?: (number | null)[];
              high?: (number | null)[];
              low?: (number | null)[];
              close?: (number | null)[];
              volume?: (number | null)[];
            }>;
          };
        }>;
      };
    };

    const result = json.chart?.result?.[0];
    const ts = result?.timestamp || [];
    const q = result?.indicators?.quote?.[0];
    if (!q || ts.length === 0) {
      res.json({ ok: false, source: 'fallback', candles: [] });
      return;
    }

    const rawMap = new Map<number, RawCandle>();
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i];
      const o = q.open?.[i];
      const h = q.high?.[i];
      const l = q.low?.[i];
      const c = q.close?.[i];
      if (!Number.isFinite(t) || o == null || h == null || l == null || c == null) continue;
      if (!Number.isFinite(o) || !Number.isFinite(h) || !Number.isFinite(l) || !Number.isFinite(c)) continue;
      if (o <= 0 || h <= 0 || l <= 0 || c <= 0) continue;
      const v = q.volume?.[i] ?? 0;
      const hi = Math.max(o, h, l, c);
      const lo = Math.min(o, h, l, c);
      rawMap.set(t, {
        time: t,
        open: o,
        high: hi,
        low: lo,
        close: c,
        volume: Math.max(0, Math.round(v || 0)),
        session: classifySessionServer(t),
      });
    }

    const sortedCandles = Array.from(rawMap.values()).sort((a, b) => a.time - b.time);
    // Filter out consecutive flat zero-range duplicate settlement ticks (e.g., O=H=L=C repeated after market close)
    const cleanedCandles: RawCandle[] = [];
    for (const bar of sortedCandles) {
      const prev = cleanedCandles[cleanedCandles.length - 1];
      const isFlat = Math.abs(bar.high - bar.low) < 1e-9;
      if (prev && isFlat && Math.abs(bar.close - prev.close) < 1e-9) {
        continue;
      }
      cleanedCandles.push({
        ...bar,
        volume: bar.volume > 0 ? bar.volume : 1200,
      });
    }

    const finalCandles = aggHours > 0 ? aggregateHourlyCandles(cleanedCandles, aggHours) : cleanedCandles;
    const sliced = mode === 'backtest' ? finalCandles.slice(-500) : finalCandles.slice(-260);
    const livePrice = result?.meta?.regularMarketPrice ?? sliced[sliced.length - 1]?.close ?? null;

    res.json({
      ok: sliced.length > 20,
      source: 'yahoo_live',
      symbol,
      timeframe,
      livePrice,
      candles: sliced,
      timestamp: Date.now(),
    });
  } catch {
    res.json({ ok: false, source: 'fallback', candles: [] });
  }
});

app.get('/api/market/live-quotes', async (_req, res) => {
  const quotes: Record<string, number> = {};
  let fetchedCount = 0;

  try {
    const entries = Object.entries(YAHOO_MAP);
    await Promise.all(
      entries.map(async ([sym, ticker]) => {
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 2400);
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1m&range=1d`;
          const resp = await fetch(url, {
            signal: ctrl.signal,
            headers: { 'User-Agent': 'Mozilla/5.0' },
          });
          clearTimeout(timer);
          if (!resp.ok) return;
          const json = (await resp.json()) as {
            chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> };
          };
          const price = json.chart?.result?.[0]?.meta?.regularMarketPrice;
          if (typeof price === 'number' && Number.isFinite(price) && price > 0) {
            quotes[sym] = price;
            fetchedCount++;
          }
        } catch {
          // Graceful per-ticker fallback
        }
      })
    );
  } catch {
    // Graceful outer fallback
  }

  res.json({
    source: fetchedCount > 0 ? 'live_yahoo_sync' : 'calibrated_institutional_feed',
    fetchedCount,
    quotes,
    timestamp: Date.now(),
  });
});

// Live Weekly Economic Calendar feed (ForexFactory public JSON with 15-minute cache + safe fallback)
let calendarCache: { fetchedAt: number; events: unknown[] } | null = null;

app.get('/api/market/calendar', async (_req, res) => {
  const now = Date.now();
  if (calendarCache && now - calendarCache.fetchedAt < 15 * 60 * 1000) {
    res.json({ ok: true, source: 'live_ff_cached', events: calendarCache.events, timestamp: now });
    return;
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3200);
    const resp = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    clearTimeout(timer);

    if (!resp.ok) {
      res.json({ ok: false, source: 'fallback', events: [] });
      return;
    }

    const raw = (await resp.json()) as Array<{
      title?: string;
      country?: string;
      date?: string;
      impact?: string;
      forecast?: string;
      previous?: string;
    }>;

    const CURRENCY_AFFECTED_SYMBOLS: Record<string, string[]> = {
      USD: ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCAD', 'XAUUSD', 'XAGUSD', 'US30', 'NAS100', 'SPX500', 'BTCUSD', 'ETHUSD', 'SOLUSD'],
      EUR: ['EURUSD', 'GBPUSD', 'XAUUSD'],
      GBP: ['GBPUSD', 'EURUSD'],
      JPY: ['USDJPY', 'XAUUSD'],
      CAD: ['USDCAD', 'USOIL'],
    };

    const supportedCurrencies = new Set(['USD', 'EUR', 'GBP', 'JPY', 'CAD']);
    const weekdayNow = (() => {
      const d = new Date(now);
      const day = d.getUTCDay();
      const hr = d.getUTCHours();
      if (day === 6) return false;
      if (day === 5 && hr >= 22) return false;
      if (day === 0 && hr < 22) return false;
      return true;
    })();

    const normalized = Array.isArray(raw)
      ? raw
          .filter(
            (ev) =>
              ev &&
              ev.title &&
              ev.date &&
              supportedCurrencies.has(String(ev.country || '').toUpperCase()) &&
              (ev.impact === 'High' || ev.impact === 'Medium')
          )
          .map((ev, idx) => {
            const dt = new Date(ev.date!);
            const hh = String(dt.getUTCHours()).padStart(2, '0');
            const mm = String(dt.getUTCMinutes()).padStart(2, '0');
            const cur = String(ev.country).toUpperCase() as 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CAD';
            const impact = ev.impact === 'High' ? 'HIGH' : 'MEDIUM';
            const minutesUntil = Math.round((dt.getTime() - now) / 60000);
            const inBlackout = weekdayNow && impact === 'HIGH' && Math.abs(minutesUntil) <= 30;
            const detailParts = [
              ev.forecast ? `Forecast: ${ev.forecast}` : '',
              ev.previous ? `Previous: ${ev.previous}` : '',
            ].filter(Boolean);
            return {
              id: `ff-${idx}-${dt.getTime()}`,
              timeGmt: `${hh}:${mm}`,
              isoDate: dt.toISOString(),
              timestampMs: dt.getTime(),
              currency: cur,
              title: String(ev.title),
              impact,
              minutesUntil,
              inBlackout,
              affectedSymbols: CURRENCY_AFFECTED_SYMBOLS[cur] ?? CURRENCY_AFFECTED_SYMBOLS.USD,
              schedule: dt.toUTCString().slice(0, 11),
              notes: detailParts.length > 0 ? detailParts.join(' · ') : undefined,
              forecast: ev.forecast || '',
              previous: ev.previous || '',
            };
          })
          .filter((ev) => Number.isFinite(ev.timestampMs))
      : [];

    calendarCache = { fetchedAt: now, events: normalized };
    res.json({ ok: true, source: 'live_ff_feed', events: normalized, timestamp: now });
  } catch {
    res.json({ ok: false, source: 'fallback', events: [] });
  }
});

// Telegram alert proxy route
app.post('/api/telegram/send', async (req, res) => {
  const { botToken, chatId, text } = req.body as {
    botToken?: string;
    chatId?: string;
    text?: string;
  };

  if (!text || typeof text !== 'string') {
    res.status(400).json({ ok: false, error: 'Alert message text is required.' });
    return;
  }

  const token = botToken?.trim() || process.env.TELEGRAM_BOT_TOKEN || '';
  const targetChat = chatId?.trim() || process.env.TELEGRAM_CHAT_ID || '';

  if (!token || !targetChat) {
    res.json({
      ok: true,
      delivered: false,
      simulated: true,
      note: 'Bot Token / Chat ID not configured; alert recorded in local dispatch log.',
    });
    return;
  }

  try {
    const tgResp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChat,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const data = (await tgResp.json()) as { ok?: boolean; description?: string };
    if (!tgResp.ok || !data.ok) {
      res.status(400).json({ ok: false, delivered: false, error: data.description || 'Telegram API rejected request.' });
      return;
    }
    res.json({ ok: true, delivered: true, simulated: false });
  } catch (err) {
    res.status(502).json({
      ok: false,
      delivered: false,
      error: err instanceof Error ? err.message : 'Failed to reach Telegram API.',
    });
  }
});

// Advanced AI Quant Analysis & Multi-Turn Co-Pilot endpoints (server-side Gemini API)
app.post('/api/ai/analyze-setup', async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) {
    res.status(503).json({
      ok: false,
      error: 'Gemini API key is not available in Settings > Secrets.',
    });
    return;
  }

  const { symbol, timeframe, depth, context } = req.body as {
    symbol?: string;
    timeframe?: string;
    depth?: 'standard' | 'deep';
    context?: unknown;
  };

  if (!symbol || !context) {
    res.status(400).json({ ok: false, error: 'Symbol and market telemetry context are required.' });
    return;
  }

  const thinkingLevel = depth === 'deep' ? ThinkingLevel.MEDIUM : ThinkingLevel.LOW;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Explain the current ${symbol} (${timeframe || '15m'}) market snapshot below in simple, clear, everyday English that any trader can immediately understand. Use ONLY the numbers provided below and do not invent prices:\n\n${JSON.stringify(
        context,
        null,
        2
      )}`,
      config: {
        systemInstruction:
          'You are a friendly, clear trading coach on the FX Futures desk. Explain setups using ONLY simple, plain, easy-to-understand English. Avoid heavy technical jargon—if you mention a price level, trend, stop loss, or rule, explain what it means in everyday words (for example: "price is moving up", "wait for price to pull back into the buy zone", "risk limit reached"). Keep every field short (1-2 simple sentences), accurate to the provided numbers, and never use markdown symbols like **, ###, or backticks.',
        thinkingConfig: { thinkingLevel },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            verdict: {
              type: Type.STRING,
              description: 'Must be exactly STRONG_EXECUTE, CONDITIONAL_WAIT, or NO_TRADE_STAND_DOWN.',
            },
            confidencePct: {
              type: Type.INTEGER,
              description: 'Confidence score from 0 to 100.',
            },
            headline: {
              type: Type.STRING,
              description: 'One simple sentence summarizing what to do right now.',
            },
            smartMoneyThesis: {
              type: Type.STRING,
              description: '2 short, simple sentences explaining market direction and key price zone in plain language.',
            },
            intermarketDriver: {
              type: Type.STRING,
              description: '2 short, simple sentences explaining how USD, bond yields, market fear (VIX), and the active session affect this trade.',
            },
            executionPlan: {
              type: Type.OBJECT,
              properties: {
                triggerZone: { type: Type.STRING, description: 'Simple entry price or zone to watch.' },
                invalidationRule: { type: Type.STRING, description: 'Simple stop-loss price where the idea is wrong.' },
                targetPlan: { type: Type.STRING, description: 'Simple profit-taking plan in plain words.' },
                positionSizingNote: { type: Type.STRING, description: 'Simple risk and trade-limit reminder.' },
              },
            },
            bullCase: {
              type: Type.STRING,
              description: '1 simple sentence explaining what happens if price goes up.',
            },
            bearCase: {
              type: Type.STRING,
              description: '1 simple sentence explaining what happens if price goes down.',
            },
            riskWarnings: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Short, simple warning points in plain English.',
            },
          },
        },
      },
    });

    const rawText = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawText);

    const normalizedVerdict =
      parsed.verdict === 'STRONG_EXECUTE' ||
      parsed.verdict === 'CONDITIONAL_WAIT' ||
      parsed.verdict === 'NO_TRADE_STAND_DOWN'
        ? parsed.verdict
        : 'CONDITIONAL_WAIT';

    res.json({
      ok: true,
      report: {
        symbol,
        timeframe: timeframe || '15m',
        generatedAt: Date.now(),
        model: 'gemini-4-hydrogen',
        verdict: normalizedVerdict,
        confidencePct: Math.max(0, Math.min(100, Number(parsed.confidencePct) || 50)),
        headline: String(parsed.headline || 'Simple trade summary ready.'),
        smartMoneyThesis: String(parsed.smartMoneyThesis || ''),
        intermarketDriver: String(parsed.intermarketDriver || ''),
        executionPlan: {
          triggerZone: String(parsed.executionPlan?.triggerZone || 'Wait for price to reach the entry zone'),
          invalidationRule: String(parsed.executionPlan?.invalidationRule || 'Exit if price hits the stop loss'),
          targetPlan: String(parsed.executionPlan?.targetPlan || 'Take half profit at target 1, hold the rest for target 2'),
          positionSizingNote: String(parsed.executionPlan?.positionSizingNote || 'Risk at most 1% per trade'),
        },
        bullCase: String(parsed.bullCase || ''),
        bearCase: String(parsed.bearCase || ''),
        riskWarnings: Array.isArray(parsed.riskWarnings) ? parsed.riskWarnings.map(String) : [],
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI analysis failed.';
    res.status(502).json({ ok: false, error: msg });
  }
});

app.post('/api/ai/chat', async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) {
    res.status(503).json({
      ok: false,
      error: 'Gemini API key is not available in Settings > Secrets.',
    });
    return;
  }

  const { message, history, deskSnapshot } = req.body as {
    message?: string;
    history?: Array<{ role: 'user' | 'assistant'; text: string }>;
    deskSnapshot?: unknown;
  };

  if (!message || typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ ok: false, error: 'Prompt message is required.' });
    return;
  }

  try {
    const formattedHistory = Array.isArray(history)
      ? history
          .filter((m) => m && typeof m.text === 'string' && m.text.trim().length > 0)
          .slice(-8)
          .map((m) => ({
            role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
            parts: [{ text: m.text.trim() }],
          }))
      : [];

    const chat = ai.chats.create({
      model: 'gemini-4-hydrogen',
      history: formattedHistory,
      config: {
        systemInstruction: `You are FX Futures AI Co-Pilot, a helpful trading assistant for FX Futures.

STRICT STYLE RULES:
1. Give ONLY simple, plain-English explanations that any beginner or intermediate trader can read in 10 seconds.
2. Avoid complex jargon. If a number or rule matters (like daily trade limit, trend direction, USD strength, stop loss, or entry zone), explain what it means in simple words.
3. NEVER use raw Markdown formatting characters such as #, ##, ###, **, *, backticks (\`), or ---. Write clean plain text using short paragraphs and simple "- " bullet lines.
4. Keep answers brief (under 150 words), direct, and grounded strictly in the numbers from the live snapshot below.

LIVE DESK SNAPSHOT:
${JSON.stringify(deskSnapshot ?? {}, null, 2)}`,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const response = await chat.sendMessage({ message: message.trim() });
    res.json({
      ok: true,
      reply: (response.text ?? 'No response generated.').trim(),
      model: 'gemini-4-hydrogen',
      timestamp: Date.now(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI Co-Pilot request failed.';
    res.status(502).json({ ok: false, error: msg });
  }
});

// Ensure unknown /api routes and body-parser errors always return clean JSON (never HTML)
app.use('/api', (_req, res) => {
  res.status(404).json({ ok: false, error: 'API endpoint not found.' });
});

app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path.startsWith('/api')) {
    const msg = err instanceof Error ? err.message : 'Unexpected server error.';
    res.status(400).json({ ok: false, error: msg });
    return;
  }
  next(err);
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FX Futures running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
