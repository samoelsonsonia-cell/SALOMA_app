import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import http from 'http';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import WebSocket, { WebSocketServer } from 'ws';
import bcrypt from 'bcryptjs';
import {
  Client,
  Account,
  Users,
  TablesDB,
  ID,
  Query,
  Permission,
  Role
} from 'node-appwrite';
import { findCoinNetwork } from './src/services/priceAggregator';

const PORT = 3000;
const USD_TO_MGA = 4750;
const SALOMA_SPREAD_RATE = 0; // PRIX SALOMA = PRIX EXACT BYBIT / OKX / BINANCE (1:1 temps réel)
const BYBIT_HIDDEN_FEE_RATE = 0.001; // 0.1% Exchange execution fee strictly hidden from clients (analana frais en interne)
const SALOMA_TRADE_FEE_RATE = 0.001; // 0.1% on Trade
const SALOMA_EXCHANGE_FEE_RATE = 0.001; // 0.1% on Exchange (corrigé = Trade)
const SALOMA_WITHDRAW_FEE_RATE = 0.0015; // 0.15% on Withdraw seul + frais réseau
const TRADE_AR_KEY = '_trade_ar';
const APIS_CONFIG_FILE = path.resolve(process.cwd(), '.saloma-apis.json');
const TEST_TURNSTILE_SITE_KEY = '1x00000000000000000000AA';

type BrokerExchangeId = 'bybit' | 'okx' | 'binance';

interface ExchangeApiEntry {
  enabled: boolean;
  apiKey: string;
  secret: string;
  passphrase?: string;
}

interface BrokerApisStore {
  primaryApi: BrokerExchangeId;
  providers: Record<BrokerExchangeId, ExchangeApiEntry>;
}

const DEFAULT_APIS_STORE: BrokerApisStore = {
  primaryApi: 'bybit',
  providers: {
    bybit: {
      enabled: true,
      apiKey: process.env.BYBIT_API_KEY || '',
      secret: process.env.BYBIT_API_SECRET || ''
    },
    okx: {
      enabled: false,
      apiKey: process.env.OKX_API_KEY || '',
      secret: process.env.OKX_API_SECRET || '',
      passphrase: process.env.OKX_API_PASSPHRASE || ''
    },
    binance: {
      enabled: false,
      apiKey: process.env.BINANCE_API_KEY || '',
      secret: process.env.BINANCE_API_SECRET || ''
    }
  }
};

function loadApisStore(): BrokerApisStore {
  try {
    if (fs.existsSync(APIS_CONFIG_FILE)) {
      const raw = fs.readFileSync(APIS_CONFIG_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Partial<BrokerApisStore>;
      if (parsed && parsed.providers) {
        const primary: BrokerExchangeId =
          parsed.primaryApi === 'okx' || parsed.primaryApi === 'binance' || parsed.primaryApi === 'bybit'
            ? parsed.primaryApi
            : 'bybit';
        return {
          primaryApi: primary,
          providers: {
            bybit: {
              enabled: Boolean(parsed.providers.bybit?.enabled ?? true),
              apiKey: String(parsed.providers.bybit?.apiKey || ''),
              secret: String(parsed.providers.bybit?.secret || '')
            },
            okx: {
              enabled: Boolean(parsed.providers.okx?.enabled ?? false),
              apiKey: String(parsed.providers.okx?.apiKey || ''),
              secret: String(parsed.providers.okx?.secret || ''),
              passphrase: String(parsed.providers.okx?.passphrase || '')
            },
            binance: {
              enabled: Boolean(parsed.providers.binance?.enabled ?? false),
              apiKey: String(parsed.providers.binance?.apiKey || ''),
              secret: String(parsed.providers.binance?.secret || '')
            }
          }
        };
      }
    }
  } catch {
    // fallback to default
  }
  return JSON.parse(JSON.stringify(DEFAULT_APIS_STORE)) as BrokerApisStore;
}

let brokerApisStore: BrokerApisStore = loadApisStore();

function saveApisStore() {
  try {
    fs.writeFileSync(APIS_CONFIG_FILE, JSON.stringify(brokerApisStore, null, 2), { mode: 0o600 });
  } catch (err) {
    console.error('Failed to persist broker APIs config:', err);
  }
}

function maskSecretValue(val: string | undefined, length = 12): string {
  if (!val || !val.trim()) return '';
  return '*'.repeat(length);
}

function maskApiKeyPreview(val: string | undefined): string {
  const clean = (val || '').trim();
  if (!clean) return '';
  if (clean.length <= 8) return '****';
  return `${clean.slice(0, 4)}****${clean.slice(-4)}`;
}

function getMaskedApisConfig() {
  const labels: Record<BrokerExchangeId, string> = {
    bybit: 'BYBIT',
    okx: 'OKX',
    binance: 'BINANCE'
  };
  return {
    primaryApi: brokerApisStore.primaryApi,
    providers: (['bybit', 'okx', 'binance'] as const).map(id => {
      const entry = brokerApisStore.providers[id];
      return {
        id,
        label: labels[id],
        enabled: entry.enabled,
        isPrimary: brokerApisStore.primaryApi === id,
        hasApiKey: Boolean(entry.apiKey.trim()),
        apiKeyMasked: maskApiKeyPreview(entry.apiKey),
        hasSecret: Boolean(entry.secret.trim()),
        secretMasked: maskSecretValue(entry.secret, 16),
        ...(id === 'okx'
          ? {
              hasPassphrase: Boolean((entry.passphrase || '').trim()),
              passphraseMasked: maskSecretValue(entry.passphrase, 12)
            }
          : {})
      };
    })
  };
}

function getActiveExchangeUpper(): 'BYBIT' | 'OKX' | 'BINANCE' {
  if (brokerApisStore.primaryApi === 'okx') return 'OKX';
  if (brokerApisStore.primaryApi === 'binance') return 'BINANCE';
  return 'BYBIT';
}

function getEnvTurnstileSiteKey(): string {
  return (
    String(
      process.env.NEXT_PUBLIC_CLOUDFLARE_SITE_KEY ||
        process.env.VITE_CLOUDFLARE_SITE_KEY ||
        process.env.TURNSTILE_SITE_KEY ||
        ''
    ).trim() || TEST_TURNSTILE_SITE_KEY
  );
}

// Secret Key strictement sur Vercel (CLOUDFLARE_TURNSTILE_SECRET_KEY) - jamais exposé au front-end
function getEnvTurnstileSecretKey(): string {
  return String(
    process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY ||
      process.env.TURNSTILE_SECRET_KEY ||
      ''
  ).trim();
}

function getMaskedTurnstileConfig() {
  const siteKey = getEnvTurnstileSiteKey();
  const hasSecret = Boolean(getEnvTurnstileSecretKey());
  return {
    siteKey,
    hasSecretKey: hasSecret,
    secretKeyMasked: hasSecret ? '****************' : '',
    isCustomConfigured: siteKey !== TEST_TURNSTILE_SITE_KEY && hasSecret
  };
}

function getClientIp(req: Request): string | undefined {
  const fwd = req.headers['x-forwarded-for'];
  const first = Array.isArray(fwd)
    ? fwd[0]
    : typeof fwd === 'string'
    ? fwd.split(',')[0]
    : '';
  const clean = (first || req.ip || '').trim();
  if (!clean || clean === '127.0.0.1' || clean === '::1' || clean.startsWith('::ffff:127.')) {
    return undefined;
  }
  return clean;
}

async function verifyTurnstileWithCloudflare(
  token: unknown,
  remoteIp?: string
): Promise<{ success: boolean; skipped?: boolean; errorCodes?: string[] }> {
  const secret = getEnvTurnstileSecretKey();
  // Si CLOUDFLARE_TURNSTILE_SECRET_KEY n'est pas configuré dans cet environnement (ex: AI Studio),
  // ne pas bloquer l'authentification. Sur Vercel, siteverify est appelé côté serveur.
  if (!secret) {
    return { success: true, skipped: true };
  }

  const cleanToken = typeof token === 'string' ? token.trim() : '';
  if (!cleanToken) return { success: false, errorCodes: ['missing-input-response'] };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const form = new URLSearchParams();
    form.set('secret', secret);
    form.set('response', cleanToken);
    if (remoteIp && !remoteIp.includes('127.0.0.1') && !remoteIp.includes('::1')) {
      form.set('remoteip', remoteIp);
    }

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal: controller.signal
    });
    if (!res.ok) return { success: false, errorCodes: [`http-${res.status}`] };
    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
    return {
      success: Boolean(data?.success),
      errorCodes: Array.isArray(data?.['error-codes']) ? data['error-codes'] : undefined
    };
  } catch {
    return { success: false, errorCodes: ['network-error'] };
  } finally {
    clearTimeout(timer);
  }
}

function createTurnstileProof(token: string): string {
  const secret = getEnvTurnstileSecretKey();
  if (!secret) return '';
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const exp = Date.now() + 5 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ h: tokenHash, exp }), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyTurnstileProof(proof: unknown, token: unknown): boolean {
  const secret = getEnvTurnstileSecretKey();
  if (!secret) return true;
  if (typeof proof !== 'string' || typeof token !== 'string') return false;
  const cleanProof = proof.trim();
  const cleanToken = token.trim();
  if (!cleanProof || !cleanToken || !cleanProof.includes('.')) return false;
  const [payload, sig] = cleanProof.split('.');
  if (!payload || !sig) return false;
  const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      h?: string;
      exp?: number;
    };
    if (!decoded?.h || !decoded?.exp || Date.now() > decoded.exp) return false;
    const tokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex');
    return decoded.h === tokenHash;
  } catch {
    return false;
  }
}

async function validateTurnstileSubmission(req: Request): Promise<boolean> {
  try {
    const secret = getEnvTurnstileSecretKey();
    if (!secret) {
      return true;
    }
    const token = String(req.body?.turnstileToken ?? req.body?.token ?? '').trim();
    const proof = req.body?.turnstileProof ?? req.body?.verifiedProof;
    if (!token && process.env.VERCEL !== '1') {
      return true;
    }
    if (proof && verifyTurnstileProof(proof, token)) {
      return true;
    }
    const result = await verifyTurnstileWithCloudflare(token, getClientIp(req));
    if (result.skipped) return true;
    if (
      result.errorCodes?.some(
        c => c === 'network-error' || c.startsWith('http-5')
      )
    ) {
      return true;
    }
    return result.success;
  } catch {
    return true;
  }
}

const CRYPTO_NETWORK_FEES: Record<string, { chain: string; fee: number; minDeposit: number; minWithdraw: number; depositAddress: string }> = {
  USDT: {
    chain: 'TRC20',
    fee: 1.2,
    minDeposit: 5,
    minWithdraw: 5,
    depositAddress: 'TJX9zK2B7YmNQ9sLo2481A2026SalomaTRC'
  },
  BTC: {
    chain: 'Bitcoin',
    fee: 0.00025,
    minDeposit: 0.0002,
    minWithdraw: 0.0005,
    depositAddress: 'bc1q9h6x743j2y0z5v4km89x2026saloma'
  },
  ETH: {
    chain: 'ERC20',
    fee: 0.0035,
    minDeposit: 0.005,
    minWithdraw: 0.01,
    depositAddress: '0x992B28B3eB9229555C09F6eF83A8992026'
  }
};

interface BackendCoinPrice {
  symbol: string;
  name: string;
  bybitPrice: number;
  salomaPrice: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24hUsd: number;
}

const MARKET_DEFAULTS: Array<{ symbol: string; name: string; basePrice: number; change24h: number; volume24hUsd: number }> = [
  { symbol: 'BTC', name: 'Bitcoin', basePrice: 68420, change24h: 3.42, volume24hUsd: 2480000000 },
  { symbol: 'ETH', name: 'Ethereum', basePrice: 3580, change24h: 2.15, volume24hUsd: 1320000000 },
  { symbol: 'USDT', name: 'Tether USD', basePrice: 1, change24h: 0.01, volume24hUsd: 5400000000 },
  { symbol: 'SOL', name: 'Solana', basePrice: 184.5, change24h: 5.84, volume24hUsd: 690000000 },
  { symbol: 'BNB', name: 'BNB Chain', basePrice: 598, change24h: -1.12, volume24hUsd: 420000000 },
  { symbol: 'SALOMA', name: 'Saloma Native Coin', basePrice: 1.25, change24h: 14.8, volume24hUsd: 84000000 },
  { symbol: 'XRP', name: 'Ripple', basePrice: 0.62, change24h: 4.2, volume24hUsd: 540000000 },
  { symbol: 'DOGE', name: 'Dogecoin', basePrice: 0.165, change24h: -2.4, volume24hUsd: 390000000 },
  { symbol: 'ADA', name: 'Cardano', basePrice: 0.495, change24h: 1.85, volume24hUsd: 210000000 },
  { symbol: 'TON', name: 'Toncoin', basePrice: 5.85, change24h: 7.2, volume24hUsd: 185000000 },
  { symbol: 'AVAX', name: 'Avalanche', basePrice: 34.2, change24h: 3.1, volume24hUsd: 260000000 },
  { symbol: 'SUI', name: 'Sui Network', basePrice: 2.15, change24h: 9.4, volume24hUsd: 310000000 },
  { symbol: 'PEPE', name: 'Pepe Coin', basePrice: 0.0000098, change24h: 16.5, volume24hUsd: 480000000 },
  { symbol: 'LTC', name: 'Litecoin', basePrice: 86.4, change24h: 1.45, volume24hUsd: 175000000 },
  { symbol: 'TRX', name: 'TRON', basePrice: 0.162, change24h: 2.8, volume24hUsd: 290000000 },
  { symbol: 'LINK', name: 'Chainlink', basePrice: 17.8, change24h: 4.1, volume24hUsd: 225000000 },
  { symbol: 'DOT', name: 'Polkadot', basePrice: 6.45, change24h: 2.3, volume24hUsd: 142000000 },
  { symbol: 'BCH', name: 'Bitcoin Cash', basePrice: 412, change24h: 1.9, volume24hUsd: 195000000 },
  { symbol: 'SHIB', name: 'Shiba Inu', basePrice: 0.0000185, change24h: 8.2, volume24hUsd: 340000000 },
  { symbol: 'NEAR', name: 'NEAR Protocol', basePrice: 5.6, change24h: 6.1, volume24hUsd: 215000000 },
  { symbol: 'UNI', name: 'Uniswap', basePrice: 9.8, change24h: 3.5, volume24hUsd: 160000000 },
  { symbol: 'APT', name: 'Aptos', basePrice: 8.9, change24h: 4.4, volume24hUsd: 175000000 },
  { symbol: 'ARB', name: 'Arbitrum', basePrice: 0.78, change24h: 2.9, volume24hUsd: 190000000 },
  { symbol: 'OP', name: 'Optimism', basePrice: 1.92, change24h: 3.1, volume24hUsd: 145000000 },
  { symbol: 'ATOM', name: 'Cosmos', basePrice: 6.85, change24h: 1.4, volume24hUsd: 112000000 },
  { symbol: 'ICP', name: 'Internet Computer', basePrice: 9.45, change24h: -0.9, volume24hUsd: 98000000 },
  { symbol: 'FIL', name: 'Filecoin', basePrice: 4.65, change24h: 2.2, volume24hUsd: 118000000 },
  { symbol: 'HBAR', name: 'Hedera', basePrice: 0.142, change24h: 5.1, volume24hUsd: 134000000 },
  { symbol: 'XLM', name: 'Stellar', basePrice: 0.235, change24h: 3.8, volume24hUsd: 158000000 },
  { symbol: 'VET', name: 'VeChain', basePrice: 0.036, change24h: 2.7, volume24hUsd: 64000000 },
  { symbol: 'ALGO', name: 'Algorand', basePrice: 0.245, change24h: 4.1, volume24hUsd: 78000000 },
  { symbol: 'INJ', name: 'Injective', basePrice: 21.4, change24h: 7.4, volume24hUsd: 142000000 },
  { symbol: 'SEI', name: 'Sei Network', basePrice: 0.445, change24h: 6.2, volume24hUsd: 126000000 },
  { symbol: 'TIA', name: 'Celestia', basePrice: 5.95, change24h: 4.9, volume24hUsd: 115000000 },
  { symbol: 'RENDER', name: 'Render Token', basePrice: 6.75, change24h: 8.6, volume24hUsd: 168000000 },
  { symbol: 'FET', name: 'Artificial Superintelligence', basePrice: 1.38, change24h: 7.1, volume24hUsd: 152000000 },
  { symbol: 'JUP', name: 'Jupiter', basePrice: 1.05, change24h: 5.3, volume24hUsd: 132000000 },
  { symbol: 'WIF', name: 'dogwifhat', basePrice: 2.48, change24h: 11.2, volume24hUsd: 295000000 },
  { symbol: 'BONK', name: 'Bonk', basePrice: 0.0000285, change24h: 9.8, volume24hUsd: 240000000 },
  { symbol: 'FLOKI', name: 'Floki', basePrice: 0.000168, change24h: 6.9, volume24hUsd: 185000000 },
  { symbol: 'AAVE', name: 'Aave', basePrice: 168.5, change24h: 4.6, volume24hUsd: 148000000 },
  { symbol: 'MKR', name: 'Maker', basePrice: 1620, change24h: 2.1, volume24hUsd: 89000000 },
  { symbol: 'LDO', name: 'Lido DAO', basePrice: 1.54, change24h: 3.3, volume24hUsd: 74000000 },
  { symbol: 'GRT', name: 'The Graph', basePrice: 0.215, change24h: 4.5, volume24hUsd: 68000000 },
  { symbol: 'IMX', name: 'Immutable', basePrice: 1.48, change24h: 2.6, volume24hUsd: 62000000 },
  { symbol: 'STX', name: 'Stacks', basePrice: 1.94, change24h: 5.4, volume24hUsd: 96000000 },
  { symbol: 'RUNE', name: 'THORChain', basePrice: 4.85, change24h: 3.9, volume24hUsd: 88000000 },
  { symbol: 'ETC', name: 'Ethereum Classic', basePrice: 24.8, change24h: 1.2, volume24hUsd: 105000000 },
  { symbol: 'POL', name: 'Polygon Ecosystem', basePrice: 0.44, change24h: 2.4, volume24hUsd: 116000000 },
  { symbol: 'ONDO', name: 'Ondo Finance', basePrice: 1.18, change24h: 8.9, volume24hUsd: 144000000 }
];

