import React, { useState, useEffect } from 'react';
import { Power, Trash2, TrendingUp, TrendingDown, ShieldAlert, Sparkles } from 'lucide-react';
import type { Coin } from '../services/priceAggregator';
import { Bot3AvatarScene } from './Bot3AvatarScene';
import type { useBot3Engine } from '../hooks/useBot3Engine';

type Bot3EngineReturn = ReturnType<typeof useBot3Engine>;

interface Bot3PanelProps {
  engine: Bot3EngineReturn;
  coins: Coin[];
  formatCoinPrice: (price: number) => string;
}

export const Bot3Panel: React.FC<Bot3PanelProps> = ({ engine, coins, formatCoinPrice }) => {
  const {
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
    appwriteError,
    coinTradesToday,
    maxTradesPerCoinDay,
    lastRunAt,
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
  } = engine;

  // Local text drafts so users can type numbers smoothly without cursor jumps
  const [capitalDraft, setCapitalDraft] = useState<string>(String(state.capitalAr));
  const [pctDraft, setPctDraft] = useState<string>(String(state.capitalUsedPct));
  const [investDraft, setInvestDraft] = useState<string>(String(state.investmentAr));
  const [levDraft, setLevDraft] = useState<string>(String(state.leverage));
  const [profitDraft, setProfitDraft] = useState<string>(String(state.profitTargetPct));
  const [slDraft, setSlDraft] = useState<string>(String(state.stopLossPct));

  useEffect(() => {
    setCapitalDraft(String(state.capitalAr));
  }, [state.capitalAr]);

  useEffect(() => {
    setPctDraft(String(state.capitalUsedPct));
  }, [state.capitalUsedPct]);

  useEffect(() => {
    setInvestDraft(String(state.investmentAr));
  }, [state.investmentAr]);

  useEffect(() => {
    setLevDraft(String(state.leverage));
  }, [state.leverage]);

  useEffect(() => {
    setProfitDraft(String(state.profitTargetPct));
  }, [state.profitTargetPct]);

  useEffect(() => {
    setSlDraft(String(state.stopLossPct));
  }, [state.stopLossPct]);

  const capitalIsProfit =
    state.lastTradePnlAr !== null ? state.lastTradePnlAr >= 0 : dailyProfitPct >= 0;
  const capitalIsLoss =
    state.lastTradePnlAr !== null ? state.lastTradePnlAr < 0 : dailyProfitPct < 0;

  const capitalColorClass = capitalIsLoss
    ? 'text-rose-400'
    : state.lastTradePnlAr !== null || dailyProfitPct > 0
    ? 'text-emerald-400'
    : 'text-white';

  // Equity curve geometry
  const curvePoints = state.equityCurve.length > 0
    ? state.equityCurve
    : [{ ts: Date.now(), capitalAr: state.capitalAr, pnlAr: 0, label: 'Live Balance' }];
  const curveValues = curvePoints.map(p => p.capitalAr);
  const minEq = Math.min(...curveValues);
  const maxEq = Math.max(...curveValues);
  const eqSpan = Math.max(1, maxEq - minEq);
  const lastEqPnl = curvePoints[curvePoints.length - 1]?.pnlAr ?? 0;
  const eqPositive =
    curvePoints.length >= 2
      ? curvePoints[curvePoints.length - 1].capitalAr >= curvePoints[0].capitalAr && lastEqPnl >= 0
      : lastEqPnl >= 0;
  const curveStrokeColor = eqPositive ? '#10B981' : '#EF4444';

  const svgPoints = curvePoints
    .map((pt, idx) => {
      const x = curvePoints.length === 1 ? 150 : (idx / (curvePoints.length - 1)) * 288 + 6;
      const y =
        maxEq === minEq
          ? 42
          : 74 - ((pt.capitalAr - minEq) / eqSpan) * 60;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const svgAreaPoints =
    curvePoints.length === 1
      ? `6,78 294,78 294,42 6,42`
      : `6,78 ${svgPoints} 294,78`;

  // Scanned coin candlestick geometry
  const scannedCoinObj = coins.find(c => c.symbol.toUpperCase() === scannedSymbol);
  const liveScannedPrice =
    activePosition && activePosition.symbol === scannedSymbol
      ? activePosition.currentPrice
      : scannedCandles[scannedCandles.length - 1]?.close ?? scannedCoinObj?.price ?? 0;

  const candleLow = scannedCandles.length
    ? Math.min(...scannedCandles.map(c => c.low))
    : Math.max(1e-12, liveScannedPrice * 0.99);
  const candleHigh = scannedCandles.length
    ? Math.max(...scannedCandles.map(c => c.high))
    : Math.max(1e-12, liveScannedPrice * 1.01);
  const candleRange = Math.max(candleHigh - candleLow, Math.max(1e-12, liveScannedPrice * 0.002));
  const latestCandle = scannedCandles[scannedCandles.length - 1];

  const topScannedPreviewCoins = coins.slice(0, 12);

  const trackedLimitSymbols = Array.from(
    new Set<string>([
      'PEPE',
      'BTC',
      'DOGE',
      'SOL',
      scannedSymbol.toUpperCase(),
      ...Object.keys(coinTradesToday || {})
    ])
  ).filter(Boolean);

  const pausedLimitCoins = trackedLimitSymbols.filter(
    sym => (coinTradesToday[sym] || 0) >= maxTradesPerCoinDay
  );

  return (
    <div className="space-y-3.5 text-xs">
      {/* HEADER BAR */}
      <div className="flex items-center justify-between gap-2 pb-1 border-b border-[#8B5CF6]/35">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
          <span className="font-black text-sm text-white truncate">
            BOT 3 — TRÈS INTELLIGENT SALOMA
          </span>
        </div>
        <span
          className={`shrink-0 text-[10px] font-mono-num font-black ${
            state.enabled ? 'text-emerald-400' : 'text-rose-400'
          }`}
        >
          {state.enabled ? 'ACTIF (ON)' : 'ARRÊTÉ (OFF)'}
        </span>
      </div>

      {appwriteError && (
        <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-400/50 text-amber-200 text-[11px] font-bold">
          {appwriteError} — Solde affiché : 0 Ar
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-purple-300 px-1">
        <span>Moteur 24/7 : Appwrite Function « bot-saloma » (Cron 1 min)</span>
        {lastRunAt && (
          <span className="font-mono-num text-emerald-300">
            Sync {new Date(lastRunAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* ================================================================
          1. TOUT EN HAUT : CAPITAL LIVE + PROFIT AUJOURD'HUI + TRADE AUJOURD'HUI + % CAPITAL UTILISÉ
         ================================================================ */}
      <div className="p-3.5 rounded-2xl bg-[#150D2E] border-2 border-[#8B5CF6]/55 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <label
              htmlFor="bot3-capital-input"
              className="text-[11px] font-black text-purple-300 block mb-1"
            >
              CAPITAL LIVE APPWRITE (Live Balance — Ariary)
            </label>
            <div className="flex items-baseline gap-2">
              <input
                id="bot3-capital-input"
                type="text"
                inputMode="numeric"
                value={capitalDraft}
                onChange={e => {
                  const clean = e.target.value.replace(/[^0-9]/g, '');
                  setCapitalDraft(clean);
                  if (clean !== '') {
                    setCapitalManual(Number(clean));
                  }
                }}
                onBlur={() => {
                  if (capitalDraft === '') {
                    setCapitalManual(0);
                    setCapitalDraft('0');
                  }
                }}
                className={`w-full bg-transparent text-3xl font-black font-mono-num focus:outline-none border-b border-purple-500/40 focus:border-[#8B5CF6] pb-0.5 ${capitalColorClass}`}
              />
              <span className={`text-xl font-black font-mono-num shrink-0 ${capitalColorClass}`}>
                Ar
              </span>
            </div>
          </div>

          <div className="text-right shrink-0 pt-1">
            {capitalIsProfit && state.lastTradePnlAr !== null && state.lastTradePnlAr > 0 && (
              <span className="inline-flex items-center gap-1 text-emerald-400 font-mono-num font-black text-xs">
                <TrendingUp className="w-3.5 h-3.5" />
                +{state.lastTradePnlAr.toLocaleString('fr-FR')} Ar
              </span>
            )}
            {capitalIsLoss && state.lastTradePnlAr !== null && (
              <span className="inline-flex items-center gap-1 text-rose-400 font-mono-num font-black text-xs">
                <TrendingDown className="w-3.5 h-3.5" />
                {state.lastTradePnlAr.toLocaleString('fr-FR')} Ar
              </span>
            )}
          </div>
        </div>

        {/* PROFIT AUJOURD'HUI & TRADE AUJOURD'HUI */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-purple-500/25">
          <div className="p-2.5 rounded-xl bg-[#1D1240] border border-purple-500/30">
            <span className="text-[10px] font-bold text-purple-300 block">PROFIT aujourd’hui</span>
            <span
              className={`text-base font-black font-mono-num block ${
                dailyProfitPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {dailyProfitPct >= 0 ? '+' : ''}
              {dailyProfitPct.toFixed(2)}% / {effectiveDailyProfitCapPct}%
            </span>
            <span className="text-[9px] text-amber-300 font-bold block">
              NE DÉPASSE PAS 30% • FIXE
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#1D1240] border border-purple-500/30">
            <span className="text-[10px] font-bold text-purple-300 block">TRADE aujourd’hui</span>
            <span className="text-base font-black font-mono-num text-white block">
              {state.dailyTradesCount} / 100
            </span>
            <span className="text-[9px] text-purple-300 block">
              Pertes suite : {state.consecutiveLosses}/3
            </span>
          </div>
        </div>

        {/* % CAPITAL UTILISÉ (1% à 100%) */}
        <div className="p-2.5 rounded-xl bg-[#1D1240] border border-purple-500/30 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="bot3-cap-pct" className="text-[11px] font-black text-purple-200">
              % CAPITAL UTILISÉ (1% à 100%) :
            </label>
            <div className="flex items-center gap-1.5">
              <input
                id="bot3-cap-pct"
                type="text"
                inputMode="numeric"
                value={pctDraft}
                onChange={e => {
                  const clean = e.target.value.replace(/[^0-9]/g, '');
                  setPctDraft(clean);
                  const n = Number(clean);
                  if (clean !== '' && n >= 1) {
                    setCapitalUsedPctManual(Math.min(100, n));
                  }
                }}
                onBlur={() => {
                  const n = Math.min(100, Math.max(1, Number(pctDraft) || 1));
                  setCapitalUsedPctManual(n);
                  setPctDraft(String(n));
                }}
                className="w-16 px-2 py-1 rounded-lg bg-[#100926] border border-[#8B5CF6]/60 text-right font-mono-num font-black text-white text-sm focus:outline-none"
              />
              <span className="font-black text-purple-200">%</span>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-1">
            {[10, 25, 50, 75, 100].map(pct => (
              <button
                key={pct}
                type="button"
                onClick={() => setCapitalUsedPctManual(pct)}
                className={`py-1 rounded-lg text-[10px] font-mono-num font-black border transition ${
                  state.capitalUsedPct === pct
                    ? 'bg-[#7C3AED] border-purple-300 text-white'
                    : 'bg-[#100926] border-purple-500/30 text-purple-300'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>
          <span className="text-[10px] font-mono-num text-emerald-300 block">
            {state.capitalUsedPct}% du Capital = {Math.round((state.capitalAr * state.capitalUsedPct) / 100).toLocaleString('fr-FR')} Ar
          </span>
        </div>
      </div>

      {/* ================================================================
          2. BOÎTES MODIFIABLES MANUELLEMENT + GRAND BOUTON ON / OFF
         ================================================================ */}
      <div className="p-3.5 rounded-2xl bg-[#150D2E] border border-purple-500/40 space-y-3">
        {/* INVESTISSEMENT + BOUTON MAX */}
        <div className="p-2.5 rounded-xl bg-[#1D1240] border border-purple-500/35 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="bot3-invest-input" className="text-[11px] font-black text-purple-200">
              INVESTISSEMENT (Ar — utilisé EN ENTIER)
            </label>
            <span className="text-[10px] font-mono-num text-emerald-300 font-bold">
              {state.usePercentStakeMode ? `Auto ${state.capitalUsedPct}% Capital` : 'Montant entier'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center bg-[#100926] border border-[#8B5CF6]/60 rounded-xl px-3 py-2">
              <input
                id="bot3-invest-input"
                type="text"
                inputMode="numeric"
                value={investDraft}
                onChange={e => {
                  const clean = e.target.value.replace(/[^0-9]/g, '');
                  setInvestDraft(clean);
                  if (clean !== '') {
                    setInvestmentManual(Number(clean));
                  }
                }}
                onBlur={() => {
                  if (investDraft === '') {
                    setInvestmentManual(0);
                    setInvestDraft('0');
                  }
                }}
                className="w-full bg-transparent text-white font-mono-num font-black text-base focus:outline-none"
              />
              <span className="text-xs font-black text-purple-300 ml-1.5">Ar</span>
            </div>
            <button
              type="button"
              onClick={applyMaxPercentInvestment}
              className="px-4 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] border border-purple-300/60 text-white font-black text-xs whitespace-nowrap shrink-0 active:scale-95 transition"
            >
              MAX ({state.capitalUsedPct}%)
            </button>
          </div>
          <span className="text-[10px] text-purple-300 font-mono-num block">
            Par trade : <strong className="text-white">{effectiveStakeAr.toLocaleString('fr-FR')} Ar EN ENTIER</strong>
          </span>
        </div>

        {/* LEVIER + BOUTON ACTIVER / DÉSACTIVER */}
        <div className="p-2.5 rounded-xl bg-[#1D1240] border border-purple-500/35 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="bot3-lev-input" className="text-[11px] font-black text-purple-200">
              LEVIER (x1 à x100)
            </label>
            <span className="text-[10px] font-mono-num font-bold text-purple-300">
              Effectif : <strong className="text-white">x{effectiveLeverage}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center bg-[#100926] border border-[#8B5CF6]/60 rounded-xl px-3 py-2">
              <span className="text-sm font-black text-purple-300 mr-1">x</span>
              <input
                id="bot3-lev-input"
                type="text"
                inputMode="numeric"
                disabled={!state.leverageEnabled}
                value={state.leverageEnabled ? levDraft : '1'}
                onChange={e => {
                  const clean = e.target.value.replace(/[^0-9]/g, '');
                  setLevDraft(clean);
                  const n = Number(clean);
                  if (clean !== '' && n >= 1) {
                    setLeverageManual(Math.min(100, n));
                  }
                }}
                onBlur={() => {
                  const n = Math.min(100, Math.max(1, Number(levDraft) || 1));
                  setLeverageManual(n);
                  setLevDraft(String(n));
                }}
                className="w-full bg-transparent text-white font-mono-num font-black text-base focus:outline-none disabled:opacity-50"
              />
            </div>
            <button
              type="button"
              onClick={toggleLeverageEnabled}
              className={`px-3.5 py-2.5 rounded-xl font-black text-xs whitespace-nowrap shrink-0 border transition ${
                state.leverageEnabled
                  ? 'bg-emerald-600/30 border-emerald-400 text-emerald-300'
                  : 'bg-rose-600/25 border-rose-400/70 text-rose-300'
              }`}
            >
              {state.leverageEnabled ? 'ACTIVER : ON' : 'DÉSACTIVER (x1)'}
            </button>
          </div>
        </div>

        {/* PROFIT MAX (<=30% FIXE) & STOP LOSS */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-xl bg-[#1D1240] border border-purple-500/35 space-y-1">
            <label htmlFor="bot3-profit-input" className="text-[10px] font-black text-emerald-300 block">
              PROFIT MAX / JOUR (≤ 30%)
            </label>
            <div className="flex items-center bg-[#100926] border border-emerald-500/50 rounded-xl px-2.5 py-1.5">
              <input
                id="bot3-profit-input"
                type="text"
                inputMode="decimal"
                value={profitDraft}
                onChange={e => {
                  const clean = e.target.value.replace(/[^0-9.]/g, '');
                  setProfitDraft(clean);
                  const n = parseFloat(clean);
                  if (!isNaN(n) && n > 0) {
                    setProfitTargetManual(Math.min(30, n));
                  }
                }}
                onBlur={() => {
                  const n = Math.min(30, Math.max(1, parseFloat(profitDraft) || 30));
                  setProfitTargetManual(n);
                  setProfitDraft(String(n));
                }}
                className="w-full bg-transparent text-emerald-300 font-mono-num font-black text-base focus:outline-none"
              />
              <span className="text-xs font-black text-emerald-400">%</span>
            </div>
            <span className="text-[9px] text-purple-300 block">Plafond 30% FIXE</span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#1D1240] border border-purple-500/35 space-y-1">
            <label htmlFor="bot3-sl-input" className="text-[10px] font-black text-rose-300 block">
              STOP LOSS (%)
            </label>
            <div className="flex items-center bg-[#100926] border border-rose-500/50 rounded-xl px-2.5 py-1.5">
              <input
                id="bot3-sl-input"
                type="text"
                inputMode="decimal"
                value={slDraft}
                onChange={e => {
                  const clean = e.target.value.replace(/[^0-9.-]/g, '');
                  setSlDraft(clean);
                  const n = parseFloat(clean);
                  if (!isNaN(n) && Math.abs(n) >= 0.05) {
                    setStopLossManual(n);
                  }
                }}
                onBlur={() => {
                  const n = parseFloat(slDraft);
                  const valid = !isNaN(n) && Math.abs(n) >= 0.05 ? -Math.min(50, Math.abs(n)) : -0.2;
                  setStopLossManual(valid);
                  setSlDraft(String(valid));
                }}
                className="w-full bg-transparent text-rose-300 font-mono-num font-black text-base focus:outline-none"
              />
              <span className="text-xs font-black text-rose-400">%</span>
            </div>
            <span className="text-[9px] text-purple-300 block">Défaut : -0.2%</span>
          </div>
        </div>

        {/* GRAND BOUTON ON / OFF */}
        <button
          type="button"
          onClick={toggleBot3Enabled}
          className={`w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 shadow-lg transition active:scale-[0.99] border-2 ${
            state.enabled
              ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-300 text-white shadow-[0_0_22px_rgba(16,185,129,0.4)]'
              : 'bg-rose-600 hover:bg-rose-500 border-rose-300 text-white shadow-[0_0_18px_rgba(225,29,72,0.3)]'
          }`}
        >
          <Power className="w-5 h-5" />
          <span>
            {state.enabled
              ? 'ON — BOT 3 TRAVAILLE (CLIQUEZ POUR OFF)'
              : 'OFF — DÉMARRER BOT 3 SALOMA'}
          </span>
        </button>
      </div>

      {/* ================================================================
          3. AU MILIEU : AVATAR CARTOON 3D LIVE (REMPLACE LE ROBOT)
         ================================================================ */}
      <Bot3AvatarScene
        mood={avatarMood}
        activeSymbol={activePosition?.symbol || scannedSymbol}
        statusLabel={statusLabel}
        countdownText={countdownText}
        lastPnlAr={state.lastTradePnlAr}
      />

      {/* ================================================================
          4. COURBE — ÉVOLUTION DE L'ARGENT (JUSTE EN DESSOUS DE L'AVATAR)
         ================================================================ */}
      <div className="p-3 rounded-2xl bg-[#150D2E] border border-purple-500/40 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-black text-white">
            Courbe — Évolution du Capital LIVE
          </span>
          <span className={`text-sm font-mono-num font-black ${capitalColorClass}`}>
            {state.capitalAr.toLocaleString('fr-FR')} Ar
          </span>
        </div>

        <div className="h-24 w-full rounded-xl bg-[#0E0722] border border-purple-500/25 p-1.5 relative overflow-hidden">
          <svg viewBox="0 0 300 84" className="w-full h-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="bot3CurveFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={curveStrokeColor} stopOpacity="0.38" />
                <stop offset="100%" stopColor={curveStrokeColor} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <polygon points={svgAreaPoints} fill="url(#bot3CurveFill)" />
            <polyline
              fill="none"
              stroke={curveStrokeColor}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={svgPoints}
            />
          </svg>
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono-num text-purple-300">
          <span>Départ jour : {state.dayStartCapitalAr.toLocaleString('fr-FR')} Ar</span>
          <span className={eqPositive ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
            {eqPositive ? 'Tendance : Profit (Monte)' : 'Tendance : Perte (Descend)'}
          </span>
        </div>
      </div>

      {/* ================================================================
          5. DANS LA BOUGIE — SIGNAL (1..9 VERT / 9..5 ROUGE) + SCAN AUTO COINS
         ================================================================ */}
      <div className="p-3 rounded-2xl bg-[#150D2E] border border-purple-500/40 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-xs font-black text-white block">
              Bougie 1m Signal — {scannedSymbol}/USDT
            </span>
            <span className="text-[10px] font-mono-num text-purple-300">
              Prix : ${formatCoinPrice(liveScannedPrice)} • Limit Order Seulement
            </span>
          </div>
          {latestCandle?.signalStep && (
            <span
              className={`text-[11px] font-mono-num font-black ${
                latestCandle.signalDir === 'up' ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {latestCandle.signalDir === 'up'
                ? `Signal ↑ ${latestCandle.signalStep}/9`
                : `Signal ↓ ${latestCandle.signalStep} VEND!`}
            </span>
          )}
        </div>

        {/* Live 1m Candlestick SVG with numbers 1..9 / 9..5 INSIDE candles */}
        <div className="h-36 w-full rounded-xl bg-[#0E0722] border border-purple-500/25 p-2 relative overflow-hidden">
          <svg viewBox="0 0 324 128" className="w-full h-full" preserveAspectRatio="none">
            {scannedCandles.map((c, idx) => {
              const slotW = 18;
              const x = idx * slotW + 2;
              const scaleY = (v: number) => 114 - ((v - candleLow) / candleRange) * 96;
              const yOpen = scaleY(c.open);
              const yClose = scaleY(c.close);
              const rectY = Math.min(yOpen, yClose);
              const rectH = Math.max(14, Math.abs(yClose - yOpen));
              const color = c.isUp ? '#10B981' : '#EF4444';

              return (
                <g key={`${scannedSymbol}-${idx}`}>
                  <line
                    x1={x + 6.5}
                    y1={scaleY(c.high)}
                    x2={x + 6.5}
                    y2={scaleY(c.low)}
                    stroke={color}
                    strokeWidth="1.4"
                  />
                  <rect
                    x={x}
                    y={Math.min(98, rectY)}
                    width="13"
                    height={rectH}
                    rx="2"
                    fill={color}
                    opacity="0.92"
                  />
                  {c.signalStep !== null && (
                    <text
                      x={x + 6.5}
                      y={Math.min(98, rectY) + rectH / 2 + 3.2}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="9"
                      fontWeight="900"
                      fontFamily="monospace"
                    >
                      {c.signalStep}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {activePosition && (
          <div className="p-2 rounded-xl bg-[#1D1240] border border-emerald-500/50 flex items-center justify-between text-[11px] font-mono-num">
            <div>
              <span className="text-emerald-300 font-black block">
                LIMIT BUY {activePosition.symbol}/USDT (x{activePosition.leverage})
              </span>
              <span className="text-purple-200 text-[10px]">
                Entrée ${formatCoinPrice(activePosition.entryPrice)} → ${formatCoinPrice(activePosition.currentPrice)}
              </span>
            </div>
            <span className={`font-black ${activePosition.pnlAr >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {activePosition.pnlPct >= 0 ? '+' : ''}
              {activePosition.pnlPct.toFixed(2)}% ({activePosition.pnlAr >= 0 ? '+' : ''}
              {activePosition.pnlAr.toLocaleString('fr-FR')} Ar)
            </span>
          </div>
        )}

        {/* Méthode d'investissement — Liste Coins (100% choix du Robot) */}
        <div className="pt-1 border-t border-purple-500/20 space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-bold text-purple-200">
              Méthode d’investissement : Scan 100% Automatique
            </span>
            <span className="text-purple-400">Max {maxTradesPerCoinDay} Trades / Coin / Jour</span>
          </div>

          <div className="p-2 rounded-xl bg-[#100926] border border-purple-500/30 space-y-1">
            <span className="text-[10px] font-bold text-purple-200 block">
              Limite aujourd’hui (Collection TRADE Appwrite) :
            </span>
            <p className="text-[11px] font-mono-num font-black text-white leading-relaxed">
              {trackedLimitSymbols.slice(0, 6).map((sym, idx) => {
                const cnt = Math.min(maxTradesPerCoinDay, coinTradesToday[sym] || 0);
                const reached = cnt >= maxTradesPerCoinDay;
                return (
                  <React.Fragment key={sym}>
                    {idx > 0 && <span className="text-purple-400"> - </span>}
                    <span className={reached ? 'text-rose-400' : cnt > 0 ? 'text-emerald-400' : 'text-purple-100'}>
                      {sym} : {cnt}/{maxTradesPerCoinDay}
                    </span>
                  </React.Fragment>
                );
              })}
            </p>
            {pausedLimitCoins.length > 0 && (
              <div className="text-[10px] font-black text-amber-300">
                {pausedLimitCoins.join(', ')} : LIMITE 3/3 ATTEINTE - Pause pour ce Coin
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 text-[10px] font-mono-num">
            {topScannedPreviewCoins.map(c => {
              const sym = c.symbol.toUpperCase();
              const isSelectedByBot = sym === scannedSymbol;
              const usedCount = Math.min(maxTradesPerCoinDay, coinTradesToday[sym] || 0);
              const isPaused = usedCount >= maxTradesPerCoinDay;
              return (
                <span
                  key={c.id}
                  className={
                    isPaused
                      ? 'text-rose-400 font-black line-through'
                      : isSelectedByBot
                      ? 'text-emerald-400 font-black underline'
                      : 'text-purple-300/75'
                  }
                  title={isPaused ? 'LIMITE ATTEINTE - Pause' : `${sym} : ${usedCount}/${maxTradesPerCoinDay}`}
                >
                  {sym} ({usedCount}/{maxTradesPerCoinDay})
                  {isPaused ? ' PAUSE' : ''}
                </span>
              );
            })}
            <span className="text-purple-400">... ({coins.length} coins)</span>
          </div>
        </div>
      </div>

      {/* ================================================================
          6. TOUT EN BAS : HISTORIQUE — DÉTAILS DU TRAVAIL + BOUTON EFFACER
         ================================================================ */}
      <div className="p-3.5 rounded-2xl bg-[#150D2E] border border-purple-500/40 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-black text-white">
            HISTORIQUE — Détails du Travail ({state.history.length})
          </span>
          <button
            type="button"
            onClick={clearHistory}
            disabled={state.history.length === 0}
            className="px-3 py-1.5 rounded-xl bg-rose-600/25 hover:bg-rose-600/40 border border-rose-500/60 text-rose-200 font-black text-[10px] inline-flex items-center gap-1 disabled:opacity-40 transition"
          >
            <Trash2 className="w-3 h-3" />
            <span>EFFACER</span>
          </button>
        </div>

        {state.history.length === 0 ? (
          <div className="py-4 text-center text-[11px] text-purple-300/75 border border-purple-500/20 rounded-xl">
            Aucun trade BOT 3 enregistré. Activez ON pour lancer le Robot.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
            {state.history.map(item => {
              const win = item.pnlAr >= 0;
              const dt = new Date(item.timestamp);
              const dateStr = dt.toLocaleDateString('fr-FR');
              const timeStr = dt.toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              });
              const reasonText =
                item.reason === 'TP'
                  ? 'TP Objectif'
                  : item.reason === 'SIGNAL_DOWN'
                  ? 'Signal 9..5'
                  : 'Stop Loss';

              return (
                <div
                  key={item.id}
                  className="p-2.5 rounded-xl bg-[#1D1240] border border-purple-500/25 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-white text-xs">
                        {item.symbol}/USDT
                      </span>
                      <span className="text-[10px] font-mono-num text-purple-300">
                        x{item.leverage} · {item.amountAr.toLocaleString('fr-FR')} Ar
                      </span>
                    </div>
                    <span className="text-[10px] text-purple-400 font-mono-num block">
                      {dateStr} {timeStr} · {reasonText} (Limit)
                    </span>
                  </div>

                  <div className="text-right shrink-0 font-mono-num">
                    <span className={`font-black text-xs block ${win ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {item.pnlPct >= 0 ? '+' : ''}
                      {item.pnlPct.toFixed(2)}%
                    </span>
                    <span className={`font-bold text-[11px] block ${win ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {item.pnlAr >= 0 ? '+' : ''}
                      {item.pnlAr.toLocaleString('fr-FR')} Ar
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="pt-1 border-t border-purple-500/20 flex items-center gap-1.5 text-[10px] text-purple-300">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          <span>
            3 pertes de suite = Dort 30 min (réveil auto) · Profit 30% = Dort jusqu’à 00:00H (réveil auto).
          </span>
        </div>
      </div>
    </div>
  );
};
