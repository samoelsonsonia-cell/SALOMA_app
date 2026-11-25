import crypto from 'node:crypto';

let appwriteSdkPromise = null;
async function getAppwriteSdk() {
  if (!appwriteSdkPromise) {
    appwriteSdkPromise = import('node-appwrite');
  }
  return appwriteSdkPromise;
}

const BOT3_MAX_PROFIT_DAILY_PCT = 30;
const BOT3_MAX_TRADES_DAILY = 100;
const BOT3_MAX_TRADES_PER_COIN_DAY = 3;
const BOT3_LOSS_SLEEP_MS = 30 * 60 * 1000;
const DEFAULT_TZ_OFFSET_MINUTES = -180; // Madagascar (UTC+3)
const USD_TO_MGA = 4750;
const BOT3_ADMIN_CONFIG_USER_ID = '__SALOMA_BOT3_ADMIN_CONFIG__';
const BOT3_IGNORED_STABLE_BASES = new Set([
  'USDT',
  'USDC',
  'USDE',
  'FDUSD',
  'TUSD',
  'DAI',
  'BUSD',
  'USDD',
  'PYUSD',
  'EURC'
]);

function stripQuotes(raw) {
  const s = String(raw || '').trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1).trim();
  }
  return s;
}

function getDayKey(dateInput = new Date(), tzOffsetMinutes = DEFAULT_TZ_OFFSET_MINUTES) {
  const dt = dateInput instanceof Date ? dateInput : new Date(String(dateInput || ''));
  if (Number.isNaN(dt.getTime())) return '';
  const shifted = new Date(dt.getTime() - tzOffsetMinutes * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getNextMidnightMs(now = new Date(), tzOffsetMinutes = DEFAULT_TZ_OFFSET_MINUTES) {
  const shifted = new Date(now.getTime() - tzOffsetMinutes * 60_000);
  const nextShifted = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate() + 1,
    0,
    0,
    0,
    0
  );
  return nextShifted + tzOffsetMinutes * 60_000;
}

function parseJsonSafe(raw, fallback = null) {
  if (!raw) return fallback;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return fallback;
  }
}

function readNum(obj, keys, fallback = 0) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
      const n = Number(obj[k]);
      if (!Number.isNaN(n)) return n;
    }
  }
  return fallback;
}

function readBool(obj, keys, fallback = false) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null) {
      if (typeof obj[k] === 'boolean') return obj[k];
      const s = String(obj[k]).toLowerCase().trim();
      if (s === 'true' || s === '1' || s === 'on' || s === 'yes') return true;
      if (s === 'false' || s === '0' || s === 'off' || s === 'no') return false;
    }
  }
  return fallback;
}

function readStr(obj, keys, fallback = '') {
  for (const k of keys) {
    if (obj && typeof obj[k] === 'string' && obj[k].trim()) {
      return obj[k].trim();
    }
  }
  return fallback;
}

async function listAllRowsSafe(tablesDb, databaseId, tableId, queries = [], maxPages = 5) {
  if (!databaseId || !tableId) return [];
  const { Query } = await getAppwriteSdk();
  const all = [];
  let cursor = null;
  for (let p = 0; p < maxPages; p++) {
    const q = [...queries, Query.limit(100)];
    if (cursor) q.push(Query.cursorAfter(cursor));
    const res = await tablesDb.listRows({ databaseId, tableId, queries: q });
    const rows = Array.isArray(res?.rows) ? res.rows : [];
    all.push(...rows);
    if (rows.length < 100) break;
    cursor = rows[rows.length - 1].$id;
  }
  return all;
}

async function updateRowAdaptive(tablesDb, databaseId, tableId, rowId, data) {
  const payload = { ...data };
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      return await tablesDb.updateRow({
        databaseId,
        tableId,
        rowId,
        data: payload
      });
    } catch (err) {
      const msg = String(err?.message || '');
      const match = msg.match(/Unknown attribute:\s*"([^"]+)"/i);
      if (match && match[1] && match[1] in payload) {
        delete payload[match[1]];
        continue;
      }
      throw err;
    }
  }
  return null;
}

async function createRowAdaptive(tablesDb, databaseId, tableId, data) {
  const { ID } = await getAppwriteSdk();
  const payload = { ...data };
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      return await tablesDb.createRow({
        databaseId,
        tableId,
        rowId: ID.unique(),
        data: payload
      });
    } catch (err) {
      const msg = String(err?.message || '');
      const match = msg.match(/Unknown attribute:\s*"([^"]+)"/i);
      if (match && match[1] && match[1] in payload) {
        delete payload[match[1]];
        continue;
      }
      throw err;
    }
  }
  return null;
}