function roundByRef(val: number, reference: number): number {
  if (reference < 0.0001) return Number(val.toFixed(8));
  if (reference < 0.001) return Number(val.toFixed(7));
  if (reference < 1) return Number(val.toFixed(4));
  return Number(val.toFixed(2));
}

function computeSalomaPrice(symbol: string, bybitPrice: number): number {
  if (symbol === 'USDT') return 1.0;
  return roundByRef(bybitPrice * (1 - SALOMA_SPREAD_RATE), bybitPrice);
}

let marketCache: { updatedAt: number; bybitOnline: boolean; latencyMs: number; coins: Record<string, BackendCoinPrice> } = {
  updatedAt: 0,
  bybitOnline: false,
  latencyMs: 0,
  coins: Object.fromEntries(
    MARKET_DEFAULTS.map(d => [
      d.symbol,
      {
        symbol: d.symbol,
        name: d.name,
        bybitPrice: d.basePrice,
        salomaPrice: computeSalomaPrice(d.symbol, d.basePrice),
        change24h: d.change24h,
        high24h: roundByRef(d.basePrice * 1.025, d.basePrice),
        low24h: roundByRef(d.basePrice * 0.975, d.basePrice),
        volume24hUsd: d.volume24hUsd
      }
    ])
  )
};

let refreshMarketPromise: Promise<void> | null = null;
const wsStatus: Record<BrokerExchangeId, boolean> = { bybit: false, okx: false, binance: false };
let wssPrices: WebSocketServer | null = null;

function isAnyExchangeWsOnline(): boolean {
  return wsStatus.bybit || wsStatus.okx || wsStatus.binance;
}

function buildPublicCoin(c: BackendCoinPrice) {
  return {
    symbol: c.symbol,
    name: c.name,
    price: c.salomaPrice,
    change24h: c.change24h,
    high24h: c.high24h,
    low24h: c.low24h,
    volume24hUsd: c.volume24hUsd
  };
}

function buildSnapshotPayload() {
  return {
    type: 'snapshot',
    activeExchange: getActiveExchangeUpper(),
    wsOnline: isAnyExchangeWsOnline() || marketCache.bybitOnline,
    coins: Object.values(marketCache.coins).map(buildPublicCoin),
    updatedAt: marketCache.updatedAt || Date.now()
  };
}

function broadcastWs(payload: unknown) {
  if (!wssPrices || wssPrices.clients.size === 0) return;
  const serialized = JSON.stringify(payload);
  for (const client of wssPrices.clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(serialized);
      } catch {
        // ignore closed socket race
      }
    }
  }
}

function applyExternalTickerUpdate(
  source: BrokerExchangeId,
  rawSym: string,
  tick: { last: number; pct24h?: number; high24h?: number; low24h?: number; volUsd?: number }
) {
  const sym = rawSym.toUpperCase().trim();
  if (sym === 'USDT' || sym === 'SALOMA') return;
  const cur = marketCache.coins[sym];
  if (!cur) return;
  if (!Number.isFinite(tick.last) || tick.last <= 0) return;

  // Prefer active primary exchange WebSocket; fall back if primary is offline
  if (source !== brokerApisStore.primaryApi && wsStatus[brokerApisStore.primaryApi]) {
    return;
  }

  const exactPrice = roundByRef(tick.last, tick.last);
  const nextSalomaPrice = computeSalomaPrice(sym, tick.last);
  const nextChange =
    typeof tick.pct24h === 'number' && Number.isFinite(tick.pct24h)
      ? Number(tick.pct24h.toFixed(2))
      : cur.change24h;
  const nextHigh =
    typeof tick.high24h === 'number' && tick.high24h > 0
      ? computeSalomaPrice(sym, tick.high24h)
      : cur.high24h;
  const nextLow =
    typeof tick.low24h === 'number' && tick.low24h > 0
      ? computeSalomaPrice(sym, tick.low24h)
      : cur.low24h;
  const nextVol =
    typeof tick.volUsd === 'number' && tick.volUsd > 0 ? tick.volUsd : cur.volume24hUsd;

  const changed =
    cur.salomaPrice !== nextSalomaPrice ||
    cur.change24h !== nextChange ||
    cur.volume24hUsd !== nextVol;

  const updated: BackendCoinPrice = {
    ...cur,
    bybitPrice: exactPrice,
    salomaPrice: nextSalomaPrice,
    change24h: nextChange,
    high24h: nextHigh,
    low24h: nextLow,
    volume24hUsd: nextVol
  };

  marketCache.coins[sym] = updated;
  marketCache.bybitOnline = true;
  marketCache.updatedAt = Date.now();

  if (changed) {
    broadcastWs({
      type: 'tick',
      activeExchange: getActiveExchangeUpper(),
      wsOnline: true,
      coin: buildPublicCoin(updated),
      updatedAt: marketCache.updatedAt
    });
  }
}

let wsStarted = false;
function startExchangeWebSockets() {
  if (wsStarted) return;
  wsStarted = true;

  const streamSymbols = MARKET_DEFAULTS.map(c => c.symbol).filter(
    s => s !== 'USDT' && s !== 'SALOMA'
  );

  // 1) BYBIT V5 SPOT WEBSOCKET
  const connectBybit = () => {
    let pingTimer: NodeJS.Timeout | null = null;
    try {
      const ws = new WebSocket('wss://stream.bybit.com/v5/public/spot');
      ws.on('open', () => {
        wsStatus.bybit = true;
        for (let i = 0; i < streamSymbols.length; i += 10) {
          const args = streamSymbols.slice(i, i + 10).map(s => `tickers.${s}USDT`);
          ws.send(JSON.stringify({ op: 'subscribe', args }));
        }
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ op: 'ping' }));
          }
        }, 20000);
      });
      ws.on('message', data => {
        try {
          const msg = JSON.parse(data.toString()) as {
            topic?: string;
            data?: {
              symbol?: string;
              lastPrice?: string;
              price24hPcnt?: string;
              highPrice24h?: string;
              lowPrice24h?: string;
              turnover24h?: string;
            };
          };
          if (msg.topic?.startsWith('tickers.') && msg.data) {
            const sym = (msg.data.symbol || msg.topic.replace('tickers.', '')).replace(/USDT$/i, '');
            const last = parseFloat(msg.data.lastPrice || '');
            if (!Number.isNaN(last) && last > 0) {
              applyExternalTickerUpdate('bybit', sym, {
                last,
                pct24h: msg.data.price24hPcnt ? parseFloat(msg.data.price24hPcnt) * 100 : undefined,
                high24h: msg.data.highPrice24h ? parseFloat(msg.data.highPrice24h) : undefined,
                low24h: msg.data.lowPrice24h ? parseFloat(msg.data.lowPrice24h) : undefined,
                volUsd: msg.data.turnover24h ? parseFloat(msg.data.turnover24h) : undefined
              });
            }
          }
        } catch {
          // ignore malformed frame
        }
      });
      const cleanup = () => {
        wsStatus.bybit = false;
        if (pingTimer) clearInterval(pingTimer);
        setTimeout(connectBybit, 2500);
      };
      ws.on('close', cleanup);
      ws.on('error', () => {
        try {
          ws.terminate();
        } catch {
          // ignore
        }
      });
    } catch {
      wsStatus.bybit = false;
      setTimeout(connectBybit, 4000);
    }
  };

  // 2) OKX V5 PUBLIC WEBSOCKET
  const connectOkx = () => {
    let pingTimer: NodeJS.Timeout | null = null;
    try {
      const ws = new WebSocket('wss://ws.okx.com:8443/ws/v5/public');
      ws.on('open', () => {
        wsStatus.okx = true;
        for (let i = 0; i < streamSymbols.length; i += 20) {
          const args = streamSymbols.slice(i, i + 20).map(s => ({ channel: 'tickers', instId: `${s}-USDT` }));
          ws.send(JSON.stringify({ op: 'subscribe', args }));
        }
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, 20000);
      });
      ws.on('message', data => {
        const raw = data.toString();
        if (raw === 'pong') return;
        try {
          const msg = JSON.parse(raw) as {
            arg?: { channel?: string };
            data?: Array<{
              instId?: string;
              last?: string;
              open24h?: string;
              high24h?: string;
              low24h?: string;
              volCcy24h?: string;
            }>;
          };
          if (msg.arg?.channel === 'tickers' && Array.isArray(msg.data)) {
            for (const row of msg.data) {
              if (!row.instId || !row.instId.endsWith('-USDT')) continue;
              const sym = row.instId.replace('-USDT', '');
              const last = parseFloat(row.last || '');
              const open = parseFloat(row.open24h || '');
              if (!Number.isNaN(last) && last > 0) {
                applyExternalTickerUpdate('okx', sym, {
                  last,
                  pct24h: !Number.isNaN(open) && open > 0 ? ((last - open) / open) * 100 : undefined,
                  high24h: row.high24h ? parseFloat(row.high24h) : undefined,
                  low24h: row.low24h ? parseFloat(row.low24h) : undefined,
                  volUsd: row.volCcy24h ? parseFloat(row.volCcy24h) : undefined
                });
              }
            }
          }
        } catch {
          // ignore malformed frame
        }
      });
      const cleanup = () => {
        wsStatus.okx = false;
        if (pingTimer) clearInterval(pingTimer);
        setTimeout(connectOkx, 3000);
      };
      ws.on('close', cleanup);
      ws.on('error', () => {
        try {
          ws.terminate();
        } catch {
          // ignore
        }
      });
    } catch {
      wsStatus.okx = false;
      setTimeout(connectOkx, 5000);
    }
  };

  // 3) BINANCE SPOT ALL MINI-TICKERS WEBSOCKET
  const connectBinance = () => {
    try {
      const ws = new WebSocket('wss://stream.binance.com:9443/ws/!miniTicker@arr');
      ws.on('open', () => {
        wsStatus.binance = true;
      });
      ws.on('message', data => {
        try {
          const list = JSON.parse(data.toString()) as Array<{
            s?: string;
            c?: string;
            o?: string;
            h?: string;
            l?: string;
            q?: string;
          }>;
          if (!Array.isArray(list)) return;
          for (const row of list) {
            if (!row.s || !row.s.endsWith('USDT')) continue;
            const sym = row.s.replace(/USDT$/i, '');
            if (!marketCache.coins[sym]) continue;
            const last = parseFloat(row.c || '');
            const open = parseFloat(row.o || '');
            if (!Number.isNaN(last) && last > 0) {
              applyExternalTickerUpdate('binance', sym, {
                last,
                pct24h: !Number.isNaN(open) && open > 0 ? ((last - open) / open) * 100 : undefined,
                high24h: row.h ? parseFloat(row.h) : undefined,
                low24h: row.l ? parseFloat(row.l) : undefined,
                volUsd: row.q ? parseFloat(row.q) : undefined
              });
            }
          }
        } catch {
          // ignore malformed frame
        }
      });
      const cleanup = () => {
        wsStatus.binance = false;
        setTimeout(connectBinance, 3000);
      };
      ws.on('close', cleanup);
      ws.on('error', () => {
        try {
          ws.terminate();
        } catch {
          // ignore
        }
      });
    } catch {
      wsStatus.binance = false;
      setTimeout(connectBinance, 5000);
    }
  };

  connectBybit();
  connectOkx();
  connectBinance();
}

async function fetchSpotTickersFromProvider(
  provider: BrokerExchangeId,
  signal: AbortSignal
): Promise<Map<string, { last: number; pct24h: number; high24h: number; low24h: number; volUsd: number }>> {
  const out = new Map<string, { last: number; pct24h: number; high24h: number; low24h: number; volUsd: number }>();

  if (provider === 'bybit') {
    const res = await fetch('https://api.bybit.com/v5/market/tickers?category=spot', { signal });
    if (!res.ok) throw new Error(`Bybit HTTP ${res.status}`);
    const json = (await res.json()) as {
      result?: {
        list?: Array<{
          symbol?: string;
          lastPrice?: string;
          price24hPcnt?: string;
          highPrice24h?: string;
          lowPrice24h?: string;
          turnover24h?: string;
        }>;
      };
    };
    for (const row of json?.result?.list || []) {
      if (typeof row.symbol === 'string' && row.symbol.endsWith('USDT')) {
        const last = parseFloat(row.lastPrice || '');
        if (!Number.isNaN(last) && last > 0) {
          out.set(row.symbol.replace('USDT', ''), {
            last,
            pct24h: (parseFloat(row.price24hPcnt || '') || 0) * 100,
            high24h: parseFloat(row.highPrice24h || '') || 0,
            low24h: parseFloat(row.lowPrice24h || '') || 0,
            volUsd: parseFloat(row.turnover24h || '') || 0
          });
        }
      }
    }
    return out;
  }

  if (provider === 'okx') {
    const res = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SPOT', { signal });
    if (!res.ok) throw new Error(`OKX HTTP ${res.status}`);
    const json = (await res.json()) as {
      data?: Array<{
        instId?: string;
        last?: string;
        open24h?: string;
        high24h?: string;
        low24h?: string;
        volCcy24h?: string;
      }>;
    };
    for (const row of json?.data || []) {
      if (typeof row.instId === 'string' && row.instId.endsWith('-USDT')) {
        const last = parseFloat(row.last || '');
        const open = parseFloat(row.open24h || '');
        if (!Number.isNaN(last) && last > 0) {
          const pct24h = !Number.isNaN(open) && open > 0 ? ((last - open) / open) * 100 : 0;
          out.set(row.instId.replace('-USDT', ''), {
            last,
            pct24h,
            high24h: parseFloat(row.high24h || '') || 0,
            low24h: parseFloat(row.low24h || '') || 0,
            volUsd: parseFloat(row.volCcy24h || '') || 0
          });
        }
      }
    }
    return out;
  }

  // binance
  const res = await fetch('https://api.binance.com/api/v3/ticker/24hr', { signal });
  if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
  const list = (await res.json()) as Array<{
    symbol?: string;
    lastPrice?: string;
    priceChangePercent?: string;
    highPrice?: string;
    lowPrice?: string;
    quoteVolume?: string;
  }>;
  if (Array.isArray(list)) {
    for (const row of list) {
      if (typeof row.symbol === 'string' && row.symbol.endsWith('USDT')) {
        const last = parseFloat(row.lastPrice || '');
        if (!Number.isNaN(last) && last > 0) {
          out.set(row.symbol.replace('USDT', ''), {
            last,
            pct24h: parseFloat(row.priceChangePercent || '') || 0,
            high24h: parseFloat(row.highPrice || '') || 0,
            low24h: parseFloat(row.lowPrice || '') || 0,
            volUsd: parseFloat(row.quoteVolume || '') || 0
          });
        }
      }
    }
  }
  return out;
}

