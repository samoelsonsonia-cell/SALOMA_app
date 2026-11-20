import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

// ============================================================================
// ARCHITECTURE FINALE SALOMA = EXCHANGE INTERNE + HEDGE BYBIT EN ARRIÈRE-PLAN
// ============================================================================
// 1. Séparation stricte des tables :
//    - ClientTrade : enregistré dans la DB interne SALOMA (Appwrite + Ledger)
//    - HedgeTrade  : ordre réel exécuté sur BYBIT avec l'API KEY Admin uniquement
// 2. Le client ne possède jamais de compte BYBIT et ne voit jamais BYBIT.
// 3. Le solde BYBIT = Liquidité SALOMA (argent Admin).
//    Le solde Client = Portefeuille SALOMA (argent Client). Jamais mélangés.
// ============================================================================

export type ClientTradeStatus = 'OPEN' | 'CLOSED' | 'CANCELLED_REFUNDED';
export type HedgeTradeStatus = 'PENDING' | 'OPEN' | 'CLOSED' | 'FAILED';

export interface ClientTrade {
  id: string;
  clientId: string;
  pair: string; // ex: 'BTC/USDT'
  baseSymbol: string; // ex: 'BTC'
  side: 'BUY' | 'SELL';
  amountUsdt: number; // Montant investi en USDT
  cryptoQty: number; // Quantité crypto achetée/hedgée
  entryPrice: number; // Prix d'entrée SALOMA
  exitPrice: number | null; // Prix de sortie SALOMA
  salomaFeePct: number; // Défaut: 0.1%
  salomaFeeUsdt: number; // Frais SALOMA 0.1% déduits du client au BUY
  totalDebitedUsdt: number; // amountUsdt + salomaFeeUsdt
  pnlUsdt: number; // Profit ou Perte net après frais : (exit - entry) * qty - frais
  returnedUsdt: number | null; // Montant total crédité au client à la clôture
  status: ClientTradeStatus;
  hedgeTradeId: string | null;
  openedAt: string;
  closedAt: string | null;
}

export interface HedgeTrade {
  id: string;
  clientTradeId: string;
  clientId: string;
  exchange: 'BYBIT';
  pair: string; // ex: 'BTCUSDT'
  side: 'Buy' | 'Sell';
  amountUsdt: number;
  cryptoQty: number;
  bybitEntryOrderId: string | null;
  bybitExitOrderId: string | null;
  bybitEntryPrice: number;
  bybitExitPrice: number | null;
  bybitFeePct: number; // 0.1% payé par SALOMA à BYBIT
  bybitFeeUsdt: number;
  status: HedgeTradeStatus;
  error?: string;
  openedAt: string;
  closedAt: string | null;
}

interface SalomaExchangeLedgerFile {
  clientTrades: ClientTrade[];
  hedgeTrades: HedgeTrade[];
}

export interface BybitCredentials {
  apiKey: string;
  secret: string;
  source: 'vercel_env' | 'admin_saved' | 'none';
}

export interface SalomaWalletAdapter {
  getClientUsdtBalance: (clientId: string) => Promise<number>;
  debitClientUsdt: (clientId: string, amountUsdt: number) => Promise<Record<string, unknown>>;
  creditClientUsdt: (clientId: string, amountUsdt: number) => Promise<Record<string, unknown>>;
  createInternalTradeRow: (trade: ClientTrade) => Promise<string>;
  updateInternalTradeRow: (tradeId: string, patch: {
    statut: 'en_cours' | 'termine' | 'annule';
    profitAr?: number;
    closePrice?: number;
    dateCloture?: string;
    mode?: string;
  }) => Promise<void>;
  getInternalTradeRow: (tradeId: string) => Promise<Record<string, unknown> | null>;
  createClientNotification: (
    clientId: string,
    title: string,
    message: string,
    type?: 'info' | 'success' | 'warning'
  ) => Promise<unknown>;
  getSalomaPriceUsd: (baseSym: string) => number;
  getBybitSpotPriceUsd?: (baseSym: string) => number;
  getTradeFeePct: () => number;
  usdToMgaRate: number;
  onBybitLiquidityAlert?: (params: {
    side: 'BUY' | 'SELL';
    asset: string;
    pair: string;
    requiredAmount: number;
    availableAmount: number;
    reason: string;
  }) => void;
}

function stripWrappingQuotes(raw: unknown): string {
  const s = String(raw || '').trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1).trim();
  }
  return s;
}

