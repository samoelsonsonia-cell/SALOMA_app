import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Coin } from '../services/priceAggregator.ts';
import type { Bot3AvatarMood } from '../components/Bot3AvatarScene.tsx';
import {
  apiRequest,
  APPWRITE_CONNECTION_FAILED_MSG,
  COOKIE_SESSION_MARKER,
  type ApiError
} from '../lib/appwrite.ts';

export interface Bot3Candle {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  isUp: boolean;
  signalDir: 'up' | 'down' | 'none';
  signalStep: number | null; // 1..9 when green ascending, 9..5 when red descending
}

export interface Bot3TradeRecord {
  id: string;
  symbol: string;
  side: 'LIMIT BUY → SELL';
  leverage: number;
  amountAr: number;
  pnlPct: number;
  pnlAr: number;
  entryPrice: number;
  exitPrice: number;
  reason: 'TP' | 'SIGNAL_DOWN' | 'SL';
  timestamp: number;
}

export interface Bot3EquityPoint {
  ts: number;
  capitalAr: number;
  pnlAr: number;
  label: string;
}

export interface Bot3ActivePosition {
  symbol: string;
  entryPrice: number;
  currentPrice: number;
  entryTimeMs: number;
  amountAr: number;
  leverage: number;
  pnlPct: number;
  pnlAr: number;
  ticksHeld: number;
}

export type Bot3SleepMode = 'NONE' | 'SLEEP_30M' | 'SLEEP_MIDNIGHT';

export interface Bot3PersistedState {
  enabled: boolean;
  capitalAr: number;
  dayStartCapitalAr: number;
  capitalUsedPct: number;
  investmentAr: number;
  usePercentStakeMode: boolean;
  leverage: number;
  leverageEnabled: boolean;
  profitTargetPct: number; // Max 30 FIXE
  stopLossPct: number; // Default -0.2
  dailyTradesCount: number; // Max 100
  consecutiveLosses: number;
  sleepMode: Bot3SleepMode;
  sleepUntilMs: number | null;
  lastDayKey: string;
  lastTradePnlAr: number | null;
  equityCurve: Bot3EquityPoint[];
  history: Bot3TradeRecord[];
}

interface RemoteBot3Signal {
  symbol: string;
  signalDir: 'up' | 'down' | 'none';
  signalStep: number | null;
  price: number;
}

interface RemoteBot3StateResponse {
  ok: boolean;
  dayKey: string;
  maxPerCoin: number;
  liveBalanceAr: number;
  countsByCoin: Record<string, number>;
  activePosition: Bot3ActivePosition | null;
  history: Bot3TradeRecord[];
  signals: RemoteBot3Signal[];
  botSettingConfigured: boolean;
  setting: {
    enabled: boolean;
    capitalAr: number;
    dayStartCapitalAr: number;
    capitalUsedPct: number;
    investmentAr: number;
    usePercentStakeMode: boolean;
    leverage: number;
    leverageEnabled: boolean;
    profitTargetPct: number;
    stopLossPct: number;
    dailyTradesCount: number;
    consecutiveLosses: number;
    sleepMode: Bot3SleepMode;
    sleepUntilMs: number | null;
    lastDayKey: string;
    lastTradePnlAr: number | null;
    statusLabel?: string;
    avatarMood?: string;
    scannedSymbol?: string;
    lastRunAt?: string;
  };
}

export const BOT3_MAX_PROFIT_DAILY_PCT = 30;
export const BOT3_MAX_TRADES_DAILY = 100;
export const BOT3_MAX_TRADES_PER_COIN_DAY = 3;

export function getLocalDayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getNextLocalMidnightMs(now = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return next.getTime();
}