async function refreshMarketPrices(force = false): Promise<void> {
  const now = Date.now();
  if (!force && isAnyExchangeWsOnline() && now - marketCache.updatedAt < 5000 && marketCache.updatedAt > 0) {
    return;
  }
  if (!force && now - marketCache.updatedAt < 4000) return;
  if (refreshMarketPromise) return refreshMarketPromise;

  refreshMarketPromise = (async () => {
    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    try {
      const order: BrokerExchangeId[] = [
        brokerApisStore.primaryApi,
        ...(['bybit', 'okx', 'binance'] as const).filter(
          id => id !== brokerApisStore.primaryApi && brokerApisStore.providers[id].enabled
        ),
        ...(['bybit', 'okx', 'binance'] as const).filter(
          id => id !== brokerApisStore.primaryApi && !brokerApisStore.providers[id].enabled
        )
      ];

      let tickerMap: Map<string, { last: number; pct24h: number; high24h: number; low24h: number; volUsd: number }> | null = null;
      for (const prov of order) {
        try {
          const map = await fetchSpotTickersFromProvider(prov, controller.signal);
          if (map.size > 0) {
            tickerMap = map;
            break;
          }
        } catch {
          // try next provider
        }
      }

      const latencyMs = Date.now() - start;
      if (tickerMap && tickerMap.size > 0) {
        let updatedCount = 0;
        for (const sym of Object.keys(marketCache.coins)) {
          if (sym === 'USDT' || sym === 'SALOMA') continue;
          const row = tickerMap.get(sym);
          if (!row) continue;
          updatedCount++;
          const salomaPrice = computeSalomaPrice(sym, row.last);
          const cur = marketCache.coins[sym];
          marketCache.coins[sym] = {
            ...cur,
            bybitPrice: roundByRef(row.last, row.last),
            salomaPrice,
            change24h: Number(row.pct24h.toFixed(2)),
            high24h: row.high24h > 0 ? computeSalomaPrice(sym, row.high24h) : cur.high24h,
            low24h: row.low24h > 0 ? computeSalomaPrice(sym, row.low24h) : cur.low24h,
            volume24hUsd: row.volUsd > 0 ? row.volUsd : cur.volume24hUsd
          };
        }
        marketCache.bybitOnline = updatedCount > 0;
        marketCache.latencyMs = latencyMs;
        marketCache.updatedAt = Date.now();
        broadcastWs(buildSnapshotPayload());
        return;
      }
      marketCache.bybitOnline = isAnyExchangeWsOnline();
      marketCache.updatedAt = Date.now();
    } catch {
      marketCache.bybitOnline = isAnyExchangeWsOnline();
      marketCache.updatedAt = Date.now();
    } finally {
      clearTimeout(timer);
      refreshMarketPromise = null;
    }
  })();

  return refreshMarketPromise;
}

function getSalomaPriceUsd(symbol: string): number {
  const clean = symbol.toUpperCase().trim();
  if (clean === 'AR') return 1 / USD_TO_MGA;
  return marketCache.coins[clean]?.salomaPrice || (clean === 'USDT' ? 1 : 0);
}

const rawAppwriteEndpoint = String(
  process.env.APPWRITE_ENDPOINT ||
    process.env.VITE_APPWRITE_ENDPOINT ||
    'https://fra.cloud.appwrite.io/v1'
).trim();
const APPWRITE_ENDPOINT = /^https?:\/\//i.test(rawAppwriteEndpoint)
  ? rawAppwriteEndpoint
  : 'https://fra.cloud.appwrite.io/v1';
const APPWRITE_PROJECT_ID =
  String(
    process.env.APPWRITE_PROJECT_ID ||
      process.env.VITE_APPWRITE_PROJECT_ID ||
      ''
  ).trim() || '6af771140031749ce67c';
const APPWRITE_DATABASE_ID =
  String(
    process.env.APPWRITE_DATABASE_ID ||
      process.env.VITE_APPWRITE_DATABASE_ID ||
      ''
  ).trim() || '6af7739d00073c4937e6';
const APPWRITE_API_KEY =
  String(process.env.APPWRITE_API_KEY || '').trim() ||
  'standard_4b7d5e4b36246ad4f84a637332f944489386e9a18ad06f6ddf98929fae5febb0cf5d006c3273f6bd1f0f95a2b59ce809ada6a0934e4d12581db5447765fce2235335fa14013c334170fd9224ac8892f743c04e2a99807118a8813d04b6864c86600f4f9078ee6406fcfb47d69b6bfe7869956258676fd27025915df25c93b24a';

const TABLES = {
  USERS: '6af775ca00094b2bdf7f',
  WALLETS: '6af8b5410037ae1f4383',
  TRADES: '6af8b579001cf762cd47',
  ECHANGES: '6af8b6a90010c3630fc8',
  DEPOTS_RETRAITS: '6af8b6fe0035f3f76254',
  EARN: '6af8b756002ac6e26186',
  NOTIFICATIONS: 'notifications',
  PROBLEMES: 'problemes'
};

const ADMIN_EMAIL =
  String(process.env.ADMIN_EMAIL || 'samoelsonsonia@gmail.com')
    .trim()
    .toLowerCase() || 'samoelsonsonia@gmail.com';
const envAdminPin = String(process.env.ADMIN_PIN || '').trim();
let currentAdminPin = /^\d{9}$/.test(envAdminPin) ? envAdminPin : '888888888';

function getAdminClient() {
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID);
  if (APPWRITE_API_KEY) {
    client.setKey(APPWRITE_API_KEY);
  }
  return client;
}

function getAnonClient() {
  return new Client().setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT_ID);
}

function getUserSessionClient(sessionSecret: string) {
  return new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setSession(sessionSecret);
}

const adminClient = getAdminClient();
const adminUsers = new Users(adminClient);
const adminDb = new TablesDB(adminClient);

function formatAppwriteErrorFr(err: unknown, fallback = 'Erreur serveur Appwrite.'): string {
  const e = err as { code?: number; type?: string; message?: string };
  const msg = (e?.message || '').toLowerCase();
  const type = e?.type || '';
  if (type === 'user_already_exists' || msg.includes('already exists')) {
    return 'Un compte existe déjà avec cette adresse e-mail.';
  }
  if (type === 'user_invalid_credentials' || msg.includes('invalid credentials')) {
    return 'Email ou mot de passe incorrect.';
  }
  if (type === 'user_invalid_token' || msg.includes('invalid token') || msg.includes('expired')) {
    return 'Code incorrect ou expiré.';
  }
  if (type === 'user_blocked') {
    return 'Ce compte est bloqué.';
  }
  if (e?.code === 429 || type === 'general_rate_limit_exceeded') {
    return 'Trop de tentatives. Veuillez patienter quelques instants.';
  }
  if (msg.includes('password') && msg.includes('8')) {
    return 'Le mot de passe doit contenir au moins 8 caractères.';
  }
  return e?.message || fallback;
}

function sanitizeUserRow(row: Record<string, unknown>) {
  const copy = { ...row };
  delete copy.mot_de_passe;
  return copy;
}

function parseCoinsJsonRaw(raw: unknown): Record<string, number> {
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(parsed)) {
        const num = Number(v);
        if (!Number.isNaN(num) && num >= 0) out[k] = num;
      }
      return out;
    }
  } catch {
    // ignore invalid json
  }
  return {};
}

function parseCoinsJson(raw: unknown): Record<string, number> {
  const all = parseCoinsJsonRaw(raw);
  delete all[TRADE_AR_KEY];
  return all;
}

function getCompteTradeArFromWallet(wallet: Record<string, unknown>): number {
  const raw = parseCoinsJsonRaw(wallet.coins_json);
  return Math.max(0, Number(raw[TRADE_AR_KEY]) || 0);
}

function encodeCoinsWithTradeAr(coins: Record<string, number>, compteTradeAr: number): string {
  const next: Record<string, number> = { ...coins };
  delete next[TRADE_AR_KEY];
  next[TRADE_AR_KEY] = Math.max(0, Number(compteTradeAr.toFixed(2)));
  return JSON.stringify(next);
}

function serializeWallet(wallet: Record<string, unknown>) {
  const compteTrade = getCompteTradeArFromWallet(wallet);
  const soldeDisp = Math.max(0, Number(wallet.solde_disponible) || 0);
  const soldeBloque = Math.max(0, Number(wallet.solde_bloque) || 0);
  const cleanCoins = parseCoinsJson(wallet.coins_json);
  return {
    ...wallet,
    solde_disponible: soldeDisp,
    solde_bloque: soldeBloque,
    compte_trade: compteTrade,
    solde_wallet: soldeDisp,
    solde_total: Number((soldeDisp + compteTrade + soldeBloque).toFixed(2)),
    coins_json: JSON.stringify(cleanCoins)
  };
}

const notificationEmitter = new EventEmitter();
notificationEmitter.setMaxListeners(1000);

async function createNotification(
  userId: string,
  titre: string,
  message: string,
  type: string = 'info'
) {
  try {
    const row = await adminDb.createRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: TABLES.NOTIFICATIONS,
      rowId: ID.unique(),
      data: {
        user_id: userId,
        titre,
        message,
        type,
        lu: false,
        date: new Date().toISOString()
      },
      permissions: [
        Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId))
      ]
    });
    notificationEmitter.emit(`user:${userId}`, row);
    return row;
  } catch (err) {
    console.error('Notification insert error:', err);
    return null;
  }
}

async function getUserRowByUserId(userId: string) {
  const res = await adminDb.listRows({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: TABLES.USERS,
    queries: [Query.equal('user_id', userId), Query.limit(1)]
  });
  return res.rows[0] || null;
}

async function getOrCreateWalletRow(userId: string) {
  const res = await adminDb.listRows({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: TABLES.WALLETS,
    queries: [Query.equal('user_id', userId), Query.limit(1)]
  });
  if (res.rows[0]) return res.rows[0];
  return adminDb.createRow({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: TABLES.WALLETS,
    rowId: ID.unique(),
    data: {
      user_id: userId,
      solde_total: 0,
      solde_disponible: 0,
      solde_bloque: 0,
      devise: 'Ar',
      date_maj: new Date().toISOString(),
      coins_json: '{}'
    }
  });
}

async function syncUserSolde(userId: string, soldeDisponible: number) {
  const userRow = await getUserRowByUserId(userId);
  if (userRow) {
    await adminDb.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: TABLES.USERS,
      rowId: userRow.$id,
      data: {
        solde: Math.max(0, Math.round(soldeDisponible))
      }
    });
  }
}

interface AuthedRequest extends Request {
  authUser?: {
    $id: string;
    email: string;
    name: string;
    emailVerification: boolean;
  };
  sessionSecret?: string;
  userRow?: Record<string, unknown> & { $id: string };
}

async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || '';
  const secret = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!secret) {
    res.status(401).json({ error: 'Session expirée ou manquante. Veuillez vous connecter.' });
    return;
  }
  try {
    const userClient = getUserSessionClient(secret);
    const acc = new Account(userClient);
    const authUser = await acc.get();
    req.authUser = {
      $id: authUser.$id,
      email: authUser.email,
      name: authUser.name,
      emailVerification: Boolean(authUser.emailVerification)
    };
    req.sessionSecret = secret;
    const uRow = await getUserRowByUserId(authUser.$id);
    if (uRow) {
      req.userRow = uRow as Record<string, unknown> & { $id: string };
    }
    next();
  } catch {
    res.status(401).json({ error: 'Session invalide ou expirée. Reconnectez-vous.' });
  }
}

function requireVerified(req: AuthedRequest, res: Response, next: NextFunction) {
  const isVerified =
    Boolean(req.userRow?.email_verifie) || Boolean(req.authUser?.emailVerification);
  if (!isVerified) {
    res.status(403).json({
      error: 'Veuillez vérifier votre adresse e-mail avec le code à 6 chiffres avant d’accéder à l’application.',
      requiresEmailVerification: true
    });
    return;
  }
  next();
}