function normalizeBotSetting(row) {
  const embedded = parseJsonSafe(row?.settings_json, {}) || {};
  const merged = { ...embedded, ...row };
  const activePosition = parseJsonSafe(
    merged.active_position_json ?? merged.activePositionJson ?? embedded.activePosition,
    null
  );

  return {
    rowId: row.$id,
    userId: readStr(merged, ['user_id', 'userId']),
    enabled: readBool(merged, ['enabled', 'actif', 'bot_enabled', 'is_active'], false),
    capitalUsedPct: Math.min(100, Math.max(1, Math.round(readNum(merged, ['capital_used_pct', 'capitalUsedPct'], 100)))),
    investmentAr: Math.max(0, Math.round(readNum(merged, ['investment_ar', 'investmentAr', 'investissement'], 0))),
    usePercentStakeMode: readBool(merged, ['use_percent_stake_mode', 'usePercentStakeMode'], false),
    leverage: Math.min(100, Math.max(1, Math.round(readNum(merged, ['leverage', 'levier'], 10)))),
    leverageEnabled: readBool(merged, ['leverage_enabled', 'leverageEnabled'], true),
    profitTargetPct: Math.min(BOT3_MAX_PROFIT_DAILY_PCT, Math.max(1, readNum(merged, ['profit_target_pct', 'profitTargetPct', 'profit'], 30))),
    stopLossPct: -Math.min(50, Math.max(0.05, Math.abs(readNum(merged, ['stop_loss_pct', 'stopLossPct', 'stop_loss'], -0.2)))),
    dailyTradesCount: Math.max(0, Math.round(readNum(merged, ['daily_trades_count', 'dailyTradesCount'], 0))),
    consecutiveLosses: Math.max(0, Math.round(readNum(merged, ['consecutive_losses', 'consecutiveLosses'], 0))),
    sleepMode: readStr(merged, ['sleep_mode', 'sleepMode'], 'NONE'),
    sleepUntilMs: readNum(merged, ['sleep_until_ms', 'sleepUntilMs'], 0) || null,
    lastDayKey: readStr(merged, ['last_day_key', 'lastDayKey'], ''),
    dayStartCapitalAr: Math.max(0, Math.round(readNum(merged, ['day_start_capital_ar', 'dayStartCapitalAr'], 0))),
    lastTradePnlAr:
      merged.last_trade_pnl_ar !== undefined && merged.last_trade_pnl_ar !== null
        ? Number(merged.last_trade_pnl_ar)
        : merged.lastTradePnlAr !== undefined && merged.lastTradePnlAr !== null
        ? Number(merged.lastTradePnlAr)
        : null,
    activePosition: activePosition && activePosition.symbol ? activePosition : null,
    embedded
  };
}

function normalizeSignalRow(row) {
  const rawSym = readStr(row, ['symbol', 'coin', 'paire', 'asset']).toUpperCase();
  const symbol = rawSym.split('/')[0].trim();
  const dirRaw = readStr(row, ['signal_dir', 'direction', 'dir', 'tendance']).toLowerCase();
  const signalDir =
    dirRaw === 'up' || dirRaw === 'hausse' || dirRaw === 'buy' || dirRaw === 'vert'
      ? 'up'
      : dirRaw === 'down' || dirRaw === 'baisse' || dirRaw === 'sell' || dirRaw === 'rouge'
      ? 'down'
      : 'none';
  const stepRaw = readNum(row, ['signal_step', 'step', 'signal', 'bougie', 'candle_step'], 0);
  const price = readNum(row, ['price', 'prix', 'close', 'saloma_price', 'last_price'], 0);
  return {
    rowId: row.$id,
    symbol,
    signalDir,
    signalStep: stepRaw >= 1 && stepRaw <= 9 ? Math.round(stepRaw) : null,
    price: price > 0 ? price : 0
  };
}

function computeBot3SalomaFeeAr(netProfitAr, feeEnabled) {
  if (!feeEnabled || !Number.isFinite(netProfitAr) || netProfitAr <= 0) return 0;
  const raw = netProfitAr * 0.001; // 0.1% du profit net par trade clôturé (ex: 10 000 Ar -> 10 Ar)
  return netProfitAr >= 500 ? Math.round(raw) : Number(raw.toFixed(2));
}

async function fetchRealBybitBalanceUsdt() {
  const apiKey = stripQuotes(process.env.BYBIT_API_KEY);
  const apiSecret = stripQuotes(process.env.BYBIT_API_SECRET);
  if (!apiKey || !apiSecret) {
    return { configured: false, connected: false, usdtBalance: 0, capitalAr: 0 };
  }

  const domains = ['https://api.bybit.com', 'https://api.bytick.com'];
  const recvWindow = '10000';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    for (const baseUrl of domains) {
      let serverTs = Date.now().toString();
      try {
        const tRes = await fetch(`${baseUrl}/v5/market/time`, { signal: controller.signal });
        const tJson = await tRes.json().catch(() => null);
        if (tJson?.retCode === 0) {
          if (typeof tJson.time === 'number' && tJson.time > 0) serverTs = String(tJson.time);
          else if (tJson.result?.timeSecond) serverTs = String(Number(tJson.result.timeSecond) * 1000);
        }
      } catch {
        // fallback local clock
      }

      for (const accType of ['UNIFIED', 'SPOT']) {
        try {
          const qs = `accountType=${accType}`;
          const prehash = `${serverTs}${apiKey}${recvWindow}${qs}`;
          const sign = crypto.createHmac('sha256', apiSecret).update(prehash).digest('hex');
          const r = await fetch(`${baseUrl}/v5/account/wallet-balance?${qs}`, {
            method: 'GET',
            headers: {
              'X-BAPI-API-KEY': apiKey,
              'X-BAPI-SIGN': sign,
              'X-BAPI-TIMESTAMP': serverTs,
              'X-BAPI-RECV-WINDOW': recvWindow,
              Accept: 'application/json',
              'User-Agent': 'SalomaTradingPlatform/1.0'
            },
            signal: controller.signal
          });
          const data = await r.json().catch(() => null);
          if (r.ok && data?.retCode === 0) {
            let usdt = 0;
            for (const acc of data.result?.list || []) {
              const usdtCoin = (acc.coin || []).find(
                c => String(c.coin || '').toUpperCase() === 'USDT'
              );
              if (usdtCoin) {
                usdt += Number(usdtCoin.walletBalance || usdtCoin.equity || 0) || 0;
              } else if (acc.totalWalletBalance) {
                usdt += Number(acc.totalWalletBalance) || 0;
              }
            }
            const cleanUsdt = Number(Math.max(0, usdt).toFixed(4));
            return {
              configured: true,
              connected: true,
              usdtBalance: cleanUsdt,
              capitalAr: cleanUsdt > 0 ? Math.round(cleanUsdt * USD_TO_MGA) : 0
            };
          }
        } catch {
          // try next accountType or domain
        }
      }
    }
    return { configured: true, connected: false, usdtBalance: 0, capitalAr: 0 };
  } finally {
    clearTimeout(timer);
  }
}