export function formatCountdownMmSs(secondsLeft: number): string {
  const s = Math.max(0, Math.floor(secondsLeft));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function formatCountdownHhMmSs(secondsLeft: number): string {
  const s = Math.max(0, Math.floor(secondsLeft));
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function createEmptyState(liveBalanceAr = 0): Bot3PersistedState {
  const now = Date.now();
  const realBalance = Math.max(0, Math.round(liveBalanceAr));
  return {
    enabled: false,
    capitalAr: realBalance,
    dayStartCapitalAr: realBalance,
    capitalUsedPct: 100,
    investmentAr: 0,
    usePercentStakeMode: false,
    leverage: 10,
    leverageEnabled: true,
    profitTargetPct: 30,
    stopLossPct: -0.2,
    dailyTradesCount: 0,
    consecutiveLosses: 0,
    sleepMode: 'NONE',
    sleepUntilMs: null,
    lastDayKey: getLocalDayKey(new Date(now)),
    lastTradePnlAr: null,
    equityCurve: realBalance > 0 ? [{ ts: now, capitalAr: realBalance, pnlAr: 0, label: 'Live Balance' }] : [],
    history: []
  };
}

function buildEquityCurveFromHistory(
  dayStartCapitalAr: number,
  currentCapitalAr: number,
  history: Bot3TradeRecord[]
): Bot3EquityPoint[] {
  if (currentCapitalAr <= 0 && history.length === 0) return [];
  const asc = [...history].reverse();
  const totalPnl = asc.reduce((acc, t) => acc + (Number(t.pnlAr) || 0), 0);
  let cursor = Math.max(0, dayStartCapitalAr > 0 ? dayStartCapitalAr : currentCapitalAr - totalPnl);
  const points: Bot3EquityPoint[] = [
    {
      ts: asc[0]?.timestamp ? asc[0].timestamp - 60000 : Date.now(),
      capitalAr: cursor,
      pnlAr: 0,
      label: 'Live Balance'
    }
  ];
  for (const t of asc.slice(-59)) {
    cursor = Math.max(0, cursor + (Number(t.pnlAr) || 0));
    points.push({
      ts: t.timestamp,
      capitalAr: cursor,
      pnlAr: Number(t.pnlAr) || 0,
      label: new Date(t.timestamp).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
      })
    });
  }
  if (currentCapitalAr > 0 && points[points.length - 1]?.capitalAr !== currentCapitalAr) {
    points.push({
      ts: Date.now(),
      capitalAr: currentCapitalAr,
      pnlAr: points[points.length - 1]?.pnlAr ?? 0,
      label: 'Live'
    });
  }
  return points.slice(-60);
}

function buildDisplayCandlesForCoin(
  coin: Coin,
  remoteSignal?: RemoteBot3Signal
): Bot3Candle[] {
  const base = Math.max(remoteSignal?.price || coin.price || 1, 1e-10);
  const candles: Bot3Candle[] = [];
  let cursor = base * 0.996;
  const now = Date.now();
  const seedHash = coin.symbol.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  let upStreak = 0;
  let downStreak = 0;

  for (let i = 0; i < 16; i++) {
    const wave = Math.sin((seedHash + i * 1.35) * 0.7) * 0.0014;
    const isLast = i === 15;
    const open = cursor;
    const close = isLast ? base : Math.max(1e-12, open * (1 + wave));
    const isUp = close >= open;
    const wick = Math.abs(close - open) * 0.45 + base * 0.0004;
    const high = Math.max(open, close) + wick;
    const low = Math.max(1e-12, Math.min(open, close) - wick);

    if (isUp) {
      upStreak = Math.min(9, upStreak + 1);
      downStreak = 0;
    } else {
      downStreak = downStreak === 0 ? 9 : Math.max(5, downStreak - 1);
      upStreak = 0;
    }

    candles.push({
      ts: now - (15 - i) * 60000,
      open,
      high,
      low,
      close,
      isUp: isLast && remoteSignal && remoteSignal.signalDir !== 'none'
        ? remoteSignal.signalDir === 'up'
        : isUp,
      signalDir:
        isLast && remoteSignal && remoteSignal.signalDir !== 'none'
          ? remoteSignal.signalDir
          : isUp
          ? 'up'
          : 'down',
      signalStep:
        isLast && remoteSignal && remoteSignal.signalStep !== null
          ? remoteSignal.signalStep
          : isUp
          ? upStreak
          : downStreak
    });
    cursor = close;
  }
  return candles;
}

function normalizeAvatarMood(raw?: string, enabled = false, sleepMode: Bot3SleepMode = 'NONE'): Bot3AvatarMood {
  if (!enabled) return 'OFF';
  if (sleepMode === 'SLEEP_30M') return 'SLEEP_30M';
  if (sleepMode === 'SLEEP_MIDNIGHT') return 'SLEEP_MIDNIGHT';
  if (raw === 'BUY' || raw === 'SELL' || raw === 'REST' || raw === 'WATCHING') {
    return raw;
  }
  return 'WATCHING';
}