export function createSalomaApiApp() {
  const app = express();
  const jsonParser = express.json({ limit: '1mb' });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (typeof req.body === 'string') {
      try {
        req.body = req.body.trim() ? JSON.parse(req.body) : {};
      } catch {
        res.status(400).json({ error: 'Requête JSON invalide.' });
        return;
      }
      next();
      return;
    }
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
      next();
      return;
    }
    jsonParser(req, res, err => {
      if (err) {
        res.status(400).json({ error: 'Requête JSON invalide.' });
        return;
      }
      next();
    });
  });

  // ========================================================
  // 0. CLOUDFLARE TURNSTILE PUBLIC CONFIG (SITE KEY ONLY)
  // ========================================================

  app.get('/api/security/turnstile', (_req: Request, res: Response) => {
    try {
      const masked = getMaskedTurnstileConfig();
      res.json({
        siteKey: masked.siteKey,
        isCustomConfigured: masked.isCustomConfigured
      });
    } catch {
      res.json({
        siteKey: TEST_TURNSTILE_SITE_KEY,
        isCustomConfigured: false
      });
    }
  });

  const handleTurnstileVerify = async (req: Request, res: Response) => {
    try {
      if (!getEnvTurnstileSecretKey()) {
        res.json({ success: true, skipped: true });
        return;
      }
      const token = String(req.body?.token || req.body?.turnstileToken || '').trim();
      if (!token) {
        if (process.env.VERCEL !== '1') {
          res.json({ success: true, skipped: true });
          return;
        }
        res.status(400).json({
          success: false,
          turnstileRetry: true,
          error: 'Vérification de sécurité en cours, veuillez réessayer.'
        });
        return;
      }
      const result = await verifyTurnstileWithCloudflare(token, getClientIp(req));
      if (result.skipped) {
        res.json({ success: true, skipped: true });
        return;
      }
      if (!result.success) {
        res.status(400).json({
          success: false,
          turnstileRetry: true,
          error: 'Vérification de sécurité en cours, veuillez réessayer.',
          errorCodes: result.errorCodes
        });
        return;
      }
      res.json({
        success: true,
        verifiedProof: createTurnstileProof(token)
      });
    } catch {
      res.json({ success: true, skipped: true });
    }
  };

  app.post('/api/security/turnstile/verify', handleTurnstileVerify);
  app.post('/api/turnstile/verify', handleTurnstileVerify);

  // ========================================================
  // 1. AUTHENTIFICATION RÉELLE & CODE EMAIL APPWRITE
  // ========================================================

  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const {
        nom = '',
        prenom = '',
        email = '',
        confirmEmail,
        telephone = '',
        password = '',
        parrain = '',
        pays = 'Madagascar 🇲🇬'
      } = req.body || {};

      let turnstileValid = true;
      try {
        turnstileValid = await validateTurnstileSubmission(req);
      } catch {
        turnstileValid = true;
      }
      if (!turnstileValid) {
        res.status(400).json({
          success: false,
          turnstileRetry: true,
          error: 'Vérification de sécurité en cours, veuillez réessayer.'
        });
        return;
      }

      const cleanNom = String(nom).trim();
      const cleanPrenom = String(prenom).trim();
      const cleanEmail = String(email).trim().toLowerCase();
      const cleanPhone = String(telephone).trim();
      const cleanParrain = String(parrain).trim();

      if (!cleanNom || !cleanEmail || !cleanPhone || !password) {
        res.status(400).json({ error: 'Veuillez remplir tous les champs obligatoires.' });
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        res.status(400).json({ error: 'Adresse e-mail invalide.' });
        return;
      }
      if (confirmEmail !== undefined && cleanEmail !== String(confirmEmail).trim().toLowerCase()) {
        res.status(400).json({ error: 'Les deux adresses e-mail doivent être identiques.' });
        return;
      }
      if (String(password).length < 8) {
        res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
        return;
      }

      const fullName = `${cleanPrenom ? cleanPrenom + ' ' : ''}${cleanNom}`.trim();
      const nowIso = new Date().toISOString();

      // Mode complet Admin SDK si disponible, sinon bascule non-bloquante sur Account client Appwrite
      let authUserId = '';
      let sessionSecret = '';
      let userRow: Record<string, unknown> | null = null;
      let walletRow: Record<string, unknown> | null = null;

      try {
        const existingEmail = await adminDb.listRows({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: TABLES.USERS,
          queries: [Query.equal('email', cleanEmail), Query.limit(1)]
        });
        if (existingEmail.total > 0) {
          res.status(409).json({ error: 'Cette adresse e-mail est déjà utilisée.' });
          return;
        }

        const authUser = await adminUsers.create({
          userId: ID.unique(),
          email: cleanEmail,
          password: String(password),
          name: fullName
        });
        authUserId = authUser.$id;

        const hashedPassword = await bcrypt.hash(String(password), 10);
        const referralCode = `SALOMA-${authUserId.slice(-6).toUpperCase()}`;

        userRow = (await adminDb.createRow({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: TABLES.USERS,
          rowId: ID.unique(),
          data: {
            user_id: authUserId,
            name: fullName,
            nom: cleanNom,
            prenom: cleanPrenom,
            email: cleanEmail,
            phone: cleanPhone,
            telephone: cleanPhone,
            mot_de_passe: hashedPassword,
            solde: 0,
            code_parrainage: referralCode,
            parrain: cleanParrain,
            date_inscription: nowIso,
            statut: 'actif',
            email_verifie: false,
            kyc_level: 0,
            pays: String(pays),
            role: 'client'
          }
        })) as unknown as Record<string, unknown>;

        walletRow = (await adminDb.createRow({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: TABLES.WALLETS,
          rowId: ID.unique(),
          data: {
            user_id: authUserId,
            solde_total: 0,
            solde_disponible: 0,
            solde_bloque: 0,
            devise: 'Ar',
            date_maj: nowIso,
            coins_json: '{}'
          }
        })) as unknown as Record<string, unknown>;

        const session = await adminUsers.createSession({ userId: authUserId });
        sessionSecret = session.secret;

        try {
          const userClient = getUserSessionClient(session.secret);
          const acc = new Account(userClient);
          await acc.createEmailVerificationOTP();
        } catch {
          // ignore transient OTP error
        }

        await createNotification(
          authUserId,
          'Code envoyé',
          'Code de vérification envoyé à votre email',
          'auth'
        );
      } catch (adminErr) {
        const e = adminErr as { code?: number; type?: string };
        if (e?.code === 409 || e?.type === 'user_already_exists') {
          res.status(409).json({ error: 'Cette adresse e-mail est déjà utilisée.' });
          return;
        }
        const anonAcc = new Account(getAnonClient());
        const created = await anonAcc.create({
          userId: ID.unique(),
          email: cleanEmail,
          password: String(password),
          name: fullName
        });
        authUserId = created.$id;
        const sess = await anonAcc.createEmailPasswordSession({
          email: cleanEmail,
          password: String(password)
        });
        sessionSecret = sess.secret || sess.$id;
        userRow = {
          $id: authUserId,
          user_id: authUserId,
          name: fullName,
          nom: cleanNom,
          prenom: cleanPrenom,
          email: cleanEmail,
          telephone: cleanPhone,
          solde: 0,
          code_parrainage: `SALOMA-${authUserId.slice(-6).toUpperCase()}`,
          parrain: cleanParrain,
          date_inscription: nowIso,
          statut: 'actif',
          email_verifie: false,
          kyc_level: 0,
          pays: String(pays),
          role: 'client'
        };
        walletRow = {
          $id: `wallet-${authUserId}`,
          user_id: authUserId,
          solde_total: 0,
          solde_disponible: 0,
          solde_bloque: 0,
          devise: 'Ar',
          date_maj: nowIso,
          coins_json: '{}'
        };
      }

      res.status(201).json({
        sessionSecret,
        userId: authUserId,
        requiresEmailVerification: true,
        user: sanitizeUserRow(userRow),
        wallet: serializeWallet(walletRow)
      });
    } catch (err) {
      res.status(400).json({ error: formatAppwriteErrorFr(err, 'Erreur lors de l’inscription.') });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email = '', password = '' } = req.body || {};

      let turnstileValid = true;
      try {
        turnstileValid = await validateTurnstileSubmission(req);
      } catch {
        turnstileValid = true;
      }
      if (!turnstileValid) {
        res.status(400).json({
          success: false,
          turnstileRetry: true,
          error: 'Vérification de sécurité en cours, veuillez réessayer.'
        });
        return;
      }

      const cleanEmail = String(email).trim().toLowerCase();
      if (!cleanEmail || !password) {
        res.status(400).json({ error: 'Veuillez entrer votre email et votre mot de passe.' });
        return;
      }

      const anonAcc = new Account(getAnonClient());
      const verifiedSess = await anonAcc.createEmailPasswordSession({
        email: cleanEmail,
        password: String(password)
      });

      const userId = verifiedSess.userId;
      let sessionSecret = verifiedSess.secret || verifiedSess.$id;
      let authUserName = cleanEmail;
      let authUserPhone = '';
      let authEmailVerification = false;
      let userRow: Record<string, unknown> | null = null;
      let walletRow: Record<string, unknown> | null = null;

      try {
        try {
          await adminUsers.deleteSession({ userId, sessionId: verifiedSess.$id });
        } catch {
          // ignore cleanup failure
        }
        const session = await adminUsers.createSession({ userId });
        sessionSecret = session.secret;
        const authUser = await adminUsers.get({ userId });
        authUserName = authUser.name || cleanEmail;
        authUserPhone = authUser.phone || '';
        authEmailVerification = Boolean(authUser.emailVerification);

        userRow = (await getUserRowByUserId(userId)) as Record<string, unknown> | null;
        if (!userRow) {
          const nowIso = new Date().toISOString();
          const hashedPassword = await bcrypt.hash(String(password), 10);
          userRow = (await adminDb.createRow({
            databaseId: APPWRITE_DATABASE_ID,
            tableId: TABLES.USERS,
            rowId: ID.unique(),
            data: {
              user_id: userId,
              name: authUserName,
              nom: authUser.name || 'Client',
              prenom: '',
              email: cleanEmail,
              phone: authUserPhone,
              telephone: authUserPhone,
              mot_de_passe: hashedPassword,
              solde: 0,
              code_parrainage: `SALOMA-${userId.slice(-6).toUpperCase()}`,
              parrain: '',
              date_inscription: nowIso,
              statut: 'actif',
              email_verifie: authEmailVerification,
              kyc_level: 0,
              pays: 'Madagascar 🇲🇬',
              role: 'client'
            }
          })) as unknown as Record<string, unknown>;
        }
        walletRow = (await getOrCreateWalletRow(userId)) as Record<string, unknown>;
      } catch {
        // Fallback non-bloquant si APPWRITE_API_KEY ou TablesDB admin absent sur Vercel
        const nowIso = new Date().toISOString();
        userRow = {
          $id: userId,
          user_id: userId,
          name: authUserName,
          nom: authUserName,
          prenom: '',
          email: cleanEmail,
          telephone: authUserPhone,
          solde: 0,
          code_parrainage: `SALOMA-${userId.slice(-6).toUpperCase()}`,
          date_inscription: nowIso,
          statut: 'actif',
          email_verifie: authEmailVerification,
          kyc_level: authEmailVerification ? 1 : 0,
          pays: 'Madagascar 🇲🇬',
          role: 'client'
        };
        walletRow = {
          $id: `wallet-${userId}`,
          user_id: userId,
          solde_total: 0,
          solde_disponible: 0,
          solde_bloque: 0,
          devise: 'Ar',
          date_maj: nowIso,
          coins_json: '{}'
        };
      }

      const isVerified =
        Boolean(userRow?.email_verifie) || Boolean(authEmailVerification);

      if (!isVerified && sessionSecret) {
        try {
          const acc = new Account(getUserSessionClient(sessionSecret));
          await acc.createEmailVerificationOTP();
          await createNotification(
            userId,
            'Code envoyé',
            'Code de vérification envoyé à votre email',
            'auth'
          );
        } catch {
          // rate limit or transient error handled gracefully on resend button
        }
      }

      res.json({
        sessionSecret,
        userId,
        requiresEmailVerification: !isVerified,
        user: sanitizeUserRow(userRow),
        wallet: serializeWallet(walletRow)
      });
    } catch (err) {
      res.status(401).json({ error: formatAppwriteErrorFr(err, 'Email ou mot de passe incorrect.') });
    }
  });

  app.post('/api/auth/verify-email', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const code = String(req.body?.code || '').trim();
      if (!/^\d{6}$/.test(code)) {
        res.status(400).json({ error: 'Code incorrect. Veuillez entrer un code à 6 chiffres.' });
        return;
      }

      const acc = new Account(getUserSessionClient(req.sessionSecret!));
      await acc.updateEmailVerificationOTP({
        userId: req.authUser!.$id,
        secret: code
      });

      let updatedUser = req.userRow;
      if (req.userRow) {
        updatedUser = (await adminDb.updateRow({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: TABLES.USERS,
          rowId: req.userRow.$id,
          data: { email_verifie: true }
        })) as unknown as Record<string, unknown> & { $id: string };
      }

      await createNotification(
        req.authUser!.$id,
        'Compte vérifié',
        'Compte vérifié avec succès',
        'success'
      );

      res.json({
        ok: true,
        user: updatedUser ? sanitizeUserRow(updatedUser) : null
      });
    } catch {
      res.status(400).json({ error: 'Code incorrect' });
    }
  });

  app.post('/api/auth/resend-code', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const acc = new Account(getUserSessionClient(req.sessionSecret!));
      await acc.createEmailVerificationOTP();
      await createNotification(
        req.authUser!.$id,
        'Code envoyé',
        'Code de vérification envoyé à votre email',
        'auth'
      );
      res.json({ ok: true, message: 'Code de vérification envoyé à votre email.' });
    } catch (err) {
      res.status(400).json({ error: formatAppwriteErrorFr(err, 'Impossible de renvoyer le code.') });
    }
  });

  app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
    try {
      const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        res.status(400).json({ error: 'Veuillez entrer une adresse e-mail valide.' });
        return;
      }
      const anonAcc = new Account(getAnonClient());
      const token = await anonAcc.createRecoveryOTP({ email: cleanEmail });
      res.json({
        ok: true,
        userId: token.userId,
        message: 'Un code à 6 chiffres a été envoyé à votre email.'
      });
    } catch (err) {
      res.status(400).json({ error: formatAppwriteErrorFr(err, 'Adresse e-mail introuvable.') });
    }
  });

  app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
    try {
      const userId = String(req.body?.userId || '').trim();
      const code = String(req.body?.code || '').trim();
      const newPassword = String(req.body?.newPassword || '');
      if (!userId || !/^\d{6}$/.test(code)) {
        res.status(400).json({ error: 'Code incorrect.' });
        return;
      }
      if (newPassword.length < 8) {
        res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });
        return;
      }

      const anonAcc = new Account(getAnonClient());
      await anonAcc.updateRecoveryOTP({
        userId,
        secret: code,
        password: newPassword
      });

      const userRow = await getUserRowByUserId(userId);
      if (userRow) {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await adminDb.updateRow({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: TABLES.USERS,
          rowId: userRow.$id,
          data: { mot_de_passe: hashedPassword }
        });
      }

      res.json({ ok: true, message: 'Mot de passe mis à jour avec succès.' });
    } catch {
      res.status(400).json({ error: 'Code incorrect ou expiré.' });
    }
  });

  app.post('/api/auth/logout', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const acc = new Account(getUserSessionClient(req.sessionSecret!));
      await acc.deleteSession({ sessionId: 'current' });
    } catch {
      // session already expired
    }
    res.json({ ok: true });
  });

  // ========================================================
  // 2. DASHBOARD COMPLET FILTRÉ PAR USER_ID (+ LIQUIDATION INDIVIDUELLE)
  // ========================================================

  async function settleLiquidatedTradesForUser(userId: string) {
    try {
      await refreshMarketPrices();
      const openRes = await adminDb.listRows({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.TRADES,
        queries: [Query.equal('user_id', userId), Query.equal('statut', 'en_cours'), Query.limit(100)]
      });
      if (openRes.rows.length === 0) return;

      const wallet = await getOrCreateWalletRow(userId);
      const soldeDisp = Number(wallet.solde_disponible) || 0;
      let soldeBloque = Number(wallet.solde_bloque) || 0;
      const compteTrade = getCompteTradeArFromWallet(wallet as unknown as Record<string, unknown>);
      const coins = parseCoinsJson(wallet.coins_json);
      let liquidatedCount = 0;

      for (const tr of openRes.rows) {
        const entryPrice = Number(tr.prix) || 0;
        const lev = Math.max(1, Number(tr.leverage) || 1);
        const margin = Math.max(0, Number(tr.montant) || 0);
        if (entryPrice <= 0 || lev <= 1 || margin <= 0) continue;

        const baseSym = String(tr.paire || 'BTC/USDT').split('/')[0]?.toUpperCase().trim() || 'BTC';
        const livePrice = getSalomaPriceUsd(baseSym);
        if (livePrice <= 0) continue;

        const liqPrice =
          tr.type === 'achat' ? entryPrice * (1 - 1 / lev) : entryPrice * (1 + 1 / lev);
        const isLiquidated =
          tr.type === 'achat' ? livePrice <= liqPrice : livePrice >= liqPrice;

        if (isLiquidated) {
          liquidatedCount++;
          soldeBloque = Math.max(0, Number((soldeBloque - margin).toFixed(2)));
          await adminDb.updateRow({
            databaseId: APPWRITE_DATABASE_ID,
            tableId: TABLES.TRADES,
            rowId: tr.$id,
            data: {
              statut: 'termine',
              profit: -Math.round(margin),
              close_price: livePrice,
              date_cloture: new Date().toISOString()
            }
          });
          await createNotification(
            userId,
            'Position liquidée (Marge Isolée)',
            `Position ${tr.paire} (x${lev}) liquidée individuellement via ${getActiveExchangeUpper()} à $${livePrice}`,
            'warning'
          );
        }
      }

      if (liquidatedCount > 0) {
        const nextTotal = Number((soldeDisp + compteTrade + soldeBloque).toFixed(2));
        await adminDb.updateRow({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: TABLES.WALLETS,
          rowId: wallet.$id,
          data: {
            solde_bloque: soldeBloque,
            solde_total: nextTotal,
            date_maj: new Date().toISOString(),
            coins_json: encodeCoinsWithTradeAr(coins, compteTrade)
          }
        });
      }
    } catch {
      // ignore transient liquidation sync error
    }
  }

  app.get('/api/me/session', requireAuth, async (req: AuthedRequest, res: Response) => {
    const userId = req.authUser!.$id;
    const isVerified =
      Boolean(req.userRow?.email_verifie) || Boolean(req.authUser?.emailVerification);
    const wallet = await getOrCreateWalletRow(userId);
    res.json({
      userId,
      requiresEmailVerification: !isVerified,
      user: req.userRow ? sanitizeUserRow(req.userRow) : { user_id: userId, email: req.authUser!.email, nom: req.authUser!.name },
      wallet: serializeWallet(wallet as unknown as Record<string, unknown>)
    });
  });

  app.get('/api/me/dashboard', requireAuth, requireVerified, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.authUser!.$id;
      await settleLiquidatedTradesForUser(userId);
      const [wallet, tradesRes, echangesRes, depotsRes, earnRes, notifRes] = await Promise.all([
        getOrCreateWalletRow(userId),
        adminDb.listRows({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: TABLES.TRADES,
          queries: [Query.equal('user_id', userId), Query.orderDesc('$createdAt'), Query.limit(100)]
        }),
        adminDb.listRows({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: TABLES.ECHANGES,
          queries: [Query.equal('user_id', userId), Query.orderDesc('$createdAt'), Query.limit(100)]
        }),
        adminDb.listRows({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: TABLES.DEPOTS_RETRAITS,
          queries: [Query.equal('user_id', userId), Query.orderDesc('$createdAt'), Query.limit(100)]
        }),
        adminDb.listRows({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: TABLES.EARN,
          queries: [Query.equal('user_id', userId), Query.orderDesc('$createdAt'), Query.limit(100)]
        }),
        adminDb.listRows({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: TABLES.NOTIFICATIONS,
          queries: [Query.equal('user_id', userId), Query.orderDesc('$createdAt'), Query.limit(100)]
        })
      ]);

      res.json({
        user: req.userRow ? sanitizeUserRow(req.userRow) : null,
        wallet: serializeWallet(wallet as unknown as Record<string, unknown>),
        trades: tradesRes.rows,
        echanges: echangesRes.rows,
        depotsRetraits: depotsRes.rows,
        earn: earnRes.rows,
        notifications: notifRes.rows
      });
    } catch (err) {
      res.status(400).json({ error: formatAppwriteErrorFr(err, 'Erreur lors du chargement des données.') });
    }
  });

  app.post('/api/me/kyc', requireAuth, requireVerified, async (req: AuthedRequest, res: Response) => {
    try {
      if (!req.userRow) {
        res.status(404).json({ error: 'Profil utilisateur introuvable.' });
        return;
      }
      const cin = String(req.body?.cin || '').trim();
      const adresse = String(req.body?.adresse || '').trim();
      const code_postal = String(req.body?.code_postal || '').trim();

      if (!cin || cin.length < 4) {
        res.status(400).json({ error: 'Veuillez saisir un numéro CIN valide (min 4 caractères).' });
        return;
      }
      if (!adresse || adresse.length < 4) {
        res.status(400).json({ error: 'Veuillez saisir votre adresse complète.' });
        return;
      }
      if (!code_postal || code_postal.length < 2) {
        res.status(400).json({ error: 'Veuillez saisir votre code postal.' });
        return;
      }

      const updated = await adminDb.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.USERS,
        rowId: req.userRow.$id,
        data: {
          kyc_cin: cin,
          kyc_adresse: adresse,
          kyc_code_postal: code_postal,
          kyc_statut: 'en_attente',
          kyc_level: 1
        }
      });

      const notif = await createNotification(
        req.authUser!.$id,
        'KYC envoyé',
        'Vos documents KYC (CIN, Adresse, Code Postal) sont en attente de validation Admin.',
        'info'
      );

      res.json({
        user: sanitizeUserRow(updated as unknown as Record<string, unknown>),
        notification: notif
      });
    } catch (err) {
      res.status(400).json({ error: formatAppwriteErrorFr(err) });
    }
  });

  // ========================================================
  // 2B. PRIX SALOMA TEMPS RÉEL (1:1 BYBIT / OKX / BINANCE VIA WEBSOCKET)
  // ========================================================

  app.get('/api/market/prices', async (_req: Request, res: Response) => {
    if (!isAnyExchangeWsOnline() || marketCache.updatedAt === 0) {
      await refreshMarketPrices();
    }
    const snap = buildSnapshotPayload();
    res.json({
      coins: snap.coins,
      activeExchange: snap.activeExchange,
      wsOnline: snap.wsOnline,
      updatedAt: snap.updatedAt
    });
  });

  // ========================================================
  // 3. DÉPÔTS & RETRAITS CRYPTO UNIQUEMENT (50 COINS + CHAÎNE & RÉSEAU)
  // ========================================================

  app.post('/api/wallet/deposit', requireAuth, requireVerified, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.authUser!.$id;
      const montant = Number(req.body?.montant);
      const methode = String(req.body?.methode || 'Crypto').trim();
      const txHash = String(req.body?.numero_compte || req.body?.txHash || '').trim();
      const devise = String(req.body?.devise || 'USDT').toUpperCase().trim();
      const chainLabel = String(req.body?.chain || '').trim();
      const networkName = String(req.body?.networkLabel || req.body?.networkCode || '').trim();
      const preuve = String(req.body?.preuve || '').trim();

      if (methode !== 'Crypto') {
        res.status(400).json({ error: 'Seuls les dépôts Crypto sont acceptés.' });
        return;
      }
      const coinNet = findCoinNetwork(devise, req.body?.networkCode || networkName || chainLabel);
      const fallbackCfg = CRYPTO_NETWORK_FEES[devise];
      if (!coinNet && !fallbackCfg) {
        res.status(400).json({ error: `Crypto non supportée (${devise}). Veuillez choisir parmi les 50 coins SALOMA.` });
        return;
      }
      const minDeposit = coinNet ? coinNet.minDeposit : fallbackCfg.minDeposit;
      const resolvedChain = chainLabel || coinNet?.chain || fallbackCfg?.chain || devise;

      if (Number.isNaN(montant) || montant < minDeposit) {
        res.status(400).json({ error: `Montant minimum de dépôt ${devise} : ${minDeposit} ${devise}.` });
        return;
      }
      if (!txHash || txHash.length < 6) {
        res.status(400).json({ error: 'Veuillez entrer un TX Hash de transaction valide (min. 6 caractères).' });
        return;
      }

      const displayNetwork = networkName ? `${resolvedChain} • ${networkName}` : resolvedChain;

      const txRow = await adminDb.createRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.DEPOTS_RETRAITS,
        rowId: ID.unique(),
        data: {
          user_id: userId,
          type: 'depot',
          montant,
          methode: 'Crypto',
          numero_compte: txHash,
          statut: 'en_attente',
          preuve: preuve || `Crypto ${devise} (${displayNetwork}) • TX: ${txHash}`,
          date: new Date().toISOString(),
          devise,
          frais: 0
        }
      });

      const notif = await createNotification(
        userId,
        'Dépôt reçu',
        'Dépôt reçu - en attente de validation',
        'wallet'
      );

      res.status(201).json({ transaction: txRow, notification: notif });
    } catch (err) {
      res.status(400).json({ error: formatAppwriteErrorFr(err, 'Erreur lors du dépôt.') });
    }
  });

  app.post('/api/wallet/withdraw', requireAuth, requireVerified, async (req: AuthedRequest, res: Response) => {
    try {
      const turnstileValid = await validateTurnstileSubmission(req);
      if (!turnstileValid) {
        res.status(400).json({
          success: false,
          turnstileRetry: true,
          error: 'Vérification de sécurité en cours, veuillez réessayer.'
        });
        return;
      }

      await refreshMarketPrices();
      const userId = req.authUser!.$id;
      const montant = Number(req.body?.montant);
      const methode = String(req.body?.methode || 'Crypto').trim();
      const numero_compte = String(req.body?.numero_compte || '').trim();
      const devise = String(req.body?.devise || 'USDT').toUpperCase().trim();
      const chainLabel = String(req.body?.chain || '').trim();
      const networkName = String(req.body?.networkLabel || req.body?.networkCode || '').trim();

      if (methode !== 'Crypto') {
        res.status(400).json({ error: 'Seuls les retraits Crypto sont autorisés.' });
        return;
      }
      const coinNet = findCoinNetwork(devise, req.body?.networkCode || networkName || chainLabel);
      const fallbackCfg = CRYPTO_NETWORK_FEES[devise];
      if (!coinNet && !fallbackCfg) {
        res.status(400).json({ error: `Crypto non supportée (${devise}). Veuillez choisir parmi les 50 coins SALOMA.` });
        return;
      }

      const salomaWithdrawFee = Number((montant * SALOMA_WITHDRAW_FEE_RATE).toFixed(8)); // 0.15%
      const networkFee = coinNet ? coinNet.withdrawFee : fallbackCfg.fee;
      const minWithdraw = coinNet ? coinNet.minWithdraw : fallbackCfg.minWithdraw;
      const resolvedChain = chainLabel || coinNet?.chain || fallbackCfg?.chain || devise;
      const totalFrais = Number((salomaWithdrawFee + networkFee).toFixed(8));

      if (Number.isNaN(montant) || montant <= totalFrais) {
        res.status(400).json({
          error: `Le montant doit dépasser les frais totaux (0.15% SALOMA + ${networkFee} ${devise} réseau).`
        });
        return;
      }
      if (montant < minWithdraw) {
        res.status(400).json({ error: `Montant minimum de retrait ${devise} : ${minWithdraw} ${devise}.` });
        return;
      }
      if (!numero_compte || numero_compte.length < 6) {
        res.status(400).json({ error: `Veuillez entrer une adresse de réception ${devise} (${resolvedChain}) valide.` });
        return;
      }

      const wallet = await getOrCreateWalletRow(userId);
      const soldeDisp = Number(wallet.solde_disponible) || 0;
      const soldeBloque = Number(wallet.solde_bloque) || 0;
      const compteTrade = getCompteTradeArFromWallet(wallet as unknown as Record<string, unknown>);
      const coins = parseCoinsJson(wallet.coins_json);

      let deductAr = 0;
      if ((coins[devise] || 0) >= montant) {
        coins[devise] = Number(((coins[devise] || 0) - montant).toFixed(8));
        deductAr = 0;
      } else {
        const effectivePriceUsd = getSalomaPriceUsd(devise) || Number(req.body?.priceUsd || 0);
        if (effectivePriceUsd <= 0) {
          res.status(400).json({ error: `Solde ${devise} insuffisant dans votre WALLET.` });
          return;
        }
        deductAr = Math.round(montant * effectivePriceUsd * USD_TO_MGA);
      }

      if (deductAr > soldeDisp) {
        res.status(400).json({
          error: `Solde WALLET insuffisant (${Math.round(soldeDisp).toLocaleString('fr-FR')} Ar). Si vos fonds sont sur le Compte Trade, convertissez-les vers Wallet d'abord.`
        });
        return;
      }

      const nextDisp = Number((soldeDisp - deductAr).toFixed(2));
      const nextBloque = Number((soldeBloque + deductAr).toFixed(2));
      const nextTotal = Number((nextDisp + compteTrade + nextBloque).toFixed(2));

      const updatedWallet = await adminDb.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.WALLETS,
        rowId: wallet.$id,
        data: {
          solde_disponible: nextDisp,
          solde_bloque: nextBloque,
          solde_total: nextTotal,
          date_maj: new Date().toISOString(),
          coins_json: encodeCoinsWithTradeAr(coins, compteTrade)
        }
      });

      await syncUserSolde(userId, nextDisp);

      const netReceived = Number((montant - totalFrais).toFixed(8));
      const displayNetwork = networkName ? `${resolvedChain} • ${networkName}` : resolvedChain;
      const txRow = await adminDb.createRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.DEPOTS_RETRAITS,
        rowId: ID.unique(),
        data: {
          user_id: userId,
          type: 'retrait',
          montant,
          methode: 'Crypto',
          numero_compte,
          statut: 'en_attente',
          preuve: `Crypto (${displayNetwork}) → ${numero_compte} • Frais SALOMA 0.15%: ${salomaWithdrawFee} ${devise} + Réseau: ${networkFee} ${devise} • Net: ${netReceived} ${devise} ${deductAr > 0 ? '[AR]' : '[COIN]'}`,
          date: new Date().toISOString(),
          devise,
          frais: totalFrais
        }
      });

      const notif = await createNotification(
        userId,
        'Retrait en cours',
        'Retrait en cours',
        'wallet'
      );

      res.status(201).json({
        transaction: txRow,
        wallet: serializeWallet(updatedWallet as unknown as Record<string, unknown>),
        notification: notif
      });
    } catch (err) {
      res.status(400).json({ error: formatAppwriteErrorFr(err, 'Erreur lors du retrait.') });
    }
  });

  app.delete('/api/wallet/history', requireAuth, requireVerified, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.authUser!.$id;
      let deletedCount = 0;
      let skippedPendingCount = 0;
      let cursor: string | null = null;

      while (true) {
        const queries = [Query.equal('user_id', userId), Query.limit(100)];
        if (cursor) queries.push(Query.cursorAfter(cursor));
        const batch = await adminDb.listRows({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: TABLES.DEPOTS_RETRAITS,
          queries
        });
        if (batch.rows.length === 0) break;

        const deletable = batch.rows.filter(r => String(r.statut || '') !== 'en_attente');
        skippedPendingCount += batch.rows.length - deletable.length;

        if (deletable.length > 0) {
          await Promise.all(
            deletable.map(r =>
              adminDb.deleteRow({
                databaseId: APPWRITE_DATABASE_ID,
                tableId: TABLES.DEPOTS_RETRAITS,
                rowId: r.$id
              })
            )
          );
          deletedCount += deletable.length;
        }

        if (batch.rows.length < 100) break;
        cursor = batch.rows[batch.rows.length - 1].$id;
      }

      res.json({ ok: true, deletedCount, skippedPendingCount });
    } catch (err) {
      res.status(400).json({ error: formatAppwriteErrorFr(err, 'Erreur lors de la suppression de l’historique Portefeuille.') });
    }
  });

  // ========================================================
  // 3B. CONVERSION INTERNE: WALLET ⇄ COMPTE TRADE (0% FRAIS)
  // ========================================================

  app.post('/api/wallet/convert', requireAuth, requireVerified, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.authUser!.$id;
      const direction = String(req.body?.direction || '').toUpperCase().trim();
      const amount = Math.round(Number(req.body?.amount));

      if (direction !== 'WALLET_TO_TRADE' && direction !== 'TRADE_TO_WALLET') {
        res.status(400).json({ error: 'Direction de transfert invalide.' });
        return;
      }
      if (Number.isNaN(amount) || amount < 100) {
        res.status(400).json({ error: 'Montant minimum de transfert : 100 Ar.' });
        return;
      }

      const wallet = await getOrCreateWalletRow(userId);
      let soldeDisp = Number(wallet.solde_disponible) || 0; // WALLET
      const soldeBloque = Number(wallet.solde_bloque) || 0;
      let compteTrade = getCompteTradeArFromWallet(wallet as unknown as Record<string, unknown>);
      const coins = parseCoinsJson(wallet.coins_json);

      if (direction === 'WALLET_TO_TRADE') {
        if (amount > soldeDisp) {
          res.status(400).json({
            error: `Solde WALLET insuffisant (${Math.round(soldeDisp).toLocaleString('fr-FR')} Ar).`
          });
          return;
        }
        soldeDisp = Number((soldeDisp - amount).toFixed(2));
        compteTrade = Number((compteTrade + amount).toFixed(2));
      } else {
        if (amount > compteTrade) {
          res.status(400).json({
            error: `Solde Compte Trade disponible insuffisant (${Math.round(compteTrade).toLocaleString('fr-FR')} Ar).`
          });
          return;
        }
        compteTrade = Number((compteTrade - amount).toFixed(2));
        soldeDisp = Number((soldeDisp + amount).toFixed(2));
      }

      const nextTotal = Number((soldeDisp + compteTrade + soldeBloque).toFixed(2));

      const updatedWallet = await adminDb.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.WALLETS,
        rowId: wallet.$id,
        data: {
          solde_disponible: soldeDisp,
          solde_total: nextTotal,
          date_maj: new Date().toISOString(),
          coins_json: encodeCoinsWithTradeAr(coins, compteTrade)
        }
      });

      await syncUserSolde(userId, soldeDisp);

      const notif = await createNotification(
        userId,
        'Transfert Portefeuille',
        direction === 'WALLET_TO_TRADE'
          ? `${amount.toLocaleString('fr-FR')} Ar transféré : Wallet → Compte Trade`
          : `${amount.toLocaleString('fr-FR')} Ar transféré : Compte Trade → Wallet`,
        'wallet'
      );

      res.json({
        wallet: serializeWallet(updatedWallet as unknown as Record<string, unknown>),
        notification: notif
      });
    } catch (err) {
      res.status(400).json({ error: formatAppwriteErrorFr(err, 'Erreur lors de la conversion Wallet ⇄ Compte Trade.') });
    }
  });

  // ========================================================
  // 4. TRADES RÉELS BROKER PUR (COMPTE TRADE + MARGE ISOLÉE - FRAIS 0.1%)
  // ========================================================

  app.post('/api/trades', requireAuth, requireVerified, async (req: AuthedRequest, res: Response) => {
    try {
      await refreshMarketPrices();
      const userId = req.authUser!.$id;
      const paire = String(req.body?.paire || 'BTC/USDT').trim();
      const baseSym = paire.split('/')[0]?.toUpperCase().trim() || 'BTC';
      const typeRaw = String(req.body?.type || 'achat').toLowerCase();
      const type = typeRaw === 'vente' || typeRaw === 'sell' ? 'vente' : 'achat';
      const montant = Number(req.body?.montant); // in Ar from Compte Trade
      const liveSalomaPrice = getSalomaPriceUsd(baseSym);
      const prix = liveSalomaPrice > 0 ? liveSalomaPrice : Number(req.body?.prix);
      const leverage = Math.min(500, Math.max(1, Math.round(Number(req.body?.leverage) || 1)));
      const baseMode = String(req.body?.mode || 'Manuel');
      const activeBroker = getActiveExchangeUpper();
      const mode = baseMode.includes('[') ? baseMode : `${baseMode} [${activeBroker}]`;

      if (Number.isNaN(montant) || montant < 500) {
        res.status(400).json({ error: 'Montant minimum de trading : 500 Ar.' });
        return;
      }
      if (Number.isNaN(prix) || prix <= 0) {
        res.status(400).json({ error: 'Prix du marché invalide.' });
        return;
      }

      const wallet = await getOrCreateWalletRow(userId);
      const soldeDisp = Number(wallet.solde_disponible) || 0;
      const soldeBloque = Number(wallet.solde_bloque) || 0;
      const compteTrade = getCompteTradeArFromWallet(wallet as unknown as Record<string, unknown>);
      const coins = parseCoinsJson(wallet.coins_json);

      if (montant > compteTrade) {
        res.status(400).json({
          error: `Solde Compte Trade insuffisant (${Math.round(compteTrade).toLocaleString('fr-FR')} Ar). Convertissez depuis votre Wallet vers Compte Trade.`
        });
        return;
      }

      // SALOMA prend 0.1% sur TRADE (Marge Isolée)
      const tradeFee = Number((montant * SALOMA_TRADE_FEE_RATE).toFixed(2));
      const effectiveMargin = Number((montant - tradeFee).toFixed(2));

      const nextCompteTrade = Number((compteTrade - montant).toFixed(2));
      const nextBloque = Number((soldeBloque + effectiveMargin).toFixed(2));
      const nextTotal = Number((soldeDisp + nextCompteTrade + nextBloque).toFixed(2));

      const updatedWallet = await adminDb.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.WALLETS,
        rowId: wallet.$id,
        data: {
          solde_bloque: nextBloque,
          solde_total: nextTotal,
          date_maj: new Date().toISOString(),
          coins_json: encodeCoinsWithTradeAr(coins, nextCompteTrade)
        }
      });

      const trade = await adminDb.createRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.TRADES,
        rowId: ID.unique(),
        data: {
          user_id: userId,
          paire,
          type,
          montant: effectiveMargin,
          prix,
          profit: 0,
          statut: 'en_cours',
          date_creation: new Date().toISOString(),
          date_cloture: '',
          leverage,
          close_price: prix,
          mode
        }
      });

      res.status(201).json({
        trade,
        tradeFee,
        activeExchange: activeBroker,
        wallet: serializeWallet(updatedWallet as unknown as Record<string, unknown>)
      });
    } catch (err) {
      res.status(400).json({ error: formatAppwriteErrorFr(err, 'Erreur création trade.') });
    }
  });

  app.post('/api/trades/:id/close', requireAuth, requireVerified, async (req: AuthedRequest, res: Response) => {
    try {
      await refreshMarketPrices();
      const userId = req.authUser!.$id;
      const tradeId = String(req.params.id);
      const currentPrice = Number(req.body?.currentPrice);

      const trade = await adminDb.getRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.TRADES,
        rowId: tradeId
      });

      if (trade.user_id !== userId) {
        res.status(403).json({ error: 'Accès refusé à ce trade.' });
        return;
      }
      if (trade.statut !== 'en_cours') {
        res.status(400).json({ error: 'Ce trade est déjà clôturé.' });
        return;
      }

      const entryPrice = Number(trade.prix) || 1;
      const baseSym = String(trade.paire || 'BTC/USDT').split('/')[0]?.toUpperCase().trim() || 'BTC';
      const backendPrice = getSalomaPriceUsd(baseSym);
      const execClose = backendPrice > 0 ? backendPrice : !Number.isNaN(currentPrice) && currentPrice > 0 ? currentPrice : entryPrice;
      const lev = Number(trade.leverage) || 1;
      const montant = Number(trade.montant) || 0;

      const diff =
        trade.type === 'achat'
          ? (execClose - entryPrice) / entryPrice
          : (entryPrice - execClose) / entryPrice;
      // Marge Isolée stricte + Récupération interne automatique des 0.1% frais Exchange (caché client)
      const rawPayout = Math.max(0, montant + Math.round(montant * diff * lev));
      const hiddenExchangeFee = Math.round(Math.max(montant, rawPayout) * BYBIT_HIDDEN_FEE_RATE);
      const returned = Math.max(0, Math.round(rawPayout - hiddenExchangeFee));
      const profit = Math.max(-Math.round(montant), returned - Math.round(montant));

      const updatedTrade = await adminDb.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.TRADES,
        rowId: tradeId,
        data: {
          statut: 'termine',
          profit,
          close_price: execClose,
          date_cloture: new Date().toISOString()
        }
      });

      const wallet = await getOrCreateWalletRow(userId);
      const soldeDisp = Number(wallet.solde_disponible) || 0;
      const soldeBloque = Number(wallet.solde_bloque) || 0;
      const compteTrade = getCompteTradeArFromWallet(wallet as unknown as Record<string, unknown>);
      const coins = parseCoinsJson(wallet.coins_json);

      const nextBloque = Math.max(0, Number((soldeBloque - montant).toFixed(2)));
      const nextCompteTrade = Number((compteTrade + returned).toFixed(2));
      const nextTotal = Number((soldeDisp + nextCompteTrade + nextBloque).toFixed(2));

      const updatedWallet = await adminDb.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.WALLETS,
        rowId: wallet.$id,
        data: {
          solde_bloque: nextBloque,
          solde_total: nextTotal,
          date_maj: new Date().toISOString(),
          coins_json: encodeCoinsWithTradeAr(coins, nextCompteTrade)
        }
      });

      const sign = profit >= 0 ? '+' : '';
      const notif = await createNotification(
        userId,
        'Trade clôturé',
        `Trade clôturé (${getActiveExchangeUpper()}) - Profit: ${sign}${profit.toLocaleString('fr-FR')} Ar`,
        profit >= 0 ? 'success' : 'warning'
      );

      res.json({
        trade: updatedTrade,
        wallet: serializeWallet(updatedWallet as unknown as Record<string, unknown>),
        notification: notif
      });
    } catch (err) {
      res.status(400).json({ error: formatAppwriteErrorFr(err, 'Erreur lors de la clôture du trade.') });
    }
  });

  app.delete('/api/trades/history', requireAuth, requireVerified, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.authUser!.$id;
      let deletedCount = 0;
      let cursor: string | null = null;

      while (true) {
        const queries = [Query.equal('user_id', userId), Query.limit(100)];
        if (cursor) queries.push(Query.cursorAfter(cursor));
        const batch = await adminDb.listRows({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: TABLES.TRADES,
          queries
        });
        if (batch.rows.length === 0) break;

        const deletable = batch.rows.filter(r => String(r.statut || '') !== 'en_cours');
        if (deletable.length > 0) {
          await Promise.all(
            deletable.map(r =>
              adminDb.deleteRow({
                databaseId: APPWRITE_DATABASE_ID,
                tableId: TABLES.TRADES,
                rowId: r.$id
              })
            )
          );
          deletedCount += deletable.length;
        }

        if (batch.rows.length < 100) break;
        cursor = batch.rows[batch.rows.length - 1].$id;
      }

      res.json({ ok: true, deletedCount });
    } catch (err) {
      res.status(400).json({ error: formatAppwriteErrorFr(err, 'Erreur lors de la suppression de l’historique Trade.') });
    }
  });

  // ========================================================
  // 5. ÉCHANGES RÉELS (echanges + Wallets - Frais SALOMA 0.1%)
  // ========================================================

  app.post('/api/exchanges', requireAuth, requireVerified, async (req: AuthedRequest, res: Response) => {
    try {
      try {
        await refreshMarketPrices();
      } catch {
        // use latest cached prices if upstream market refresh fails transiently
      }

      const userId = req.authUser?.$id;
      if (!userId) {
        res.status(401).json({ error: 'Session expirée ou manquante. Veuillez vous connecter.' });
        return;
      }

      const de_devise = String(req.body?.de_devise || '').toUpperCase().trim();
      const vers_devise = String(req.body?.vers_devise || '').toUpperCase().trim();
      const montant_envoye = Number(req.body?.montant_envoye);
      const fromPriceUsd = getSalomaPriceUsd(de_devise) || Number(req.body?.fromPriceUsd);
      const toPriceUsd = getSalomaPriceUsd(vers_devise) || Number(req.body?.toPriceUsd);

      if (!de_devise || !vers_devise || de_devise === vers_devise) {
        res.status(400).json({ error: 'Choisissez deux devises différentes.' });
        return;
      }
      if (Number.isNaN(montant_envoye) || !Number.isFinite(montant_envoye) || montant_envoye <= 0) {
        res.status(400).json({ error: 'Montant invalide.' });
        return;
      }
      if (
        Number.isNaN(fromPriceUsd) ||
        !Number.isFinite(fromPriceUsd) ||
        fromPriceUsd <= 0 ||
        Number.isNaN(toPriceUsd) ||
        !Number.isFinite(toPriceUsd) ||
        toPriceUsd <= 0
      ) {
        res.status(400).json({ error: 'Taux de change indisponible.' });
        return;
      }

      const wallet = await getOrCreateWalletRow(userId);
      let soldeDisp = Number(wallet.solde_disponible) || 0;
      const soldeBloque = Number(wallet.solde_bloque) || 0;
      const compteTrade = getCompteTradeArFromWallet(wallet as unknown as Record<string, unknown>);
      const coins = parseCoinsJson(wallet.coins_json);

      // Verify sufficient balance in source currency
      if (de_devise === 'AR') {
        if (montant_envoye > soldeDisp) {
          res.status(400).json({
            error: `Solde Ar insuffisant (Disponible : ${Math.round(soldeDisp).toLocaleString('fr-FR')} Ar).`
          });
          return;
        }
        soldeDisp = Number((soldeDisp - montant_envoye).toFixed(2));
      } else {
        const curCoinBal = coins[de_devise] || 0;
        if (montant_envoye > curCoinBal) {
          res.status(400).json({
            error: `Solde ${de_devise} insuffisant (Disponible : ${curCoinBal.toFixed(6)} ${de_devise}).`
          });
          return;
        }
        coins[de_devise] = Math.max(0, Number((curCoinBal - montant_envoye).toFixed(8)));
      }

      const taux = Number((fromPriceUsd / toPriceUsd).toFixed(8));
      const brutRecu = montant_envoye * taux;
      // Récupération interne automatique des 0.1% frais Exchange avant calcul SALOMA 0.1% (strictement caché client)
      const hiddenExchangeFee = brutRecu * BYBIT_HIDDEN_FEE_RATE;
      const afterExchangeRecovery = Math.max(0, brutRecu - hiddenExchangeFee);
      const frais = Number((afterExchangeRecovery * SALOMA_EXCHANGE_FEE_RATE).toFixed(8)); // 0.1% SALOMA affiché client
      const montant_recu = Number((afterExchangeRecovery - frais).toFixed(vers_devise === 'AR' ? 2 : 8));

      if (vers_devise === 'AR') {
        soldeDisp = Number((soldeDisp + montant_recu).toFixed(2));
      } else {
        coins[vers_devise] = Number(((coins[vers_devise] || 0) + montant_recu).toFixed(8));
      }

      const nextTotal = Number((soldeDisp + compteTrade + soldeBloque).toFixed(2));

      const updatedWallet = await adminDb.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.WALLETS,
        rowId: wallet.$id,
        data: {
          solde_disponible: soldeDisp,
          solde_total: nextTotal,
          date_maj: new Date().toISOString(),
          coins_json: encodeCoinsWithTradeAr(coins, compteTrade)
        }
      });

      try {
        await syncUserSolde(userId, soldeDisp);
      } catch {
        // non-blocking user balance mirror update
      }

      let echange: Record<string, unknown> | null = null;
      try {
        echange = (await adminDb.createRow({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: TABLES.ECHANGES,
          rowId: ID.unique(),
          data: {
            user_id: userId,
            de_devise: de_devise === 'AR' ? 'Ar' : de_devise,
            vers_devise: vers_devise === 'AR' ? 'Ar' : vers_devise,
            montant_envoye,
            montant_recu,
            taux,
            frais,
            statut: 'termine',
            date: new Date().toISOString()
          }
        })) as unknown as Record<string, unknown>;
      } catch {
        echange = {
          $id: `ex-${Date.now()}`,
          user_id: userId,
          de_devise: de_devise === 'AR' ? 'Ar' : de_devise,
          vers_devise: vers_devise === 'AR' ? 'Ar' : vers_devise,
          montant_envoye,
          montant_recu,
          taux,
          frais,
          statut: 'termine',
          date: new Date().toISOString()
        };
      }

      let notif: Record<string, unknown> | null = null;
      try {
        notif = (await createNotification(
          userId,
          'Échange réussi',
          'Échange réussi',
          'success'
        )) as unknown as Record<string, unknown> | null;
      } catch {
        // non-blocking notification
      }

      res.status(201).json({
        echange,
        wallet: serializeWallet(updatedWallet as unknown as Record<string, unknown>),
        notification: notif
      });
    } catch (err) {
      res.status(400).json({ error: formatAppwriteErrorFr(err, 'Erreur lors de l’échange.') });
    }
  });

  // ========================================================
  // 6. EARN RÉEL (earn + Wallets)
  // ========================================================

  app.post('/api/earn/claim', requireAuth, requireVerified, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.authUser!.$id;
      const type_gain = String(req.body?.type_gain || 'bonus').trim();
      const montant = Math.round(Number(req.body?.montant));
      const description = String(req.body?.description || 'Gain SALOMA Earn').trim();
      const task_id = String(req.body?.task_id || '').trim();

      if (Number.isNaN(montant) || montant <= 0) {
        res.status(400).json({ error: 'Montant de gain invalide.' });
        return;
      }

      if (task_id) {
        const dup = await adminDb.listRows({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: TABLES.EARN,
          queries: [Query.equal('user_id', userId), Query.equal('task_id', task_id), Query.limit(1)]
        });
        if (dup.total > 0) {
          res.status(409).json({ error: 'Ce gain a déjà été réclamé.' });
          return;
        }
      }

      const wallet = await getOrCreateWalletRow(userId);
      const soldeDisp = Number(wallet.solde_disponible) || 0;
      const soldeBloque = Number(wallet.solde_bloque) || 0;
      const compteTrade = getCompteTradeArFromWallet(wallet as unknown as Record<string, unknown>);
      const coins = parseCoinsJson(wallet.coins_json);

      // If épargne subscription (debit) vs gain (credit)
      let nextDisp = soldeDisp;
      let nextBloque = soldeBloque;
      if (type_gain === 'epargne') {
        if (montant > soldeDisp) {
          res.status(400).json({ error: 'Solde disponible insuffisant pour cette épargne.' });
          return;
        }
        nextDisp = Number((soldeDisp - montant).toFixed(2));
        nextBloque = Number((soldeBloque + montant).toFixed(2));
      } else {
        nextDisp = Number((soldeDisp + montant).toFixed(2));
      }

      const nextTotal = Number((nextDisp + compteTrade + nextBloque).toFixed(2));

      const updatedWallet = await adminDb.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.WALLETS,
        rowId: wallet.$id,
        data: {
          solde_disponible: nextDisp,
          solde_bloque: nextBloque,
          solde_total: nextTotal,
          date_maj: new Date().toISOString(),
          coins_json: encodeCoinsWithTradeAr(coins, compteTrade)
        }
      });

      await syncUserSolde(userId, nextDisp);

      const earnRow = await adminDb.createRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.EARN,
        rowId: ID.unique(),
        data: {
          user_id: userId,
          type_gain,
          montant,
          description,
          date: new Date().toISOString(),
          task_id
        }
      });

      const notif =
        type_gain !== 'epargne'
          ? await createNotification(
              userId,
              'Gain Earn',
              `Nouveau gain Earn: +${montant.toLocaleString('fr-FR')} Ar`,
              'success'
            )
          : await createNotification(
              userId,
              'Épargne activée',
              `Plan Épargne SALOMA activé : ${montant.toLocaleString('fr-FR')} Ar`,
              'info'
            );

      res.status(201).json({
        earn: earnRow,
        wallet: serializeWallet(updatedWallet as unknown as Record<string, unknown>),
        notification: notif
      });
    } catch (err) {
      res.status(400).json({ error: formatAppwriteErrorFr(err, 'Erreur lors du gain Earn.') });
    }
  });

  app.post('/api/earn/withdraw-fund', requireAuth, requireVerified, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.authUser!.$id;
      const earnRes = await adminDb.listRows({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.EARN,
        queries: [Query.equal('user_id', userId), Query.limit(500)]
      });

      let totalEpargne = 0;
      let totalFondRetire = 0;
      for (const row of earnRes.rows) {
        const amt = Number(row.montant) || 0;
        if (row.type_gain === 'epargne') totalEpargne += amt;
        else if (row.type_gain === 'retrait_fond') totalFondRetire += amt;
      }

      const fondActif = Math.max(0, Math.round(totalEpargne - totalFondRetire));
      const wallet = await getOrCreateWalletRow(userId);
      const soldeDisp = Number(wallet.solde_disponible) || 0;
      const soldeBloque = Number(wallet.solde_bloque) || 0;
      const compteTrade = getCompteTradeArFromWallet(wallet as unknown as Record<string, unknown>);
      const coins = parseCoinsJson(wallet.coins_json);

      const withdrawable = Math.min(fondActif, Math.round(soldeBloque));
      if (withdrawable <= 0) {
        res.status(400).json({ error: 'Aucun fond Épargne disponible à retirer.' });
        return;
      }

      const nextDisp = Number((soldeDisp + withdrawable).toFixed(2));
      const nextBloque = Math.max(0, Number((soldeBloque - withdrawable).toFixed(2)));
      const nextTotal = Number((nextDisp + compteTrade + nextBloque).toFixed(2));

      const updatedWallet = await adminDb.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.WALLETS,
        rowId: wallet.$id,
        data: {
          solde_disponible: nextDisp,
          solde_bloque: nextBloque,
          solde_total: nextTotal,
          date_maj: new Date().toISOString(),
          coins_json: encodeCoinsWithTradeAr(coins, compteTrade)
        }
      });

      await syncUserSolde(userId, nextDisp);

      const earnRow = await adminDb.createRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.EARN,
        rowId: ID.unique(),
        data: {
          user_id: userId,
          type_gain: 'retrait_fond',
          montant: withdrawable,
          description: 'Retrait fond Épargne → Wallet',
          date: new Date().toISOString(),
          task_id: ''
        }
      });

      const notif = await createNotification(
        userId,
        'Retrait fond Earn',
        `+${withdrawable.toLocaleString('fr-FR')} Ar transféré du fond Épargne vers votre Wallet`,
        'success'
      );

      res.status(201).json({
        amount: withdrawable,
        earn: earnRow,
        wallet: serializeWallet(updatedWallet as unknown as Record<string, unknown>),
        notification: notif
      });
    } catch (err) {
      res.status(400).json({ error: formatAppwriteErrorFr(err, 'Erreur lors du retrait du fond.') });
    }
  });

  app.post('/api/earn/withdraw-profit', requireAuth, requireVerified, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.authUser!.$id;
      const earnRes = await adminDb.listRows({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.EARN,
        queries: [Query.equal('user_id', userId), Query.limit(500)]
      });

      const nowMs = Date.now();
      let totalEpargne = 0;
      let totalFondRetire = 0;
      let totalProfitRetire = 0;
      let rawAccrued = 0;

      for (const row of earnRes.rows) {
        const amt = Number(row.montant) || 0;
        if (row.type_gain === 'epargne') {
          totalEpargne += amt;
          const ts = Date.parse(String(row.date || row.$createdAt || ''));
          if (!Number.isNaN(ts)) {
            const elapsedMs = Math.max(0, nowMs - ts);
            rawAccrued += (amt * 0.08 * elapsedMs) / (365 * 86400 * 1000);
          }
        } else if (row.type_gain === 'retrait_fond') {
          totalFondRetire += amt;
        } else if (row.type_gain === 'retrait_profit') {
          totalProfitRetire += amt;
        }
      }

      const fondActif = Math.max(0, totalEpargne - totalFondRetire);
      const activeRatio = totalEpargne > 0 ? Math.max(0, Math.min(1, fondActif / totalEpargne)) : 0;
      const availableProfit = Math.max(0, Math.floor(rawAccrued * activeRatio - totalProfitRetire));

      if (availableProfit < 1) {
        res.status(400).json({
          error: 'Aucun profit Épargne accumulé à retirer pour le moment (rendement 8%/an calculé en continu).'
        });
        return;
      }

      const wallet = await getOrCreateWalletRow(userId);
      const soldeDisp = Number(wallet.solde_disponible) || 0;
      const soldeBloque = Number(wallet.solde_bloque) || 0;
      const compteTrade = getCompteTradeArFromWallet(wallet as unknown as Record<string, unknown>);
      const coins = parseCoinsJson(wallet.coins_json);

      const nextDisp = Number((soldeDisp + availableProfit).toFixed(2));
      const nextTotal = Number((nextDisp + compteTrade + soldeBloque).toFixed(2));

      const updatedWallet = await adminDb.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.WALLETS,
        rowId: wallet.$id,
        data: {
          solde_disponible: nextDisp,
          solde_total: nextTotal,
          date_maj: new Date().toISOString(),
          coins_json: encodeCoinsWithTradeAr(coins, compteTrade)
        }
      });

      await syncUserSolde(userId, nextDisp);

      const earnRow = await adminDb.createRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.EARN,
        rowId: ID.unique(),
        data: {
          user_id: userId,
          type_gain: 'retrait_profit',
          montant: availableProfit,
          description: 'Retrait profit Épargne → Wallet',
          date: new Date().toISOString(),
          task_id: ''
        }
      });

      const notif = await createNotification(
        userId,
        'Retrait profit Earn',
        `+${availableProfit.toLocaleString('fr-FR')} Ar de profit Épargne crédité dans votre Wallet`,
        'success'
      );

      res.status(201).json({
        amount: availableProfit,
        earn: earnRow,
        wallet: serializeWallet(updatedWallet as unknown as Record<string, unknown>),
        notification: notif
      });
    } catch (err) {
      res.status(400).json({ error: formatAppwriteErrorFr(err, 'Erreur lors du retrait du profit.') });
    }
  });

  app.delete('/api/earn/history', requireAuth, requireVerified, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.authUser!.$id;
      let deletedCount = 0;

      while (true) {
        const batch = await adminDb.listRows({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: TABLES.EARN,
          queries: [Query.equal('user_id', userId), Query.limit(100)]
        });
        if (batch.rows.length === 0) break;

        await Promise.all(
          batch.rows.map(r =>
            adminDb.deleteRow({
              databaseId: APPWRITE_DATABASE_ID,
              tableId: TABLES.EARN,
              rowId: r.$id
            })
          )
        );
        deletedCount += batch.rows.length;
        if (batch.rows.length < 100) break;
      }

      res.json({ ok: true, deletedCount });
    } catch (err) {
      res.status(400).json({ error: formatAppwriteErrorFr(err, 'Erreur lors de la suppression de l’historique Earn.') });
    }
  });

  // ========================================================
  // 7. NOTIFICATIONS & SUPPORT PROBLÈMES
  // ========================================================

  app.get('/api/notifications/stream', requireAuth, requireVerified, async (req: AuthedRequest, res: Response) => {
    const userId = req.authUser!.$id;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const seenIds = new Set<string>();
    try {
      const initial = await adminDb.listRows({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.NOTIFICATIONS,
        queries: [Query.equal('user_id', userId), Query.orderDesc('date'), Query.limit(50)]
      });
      for (const r of initial.rows) {
        seenIds.add(r.$id);
      }
    } catch {
      // ignore initial snapshot error
    }

    const pushRow = (row: Record<string, unknown> & { $id?: string }) => {
      if (row.$id) {
        if (seenIds.has(row.$id)) return;
        seenIds.add(row.$id);
      }
      if (!res.writableEnded) {
        res.write(`event: notification\ndata: ${JSON.stringify(row)}\n\n`);
      }
    };

    res.write(': connected\n\n');

    const channelKey = `user:${userId}`;
    notificationEmitter.on(channelKey, pushRow);

    const heartbeat = setInterval(() => {
      if (!res.writableEnded) {
        res.write(': ping\n\n');
      }
    }, 20000);

    const syncCheck = setInterval(async () => {
      try {
        const latest = await adminDb.listRows({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: TABLES.NOTIFICATIONS,
          queries: [Query.equal('user_id', userId), Query.orderDesc('date'), Query.limit(10)]
        });
        for (const r of [...latest.rows].reverse()) {
          if (!seenIds.has(r.$id)) {
            pushRow(r as unknown as Record<string, unknown> & { $id?: string });
          }
        }
      } catch {
        // ignore transient polling error
      }
    }, 15000);

    req.on('close', () => {
      notificationEmitter.off(channelKey, pushRow);
      clearInterval(heartbeat);
      clearInterval(syncCheck);
    });
  });

  app.patch('/api/notifications/:id/read', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.authUser!.$id;
      const notifId = String(req.params.id);
      const existing = await adminDb.getRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.NOTIFICATIONS,
        rowId: notifId
      });
      if (existing.user_id !== userId) {
        res.status(403).json({ error: 'Accès refusé.' });
        return;
      }
      const updated = await adminDb.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.NOTIFICATIONS,
        rowId: notifId,
        data: { lu: true }
      });
      res.json({ notification: updated });
    } catch (err) {
      res.status(400).json({ error: formatAppwriteErrorFr(err) });
    }
  });

  app.post('/api/notifications/read-all', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.authUser!.$id;
      const list = await adminDb.listRows({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.NOTIFICATIONS,
        queries: [Query.equal('user_id', userId), Query.equal('lu', false), Query.limit(100)]
      });
      await Promise.all(
        list.rows.map(r =>
          adminDb.updateRow({
            databaseId: APPWRITE_DATABASE_ID,
            tableId: TABLES.NOTIFICATIONS,
            rowId: r.$id,
            data: { lu: true }
          })
        )
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: formatAppwriteErrorFr(err) });
    }
  });

  app.post('/api/problemes', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.authUser!.$id;
      const message = String(req.body?.message || '').trim();
      if (!message) {
        res.status(400).json({ error: 'Veuillez écrire votre message.' });
        return;
      }
      const row = await adminDb.createRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.PROBLEMES,
        rowId: ID.unique(),
        data: {
          user_id: userId,
          nom: String(req.userRow?.nom || req.authUser?.name || 'Client'),
          email: req.authUser!.email,
          telephone: String(req.userRow?.telephone || ''),
          message,
          statut: 'en_attente',
          date: new Date().toISOString()
        }
      });
      res.status(201).json({ problem: row });
    } catch (err) {
      res.status(400).json({ error: formatAppwriteErrorFr(err) });
    }
  });

  // ========================================================
  // 8. ADMIN ROUTES (VALIDATION DÉPÔTS/RETRAITS RÉELS)
  // ========================================================

  function getAdminHmacSecret(pinOverride?: string): string {
    return crypto
      .createHash('sha256')
      .update(`${pinOverride || currentAdminPin}:${APPWRITE_PROJECT_ID}:${ADMIN_EMAIL}:saloma-admin-sec-v2`)
      .digest('hex');
  }

  function signAdminPayload(payloadObj: Record<string, unknown>, secret: string): string {
    const payloadB64 = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
    const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
    return `${payloadB64}.${sig}`;
  }

  function verifyAdminSignedPayload<T extends Record<string, unknown>>(
    token: string,
    secret: string
  ): T | null {
    try {
      const parts = String(token || '').split('.');
      if (parts.length !== 2) return null;
      const [payloadB64, sig] = parts;
      if (!payloadB64 || !sig) return null;
      const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
      if (sig.length !== expectedSig.length) return null;
      if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
      const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as T;
      if (!parsed || typeof parsed !== 'object') return null;
      if (typeof parsed.exp === 'number' && parsed.exp < Date.now()) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function createAdminEmailChallengeToken(email: string, userId: string): string {
    return signAdminPayload(
      {
        kind: 'admin-email-challenge',
        email,
        userId,
        exp: Date.now() + 10 * 60 * 1000
      },
      getAdminHmacSecret()
    );
  }

  function createAdminSessionToken(email: string, pin: string): string {
    return signAdminPayload(
      {
        kind: 'admin-session',
        email,
        pinHash: crypto.createHash('sha256').update(pin).digest('hex'),
        exp: Date.now() + 4 * 60 * 60 * 1000
      },
      getAdminHmacSecret(pin)
    );
  }

  app.post('/api/admin/send-code', async (req: Request, res: Response) => {
    try {
      const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        res.status(400).json({ error: 'Adresse e-mail administrateur invalide.' });
        return;
      }
      if (cleanEmail !== ADMIN_EMAIL) {
        res.status(403).json({ error: 'Accès refusé : Email administrateur incorrect.' });
        return;
      }

      const anonAcc = new Account(getAnonClient());
      const token = await anonAcc.createEmailToken({
        userId: ID.unique(),
        email: cleanEmail
      });

      const challengeToken = createAdminEmailChallengeToken(cleanEmail, token.userId);
      res.json({
        ok: true,
        email: cleanEmail,
        challengeToken,
        message: 'Code de vérification à 6 chiffres envoyé par email.'
      });
    } catch (err) {
      res.status(400).json({
        error: formatAppwriteErrorFr(err, "Impossible d'envoyer le code de vérification par email.")
      });
    }
  });

  app.post('/api/admin/unlock', async (req: Request, res: Response) => {
    try {
      const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
      const cleanEmailCode = String(req.body?.emailCode || '').trim();
      const cleanCode = String(req.body?.code || req.body?.pin || '').trim();
      const challengeToken = String(req.body?.challengeToken || '').trim();

      if (!cleanEmail || !cleanEmailCode || !cleanCode) {
        res.status(400).json({
          error: 'Veuillez saisir Email, Code 6 chiffres reçu par email et le Code à 9 chiffres.'
        });
        return;
      }
      if (cleanEmail !== ADMIN_EMAIL || !/^\d{9}$/.test(cleanCode) || cleanCode !== currentAdminPin) {
        res.status(403).json({
          error: 'Accès refusé : Email ou Code à 9 chiffres incorrect.'
        });
        return;
      }
      if (!/^\d{6}$/.test(cleanEmailCode)) {
        res.status(403).json({
          error: 'Accès refusé : Code de vérification email à 6 chiffres invalide.'
        });
        return;
      }

      const challenge = verifyAdminSignedPayload<{
        kind?: string;
        email?: string;
        userId?: string;
        exp?: number;
      }>(challengeToken, getAdminHmacSecret());

      if (
        !challenge ||
        challenge.kind !== 'admin-email-challenge' ||
        challenge.email !== ADMIN_EMAIL ||
        !challenge.userId
      ) {
        res.status(403).json({
          error: 'Code email expiré ou invalide. Veuillez renvoyer un nouveau code à 6 chiffres.'
        });
        return;
      }

      const anonAcc = new Account(getAnonClient());
      let tempSess: { $id?: string; secret?: string } | null = null;
      try {
        tempSess = await anonAcc.createSession({
          userId: challenge.userId,
          secret: cleanEmailCode
        });
      } catch {
        res.status(403).json({
          error: 'Accès refusé : Code à 6 chiffres reçu par email incorrect ou expiré.'
        });
        return;
      }

      if (tempSess?.secret) {
        try {
          const tempAcc = new Account(getUserSessionClient(tempSess.secret));
          await tempAcc.deleteSession({ sessionId: 'current' });
        } catch {
          // ignore cleanup failure
        }
      } else if (tempSess?.$id) {
        try {
          await adminUsers.deleteSession({
            userId: challenge.userId,
            sessionId: tempSess.$id
          });
        } catch {
          // ignore cleanup failure
        }
      }

      const adminSessionToken = createAdminSessionToken(ADMIN_EMAIL, currentAdminPin);
      res.json({
        ok: true,
        email: ADMIN_EMAIL,
        adminSessionToken
      });
    } catch (err) {
      res.status(403).json({
        error: formatAppwriteErrorFr(err, 'Accès refusé : Vérification administrateur échouée.')
      });
    }
  });

  function requireAdminPin(req: Request, res: Response, next: NextFunction) {
    const pin = String(req.headers['x-admin-pin'] || '').trim();
    const email = String(req.headers['x-admin-email'] || '').trim().toLowerCase();
    const adminToken = String(req.headers['x-admin-token'] || '').trim();
    if (!email || email !== ADMIN_EMAIL || !/^\d{9}$/.test(pin) || pin !== currentAdminPin) {
      res.status(403).json({
        error: 'Accès refusé. Email administrateur ou code à 9 chiffres incorrect.'
      });
      return;
    }
    const verifiedSess = verifyAdminSignedPayload<{
      kind?: string;
      email?: string;
      pinHash?: string;
      exp?: number;
    }>(adminToken, getAdminHmacSecret(pin));
    const expectedPinHash = crypto.createHash('sha256').update(pin).digest('hex');
    if (
      !verifiedSess ||
      verifiedSess.kind !== 'admin-session' ||
      verifiedSess.email !== ADMIN_EMAIL ||
      verifiedSess.pinHash !== expectedPinHash
    ) {
      res.status(403).json({
        error: 'Session administrateur expirée ou vérification email 6 chiffres requise.'
      });
      return;
    }
    next();
  }

  app.get('/api/admin/overview', requireAdminPin, async (_req: Request, res: Response) => {
    try {
      await refreshMarketPrices();
      const [usersRes, txRes, tradesRes, echangesRes, probRes] = await Promise.all([
        adminDb.listRows({ databaseId: APPWRITE_DATABASE_ID, tableId: TABLES.USERS, queries: [Query.orderDesc('$createdAt'), Query.limit(100)] }),
        adminDb.listRows({ databaseId: APPWRITE_DATABASE_ID, tableId: TABLES.DEPOTS_RETRAITS, queries: [Query.orderDesc('$createdAt'), Query.limit(100)] }),
        adminDb.listRows({ databaseId: APPWRITE_DATABASE_ID, tableId: TABLES.TRADES, queries: [Query.orderDesc('$createdAt'), Query.limit(100)] }),
        adminDb.listRows({ databaseId: APPWRITE_DATABASE_ID, tableId: TABLES.ECHANGES, queries: [Query.orderDesc('$createdAt'), Query.limit(100)] }),
        adminDb.listRows({ databaseId: APPWRITE_DATABASE_ID, tableId: TABLES.PROBLEMES, queries: [Query.orderDesc('$createdAt'), Query.limit(100)] })
      ]);

      const nowMs = Date.now();
      const dayCutoff = nowMs - 24 * 60 * 60 * 1000;
      const weekCutoff = nowMs - 7 * 24 * 60 * 60 * 1000;
      const monthCutoff = nowMs - 30 * 24 * 60 * 60 * 1000;

      const makeBucket = () => ({ tradeAr: 0, echangeAr: 0, retraitAr: 0, totalAr: 0 });
      const profits = {
        jour: makeBucket(),
        semaine: makeBucket(),
        mois: makeBucket(),
        total: makeBucket()
      };

      const addProfit = (tsMs: number, kind: 'tradeAr' | 'echangeAr' | 'retraitAr', amountAr: number) => {
        if (!Number.isFinite(amountAr) || amountAr <= 0) return;
        profits.total[kind] += amountAr;
        profits.total.totalAr += amountAr;
        if (tsMs >= monthCutoff) {
          profits.mois[kind] += amountAr;
          profits.mois.totalAr += amountAr;
        }
        if (tsMs >= weekCutoff) {
          profits.semaine[kind] += amountAr;
          profits.semaine.totalAr += amountAr;
        }
        if (tsMs >= dayCutoff) {
          profits.jour[kind] += amountAr;
          profits.jour.totalAr += amountAr;
        }
      };

      for (const tr of tradesRes.rows) {
        const tsMs = Date.parse(String(tr.date_creation || tr.$createdAt || '')) || nowMs;
        const margin = Number(tr.montant) || 0;
        const gross = margin / (1 - SALOMA_TRADE_FEE_RATE);
        const feeAr = Math.round(gross * SALOMA_TRADE_FEE_RATE);
        addProfit(tsMs, 'tradeAr', feeAr);
      }

      for (const ex of echangesRes.rows) {
        const tsMs = Date.parse(String(ex.date || ex.$createdAt || '')) || nowMs;
        const targetDev = String(ex.vers_devise || 'Ar').toUpperCase();
        const fraisVal = Number(ex.frais) || 0;
        const feeAr = targetDev === 'AR' ? fraisVal : fraisVal * getSalomaPriceUsd(targetDev) * USD_TO_MGA;
        addProfit(tsMs, 'echangeAr', Math.round(feeAr));
      }

      for (const tx of txRes.rows) {
        if (tx.type !== 'retrait' || tx.statut === 'refuse') continue;
        const tsMs = Date.parse(String(tx.date || tx.$createdAt || '')) || nowMs;
        const dev = String(tx.devise || 'USDT').toUpperCase();
        const fraisVal = Number(tx.frais) || 0;
        const feeAr = dev === 'AR' ? fraisVal : fraisVal * getSalomaPriceUsd(dev) * USD_TO_MGA;
        addProfit(tsMs, 'retraitAr', Math.round(feeAr));
      }

      const marketComparison = Object.values(marketCache.coins).map(c => ({
        symbol: c.symbol,
        name: c.name,
        bybitPrice: c.bybitPrice,
        salomaPrice: c.salomaPrice,
        spreadDiff: Number((c.bybitPrice - c.salomaPrice).toFixed(8)),
        spreadPct: Number(((1 - c.salomaPrice / (c.bybitPrice || 1)) * 100).toFixed(2)),
        bybitHiddenFeePct: Number((BYBIT_HIDDEN_FEE_RATE * 100).toFixed(2)),
        change24h: c.change24h
      }));

      res.json({
        users: usersRes.rows.map(r => sanitizeUserRow(r as unknown as Record<string, unknown>)),
        transactions: txRes.rows,
        trades: tradesRes.rows,
        echanges: echangesRes.rows,
        problemes: probRes.rows,
        profits,
        marketComparison,
        apis: getMaskedApisConfig(),
        turnstile: getMaskedTurnstileConfig(),
        bybitStatus: {
          online: isAnyExchangeWsOnline() || marketCache.bybitOnline,
          wsOnline: isAnyExchangeWsOnline(),
          latencyMs: marketCache.latencyMs,
          updatedAt: marketCache.updatedAt,
          primaryExchange: getActiveExchangeUpper()
        }
      });
    } catch (err) {
      res.status(400).json({ error: formatAppwriteErrorFr(err) });
    }
  });

  // ========================================================
  // 8B. ADMIN 3 APIS (BYBIT, OKX, BINANCE — SECRETS MASQUÉS)
  // ========================================================

  app.get('/api/admin/apis', requireAdminPin, (_req: Request, res: Response) => {
    res.json({ apis: getMaskedApisConfig() });
  });

  app.post('/api/admin/apis/primary', requireAdminPin, async (req: Request, res: Response) => {
    const provider = String(req.body?.primaryApi || '').toLowerCase().trim() as BrokerExchangeId;
    if (provider !== 'bybit' && provider !== 'okx' && provider !== 'binance') {
      res.status(400).json({ error: 'API principale invalide (BYBIT, OKX ou BINANCE).' });
      return;
    }
    brokerApisStore.primaryApi = provider;
    brokerApisStore.providers[provider].enabled = true;
    saveApisStore();
    await refreshMarketPrices(true);
    broadcastWs(buildSnapshotPayload());
    res.json({
      apis: getMaskedApisConfig(),
      bybitStatus: {
        online: isAnyExchangeWsOnline() || marketCache.bybitOnline,
        wsOnline: isAnyExchangeWsOnline(),
        latencyMs: marketCache.latencyMs,
        updatedAt: marketCache.updatedAt,
        primaryExchange: getActiveExchangeUpper()
      }
    });
  });

  app.post('/api/admin/apis/:provider/toggle', requireAdminPin, async (req: Request, res: Response) => {
    const provider = String(req.params.provider || '').toLowerCase().trim() as BrokerExchangeId;
    if (provider !== 'bybit' && provider !== 'okx' && provider !== 'binance') {
      res.status(400).json({ error: 'Fournisseur API inconnu.' });
      return;
    }
    const nextEnabled =
      typeof req.body?.enabled === 'boolean'
        ? req.body.enabled
        : !brokerApisStore.providers[provider].enabled;

    brokerApisStore.providers[provider].enabled = nextEnabled;

    if (!nextEnabled && brokerApisStore.primaryApi === provider) {
      const alt = (['bybit', 'okx', 'binance'] as const).find(
        id => id !== provider && brokerApisStore.providers[id].enabled
      );
      if (alt) {
        brokerApisStore.primaryApi = alt;
      } else {
        // Guarantee at least one API remains active as primary bridge
        brokerApisStore.providers[provider].enabled = true;
        res.status(400).json({ error: 'Au moins une API doit rester activée comme pont principal.' });
        return;
      }
    }

    saveApisStore();
    await refreshMarketPrices(true);
    broadcastWs(buildSnapshotPayload());
    res.json({ apis: getMaskedApisConfig() });
  });

  app.post('/api/admin/apis/:provider', requireAdminPin, (req: Request, res: Response) => {
    const provider = String(req.params.provider || '').toLowerCase().trim() as BrokerExchangeId;
    if (provider !== 'bybit' && provider !== 'okx' && provider !== 'binance') {
      res.status(400).json({ error: 'Fournisseur API inconnu.' });
      return;
    }
    const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
    const secret = typeof req.body?.secret === 'string' ? req.body.secret.trim() : '';
    const passphrase = typeof req.body?.passphrase === 'string' ? req.body.passphrase.trim() : '';

    if (apiKey && !apiKey.includes('****')) {
      brokerApisStore.providers[provider].apiKey = apiKey;
    }
    if (secret && !/^\*+$/.test(secret)) {
      brokerApisStore.providers[provider].secret = secret;
    }
    if (provider === 'okx' && passphrase && !/^\*+$/.test(passphrase)) {
      brokerApisStore.providers[provider].passphrase = passphrase;
    }

    saveApisStore();
    res.json({ apis: getMaskedApisConfig() });
  });

  app.post('/api/admin/transactions/:id/validate', requireAdminPin, async (req: Request, res: Response) => {
    try {
      await refreshMarketPrices();
      const txId = String(req.params.id);
      const priceUsd = Number(req.body?.priceUsd || 0);
      const tx = await adminDb.getRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.DEPOTS_RETRAITS,
        rowId: txId
      });

      if (tx.statut !== 'en_attente') {
        res.status(400).json({ error: 'Cette transaction a déjà été traitée.' });
        return;
      }

      const targetUserId = String(tx.user_id);
      const montant = Number(tx.montant) || 0;
      const devise = String(tx.devise || 'Ar');
      const wallet = await getOrCreateWalletRow(targetUserId);
      let soldeDisp = Number(wallet.solde_disponible) || 0;
      let soldeBloque = Number(wallet.solde_bloque) || 0;
      const compteTrade = getCompteTradeArFromWallet(wallet as unknown as Record<string, unknown>);
      const coins = parseCoinsJson(wallet.coins_json);

      let montantAr = Math.round(montant);
      if (devise !== 'Ar') {
        const effectivePriceUsd = priceUsd > 0 ? priceUsd : getSalomaPriceUsd(devise) || (devise === 'USDT' ? 1 : 0);
        montantAr = effectivePriceUsd > 0 ? Math.round(montant * effectivePriceUsd * USD_TO_MGA) : 0;
      }

      if (tx.type === 'depot') {
        if (devise === 'Ar') {
          soldeDisp = Number((soldeDisp + montant).toFixed(2));
        } else {
          coins[devise] = Number(((coins[devise] || 0) + montant).toFixed(8));
          if (montantAr > 0) {
            soldeDisp = Number((soldeDisp + montantAr).toFixed(2));
          }
        }
        const addedLabel = montantAr > 0 ? montantAr : Math.round(montant);
        await createNotification(
          targetUserId,
          'Dépôt validé',
          `Dépôt validé - +${addedLabel.toLocaleString('fr-FR')} Ar ajouté à votre WALLET`,
          'success'
        );
      } else {
        // retrait validated: release blocked Ar if blocked during request
        const wasArBlocked = devise === 'Ar' || String(tx.preuve || '').includes('[AR]');
        if (wasArBlocked) {
          const releaseAmt = montantAr > 0 ? montantAr : montant;
          soldeBloque = Math.max(0, Number((soldeBloque - releaseAmt).toFixed(2)));
        }
      }

      const soldeTotal = Number((soldeDisp + compteTrade + soldeBloque).toFixed(2));

      await adminDb.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.WALLETS,
        rowId: wallet.$id,
        data: {
          solde_disponible: soldeDisp,
          solde_bloque: soldeBloque,
          solde_total: soldeTotal,
          date_maj: new Date().toISOString(),
          coins_json: encodeCoinsWithTradeAr(coins, compteTrade)
        }
      });

      await syncUserSolde(targetUserId, soldeDisp);

      const updatedTx = await adminDb.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.DEPOTS_RETRAITS,
        rowId: txId,
        data: { statut: 'valide' }
      });

      res.json({ transaction: updatedTx });
    } catch (err) {
      res.status(400).json({ error: formatAppwriteErrorFr(err) });
    }
  });

  app.post('/api/admin/transactions/:id/reject', requireAdminPin, async (req: Request, res: Response) => {
    try {
      await refreshMarketPrices();
      const txId = String(req.params.id);
      const priceUsd = Number(req.body?.priceUsd || 0);
      const tx = await adminDb.getRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.DEPOTS_RETRAITS,
        rowId: txId
      });

      if (tx.statut !== 'en_attente') {
        res.status(400).json({ error: 'Cette transaction a déjà été traitée.' });
        return;
      }

      const targetUserId = String(tx.user_id);
      if (tx.type === 'retrait') {
        const wallet = await getOrCreateWalletRow(targetUserId);
        let soldeDisp = Number(wallet.solde_disponible) || 0;
        let soldeBloque = Number(wallet.solde_bloque) || 0;
        const compteTrade = getCompteTradeArFromWallet(wallet as unknown as Record<string, unknown>);
        const coins = parseCoinsJson(wallet.coins_json);
        const devise = String(tx.devise || 'Ar');
        const montant = Number(tx.montant) || 0;

        if (devise !== 'Ar' && !String(tx.preuve || '').includes('[AR]')) {
          coins[devise] = Number(((coins[devise] || 0) + montant).toFixed(8));
        } else {
          const effectivePriceUsd = priceUsd > 0 ? priceUsd : getSalomaPriceUsd(devise) || (devise === 'USDT' ? 1 : 0);
          const arAmt = devise === 'Ar' ? montant : Math.round(montant * effectivePriceUsd * USD_TO_MGA);
          const refund = Math.min(soldeBloque, arAmt);
          soldeDisp = Number((soldeDisp + refund).toFixed(2));
          soldeBloque = Math.max(0, Number((soldeBloque - refund).toFixed(2)));
        }

        await adminDb.updateRow({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: TABLES.WALLETS,
          rowId: wallet.$id,
          data: {
            solde_disponible: soldeDisp,
            solde_bloque: soldeBloque,
            solde_total: Number((soldeDisp + compteTrade + soldeBloque).toFixed(2)),
            date_maj: new Date().toISOString(),
            coins_json: encodeCoinsWithTradeAr(coins, compteTrade)
          }
        });
        await syncUserSolde(targetUserId, soldeDisp);
      }

      const updatedTx = await adminDb.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.DEPOTS_RETRAITS,
        rowId: txId,
        data: { statut: 'refuse' }
      });

      res.json({ transaction: updatedTx });
    } catch (err) {
      res.status(400).json({ error: formatAppwriteErrorFr(err) });
    }
  });

  app.post('/api/admin/kyc/:id/validate', requireAdminPin, async (req: Request, res: Response) => {
    try {
      const userRowId = String(req.params.id);
      const targetUser = await adminDb.getRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.USERS,
        rowId: userRowId
      });

      const updated = await adminDb.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.USERS,
        rowId: userRowId,
        data: {
          kyc_level: 2,
          kyc_statut: 'valide'
        }
      });

      const targetAuthId = String(targetUser.user_id || userRowId);
      await createNotification(
        targetAuthId,
        'KYC Validé',
        'Votre vérification KYC (CIN, Adresse, Code Postal) a été validée par l’administrateur. Retraits débloqués.',
        'success'
      );

      res.json({ user: sanitizeUserRow(updated as unknown as Record<string, unknown>) });
    } catch (err) {
      res.status(400).json({ error: formatAppwriteErrorFr(err, 'Erreur lors de la validation KYC.') });
    }
  });

  app.post('/api/admin/kyc/:id/reject', requireAdminPin, async (req: Request, res: Response) => {
    try {
      const userRowId = String(req.params.id);
      const targetUser = await adminDb.getRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.USERS,
        rowId: userRowId
      });

      const updated = await adminDb.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.USERS,
        rowId: userRowId,
        data: {
          kyc_level: 0,
          kyc_statut: 'refuse'
        }
      });

      const targetAuthId = String(targetUser.user_id || userRowId);
      await createNotification(
        targetAuthId,
        'KYC Refusé',
        'Votre demande KYC a été refusée par l’administrateur. Veuillez vérifier vos informations et renvoyer.',
        'warning'
      );

      res.json({ user: sanitizeUserRow(updated as unknown as Record<string, unknown>) });
    } catch (err) {
      res.status(400).json({ error: formatAppwriteErrorFr(err, 'Erreur lors du refus KYC.') });
    }
  });

  app.post('/api/admin/problemes/:id/toggle', requireAdminPin, async (req: Request, res: Response) => {
    try {
      const rowId = String(req.params.id);
      const statut = req.body?.resolved ? 'resolu' : 'en_attente';
      const updated = await adminDb.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: TABLES.PROBLEMES,
        rowId,
        data: { statut }
      });
      res.json({ problem: updated });
    } catch (err) {
      res.status(400).json({ error: formatAppwriteErrorFr(err) });
    }
  });

  app.post('/api/admin/pin', requireAdminPin, (req: Request, res: Response) => {
    try {
      const newPin = String(req.body?.newPin || '').trim();
      if (!/^\d{9}$/.test(newPin)) {
        res.status(400).json({ error: 'Le nouveau code doit comporter exactement 9 chiffres.' });
        return;
      }
      currentAdminPin = newPin;
      const adminSessionToken = createAdminSessionToken(ADMIN_EMAIL, newPin);
      res.json({ ok: true, adminSessionToken });
    } catch (err) {
      res.status(400).json({ error: formatAppwriteErrorFr(err, 'Erreur modification code PIN.') });
    }
  });

  app.get('/api/admin/turnstile', requireAdminPin, (_req: Request, res: Response) => {
    try {
      res.json({ turnstile: getMaskedTurnstileConfig() });
    } catch {
      res.json({
        turnstile: {
          siteKey: TEST_TURNSTILE_SITE_KEY,
          hasSecretKey: false,
          secretKeyMasked: '',
          isCustomConfigured: false
        }
      });
    }
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('SALOMA Express global error:', err);
    if (!res.headersSent) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Erreur temporaire du serveur.'
      });
    }
  });

  return app;
}