function evaluateBot3KlineStreak(klineList) {
  if (!Array.isArray(klineList) || klineList.length === 0) {
    return { signalDir: 'none', signalStep: null, price: 0 };
  }
  const ordered = [...klineList].reverse();
  let upStreak = 0;
  let downStreak = 0;
  let lastDir = 'none';
  let lastStep = null;
  let lastPrice = 0;

  for (const row of ordered) {
    if (!Array.isArray(row) || row.length < 5) continue;
    const open = Number(row[1]);
    const close = Number(row[4]);
    if (!Number.isFinite(open) || !Number.isFinite(close) || close <= 0) continue;
    const isUp = close >= open;
    if (isUp) {
      upStreak = Math.min(9, upStreak + 1);
      downStreak = 0;
      lastDir = 'up';
      lastStep = upStreak;
    } else {
      downStreak = downStreak === 0 ? 9 : Math.max(5, downStreak - 1);
      upStreak = 0;
      lastDir = 'down';
      lastStep = downStreak;
    }
    lastPrice = close;
  }

  return { signalDir: lastDir, signalStep: lastStep, price: lastPrice };
}

async function scanAllBybitSpotUsdtPairs(extraSymbols = []) {
  const domains = ['https://api.bybit.com', 'https://api.bytick.com'];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    let tickerRows = [];
    let activeDomain = domains[0];

    for (const baseUrl of domains) {
      try {
        const r = await fetch(`${baseUrl}/v5/market/tickers?category=spot`, {
          headers: { Accept: 'application/json', 'User-Agent': 'SalomaTradingPlatform/1.0' },
          signal: controller.signal
        });
        if (!r.ok) continue;
        const j = await r.json().catch(() => null);
        if (j?.retCode === 0 && Array.isArray(j?.result?.list) && j.result.list.length > 0) {
          tickerRows = j.result.list;
          activeDomain = baseUrl;
          break;
        }
      } catch {
        // try fallback
      }
    }

    const allUsdtPairs = tickerRows
      .filter(row => typeof row.symbol === 'string' && row.symbol.endsWith('USDT'))
      .map(row => {
        const rawSym = String(row.symbol || '');
        const base = rawSym.slice(0, -4).toUpperCase().trim();
        const last = parseFloat(row.lastPrice || '');
        const pct24h = (parseFloat(row.price24hPcnt || '') || 0) * 100;
        const volUsd = parseFloat(row.turnover24h || '') || 0;
        return { pair: rawSym, symbol: base, last, pct24h, volUsd };
      })
      .filter(item => item.symbol && !BOT3_IGNORED_STABLE_BASES.has(item.symbol) && item.last > 0);

    const tickerPriceBySymbol = new Map(allUsdtPairs.map(p => [p.symbol, p.last]));

    // Prioriser les paires actives + paires demandées (positions ouvertes) pour lire les bougies 1m réelles Bybit
    const extraSet = new Set(extraSymbols.map(s => String(s || '').toUpperCase().trim()).filter(Boolean));
    const prioritized = [
      ...allUsdtPairs.filter(p => extraSet.has(p.symbol)),
      ...allUsdtPairs
        .filter(p => !extraSet.has(p.symbol) && p.volUsd > 10000)
        .sort((a, b) => {
          const aScore = (a.pct24h > 0 ? 1 : 0) * 1e12 + a.volUsd;
          const bScore = (b.pct24h > 0 ? 1 : 0) * 1e12 + b.volUsd;
          return bScore - aScore;
        })
        .slice(0, 40)
    ];

    const scannedSignals = [];
    for (let i = 0; i < prioritized.length; i += 8) {
      const chunk = prioritized.slice(i, i + 8);
      const batch = await Promise.all(
        chunk.map(async item => {
          try {
            const kRes = await fetch(
              `${activeDomain}/v5/market/kline?category=spot&symbol=${encodeURIComponent(item.pair)}&interval=1&limit=16`,
              {
                headers: { Accept: 'application/json', 'User-Agent': 'SalomaTradingPlatform/1.0' },
                signal: controller.signal
              }
            );
            if (!kRes.ok) return null;
            const kJson = await kRes.json().catch(() => null);
            if (kJson?.retCode !== 0 || !Array.isArray(kJson?.result?.list)) return null;
            const evaluated = evaluateBot3KlineStreak(kJson.result.list);
            if (evaluated.price <= 0) return null;
            return {
              symbol: item.symbol,
              signalDir: evaluated.signalDir,
              signalStep: evaluated.signalStep,
              price: evaluated.price || item.last
            };
          } catch {
            return null;
          }
        })
      );
      for (const sig of batch) {
        if (sig) scannedSignals.push(sig);
      }
    }

    return {
      totalPairsCount: allUsdtPairs.length,
      tickerPriceBySymbol,
      signals: scannedSignals
    };
  } catch {
    return {
      totalPairsCount: 0,
      tickerPriceBySymbol: new Map(),
      signals: []
    };
  } finally {
    clearTimeout(timer);
  }
}

