import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../lib/appwrite.ts';
import type { BotExchangeAvatarMood } from '../components/BotExchangeAvatarScene.tsx';

const USD_TO_MGA = 4750;

export interface BotExchangePairItem {
  symbol: string;
  pair: string;
  bybitSymbol: string;
  price: number;
  change24hPct: number;
  high24h: number;
  low24h: number;
  turnover24h: number;
}

export interface BotExchangeCandleItem {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BotExchangePosition {
  symbol: string;
  entryPrice: number;
  qty: number;
  amountUsdt: number;
  openedAt: number;
  peakPnlPct?: number;
}

export type BotExchangeSignalStrength = 'FAIBLE' | 'MOYEN' | 'FORT';

export interface BotExchangePreparedCoin {
  symbol: string;
  signalStrength: BotExchangeSignalStrength;
  signalScore: number;
}

export interface BotExchangeWatchedSignal {
  symbol: string;
  signalStrength: BotExchangeSignalStrength;
  signalScore: number;
  dropFromRecentHighPct: number;
  volumeRatio: number;
  reason: string;
}

export interface BotExchangeHistoryEntry {
  id: string;
  actionType: 'BUY' | 'EXCHANGE' | 'SELL' | 'EARLY_EXIT' | 'STOP_LOSS';
  buyCoin: string;
  exchangeCoin: string;
  entryPrice: number;
  exitPrice: number | null;
  amountUsdt: number;
  pnlUsd: number;
  pnlAr: number;
  pnlPct: number;
  note: string;
  timestamp: number;
}

interface PersistedBotExchangeData {
  watchedPairs: string[];
  amountArInput: string;
  entryDropPct: number;
  exitGainPct: number;
  exchangeCount: number;
  totalProfitUsd: number;
  totalProfitAr: number;
  totalLossUsd: number;
  totalLossAr: number;
  position: BotExchangePosition | null;
  sleepUntilMs: number | null;
  history: BotExchangeHistoryEntry[];
}

const DEFAULT_WATCHED = ['PEPE', 'DOGE', 'SOL', 'BTC'];
const MAX_EXCHANGES = 300;
const MIN_BYBIT_USDT = 1;

function loadPersistedState(storageKey: string): PersistedBotExchangeData {
  const fallback: PersistedBotExchangeData = {
    watchedPairs: DEFAULT_WATCHED,
    amountArInput: '0',
    entryDropPct: -3,
    exitGainPct: 2,
    exchangeCount: 0,
    totalProfitUsd: 0,
    totalProfitAr: 0,
    totalLossUsd: 0,
    totalLossAr: 0,
    position: null,
    sleepUntilMs: null,
    history: []
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PersistedBotExchangeData>;
    return {
      watchedPairs:
        Array.isArray(parsed.watchedPairs) && parsed.watchedPairs.length > 0
          ? parsed.watchedPairs.map(s => String(s).toUpperCase().trim()).filter(Boolean)
          : DEFAULT_WATCHED,
      amountArInput: typeof parsed.amountArInput === 'string' ? parsed.amountArInput : '0',
      entryDropPct: Number.isFinite(Number(parsed.entryDropPct)) ? Number(parsed.entryDropPct) : -3,
      exitGainPct: Number.isFinite(Number(parsed.exitGainPct)) ? Number(parsed.exitGainPct) : 2,
      exchangeCount: Math.max(0, Number(parsed.exchangeCount) || 0),
      totalProfitUsd: Math.max(0, Number(parsed.totalProfitUsd) || 0),
      totalProfitAr: Math.max(0, Number(parsed.totalProfitAr) || 0),
      totalLossUsd: Math.max(0, Number(parsed.totalLossUsd) || 0),
      totalLossAr: Math.max(0, Number(parsed.totalLossAr) || 0),
      position: parsed.position && parsed.position.symbol ? parsed.position : null,
      sleepUntilMs: parsed.sleepUntilMs ? Number(parsed.sleepUntilMs) : null,
      history: Array.isArray(parsed.history) ? parsed.history : []
    };
  } catch {
    return fallback;
  }
}

export function useBotExchangeEngine(params: {
  sessionToken: string | null;
  userId: string | null;
  onNotify?: (msg: string) => void;
}) {
  const { sessionToken, userId, onNotify } = params;
  const storageKey = useMemo(
    () => `saloma_bot_exchange_v1_${userId || 'anon'}`,
    [userId]
  );

  const initial = useMemo(() => loadPersistedState(storageKey), [storageKey]);

  const [pairs, setPairs] = useState<BotExchangePairItem[]>([]);
  const [pairsLoading, setPairsLoading] = useState<boolean>(false);
  const [pairsSource, setPairsSource] = useState<'bybit_spot' | 'saloma_fallback'>('bybit_spot');

  const [bybitConnected, setBybitConnected] = useState<boolean>(false);
  const [bybitUsdtBalance, setBybitUsdtBalance] = useState<number>(0);
  const [bybitCapitalAr, setBybitCapitalAr] = useState<number>(0);
  const [bybitError, setBybitError] = useState<string | null>(null);

  const [watchedPairs, setWatchedPairs] = useState<string[]>(initial.watchedPairs);
  const [amountArInput, setAmountArInput] = useState<string>(initial.amountArInput);
  const [entryDropPct, setEntryDropPct] = useState<number>(initial.entryDropPct);
  const [exitGainPct, setExitGainPct] = useState<number>(initial.exitGainPct);

  const [enabled, setEnabled] = useState<boolean>(false);
  const [exchangeCount, setExchangeCount] = useState<number>(initial.exchangeCount);
  const [totalProfitUsd, setTotalProfitUsd] = useState<number>(initial.totalProfitUsd);
  const [totalProfitAr, setTotalProfitAr] = useState<number>(initial.totalProfitAr);
  const [totalLossUsd, setTotalLossUsd] = useState<number>(initial.totalLossUsd);
  const [totalLossAr, setTotalLossAr] = useState<number>(initial.totalLossAr);
  const [position, setPosition] = useState<BotExchangePosition | null>(initial.position);
  const [sleepUntilMs, setSleepUntilMs] = useState<number | null>(initial.sleepUntilMs);
  const [history, setHistory] = useState<BotExchangeHistoryEntry[]>(initial.history);

  const [focusedSymbol, setFocusedSymbol] = useState<string>(
    initial.position?.symbol || initial.watchedPairs[0] || 'PEPE'
  );
  const [candles, setCandles] = useState<BotExchangeCandleItem[]>([]);
  const [mood, setMood] = useState<BotExchangeAvatarMood>('OFF');
  const [signalStrength, setSignalStrength] = useState<BotExchangeSignalStrength>('FAIBLE');
  const [preparedCoin, setPreparedCoin] = useState<BotExchangePreparedCoin | null>(null);
  const [watchedSignals, setWatchedSignals] = useState<BotExchangeWatchedSignal[]>([]);
  const [statusLabel, setStatusLabel] = useState<string>(
    'Robot Échange prêt (Spot Bybit uniquement · Signal FORT requis)'
  );
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [startError, setStartError] = useState<string | null>(null);

  const tickIndexRef = useRef<number>(0);
  const tickBusyRef = useRef<boolean>(false);

  // Sync from storage if user changes
  useEffect(() => {
    const loaded = loadPersistedState(storageKey);
    setWatchedPairs(loaded.watchedPairs);
    setAmountArInput(loaded.amountArInput);
    setEntryDropPct(loaded.entryDropPct);
    setExitGainPct(loaded.exitGainPct);
    setExchangeCount(loaded.exchangeCount);
    setTotalProfitUsd(loaded.totalProfitUsd);
    setTotalProfitAr(loaded.totalProfitAr);
    setTotalLossUsd(loaded.totalLossUsd);
    setTotalLossAr(loaded.totalLossAr);
    setPosition(loaded.position);
    setSleepUntilMs(loaded.sleepUntilMs);
    setHistory(loaded.history);
  }, [storageKey]);

  // Persist continuously — history is NEVER auto-deleted unless user clicks Effacer
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const payload: PersistedBotExchangeData = {
        watchedPairs,
        amountArInput,
        entryDropPct,
        exitGainPct,
        exchangeCount,
        totalProfitUsd,
        totalProfitAr,
        totalLossUsd,
        totalLossAr,
        position,
        sleepUntilMs,
        history
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // ignore storage quota errors
    }
  }, [
    storageKey,
    watchedPairs,
    amountArInput,
    entryDropPct,
    exitGainPct,
    exchangeCount,
    totalProfitUsd,
    totalProfitAr,
    totalLossUsd,
    totalLossAr,
    position,
    sleepUntilMs,
    history
  ]);

  // Countdown clock every 1s when sleeping 30 min
  useEffect(() => {
    if (!sleepUntilMs) return;
    const t = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(t);
  }, [sleepUntilMs]);

  const countdownText = useMemo(() => {
    if (!sleepUntilMs || sleepUntilMs <= nowMs) return null;
    const remSec = Math.max(0, Math.ceil((sleepUntilMs - nowMs) / 1000));
    const min = Math.floor(remSec / 60);
    const sec = remSec % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }, [sleepUntilMs, nowMs]);

  const fetchBalanceAndPairs = useCallback(async () => {
    if (!sessionToken) return;
    setPairsLoading(prev => pairs.length === 0 ? true : prev);
    try {
      const [balRes, pairsRes] = await Promise.all([
        apiRequest<{
          ok: boolean;
          connected: boolean;
          usdtBalance: number;
          capitalAr: number;
          error?: string | null;
        }>('/api/bot-exchange/balance', { token: sessionToken, timeoutMs: 8000 }).catch(() => null),
        apiRequest<{
          ok: boolean;
          source: 'bybit_spot' | 'saloma_fallback';
          pairs: BotExchangePairItem[];
        }>('/api/bot-exchange/pairs', { token: sessionToken, timeoutMs: 9000 }).catch(() => null)
      ]);

      if (balRes) {
        setBybitConnected(Boolean(balRes.connected));
        setBybitUsdtBalance(Number(balRes.usdtBalance) || 0);
        setBybitCapitalAr(Number(balRes.capitalAr) || 0);
        setBybitError(balRes.error || null);
      }
      if (pairsRes && Array.isArray(pairsRes.pairs)) {
        setPairs(pairsRes.pairs);
        setPairsSource(pairsRes.source || 'bybit_spot');
      }
    } finally {
      setPairsLoading(false);
    }
  }, [sessionToken, pairs.length]);

  useEffect(() => {
    if (!sessionToken) return;
    void fetchBalanceAndPairs();
    const timer = setInterval(() => {
      void fetchBalanceAndPairs();
    }, 6000);
    return () => clearInterval(timer);
  }, [sessionToken, fetchBalanceAndPairs]);

  // Fetch candles for focusedSymbol when idle
  const fetchCandlesForSymbol = useCallback(
    async (sym: string) => {
      if (!sessionToken || !sym) return;
      try {
        const res = await apiRequest<{
          ok: boolean;
          signalStrength?: BotExchangeSignalStrength;
          candles: BotExchangeCandleItem[];
        }>(
          `/api/bot-exchange/candles?symbol=${encodeURIComponent(sym)}&interval=1&entryDropPct=${encodeURIComponent(
            String(entryDropPct)
          )}&exitGainPct=${encodeURIComponent(String(exitGainPct))}`,
          {
            token: sessionToken,
            timeoutMs: 7000
          }
        );
        if (res?.candles && Array.isArray(res.candles)) {
          setCandles(res.candles);
        }
        if (res?.signalStrength) {
          setSignalStrength(res.signalStrength);
        }
      } catch {
        // ignore transient candle fetch error
      }
    },
    [sessionToken, entryDropPct, exitGainPct]
  );

  useEffect(() => {
    if (!sessionToken || enabled || !focusedSymbol) return;
    void fetchCandlesForSymbol(focusedSymbol);
  }, [sessionToken, enabled, focusedSymbol, fetchCandlesForSymbol]);

  // Numeric & percentage bi-directional sync
  const numericAmountAr = useMemo(() => {
    const clean = Number(String(amountArInput).replace(',', '.').replace(/[^0-9.]/g, ''));
    return Number.isFinite(clean) && clean > 0 ? Math.round(clean) : 0;
  }, [amountArInput]);

  const numericAmountUsdt = useMemo(
    () => Number((numericAmountAr / USD_TO_MGA).toFixed(4)),
    [numericAmountAr]
  );

  const syncedPercent = useMemo(() => {
    if (bybitCapitalAr <= 0 || numericAmountAr <= 0) return 0;
    return Number(Math.min(100, (numericAmountAr / bybitCapitalAr) * 100).toFixed(1));
  }, [bybitCapitalAr, numericAmountAr]);

  const activePercentPreset = useMemo(() => {
    if (bybitCapitalAr <= 0 || numericAmountAr <= 0) return null;
    const presets = [10, 20, 30, 50, 100];
    for (const p of presets) {
      const targetAr = Math.round((bybitCapitalAr * p) / 100);
      if (Math.abs(numericAmountAr - targetAr) <= Math.max(5, targetAr * 0.015)) {
        return p;
      }
    }
    return null;
  }, [bybitCapitalAr, numericAmountAr]);

  const applyPercentPreset = useCallback(
    (pct: number) => {
      const clamped = Math.min(100, Math.max(10, pct));
      const nextAr = bybitCapitalAr > 0 ? Math.round((bybitCapitalAr * clamped) / 100) : 0;
      setAmountArInput(String(nextAr));
      setStartError(null);
    },
    [bybitCapitalAr]
  );

  const setAmountManualAr = useCallback((raw: string) => {
    const filtered = raw.replace(/[^0-9]/g, '');
    setAmountArInput(filtered === '' ? '' : String(Number(filtered)));
    setStartError(null);
  }, []);

  const toggleWatchedPair = useCallback(
    (sym: string) => {
      const clean = sym.toUpperCase().trim();
      if (!clean) return;
      setWatchedPairs(prev => {
        if (prev.includes(clean)) {
          if (prev.length <= 1) {
            onNotify?.('Gardez au moins 1 paire surveillée.');
            return prev;
          }
          return prev.filter(p => p !== clean);
        }
        setFocusedSymbol(clean);
        return [...prev, clean];
      });
    },
    [onNotify]
  );

  const runTick = useCallback(async () => {
    if (!sessionToken || !enabled || tickBusyRef.current) return;
    tickBusyRef.current = true;
    try {
      tickIndexRef.current += 1;
      const executionMode = 'SPOT_ONLY';
      const category = 'spot';
      const forbidConversion = true;
      const res = await apiRequest<{
        ok: boolean;
        blockedConversion?: boolean;
        error?: string;
        usdtBalance: number;
        capitalAr: number;
        enabled: boolean;
        action: string;
        mood: BotExchangeAvatarMood;
        signalStrength?: BotExchangeSignalStrength;
        preparedCoin?: BotExchangePreparedCoin | null;
        watchedSignals?: BotExchangeWatchedSignal[];
        statusLabel: string;
        position: BotExchangePosition | null;
        sleepUntilMs: number | null;
        exchangeCount: number;
        focusedSymbol: string;
        candles: BotExchangeCandleItem[];
        tradeLog?: BotExchangeHistoryEntry;
      }>('/api/bot-exchange/tick', {
        method: 'POST',
        token: sessionToken,
        timeoutMs: 12000,
        body: {
          executionMode,
          category,
          forbidConversion,
          orderTypeTag: 'bybit_spot',
          watchedPairs,
          amountUsdt: numericAmountUsdt,
          entryDropPct,
          exitGainPct,
          exchangeCount,
          position,
          sleepUntilMs,
          focusedSymbol,
          tickIndex: tickIndexRef.current
        }
      });

      if (res.blockedConversion || res.action === 'BLOCKED_CONVERSION') {
        setEnabled(false);
        setMood('OFF');
        const msg = res.error || 'Conversion interdite - Spot uniquement';
        setStatusLabel(msg);
        setStartError(msg);
        return;
      }

      if (typeof res.usdtBalance === 'number') setBybitUsdtBalance(res.usdtBalance);
      if (typeof res.capitalAr === 'number') setBybitCapitalAr(res.capitalAr);
      if (!res.enabled) setEnabled(false);
      setMood(res.mood || 'WATCHING');
      if (res.signalStrength) setSignalStrength(res.signalStrength);
      setPreparedCoin(res.preparedCoin ?? null);
      if (Array.isArray(res.watchedSignals)) setWatchedSignals(res.watchedSignals);
      setStatusLabel(res.statusLabel || 'Analyse en cours...');
      setPosition(res.position || null);
      setSleepUntilMs(res.sleepUntilMs || null);
      if (typeof res.exchangeCount === 'number') setExchangeCount(res.exchangeCount);
      if (res.focusedSymbol) setFocusedSymbol(res.focusedSymbol);
      if (Array.isArray(res.candles) && res.candles.length > 0) {
        setCandles(res.candles);
      }

      if (res.tradeLog) {
        const log = res.tradeLog;
        setHistory(prev => [log, ...prev]);
        if (log.pnlUsd > 0) {
          setTotalProfitUsd(p => Number((p + log.pnlUsd).toFixed(4)));
          setTotalProfitAr(p => Math.round(p + log.pnlAr));
        } else if (log.pnlUsd < 0) {
          setTotalLossUsd(l => Number((l + Math.abs(log.pnlUsd)).toFixed(4)));
          setTotalLossAr(l => Math.round(l + Math.abs(log.pnlAr)));
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur Robot Échange';
      setStatusLabel(msg);
      if (
        msg.includes('Minimum Bybit') ||
        msg.includes('inférieur') ||
        msg.includes('Conversion interdite')
      ) {
        setEnabled(false);
        setMood('OFF');
        setStartError(msg);
      }
    } finally {
      tickBusyRef.current = false;
    }
  }, [
    sessionToken,
    enabled,
    watchedPairs,
    numericAmountUsdt,
    entryDropPct,
    exitGainPct,
    exchangeCount,
    position,
    sleepUntilMs,
    focusedSymbol
  ]);

  useEffect(() => {
    if (!enabled) return;
    void runTick();
    const interval = setInterval(() => {
      void runTick();
    }, 4500);
    return () => clearInterval(interval);
  }, [enabled, runTick]);

  const startRobot = useCallback(() => {
    setStartError(null);
    if (!bybitConnected || bybitUsdtBalance < MIN_BYBIT_USDT) {
      const msg = 'Solde Bybit réel insuffisant : minimum 1 USDT requis pour démarrer.';
      setStartError(msg);
      onNotify?.(msg);
      return;
    }
    if (numericAmountUsdt < MIN_BYBIT_USDT) {
      const msg = `Montant trop faible (${numericAmountUsdt.toFixed(2)} USDT). Minimum Bybit : 1 USDT.`;
      setStartError(msg);
      onNotify?.(msg);
      return;
    }
    if (numericAmountUsdt > bybitUsdtBalance + 1e-6) {
      const msg = `Montant supérieur au solde Bybit réel (${bybitUsdtBalance.toFixed(2)} USDT).`;
      setStartError(msg);
      onNotify?.(msg);
      return;
    }
    if (watchedPairs.length === 0) {
      const msg = 'Sélectionnez au moins 1 paire Bybit à surveiller.';
      setStartError(msg);
      onNotify?.(msg);
      return;
    }
    if (exchangeCount >= MAX_EXCHANGES) {
      const msg = 'Limite 300/300 échanges atteinte.';
      setStartError(msg);
      onNotify?.(msg);
      return;
    }
    setEnabled(true);
    setMood('WATCHING');
    setStatusLabel(`Regarde ${watchedPairs[0]}...`);
    onNotify?.('Robot Échange démarré (Spot uniquement)');
  }, [
    bybitConnected,
    bybitUsdtBalance,
    numericAmountUsdt,
    watchedPairs,
    exchangeCount,
    onNotify
  ]);

  const stopRobot = useCallback(() => {
    setEnabled(false);
    setMood('OFF');
    setStatusLabel('Robot Échange arrêté');
    onNotify?.('Robot Échange arrêté');
  }, [onNotify]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setExchangeCount(0);
    setTotalProfitUsd(0);
    setTotalProfitAr(0);
    setTotalLossUsd(0);
    setTotalLossAr(0);
    onNotify?.('Historique Robot Échange effacé');
  }, [onNotify]);

  return {
    pairs,
    pairsLoading,
    pairsSource,
    bybitConnected,
    bybitUsdtBalance,
    bybitCapitalAr,
    bybitError,
    watchedPairs,
    toggleWatchedPair,
    amountArInput,
    numericAmountAr,
    numericAmountUsdt,
    syncedPercent,
    activePercentPreset,
    applyPercentPreset,
    setAmountManualAr,
    entryDropPct,
    setEntryDropPct,
    exitGainPct,
    setExitGainPct,
    enabled,
    startRobot,
    stopRobot,
    startError,
    exchangeCount,
    maxExchanges: MAX_EXCHANGES,
    totalProfitUsd,
    totalProfitAr,
    totalLossUsd,
    totalLossAr,
    position,
    sleepUntilMs,
    countdownText,
    focusedSymbol,
    setFocusedSymbol,
    candles,
    mood,
    signalStrength,
    preparedCoin,
    watchedSignals,
    statusLabel,
    history,
    clearHistory,
    refreshMarket: fetchBalanceAndPairs
  };
}