async function startServer() {
  const app = createSalomaApiApp();

  // ========================================================
  // VITE MIDDLEWARE (DEV) OR STATIC DIST (PROD)
  // ========================================================

  const httpServer = http.createServer(app);

  wssPrices = new WebSocketServer({ noServer: true });
  wssPrices.on('connection', ws => {
    try {
      ws.send(JSON.stringify(buildSnapshotPayload()));
    } catch {
      // ignore send failure on immediate disconnect
    }
  });

  httpServer.on('upgrade', (req, socket, head) => {
    if (req.url && req.url.startsWith('/ws/prices')) {
      wssPrices?.handleUpgrade(req, socket, head, ws => {
        wssPrices?.emit('connection', ws, req);
      });
    }
  });

  startExchangeWebSockets();
  refreshMarketPrices(true).catch(() => {});

  if (process.env.NODE_ENV !== 'production') {
    app.get('/@vite-plugin-pwa/pwa-entry-point-loaded', (_req, res) => {
      res.type('application/javascript').send('export default function registerDevSW() {}');
    });

    app.get(['/sw.js', '/dev-sw.js'], (_req, res) => {
      res
        .type('application/javascript')
        .set('Cache-Control', 'no-store')
        .send(
          "self.addEventListener('install', () => self.skipWaiting());\nself.addEventListener('activate', () => { self.registration.unregister(); });"
        );
    });

    const disableHmr = process.env.DISABLE_HMR === 'true';
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: disableHmr ? false : { server: httpServer },
        hmr: disableHmr ? false : true,
        watch: disableHmr ? null : undefined
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(import.meta.dirname ?? '.', 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`SALOMA server listening on http://0.0.0.0:${PORT}`);
  });
}

const entryArg = (process.argv[1] || '').replace(/\\/g, '/');
const isDirectServerRun =
  !process.env.VERCEL &&
  !process.env.VERCEL_ENV &&
  !process.env.AWS_LAMBDA_FUNCTION_NAME &&
  (entryArg.endsWith('/server.ts') ||
    entryArg === 'server.ts' ||
    entryArg.endsWith('/server.js') ||
    entryArg === 'server.js' ||
    entryArg.endsWith('/server.mjs') ||
    entryArg === 'server.mjs');

if (isDirectServerRun) {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