function getLedgerFilePaths(): string[] {
  const tmpPath = path.join(os.tmpdir(), '.saloma-exchange-ledger.json');
  const cwdPath = path.resolve(process.cwd(), '.saloma-exchange-ledger.json');
  return tmpPath === cwdPath ? [tmpPath] : [tmpPath, cwdPath];
}

function loadLedger(): SalomaExchangeLedgerFile {
  for (const filePath of getLedgerFilePaths()) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const raw = fs.readFileSync(filePath, 'utf8');
      if (!raw.trim()) continue;
      const parsed = JSON.parse(raw) as Partial<SalomaExchangeLedgerFile>;
      return {
        clientTrades: Array.isArray(parsed.clientTrades) ? parsed.clientTrades : [],
        hedgeTrades: Array.isArray(parsed.hedgeTrades) ? parsed.hedgeTrades : []
      };
    } catch {
      // try next path
    }
  }
  return { clientTrades: [], hedgeTrades: [] };
}

function saveLedger(ledger: SalomaExchangeLedgerFile): void {
  const trimmed: SalomaExchangeLedgerFile = {
    clientTrades: ledger.clientTrades.slice(0, 500),
    hedgeTrades: ledger.hedgeTrades.slice(0, 500)
  };
  const serialized = JSON.stringify(trimmed, null, 2);
  for (const filePath of getLedgerFilePaths()) {
    try {
      fs.writeFileSync(filePath, serialized, { mode: 0o600 });
    } catch {
      // ignore read-only fs errors in serverless cwd
    }
  }
}

export function resolveAdminBybitCredentials(): BybitCredentials {
  const envKey = stripWrappingQuotes(process.env.BYBIT_API_KEY).trim();
  const envSecret = stripWrappingQuotes(process.env.BYBIT_API_SECRET).trim();
  if (envKey && envSecret) {
    return { apiKey: envKey, secret: envSecret, source: 'vercel_env' };
  }

  const candidates = [
    path.join(os.tmpdir(), '.saloma-apis.json'),
    path.resolve(process.cwd(), '.saloma-apis.json')
  ];
  for (const filePath of candidates) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as {
        providers?: { bybit?: { apiKey?: string; secret?: string } };
      };
      const k = stripWrappingQuotes(parsed?.providers?.bybit?.apiKey).trim();
      const s = stripWrappingQuotes(parsed?.providers?.bybit?.secret).trim();
      if (k && s) {
        return { apiKey: k, secret: s, source: 'admin_saved' };
      }
    } catch {
      // ignore fallback read errors
    }
  }
  return { apiKey: '', secret: '', source: 'none' };
}

async function fetchBybitServerTimestamp(baseUrl: string, signal: AbortSignal): Promise<string> {
  try {
    const res = await fetch(`${baseUrl}/v5/market/time`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'SalomaTradingPlatform/1.0'
      },
      signal
    });
    const text = await res.text();
    const parsed = text
      ? (JSON.parse(text) as { retCode?: number; time?: number; result?: { timeSecond?: string } })
      : null;
    if (parsed?.retCode === 0) {
      if (typeof parsed.time === 'number' && parsed.time > 0) return String(parsed.time);
      if (parsed.result?.timeSecond) return String(Number(parsed.result.timeSecond) * 1000);
    }
  } catch {
    // fallback to local clock
  }
  return Date.now().toString();
}

function formatBybitQty(val: number, decimals: number): string {
  if (!Number.isFinite(val) || val <= 0) return '0';
  return Number(val.toFixed(decimals)).toString();
}

