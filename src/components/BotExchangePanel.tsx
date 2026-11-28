import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  History,
  Play,
  RefreshCw,
  Search,
  Square,
  Trash2
} from 'lucide-react';
import type { useBotExchangeEngine } from '../hooks/useBotExchangeEngine.ts';
import { BotExchangeAvatarScene } from './BotExchangeAvatarScene.tsx';

type BotExchangeEngineReturn = ReturnType<typeof useBotExchangeEngine>;

interface BotExchangePanelProps {
  engine: BotExchangeEngineReturn;
  formatCoinPrice: (price: number) => string;
}

const QUICK_PERCENTS = [10, 20, 30, 50, 100] as const;

export const BotExchangePanel: React.FC<BotExchangePanelProps> = ({
  engine,
  formatCoinPrice
}) => {
  const {
    pairs,
    pairsLoading,
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
    maxExchanges,
    totalProfitUsd,
    totalProfitAr,
    totalLossUsd,
    totalLossAr,
    position,
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
    refreshMarket
  } = engine;

  const [viewMode, setViewMode] = useState<'main' | 'history'>('main');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [entryDraft, setEntryDraft] = useState<string>(String(entryDropPct));
  const [exitDraft, setExitDraft] = useState<string>(String(exitGainPct));

  useEffect(() => {
    setEntryDraft(String(entryDropPct));
  }, [entryDropPct]);

  useEffect(() => {
    setExitDraft(String(exitGainPct));
  }, [exitGainPct]);

  const filteredPairs = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    if (!q) return pairs;
    return pairs.filter(
      p => p.symbol.includes(q) || p.pair.includes(q)
    );
  }, [pairs, searchQuery]);

  const focusedTicker = useMemo(
    () => pairs.find(p => p.symbol === focusedSymbol),
    [pairs, focusedSymbol]
  );

  const liveFocusedPrice =
    candles[candles.length - 1]?.close ?? focusedTicker?.price ?? position?.entryPrice ?? 0;

  const candleLow = candles.length
    ? Math.min(...candles.map(c => c.low))
    : Math.max(1e-12, liveFocusedPrice * 0.985);
  const candleHigh = candles.length
    ? Math.max(...candles.map(c => c.high))
    : Math.max(1e-12, liveFocusedPrice * 1.015);
  const candleRange = Math.max(
    candleHigh - candleLow,
    Math.max(1e-12, liveFocusedPrice * 0.002)
  );

  const canStart =
    bybitConnected &&
    bybitUsdtBalance >= 1 &&
    numericAmountUsdt >= 1 &&
    numericAmountUsdt <= bybitUsdtBalance + 1e-6 &&
    watchedPairs.length > 0 &&
    exchangeCount < maxExchanges;

  if (viewMode === 'history') {
    return (
      <div className="space-y-3 text-xs">
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#8B5CF6]/35">
          <button
            type="button"
            onClick={() => setViewMode('main')}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#23154D] border border-[#8B5CF6]/50 text-white font-black text-xs flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour</span>
          </button>
          <span className="font-black text-sm text-white truncate">
            Historique Robot Échange ({history.length})
          </span>
          <button
            type="button"
            onClick={clearHistory}
            disabled={history.length === 0}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-rose-600/85 hover:bg-rose-600 text-white font-black text-xs flex items-center gap-1.5 disabled:opacity-40"
          >
            <Trash2 className="w-4 h-4" />
            <span>Effacer</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded-xl bg-[#150D2E] border border-[#8B5CF6]/35">
            <span className="text-[10px] text-purple-300 block">Échanges faits</span>
            <span className="font-mono-num font-black text-white text-xs">
              {exchangeCount} / {maxExchanges}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-[#150D2E] border border-emerald-500/35">
            <span className="text-[10px] text-purple-300 block">Profit</span>
            <span className="font-mono-num font-black text-emerald-400 text-xs block">
              +${totalProfitUsd.toFixed(2)}
            </span>
            <span className="font-mono-num text-[10px] text-emerald-300">
              +{totalProfitAr.toLocaleString('fr-FR')} Ar
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-[#150D2E] border border-rose-500/35">
            <span className="text-[10px] text-purple-300 block">Perte</span>
            <span className="font-mono-num font-black text-rose-400 text-xs block">
              -${totalLossUsd.toFixed(2)}
            </span>
            <span className="font-mono-num text-[10px] text-rose-300">
              -{totalLossAr.toLocaleString('fr-FR')} Ar
            </span>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="p-6 rounded-2xl bg-[#150D2E] border border-purple-500/25 text-center text-purple-300">
            Aucun échange enregistré pour le moment.
          </div>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-0.5">
            {history.map(item => {
              const isGain = item.pnlUsd >= 0;
              const dt = new Date(item.timestamp);
              return (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-[#150D2E] border border-[#8B5CF6]/35 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-white text-xs">
                      {item.actionType === 'BUY'
                        ? `BUY ${item.buyCoin}`
                        : `${item.buyCoin} → ${item.exchangeCoin}`}
                    </span>
                    <span className="text-[10px] font-mono-num text-purple-300">
                      {dt.toLocaleDateString('fr-FR')} ·{' '}
                      {dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono-num text-purple-200">
                    <span>
                      Entrée : ${formatCoinPrice(item.entryPrice)}
                      {item.exitPrice ? ` · Sortie : $${formatCoinPrice(item.exitPrice)}` : ''}
                    </span>
                    <span className={`font-black ${isGain ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {item.actionType === 'BUY'
                        ? `${item.amountUsdt.toFixed(2)} USDT`
                        : `${isGain ? '+' : ''}$${item.pnlUsd.toFixed(2)} (${isGain ? '+' : ''}${item.pnlAr.toLocaleString('fr-FR')} Ar)`}
                    </span>
                  </div>
                  <div className="text-[10px] text-purple-300/85">{item.note}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3.5 text-xs">
      {/* HEADER */}
      <div className="flex items-center justify-between gap-2 pb-1 border-b border-[#8B5CF6]/35">
        <div className="min-w-0">
          <span className="font-black text-sm text-white block truncate">
            2. ROBOT ÉCHANGE (Spot Bybit)
          </span>
          <span className="text-[10px] text-purple-300 block truncate">
            Spot uniquement (Conversion interdite) · Signal FORT requis · Stop Loss -2%
          </span>
        </div>
        <button
          type="button"
          onClick={() => setViewMode('history')}
          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#23154D] border border-[#8B5CF6]/55 text-white font-black text-[11px] flex items-center gap-1.5 shrink-0"
        >
          <History className="w-3.5 h-3.5 text-emerald-400" />
          <span>Historique ({history.length})</span>
        </button>
      </div>

      {/* 1. SOLDE BYBIT RÉEL + INVESTISSEMENT SYNCHRONISÉ */}
      <div className="p-3.5 rounded-2xl bg-[#150D2E] border-2 border-[#8B5CF6]/55 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-[11px] font-bold text-purple-300 block">
              Solde Bybit Réel
            </span>
            <span className="font-mono-num font-black text-lg text-white">
              {bybitCapitalAr.toLocaleString('fr-FR')} Ar
            </span>
            <span className="font-mono-num text-[11px] text-emerald-300 block">
              {bybitUsdtBalance.toFixed(2)} USDT
              {!bybitConnected && bybitError ? ` · ${bybitError}` : ''}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void refreshMarket()}
            className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-[#23154D] border border-[#8B5CF6]/45 text-purple-200 hover:text-white flex items-center justify-center"
            title="Actualiser solde et prix Bybit"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* CHOIX RAPIDE % */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-purple-300">Choix rapide (% du solde)</span>
            <span className="font-mono-num font-black text-emerald-300">
              {syncedPercent}% utilisé
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {QUICK_PERCENTS.map(pct => {
              const active = activePercentPreset === pct;
              return (
                <button
                  key={pct}
                  type="button"
                  onClick={() => applyPercentPreset(pct)}
                  className={`min-h-[44px] rounded-xl border font-mono-num font-black text-xs transition ${
                    active
                      ? 'bg-[#7C3AED] border-emerald-400 text-white shadow-[0_0_10px_rgba(16,185,129,0.25)]'
                      : 'bg-[#100926] border-purple-500/35 text-purple-200 hover:border-[#8B5CF6]'
                  }`}
                >
                  {pct}%
                </button>
              );
            })}
          </div>
        </div>

        {/* MONTANT MANUEL SYNCHRONISÉ DANS LES DEUX SENS */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <label htmlFor="bot-exchange-amount-ar" className="font-bold text-purple-300">
              Montant à utiliser (Ar) · Min Bybit : 1 USDT
            </label>
            <span className="font-mono-num text-[11px] font-bold text-emerald-300">
              ≈ {numericAmountUsdt.toFixed(2)} USDT
            </span>
          </div>
          <input
            id="bot-exchange-amount-ar"
            type="text"
            inputMode="numeric"
            value={amountArInput}
            onChange={e => setAmountManualAr(e.target.value)}
            placeholder="Ex: 4000"
            className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#100926] border-2 border-[#8B5CF6]/45 text-white font-mono-num font-black text-sm focus:outline-none focus:border-emerald-400"
          />
          {numericAmountUsdt < 1 && (
            <p className="text-[11px] font-bold text-amber-300 pt-0.5">
              Minimum Bybit : 1 USDT requis pour démarrer ({Math.ceil(4750).toLocaleString('fr-FR')} Ar).
            </p>
          )}
        </div>
      </div>

      {/* 2. AU-DESSUS DE LA BOUGIE : COMPTEUR 300 MAX + PROFIT USD/AR + PERTE + PARAMÈTRES ÉDITABLES */}
      <div className="p-3.5 rounded-2xl bg-[#150D2E] border border-[#8B5CF6]/50 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 rounded-xl bg-[#100926] border border-purple-500/30">
            <span className="text-[10px] text-purple-300 block">Échanges</span>
            <span className="font-mono-num font-black text-white text-sm">
              {exchangeCount} / {maxExchanges}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-[#100926] border border-emerald-500/35">
            <span className="text-[10px] text-purple-300 block">Profit</span>
            <span className="font-mono-num font-black text-emerald-400 text-xs block">
              +${totalProfitUsd.toFixed(2)}
            </span>
            <span className="font-mono-num text-[10px] text-emerald-300">
              +{totalProfitAr.toLocaleString('fr-FR')} Ar
            </span>
          </div>
          <div className="p-2 rounded-xl bg-[#100926] border border-rose-500/35">
            <span className="text-[10px] text-purple-300 block">Perte</span>
            <span className="font-mono-num font-black text-rose-400 text-xs block">
              -${totalLossUsd.toFixed(2)}
            </span>
            <span className="font-mono-num text-[10px] text-rose-300">
              -{totalLossAr.toLocaleString('fr-FR')} Ar
            </span>
          </div>
        </div>

        {/* PARAMÈTRES DIRECTEMENT AU-DESSUS DE LA BOUGIE */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label
              htmlFor="bot-exchange-entry-pct"
              className="text-[10px] font-bold text-purple-300 block mb-1"
            >
              Entrée Buy (% baisse)
            </label>
            <div className="flex items-center rounded-xl bg-[#100926] border border-[#8B5CF6]/45 px-2.5">
              <input
                id="bot-exchange-entry-pct"
                type="number"
                step="0.5"
                value={entryDraft}
                onChange={e => {
                  const val = e.target.value;
                  setEntryDraft(val);
                  const n = Number(val);
                  if (Number.isFinite(n) && n !== 0) {
                    setEntryDropPct(-Math.min(25, Math.max(0.2, Math.abs(n))));
                  }
                }}
                className="w-full min-h-[40px] bg-transparent text-white font-mono-num font-black text-xs focus:outline-none"
              />
              <span className="text-purple-300 font-bold text-xs">%</span>
            </div>
          </div>

          <div>
            <label
              htmlFor="bot-exchange-exit-pct"
              className="text-[10px] font-bold text-purple-300 block mb-1"
            >
              Échange / Sortie (% gain)
            </label>
            <div className="flex items-center rounded-xl bg-[#100926] border border-[#8B5CF6]/45 px-2.5">
              <input
                id="bot-exchange-exit-pct"
                type="number"
                step="0.5"
                value={exitDraft}
                onChange={e => {
                  const val = e.target.value;
                  setExitDraft(val);
                  const n = Number(val);
                  if (Number.isFinite(n) && n > 0) {
                    setExitGainPct(Math.min(30, Math.max(0.2, Math.abs(n))));
                  }
                }}
                className="w-full min-h-[40px] bg-transparent text-emerald-300 font-mono-num font-black text-xs focus:outline-none"
              />
              <span className="text-emerald-300 font-bold text-xs">%</span>
            </div>
          </div>
        </div>

        {/* BOUGIE EN DIRECT + FORCE DU SIGNAL */}
        <div className="p-2.5 rounded-xl bg-[#100926] border border-purple-500/30 space-y-2">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="font-black text-white truncate">
              Bougie Spot · {focusedSymbol}/USDT
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={`px-2 py-0.5 rounded-md font-black text-[10px] border ${
                  signalStrength === 'FORT'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : signalStrength === 'MOYEN'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-rose-500/20 border-rose-400 text-rose-300'
                }`}
              >
                Signal : {signalStrength}
              </span>
              <span className="font-mono-num font-black text-emerald-300">
                ${formatCoinPrice(liveFocusedPrice)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-purple-300 px-0.5">
            <span>
              Mode : <strong className="text-emerald-300">SPOT BYBIT</strong> ·{' '}
              <span className="text-rose-300">Conversion interdite</span>
            </span>
            <span>
              {preparedCoin ? (
                <strong className="text-emerald-300">
                  Prêt : {preparedCoin.symbol} ({preparedCoin.signalStrength})
                </strong>
              ) : (
                'Trade sur FORT uniquement'
              )}
            </span>
          </div>

          <div className="w-full h-36 bg-[#0B061B] rounded-lg border border-purple-500/20 p-1.5">
            {candles.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-[11px] text-purple-300">
                Chargement des bougies Bybit Spot...
              </div>
            ) : (
              <svg viewBox="0 0 320 110" className="w-full h-full">
                {position && position.symbol === focusedSymbol && (
                  <line
                    x1="0"
                    x2="320"
                    y1={Math.max(
                      4,
                      Math.min(
                        106,
                        102 - ((position.entryPrice - candleLow) / candleRange) * 94
                      )
                    )}
                    y2={Math.max(
                      4,
                      Math.min(
                        106,
                        102 - ((position.entryPrice - candleLow) / candleRange) * 94
                      )
                    )}
                    stroke="#FBBF24"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                )}
                {candles.slice(-32).map((c, idx, arr) => {
                  const slotW = 310 / Math.max(1, arr.length);
                  const xCenter = 5 + idx * slotW + slotW / 2;
                  const bodyW = Math.max(3, slotW * 0.62);
                  const isUp = c.close >= c.open;
                  const color = isUp ? '#10B981' : '#F43F5E';
                  const yHigh = 102 - ((c.high - candleLow) / candleRange) * 94;
                  const yLow = 102 - ((c.low - candleLow) / candleRange) * 94;
                  const yOpen = 102 - ((c.open - candleLow) / candleRange) * 94;
                  const yClose = 102 - ((c.close - candleLow) / candleRange) * 94;
                  const bodyTop = Math.min(yOpen, yClose);
                  const bodyH = Math.max(2, Math.abs(yOpen - yClose));
                  return (
                    <g key={c.time + '-' + idx}>
                      <line
                        x1={xCenter}
                        x2={xCenter}
                        y1={yHigh}
                        y2={yLow}
                        stroke={color}
                        strokeWidth="1.2"
                      />
                      <rect
                        x={xCenter - bodyW / 2}
                        y={bodyTop}
                        width={bodyW}
                        height={bodyH}
                        rx="1"
                        fill={color}
                      />
                    </g>
                  );
                })}
              </svg>
            )}
          </div>

          {position && (
            <div className="flex items-center justify-between text-[10px] font-mono-num text-amber-300 px-1">
              <span>Position active : {position.symbol}/USDT @ ${formatCoinPrice(position.entryPrice)}</span>
              <span>{position.amountUsdt.toFixed(2)} USDT</span>
            </div>
          )}
        </div>

        {/* 3. ANIMATION SOUS LA BOUGIE */}
        <BotExchangeAvatarScene
          mood={mood}
          activeSymbol={position?.symbol || focusedSymbol}
          statusLabel={statusLabel}
          countdownText={countdownText}
        />

        {startError && (
          <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/45 text-rose-200 text-[11px] font-bold">
            {startError}
          </div>
        )}

        {/* BOUTON DÉMARRER / ARRÊTER */}
        <button
          type="button"
          onClick={enabled ? stopRobot : startRobot}
          disabled={!enabled && !canStart}
          className={`w-full min-h-[48px] py-3 rounded-xl font-black text-xs shadow flex items-center justify-center gap-2 transition active:scale-[0.98] ${
            enabled
              ? 'bg-rose-600 hover:bg-rose-500 text-white'
              : 'bg-gradient-to-r from-emerald-600 to-[#7C3AED] text-white disabled:opacity-45 disabled:cursor-not-allowed'
          }`}
        >
          {enabled ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          <span>{enabled ? 'ARRÊTER ROBOT ÉCHANGE' : 'DÉMARRER ROBOT ÉCHANGE'}</span>
        </button>
      </div>

      {/* 4. RECHERCHE + LISTE DE TOUTES LES PAIRES BYBIT (MULTI-SÉLECTION) */}
      <div className="p-3.5 rounded-2xl bg-[#150D2E] border border-[#8B5CF6]/45 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="font-black text-white text-xs">
            Paires Bybit Spot ({pairs.length}) · Surveillées : {watchedPairs.length}
          </span>
          <span className="text-[10px] text-purple-300">Choix multiple</span>
        </div>

        {/* BARRE DE RECHERCHE */}
        <div className="relative">
          <Search className="w-4 h-4 text-purple-300 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher une coin / paire (PEPE, DOGE, SOL...)"
            className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl bg-[#100926] border border-[#8B5CF6]/45 text-white text-xs focus:outline-none focus:border-emerald-400"
          />
        </div>

        {/* PAIRES ACTUELLEMENT SURVEILLÉES */}
        {watchedPairs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {watchedPairs.map(sym => {
              const sig = watchedSignals.find(w => w.symbol === sym)?.signalStrength;
              return (
                <div
                  key={sym}
                  className={`min-h-[36px] rounded-lg border text-[11px] font-black flex items-center transition ${
                    focusedSymbol === sym
                      ? 'bg-[#7C3AED] border-emerald-400 text-white'
                      : 'bg-[#1D1240] border-purple-500/40 text-purple-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setFocusedSymbol(sym)}
                    className="px-2.5 py-1 text-left flex items-center gap-1"
                  >
                    <span>{sym}/USDT</span>
                    {sig && (
                      <span
                        className={`text-[9px] font-black px-1 rounded ${
                          sig === 'FORT'
                            ? 'bg-emerald-500/25 text-emerald-300'
                            : sig === 'MOYEN'
                            ? 'bg-amber-500/25 text-amber-300'
                            : 'bg-rose-500/25 text-rose-300'
                        }`}
                      >
                        {sig}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label={`Retirer ${sym}`}
                    onClick={() => toggleWatchedPair(sym)}
                    className="pr-2 pl-1 py-1 text-purple-200 hover:text-rose-300 font-bold"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* LISTE SCROLLABLE DES PAIRES BYBIT EN DIRECT */}
        <div className="max-h-60 overflow-y-auto divide-y divide-purple-500/15 rounded-xl bg-[#100926] border border-purple-500/25">
          {pairsLoading && filteredPairs.length === 0 ? (
            <div className="p-4 text-center text-purple-300 text-xs">
              Chargement des paires Bybit en direct...
            </div>
          ) : filteredPairs.length === 0 ? (
            <div className="p-4 text-center text-purple-300 text-xs">
              Aucune paire trouvée pour « {searchQuery} ».
            </div>
          ) : (
            filteredPairs.slice(0, 120).map(item => {
              const selected = watchedPairs.includes(item.symbol);
              const isPos = item.change24hPct >= 0;
              return (
                <button
                  key={item.symbol}
                  type="button"
                  onClick={() => {
                    toggleWatchedPair(item.symbol);
                    setFocusedSymbol(item.symbol);
                  }}
                  className={`w-full min-h-[52px] px-3 py-2 flex items-center justify-between gap-2 text-left transition ${
                    selected ? 'bg-[#251552]/70' : 'hover:bg-[#190F38]'
                  }`}
                >
                  <div className="min-w-0">
                    <span className="font-black text-white text-xs block truncate">
                      {item.pair}
                    </span>
                    <span className="font-mono-num text-[11px] text-purple-200">
                      ${formatCoinPrice(item.price)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span
                      className={`font-mono-num font-bold text-[11px] ${
                        isPos ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isPos ? '+' : ''}
                      {item.change24hPct.toFixed(2)}%
                    </span>
                    <span
                      className={`w-6 h-6 rounded-lg border flex items-center justify-center ${
                        selected
                          ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300'
                          : 'bg-[#150D2E] border-purple-500/40 text-purple-400'
                      }`}
                    >
                      {selected ? <Check className="w-3.5 h-3.5" /> : '+'}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