function resolveRealBybitCapitalForSetting(bybitLive, rawSetting, embedded) {
  if (bybitLive.configured) {
    return bybitLive.connected && bybitLive.usdtBalance > 0 ? bybitLive.capitalAr : 0;
  }
  const syncedAtMs = Number(embedded?.bybitSyncedAtMs || 0);
  const syncedCapitalAr = Math.max(
    0,
    Math.round(readNum({ ...embedded, ...rawSetting }, ['bybit_capital_ar', 'bybitCapitalAr'], 0))
  );
  if (syncedAtMs > 0 && Date.now() - syncedAtMs <= 5 * 60 * 1000 && syncedCapitalAr > 0) {
    return syncedCapitalAr;
  }
  return 0;
}

export default async ({ req, res, log, error } = {}) => {
  const safeLog = typeof log === 'function' ? log : console.log;
  const safeError = typeof error === 'function' ? error : console.error;
  const sendJson = (payload, statusCode = 200) => {
    if (res && typeof res.json === 'function') {
      return res.json(payload, statusCode);
    }
    if (res && typeof res.send === 'function') {
      return res.send(JSON.stringify(payload), statusCode, { 'content-type': 'application/json' });
    }
    return { statusCode, body: payload };
  };

  try {
    const method = String(req?.method || 'GET').toUpperCase().trim();
    const rawPath = String(req?.path || req?.url || '/').split('?')[0].trim();
    const normalizedPath = rawPath === '' ? '/' : rawPath.replace(/\/+$/, '') || '/';
    const headers = req?.headers && typeof req.headers === 'object' ? req.headers : {};
    const trigger = String(
      headers['x-appwrite-trigger'] || headers['X-Appwrite-Trigger'] || ''
    )
      .toLowerCase()
      .trim();

    // 1. Requête GET / ou GET /health (UptimeRobot / Better Stack / ping sans body) :
    // NE trade PAS, N'appelle PAS Bybit, NE touche PAS les Env.
    if (
      (method === 'GET' && (normalizedPath === '/' || normalizedPath === '/health')) ||
      (method !== 'POST' && trigger !== 'schedule')
    ) {
      return sendJson(
        { status: 'alive', robot: 'SALOMA', trading: true },
        200
      );
    }

    // 2. Seulement en POST (ou déclencheur Cron schedule) : logique de trading SALOMA normale
    const endpoint = stripQuotes(
      process.env.APPWRITE_FUNCTION_API_ENDPOINT ||
        process.env.APPWRITE_ENDPOINT ||
        process.env.VITE_APPWRITE_ENDPOINT
    );
    const projectId = stripQuotes(
      process.env.APPWRITE_FUNCTION_PROJECT_ID ||
        process.env.APPWRITE_PROJECT_ID ||
        process.env.VITE_APPWRITE_PROJECT_ID
    );
    const apiKey = stripQuotes(
      headers['x-appwrite-key'] || headers['X-Appwrite-Key'] || process.env.APPWRITE_API_KEY
    );
    const databaseId = stripQuotes(
      process.env.APPWRITE_DATABASE_ID || process.env.VITE_APPWRITE_DATABASE_ID
    );
    const tableBotSetting = stripQuotes(
      process.env.APPWRITE_TABLE_BOT_SETTING || process.env.VITE_APPWRITE_TABLE_BOT_SETTING
    );
    const tableLiveBalance = stripQuotes(
      process.env.APPWRITE_TABLE_LIVE_BALANCE || process.env.VITE_APPWRITE_TABLE_LIVE_BALANCE
    );
    const tableSignales = stripQuotes(
      process.env.APPWRITE_TABLE_SIGNALES || process.env.VITE_APPWRITE_TABLE_SIGNALES
    );
    const tableTrades = stripQuotes(
      process.env.APPWRITE_TABLE_TRADES || process.env.VITE_APPWRITE_TABLE_TRADES
    );
    const tableWallets = stripQuotes(
      process.env.APPWRITE_TABLE_WALLETS || process.env.VITE_APPWRITE_TABLE_WALLETS
    );

    if (!endpoint || !projectId || !databaseId || !apiKey) {
      const msg = 'Project ID ou variables Appwrite introuvables - vérifie les Environment Variables';
      safeError(msg);
      return res.json({ ok: false, error: msg }, 500);
    }

    if (!tableBotSetting || !tableLiveBalance || !tableSignales || !tableTrades) {
      const msg =
        'IDs des collections manquants (Bot Setting / Live Balance / Signales / Trade) dans les Environment Variables';
      safeError(msg);
      return res.json({ ok: false, error: msg }, 500);
    }

    const { Client, TablesDB, Query } = await getAppwriteSdk();
    const client = new Client()
      .setEndpoint(endpoint)
      .setProject(projectId)
      .setKey(apiKey);
    const tablesDb = new TablesDB(client);

    const nowMs = Date.now();
    const nowDate = new Date(nowMs);
    const nowIso = nowDate.toISOString();
    const todayKey = getDayKey(nowDate, DEFAULT_TZ_OFFSET_MINUTES);

    const [botSettingRows, signalRows, bybitLive] = await Promise.all([
      listAllRowsSafe(tablesDb, databaseId, tableBotSetting, [], 5),
      listAllRowsSafe(tablesDb, databaseId, tableSignales, [], 3),
      fetchRealBybitBalanceUsdt()
    ]);

    const adminCfgRow = botSettingRows.find(
      r => readStr(r, ['user_id', 'userId']) === BOT3_ADMIN_CONFIG_USER_ID
    );
    const adminCfgEmbedded = parseJsonSafe(adminCfgRow?.settings_json, {}) || {};
    const bot3SalomaFeeEnabled = readBool(
      { ...adminCfgEmbedded, ...(adminCfgRow || {}) },
      ['bot3_saloma_fee_enabled', 'bot3SalomaFeeEnabled'],
      false
    );

    const openPositionSymbols = botSettingRows
      .map(r => normalizeBotSetting(r)?.activePosition?.symbol)
      .filter(Boolean);

    const bybitScan = await scanAllBybitSpotUsdtPairs(openPositionSymbols);
    const appwriteSignals = signalRows.map(normalizeSignalRow).filter(s => s.symbol && s.price > 0);
    const signalsBySymbol = new Map();
    for (const sig of bybitScan.signals) {
      signalsBySymbol.set(sig.symbol, sig);
    }
    for (const sig of appwriteSignals) {
      if (!signalsBySymbol.has(sig.symbol)) {
        const livePrice = bybitScan.tickerPriceBySymbol.get(sig.symbol) || sig.price;
        signalsBySymbol.set(sig.symbol, { ...sig, price: livePrice });
      }
    }
    const signals = Array.from(signalsBySymbol.values());
    const actions = [];

    for (const rawSetting of botSettingRows) {
      const setting = normalizeBotSetting(rawSetting);
      if (!setting.userId || setting.userId === BOT3_ADMIN_CONFIG_USER_ID) continue;

      try {
        const liveBalanceAr = resolveRealBybitCapitalForSetting(bybitLive, rawSetting, setting.embedded);

        // Si Bybit = 0 -> Capital = 0, pas de trade
        if (liveBalanceAr <= 0) {
          if (setting.enabled) {
            await updateRowAdaptive(tablesDb, databaseId, tableBotSetting, setting.rowId, {
              enabled: false,
              capital_ar: 0,
              status_label: 'Solde Bybit réel à 0 USDT — Pas de trade',
              avatar_mood: 'OFF',
              last_run_at: nowIso
            });
          }
          continue;
        }

        if (!setting.enabled) {
          continue;
        }

        // Réveil quotidien automatique à 00:00H
        if (setting.lastDayKey && setting.lastDayKey !== todayKey) {
          await updateRowAdaptive(tablesDb, databaseId, tableBotSetting, setting.rowId, {
            last_day_key: todayKey,
            daily_trades_count: 0,
            day_start_capital_ar: liveBalanceAr,
            consecutive_losses: 0,
            sleep_mode: 'NONE',
            sleep_until_ms: 0,
            status_label: '00:00H — Réveil automatique ! Nouveau jour',
            avatar_mood: 'WATCHING',
            last_run_at: nowIso,
            settings_json: JSON.stringify({
              ...setting.embedded,
              lastDayKey: todayKey,
              dailyTradesCount: 0,
              dayStartCapitalAr: liveBalanceAr,
              consecutiveLosses: 0,
              sleepMode: 'NONE',
              sleepUntilMs: null
            })
          });
          actions.push({ userId: setting.userId, action: 'DAILY_RESET' });
          continue;
        }

        const dayStartCapitalAr =
          setting.dayStartCapitalAr > 0 ? setting.dayStartCapitalAr : liveBalanceAr;

        // Gestion sommeil 30 minutes (3 pertes consécutives)
        if (setting.sleepMode === 'SLEEP_30M') {
          if (setting.sleepUntilMs && nowMs < setting.sleepUntilMs) {
            await updateRowAdaptive(tablesDb, databaseId, tableBotSetting, setting.rowId, {
              avatar_mood: 'SLEEP_30M',
              status_label: 'Dort 30 min (3 pertes consécutives)',
              last_run_at: nowIso
            });
            continue;
          }
          await updateRowAdaptive(tablesDb, databaseId, tableBotSetting, setting.rowId, {
            sleep_mode: 'NONE',
            sleep_until_ms: 0,
            consecutive_losses: 0,
            avatar_mood: 'WATCHING',
            status_label: 'Réveil automatique après 30 min — Reprise du scan',
            last_run_at: nowIso
          });
        }

        // Gestion sommeil jusqu'à 00:00H (Profit max atteint)
        if (setting.sleepMode === 'SLEEP_MIDNIGHT') {
          if (setting.sleepUntilMs && nowMs < setting.sleepUntilMs) {
            await updateRowAdaptive(tablesDb, databaseId, tableBotSetting, setting.rowId, {
              avatar_mood: 'SLEEP_MIDNIGHT',
              status_label: 'Objectif journalier atteint — Dort jusqu’à 00:00H',
              last_run_at: nowIso
            });
            continue;
          }
          await updateRowAdaptive(tablesDb, databaseId, tableBotSetting, setting.rowId, {
            sleep_mode: 'NONE',
            sleep_until_ms: 0,
            daily_trades_count: 0,
            day_start_capital_ar: liveBalanceAr,
            consecutive_losses: 0,
            last_day_key: todayKey,
            avatar_mood: 'WATCHING',
            status_label: '00:00H — Réveil automatique ! Nouveau jour',
            last_run_at: nowIso
          });
        }

        const curDailyCapPct = Math.min(BOT3_MAX_PROFIT_DAILY_PCT, Math.max(1, setting.profitTargetPct));
        const curDailyProfitPct =
          dayStartCapitalAr > 0 ? ((liveBalanceAr - dayStartCapitalAr) / dayStartCapitalAr) * 100 : 0;

        if (curDailyProfitPct >= curDailyCapPct || setting.dailyTradesCount >= BOT3_MAX_TRADES_DAILY) {
          const midnightMs = getNextMidnightMs(nowDate, DEFAULT_TZ_OFFSET_MINUTES);
          await updateRowAdaptive(tablesDb, databaseId, tableBotSetting, setting.rowId, {
            sleep_mode: 'SLEEP_MIDNIGHT',
            sleep_until_ms: midnightMs,
            avatar_mood: 'SLEEP_MIDNIGHT',
            status_label: `Profit ${curDailyCapPct}% atteint — Dort jusqu’à 00:00H`,
            last_run_at: nowIso
          });
          actions.push({ userId: setting.userId, action: 'SLEEP_MIDNIGHT' });
          continue;
        }

        // Compter les Trades du jour + ouverts par Coin dans Collection TRADE (Max 3 / coin)
        const userTrades = await listAllRowsSafe(
          tablesDb,
          databaseId,
          tableTrades,
          [Query.equal('user_id', setting.userId), Query.orderDesc('$createdAt')],
          3
        );

        const coinCountsToday = {};
        const openCountsByCoin = {};
        for (const tr of userTrades) {
          const statut = String(tr.statut || '').toLowerCase();
          if (statut === 'annule') continue;
          const sym = String(tr.paire || '')
            .split('/')[0]
            ?.toUpperCase()
            .trim();
          if (!sym) continue;
          if (statut === 'en_cours') {
            openCountsByCoin[sym] = (openCountsByCoin[sym] || 0) + 1;
          }
          const trDay = getDayKey(tr.date_creation || tr.$createdAt, DEFAULT_TZ_OFFSET_MINUTES);
          if (trDay === todayKey || statut === 'en_cours') {
            coinCountsToday[sym] = (coinCountsToday[sym] || 0) + 1;
          }
        }

        // 1) Si position ouverte : vérifier TP / Stop Loss / Signal 9..5 rouge (Plan Robot N°03)
        if (setting.activePosition) {
          const pos = setting.activePosition;
          const sig = signalsBySymbol.get(pos.symbol);
          const curPrice = sig?.price > 0 ? sig.price : pos.currentPrice || pos.entryPrice;
          const rawMovePct =
            ((curPrice - pos.entryPrice) / Math.max(pos.entryPrice, 1e-12)) * 100;
          const levMovePct = rawMovePct * (pos.leverage || 1);
          const ticksHeld = (pos.ticksHeld || 0) + 1;

          const stopLossThreshold = -Math.abs(setting.stopLossPct);
          const isDownSignal9to5 =
            sig?.signalDir === 'down' &&
            sig.signalStep !== null &&
            sig.signalStep >= 5 &&
            sig.signalStep <= 9;

          const hitStopLoss = levMovePct <= stopLossThreshold;
          const hitTakeProfit = levMovePct >= 0.55;
          const hitSignalDownEarlyExit =
            isDownSignal9to5 &&
            ticksHeld >= 2 &&
            (levMovePct >= 0.18 || (ticksHeld >= 4 && levMovePct > stopLossThreshold));

          if (hitStopLoss || hitTakeProfit || hitSignalDownEarlyExit) {
            let finalPnlPct = levMovePct;
            if (hitTakeProfit) {
              finalPnlPct =
                Math.max(0.5, Math.min(0.6, Number(levMovePct.toFixed(2)))) *
                (pos.leverage > 1 ? Math.min(3, Math.max(1, pos.leverage * 0.25)) : 1);
              finalPnlPct = Number(Math.max(0.55, Math.min(finalPnlPct, curDailyCapPct)).toFixed(2));
            } else if (hitStopLoss) {
              finalPnlPct = Number(stopLossThreshold.toFixed(2));
            } else {
              finalPnlPct = Number(levMovePct.toFixed(2));
            }

            let grossPnlAr = Math.round((pos.amountAr * finalPnlPct) / 100);
            if (grossPnlAr === 0 && finalPnlPct !== 0) grossPnlAr = finalPnlPct > 0 ? 1 : -1;

            const maxAllowedDayCapital = Math.floor(dayStartCapitalAr * (1 + curDailyCapPct / 100));
            if (grossPnlAr > 0 && liveBalanceAr + grossPnlAr > maxAllowedDayCapital) {
              grossPnlAr = Math.max(0, maxAllowedDayCapital - liveBalanceAr);
            }

            // Frais SALOMA 0.1% du profit net par trade clôturé (UNIQUEMENT si Admin ON, OFF par défaut = 0 frais)
            const salomaFeeAr = computeBot3SalomaFeeAr(grossPnlAr, bot3SalomaFeeEnabled);
            const pnlAr = salomaFeeAr > 0 ? Math.round(grossPnlAr - salomaFeeAr) : grossPnlAr;

            const newBalanceAr = Math.max(0, liveBalanceAr + pnlAr);
            const isWin = pnlAr >= 0;
            const nextLosses = isWin ? 0 : setting.consecutiveLosses + 1;
            const nextTradesCount = setting.dailyTradesCount + 1;
            const nextDailyPct =
              dayStartCapitalAr > 0 ? ((newBalanceAr - dayStartCapitalAr) / dayStartCapitalAr) * 100 : 0;

            let nextSleepMode = 'NONE';
            let nextSleepUntilMs = 0;
            if (nextLosses >= 3) {
              nextSleepMode = 'SLEEP_30M';
              nextSleepUntilMs = nowMs + BOT3_LOSS_SLEEP_MS;
            } else if (nextDailyPct >= curDailyCapPct || nextTradesCount >= BOT3_MAX_TRADES_DAILY) {
              nextSleepMode = 'SLEEP_MIDNIGHT';
              nextSleepUntilMs = getNextMidnightMs(nowDate, DEFAULT_TZ_OFFSET_MINUTES);
            }

            // Mettre à jour ou écrire le trade dans Collection TRADE
            if (pos.tradeRowId) {
              await updateRowAdaptive(tablesDb, databaseId, tableTrades, pos.tradeRowId, {
                statut: 'termine',
                profit: pnlAr,
                saloma_fee_ar: salomaFeeAr,
                close_price: curPrice,
                date_cloture: nowIso
              });
            } else {
              await createRowAdaptive(tablesDb, databaseId, tableTrades, {
                user_id: setting.userId,
                paire: `${pos.symbol}/USDT`,
                type: 'achat',
                montant: pos.amountAr,
                prix: pos.entryPrice,
                profit: pnlAr,
                saloma_fee_ar: salomaFeeAr,
                statut: 'termine',
                date_creation: pos.entryIso || nowIso,
                date_cloture: nowIso,
                leverage: pos.leverage || 1,
                close_price: curPrice,
                mode: 'BOT 3'
              });
            }

            const feeTag = salomaFeeAr > 0 ? ` • Frais SALOMA : ${salomaFeeAr.toLocaleString('fr-FR')} Ar` : '';
            const nextStatusLabel =
              nextSleepMode === 'SLEEP_30M'
                ? `3 pertes de suite — Dort 30 minutes${feeTag}`
                : nextSleepMode === 'SLEEP_MIDNIGHT'
                ? `Profit ${curDailyCapPct}% atteint — Dort jusqu’à 00:00H${feeTag}`
                : isWin
                ? `SELL ${pos.symbol} : +${finalPnlPct.toFixed(2)}% (+${pnlAr.toLocaleString('fr-FR')} Ar)${feeTag}`
                : `STOP LOSS ${pos.symbol} : ${finalPnlPct.toFixed(2)}% (${pnlAr.toLocaleString('fr-FR')} Ar)`;

            await updateRowAdaptive(tablesDb, databaseId, tableBotSetting, setting.rowId, {
              daily_trades_count: nextTradesCount,
              consecutive_losses: nextLosses,
              sleep_mode: nextSleepMode,
              sleep_until_ms: nextSleepUntilMs,
              last_trade_pnl_ar: pnlAr,
              active_position_json: '',
              day_start_capital_ar: dayStartCapitalAr,
              last_day_key: todayKey,
              avatar_mood: nextSleepMode === 'NONE' ? 'SELL' : nextSleepMode,
              status_label: nextStatusLabel,
              scanned_symbol: pos.symbol,
              last_run_at: nowIso,
              settings_json: JSON.stringify({
                ...setting.embedded,
                dailyTradesCount: nextTradesCount,
                consecutiveLosses: nextLosses,
                sleepMode: nextSleepMode,
                sleepUntilMs: nextSleepUntilMs || null,
                lastTradePnlAr: pnlAr,
                dayStartCapitalAr,
                lastDayKey: todayKey,
                activePosition: null
              })
            });

            actions.push({ userId: setting.userId, action: 'CLOSE_TRADE', symbol: pos.symbol, pnlAr, salomaFeeAr });
          } else {
            const updatedPos = {
              ...pos,
              currentPrice: curPrice,
              pnlPct: Number(levMovePct.toFixed(2)),
              pnlAr: Math.round((pos.amountAr * levMovePct) / 100),
              ticksHeld
            };
            await updateRowAdaptive(tablesDb, databaseId, tableBotSetting, setting.rowId, {
              active_position_json: JSON.stringify(updatedPos),
              avatar_mood: 'WATCHING',
              status_label: `Trade en cours : ${pos.symbol}/USDT (${levMovePct >= 0 ? '+' : ''}${levMovePct.toFixed(2)}%)`,
              scanned_symbol: pos.symbol,
              last_run_at: nowIso,
              settings_json: JSON.stringify({
                ...setting.embedded,
                activePosition: updatedPos
              })
            });
          }
          continue;
        }

        // 2) Pas de position ouverte : scan TOUTES les paires Spot USDT Bybit (Max 3 trades / coin)
        const stakeNow = setting.usePercentStakeMode
          ? Math.round((liveBalanceAr * setting.capitalUsedPct) / 100)
          : Math.round(setting.investmentAr);
        const boundedStake = Math.min(liveBalanceAr, Math.max(0, stakeNow));

        if (boundedStake <= 0) {
          await updateRowAdaptive(tablesDb, databaseId, tableBotSetting, setting.rowId, {
            avatar_mood: 'REST',
            status_label: 'Investissement à 0 Ar — Saisissez un montant ou MAX',
            last_run_at: nowIso
          });
          continue;
        }

        let bestCoin = null;
        let eligibleCount = 0;

        for (const sig of signals) {
          const usedToday = coinCountsToday[sig.symbol] || 0;
          const openForCoin = openCountsByCoin[sig.symbol] || 0;
          // Max 3 trades ouverts / jour par coin : si 3 déjà, passe au coin suivant
          if (Math.max(usedToday, openForCoin) >= BOT3_MAX_TRADES_PER_COIN_DAY) {
            continue;
          }
          eligibleCount++;
          if (sig.signalDir === 'up' && sig.signalStep !== null && sig.signalStep >= 4 && sig.signalStep <= 9) {
            if (!bestCoin || sig.signalStep > bestCoin.signalStep) {
              bestCoin = sig;
            }
          }
        }

        if (signals.length > 0 && eligibleCount === 0) {
          safeLog('Aucun coin valide - En attente');
          await updateRowAdaptive(tablesDb, databaseId, tableBotSetting, setting.rowId, {
            avatar_mood: 'REST',
            scanned_symbol: '',
            status_label: 'LIMITE 3/3 ATTEINTE - Aucun coin valide - En attente',
            last_run_at: nowIso
          });
          continue;
        }

        // 3) AUCUN COIN VALIDE = AUCUN TRADE (Jamais de trade forcé / par défaut sur BTC ou PEPE)
        if (!bestCoin) {
          safeLog('Aucun coin valide - En attente');
          await updateRowAdaptive(tablesDb, databaseId, tableBotSetting, setting.rowId, {
            avatar_mood: 'REST',
            scanned_symbol: '',
            status_label: 'Aucun coin valide - En attente',
            last_run_at: nowIso
          });
          continue;
        }

        const levToUse = setting.leverageEnabled ? Math.min(100, Math.max(1, setting.leverage)) : 1;
        const limitEntryPrice = Number((bestCoin.price * 0.9998).toPrecision(8));

        const createdTradeRow = await createRowAdaptive(tablesDb, databaseId, tableTrades, {
          user_id: setting.userId,
          paire: `${bestCoin.symbol}/USDT`,
          type: 'achat',
          montant: boundedStake,
          prix: limitEntryPrice,
          profit: 0,
          statut: 'en_cours',
          date_creation: nowIso,
          date_cloture: '',
          leverage: levToUse,
          close_price: bestCoin.price,
          mode: 'BOT 3'
        });

        const newPos = {
          tradeRowId: createdTradeRow?.$id || null,
          symbol: bestCoin.symbol,
          entryPrice: limitEntryPrice,
          currentPrice: bestCoin.price,
          entryTimeMs: nowMs,
          entryIso: nowIso,
          amountAr: boundedStake,
          leverage: levToUse,
          pnlPct: 0,
          pnlAr: 0,
          ticksHeld: 0
        };

        await updateRowAdaptive(tablesDb, databaseId, tableBotSetting, setting.rowId, {
          active_position_json: JSON.stringify(newPos),
          day_start_capital_ar: dayStartCapitalAr,
          last_day_key: todayKey,
          avatar_mood: 'BUY',
          scanned_symbol: bestCoin.symbol,
          status_label: `Signal ${bestCoin.signalStep}/9 vert ! BUY LIMIT ${bestCoin.symbol}/USDT`,
          last_run_at: nowIso,
          settings_json: JSON.stringify({
            ...setting.embedded,
            dayStartCapitalAr,
            lastDayKey: todayKey,
            activePosition: newPos
          })
        });

        actions.push({ userId: setting.userId, action: 'OPEN_TRADE', symbol: bestCoin.symbol });
      } catch (userErr) {
        safeError(`Erreur BOT 3 user ${setting.userId}: ${userErr?.message || userErr}`);
      }
    }

    safeLog(`bot-saloma cron exécuté: ${actions.length} action(s)`);
    return res.json({
      ok: true,
      timestamp: nowIso,
      dayKey: todayKey,
      actionsCount: actions.length,
      actions
    });
  } catch (err) {
    safeError(`Erreur bot-saloma: ${err?.message || err}`);
    return res.json(
      { ok: false, error: err?.message || 'Connexion Appwrite échouée' },
      500
    );
  }
};
