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

function resolveRealLiveBalanceAr(liveBalanceRows, walletRows, userId) {
  const lbRow = liveBalanceRows.find(r => readStr(r, ['user_id', 'userId']) === userId);
  if (lbRow) {
    const val = readNum(
      lbRow,
      ['live_balance', 'balance', 'solde', 'montant', 'capital_ar', 'compte_trade', 'solde_disponible'],
      0
    );
    return {
      source: 'LIVE_BALANCE',
      row: lbRow,
      balanceAr: Math.max(0, Math.round(val))
    };
  }
  const wRow = walletRows.find(r => readStr(r, ['user_id', 'userId']) === userId);
  if (wRow) {
    let tradeAr = 0;
    const coins = parseJsonSafe(wRow.coins_json, {}) || {};
    if (coins._trade_ar !== undefined) tradeAr = Number(coins._trade_ar) || 0;
    const disp = Number(wRow.solde_disponible) || 0;
    return {
      source: 'WALLETS',
      row: wRow,
      balanceAr: Math.max(0, Math.round(tradeAr > 0 ? tradeAr : disp))
    };
  }
  return { source: 'NONE', row: null, balanceAr: 0 };
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

    const [botSettingRows, liveBalanceRows, signalRows, walletRows] = await Promise.all([
      listAllRowsSafe(tablesDb, databaseId, tableBotSetting, [], 5),
      listAllRowsSafe(tablesDb, databaseId, tableLiveBalance, [], 5),
      listAllRowsSafe(tablesDb, databaseId, tableSignales, [], 3),
      tableWallets ? listAllRowsSafe(tablesDb, databaseId, tableWallets, [], 5) : Promise.resolve([])
    ]);

    const signals = signalRows.map(normalizeSignalRow).filter(s => s.symbol && s.price > 0);
    const signalsBySymbol = new Map(signals.map(s => [s.symbol, s]));
    const actions = [];

    for (const rawSetting of botSettingRows) {
      const setting = normalizeBotSetting(rawSetting);
      if (!setting.userId) continue;

      try {
        const balanceInfo = resolveRealLiveBalanceAr(liveBalanceRows, walletRows, setting.userId);
        const liveBalanceAr = balanceInfo.balanceAr;

        // Jamais de solde virtuel : si Live Balance <= 0, le robot reste en attente à 0 Ar
        if (liveBalanceAr <= 0) {
          if (setting.enabled) {
            await updateRowAdaptive(tablesDb, databaseId, tableBotSetting, setting.rowId, {
              enabled: false,
              status_label: 'Solde Live Balance Appwrite à 0 Ar — En attente de dépôt',
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

        // Compter les Trades du jour par Coin dans Collection TRADE
        const userTrades = await listAllRowsSafe(
          tablesDb,
          databaseId,
          tableTrades,
          [Query.equal('user_id', setting.userId), Query.orderDesc('$createdAt')],
          3
        );

        const coinCountsToday = {};
        for (const tr of userTrades) {
          if (String(tr.statut || '').toLowerCase() === 'annule') continue;
          const trDay = getDayKey(tr.date_creation || tr.$createdAt, DEFAULT_TZ_OFFSET_MINUTES);
          if (trDay !== todayKey) continue;
          const sym = String(tr.paire || '')
            .split('/')[0]
            ?.toUpperCase()
            .trim();
          if (sym) {
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

            let pnlAr = Math.round((pos.amountAr * finalPnlPct) / 100);
            if (pnlAr === 0 && finalPnlPct !== 0) pnlAr = finalPnlPct > 0 ? 1 : -1;

            const maxAllowedDayCapital = Math.floor(dayStartCapitalAr * (1 + curDailyCapPct / 100));
            if (pnlAr > 0 && liveBalanceAr + pnlAr > maxAllowedDayCapital) {
              pnlAr = Math.max(0, maxAllowedDayCapital - liveBalanceAr);
            }

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
                statut: 'termine',
                date_creation: pos.entryIso || nowIso,
                date_cloture: nowIso,
                leverage: pos.leverage || 1,
                close_price: curPrice,
                mode: 'BOT 3'
              });
            }

            // Mettre à jour Live Balance réelle dans Appwrite
            if (balanceInfo.source === 'LIVE_BALANCE' && balanceInfo.row) {
              await updateRowAdaptive(tablesDb, databaseId, tableLiveBalance, balanceInfo.row.$id, {
                live_balance: newBalanceAr,
                balance: newBalanceAr,
                solde: newBalanceAr,
                date_maj: nowIso
              });
            }

            const nextStatusLabel =
              nextSleepMode === 'SLEEP_30M'
                ? '3 pertes de suite — Dort 30 minutes'
                : nextSleepMode === 'SLEEP_MIDNIGHT'
                ? `Profit ${curDailyCapPct}% atteint — Dort jusqu’à 00:00H`
                : isWin
                ? `SELL ${pos.symbol} : +${finalPnlPct.toFixed(2)}% (+${pnlAr.toLocaleString('fr-FR')} Ar)`
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

            actions.push({ userId: setting.userId, action: 'CLOSE_TRADE', symbol: pos.symbol, pnlAr });
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

        // 2) Pas de position ouverte : scanner Signales en appliquant LIMITE 3 TRADES / COIN / JOUR
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
          // LIMITE 3 TRADES / COIN / JOUR — Si 3/3 atteint (ex: PEPE), STOP sur ce Coin et continue sur les autres
          if (usedToday >= BOT3_MAX_TRADES_PER_COIN_DAY) {
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
          await updateRowAdaptive(tablesDb, databaseId, tableBotSetting, setting.rowId, {
            avatar_mood: 'REST',
            status_label: 'LIMITE 3/3 ATTEINTE - Pause pour ce Coin (tous les Coins à 3/3 aujourd’hui)',
            last_run_at: nowIso
          });
          continue;
        }

        if (!bestCoin) {
          const watchSym = signals.find(s => (coinCountsToday[s.symbol] || 0) < BOT3_MAX_TRADES_PER_COIN_DAY)?.symbol || 'PEPE';
          await updateRowAdaptive(tablesDb, databaseId, tableBotSetting, setting.rowId, {
            avatar_mood: 'WATCHING',
            scanned_symbol: watchSym,
            status_label: 'Pas de signal 1..9 — Bot 24/7 en veille (Appwrite Cron)',
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