export async function checkBybitAdminAssetBalance(assetRaw: string): Promise<{
  connected: boolean;
  available: number;
  source: BybitCredentials['source'];
  reason?: string;
}> {
  const asset = assetRaw.toUpperCase().trim();
  const creds = resolveAdminBybitCredentials();
  if (!creds.apiKey || !creds.secret) {
    return {
      connected: false,
      available: 0,
      source: 'none',
      reason: 'Clé BYBIT Admin manquante dans Vercel.'
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8500);
  try {
    const domains = ['https://api.bybit.com', 'https://api.bytick.com'];
    const recvWindow = '10000';
    let lastErr = 'Erreur lecture solde BYBIT Admin.';

    for (const baseUrl of domains) {
      const ts = await fetchBybitServerTimestamp(baseUrl, controller.signal);
      for (const accountType of ['UNIFIED', 'SPOT'] as const) {
        const qs = `accountType=${accountType}&coin=${encodeURIComponent(asset)}`;
        const sign = crypto
          .createHmac('sha256', creds.secret)
          .update(`${ts}${creds.apiKey}${recvWindow}${qs}`)
          .digest('hex');

        const r = await fetch(`${baseUrl}/v5/account/wallet-balance?${qs}`, {
          method: 'GET',
          headers: {
            'X-BAPI-API-KEY': creds.apiKey,
            'X-BAPI-SIGN': sign,
            'X-BAPI-TIMESTAMP': ts,
            'X-BAPI-RECV-WINDOW': recvWindow,
            Accept: 'application/json',
            'User-Agent': 'SalomaTradingPlatform/1.0'
          },
          signal: controller.signal
        });

        const raw = await r.text();
        type BybitBalResp = {
          retCode?: number;
          retMsg?: string;
          result?: {
            list?: Array<{
              coin?: Array<{
                coin?: string;
                availableToWithdraw?: string;
                free?: string;
                walletBalance?: string;
                equity?: string;
              }>;
            }>;
          };
        };
        let data: BybitBalResp | null = null;
        try {
          data = raw ? (JSON.parse(raw) as BybitBalResp) : null;
        } catch {
          data = null;
        }

        if (r.ok && data?.retCode === 0) {
          let avail = 0;
          for (const acc of data.result?.list || []) {
            const entry = (acc.coin || []).find(
              c => String(c.coin || '').toUpperCase() === asset
            );
            if (entry) {
              avail +=
                Number(
                  entry.availableToWithdraw || entry.free || entry.walletBalance || entry.equity || 0
                ) || 0;
            }
          }
          return { connected: true, available: Number(avail.toFixed(8)), source: creds.source };
        }
        if (data?.retMsg) {
          lastErr = `Bybit (${data.retCode ?? r.status}): ${data.retMsg}`;
        }
      }
    }

    return {
      connected: false,
      available: 0,
      source: creds.source,
      reason: lastErr
    };
  } catch (err) {
    return {
      connected: false,
      available: 0,
      source: creds.source,
      reason: err instanceof Error ? err.message : 'Erreur réseau BYBIT.'
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function placeBybitHedgeOrder(params: {
  side: 'Buy' | 'Sell';
  baseSym: string;
  amount: number; // Buy => USDT quoteCoin, Sell => crypto baseCoin
}): Promise<{
  ok: boolean;
  insufficientLiquidity: boolean;
  orderId?: string;
  reason?: string;
  availableBalance?: number;
}> {
  const baseSym = params.baseSym.toUpperCase().replace(/\/USDT$/i, '').trim();
  const symbol = `${baseSym}USDT`;
  const requiredAsset = params.side === 'Buy' ? 'USDT' : baseSym;

  const creds = resolveAdminBybitCredentials();
  if (!creds.apiKey || !creds.secret) {
    return {
      ok: false,
      insufficientLiquidity: true,
      reason: 'Clé API BYBIT Admin non configurée.'
    };
  }

  const bal = await checkBybitAdminAssetBalance(requiredAsset);
  if (!bal.connected) {
    return {
      ok: false,
      insufficientLiquidity: true,
      reason: bal.reason || 'Connexion BYBIT Admin impossible.'
    };
  }
  if (bal.available < params.amount) {
    return {
      ok: false,
      insufficientLiquidity: true,
      availableBalance: bal.available,
      reason: `Liquidité BYBIT ${requiredAsset} insuffisante (${bal.available} < ${params.amount}).`
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const domains = ['https://api.bybit.com', 'https://api.bytick.com'];
    const recvWindow = '10000';
    let lastReason = 'Erreur ordre BYBIT.';
    let lastInsufficient = false;

    for (const baseUrl of domains) {
      const ts = await fetchBybitServerTimestamp(baseUrl, controller.signal);
      const payload = {
        category: 'spot',
        symbol,
        side: params.side,
        orderType: 'Market',
        qty:
          params.side === 'Buy'
            ? formatBybitQty(params.amount, 2)
            : formatBybitQty(params.amount, 6),
        marketUnit: params.side === 'Buy' ? 'quoteCoin' : 'baseCoin'
      };
      const rawBody = JSON.stringify(payload);
      const sign = crypto
        .createHmac('sha256', creds.secret)
        .update(`${ts}${creds.apiKey}${recvWindow}${rawBody}`)
        .digest('hex');

      const r = await fetch(`${baseUrl}/v5/order/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'SalomaTradingPlatform/1.0',
          'X-BAPI-API-KEY': creds.apiKey,
          'X-BAPI-TIMESTAMP': ts,
          'X-BAPI-RECV-WINDOW': recvWindow,
          'X-BAPI-SIGN': sign
        },
        body: rawBody,
        signal: controller.signal
      });

      const rawText = await r.text();
      type BybitOrderResp = {
        retCode?: number;
        retMsg?: string;
        result?: { orderId?: string };
      };
      let data: BybitOrderResp | null = null;
      try {
        data = rawText ? (JSON.parse(rawText) as BybitOrderResp) : null;
      } catch {
        data = null;
      }

      if (r.ok && data?.retCode === 0) {
        return {
          ok: true,
          insufficientLiquidity: false,
          orderId: data.result?.orderId || `bybit-${Date.now()}`
        };
      }

      const msg = String(data?.retMsg || `HTTP ${r.status}`);
      const code = Number(data?.retCode);
      lastInsufficient =
        code === 170131 ||
        code === 110007 ||
        code === 170033 ||
        code === 170132 ||
        /insufficient|balance/i.test(msg);
      lastReason = data?.retMsg ? `Bybit (${data.retCode ?? r.status}): ${msg}` : msg;
      if (data) break;
    }

    return {
      ok: false,
      insufficientLiquidity: lastInsufficient,
      availableBalance: bal.available,
      reason: lastReason
    };
  } catch (err) {
    return {
      ok: false,
      insufficientLiquidity: false,
      reason: err instanceof Error ? err.message : 'Erreur réseau ordre BYBIT.'
    };
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================================
// 1. executeBuy(clientId, pair, amount)
//    - Vérifie solde Portefeuille SALOMA du client
//    - Déduit amount + 0.1% frais SALOMA
//    - Crée ClientTrade interne
//    - Hedge sur BYBIT en arrière-plan avec le compte Admin (HedgeTrade)
//    - Si BYBIT échoue : annule ClientTrade et rembourse le client à 100%
// ============================================================================
export async function executeBuy(
  adapter: SalomaWalletAdapter,
  clientId: string,
  pairRaw: string,
  amountUsdtRaw: number
): Promise<
  | {
      ok: true;
      clientTrade: ClientTrade;
      hedgeTrade: HedgeTrade;
      wallet: Record<string, unknown>;
    }
  | {
      ok: false;
      error: string;
      liquidityUnavailable?: boolean;
      refunded?: boolean;
    }
> {
  const baseSym = pairRaw.toUpperCase().replace(/\/USDT$/i, '').trim();
  const pair = `${baseSym}/USDT`;
  const amountUsdt = Number(Number(amountUsdtRaw).toFixed(4));

  if (!baseSym || baseSym === 'USDT' || baseSym === 'AR') {
    return { ok: false, error: 'Veuillez sélectionner une paire crypto valide (ex: BTC/USDT).' };
  }
  if (!Number.isFinite(amountUsdt) || amountUsdt < 0.1) {
    return { ok: false, error: 'Montant minimum d’achat : 0.10 USDT.' };
  }

  const entryPrice = adapter.getSalomaPriceUsd(baseSym);
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
    return { ok: false, liquidityUnavailable: true, error: 'Marché momentanément indisponible' };
  }

  const bybitEntryPrice =
    (adapter.getBybitSpotPriceUsd ? adapter.getBybitSpotPriceUsd(baseSym) : 0) || entryPrice;
  const salomaFeePct = adapter.getTradeFeePct() || 0.1;
  const salomaFeeUsdt = Number((amountUsdt * (salomaFeePct / 100)).toFixed(6));
  const totalDebitedUsdt = Number((amountUsdt + salomaFeeUsdt).toFixed(6));
  const cryptoQty = Number((amountUsdt / entryPrice).toFixed(8));

  // Étape 1 : Vérifier le solde Portefeuille SALOMA du client
  const clientUsdt = await adapter.getClientUsdtBalance(clientId);
  if (totalDebitedUsdt > clientUsdt + 1e-8) {
    return {
      ok: false,
      error: `Solde Portefeuille SALOMA insuffisant (Requis : ${totalDebitedUsdt.toFixed(4)} USDT dont Frais SALOMA ${salomaFeePct}% = ${salomaFeeUsdt.toFixed(4)} USDT).`
    };
  }

  // Étape 2 : Déduire amount + 0.1% frais SALOMA du Portefeuille SALOMA du client
  await adapter.debitClientUsdt(clientId, totalDebitedUsdt);

  const nowIso = new Date().toISOString();
  const clientTradeId = `ct-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const hedgeTradeId = `ht-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const clientTrade: ClientTrade = {
    id: clientTradeId,
    clientId,
    pair,
    baseSymbol: baseSym,
    side: 'BUY',
    amountUsdt,
    cryptoQty,
    entryPrice,
    exitPrice: null,
    salomaFeePct,
    salomaFeeUsdt,
    totalDebitedUsdt,
    pnlUsdt: 0,
    returnedUsdt: null,
    status: 'OPEN',
    hedgeTradeId,
    openedAt: nowIso,
    closedAt: null
  };

  // Étape 3 : Enregistrer ClientTrade en interne dans Appwrite DB
  let internalRowId = clientTradeId;
  try {
    internalRowId = await adapter.createInternalTradeRow(clientTrade);
    clientTrade.id = internalRowId;
  } catch (dbErr) {
    await adapter.creditClientUsdt(clientId, totalDebitedUsdt);
    return {
      ok: false,
      refunded: true,
      error: dbErr instanceof Error ? dbErr.message : 'Erreur création trade interne SALOMA.'
    };
  }

  // Étape 4 : Appeler BYBIT en arrière-plan avec le compte Admin pour hedger
  const hedgeTrade: HedgeTrade = {
    id: hedgeTradeId,
    clientTradeId: clientTrade.id,
    clientId,
    exchange: 'BYBIT',
    pair: `${baseSym}USDT`,
    side: 'Buy',
    amountUsdt,
    cryptoQty,
    bybitEntryOrderId: null,
    bybitExitOrderId: null,
    bybitEntryPrice,
    bybitExitPrice: null,
    bybitFeePct: 0.1,
    bybitFeeUsdt: Number((amountUsdt * 0.001).toFixed(6)),
    status: 'PENDING',
    openedAt: nowIso,
    closedAt: null
  };

  const bybitRes = await placeBybitHedgeOrder({
    side: 'Buy',
    baseSym,
    amount: amountUsdt
  });

  if (!bybitRes.ok) {
    // Étape 5 : Si BYBIT échoue -> annuler le trade client + rembourser 100%
    hedgeTrade.status = 'FAILED';
    hedgeTrade.error = bybitRes.reason;
    hedgeTrade.closedAt = new Date().toISOString();

    clientTrade.status = 'CANCELLED_REFUNDED';
    clientTrade.closedAt = hedgeTrade.closedAt;

    if (bybitRes.insufficientLiquidity && adapter.onBybitLiquidityAlert) {
      adapter.onBybitLiquidityAlert({
        side: 'BUY',
        asset: 'USDT',
        pair,
        requiredAmount: amountUsdt,
        availableAmount: bybitRes.availableBalance || 0,
        reason: bybitRes.reason || 'Liquidité BYBIT insuffisante'
      });
    }

    try {
      await adapter.updateInternalTradeRow(clientTrade.id, {
        statut: 'annule',
        profitAr: 0,
        closePrice: entryPrice,
        dateCloture: hedgeTrade.closedAt
      });
    } catch {
      // ignore db cleanup error
    }

    await adapter.creditClientUsdt(clientId, totalDebitedUsdt);

    const ledger = loadLedger();
    ledger.clientTrades.unshift(clientTrade);
    ledger.hedgeTrades.unshift(hedgeTrade);
    saveLedger(ledger);

    return {
      ok: false,
      liquidityUnavailable: true,
      refunded: true,
      error: 'Marché momentanément indisponible'
    };
  }

  // Hedge BYBIT réussi !
  hedgeTrade.status = 'OPEN';
  hedgeTrade.bybitEntryOrderId = bybitRes.orderId || null;

  const ledger = loadLedger();
  ledger.clientTrades.unshift(clientTrade);
  ledger.hedgeTrades.unshift(hedgeTrade);
  saveLedger(ledger);

  const updatedWallet = await adapter.creditClientUsdt(clientId, 0);

  await adapter.createClientNotification(
    clientId,
    `Achat ${baseSym}/USDT ouvert`,
    `Trade : ${amountUsdt.toFixed(2)} USDT (${cryptoQty.toFixed(6)} ${baseSym}) @ $${entryPrice} • Frais SALOMA ${salomaFeePct}% = ${salomaFeeUsdt.toFixed(4)} USDT • Total débité : ${totalDebitedUsdt.toFixed(4)} USDT`,
    'success'
  );

  return {
    ok: true,
    clientTrade,
    hedgeTrade,
    wallet: updatedWallet
  };
}

// ============================================================================
// 2. executeSell(tradeId)
//    - Calcule Profit ou Perte : (Prix Sortie - Prix Entrée) * Quantité - frais
//    - Ferme le hedge sur BYBIT (vente avec compte Admin)
//    - Crédite le Portefeuille SALOMA du client : Montant initial + Profit - Perte
// ============================================================================
export async function executeSell(
  adapter: SalomaWalletAdapter,
  tradeId: string,
  callerClientId?: string
): Promise<
  | {
      ok: true;
      clientTrade: ClientTrade;
      hedgeTrade: HedgeTrade | null;
      wallet: Record<string, unknown>;
      pnlUsdt: number;
      creditUsdt: number;
    }
  | {
      ok: false;
      error: string;
      statusCode?: number;
    }
> {
  const ledger = loadLedger();
  let clientTrade = ledger.clientTrades.find(t => t.id === tradeId);

  // Reconstruction sécurisée depuis Appwrite DB si le cache serverless a redémarré
  if (!clientTrade) {
    const dbRow = await adapter.getInternalTradeRow(tradeId);
    if (!dbRow) {
      return { ok: false, error: 'Trade introuvable.', statusCode: 404 };
    }
    const rowClientId = String(dbRow.user_id || '');
    const rowStatus = String(dbRow.statut || '');
    if (callerClientId && rowClientId !== callerClientId) {
      return { ok: false, error: 'Accès refusé à ce trade.', statusCode: 403 };
    }
    if (rowStatus !== 'en_cours') {
      return { ok: false, error: 'Ce trade est déjà clôturé.', statusCode: 400 };
    }

    const pair = String(dbRow.paire || 'BTC/USDT');
    const baseSymbol = pair.split('/')[0]?.toUpperCase().trim() || 'BTC';
    const entryPrice = Number(dbRow.prix) || 1;
    const montantAr = Number(dbRow.montant) || 0;
    const usdToMga = adapter.usdToMgaRate || 4500;
    const amountUsdt = Number((montantAr / usdToMga).toFixed(4));
    const salomaFeePct = adapter.getTradeFeePct() || 0.1;
    const salomaFeeUsdt = Number((amountUsdt * (salomaFeePct / 100)).toFixed(6));

    clientTrade = {
      id: tradeId,
      clientId: rowClientId,
      pair,
      baseSymbol,
      side: 'BUY',
      amountUsdt,
      cryptoQty: Number((amountUsdt / entryPrice).toFixed(8)),
      entryPrice,
      exitPrice: null,
      salomaFeePct,
      salomaFeeUsdt,
      totalDebitedUsdt: Number((amountUsdt + salomaFeeUsdt).toFixed(6)),
      pnlUsdt: 0,
      returnedUsdt: null,
      status: 'OPEN',
      hedgeTradeId: null,
      openedAt: String(dbRow.date_creation || new Date().toISOString()),
      closedAt: null
    };
    ledger.clientTrades.unshift(clientTrade);
  }

  if (callerClientId && clientTrade.clientId !== callerClientId) {
    return { ok: false, error: 'Accès refusé à ce trade.', statusCode: 403 };
  }
  if (clientTrade.status !== 'OPEN') {
    return { ok: false, error: 'Ce trade est déjà clôturé ou annulé.', statusCode: 400 };
  }

  const exitPrice = adapter.getSalomaPriceUsd(clientTrade.baseSymbol);
  if (!Number.isFinite(exitPrice) || exitPrice <= 0) {
    return { ok: false, error: 'Marché momentanément indisponible', statusCode: 503 };
  }

  // Calcul PnL SALOMA :
  // Profit ou Perte brut = (Prix Sortie - Prix Entrée) * Quantité
  // Montant retourné au portefeuille = Montant initial + Profit - Perte (frais déjà déduits au BUY)
  // PnL net affiché = (Prix Sortie - Prix Entrée) * Quantité - frais SALOMA
  const grossPnlUsdt = (exitPrice - clientTrade.entryPrice) * clientTrade.cryptoQty;
  const creditUsdt = Number(Math.max(0, clientTrade.amountUsdt + grossPnlUsdt).toFixed(6));
  const netPnlUsdt = Number((grossPnlUsdt - clientTrade.salomaFeeUsdt).toFixed(6));

  let hedgeTrade =
    ledger.hedgeTrades.find(
      h => h.id === clientTrade!.hedgeTradeId || h.clientTradeId === clientTrade!.id
    ) || null;

  // Fermer le hedge sur BYBIT (vente avec le compte Admin)
  const bybitCloseRes = await placeBybitHedgeOrder({
    side: 'Sell',
    baseSym: clientTrade.baseSymbol,
    amount: clientTrade.cryptoQty
  });

  if (!bybitCloseRes.ok) {
    if (bybitCloseRes.insufficientLiquidity && adapter.onBybitLiquidityAlert) {
      adapter.onBybitLiquidityAlert({
        side: 'SELL',
        asset: clientTrade.baseSymbol,
        pair: clientTrade.pair,
        requiredAmount: clientTrade.cryptoQty,
        availableAmount: bybitCloseRes.availableBalance || 0,
        reason: bybitCloseRes.reason || 'Liquidité BYBIT insuffisante pour fermer le hedge'
      });
    }
    return {
      ok: false,
      error: 'Marché momentanément indisponible pour la clôture.',
      statusCode: 503
    };
  }

  const nowIso = new Date().toISOString();
  const bybitExitPrice =
    (adapter.getBybitSpotPriceUsd ? adapter.getBybitSpotPriceUsd(clientTrade.baseSymbol) : 0) ||
    exitPrice;
  const exitBybitFeeUsdt = Number((clientTrade.cryptoQty * bybitExitPrice * 0.001).toFixed(6));

  if (hedgeTrade) {
    hedgeTrade.status = 'CLOSED';
    hedgeTrade.bybitExitOrderId = bybitCloseRes.orderId || null;
    hedgeTrade.bybitExitPrice = bybitExitPrice;
    hedgeTrade.bybitFeeUsdt = Number((hedgeTrade.bybitFeeUsdt + exitBybitFeeUsdt).toFixed(6));
    hedgeTrade.closedAt = nowIso;
  } else {
    hedgeTrade = {
      id: `ht-close-${Date.now()}`,
      clientTradeId: clientTrade.id,
      clientId: clientTrade.clientId,
      exchange: 'BYBIT',
      pair: `${clientTrade.baseSymbol}USDT`,
      side: 'Sell',
      amountUsdt: Number((clientTrade.cryptoQty * exitPrice).toFixed(4)),
      cryptoQty: clientTrade.cryptoQty,
      bybitEntryOrderId: null,
      bybitExitOrderId: bybitCloseRes.orderId || null,
      bybitEntryPrice: clientTrade.entryPrice,
      bybitExitPrice,
      bybitFeePct: 0.1,
      bybitFeeUsdt: exitBybitFeeUsdt,
      status: 'CLOSED',
      openedAt: clientTrade.openedAt,
      closedAt: nowIso
    };
    ledger.hedgeTrades.unshift(hedgeTrade);
  }

  clientTrade.exitPrice = exitPrice;
  clientTrade.pnlUsdt = netPnlUsdt;
  clientTrade.returnedUsdt = creditUsdt;
  clientTrade.status = 'CLOSED';
  clientTrade.closedAt = nowIso;

  // Créditer le Portefeuille SALOMA du client : Montant initial + Profit - Perte
  const updatedWallet = await adapter.creditClientUsdt(clientTrade.clientId, creditUsdt);

  const profitAr = Math.round(netPnlUsdt * (adapter.usdToMgaRate || 4500));
  await adapter.updateInternalTradeRow(clientTrade.id, {
    statut: 'termine',
    profitAr,
    closePrice: exitPrice,
    dateCloture: nowIso
  });

  saveLedger(ledger);

  const sign = netPnlUsdt >= 0 ? '+' : '';
  await adapter.createClientNotification(
    clientTrade.clientId,
    'Trade clôturé',
    `${clientTrade.pair} clôturé @ $${exitPrice} • Crédité : ${creditUsdt.toFixed(4)} USDT • PnL net : ${sign}${netPnlUsdt.toFixed(4)} USDT`,
    netPnlUsdt >= 0 ? 'success' : 'warning'
  );

  return {
    ok: true,
    clientTrade,
    hedgeTrade,
    wallet: updatedWallet,
    pnlUsdt: netPnlUsdt,
    creditUsdt
  };
}

// Enregistre un ordre Spot instantané dans les tables séparées ClientTrade + HedgeTrade
export function recordInstantSpotExchangePair(params: {
  clientTradeId: string;
  clientId: string;
  pair: string;
  baseSymbol: string;
  side: 'BUY' | 'SELL';
  amountUsdt: number;
  cryptoQty: number;
  clientPrice: number;
  bybitPrice: number;
  salomaFeePct: number;
  salomaFeeUsdt: number;
  bybitOrderId?: string;
}): { clientTrade: ClientTrade; hedgeTrade: HedgeTrade } {
  const nowIso = new Date().toISOString();
  const hedgeId = `ht-spot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const clientTrade: ClientTrade = {
    id: params.clientTradeId,
    clientId: params.clientId,
    pair: params.pair,
    baseSymbol: params.baseSymbol,
    side: params.side,
    amountUsdt: params.amountUsdt,
    cryptoQty: params.cryptoQty,
    entryPrice: params.clientPrice,
    exitPrice: params.clientPrice,
    salomaFeePct: params.salomaFeePct,
    salomaFeeUsdt: params.salomaFeeUsdt,
    totalDebitedUsdt:
      params.side === 'BUY'
        ? Number((params.amountUsdt + params.salomaFeeUsdt).toFixed(6))
        : params.amountUsdt,
    pnlUsdt: 0,
    returnedUsdt: params.side === 'SELL' ? Number((params.amountUsdt - params.salomaFeeUsdt).toFixed(6)) : null,
    status: 'CLOSED',
    hedgeTradeId: hedgeId,
    openedAt: nowIso,
    closedAt: nowIso
  };

  const hedgeTrade: HedgeTrade = {
    id: hedgeId,
    clientTradeId: params.clientTradeId,
    clientId: params.clientId,
    exchange: 'BYBIT',
    pair: `${params.baseSymbol.toUpperCase()}USDT`,
    side: params.side === 'BUY' ? 'Buy' : 'Sell',
    amountUsdt: params.amountUsdt,
    cryptoQty: params.cryptoQty,
    bybitEntryOrderId: params.bybitOrderId || null,
    bybitExitOrderId: params.bybitOrderId || null,
    bybitEntryPrice: params.bybitPrice || params.clientPrice,
    bybitExitPrice: params.bybitPrice || params.clientPrice,
    bybitFeePct: 0.1,
    bybitFeeUsdt: Number((params.amountUsdt * 0.001).toFixed(6)),
    status: 'CLOSED',
    openedAt: nowIso,
    closedAt: nowIso
  };

  const ledger = loadLedger();
  ledger.clientTrades.unshift(clientTrade);
  ledger.hedgeTrades.unshift(hedgeTrade);
  saveLedger(ledger);

  return { clientTrade, hedgeTrade };
}

export function isHedgeTradeRecorded(tradeId: string): boolean {
  const ledger = loadLedger();
  return ledger.clientTrades.some(t => t.id === tradeId && t.status === 'OPEN');
}

export function getSeparatedTradesSnapshot(): {
  clientTrades: ClientTrade[];
  hedgeTrades: HedgeTrade[];
  totalLedgerSalomaFeesUsdt: number;
  totalBybitFeesPaidUsdt: number;
} {
  const ledger = loadLedger();
  const totalLedgerSalomaFeesUsdt = ledger.clientTrades
    .filter(t => t.status !== 'CANCELLED_REFUNDED')
    .reduce((sum, t) => sum + (Number(t.salomaFeeUsdt) || 0), 0);
  const totalBybitFeesPaidUsdt = ledger.hedgeTrades
    .filter(h => h.status === 'OPEN' || h.status === 'CLOSED')
    .reduce((sum, h) => sum + (Number(h.bybitFeeUsdt) || 0), 0);

  return {
    clientTrades: ledger.clientTrades,
    hedgeTrades: ledger.hedgeTrades,
    totalLedgerSalomaFeesUsdt: Number(totalLedgerSalomaFeesUsdt.toFixed(6)),
    totalBybitFeesPaidUsdt: Number(totalBybitFeesPaidUsdt.toFixed(6))
  };
}