interface UseBot3EngineOptions {
  sessionToken?: string | null;
  userId?: string | null;
  liveBalanceAr?: number;
  appwriteError?: string | null;
  appwriteCoinTradesToday?: Record<string, number>;
  coins: Coin[];
  onNotify?: (message: string) => void;
}

export function useBot3Engine({
  sessionToken = null,
  userId,
  liveBalanceAr = 0,
  appwriteError = null,
  appwriteCoinTradesToday = {},
  coins,
  onNotify
}: UseBot3EngineOptions) {
  const safeFallbackBalanceAr = appwriteError ? 0 : Math.max(0, Math.round(liveBalanceAr || 0));

  const [state, setState] = useState<Bot3PersistedState>(() =>
    createEmptyState(safeFallbackBalanceAr)
  );
  const [activePosition, setActivePosition] = useState<Bot3ActivePosition | null>(null);
  const [scannedSymbol, setScannedSymbol] = useState<string>('PEPE');
  const [avatarMood, setAvatarMood] = useState<Bot3AvatarMood>('OFF');
  const [statusLabel, setStatusLabel] = useState<string>(
    'Mode 24/7 (Appwrite Function bot-saloma) — Appuyez sur ON'
  );
  const [countdownText, setCountdownText] = useState<string | null>(null);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [remoteCountsByCoin, setRemoteCountsByCoin] = useState<Record<string, number>>({});
  const [remoteSignals, setRemoteSignals] = useState<Record<string, RemoteBot3Signal>>({});
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);

  const stateRef = useRef(state);
  stateRef.current = state;
  const onNotifyRef = useRef(onNotify);
  onNotifyRef.current = onNotify;
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveAppwriteError = appwriteError || remoteError;

  const coinTradesToday = useMemo(() => {
    const merged: Record<string, number> = {};
    for (const [sym, cnt] of Object.entries(appwriteCoinTradesToday || {})) {
      const upper = sym.toUpperCase().trim();
      if (upper) merged[upper] = Math.max(0, Number(cnt) || 0);
    }
    for (const [sym, cnt] of Object.entries(remoteCountsByCoin || {})) {
      const upper = sym.toUpperCase().trim();
      if (upper) merged[upper] = Math.max(merged[upper] || 0, Number(cnt) || 0);
    }
    return merged;
  }, [appwriteCoinTradesToday, remoteCountsByCoin]);

  // Pure display reader: polls Appwrite Bot Setting + Live Balance + Signales + TRADE every 10s
  // The frontend NEVER executes trades locally — Appwrite Function "bot-saloma" runs 24/7.
  const fetchRemoteBot3State = useCallback(async () => {
    if (!sessionToken || sessionToken === COOKIE_SESSION_MARKER) return;
    if (appwriteError) {
      setState(prev => ({
        ...prev,
        enabled: false,
        capitalAr: 0,
        dayStartCapitalAr: 0,
        equityCurve: []
      }));
      setActivePosition(null);
      setAvatarMood('OFF');
      setStatusLabel(appwriteError);
      return;
    }

    const dayKey = getLocalDayKey();
    const tzOffset = new Date().getTimezoneOffset();
    try {
      const res = await apiRequest<RemoteBot3StateResponse>(
        `/api/bot3/state?dayKey=${encodeURIComponent(dayKey)}&tzOffset=${tzOffset}`,
        { token: sessionToken, timeoutMs: 8000 }
      );
      setRemoteError(null);
      const realBal = Math.max(0, Math.round(res.liveBalanceAr || 0));
      const s = res.setting;
      const sleepMode: Bot3SleepMode =
        s.sleepMode === 'SLEEP_30M' || s.sleepMode === 'SLEEP_MIDNIGHT' ? s.sleepMode : 'NONE';
      const history = Array.isArray(res.history) ? res.history : [];
      const dayStart = Math.max(0, Math.round(s.dayStartCapitalAr || realBal));

      const sigMap: Record<string, RemoteBot3Signal> = {};
      for (const sig of res.signals || []) {
        if (sig.symbol) sigMap[sig.symbol.toUpperCase()] = sig;
      }
      setRemoteSignals(sigMap);
      setRemoteCountsByCoin(res.countsByCoin || {});
      setActivePosition(res.activePosition || null);
      if (s.scannedSymbol) setScannedSymbol(s.scannedSymbol.toUpperCase());
      setLastRunAt(s.lastRunAt || null);

      const mood = normalizeAvatarMood(s.avatarMood, Boolean(s.enabled), sleepMode);
      setAvatarMood(mood);
      setStatusLabel(
        s.statusLabel ||
          (s.enabled
            ? 'ON — Bot 24/7 actif sur Appwrite (bot-saloma Cron 1 min)'
            : 'Mode 24/7 (Appwrite Function bot-saloma) — OFF')
      );

      setState({
        enabled: realBal > 0 ? Boolean(s.enabled) : false,
        capitalAr: realBal,
        dayStartCapitalAr: dayStart,
        capitalUsedPct: Math.min(100, Math.max(1, Math.round(s.capitalUsedPct || 100))),
        investmentAr: Math.min(realBal, Math.max(0, Math.round(s.investmentAr || 0))),
        usePercentStakeMode: Boolean(s.usePercentStakeMode),
        leverage: Math.min(100, Math.max(1, Math.round(s.leverage || 10))),
        leverageEnabled: s.leverageEnabled !== false,
        profitTargetPct: Math.min(BOT3_MAX_PROFIT_DAILY_PCT, Math.max(1, Number(s.profitTargetPct || 30))),
        stopLossPct: -Math.min(50, Math.max(0.05, Math.abs(Number(s.stopLossPct ?? -0.2)))),
        dailyTradesCount: Math.max(0, Number(s.dailyTradesCount || 0)),
        consecutiveLosses: Math.max(0, Number(s.consecutiveLosses || 0)),
        sleepMode,
        sleepUntilMs: s.sleepUntilMs || null,
        lastDayKey: s.lastDayKey || dayKey,
        lastTradePnlAr: typeof s.lastTradePnlAr === 'number' ? s.lastTradePnlAr : null,
        equityCurve: buildEquityCurveFromHistory(dayStart, realBal, history),
        history
      });
    } catch (err) {
      const apiErr = err as ApiError | undefined;
      const msg = apiErr?.message || APPWRITE_CONNECTION_FAILED_MSG;
      setRemoteError(msg);
      setState(prev => ({
        ...prev,
        enabled: false,
        capitalAr: 0,
        dayStartCapitalAr: 0,
        equityCurve: []
      }));
      setActivePosition(null);
      setAvatarMood('OFF');
      setStatusLabel(msg);
    }
  }, [sessionToken, appwriteError]);

  useEffect(() => {
    if (!sessionToken || sessionToken === COOKIE_SESSION_MARKER) {
      setState(createEmptyState(0));
      setActivePosition(null);
      setAvatarMood('OFF');
      return;
    }
    void fetchRemoteBot3State();
    const poll = window.setInterval(() => {
      void fetchRemoteBot3State();
    }, 10000);
    return () => window.clearInterval(poll);
  }, [sessionToken, userId, fetchRemoteBot3State]);

  // If global appwriteError clears or liveBalanceAr updates while unpolled, keep zero virtual money rule
  useEffect(() => {
    if (effectiveAppwriteError) {
      setState(prev => ({
        ...prev,
        enabled: false,
        capitalAr: 0,
        dayStartCapitalAr: 0,
        equityCurve: []
      }));
    }
  }, [effectiveAppwriteError]);

  // Visual-only countdown ticker for Appwrite sleepUntilMs
  useEffect(() => {
    if (state.sleepMode === 'NONE' || !state.sleepUntilMs) {
      setCountdownText(null);
      return;
    }
    const updateClock = () => {
      const msLeft = Math.max(0, (state.sleepUntilMs || 0) - Date.now());
      if (state.sleepMode === 'SLEEP_30M') {
        setCountdownText(formatCountdownMmSs(msLeft / 1000));
      } else if (state.sleepMode === 'SLEEP_MIDNIGHT') {
        setCountdownText(formatCountdownHhMmSs(msLeft / 1000));
      }
    };
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, [state.sleepMode, state.sleepUntilMs]);

  const persistBotSettingsToAppwrite = useCallback(
    async (nextState: Bot3PersistedState, immediate = false) => {
      if (!sessionToken || sessionToken === COOKIE_SESSION_MARKER) return;

      const doSave = async () => {
        setSavingSettings(true);
        try {
          await apiRequest('/api/bot3/settings', {
            method: 'POST',
            token: sessionToken,
            body: {
              enabled: nextState.enabled,
              capitalUsedPct: nextState.capitalUsedPct,
              investmentAr: nextState.investmentAr,
              usePercentStakeMode: nextState.usePercentStakeMode,
              leverage: nextState.leverage,
              leverageEnabled: nextState.leverageEnabled,
              profitTargetPct: nextState.profitTargetPct,
              stopLossPct: nextState.stopLossPct,
              tzOffset: new Date().getTimezoneOffset()
            }
          });
          setRemoteError(null);
          void fetchRemoteBot3State();
        } catch (err) {
          const apiErr = err as ApiError | undefined;
          const msg = apiErr?.message || APPWRITE_CONNECTION_FAILED_MSG;
          if (apiErr?.appwriteConfigMissing || apiErr?.appwriteError) {
            setRemoteError(msg);
          }
          onNotifyRef.current?.(msg);
        } finally {
          setSavingSettings(false);
        }
      };

      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current);
        saveDebounceRef.current = null;
      }

      if (immediate) {
        void doSave();
      } else {
        saveDebounceRef.current = setTimeout(() => {
          void doSave();
        }, 450);
      }
    },
    [sessionToken, fetchRemoteBot3State]
  );

  const effectiveLeverage = state.leverageEnabled ? Math.min(100, Math.max(1, state.leverage)) : 1;
  const effectiveDailyProfitCapPct = Math.min(BOT3_MAX_PROFIT_DAILY_PCT, Math.max(1, state.profitTargetPct));
  const dailyProfitPct = useMemo(() => {
    if (state.dayStartCapitalAr <= 0) return 0;
    return ((state.capitalAr - state.dayStartCapitalAr) / state.dayStartCapitalAr) * 100;
  }, [state.capitalAr, state.dayStartCapitalAr]);

  const effectiveStakeAr = useMemo(() => {
    if (state.capitalAr <= 0) return 0;
    const rawStake = state.usePercentStakeMode
      ? Math.round((state.capitalAr * state.capitalUsedPct) / 100)
      : Math.round(state.investmentAr);
    return Math.min(Math.round(state.capitalAr), Math.max(0, rawStake));
  }, [state.capitalAr, state.capitalUsedPct, state.investmentAr, state.usePercentStakeMode]);

  const setCapitalManual = useCallback(
    (val: number) => {
      // Strictly capped by real Appwrite Live Balance (never invented virtual money)
      const maxReal = Math.max(0, stateRef.current.capitalAr);
      const nextCap = Math.min(maxReal, Math.max(0, Math.round(val)));
      setState(prev => ({
        ...prev,
        capitalAr: nextCap
      }));
    },
    []
  );

  const setCapitalUsedPctManual = useCallback(
    (pct: number) => {
      const clamped = Math.min(100, Math.max(1, Math.round(pct)));
      const next: Bot3PersistedState = {
        ...stateRef.current,
        capitalUsedPct: clamped,
        investmentAr: stateRef.current.usePercentStakeMode
          ? Math.max(0, Math.round((stateRef.current.capitalAr * clamped) / 100))
          : stateRef.current.investmentAr
      };
      setState(next);
      void persistBotSettingsToAppwrite(next);
    },
    [persistBotSettingsToAppwrite]
  );

  const setInvestmentManual = useCallback(
    (val: number) => {
      const next: Bot3PersistedState = {
        ...stateRef.current,
        investmentAr: Math.min(stateRef.current.capitalAr, Math.max(0, Math.round(val))),
        usePercentStakeMode: false
      };
      setState(next);
      void persistBotSettingsToAppwrite(next);
    },
    [persistBotSettingsToAppwrite]
  );

  const applyMaxPercentInvestment = useCallback(() => {
    const computed = Math.max(
      0,
      Math.round((stateRef.current.capitalAr * stateRef.current.capitalUsedPct) / 100)
    );
    const next: Bot3PersistedState = {
      ...stateRef.current,
      investmentAr: computed,
      usePercentStakeMode: true
    };
    setState(next);
    void persistBotSettingsToAppwrite(next, true);
  }, [persistBotSettingsToAppwrite]);

  const setLeverageManual = useCallback(
    (lev: number) => {
      const clamped = Math.min(100, Math.max(1, Math.round(lev)));
      const next: Bot3PersistedState = { ...stateRef.current, leverage: clamped };
      setState(next);
      void persistBotSettingsToAppwrite(next);
    },
    [persistBotSettingsToAppwrite]
  );

  const toggleLeverageEnabled = useCallback(() => {
    const next: Bot3PersistedState = {
      ...stateRef.current,
      leverageEnabled: !stateRef.current.leverageEnabled
    };
    setState(next);
    void persistBotSettingsToAppwrite(next, true);
  }, [persistBotSettingsToAppwrite]);

  const setProfitTargetManual = useCallback(
    (pct: number) => {
      const clamped = Math.min(BOT3_MAX_PROFIT_DAILY_PCT, Math.max(1, Number(pct.toFixed(2))));
      const next: Bot3PersistedState = { ...stateRef.current, profitTargetPct: clamped };
      setState(next);
      void persistBotSettingsToAppwrite(next);
    },
    [persistBotSettingsToAppwrite]
  );

  const setStopLossManual = useCallback(
    (pct: number) => {
      const absVal = Math.min(50, Math.max(0.05, Math.abs(pct)));
      const next: Bot3PersistedState = {
        ...stateRef.current,
        stopLossPct: -Number(absVal.toFixed(2))
      };
      setState(next);
      void persistBotSettingsToAppwrite(next);
    },
    [persistBotSettingsToAppwrite]
  );

  const toggleBot3Enabled = useCallback(() => {
    const cur = stateRef.current;
    const nextEnabled = !cur.enabled;
    if (nextEnabled) {
      if (effectiveAppwriteError) {
        onNotifyRef.current?.(effectiveAppwriteError);
        return;
      }
      if (cur.capitalAr <= 0) {
        onNotifyRef.current?.(
          'Solde Live Balance Appwrite à 0 Ar — Effectuez un dépôt réel avant d’allumer BOT 3.'
        );
        return;
      }
    }
    const next: Bot3PersistedState = { ...cur, enabled: nextEnabled };
    setState(next);
    setAvatarMood(nextEnabled ? 'WATCHING' : 'OFF');
    setStatusLabel(
      nextEnabled
        ? 'ON — Bot 24/7 actif sur Appwrite (bot-saloma Cron 1 min)'
        : 'BOT 3 arrêté (OFF)'
    );
    void persistBotSettingsToAppwrite(next, true);
  }, [effectiveAppwriteError, persistBotSettingsToAppwrite]);

  const clearHistory = useCallback(async () => {
    setState(prev => ({
      ...prev,
      history: [],
      lastTradePnlAr: null,
      equityCurve:
        prev.capitalAr > 0
          ? [{ ts: Date.now(), capitalAr: prev.capitalAr, pnlAr: 0, label: 'Live Balance' }]
          : []
    }));
    if (sessionToken && sessionToken !== COOKIE_SESSION_MARKER) {
      try {
        await apiRequest('/api/bot3/clear-history', {
          method: 'POST',
          token: sessionToken
        });
      } catch {
        // ignore clear marker error
      }
    }
    onNotifyRef.current?.('Affichage historique BOT 3 effacé.');
  }, [sessionToken]);

  const scannedCandles = useMemo(() => {
    const coinObj =
      coins.find(c => c.symbol.toUpperCase() === scannedSymbol.toUpperCase()) || coins[0];
    if (!coinObj) return [];
    const remoteSig = remoteSignals[coinObj.symbol.toUpperCase()];
    return buildDisplayCandlesForCoin(coinObj, remoteSig);
  }, [coins, scannedSymbol, remoteSignals]);

  return {
    state,
    activePosition,
    scannedSymbol,
    scannedCandles,
    avatarMood,
    statusLabel,
    countdownText,
    effectiveLeverage,
    effectiveDailyProfitCapPct,
    dailyProfitPct,
    effectiveStakeAr,
    appwriteError: effectiveAppwriteError,
    coinTradesToday,
    maxTradesPerCoinDay: BOT3_MAX_TRADES_PER_COIN_DAY,
    lastRunAt,
    savingSettings,
    setCapitalManual,
    setCapitalUsedPctManual,
    setInvestmentManual,
    applyMaxPercentInvestment,
    setLeverageManual,
    toggleLeverageEnabled,
    setProfitTargetManual,
    setStopLossManual,
    toggleBot3Enabled,
    clearHistory
  };
}
