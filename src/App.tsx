/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * SALOMA - Crypto Exchange & Trading Platform (Style Binance Pro)
 * Backend: Appwrite Auth, TablesDB & Realtime via /api/*
 * Colors: Violet Brillant #7C3AED, #8B5CF6, Fond Sombre #150D2E
 * Mobile-First, Français (Malagasy)
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  Repeat,
  Gift,
  Users,
  ShieldCheck,
  Copy,
  Check,
  ArrowLeft,
  X,
  Lock,
  AlertTriangle,
  BarChart2,
  Zap,
  HelpCircle,
  User,
  Layers,
  Activity,
  ArrowRightLeft,
  Server,
  Search,
  ChevronDown,
  Send,
  RefreshCw,
  BookOpen,
  Info,
  Play,
  Video,
  Share2,
  Megaphone,
  MessageSquare,
  Phone,
  Eye,
  EyeOff,
  Bell,
  Mail,
  KeyRound,
  LogOut,
  Clock,
  Bot,
  ArrowUpDown,
  Square,
  Trash2
} from 'lucide-react';
import {
  PWAInstallButton,
  OfflineIndicator,
  useOnlineStatus,
  checkInternetConnectivity
} from './components/PWAInstall.tsx';
import { TurnstileWidget, TURNSTILE_FALLBACK_TOKEN } from './components/TurnstileWidget.tsx';
import {
  AdminWalletView,
  type AdminWalletRow,
  type AdminWalletTxRow
} from './components/AdminWalletView.tsx';
import { Bot3Panel } from './components/Bot3Panel.tsx';
import {
  useBot3Engine,
  getLocalDayKey,
  type Bot3TradeRecord
} from './hooks/useBot3Engine.ts';
import { BotExchangePanel } from './components/BotExchangePanel.tsx';
import { useBotExchangeEngine } from './hooks/useBotExchangeEngine.ts';
import {
  Coin,
  BackendPublicCoin,
  ApiProviderStatus,
  PublicSalomaFees,
  DEFAULT_PUBLIC_SALOMA_FEES,
  INITIAL_COINS,
  INITIAL_API_PROVIDERS,
  getBlockchainFromNetwork,
  getNetworkShortLabel,
  fetchSalomaMarketPrices,
  mergeSalomaMarketPrices,
  subscribeToPricesWebSocket,
  formatCoinPrice,
  TEST_MIN_USD,
  MIN_DEPOSIT_USD,
  MIN_WITHDRAW_USD,
  MIN_SPOT_USD,
  MIN_LEVIER_USD,
  KYC_LEVEL2_WITHDRAW_THRESHOLD_USD,
  computeMinCoinForUsd,
  formatMinCoinQty,
  isKnownTokenContractAddress,
  resolveWalletAddressForChain,
  deriveProvisionalWalletAddress
} from './services/priceAggregator.ts';
import {
  ENV_CONFIG,
  COOKIE_SESSION_MARKER,
  APPWRITE_CONFIG_MISSING_MSG,
  APPWRITE_CONNECTION_FAILED_MSG,
  hasAppwriteClientConfig,
  apiRequest,
  isApiNotFoundError,
  isTurnstileRetryError,
  directAppwriteLogin,
  directAppwriteRegister,
  directAppwriteGetSession,
  directAppwriteVerifyEmailOtp,
  directAppwriteResendEmailOtp,
  directAppwriteLogout,
  subscribeToNotificationsStream,
  type ApiError
} from './lib/appwrite.ts';

const SESSION_STORAGE_KEY = 'saloma_session_secret';
const USD_TO_MGA = 4750;
const MIN_TRADE_AR = Math.round(MIN_LEVIER_USD * USD_TO_MGA);

// --- APPWRITE DOCUMENT INTERFACES ---

export interface AppwriteUserRow {
  $id: string;
  user_id: string;
  name?: string;
  nom: string;
  prenom?: string;
  email: string;
  telephone: string;
  solde: number;
  code_parrainage: string;
  parrain?: string;
  date_inscription?: string;
  statut?: string;
  email_verifie: boolean;
  kyc_level?: number;
  kyc_cin?: string;
  kyc_adresse?: string;
  kyc_code_postal?: string;
  kyc_statut?: string;
  pays?: string;
  role?: string;
}

export interface AppwriteWalletRow {
  $id: string;
  user_id: string;
  solde_total: number;
  solde_disponible: number;
  solde_bloque: number;
  compte_trade?: number;
  solde_wallet?: number;
  devise: string;
  date_maj?: string;
  coins_json?: string;
}

export interface AppwriteTradeRow {
  $id: string;
  user_id: string;
  paire: string;
  type: 'achat' | 'vente';
  montant: number;
  prix: number;
  profit: number;
  statut: 'en_cours' | 'termine' | 'annule';
  date_creation: string;
  date_cloture?: string;
  leverage?: number;
  close_price?: number;
  mode?: string;
}

export interface AppwriteEchangeRow {
  $id: string;
  user_id: string;
  de_devise: string;
  vers_devise: string;
  montant_envoye: number;
  montant_recu: number;
  taux: number;
  frais: number;
  statut: string;
  date: string;
}

export interface AppwriteDepotRetraitRow {
  $id: string;
  user_id: string;
  type: 'depot' | 'retrait';
  montant: number;
  methode: string;
  numero_compte: string;
  statut: 'en_attente' | 'valide' | 'refuse';
  preuve?: string;
  date: string;
  devise: string;
  frais?: number;
}

export interface AppwriteEarnRow {
  $id: string;
  user_id: string;
  type_gain: string;
  montant: number;
  description: string;
  date: string;
  task_id?: string;
}

export interface AppwriteNotificationRow {
  $id: string;
  user_id: string;
  titre: string;
  message: string;
  type: string;
  lu: boolean;
  date: string;
}

export interface PriceAlertRow {
  id: string;
  userId: string;
  symbol: string;
  direction: 'above' | 'below';
  targetPriceUsd: number;
  createdPriceUsd: number;
  active: boolean;
  triggered: boolean;
  triggeredAt?: string;
  triggeredPriceUsd?: number;
  createdAt: string;
  note?: string;
}

export interface AppwriteProblemRow {
  $id: string;
  user_id: string;
  nom: string;
  email: string;
  telephone: string;
  message: string;
  statut: string;
  date: string;
}

export interface AdminProfitBucket {
  tradeAr: number;
  echangeAr: number;
  retraitAr: number;
  totalAr: number;
}

export interface AdminProfitsSummary {
  jour: AdminProfitBucket;
  semaine: AdminProfitBucket;
  mois: AdminProfitBucket;
  total: AdminProfitBucket;
}

export interface AdminMarketComparisonRow {
  symbol: string;
  name: string;
  bybitPrice: number;
  sponsorPrice?: number;
  marginPct?: number;
  salomaPrice: number;
  clientPrice?: number;
  estimatedFee?: number;
  estimatedNetProfit?: number;
  spreadDiff: number;
  spreadPct: number;
  bybitHiddenFeePct: number;
  change24h: number;
}

export interface AdminApiProviderEntry {
  id: 'bybit' | 'okx' | 'binance';
  label: string;
  enabled: boolean;
  isPrimary: boolean;
  marginPct?: number;
  hasApiKey: boolean;
  apiKeyMasked: string;
  hasSecret: boolean;
  secretMasked: string;
  hasPassphrase?: boolean;
  passphraseMasked?: string;
}

export interface AdminApisConfig {
  primaryApi: 'bybit' | 'okx' | 'binance';
  providers: AdminApiProviderEntry[];
}

export interface AdminLiquidityAlert {
  id: string;
  sponsor: 'BYBIT' | 'OKX' | 'BINANCE';
  side: 'BUY' | 'SELL';
  asset: string;
  pair: string;
  requiredAmount: number;
  availableAmount: number;
  message: string;
  reason: string;
  timestamp: string;
  active: boolean;
}

export interface AdminSalomaFeesConfig {
  bybitRecoveryMarginPct: number;
  tradeFeePct: number;
  exchangeFeePct: number;
  withdrawFeePct: number;
  networkFeeUsdt: number;
  bot3FeeEnabled?: boolean;
}

export interface AdminClientTradeEntry {
  id: string;
  clientId: string;
  pair: string;
  baseSymbol: string;
  side: 'BUY' | 'SELL';
  amountUsdt: number;
  cryptoQty: number;
  entryPrice: number;
  exitPrice: number | null;
  salomaFeePct: number;
  salomaFeeUsdt: number;
  totalDebitedUsdt: number;
  pnlUsdt: number;
  returnedUsdt: number | null;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED_REFUNDED';
  hedgeTradeId: string | null;
  openedAt: string;
  closedAt: string | null;
}

export interface AdminHedgeTradeEntry {
  id: string;
  clientTradeId: string;
  clientId: string;
  exchange: 'BYBIT';
  pair: string;
  side: 'Buy' | 'Sell';
  amountUsdt: number;
  cryptoQty: number;
  bybitEntryOrderId: string | null;
  bybitExitOrderId: string | null;
  bybitEntryPrice: number;
  bybitExitPrice: number | null;
  bybitFeePct: number;
  bybitFeeUsdt: number;
  status: 'PENDING' | 'OPEN' | 'CLOSED' | 'FAILED';
  error?: string;
  openedAt: string;
  closedAt: string | null;
}

export interface AdminExchangeSummary {
  totalBybitLiquidityUsdt: number;
  bybitLiquidityConnected: boolean;
  totalClientsBalanceAr: number;
  totalClientsBalanceUsdt: number;
  totalSalomaFeesUsdt: number;
  totalSalomaFeesAr: number;
  totalBybitFeesPaidUsdt: number;
  clientTrades: AdminClientTradeEntry[];
  hedgeTrades: AdminHedgeTradeEntry[];
}

function parseCoinsJson(raw: unknown): Record<string, number> {
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
    // ignore malformed json
  }
  return {};
}

const VIDEO_TASKS_CATALOG = [
  { id: 'vid-1', title: 'Découverte Sécurité SALOMA', sponsor: 'Partenaire FinTech MG', rewardAr: 2500, durationSec: 5 },
  { id: 'vid-2', title: 'Guide Dépôt & Retrait Crypto', sponsor: 'Sponsor Crypto Pay', rewardAr: 2500, durationSec: 5 },
  { id: 'vid-3', title: 'Stratégie Trading Responsable', sponsor: 'Partenaire Officiel', rewardAr: 2500, durationSec: 5 }
];

const COUNTRY_OPTIONS = [
  { label: 'Madagascar 🇲🇬', dialCode: '+261', placeholder: '38 63 40 354' },
  { label: 'France 🇫🇷', dialCode: '+33', placeholder: '6 12 34 56 78' },
  { label: 'Comores 🇰🇲', dialCode: '+269', placeholder: '321 12 34' },
  { label: 'Maurice 🇲🇺', dialCode: '+230', placeholder: '5 123 4567' },
  { label: 'Seychelles 🇸🇨', dialCode: '+248', placeholder: '2 512 345' },
  { label: 'Réunion 🇷🇪', dialCode: '+262', placeholder: '692 12 34 56' },
  { label: 'Afrique du Sud 🇿🇦', dialCode: '+27', placeholder: '82 123 4567' },
  { label: 'Canada 🇨🇦', dialCode: '+1', placeholder: '514 123 4567' },
  { label: 'USA 🇺🇸', dialCode: '+1', placeholder: '202 555 0123' },
  { label: 'Belgique 🇧🇪', dialCode: '+32', placeholder: '470 12 34 56' },
  { label: 'Suisse 🇨🇭', dialCode: '+41', placeholder: '79 123 45 67' }
];

export default function App() {
  // --- NAVIGATION & AUTH SESSION ---
  const [screen, setScreen] = useState<
    'splash' | 'main' | 'signup' | 'verifyEmail' | 'conditions' | 'privacy' | 'login' | 'forgotPassword' | 'admin'
  >('splash');
  const [privacyReturnScreen, setPrivacyReturnScreen] = useState<'splash' | 'signup' | 'login' | 'main'>('splash');
  const openPrivacyPolicy = useCallback(
    (from: 'splash' | 'signup' | 'login' | 'main') => {
      setPrivacyReturnScreen(from);
      setActiveModal(null);
      setScreen('privacy');
    },
    []
  );
  const [activeTab, setActiveTab] = useState<'earn' | 'trading' | 'exchange' | 'wallet'>('trading');
  const [activeModal, setActiveModal] = useState<
    | null
    | 'deposit'
    | 'withdraw'
    | 'convert'
    | 'kyc'
    | 'profile'
    | 'guide'
    | 'notifications'
    | 'priceAlerts'
    | 'adminUnlock'
    | 'reportProblem'
  >(null);

  const [sessionToken, setSessionToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SESSION_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [bootstrapping, setBootstrapping] = useState<boolean>(Boolean(sessionToken));

  // Logo 4x click for Admin
  const [logoClicks, setLogoClicks] = useState<number>(0);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 3800);
  }, []);

  // Offline / No-Data strict blocking guard
  const { isOnline, setIsOnline } = useOnlineStatus();
  const [offlineBlocked, setOfflineBlocked] = useState<boolean>(false);

  const ensureOnlineOrBlock = useCallback(async (): Promise<boolean> => {
    const ok = await checkInternetConnectivity(3500);
    if (!ok) {
      setIsOnline(false);
      setOfflineBlocked(true);
      return false;
    }
    setIsOnline(true);
    setOfflineBlocked(false);
    return true;
  }, [setIsOnline]);

  const handleRetryConnectivity = useCallback(async (): Promise<boolean> => {
    return ensureOnlineOrBlock();
  }, [ensureOnlineOrBlock]);

  // --- REAL APPWRITE USER & DATABASE STATE ---
  const [appwriteStatusError, setAppwriteStatusError] = useState<string | null>(null);
  const [userRow, setUserRow] = useState<AppwriteUserRow | null>(null);
  const [walletRow, setWalletRow] = useState<AppwriteWalletRow | null>(null);
  const [tradesList, setTradesList] = useState<AppwriteTradeRow[]>([]);
  const [echangesList, setEchangesList] = useState<AppwriteEchangeRow[]>([]);
  const [depotsRetraitsList, setDepotsRetraitsList] = useState<AppwriteDepotRetraitRow[]>([]);
  const [earnList, setEarnList] = useState<AppwriteEarnRow[]>([]);
  const [notificationsList, setNotificationsList] = useState<AppwriteNotificationRow[]>([]);
  const [priceAlertsList, setPriceAlertsList] = useState<PriceAlertRow[]>([]);
  const [userWalletAddresses, setUserWalletAddresses] = useState<Record<string, string>>({});

  const [displayCurrency, setDisplayCurrency] = useState<'MGA' | 'USD'>('MGA');

  // Derived wallet values from Appwrite (strictly 0 when empty)
  // soldeDisponibleAr = WALLET (argent déposé / retirable)
  // soldeCompteTradeAr = COMPTE TRADE (solde pour trader)
  const soldeDisponibleAr = Number(walletRow?.solde_disponible) || 0;
  const soldeCompteTradeAr = Number(walletRow?.compte_trade) || 0;
  const soldeBloqueAr = Number(walletRow?.solde_bloque) || 0;
  const soldeTotalAr =
    Number(walletRow?.solde_total) || soldeDisponibleAr + soldeCompteTradeAr + soldeBloqueAr;
  const coinsJson = useMemo(() => parseCoinsJson(walletRow?.coins_json), [walletRow?.coins_json]);

  const unreadNotificationsCount = useMemo(
    () => notificationsList.filter(n => !n.lu).length,
    [notificationsList]
  );
  const activePriceAlertsCount = useMemo(
    () => priceAlertsList.filter(a => a.active && !a.triggered).length,
    [priceAlertsList]
  );

  // --- LIVE CRYPTO PRICES (Pont Broker Actif: Bybit / OKX / Binance via WebSocket) ---
  const [apiProviders, setApiProviders] = useState<ApiProviderStatus[]>(INITIAL_API_PROVIDERS);
  const [activeBrokerExchange, setActiveBrokerExchange] = useState<'BYBIT' | 'OKX' | 'BINANCE'>('BYBIT');
  const [isWsLive, setIsWsLive] = useState<boolean>(false);
  const isWsLiveRef = useRef<boolean>(false);
  const [coins, setCoins] = useState<Coin[]>(INITIAL_COINS);
  const [salomaFees, setSalomaFees] = useState<PublicSalomaFees>(DEFAULT_PUBLIC_SALOMA_FEES);
  const apiProvidersRef = useRef(apiProviders);
  apiProvidersRef.current = apiProviders;

  const [selectedCoinId, setSelectedCoinId] = useState<string>('btc');
  const [isCoinDropdownOpen, setIsCoinDropdownOpen] = useState<boolean>(false);
  const [coinSearchTerm, setCoinSearchTerm] = useState<string>('');

  const selectedCoin = useMemo(() => {
    return coins.find(c => c.id === selectedCoinId) || coins[0];
  }, [coins, selectedCoinId]);

  const filteredCoinsDropdown = useMemo(() => {
    if (!coinSearchTerm.trim()) return coins;
    const q = coinSearchTerm.toLowerCase();
    return coins.filter(c => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  }, [coins, coinSearchTerm]);

  const [selectedWalletCoinId, setSelectedWalletCoinId] = useState<string>('usdt');
  const selectedWalletCoin = useMemo(
    () => coins.find(c => c.id === selectedWalletCoinId) || coins.find(c => c.id === 'usdt') || coins[0],
    [coins, selectedWalletCoinId]
  );
  const [selectedNetworkIndex, setSelectedNetworkIndex] = useState<number>(0);
  const [isWalletCoinDropdownOpen, setIsWalletCoinDropdownOpen] = useState<boolean>(false);
  const [walletCoinSearchTerm, setWalletCoinSearchTerm] = useState<string>('');

  const filteredWalletCoins = useMemo(() => {
    if (!walletCoinSearchTerm.trim()) return coins;
    const q = walletCoinSearchTerm.toLowerCase().trim();
    return coins.filter(
      c =>
        c.symbol.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.symbol.toUpperCase() === 'POL' && 'matic'.includes(q))
    );
  }, [coins, walletCoinSearchTerm]);

  const activeNetwork = selectedWalletCoin.networks[selectedNetworkIndex] || selectedWalletCoin.networks[0];
  const activeBlockchain = getBlockchainFromNetwork(activeNetwork);
  const activeNetworkLabel = getNetworkShortLabel(activeNetwork);
  const activeClientDepositAddress = useMemo(
    () => resolveWalletAddressForChain(userWalletAddresses, activeNetwork.chain, selectedWalletCoin.symbol),
    [userWalletAddresses, activeNetwork.chain, selectedWalletCoin.symbol]
  );
  const provisionalClientDepositAddress = useMemo(
    () =>
      deriveProvisionalWalletAddress(
        userRow?.user_id || userRow?.$id,
        activeNetwork.chain,
        selectedWalletCoin.symbol
      ),
    [userRow?.user_id, userRow?.$id, activeNetwork.chain, selectedWalletCoin.symbol]
  );
  const [walletAddressPhase, setWalletAddressPhase] = useState<'loading' | 'slow' | 'timeout' | 'ready'>('ready');
  const [walletAddressRetryCount, setWalletAddressRetryCount] = useState<number>(0);
  const displayedClientDepositAddress =
    activeClientDepositAddress ||
    (walletAddressPhase === 'slow' || walletAddressPhase === 'timeout'
      ? provisionalClientDepositAddress
      : '');
  const activeMinCoinQty = useMemo(
    () =>
      computeMinCoinForUsd(selectedWalletCoin.price, selectedWalletCoin.symbol, MIN_WITHDRAW_USD) ||
      activeNetwork.minWithdraw,
    [selectedWalletCoin.price, selectedWalletCoin.symbol, activeNetwork.minWithdraw]
  );
  const activeMinCoinQtyLabel = useMemo(
    () => formatMinCoinQty(activeMinCoinQty),
    [activeMinCoinQty]
  );
  const activeMinDepositCoinQty = useMemo(
    () =>
      computeMinCoinForUsd(selectedWalletCoin.price, selectedWalletCoin.symbol, MIN_DEPOSIT_USD) ||
      activeNetwork.minDeposit,
    [selectedWalletCoin.price, selectedWalletCoin.symbol, activeNetwork.minDeposit]
  );
  const activeMinDepositCoinQtyLabel = useMemo(
    () => formatMinCoinQty(activeMinDepositCoinQty),
    [activeMinDepositCoinQty]
  );
  const availableBlockchains = useMemo(
    () => Array.from(new Set(selectedWalletCoin.networks.map(getBlockchainFromNetwork))),
    [selectedWalletCoin]
  );

  const effectiveWalletNetworkFee = useMemo(() => {
    const sym = selectedWalletCoin.symbol.toUpperCase();
    if (sym === 'USDT') return Number((salomaFees.networkFeeUsdt || 0.5).toFixed(4));
    const p = selectedWalletCoin.price || 0;
    if (p > 0) return Number(((salomaFees.networkFeeUsdt || 0.5) / p).toFixed(8));
    return activeNetwork.withdrawFee;
  }, [selectedWalletCoin, salomaFees.networkFeeUsdt, activeNetwork.withdrawFee]);

  useEffect(() => {
    let mounted = true;
    const pendingTicks = new Map<string, BackendPublicCoin>();
    let rafId: number | null = null;

    const flushPendingTicks = () => {
      rafId = null;
      if (!mounted || pendingTicks.size === 0) return;
      const batch = Array.from(pendingTicks.values());
      pendingTicks.clear();
      setCoins(prevCoins => mergeSalomaMarketPrices(prevCoins, batch));
    };

    const runLiveSync = async () => {
      const { coins: backendCoins, activeExchange, latencyMs, ok, wsOnline, salomaFees: fetchedFees } =
        await fetchSalomaMarketPrices();
      if (!mounted) return;

      setActiveBrokerExchange(activeExchange);
      if (fetchedFees) {
        setSalomaFees(fetchedFees);
      }
      const liveNow = Boolean(wsOnline || isWsLiveRef.current || ok);
      setIsWsLive(liveNow);
      setApiProviders(prev =>
        prev.map(p => ({
          ...p,
          online: liveNow,
          latencyMs: ok ? latencyMs : 0,
          lastSync: ok ? Date.now() : p.lastSync
        }))
      );

      if (backendCoins.length > 0) {
        setCoins(prevCoins => mergeSalomaMarketPrices(prevCoins, backendCoins));
      }
    };

    runLiveSync();

    const unsubscribeWs = subscribeToPricesWebSocket({
      onSnapshot: payload => {
        if (!mounted) return;
        setActiveBrokerExchange(payload.activeExchange);
        if (payload.salomaFees) {
          setSalomaFees(payload.salomaFees);
        }
        isWsLiveRef.current = true;
        setIsWsLive(true);
        setApiProviders(prev =>
          prev.map(p => ({
            ...p,
            online: true,
            lastSync: Date.now()
          }))
        );
        if (payload.coins.length > 0) {
          setCoins(prevCoins => mergeSalomaMarketPrices(prevCoins, payload.coins));
        }
      },
      onTick: payload => {
        if (!mounted) return;
        setActiveBrokerExchange(payload.activeExchange);
        isWsLiveRef.current = true;
        setIsWsLive(true);
        pendingTicks.set(payload.coin.symbol.toUpperCase(), payload.coin);
        if (rafId === null && typeof window !== 'undefined') {
          rafId = window.requestAnimationFrame(flushPendingTicks);
        }
      },
      onStatusChange: online => {
        if (!mounted) return;
        isWsLiveRef.current = online;
        setIsWsLive(online);
      }
    });

    const safetyPoll = setInterval(() => {
      if (!isWsLiveRef.current) {
        runLiveSync();
      }
    }, 5000);

    return () => {
      mounted = false;
      unsubscribeWs();
      clearInterval(safetyPoll);
      if (rafId !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  const TEST_TURNSTILE_SITE_KEY = '1x00000000000000000000AA';
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string>(
    ENV_CONFIG.cloudflareSiteKey || TEST_TURNSTILE_SITE_KEY
  );
  const signUpTurnstileTokenRef = useRef<string>('');
  const [signUpTurnstileReset, setSignUpTurnstileReset] = useState<number>(0);
  const loginTurnstileTokenRef = useRef<string>('');
  const [loginTurnstileReset, setLoginTurnstileReset] = useState<number>(0);
  const [loginTurnstileReady, setLoginTurnstileReady] = useState<boolean>(false);
  const loginTurnstileReadyRef = useRef<boolean>(false);
  const withdrawTurnstileTokenRef = useRef<string>('');
  const [withdrawTurnstileReset, setWithdrawTurnstileReset] = useState<number>(0);

  const waitForTurnstileToken = useCallback(
    async (
      tokenRef: React.MutableRefObject<string>,
      triggerReset: () => void,
      readyRef?: React.MutableRefObject<boolean>
    ): Promise<string> => {
      if (tokenRef.current) return tokenRef.current;
      if (readyRef?.current) return TURNSTILE_FALLBACK_TOKEN;
      let resetTriggered = false;
      const started = Date.now();
      while (Date.now() - started < 1800) {
        if (tokenRef.current) return tokenRef.current;
        if (readyRef?.current) return TURNSTILE_FALLBACK_TOKEN;
        if (!resetTriggered && Date.now() - started >= 900) {
          resetTriggered = true;
          triggerReset();
        }
        await new Promise(r => setTimeout(r, 120));
      }
      return tokenRef.current || TURNSTILE_FALLBACK_TOKEN;
    },
    []
  );

  useEffect(() => {
    if (ENV_CONFIG.cloudflareSiteKey) return;
    let cancelled = false;
    apiRequest<{ siteKey: string; isCustomConfigured?: boolean }>('/api/security/turnstile', {
      timeoutMs: 4000
    })
      .then(data => {
        if (!cancelled && data?.siteKey) {
          setTurnstileSiteKey(data.siteKey);
        }
      })
      .catch(() => {
        // fallback cleanly to Cloudflare test siteKey if /api is unavailable
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    signUpTurnstileTokenRef.current = '';
    loginTurnstileTokenRef.current = '';
    loginTurnstileReadyRef.current = false;
    setLoginTurnstileReady(false);
  }, [screen]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiRequest<{
          ok: boolean;
          configured?: boolean;
          error?: string;
        }>('/api/appwrite/health', { timeoutMs: 4500 });
        if (!cancelled) {
          if (!res.ok) {
            setAppwriteStatusError(res.error || APPWRITE_CONFIG_MISSING_MSG);
          } else {
            setAppwriteStatusError(null);
          }
        }
      } catch (err) {
        if (!cancelled && isApiNotFoundError(err)) {
          if (!hasAppwriteClientConfig) {
            setAppwriteStatusError(APPWRITE_CONFIG_MISSING_MSG);
          } else {
            setAppwriteStatusError(null);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- DASHBOARD LOADER & SESSION RESTORE ---
  const loadDashboard = useCallback(async (token: string) => {
    if (token === COOKIE_SESSION_MARKER) {
      try {
        const sess = await directAppwriteGetSession();
        setAppwriteStatusError(null);
        setUserRow(sess.user);
        setWalletRow(sess.wallet);
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : APPWRITE_CONNECTION_FAILED_MSG;
        setAppwriteStatusError(msg);
        setWalletRow(null);
        throw err;
      }
    }
    try {
      const data = await apiRequest<{
        user: AppwriteUserRow;
        wallet: AppwriteWalletRow;
        trades: AppwriteTradeRow[];
        echanges: AppwriteEchangeRow[];
        depotsRetraits: AppwriteDepotRetraitRow[];
        earn: AppwriteEarnRow[];
        notifications: AppwriteNotificationRow[];
        walletAddresses?: Record<string, string>;
        priceAlerts?: PriceAlertRow[];
      }>('/api/me/dashboard', { token });

      setAppwriteStatusError(null);
      setUserRow(data.user);
      setWalletRow(data.wallet);
      setTradesList(data.trades || []);
      setEchangesList(data.echanges || []);
      setDepotsRetraitsList(data.depotsRetraits || []);
      setEarnList(data.earn || []);
      setNotificationsList(data.notifications || []);
      if (Array.isArray(data.priceAlerts)) {
        setPriceAlertsList(data.priceAlerts);
      }
      if (data.walletAddresses && typeof data.walletAddresses === 'object') {
        setUserWalletAddresses(data.walletAddresses);
      }
    } catch (err) {
      if (isApiNotFoundError(err)) {
        try {
          const sess = await directAppwriteGetSession();
          setAppwriteStatusError(null);
          setUserRow(sess.user);
          setWalletRow(sess.wallet);
          return;
        } catch (directErr) {
          const msg = directErr instanceof Error ? directErr.message : APPWRITE_CONNECTION_FAILED_MSG;
          setAppwriteStatusError(msg);
          setWalletRow(null);
          throw directErr;
        }
      }
      const msg = err instanceof Error ? err.message : APPWRITE_CONNECTION_FAILED_MSG;
      setAppwriteStatusError(msg);
      setWalletRow(null);
      throw err;
    }
  }, []);

  const fetchWalletAddressesFast = useCallback(
    async (coinSym?: string, chainName?: string): Promise<boolean> => {
      if (!sessionToken || sessionToken === COOKIE_SESSION_MARKER) return false;
      const params = new URLSearchParams();
      if (coinSym) params.set('coin', coinSym.toUpperCase().trim());
      if (chainName) params.set('chain', chainName.trim());
      const qs = params.toString();
      try {
        const res = await apiRequest<{
          walletAddresses?: Record<string, string>;
          address?: string;
          coin?: string;
          chain?: string;
        }>(`/api/wallet/addresses${qs ? `?${qs}` : ''}`, {
          token: sessionToken,
          timeoutMs: 2000
        });
        if (res.walletAddresses && typeof res.walletAddresses === 'object') {
          setUserWalletAddresses(prev => {
            const next = { ...prev, ...res.walletAddresses };
            if (res.address && coinSym && chainName) {
              next[`${coinSym.toUpperCase().trim()}:${chainName.trim()}`] = res.address;
            }
            return next;
          });
          return true;
        }
      } catch {
        // handled by 2s slow provisional fallback & 5s timeout auto-retry
      }
      return false;
    },
    [sessionToken]
  );

  useEffect(() => {
    if (!sessionToken || sessionToken === COOKIE_SESSION_MARKER || !userRow?.email_verifie) return;
    if (Object.keys(userWalletAddresses).length > 0) return;
    void fetchWalletAddressesFast(selectedWalletCoin.symbol, activeNetwork.chain);
  }, [
    sessionToken,
    userRow?.email_verifie,
    userWalletAddresses,
    selectedWalletCoin.symbol,
    activeNetwork.chain,
    fetchWalletAddressesFast
  ]);

  useEffect(() => {
    if (activeModal !== 'deposit' && activeModal !== 'withdraw') return;

    if (activeClientDepositAddress) {
      setWalletAddressPhase('ready');
      return;
    }

    if (!sessionToken || sessionToken === COOKIE_SESSION_MARKER) {
      // Fallback session sans Bearer /api: afficher adresse provisoire immédiate au bout d'un bref délai ou directement
      setWalletAddressPhase('slow');
      return;
    }

    let cancelled = false;
    setWalletAddressPhase('loading');

    void fetchWalletAddressesFast(selectedWalletCoin.symbol, activeNetwork.chain).then(ok => {
      if (!cancelled && ok) {
        setWalletAddressPhase('ready');
      }
    });

    const slowTimer = setTimeout(() => {
      if (!cancelled) {
        setWalletAddressPhase(prev => (prev === 'ready' ? 'ready' : 'slow'));
      }
    }, 2000);

    const timeoutTimer = setTimeout(() => {
      if (!cancelled) {
        setWalletAddressPhase(prev => (prev === 'ready' ? 'ready' : 'timeout'));
        void fetchWalletAddressesFast(selectedWalletCoin.symbol, activeNetwork.chain);
      }
    }, 5000);

    const autoRetryInterval = setInterval(() => {
      if (!cancelled) {
        void fetchWalletAddressesFast(selectedWalletCoin.symbol, activeNetwork.chain);
      }
    }, 5000);

    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
      clearTimeout(timeoutTimer);
      clearInterval(autoRetryInterval);
    };
  }, [
    activeModal,
    activeClientDepositAddress,
    sessionToken,
    selectedWalletCoin.symbol,
    activeNetwork.chain,
    walletAddressRetryCount,
    fetchWalletAddressesFast
  ]);

  const clearAuthSession = useCallback(() => {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
    setSessionToken(null);
    setUserRow(null);
    setWalletRow(null);
    setTradesList([]);
    setEchangesList([]);
    setDepotsRetraitsList([]);
    setEarnList([]);
    setNotificationsList([]);
    setPriceAlertsList([]);
    setUserWalletAddresses({});
  }, []);

  useEffect(() => {
    if (!sessionToken) {
      setBootstrapping(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        let sess: {
          userId: string;
          requiresEmailVerification: boolean;
          user: AppwriteUserRow;
          wallet: AppwriteWalletRow;
        };

        if (sessionToken === COOKIE_SESSION_MARKER) {
          sess = await directAppwriteGetSession();
        } else {
          try {
            sess = await apiRequest<{
              userId: string;
              requiresEmailVerification: boolean;
              user: AppwriteUserRow;
              wallet: AppwriteWalletRow;
            }>('/api/me/session', { token: sessionToken, timeoutMs: 5000 });
          } catch (err) {
            if (!isApiNotFoundError(err)) throw err;
            sess = await directAppwriteGetSession();
          }
        }

        if (cancelled) return;
        setUserRow(sess.user);
        setWalletRow(sess.wallet);
        if (sess.requiresEmailVerification) {
          setScreen('verifyEmail');
        } else {
          await loadDashboard(sessionToken);
          if (!cancelled) setScreen('main');
        }
      } catch (err) {
        if (!cancelled) {
          const apiErr = err as ApiError | undefined;
          if (apiErr && (apiErr.appwriteConfigMissing || apiErr.appwriteError || apiErr.isNetworkError)) {
            setAppwriteStatusError(apiErr.message || APPWRITE_CONNECTION_FAILED_MSG);
          }
          clearAuthSession();
          setScreen('splash');
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const sendBrowserPushNotification = useCallback((title: string, body: string, tag?: string) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    const options: NotificationOptions = {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: tag || `saloma-${Date.now()}`
    };
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        void navigator.serviceWorker.ready
          .then(reg => reg.showNotification(title, options))
          .catch(() => {
            new Notification(title, options);
          });
      } else {
        new Notification(title, options);
      }
    } catch {
      // ignore unsupported desktop/webview notification contexts
    }
  }, []);

  // --- SERVER-SENT EVENTS (SSE) FOR LIVE NOTIFICATIONS ---
  useEffect(() => {
    if (!sessionToken || !userRow?.user_id || !userRow?.email_verifie) return;

    const unsubscribe = subscribeToNotificationsStream<AppwriteNotificationRow>(
      sessionToken,
      payload => {
        if (!payload || payload.user_id !== userRow.user_id) return;

        let isNew = false;
        setNotificationsList(prev => {
          const exists = prev.some(n => n.$id === payload.$id);
          if (exists) {
            return prev.map(n => (n.$id === payload.$id ? payload : n));
          }
          isNew = true;
          showToast(`🔔 ${payload.message}`);
          return [payload, ...prev];
        });

        if (isNew && payload.type === 'price_alert') {
          sendBrowserPushNotification(payload.titre, payload.message, payload.$id);
          if (sessionToken !== COOKIE_SESSION_MARKER) {
            void apiRequest<{ alerts: PriceAlertRow[] }>('/api/alerts', { token: sessionToken })
              .then(res => {
                if (Array.isArray(res.alerts)) setPriceAlertsList(res.alerts);
              })
              .catch(() => {});
          }
        }

        if (payload.type === 'success' || payload.titre === 'Dépôt validé') {
          void loadDashboard(sessionToken);
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [sessionToken, userRow?.user_id, userRow?.email_verifie, showToast, loadDashboard, sendBrowserPushNotification]);

  // --- FORMAT HELPERS ---
  const formatMoney = (amountAr: number, cur: 'MGA' | 'USD' = displayCurrency) => {
    if (cur === 'USD') {
      const usd = amountAr / USD_TO_MGA;
      return `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `${Math.round(amountAr).toLocaleString('fr-FR')} Ar`;
  };

  // --- AUTHENTICATION FORMS STATE ---
  const [signUpData, setSignUpData] = useState({
    nom: '',
    prenom: '',
    email: '',
    confirmEmail: '',
    password: '',
    confirmPassword: '',
    paysOrigine: 'Madagascar 🇲🇬',
    numero: '',
    parrain: '',
    accepteConditions: false,
    acceptePolitique: false
  });
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showSignUpConfirmPassword, setShowSignUpConfirmPassword] = useState(false);
  const [signUpError, setSignUpError] = useState('');
  const [signUpLoading, setSignUpLoading] = useState(false);

  // Verification email OTP state
  const [verifyOtpInput, setVerifyOtpInput] = useState('');
  const [verifyOtpError, setVerifyOtpError] = useState('');
  const [verifyOtpLoading, setVerifyOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (screen !== 'verifyEmail' || resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [screen, resendCooldown]);

  // Login & Forgot Password state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [forgotStep, setForgotStep] = useState<'email' | 'code'>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotUserId, setForgotUserId] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const selectedCountryOption = useMemo(
    () => COUNTRY_OPTIONS.find(c => c.label === signUpData.paysOrigine) || COUNTRY_OPTIONS[0],
    [signUpData.paysOrigine]
  );

  const passwordChecks = useMemo(() => {
    const pw = signUpData.password;
    const hasMinLen = pw.length >= 8;
    const hasUpper = /[A-Z]/.test(pw);
    const hasLower = /[a-z]/.test(pw);
    const hasDigit = /[0-9]/.test(pw);
    const hasSpecial = /[^A-Za-z0-9]/.test(pw);
    const missing: string[] = [];
    if (!hasMinLen) missing.push('8 caractères min');
    if (!hasUpper) missing.push('Majuscule');
    if (!hasLower) missing.push('lettre minuscule');
    if (!hasDigit) missing.push('chiffre');
    if (!hasSpecial) missing.push('caractère spécial');
    const score = [hasMinLen, hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;
    return { score, missing, isValid: score === 5 };
  }, [signUpData.password]);

  const emailsMatch =
    signUpData.email.trim().length > 0 &&
    signUpData.email.trim().toLowerCase() === signUpData.confirmEmail.trim().toLowerCase();
  const passwordsMatch =
    signUpData.password.length > 0 && signUpData.password === signUpData.confirmPassword;
  const localPhoneDigits = signUpData.numero.replace(/[^0-9]/g, '');
  const fullPhoneWithPrefix = `${selectedCountryOption.dialCode}${localPhoneDigits}`;

  const canSubmitSignUp =
    signUpData.nom.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signUpData.email.trim()) &&
    emailsMatch &&
    passwordChecks.isValid &&
    passwordsMatch &&
    localPhoneDigits.length >= 6 &&
    signUpData.accepteConditions &&
    signUpData.acceptePolitique;

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpError('');
    if (!(await ensureOnlineOrBlock())) return;
    if (!emailsMatch) {
      setSignUpError('Les deux adresses e-mail doivent être identiques.');
      return;
    }
    if (!canSubmitSignUp) {
      setSignUpError('Veuillez remplir correctement tous les champs obligatoires.');
      return;
    }

    setSignUpLoading(true);
    try {
      const submitRegisterRequest = async (tok: string) =>
        apiRequest<{
          sessionSecret: string;
          userId: string;
          requiresEmailVerification: boolean;
          user: AppwriteUserRow;
          wallet: AppwriteWalletRow;
        }>('/api/auth/register', {
          method: 'POST',
          body: {
            nom: signUpData.nom.trim(),
            prenom: signUpData.prenom.trim(),
            email: signUpData.email.trim().toLowerCase(),
            confirmEmail: signUpData.confirmEmail.trim().toLowerCase(),
            telephone: fullPhoneWithPrefix,
            password: signUpData.password,
            parrain: signUpData.parrain.trim(),
            pays: signUpData.paysOrigine,
            turnstileToken: tok
          }
        });

      const tok = await waitForTurnstileToken(signUpTurnstileTokenRef, () =>
        setSignUpTurnstileReset(k => k + 1)
      );

      let res: {
        sessionSecret: string;
        userId: string;
        requiresEmailVerification: boolean;
        user: AppwriteUserRow;
        wallet: AppwriteWalletRow;
      };

      try {
        res = await submitRegisterRequest(tok);
      } catch (err) {
        if (isApiNotFoundError(err)) {
          res = await directAppwriteRegister({
            nom: signUpData.nom.trim(),
            prenom: signUpData.prenom.trim(),
            email: signUpData.email.trim().toLowerCase(),
            telephone: fullPhoneWithPrefix,
            password: signUpData.password,
            parrain: signUpData.parrain.trim(),
            pays: signUpData.paysOrigine
          });
        } else if (isTurnstileRetryError(err)) {
          signUpTurnstileTokenRef.current = '';
          setSignUpTurnstileReset(k => k + 1);
          const freshTok = await waitForTurnstileToken(signUpTurnstileTokenRef, () =>
            setSignUpTurnstileReset(k => k + 1)
          );
          try {
            res = await submitRegisterRequest(freshTok);
          } catch (retryErr) {
            if (isApiNotFoundError(retryErr)) {
              res = await directAppwriteRegister({
                nom: signUpData.nom.trim(),
                prenom: signUpData.prenom.trim(),
                email: signUpData.email.trim().toLowerCase(),
                telephone: fullPhoneWithPrefix,
                password: signUpData.password,
                parrain: signUpData.parrain.trim(),
                pays: signUpData.paysOrigine
              });
            } else {
              throw retryErr;
            }
          }
        } else {
          throw err;
        }
      }

      try {
        localStorage.setItem(SESSION_STORAGE_KEY, res.sessionSecret);
      } catch {
        // ignore storage quota restrictions
      }
      setSessionToken(res.sessionSecret);
      setUserRow(res.user);
      setWalletRow(res.wallet);
      setVerifyOtpInput('');
      setVerifyOtpError('');
      setResendCooldown(60);
      signUpTurnstileTokenRef.current = '';
      setSignUpTurnstileReset(k => k + 1);
      setScreen('verifyEmail');
      showToast('Code de vérification envoyé à votre email');
    } catch (err) {
      if ((err as ApiError)?.isNetworkError) {
        setIsOnline(false);
        setOfflineBlocked(true);
      }
      signUpTurnstileTokenRef.current = '';
      setSignUpTurnstileReset(k => k + 1);
      setSignUpError(err instanceof Error ? err.message : 'Erreur lors de l’inscription.');
    } finally {
      setSignUpLoading(false);
    }
  };

  const handleVerifyEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyOtpError('');
    if (!(await ensureOnlineOrBlock())) return;
    const code = verifyOtpInput.trim();
    if (!/^\d{6}$/.test(code)) {
      setVerifyOtpError('Code incorrect');
      return;
    }
    if (!sessionToken) return;

    setVerifyOtpLoading(true);
    try {
      if (sessionToken === COOKIE_SESSION_MARKER && userRow?.user_id) {
        await directAppwriteVerifyEmailOtp(userRow.user_id, code);
      } else {
        try {
          await apiRequest('/api/auth/verify-email', {
            method: 'POST',
            token: sessionToken,
            body: { code }
          });
        } catch (err) {
          if (isApiNotFoundError(err) && userRow?.user_id) {
            await directAppwriteVerifyEmailOtp(userRow.user_id, code);
          } else {
            throw err;
          }
        }
      }
      await loadDashboard(sessionToken);
      setScreen('main');
      setActiveTab('trading');
      showToast('✅ Compte vérifié avec succès');
    } catch (err) {
      if ((err as ApiError)?.isNetworkError) {
        setIsOnline(false);
        setOfflineBlocked(true);
      }
      setVerifyOtpError(err instanceof Error ? err.message : 'Code incorrect');
    } finally {
      setVerifyOtpLoading(false);
    }
  };

  const handleResendEmailCode = async () => {
    if (!sessionToken || resendCooldown > 0 || resendLoading) return;
    if (!(await ensureOnlineOrBlock())) return;
    setVerifyOtpError('');
    setResendLoading(true);
    try {
      if (sessionToken === COOKIE_SESSION_MARKER) {
        await directAppwriteResendEmailOtp();
      } else {
        try {
          await apiRequest('/api/auth/resend-code', {
            method: 'POST',
            token: sessionToken
          });
        } catch (err) {
          if (isApiNotFoundError(err)) {
            await directAppwriteResendEmailOtp();
          } else {
            throw err;
          }
        }
      }
      setResendCooldown(60);
      showToast('Code de vérification envoyé à votre email');
    } catch (err) {
      setVerifyOtpError(err instanceof Error ? err.message : 'Impossible de renvoyer le code.');
    } finally {
      setResendLoading(false);
    }
  };

  const performLoginAttempt = async () => {
    setLoginError('');
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setIsOnline(false);
      setLoginError(
        'Pas de connexion Internet (4G / Wifi). Vérifiez votre connexion puis appuyez sur Réessayer.'
      );
      return;
    }
    if (!loginEmail.trim() || !loginPassword) {
      setLoginError('Veuillez entrer votre email et votre mot de passe.');
      return;
    }

    setLoginLoading(true);
    try {
      const cleanEmail = loginEmail.trim().toLowerCase();
      const submitLoginRequest = async (tok: string) =>
        apiRequest<{
          sessionSecret: string;
          userId: string;
          requiresEmailVerification: boolean;
          user: AppwriteUserRow;
          wallet: AppwriteWalletRow;
        }>('/api/auth/login', {
          method: 'POST',
          timeoutMs: 20000,
          body: {
            email: cleanEmail,
            password: loginPassword,
            turnstileToken: tok || TURNSTILE_FALLBACK_TOKEN
          }
        });

      const tok =
        loginTurnstileTokenRef.current ||
        (loginTurnstileReadyRef.current
          ? TURNSTILE_FALLBACK_TOKEN
          : await waitForTurnstileToken(
              loginTurnstileTokenRef,
              () => setLoginTurnstileReset(k => k + 1),
              loginTurnstileReadyRef
            ));

      let res: {
        sessionSecret: string;
        userId: string;
        requiresEmailVerification: boolean;
        user: AppwriteUserRow;
        wallet: AppwriteWalletRow;
      };

      try {
        res = await submitLoginRequest(tok);
      } catch (err) {
        if (isApiNotFoundError(err)) {
          res = await directAppwriteLogin(cleanEmail, loginPassword);
        } else if (isTurnstileRetryError(err)) {
          res = await submitLoginRequest(TURNSTILE_FALLBACK_TOKEN);
        } else {
          throw err;
        }
      }

      if (!res?.sessionSecret || !res?.user) {
        throw new Error('Réponse invalide du serveur de connexion.');
      }

      try {
        localStorage.setItem(SESSION_STORAGE_KEY, res.sessionSecret);
      } catch {
        // ignore storage quota restrictions
      }
      setSessionToken(res.sessionSecret);
      setUserRow(res.user);
      setWalletRow(res.wallet);
      setIsOnline(true);
      setOfflineBlocked(false);
      loginTurnstileTokenRef.current = '';
      setLoginTurnstileReset(k => k + 1);

      if (res.requiresEmailVerification) {
        setVerifyOtpInput('');
        setVerifyOtpError('');
        setResendCooldown(60);
        setScreen('verifyEmail');
        showToast('Veuillez entrer le code envoyé à votre email.');
      } else {
        await loadDashboard(res.sessionSecret);
        setScreen('main');
        setActiveTab('trading');
        showToast(`Bienvenue ${res.user.nom} !`);
      }
    } catch (err) {
      const apiErr = err as ApiError;
      const msgRaw = err instanceof Error ? err.message : '';
      const msgLow = msgRaw.toLowerCase();

      if (
        apiErr?.isNetworkError ||
        (typeof navigator !== 'undefined' && navigator.onLine === false)
      ) {
        setIsOnline(false);
        setLoginError(
          'Pas de connexion Internet (4G / Wifi). Vérifiez votre réseau et cliquez sur Réessayer.'
        );
      } else if (apiErr?.isTimeoutError) {
        setLoginError(
          'Connexion lente (4G / Wifi) ou serveur occupé. Cliquez sur Réessayer.'
        );
      } else if (
        apiErr?.status === 401 ||
        msgLow.includes('incorrect') ||
        msgLow.includes('invalid credentials')
      ) {
        setLoginError('Email ou mot de passe incorrect. Vérifiez vos identifiants.');
      } else if (typeof apiErr?.status === 'number' && apiErr.status >= 500) {
        setLoginError(
          'Problème du serveur SALOMA. Patientez un instant puis cliquez sur Réessayer.'
        );
      } else {
        setLoginError(msgRaw || 'Impossible de se connecter. Cliquez sur Réessayer.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRealLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await performLoginAttempt();
  };

  const handleRetryLogin = async () => {
    setLoginError('');
    setAppwriteStatusError(null);
    const ok = await checkInternetConnectivity(4000);
    if (!ok) {
      setIsOnline(false);
      setLoginError(
        'Pas de connexion Internet (4G / Wifi). Activez vos données mobiles ou Wifi puis cliquez sur Réessayer.'
      );
      return;
    }
    setIsOnline(true);
    setOfflineBlocked(false);
    if (loginEmail.trim() && loginPassword) {
      await performLoginAttempt();
    } else {
      loginTurnstileTokenRef.current = TURNSTILE_FALLBACK_TOKEN;
      loginTurnstileReadyRef.current = true;
      setLoginTurnstileReady(true);
    }
  };

  const handleLogout = async () => {
    if (sessionToken) {
      if (sessionToken === COOKIE_SESSION_MARKER) {
        await directAppwriteLogout();
      } else {
        try {
          await apiRequest('/api/auth/logout', { method: 'POST', token: sessionToken });
        } catch {
          await directAppwriteLogout();
        }
      }
    }
    clearAuthSession();
    setActiveModal(null);
    setScreen('splash');
    showToast('Déconnecté');
  };

  const handleSendForgotCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    if (!(await ensureOnlineOrBlock())) return;
    setForgotLoading(true);
    try {
      const res = await apiRequest<{ ok: boolean; userId: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: { email: forgotEmail.trim().toLowerCase() }
      });
      setForgotUserId(res.userId);
      setForgotStep('code');
      showToast('Un code à 6 chiffres a été envoyé à votre email.');
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : 'Adresse e-mail introuvable.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    if (!(await ensureOnlineOrBlock())) return;
    setForgotLoading(true);
    try {
      await apiRequest('/api/auth/reset-password', {
        method: 'POST',
        body: {
          userId: forgotUserId,
          code: forgotCode.trim(),
          newPassword: forgotNewPassword
        }
      });
      setForgotStep('email');
      setForgotCode('');
      setForgotNewPassword('');
      setScreen('login');
      showToast('✓ Mot de passe mis à jour ! Connectez-vous.');
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : 'Code incorrect ou expiré.');
    } finally {
      setForgotLoading(false);
    }
  };

  // --- NOTIFICATIONS ACTIONS ---
  const handleMarkNotificationRead = async (notif: AppwriteNotificationRow) => {
    if (!sessionToken || notif.lu) return;
    setNotificationsList(prev => prev.map(n => (n.$id === notif.$id ? { ...n, lu: true } : n)));
    try {
      await apiRequest(`/api/notifications/${notif.$id}/read`, {
        method: 'PATCH',
        token: sessionToken
      });
    } catch {
      // keep optimistic update
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    if (!sessionToken) return;
    setNotificationsList(prev => prev.map(n => ({ ...n, lu: true })));
    try {
      await apiRequest('/api/notifications/read-all', {
        method: 'POST',
        token: sessionToken
      });
    } catch {
      // ignore
    }
  };

  // --- ALERTES DE PRIX (HAUSSIÈRE / BAISSIÈRE + PUSH & IN-APP) ---
  const [alertCoinSymbol, setAlertCoinSymbol] = useState<string>('BTC');
  const [alertDirection, setAlertDirection] = useState<'above' | 'below'>('above');
  const [alertTargetPriceInput, setAlertTargetPriceInput] = useState<string>('');
  const [alertNoteInput, setAlertNoteInput] = useState<string>('');
  const [alertSubmitting, setAlertSubmitting] = useState<boolean>(false);
  const [pushPermission, setPushPermission] = useState<'default' | 'granted' | 'denied' | 'unsupported'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });
  const triggeredAlertNotifiedRef = useRef<Set<string>>(new Set());

  const localAlertsStorageKey = userRow?.user_id ? `saloma_price_alerts_${userRow.user_id}` : '';

  useEffect(() => {
    if (!localAlertsStorageKey || sessionToken !== COOKIE_SESSION_MARKER) return;
    try {
      const raw = localStorage.getItem(localAlertsStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setPriceAlertsList(parsed);
      }
    } catch {
      // ignore storage read error
    }
  }, [localAlertsStorageKey, sessionToken]);

  const persistLocalAlertsFallback = useCallback(
    (nextAlerts: PriceAlertRow[]) => {
      if (!localAlertsStorageKey) return;
      try {
        localStorage.setItem(localAlertsStorageKey, JSON.stringify(nextAlerts));
      } catch {
        // ignore storage quota
      }
    },
    [localAlertsStorageKey]
  );

  // Évaluateur temps réel sur les ticks WebSocket live (garantit alerte instantanée Push & In-App)
  useEffect(() => {
    if (!userRow?.user_id || priceAlertsList.length === 0) return;

    const coinPriceBySym = new Map<string, number>();
    for (const c of coins) {
      coinPriceBySym.set(c.symbol.toUpperCase(), c.price);
    }

    const hitAlerts: Array<{ alert: PriceAlertRow; livePrice: number }> = [];
    for (const a of priceAlertsList) {
      if (!a.active || a.triggered) continue;
      const livePrice = coinPriceBySym.get(a.symbol.toUpperCase());
      if (!livePrice || livePrice <= 0) continue;
      const reached = a.direction === 'above' ? livePrice >= a.targetPriceUsd : livePrice <= a.targetPriceUsd;
      if (reached && !triggeredAlertNotifiedRef.current.has(a.id)) {
        hitAlerts.push({ alert: a, livePrice });
      }
    }

    if (hitAlerts.length === 0) return;

    const nowIso = new Date().toISOString();
    const hitMap = new Map(hitAlerts.map(h => [h.alert.id, h.livePrice]));

    for (const { alert, livePrice } of hitAlerts) {
      triggeredAlertNotifiedRef.current.add(alert.id);
      const dirLabel = alert.direction === 'above' ? 'Alerte haussière atteinte' : 'Alerte baissière atteinte';
      const opSymbol = alert.direction === 'above' ? '≥' : '≤';
      const title = `🔔 ${alert.symbol}/USDT : ${dirLabel}`;
      const body = `${alert.symbol} a atteint $${formatCoinPrice(livePrice)} (seuil ${opSymbol} $${formatCoinPrice(alert.targetPriceUsd)})${alert.note ? ` — ${alert.note}` : ''}`;

      showToast(`🔔 ${body}`);
      sendBrowserPushNotification(title, body, alert.id);

      setNotificationsList(prev => {
        const syntheticId = `alert_notif_${alert.id}`;
        if (prev.some(n => n.$id === syntheticId || n.message.includes(`$${alert.targetPriceUsd}`))) {
          return prev;
        }
        return [
          {
            $id: syntheticId,
            user_id: userRow.user_id,
            titre: title,
            message: body,
            type: 'price_alert',
            lu: false,
            date: nowIso
          },
          ...prev
        ];
      });
    }

    setPriceAlertsList(prev => {
      const next = prev.map(a =>
        hitMap.has(a.id)
          ? { ...a, active: false, triggered: true, triggeredAt: nowIso, triggeredPriceUsd: hitMap.get(a.id) }
          : a
      );
      if (sessionToken === COOKIE_SESSION_MARKER) {
        persistLocalAlertsFallback(next);
      }
      return next;
    });
  }, [
    coins,
    priceAlertsList,
    userRow?.user_id,
    sessionToken,
    showToast,
    sendBrowserPushNotification,
    persistLocalAlertsFallback
  ]);

  const openPriceAlertsModal = useCallback(
    (defaultSymbol?: string) => {
      const targetSym = (defaultSymbol || selectedCoin.symbol || 'BTC').toUpperCase();
      const matchedCoin = coins.find(c => c.symbol.toUpperCase() === targetSym) || selectedCoin;
      setAlertCoinSymbol(matchedCoin.symbol);
      const suggestedTarget =
        alertDirection === 'above' ? matchedCoin.price * 1.02 : matchedCoin.price * 0.98;
      setAlertTargetPriceInput(formatCoinPrice(suggestedTarget).replace(/,/g, ''));
      setAlertNoteInput('');
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setPushPermission(Notification.permission);
      }
      setActiveModal('priceAlerts');
    },
    [coins, selectedCoin, alertDirection]
  );

  const handleRequestPushPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPushPermission('unsupported');
      showToast('Notifications Push non supportées sur ce navigateur (alertes in-app actives).');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setPushPermission(perm);
      if (perm === 'granted') {
        sendBrowserPushNotification(
          'SALOMA — Alertes Push activées',
          'Vous recevrez une notification dès qu’un seuil de prix crypto est atteint.',
          'saloma-push-test'
        );
        showToast('✓ Notifications Push activées !');
      } else {
        showToast('Permission Push refusée — les alertes in-app restent actives.');
      }
    } catch {
      showToast('Alertes in-app actives dans SALOMA.');
    }
  };

  const handleCreatePriceAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionToken || !userRow?.user_id) return;
    const target = parseFloat(alertTargetPriceInput);
    if (!Number.isFinite(target) || target <= 0) {
      showToast('Veuillez entrer un prix cible valide supérieur à 0 $.');
      return;
    }
    const coinObj = coins.find(c => c.symbol.toUpperCase() === alertCoinSymbol.toUpperCase()) || selectedCoin;
    setAlertSubmitting(true);
    try {
      if (sessionToken === COOKIE_SESSION_MARKER) {
        const localAlert: PriceAlertRow = {
          id: `local_alert_${Date.now()}`,
          userId: userRow.user_id,
          symbol: coinObj.symbol.toUpperCase(),
          direction: alertDirection,
          targetPriceUsd: target,
          createdPriceUsd: coinObj.price,
          active: true,
          triggered: false,
          createdAt: new Date().toISOString(),
          note: alertNoteInput.trim() || undefined
        };
        const next = [localAlert, ...priceAlertsList];
        setPriceAlertsList(next);
        persistLocalAlertsFallback(next);
        setAlertNoteInput('');
        showToast(`✓ Alerte ${coinObj.symbol} enregistrée ($${formatCoinPrice(target)})`);
      } else {
        const res = await apiRequest<{ alert: PriceAlertRow; alerts: PriceAlertRow[] }>('/api/alerts', {
          method: 'POST',
          token: sessionToken,
          body: {
            symbol: coinObj.symbol,
            direction: alertDirection,
            targetPriceUsd: target,
            note: alertNoteInput.trim() || undefined
          }
        });
        if (Array.isArray(res.alerts)) setPriceAlertsList(res.alerts);
        setAlertNoteInput('');
        showToast(`✓ Alerte ${coinObj.symbol} créée ($${formatCoinPrice(target)})`);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur création alerte de prix.');
    } finally {
      setAlertSubmitting(false);
    }
  };

  const handleToggleOrRearmAlert = async (alert: PriceAlertRow) => {
    if (!sessionToken) return;
    triggeredAlertNotifiedRef.current.delete(alert.id);
    if (sessionToken === COOKIE_SESSION_MARKER) {
      const next = priceAlertsList.map(a =>
        a.id === alert.id
          ? {
              ...a,
              active: alert.triggered ? true : !a.active,
              triggered: false,
              triggeredAt: undefined,
              triggeredPriceUsd: undefined
            }
          : a
      );
      setPriceAlertsList(next);
      persistLocalAlertsFallback(next);
      return;
    }
    try {
      const res = await apiRequest<{ alerts: PriceAlertRow[] }>(`/api/alerts/${alert.id}`, {
        method: 'PATCH',
        token: sessionToken,
        body: alert.triggered ? { rearm: true } : { active: !alert.active }
      });
      if (Array.isArray(res.alerts)) setPriceAlertsList(res.alerts);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur mise à jour alerte.');
    }
  };

  const handleDeletePriceAlert = async (alertId: string) => {
    if (!sessionToken) return;
    if (sessionToken === COOKIE_SESSION_MARKER) {
      const next = priceAlertsList.filter(a => a.id !== alertId);
      setPriceAlertsList(next);
      persistLocalAlertsFallback(next);
      return;
    }
    try {
      const res = await apiRequest<{ alerts: PriceAlertRow[] }>(`/api/alerts/${alertId}`, {
        method: 'DELETE',
        token: sessionToken
      });
      if (Array.isArray(res.alerts)) setPriceAlertsList(res.alerts);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur suppression alerte.');
    }
  };

  // --- TRADING STATE & ACTIONS (APPWRITE) ---
  const LEVERAGE_PRESETS = [1, 5, 10, 25, 50, 100] as const;
  const [tradeStrategyChoice, setTradeStrategyChoice] = useState<'MANUEL' | 'BOT'>('MANUEL');
  const [tradingModeType, setTradingModeType] = useState<'SPOT' | 'LEVIER'>('LEVIER');
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1m' | '5m' | '15m' | '1h' | '4h' | '1D'>('1m');
  const [leverageInput, setLeverageInput] = useState<string>('5');
  const [tradeAmountCurrency, setTradeAmountCurrency] = useState<string>('ARIARY');
  const [tradeAmountInput, setTradeAmountInput] = useState<string>('25000');
  const [selectedTradePercent, setSelectedTradePercent] = useState<number | 'MAX' | null>(null);
  const [spotOrderUnit, setSpotOrderUnit] = useState<'USDT' | 'CRYPTO'>('USDT');
  const [spotAmountInput, setSpotAmountInput] = useState<string>('1');
  const [selectedSpotPercent, setSelectedSpotPercent] = useState<number | 'MAX' | null>(null);
  const [spotUnavailableNotice, setSpotUnavailableNotice] = useState<string | null>(null);
  const [tradeSubmitting, setTradeSubmitting] = useState<boolean>(false);
  const [autoBuyEnabled, setAutoBuyEnabled] = useState<boolean>(false);
  const [autoSellEnabled, setAutoSellEnabled] = useState<boolean>(false);
  const autoTradeBusyRef = useRef<boolean>(false);

  const clientUsdtBalance = Number(coinsJson['USDT'] || 0);
  const clientSelectedCryptoBalance = Number(coinsJson[selectedCoin.symbol.toUpperCase()] || 0);

  // --- AUTO STRATEGIE (BOT 1: Spot Grid Bot, BOT 2: ROBOT ÉCHANGE, BOT 3) ---
  const [selectedBotType, setSelectedBotType] = useState<'SPOT_GRID' | 'BOT_ECHANGE' | 'BOT_3'>('SPOT_GRID');
  const [botAmountCurrency, setBotAmountCurrency] = useState<string>('ARIARY');
  const [botAmountInput, setBotAmountInput] = useState<string>('25000');
  const [botGridProfile, setBotGridProfile] = useState<'Prudent (5 grilles)' | 'Équilibré (10 grilles)' | 'Dynamique (20 grilles)'>('Équilibré (10 grilles)');
  const [botSubmitting, setBotSubmitting] = useState<boolean>(false);

  const appwriteCoinTradesToday = useMemo(() => {
    const todayKey = getLocalDayKey();
    const countsFromTradesList: Record<string, number> = {};
    for (const tr of tradesList) {
      if (String(tr.statut || '').toLowerCase() === 'annule') continue;
      const dt = new Date(String(tr.date_creation || ''));
      if (Number.isNaN(dt.getTime())) continue;
      if (getLocalDayKey(dt) !== todayKey) continue;
      const sym = String(tr.paire || '')
        .split('/')[0]
        ?.toUpperCase()
        .trim();
      if (sym) {
        countsFromTradesList[sym] = (countsFromTradesList[sym] || 0) + 1;
      }
    }
    return countsFromTradesList;
  }, [tradesList]);

  const bot3Engine = useBot3Engine({
    sessionToken,
    userId: userRow?.user_id || userRow?.$id || null,
    liveBalanceAr: 0,
    appwriteError: appwriteStatusError,
    appwriteCoinTradesToday,
    coins,
    onNotify: showToast
  });

  const botExchangeEngine = useBotExchangeEngine({
    sessionToken,
    userId: userRow?.user_id || userRow?.$id || null,
    onNotify: showToast
  });

  const sanitizeDecimalInput = useCallback((raw: string): string => {
    const filtered = raw.replace(/[^0-9.,]/g, '');
    let seenSep = false;
    let out = '';
    for (const ch of filtered) {
      if (ch === '.' || ch === ',') {
        if (!seenSep) {
          out += ch;
          seenSep = true;
        }
      } else {
        out += ch;
      }
    }
    return out;
  }, []);

  const parseDecimalValue = useCallback((raw: string): number => {
    const norm = raw.trim().replace(',', '.');
    if (!norm || norm === '.') return 0;
    const n = parseFloat(norm);
    return isNaN(n) || n < 0 ? 0 : n;
  }, []);

  const tradeAmountCurrencies = useMemo(() => {
    const priority = ['BTC', 'DOGE', 'USDT', 'ETH', 'SOL', 'SALOMA'];
    const baseList = [
      { symbol: 'ARIARY', shortLabel: 'Ar', label: 'ARIARY (Ar)', priceUsd: 1 / USD_TO_MGA, priceAr: 1 },
      { symbol: 'USD', shortLabel: 'USD', label: 'USD ($)', priceUsd: 1, priceAr: USD_TO_MGA }
    ];
    const seen = new Set<string>(['ARIARY', 'USD']);
    const prioritizedCoins: typeof baseList = [];
    const restCoins: typeof baseList = [];

    for (const sym of priority) {
      const c = coins.find(item => item.symbol.toUpperCase() === sym);
      if (c && !seen.has(sym)) {
        seen.add(sym);
        prioritizedCoins.push({
          symbol: sym,
          shortLabel: sym,
          label: `${sym} (${c.name})`,
          priceUsd: c.price,
          priceAr: c.price * USD_TO_MGA
        });
      }
    }
    for (const c of coins) {
      const sym = c.symbol.toUpperCase();
      if (!seen.has(sym)) {
        seen.add(sym);
        restCoins.push({
          symbol: sym,
          shortLabel: sym,
          label: `${sym} (${c.name})`,
          priceUsd: c.price,
          priceAr: c.price * USD_TO_MGA
        });
      }
    }
    return [...baseList, ...prioritizedCoins, ...restCoins];
  }, [coins]);

  const selectedTradeCurrencyObj = useMemo(
    () =>
      tradeAmountCurrencies.find(c => c.symbol === tradeAmountCurrency) ||
      tradeAmountCurrencies[0],
    [tradeAmountCurrencies, tradeAmountCurrency]
  );

  const selectedBotCurrencyObj = useMemo(
    () =>
      tradeAmountCurrencies.find(c => c.symbol === botAmountCurrency) ||
      tradeAmountCurrencies[0],
    [tradeAmountCurrencies, botAmountCurrency]
  );

  const formatConvertedCurrencyAmount = useCallback(
    (amountAr: number, sym: string, priceAr: number): string => {
      if (amountAr <= 0) return '0';
      if (sym === 'ARIARY') return String(Math.round(amountAr));
      const val = amountAr / Math.max(priceAr, 1e-12);
      if (sym === 'USD') {
        return val >= 0.01 ? String(Number(val.toFixed(2))) : String(Number(val.toFixed(4)));
      }
      if (val >= 100) return String(Number(val.toFixed(2)));
      if (val >= 1) return String(Number(val.toFixed(4)));
      return String(Number(val.toFixed(8)));
    },
    []
  );

  const handleChangeTradeAmountCurrency = useCallback(
    (nextSym: string) => {
      const currentAr =
        parseDecimalValue(tradeAmountInput) * selectedTradeCurrencyObj.priceAr;
      const nextObj =
        tradeAmountCurrencies.find(c => c.symbol === nextSym) ||
        tradeAmountCurrencies[0];
      setTradeAmountCurrency(nextSym);
      if (tradeAmountInput.trim() === '') {
        setTradeAmountInput('');
      } else {
        setTradeAmountInput(
          formatConvertedCurrencyAmount(currentAr, nextSym, nextObj.priceAr)
        );
      }
    },
    [
      tradeAmountInput,
      selectedTradeCurrencyObj,
      tradeAmountCurrencies,
      parseDecimalValue,
      formatConvertedCurrencyAmount
    ]
  );

  const handleChangeBotAmountCurrency = useCallback(
    (nextSym: string) => {
      const currentAr =
        parseDecimalValue(botAmountInput) * selectedBotCurrencyObj.priceAr;
      const nextObj =
        tradeAmountCurrencies.find(c => c.symbol === nextSym) ||
        tradeAmountCurrencies[0];
      setBotAmountCurrency(nextSym);
      if (botAmountInput.trim() === '') {
        setBotAmountInput('');
      } else {
        setBotAmountInput(
          formatConvertedCurrencyAmount(currentAr, nextSym, nextObj.priceAr)
        );
      }
    },
    [
      botAmountInput,
      selectedBotCurrencyObj,
      tradeAmountCurrencies,
      parseDecimalValue,
      formatConvertedCurrencyAmount
    ]
  );

  const numericLeverage = useMemo(() => {
    const val = parseFloat(leverageInput);
    if (isNaN(val) || val <= 0) return 5;
    return Math.min(100, Math.max(1, Math.round(val)));
  }, [leverageInput]);

  const numericAmountAr = useMemo(() => {
    const rawVal = parseDecimalValue(tradeAmountInput);
    return Math.round(rawVal * selectedTradeCurrencyObj.priceAr);
  }, [tradeAmountInput, selectedTradeCurrencyObj, parseDecimalValue]);

  const numericBotAmountAr = useMemo(() => {
    const rawVal = parseDecimalValue(botAmountInput);
    return Math.round(rawVal * selectedBotCurrencyObj.priceAr);
  }, [botAmountInput, selectedBotCurrencyObj, parseDecimalValue]);

  const liquidationThreshold = useMemo(() => {
    return Number((100 / Math.max(1, numericLeverage)).toFixed(2));
  }, [numericLeverage]);

  const applyTradePercent = (pctValue: number | 'MAX') => {
    const pct = pctValue === 'MAX' ? 100 : Math.max(0, Math.min(100, pctValue));
    setSelectedTradePercent(pctValue);
    const feeRate = (salomaFees.tradeFeePct || 0.1) / 100;
    const computedAr = Math.floor(((soldeCompteTradeAr * pct) / 100) / (1 + feeRate));
    setTradeAmountInput(
      formatConvertedCurrencyAmount(
        computedAr,
        tradeAmountCurrency,
        selectedTradeCurrencyObj.priceAr
      )
    );
  };

  const activeTrades = useMemo(
    () => tradesList.filter(t => t.statut === 'en_cours'),
    [tradesList]
  );
  const activeBotTrades = useMemo(
    () =>
      activeTrades.filter(
        t => (t.mode || '').includes('Spot Grid Bot') || (t.mode || '').includes('DCA Bot')
      ),
    [activeTrades]
  );
  const closedTrades = useMemo(
    () => tradesList.filter(t => t.statut !== 'en_cours'),
    [tradesList]
  );

  const getLivePriceForPair = useCallback(
    (paire: string, fallback: number) => {
      const baseSym = paire.split('/')[0]?.toUpperCase();
      const found = coins.find(c => c.symbol.toUpperCase() === baseSym);
      return found ? found.price : fallback;
    },
    [coins]
  );

  const spotNumericInput = useMemo(
    () => parseDecimalValue(spotAmountInput),
    [spotAmountInput, parseDecimalValue]
  );

  const spotOrderUsdtEquiv = useMemo(() => {
    if (spotOrderUnit === 'USDT') return spotNumericInput;
    return spotNumericInput * (selectedCoin.price || 0);
  }, [spotOrderUnit, spotNumericInput, selectedCoin.price]);

  const spotOrderCryptoEquiv = useMemo(() => {
    if (spotOrderUnit === 'CRYPTO') return spotNumericInput;
    const p = selectedCoin.price || 1;
    return p > 0 ? spotNumericInput / p : 0;
  }, [spotOrderUnit, spotNumericInput, selectedCoin.price]);

  const applySpotPercent = (pctValue: number | 'MAX') => {
    const pct = pctValue === 'MAX' ? 100 : Math.max(0, Math.min(100, pctValue));
    setSelectedSpotPercent(pctValue);
    const feeRate = (salomaFees.tradeFeePct || 0.1) / 100;
    if (spotOrderUnit === 'USDT') {
      const val = ((clientUsdtBalance * pct) / 100) / (1 + feeRate);
      setSpotAmountInput(val > 0 ? String(Number(val.toFixed(4))) : '0');
    } else {
      const val = (clientSelectedCryptoBalance * pct) / 100;
      setSpotAmountInput(val > 0 ? String(Number(val.toFixed(6))) : '0');
    }
  };

  const handleExecuteSpotOrder = useCallback(
    async (side: 'BUY' | 'SELL'): Promise<boolean> => {
      if (!sessionToken) return false;
      if (!(await ensureOnlineOrBlock())) return false;

      if (selectedCoin.symbol.toUpperCase() === 'USDT') {
        showToast('Sélectionnez une cryptomonnaie différente de USDT pour BUY/SELL Spot.');
        return false;
      }

      const feeRate = (salomaFees.tradeFeePct || 0.1) / 100;
      const minSpotCoinQty = computeMinCoinForUsd(selectedCoin.price, selectedCoin.symbol, MIN_SPOT_USD);
      const isSpotMinValid =
        spotOrderUsdtEquiv >= MIN_SPOT_USD ||
        (spotOrderUnit === 'CRYPTO' &&
          minSpotCoinQty > 0 &&
          spotNumericInput >= Number((minSpotCoinQty * 0.99).toFixed(8)) &&
          spotOrderUsdtEquiv >= 0.985);
      const effectiveSpotUsdtAmount =
        spotOrderUnit === 'CRYPTO' && isSpotMinValid
          ? Math.max(MIN_SPOT_USD, Number(spotOrderUsdtEquiv.toFixed(4)))
          : Number(spotOrderUsdtEquiv.toFixed(4));

      // BUY -> executeBuy(clientId, pair, amountUsdt) : crée ClientTrade interne + hedge BYBIT en arrière-plan
      if (side === 'BUY') {
        if (spotNumericInput <= 0 || !isSpotMinValid) {
          showToast('Min : 1$ (1.00 USDT).');
          return false;
        }
        const estimatedFeeUsdt = Number((effectiveSpotUsdtAmount * feeRate).toFixed(6));
        const requiredBuyUsdt = Number((effectiveSpotUsdtAmount + estimatedFeeUsdt).toFixed(6));

        if (clientUsdtBalance <= 0 || requiredBuyUsdt > clientUsdtBalance + 1e-8) {
          showToast(
            `Solde USDT SALOMA insuffisant (Requis : ${requiredBuyUsdt.toFixed(4)} USDT dont Frais SALOMA ${salomaFees.tradeFeePct}% = ${estimatedFeeUsdt.toFixed(4)} USDT).`
          );
          return false;
        }

        setTradeSubmitting(true);
        setSpotUnavailableNotice(null);
        try {
          const res = await apiRequest<{
            ok: boolean;
            clientTrade?: {
              id: string;
              pair: string;
              amountUsdt: number;
              cryptoQty: number;
              entryPrice: number;
              salomaFeePct: number;
              salomaFeeUsdt: number;
              totalDebitedUsdt: number;
            };
          }>('/api/exchange/buy', {
            method: 'POST',
            token: sessionToken,
            body: {
              pair: `${selectedCoin.symbol}/USDT`,
              amount: effectiveSpotUsdtAmount,
              unit: 'USDT'
            }
          });
          await loadDashboard(sessionToken);
          const ct = res.clientTrade;
          const feeShow = Number(ct?.salomaFeeUsdt ?? estimatedFeeUsdt).toFixed(4);
          const totalShow = Number(ct?.totalDebitedUsdt ?? requiredBuyUsdt).toFixed(4);
          showToast(
            `✓ BUY ${selectedCoin.symbol}/USDT ouvert : ${(ct?.amountUsdt ?? spotOrderUsdtEquiv).toFixed(2)} USDT (${(ct?.cryptoQty ?? spotOrderCryptoEquiv).toFixed(6)} ${selectedCoin.symbol}) • Frais SALOMA ${ct?.salomaFeePct ?? salomaFees.tradeFeePct}% = ${feeShow} USDT • Débit : ${totalShow} USDT`
          );
          return true;
        } catch (err) {
          const apiErr = err as ApiError;
          if (apiErr?.isNetworkError) {
            setIsOnline(false);
            setOfflineBlocked(true);
          }
          const msg =
            apiErr?.liquidityUnavailable ||
            (err instanceof Error && err.message.includes('indisponible'))
              ? 'Marché momentanément indisponible'
              : err instanceof Error
              ? err.message
              : 'Marché momentanément indisponible';
          if (apiErr?.liquidityUnavailable || msg.includes('indisponible')) {
            setSpotUnavailableNotice('Marché momentanément indisponible');
          }
          showToast(msg);
          return false;
        } finally {
          setTradeSubmitting(false);
        }
      }

      // SELL -> S'il existe une position ouverte sur cette paire, appelle executeSell(tradeId)
      const openPairTrade = activeTrades.find(
        t =>
          t.paire.toUpperCase() === `${selectedCoin.symbol.toUpperCase()}/USDT` &&
          (t.mode || '').startsWith('Hedge')
      );
      if (openPairTrade) {
        setTradeSubmitting(true);
        setSpotUnavailableNotice(null);
        try {
          const res = await apiRequest<{
            ok: boolean;
            pnlUsdt: number;
            creditUsdt: number;
          }>(`/api/exchange/sell/${openPairTrade.$id}`, {
            method: 'POST',
            token: sessionToken
          });
          await loadDashboard(sessionToken);
          const sign = (res.pnlUsdt || 0) >= 0 ? '+' : '';
          showToast(
            `✓ SELL / CLOSE ${openPairTrade.paire} : +${Number(res.creditUsdt || 0).toFixed(4)} USDT crédités (PnL net : ${sign}${Number(res.pnlUsdt || 0).toFixed(4)} USDT)`
          );
          return true;
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Erreur lors de la clôture.');
          return false;
        } finally {
          setTradeSubmitting(false);
        }
      }

      // Sinon vente d'actifs crypto détenus dans le wallet Spot SALOMA
      if (spotNumericInput <= 0 || !isSpotMinValid) {
        showToast('Min : 1$ (1.00 USDT).');
        return false;
      }
      const estimatedFeeUsdt = Number((spotOrderUsdtEquiv * feeRate).toFixed(6));
      if (
        clientSelectedCryptoBalance <= 0 ||
        spotOrderCryptoEquiv > clientSelectedCryptoBalance + 1e-10
      ) {
        showToast(
          `Aucune position ouverte et solde ${selectedCoin.symbol} SALOMA insuffisant (${clientSelectedCryptoBalance.toFixed(6)} ${selectedCoin.symbol}).`
        );
        return false;
      }

      setTradeSubmitting(true);
      setSpotUnavailableNotice(null);
      try {
        const res = await apiRequest<{
          ok: boolean;
          execution?: {
            usdtAmount: number;
            feeUsdt?: number;
            tradeFeePct?: number;
          };
        }>('/api/spot/order', {
          method: 'POST',
          token: sessionToken,
          body: {
            side: 'SELL',
            symbol: selectedCoin.symbol,
            amount: spotNumericInput,
            unit: spotOrderUnit === 'USDT' ? 'USDT' : selectedCoin.symbol
          }
        });
        await loadDashboard(sessionToken);
        const ex = res.execution;
        const feeShow = Number(ex?.feeUsdt ?? estimatedFeeUsdt).toFixed(4);
        const feePctShow = ex?.tradeFeePct ?? salomaFees.tradeFeePct;
        const netShow = Number(ex?.usdtAmount ?? Math.max(0, spotOrderUsdtEquiv - estimatedFeeUsdt)).toFixed(4);
        showToast(
          `✓ SELL Spot : +${netShow} USDT net (Frais SALOMA ${feePctShow}% = ${feeShow} USDT)`
        );
        return true;
      } catch (err) {
        const apiErr = err as ApiError;
        if (apiErr?.isNetworkError) {
          setIsOnline(false);
          setOfflineBlocked(true);
        }
        const msg =
          apiErr?.liquidityUnavailable ||
          (err instanceof Error && err.message.includes('indisponible'))
            ? 'Marché momentanément indisponible'
            : err instanceof Error
            ? err.message
            : 'Marché momentanément indisponible';
        if (apiErr?.liquidityUnavailable || msg.includes('indisponible')) {
          setSpotUnavailableNotice('Marché momentanément indisponible');
        }
        showToast(msg);
        return false;
      } finally {
        setTradeSubmitting(false);
      }
    },
    [
      sessionToken,
      ensureOnlineOrBlock,
      selectedCoin,
      spotNumericInput,
      spotOrderUnit,
      spotOrderUsdtEquiv,
      spotOrderCryptoEquiv,
      salomaFees.tradeFeePct,
      clientUsdtBalance,
      clientSelectedCryptoBalance,
      activeTrades,
      loadDashboard,
      showToast,
      setIsOnline
    ]
  );

  const handleExecuteTrade = useCallback(
    async (side: 'BUY' | 'SELL', mode = 'Manuel'): Promise<boolean> => {
      if (tradingModeType === 'SPOT' && mode === 'Manuel') {
        return handleExecuteSpotOrder(side);
      }
      if (!sessionToken) return false;
      if (!(await ensureOnlineOrBlock())) return false;

      const feeRate = (salomaFees.tradeFeePct || 0.1) / 100;
      const estimatedFeeAr = Math.round(numericAmountAr * feeRate);
      const totalRequiredAr = numericAmountAr + estimatedFeeAr;

      if (numericAmountAr < MIN_TRADE_AR) {
        showToast(`Min : 5$ (${MIN_TRADE_AR.toLocaleString('fr-FR')} Ar).`);
        return false;
      }
      if (soldeCompteTradeAr <= 0 || totalRequiredAr > soldeCompteTradeAr) {
        showToast(
          `Solde Compte Trade insuffisant (Requis : ${totalRequiredAr.toLocaleString('fr-FR')} Ar dont Frais SALOMA ${salomaFees.tradeFeePct}% = ${estimatedFeeAr.toLocaleString('fr-FR')} Ar).`
        );
        return false;
      }

      setTradeSubmitting(true);
      try {
        const lev = tradingModeType === 'SPOT' ? 1 : numericLeverage;
        await apiRequest('/api/trades', {
          method: 'POST',
          token: sessionToken,
          body: {
            paire: `${selectedCoin.symbol}/USDT`,
            type: side === 'BUY' ? 'achat' : 'vente',
            montant: numericAmountAr,
            prix: selectedCoin.price,
            leverage: lev,
            mode
          }
        });
        await loadDashboard(sessionToken);
        showToast(
          `${mode !== 'Manuel' ? `[AUTO] ` : ''}${side === 'BUY' ? 'BUY' : 'SELL'} x${lev} • Frais SALOMA ${salomaFees.tradeFeePct}% = ${estimatedFeeAr.toLocaleString('fr-FR')} Ar`
        );
        return true;
      } catch (err) {
        if ((err as ApiError)?.isNetworkError) {
          setIsOnline(false);
          setOfflineBlocked(true);
        }
        showToast(err instanceof Error ? err.message : 'Erreur création trade.');
        return false;
      } finally {
        setTradeSubmitting(false);
      }
    },
    [
      tradingModeType,
      handleExecuteSpotOrder,
      sessionToken,
      ensureOnlineOrBlock,
      salomaFees.tradeFeePct,
      soldeCompteTradeAr,
      numericAmountAr,
      numericLeverage,
      selectedCoin,
      loadDashboard,
      showToast,
      setIsOnline
    ]
  );

  const handleToggleAutoTrade = async (side: 'BUY' | 'SELL') => {
    if (side === 'BUY' && autoBuyEnabled) {
      setAutoBuyEnabled(false);
      showToast('Mode AUTO BUY désactivé');
      return;
    }
    if (side === 'SELL' && autoSellEnabled) {
      setAutoSellEnabled(false);
      showToast('Mode AUTO SELL désactivé');
      return;
    }
    if (!(await ensureOnlineOrBlock())) return;

    if (tradingModeType === 'SPOT') {
      const minSpotCoinQty = computeMinCoinForUsd(selectedCoin.price, selectedCoin.symbol, MIN_SPOT_USD);
      const isSpotMinValid =
        spotOrderUsdtEquiv >= MIN_SPOT_USD ||
        (spotOrderUnit === 'CRYPTO' &&
          minSpotCoinQty > 0 &&
          spotNumericInput >= Number((minSpotCoinQty * 0.99).toFixed(8)) &&
          spotOrderUsdtEquiv >= 0.985);
      if (side === 'BUY') {
        if (!isSpotMinValid) {
          showToast('Min : 1$ (1.00 USDT).');
          return;
        }
        if (spotOrderUsdtEquiv > clientUsdtBalance) {
          showToast('Solde USDT SALOMA insuffisant pour AUTO BUY.');
          return;
        }
        setAutoBuyEnabled(true);
        showToast(`🤖 AUTO BUY Spot activé sur ${selectedCoin.symbol}/USDT`);
        void handleExecuteSpotOrder('BUY');
      } else {
        if (!isSpotMinValid) {
          showToast('Min : 1$ (1.00 USDT).');
          return;
        }
        if (spotOrderCryptoEquiv > clientSelectedCryptoBalance) {
          showToast(`Solde ${selectedCoin.symbol} SALOMA insuffisant pour AUTO SELL.`);
          return;
        }
        setAutoSellEnabled(true);
        showToast(`🤖 AUTO SELL Spot activé sur ${selectedCoin.symbol}/USDT`);
        void handleExecuteSpotOrder('SELL');
      }
      return;
    }

    if (numericAmountAr < MIN_TRADE_AR) {
      showToast(`Min : 5$ (${MIN_TRADE_AR.toLocaleString('fr-FR')} Ar).`);
      return;
    }
    if (soldeCompteTradeAr <= 0 || numericAmountAr > soldeCompteTradeAr) {
      showToast('Solde Compte Trade insuffisant. Convertissez depuis votre Wallet vers Compte Trade.');
      return;
    }

    if (side === 'BUY') {
      setAutoBuyEnabled(true);
      showToast(`🤖 AUTO BUY activé sur ${selectedCoin.symbol}/USDT`);
      void handleExecuteTrade('BUY', 'Auto Buy');
    } else {
      setAutoSellEnabled(true);
      showToast(`🤖 AUTO SELL activé sur ${selectedCoin.symbol}/USDT`);
      void handleExecuteTrade('SELL', 'Auto Sell');
    }
  };

  useEffect(() => {
    if (
      screen !== 'main' ||
      activeTab !== 'trading' ||
      !isOnline ||
      offlineBlocked ||
      (!autoBuyEnabled && !autoSellEnabled)
    ) {
      return;
    }

    const timer = setInterval(async () => {
      if (autoTradeBusyRef.current) return;
      autoTradeBusyRef.current = true;
      try {
        if (autoBuyEnabled) {
          const okBuy =
            tradingModeType === 'SPOT'
              ? await handleExecuteSpotOrder('BUY')
              : await handleExecuteTrade('BUY', 'Auto Buy');
          if (!okBuy) {
            setAutoBuyEnabled(false);
          }
        }
        if (autoSellEnabled) {
          const okSell =
            tradingModeType === 'SPOT'
              ? await handleExecuteSpotOrder('SELL')
              : await handleExecuteTrade('SELL', 'Auto Sell');
          if (!okSell) {
            setAutoSellEnabled(false);
          }
        }
      } finally {
        autoTradeBusyRef.current = false;
      }
    }, 15000);

    return () => clearInterval(timer);
  }, [
    screen,
    activeTab,
    isOnline,
    offlineBlocked,
    autoBuyEnabled,
    autoSellEnabled,
    tradingModeType,
    handleExecuteSpotOrder,
    handleExecuteTrade
  ]);

  const handleStartBot = async () => {
    if (!sessionToken) return;
    if (!(await ensureOnlineOrBlock())) return;
    if (soldeCompteTradeAr <= 0 || numericBotAmountAr > soldeCompteTradeAr) {
      showToast('Solde Compte Trade insuffisant. Convertissez depuis votre Wallet vers Compte Trade.');
      return;
    }
    if (numericBotAmountAr < MIN_TRADE_AR) {
      showToast(`Min : 5$ (${MIN_TRADE_AR.toLocaleString('fr-FR')} Ar).`);
      return;
    }

    setBotSubmitting(true);
    const botLabel = `Spot Grid Bot (${botGridProfile})`;

    try {
      await apiRequest('/api/trades', {
        method: 'POST',
        token: sessionToken,
        body: {
          paire: `${selectedCoin.symbol}/USDT`,
          type: 'achat',
          montant: numericBotAmountAr,
          prix: selectedCoin.price,
          leverage: 1,
          mode: botLabel
        }
      });
      await loadDashboard(sessionToken);
      showToast(`🤖 Spot Grid Bot démarré sur ${selectedCoin.symbol}/USDT !`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur démarrage du bot.');
    } finally {
      setBotSubmitting(false);
    }
  };

  const handleClosePosition = async (trade: AppwriteTradeRow) => {
    if (!sessionToken) return;
    if (!(await ensureOnlineOrBlock())) return;
    try {
      const isHedgeSpot = (trade.mode || '').startsWith('Hedge');
      if (isHedgeSpot) {
        const res = await apiRequest<{
          ok: boolean;
          pnlUsdt: number;
          creditUsdt: number;
        }>(`/api/exchange/sell/${trade.$id}`, {
          method: 'POST',
          token: sessionToken
        });
        await loadDashboard(sessionToken);
        const sign = (res.pnlUsdt || 0) >= 0 ? '+' : '';
        showToast(
          `✓ SELL / CLOSE ${trade.paire} — Crédité : ${Number(res.creditUsdt || 0).toFixed(4)} USDT (PnL net : ${sign}${Number(res.pnlUsdt || 0).toFixed(4)} USDT)`
        );
        return;
      }

      const curPrice = getLivePriceForPair(trade.paire, trade.prix);
      const res = await apiRequest<{
        trade: AppwriteTradeRow;
        pnlUsdt?: number;
        creditUsdt?: number;
      }>(`/api/trades/${trade.$id}/close`, {
        method: 'POST',
        token: sessionToken,
        body: { currentPrice: curPrice }
      });
      await loadDashboard(sessionToken);
      const p = Number(res.trade.profit) || 0;
      showToast(`Position clôturée — Profit : ${p >= 0 ? '+' : ''}${p.toLocaleString('fr-FR')} Ar (Compte Trade)`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de la clôture.');
    }
  };

  // --- ÉCHANGE BYBIT STYLE (SWAP AR <-> CRYPTO & CRYPTO <-> CRYPTO, FRAIS 0.1%) ---
  const [swapFromSym, setSwapFromSym] = useState<string>('AR');
  const [swapToSym, setSwapToSym] = useState<string>('BTC');
  const [swapAmountInput, setSwapAmountInput] = useState<string>('');
  const [exchangeSubmitting, setExchangeSubmitting] = useState<boolean>(false);

  const exchangeCurrencies = useMemo(() => {
    const arCurrency = { symbol: 'AR', label: 'Ar (Ariary)', priceUsd: 1 / USD_TO_MGA };
    const cryptoCurrencies = coins.map(c => ({
      symbol: c.symbol.toUpperCase(),
      label: c.symbol.toUpperCase(),
      priceUsd: c.price
    }));
    return [arCurrency, ...cryptoCurrencies];
  }, [coins]);

  const getAvailableExchangeBalance = useCallback(
    (sym: string) => {
      if (sym.toUpperCase() === 'AR') return soldeDisponibleAr;
      return coinsJson[sym.toUpperCase()] || 0;
    },
    [soldeDisponibleAr, coinsJson]
  );

  const fromCurrencyObj = useMemo(
    () => exchangeCurrencies.find(c => c.symbol === swapFromSym) || exchangeCurrencies[0],
    [exchangeCurrencies, swapFromSym]
  );
  const toCurrencyObj = useMemo(
    () => exchangeCurrencies.find(c => c.symbol === swapToSym) || exchangeCurrencies[1],
    [exchangeCurrencies, swapToSym]
  );

  const handleFlipExchangePair = () => {
    const prevFrom = swapFromSym;
    setSwapFromSym(swapToSym);
    setSwapToSym(prevFrom);
  };

  const handleExecuteExchange = async () => {
    if (!sessionToken) return;
    if (!(await ensureOnlineOrBlock())) return;

    const amt = parseDecimalValue(swapAmountInput);
    if (isNaN(amt) || amt <= 0) {
      showToast('Veuillez saisir un montant valide.');
      return;
    }
    if (fromCurrencyObj.symbol === toCurrencyObj.symbol) {
      showToast('Choisissez deux devises différentes.');
      return;
    }

    const avail = getAvailableExchangeBalance(fromCurrencyObj.symbol);
    const displaySym = fromCurrencyObj.symbol === 'AR' ? 'Ar' : fromCurrencyObj.symbol;
    if (amt > avail) {
      showToast(
        `Solde ${displaySym} insuffisant (Disponible : ${avail.toLocaleString('fr-FR', {
          maximumFractionDigits: 6
        })} ${displaySym}).`
      );
      return;
    }

    setExchangeSubmitting(true);
    try {
      await apiRequest('/api/exchanges', {
        method: 'POST',
        token: sessionToken,
        body: {
          de_devise: fromCurrencyObj.symbol,
          vers_devise: toCurrencyObj.symbol,
          montant_envoye: amt,
          fromPriceUsd: fromCurrencyObj.priceUsd,
          toPriceUsd: toCurrencyObj.priceUsd
        }
      });
      await loadDashboard(sessionToken);
      setSwapAmountInput('');
      showToast('✓ Échange réussi');
    } catch (err) {
      if ((err as ApiError)?.isNetworkError) {
        setIsOnline(false);
        setOfflineBlocked(true);
      }
      if (isApiNotFoundError(err)) {
        showToast('Service d’échange temporairement indisponible. Réessayez.');
      } else {
        showToast(err instanceof Error ? err.message : 'Erreur lors de l’échange.');
      }
    } finally {
      setExchangeSubmitting(false);
    }
  };

  // --- DÉPÔTS & RETRAITS CRYPTO UNIQUEMENT (50 COINS + CHAÎNE & RÉSEAU) ---
  const [depositAmountInput, setDepositAmountInput] = useState<string>('');
  const [depositAccountInput, setDepositAccountInput] = useState<string>('');
  const [depositPreuveInput, setDepositPreuveInput] = useState<string>('');
  const [depositSubmitting, setDepositSubmitting] = useState<boolean>(false);
  const [copiedDepositAddress, setCopiedDepositAddress] = useState<boolean>(false);

  const [withdrawAmountInput, setWithdrawAmountInput] = useState<string>('');
  const [withdrawAccountInput, setWithdrawAccountInput] = useState<string>('');
  const [withdrawSubmitting, setWithdrawSubmitting] = useState<boolean>(false);

  // --- CONVERTIR INTERNE (WALLET <-> COMPTE TRADE) ---
  const [convertDirection, setConvertDirection] = useState<'WALLET_TO_TRADE' | 'TRADE_TO_WALLET'>('WALLET_TO_TRADE');
  const [convertAmountInput, setConvertAmountInput] = useState<string>('');
  const [convertSubmitting, setConvertSubmitting] = useState<boolean>(false);

  const handleConfirmConvertWalletTrade = async () => {
    if (!sessionToken) return;
    if (!(await ensureOnlineOrBlock())) return;
    const amt = Math.round(Number(convertAmountInput));
    if (isNaN(amt) || amt < 100) {
      showToast('Montant minimum de conversion : 100 Ar.');
      return;
    }
    const maxAvail = convertDirection === 'WALLET_TO_TRADE' ? soldeDisponibleAr : soldeCompteTradeAr;
    if (amt > maxAvail) {
      showToast(
        convertDirection === 'WALLET_TO_TRADE'
          ? 'Solde WALLET insuffisant.'
          : 'Solde COMPTE TRADE disponible insuffisant.'
      );
      return;
    }

    setConvertSubmitting(true);
    try {
      await apiRequest('/api/wallet/convert', {
        method: 'POST',
        token: sessionToken,
        body: {
          direction: convertDirection,
          amount: amt
        }
      });
      await loadDashboard(sessionToken);
      setConvertAmountInput('');
      setActiveModal(null);
      showToast(
        convertDirection === 'WALLET_TO_TRADE'
          ? `✓ ${amt.toLocaleString('fr-FR')} Ar transféré vers Compte Trade !`
          : `✓ ${amt.toLocaleString('fr-FR')} Ar transféré vers Wallet !`
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de la conversion.');
    } finally {
      setConvertSubmitting(false);
    }
  };

  const handleOpenDeposit = () => {
    setIsWalletCoinDropdownOpen(false);
    setWalletCoinSearchTerm('');
    setCopiedDepositAddress(false);
    setActiveModal('deposit');
    if (!activeClientDepositAddress) {
      setWalletAddressRetryCount(c => c + 1);
    }
  };

  const handleOpenWithdraw = () => {
    const effectiveKycLevel = Math.max(
      userRow?.kyc_level ?? 0,
      userRow?.email_verifie ? 1 : 0,
      userRow?.kyc_statut === 'valide' ? 2 : 0
    );
    if (effectiveKycLevel < 1) {
      showToast('Veuillez vérifier votre email (KYC Niveau 1) avant de retirer');
      setActiveModal('kyc');
      return;
    }
    setIsWalletCoinDropdownOpen(false);
    setWalletCoinSearchTerm('');
    withdrawTurnstileTokenRef.current = '';
    setWithdrawTurnstileReset(k => k + 1);
    setActiveModal('withdraw');
  };

  const handleConfirmDepositRequest = async () => {
    if (!sessionToken) return;
    if (!(await ensureOnlineOrBlock())) return;
    const coinSym = selectedWalletCoin.symbol.toUpperCase();
    const amt = parseFloat(depositAmountInput);
    if (isNaN(amt) || amt < Number((activeMinDepositCoinQty * 0.98).toFixed(8))) {
      showToast(`Min Dépôt : 1$ équivalent (${activeMinDepositCoinQtyLabel} ${coinSym}).`);
      return;
    }
    if (!depositAccountInput.trim() || depositAccountInput.trim().length < 6) {
      showToast('Veuillez entrer le TX Hash de votre transaction blockchain.');
      return;
    }

    setDepositSubmitting(true);
    try {
      await apiRequest('/api/wallet/deposit', {
        method: 'POST',
        token: sessionToken,
        body: {
          montant: amt,
          methode: 'Crypto',
          numero_compte: depositAccountInput.trim(),
          devise: coinSym,
          chain: activeBlockchain,
          networkCode: activeNetwork.chain,
          networkLabel: activeNetworkLabel,
          priceUsd: selectedWalletCoin.price || 0,
          preuve: depositPreuveInput.trim()
        }
      });
      await loadDashboard(sessionToken);
      setDepositAmountInput('');
      setDepositAccountInput('');
      setDepositPreuveInput('');
      setActiveModal(null);
      showToast('✓ Dépôt reçu - en attente de validation');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors du dépôt.');
    } finally {
      setDepositSubmitting(false);
    }
  };

  const handleConfirmWithdraw = async () => {
    if (!sessionToken) return;
    if (!(await ensureOnlineOrBlock())) return;
    const coinSym = selectedWalletCoin.symbol.toUpperCase();
    const amt = parseFloat(withdrawAmountInput);
    const withdrawRate = (salomaFees.withdrawFeePct || 0.15) / 100;
    const salomaWithdrawFee = (amt || 0) * withdrawRate;
    const totalFrais = salomaWithdrawFee + effectiveWalletNetworkFee;
    if (isNaN(amt) || amt <= totalFrais) {
      showToast(
        `Le montant doit dépasser les frais (Frais SALOMA ${salomaFees.withdrawFeePct}% + Frais Réseau ${effectiveWalletNetworkFee} ${coinSym}).`
      );
      return;
    }
    if (amt < Number((activeMinCoinQty * 0.98).toFixed(8))) {
      showToast(`Min Retrait : 1$ équivalent (${activeMinCoinQtyLabel} ${coinSym}).`);
      return;
    }

    const coinPrice = selectedWalletCoin.price || 0;
    const withdrawUsd = coinSym === 'USDT' ? amt : amt * coinPrice;
    const effectiveKycLevel = Math.max(
      userRow?.kyc_level ?? 0,
      userRow?.email_verifie ? 1 : 0,
      userRow?.kyc_statut === 'valide' ? 2 : 0
    );
    if (withdrawUsd > KYC_LEVEL2_WITHDRAW_THRESHOLD_USD && effectiveKycLevel < 2) {
      showToast('Retrait supérieur à 1 000$ : vérification KYC Niveau 2 requise.');
      setActiveModal('kyc');
      return;
    }

    if (!withdrawAccountInput.trim() || withdrawAccountInput.trim().length < 6) {
      showToast(`Veuillez entrer une adresse de réception ${coinSym} (${activeBlockchain} • ${activeNetworkLabel}) valide.`);
      return;
    }
    if (isKnownTokenContractAddress(withdrawAccountInput)) {
      showToast('Adresse refusée : ceci est une adresse de contrat token, pas une adresse wallet.');
      return;
    }
    setWithdrawSubmitting(true);
    try {
      const sendWithdraw = async (tok: string) =>
        apiRequest('/api/wallet/withdraw', {
          method: 'POST',
          token: sessionToken,
          body: {
            montant: amt,
            methode: 'Crypto',
            numero_compte: withdrawAccountInput.trim(),
            devise: coinSym,
            chain: activeBlockchain,
            networkCode: activeNetwork.chain,
            networkLabel: activeNetworkLabel,
            priceUsd: coinPrice,
            turnstileToken: tok
          }
        });

      const tok = await waitForTurnstileToken(withdrawTurnstileTokenRef, () =>
        setWithdrawTurnstileReset(k => k + 1)
      );

      try {
        await sendWithdraw(tok);
      } catch (err) {
        if (isTurnstileRetryError(err)) {
          withdrawTurnstileTokenRef.current = '';
          setWithdrawTurnstileReset(k => k + 1);
          const freshTok = await waitForTurnstileToken(withdrawTurnstileTokenRef, () =>
            setWithdrawTurnstileReset(k => k + 1)
          );
          await sendWithdraw(freshTok);
        } else {
          throw err;
        }
      }

      await loadDashboard(sessionToken);
      setWithdrawAmountInput('');
      setWithdrawAccountInput('');
      withdrawTurnstileTokenRef.current = '';
      setWithdrawTurnstileReset(k => k + 1);
      setActiveModal(null);
      showToast('✓ Retrait en cours');
    } catch (err) {
      withdrawTurnstileTokenRef.current = '';
      setWithdrawTurnstileReset(k => k + 1);
      if ((err as ApiError)?.requiresKycLevel2) {
        setActiveModal('kyc');
      }
      showToast(err instanceof Error ? err.message : 'Erreur lors du retrait.');
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  // --- EARN RÉEL (earn + Wallets) ---
  const [earnLoadingId, setEarnLoadingId] = useState<string | null>(null);
  const [watchingVideoId, setWatchingVideoId] = useState<string | null>(null);
  const [videoCountdown, setVideoCountdown] = useState<number>(0);
  const [epargneAmountInput, setEpargneAmountInput] = useState<string>('');
  const [earnWithdrawLoading, setEarnWithdrawLoading] = useState<null | 'profit' | 'fund'>(null);
  const [earnClockMs, setEarnClockMs] = useState<number>(() => Date.now());

  useEffect(() => {
    if (activeTab !== 'earn') return;
    setEarnClockMs(Date.now());
    const t = setInterval(() => setEarnClockMs(Date.now()), 5000);
    return () => clearInterval(t);
  }, [activeTab]);

  const welcomeGiftClaimed = useMemo(
    () => earnList.some(e => e.task_id === 'welcome-gift'),
    [earnList]
  );

  const completedVideoIds = useMemo(
    () => new Set(earnList.map(e => e.task_id).filter(Boolean)),
    [earnList]
  );

  const totalEarnAr = useMemo(
    () =>
      earnList
        .filter(e => e.type_gain !== 'epargne' && e.type_gain !== 'retrait_fond')
        .reduce((s, e) => s + (Number(e.montant) || 0), 0),
    [earnList]
  );

  const epargnePlans = useMemo(
    () => earnList.filter(e => e.type_gain === 'epargne'),
    [earnList]
  );

  const fondEpargneAr = useMemo(() => {
    const deposited = earnList
      .filter(e => e.type_gain === 'epargne')
      .reduce((s, e) => s + (Number(e.montant) || 0), 0);
    const withdrawn = earnList
      .filter(e => e.type_gain === 'retrait_fond')
      .reduce((s, e) => s + (Number(e.montant) || 0), 0);
    const remaining = Math.max(0, Math.round(deposited - withdrawn));
    return Math.min(remaining, Math.round(soldeBloqueAr));
  }, [earnList, soldeBloqueAr]);

  const profitEarnDisponibleAr = useMemo(() => {
    let totalEpargne = 0;
    let totalFondRetire = 0;
    let totalProfitRetire = 0;
    let rawAccrued = 0;
    for (const row of earnList) {
      const amt = Number(row.montant) || 0;
      if (row.type_gain === 'epargne') {
        totalEpargne += amt;
        const ts = Date.parse(row.date || '');
        if (!Number.isNaN(ts)) {
          const elapsedMs = Math.max(0, earnClockMs - ts);
          rawAccrued += (amt * 0.08 * elapsedMs) / (365 * 86400 * 1000);
        }
      } else if (row.type_gain === 'retrait_fond') {
        totalFondRetire += amt;
      } else if (row.type_gain === 'retrait_profit') {
        totalProfitRetire += amt;
      }
    }
    const remaining = Math.max(0, totalEpargne - totalFondRetire);
    const activeRatio = totalEpargne > 0 ? Math.max(0, Math.min(1, remaining / totalEpargne)) : 0;
    return Math.max(0, Math.floor(rawAccrued * activeRatio - totalProfitRetire));
  }, [earnList, earnClockMs]);

  const earnBalanceCurve = useMemo(() => {
    const sorted = [...earnList].sort((a, b) => {
      const ta = Date.parse(a.date || '') || 0;
      const tb = Date.parse(b.date || '') || 0;
      return ta - tb;
    });
    const points: Array<{
      value: number;
      delta: number;
      label: string;
      dateLabel: string;
      isDown: boolean;
    }> = [{ value: 0, delta: 0, label: 'Départ', dateLabel: '', isDown: false }];

    let running = 0;
    for (const row of sorted) {
      const amt = Number(row.montant) || 0;
      const isWithdraw = row.type_gain === 'retrait_fond' || row.type_gain === 'retrait_profit';
      const delta = isWithdraw ? -amt : amt;
      running = Math.max(0, running + delta);
      points.push({
        value: running,
        delta,
        label: row.description || row.type_gain,
        dateLabel: row.date ? new Date(row.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '',
        isDown: delta < 0
      });
    }
    if (profitEarnDisponibleAr > 0) {
      running += profitEarnDisponibleAr;
      points.push({
        value: running,
        delta: profitEarnDisponibleAr,
        label: 'Profit accumulé (8%/an)',
        dateLabel: 'Live',
        isDown: false
      });
    }
    return points;
  }, [earnList, profitEarnDisponibleAr]);

  const handleWithdrawEarnProfit = async () => {
    if (!sessionToken || earnWithdrawLoading) return;
    if (!(await ensureOnlineOrBlock())) return;
    setEarnWithdrawLoading('profit');
    try {
      const res = await apiRequest<{ amount: number }>('/api/earn/withdraw-profit', {
        method: 'POST',
        token: sessionToken
      });
      await loadDashboard(sessionToken);
      showToast(`✓ Profit retiré : +${Number(res.amount || 0).toLocaleString('fr-FR')} Ar → Wallet`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Aucun profit disponible à retirer.');
    } finally {
      setEarnWithdrawLoading(null);
    }
  };

  const handleWithdrawEarnFund = async () => {
    if (!sessionToken || earnWithdrawLoading) return;
    if (!(await ensureOnlineOrBlock())) return;
    setEarnWithdrawLoading('fund');
    try {
      const res = await apiRequest<{ amount: number }>('/api/earn/withdraw-fund', {
        method: 'POST',
        token: sessionToken
      });
      await loadDashboard(sessionToken);
      showToast(`✓ Fond Épargne retiré : +${Number(res.amount || 0).toLocaleString('fr-FR')} Ar → Wallet`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Aucun fond disponible à retirer.');
    } finally {
      setEarnWithdrawLoading(null);
    }
  };

  const claimEarnReward = useCallback(
    async (payload: { type_gain: string; montant: number; description: string; task_id?: string }) => {
      if (!sessionToken) return;
      if (!(await ensureOnlineOrBlock())) return;
      setEarnLoadingId(payload.task_id || payload.type_gain);
      try {
        await apiRequest('/api/earn/claim', {
          method: 'POST',
          token: sessionToken,
          body: payload
        });
        await loadDashboard(sessionToken);
        if (payload.type_gain === 'epargne') {
          showToast(`✓ Épargne activée : ${payload.montant.toLocaleString('fr-FR')} Ar`);
        } else {
          showToast(`🎁 Nouveau gain Earn : +${payload.montant.toLocaleString('fr-FR')} Ar`);
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Erreur Earn.');
      } finally {
        setEarnLoadingId(null);
      }
    },
    [sessionToken, ensureOnlineOrBlock, loadDashboard, showToast]
  );

  useEffect(() => {
    if (!watchingVideoId || !isOnline || offlineBlocked) return;
    if (videoCountdown <= 0) {
      const doneTask = VIDEO_TASKS_CATALOG.find(v => v.id === watchingVideoId);
      setWatchingVideoId(null);
      if (doneTask && !completedVideoIds.has(doneTask.id)) {
        claimEarnReward({
          type_gain: 'video',
          montant: doneTask.rewardAr,
          description: `Tâche vidéo : ${doneTask.title}`,
          task_id: doneTask.id
        });
      }
      return;
    }
    const timer = setTimeout(() => setVideoCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [watchingVideoId, videoCountdown, completedVideoIds, claimEarnReward, isOnline, offlineBlocked]);

  // --- SUPPRESSION COMPLÈTE DES HISTORIQUES (TRADE / PORTEFEUILLE / EARN) ---
  const [clearHistoryTarget, setClearHistoryTarget] = useState<null | 'trade' | 'wallet' | 'earn'>(null);
  const [clearHistorySubmitting, setClearHistorySubmitting] = useState<boolean>(false);

  const handleConfirmClearHistory = async () => {
    if (!sessionToken || !clearHistoryTarget) return;
    if (!(await ensureOnlineOrBlock())) return;
    const target = clearHistoryTarget;
    const endpoint =
      target === 'trade'
        ? '/api/trades/history'
        : target === 'wallet'
        ? '/api/wallet/history'
        : '/api/earn/history';

    setClearHistorySubmitting(true);
    try {
      const res = await apiRequest<{ ok: boolean; deletedCount?: number; skippedPendingCount?: number }>(endpoint, {
        method: 'DELETE',
        token: sessionToken
      });
      await loadDashboard(sessionToken);
      setClearHistoryTarget(null);

      if (target === 'wallet') {
        if ((res.deletedCount || 0) === 0 && (res.skippedPendingCount || 0) > 0) {
          showToast('Aucune transaction clôturée à supprimer (les demandes en attente restent actives).');
        } else if ((res.skippedPendingCount || 0) > 0) {
          showToast('✓ Historique Portefeuille supprimé (demandes en attente conservées).');
        } else {
          showToast('✓ Historique Portefeuille supprimé !');
        }
      } else if (target === 'trade') {
        showToast('✓ Historique Trade supprimé !');
      } else {
        showToast('✓ Historique Earn supprimé !');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de la suppression.');
    } finally {
      setClearHistorySubmitting(false);
    }
  };

  // --- SIGNALER PROBLÈME (problemes table) ---
  const [problemInput, setProblemInput] = useState<string>('');
  const [problemSubmitting, setProblemSubmitting] = useState<boolean>(false);
  const [whatsappCopied, setWhatsappCopied] = useState<boolean>(false);

  const handleSubmitProblem = async () => {
    if (!(await ensureOnlineOrBlock())) return;
    const trimmed = problemInput.trim();
    if (!trimmed) {
      showToast('Veuillez décrire votre problème en texte avant d’envoyer.');
      return;
    }
    if (!sessionToken) return;
    setProblemSubmitting(true);
    try {
      await apiRequest('/api/problemes', {
        method: 'POST',
        token: sessionToken,
        body: { message: trimmed }
      });
      setProblemInput('');
      setActiveModal(null);
      showToast('✓ Problème envoyé ! L’équipe SALOMA Admin l’a reçu.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de l’envoi.');
    } finally {
      setProblemSubmitting(false);
    }
  };

  // --- KYC LEVEL 2 REAL UPDATE (CIN + ADRESSE + CODE POSTAL) ---
  const [kycSubmitting, setKycSubmitting] = useState(false);
  const [kycCinInput, setKycCinInput] = useState('');
  const [kycAdresseInput, setKycAdresseInput] = useState('');
  const [kycCodePostalInput, setKycCodePostalInput] = useState('');

  useEffect(() => {
    if (activeModal === 'kyc' && userRow) {
      setKycCinInput(userRow.kyc_cin || '');
      setKycAdresseInput(userRow.kyc_adresse || '');
      setKycCodePostalInput(userRow.kyc_code_postal || '');
    }
  }, [activeModal, userRow]);

  const handleValidateKyc = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!sessionToken) return;
    if (!(await ensureOnlineOrBlock())) return;
    const cin = kycCinInput.trim();
    const adresse = kycAdresseInput.trim();
    const code_postal = kycCodePostalInput.trim();

    if (!cin || cin.length < 4) {
      showToast('Veuillez saisir un numéro CIN valide (min 4 caractères).');
      return;
    }
    if (!adresse || adresse.length < 4) {
      showToast('Veuillez saisir votre adresse complète.');
      return;
    }
    if (!code_postal || code_postal.length < 2) {
      showToast('Veuillez saisir votre code postal.');
      return;
    }

    setKycSubmitting(true);
    try {
      const res = await apiRequest<{ user: AppwriteUserRow }>('/api/me/kyc', {
        method: 'POST',
        token: sessionToken,
        body: { cin, adresse, code_postal }
      });
      setUserRow(res.user);
      await loadDashboard(sessionToken);
      showToast('✓ Pièces KYC envoyées ! En attente de validation Admin.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur envoi KYC.');
    } finally {
      setKycSubmitting(false);
    }
  };

  // --- ADMIN PANEL (100% REAL APPWRITE DATA) ---
  const [adminTab, setAdminTab] = useState<'overview' | 'kyc' | 'profit' | 'trading' | 'wallet' | 'adminWallet' | 'apis' | 'security'>('overview');
  const [adminKycActionId, setAdminKycActionId] = useState<string | null>(null);
  const [adminProfitPeriod, setAdminProfitPeriod] = useState<'jour' | 'semaine' | 'mois' | 'total'>('jour');
  const [adminPin, setAdminPin] = useState<string>('');
  const [adminEmail, setAdminEmail] = useState<string>('');
  const [adminSessionToken, setAdminSessionToken] = useState<string>('');
  const [adminUnlockEmail, setAdminUnlockEmail] = useState<string>('');
  const [adminUnlockEmailCode, setAdminUnlockEmailCode] = useState<string>('');
  const [adminChallengeToken, setAdminChallengeToken] = useState<string>('');
  const [adminOtpSecondsLeft, setAdminOtpSecondsLeft] = useState<number>(0);
  const [adminEmailSending, setAdminEmailSending] = useState<boolean>(false);
  const [adminEmailSentTo, setAdminEmailSentTo] = useState<string>('');
  const [adminEmailCooldown, setAdminEmailCooldown] = useState<number>(0);
  const [adminUnlockInput1, setAdminUnlockInput1] = useState<string>('');
  const [adminUnlockError, setAdminUnlockError] = useState<string>('');
  const [adminUnlockLoading, setAdminUnlockLoading] = useState<boolean>(false);

  const [adminUsers, setAdminUsers] = useState<AppwriteUserRow[]>([]);
  const [adminTransactions, setAdminTransactions] = useState<AppwriteDepotRetraitRow[]>([]);
  const [adminOwnWallet, setAdminOwnWallet] = useState<AdminWalletRow | null>(null);
  const [adminOwnWalletTxs, setAdminOwnWalletTxs] = useState<AdminWalletTxRow[]>([]);
  const [adminOwnWalletAddresses, setAdminOwnWalletAddresses] = useState<Record<string, string>>({});
  const [adminTrades, setAdminTrades] = useState<AppwriteTradeRow[]>([]);
  const [adminEchanges, setAdminEchanges] = useState<AppwriteEchangeRow[]>([]);
  const [adminProblems, setAdminProblems] = useState<AppwriteProblemRow[]>([]);
  const [adminProfits, setAdminProfits] = useState<AdminProfitsSummary | null>(null);
  const [adminExchangeSummary, setAdminExchangeSummary] = useState<AdminExchangeSummary | null>(null);
  const [adminMarketComparison, setAdminMarketComparison] = useState<AdminMarketComparisonRow[]>([]);
  const [adminBybitStatus, setAdminBybitStatus] = useState<{
    online: boolean;
    latencyMs: number;
    updatedAt: number;
    primaryExchange?: 'BYBIT' | 'OKX' | 'BINANCE';
  } | null>(null);
  const [adminApisConfig, setAdminApisConfig] = useState<AdminApisConfig | null>(null);
  const [adminLiquidityAlerts, setAdminLiquidityAlerts] = useState<AdminLiquidityAlert[]>([]);
  const [apiFormInputs, setApiFormInputs] = useState<
    Record<'bybit' | 'okx' | 'binance', { apiKey: string; secret: string; passphrase: string }>
  >({
    bybit: { apiKey: '', secret: '', passphrase: '' },
    okx: { apiKey: '', secret: '', passphrase: '' },
    binance: { apiKey: '', secret: '', passphrase: '' }
  });
  const [apiMarginInputs, setApiMarginInputs] = useState<Record<'bybit' | 'okx' | 'binance', string>>({
    bybit: '0.1',
    okx: '0.1',
    binance: '0.1'
  });
  const [adminFeeInputs, setAdminFeeInputs] = useState<{
    bybitRecoveryMarginPct: string;
    tradeFeePct: string;
    exchangeFeePct: string;
    withdrawFeePct: string;
    networkFeeUsdt: string;
  }>({
    bybitRecoveryMarginPct: '0.1',
    tradeFeePct: '0.1',
    exchangeFeePct: '0.1',
    withdrawFeePct: '0.15',
    networkFeeUsdt: '0.50'
  });
  const [adminFeeSaving, setAdminFeeSaving] = useState<boolean>(false);
  const [adminBot3FeeEnabled, setAdminBot3FeeEnabled] = useState<boolean>(false);
  const [adminBot3FeeSaving, setAdminBot3FeeSaving] = useState<boolean>(false);
  const [sponsorConnectionStatus, setSponsorConnectionStatus] = useState<
    Record<
      'bybit' | 'okx' | 'binance',
      {
        connected: boolean;
        usdtBalance: number;
        source?: string;
        message?: string;
        loading: boolean;
        tested: boolean;
      }
    >
  >({
    bybit: { connected: false, usdtBalance: 0, loading: false, tested: false },
    okx: { connected: false, usdtBalance: 0, loading: false, tested: false },
    binance: { connected: false, usdtBalance: 0, loading: false, tested: false }
  });
  const [apiActionLoading, setApiActionLoading] = useState<string | null>(null);

  const [adminLoading, setAdminLoading] = useState<boolean>(false);
  const [filterOnlyProblems, setFilterOnlyProblems] = useState<boolean>(false);

  const [oldCodeInput, setOldCodeInput] = useState<string>('');
  const [newCodeInput1, setNewCodeInput1] = useState<string>('');
  const [newCodeInput2, setNewCodeInput2] = useState<string>('');
  const [codeChangeMsg, setCodeChangeMsg] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    if (adminEmailCooldown <= 0) return;
    const t = setTimeout(() => setAdminEmailCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [adminEmailCooldown]);

  useEffect(() => {
    if (adminOtpSecondsLeft <= 0) return;
    const t = setTimeout(() => setAdminOtpSecondsLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [adminOtpSecondsLeft]);

  const formatOtpCountdown = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const sendAdminEmailCode = useCallback(
    async (rawEmail: string) => {
      const cleanEmail = rawEmail.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(cleanEmail)) {
        setAdminUnlockError('Veuillez entrer un email administrateur valide.');
        return;
      }
      if (adminEmailSending || adminEmailCooldown > 0) return;
      if (!(await ensureOnlineOrBlock())) return;

      setAdminUnlockError('');
      setAdminEmailSending(true);
      try {
        const res = await apiRequest<{
          success?: boolean;
          ok?: boolean;
          challengeToken: string;
          email: string;
          expiresInSeconds?: number;
          message?: string;
        }>('/api/admin/send-code', {
          method: 'POST',
          body: { email: cleanEmail }
        });
        setAdminChallengeToken(res.challengeToken || '');
        setAdminEmailSentTo(cleanEmail);
        setAdminEmailCooldown(60);
        setAdminOtpSecondsLeft(res.expiresInSeconds || 120);
        showToast('Code envoyé - Vérifiez votre email (valide 2 min)');
      } catch (err) {
        setAdminEmailSentTo('');
        setAdminChallengeToken('');
        setAdminOtpSecondsLeft(0);
        setAdminUnlockError(
          err instanceof Error
            ? err.message
            : "Impossible d'envoyer le code de vérification par email."
        );
      } finally {
        setAdminEmailSending(false);
      }
    },
    [adminEmailCooldown, adminEmailSending, ensureOnlineOrBlock, showToast]
  );

  const fetchAdminOverview = useCallback(
    async (pin: string, email: string, tokenOverride?: string) => {
      setAdminLoading(true);
      try {
        const data = await apiRequest<{
          users: AppwriteUserRow[];
          transactions: AppwriteDepotRetraitRow[];
          trades: AppwriteTradeRow[];
          echanges: AppwriteEchangeRow[];
          problemes: AppwriteProblemRow[];
          profits?: AdminProfitsSummary;
          exchangeSummary?: AdminExchangeSummary;
          marketComparison?: AdminMarketComparisonRow[];
          apis?: AdminApisConfig;
          salomaFees?: AdminSalomaFeesConfig;
          liquidityAlerts?: AdminLiquidityAlert[];
          adminWallet?: AdminWalletRow;
          adminWalletTransactions?: AdminWalletTxRow[];
          adminWalletAddresses?: Record<string, string>;
          bybitStatus?: {
            online: boolean;
            latencyMs: number;
            updatedAt: number;
            primaryExchange?: 'BYBIT' | 'OKX' | 'BINANCE';
          };
        }>('/api/admin/overview', {
          adminPin: pin,
          adminEmail: email,
          adminToken: tokenOverride ?? adminSessionToken
        });

        setAdminUsers(data.users || []);
        setAdminTransactions(data.transactions || []);
        if (data.adminWallet) {
          setAdminOwnWallet(data.adminWallet);
        }
        if (Array.isArray(data.adminWalletTransactions)) {
          setAdminOwnWalletTxs(data.adminWalletTransactions);
        }
        if (data.adminWalletAddresses && typeof data.adminWalletAddresses === 'object') {
          setAdminOwnWalletAddresses(data.adminWalletAddresses);
        }
        setAdminTrades(data.trades || []);
        setAdminEchanges(data.echanges || []);
        setAdminProblems(data.problemes || []);
        setAdminProfits(data.profits || null);
        setAdminExchangeSummary(data.exchangeSummary || null);
        setAdminMarketComparison(data.marketComparison || []);
        setAdminLiquidityAlerts(data.liquidityAlerts || []);
        if (data.salomaFees) {
          setAdminFeeInputs({
            bybitRecoveryMarginPct: String(data.salomaFees.bybitRecoveryMarginPct ?? 0.1),
            tradeFeePct: String(data.salomaFees.tradeFeePct ?? 0.1),
            exchangeFeePct: String(data.salomaFees.exchangeFeePct ?? 0.1),
            withdrawFeePct: String(data.salomaFees.withdrawFeePct ?? 0.15),
            networkFeeUsdt: String(data.salomaFees.networkFeeUsdt ?? 0.5)
          });
          setAdminBot3FeeEnabled(Boolean(data.salomaFees.bot3FeeEnabled ?? false));
          setSalomaFees({
            tradeFeePct: Number(data.salomaFees.tradeFeePct ?? 0.1),
            exchangeFeePct: Number(data.salomaFees.exchangeFeePct ?? 0.1),
            withdrawFeePct: Number(data.salomaFees.withdrawFeePct ?? 0.15),
            networkFeeUsdt: Number(data.salomaFees.networkFeeUsdt ?? 0.5)
          });
        }
        if (data.apis) {
          setAdminApisConfig(data.apis);
          const nextMargins: Record<'bybit' | 'okx' | 'binance', string> = {
            bybit: '0.1',
            okx: '0.1',
            binance: '0.1'
          };
          for (const prov of data.apis.providers || []) {
            if (prov.id === 'bybit' || prov.id === 'okx' || prov.id === 'binance') {
              nextMargins[prov.id] = String(prov.marginPct ?? 0.1);
            }
          }
          setApiMarginInputs(nextMargins);
        }
        setAdminBybitStatus(data.bybitStatus || null);
      } catch (err) {
        if (!isApiNotFoundError(err)) {
          throw err;
        }
      } finally {
        setAdminLoading(false);
      }
    },
    [adminSessionToken]
  );

  const handleClearLiquidityAlert = useCallback(
    async (alertId?: string) => {
      try {
        const res = await apiRequest<{ ok: boolean; liquidityAlerts: AdminLiquidityAlert[] }>(
          '/api/admin/liquidity-alerts/clear',
          {
            method: 'POST',
            adminPin,
            adminEmail,
            adminToken: adminSessionToken,
            body: alertId ? { id: alertId } : {}
          }
        );
        setAdminLiquidityAlerts(res.liquidityAlerts || []);
        showToast('Alerte liquidité marquée comme résolue');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Erreur résolution alerte.');
      }
    },
    [adminPin, adminEmail, adminSessionToken, showToast]
  );

  const handleTestSponsorConnection = useCallback(
    async (provider: 'bybit' | 'okx' | 'binance') => {
      setSponsorConnectionStatus(prev => ({
        ...prev,
        [provider]: { ...prev[provider], loading: true }
      }));
      try {
        const form = apiFormInputs[provider];
        const bodyPayload: Record<string, string> = {};
        if (form?.apiKey?.trim()) bodyPayload.apiKey = form.apiKey.trim();
        if (form?.secret?.trim()) bodyPayload.secret = form.secret.trim();
        if (form?.passphrase?.trim()) bodyPayload.passphrase = form.passphrase.trim();

        const res = await apiRequest<{
          sponsor?: string;
          connected: boolean;
          usdtBalance: number;
          source?: string;
          retCode?: number;
          retMsg?: string;
          httpStatus?: number;
          error?: string;
          message?: string;
          liquidityAlerts?: AdminLiquidityAlert[];
        }>(`/api/${provider}/status`, {
          method: 'POST',
          adminPin,
          adminEmail,
          adminToken: adminSessionToken,
          body: bodyPayload
        });
        const detailMsg =
          res.retCode !== undefined && res.retMsg && res.retCode !== 0
            ? `${res.retMsg} (code ${res.retCode})`
            : res.error || res.message;
        setSponsorConnectionStatus(prev => ({
          ...prev,
          [provider]: {
            connected: Boolean(res.connected),
            usdtBalance: Number(res.usdtBalance) || 0,
            source: res.source,
            message: detailMsg,
            loading: false,
            tested: true
          }
        }));
        if (Array.isArray(res.liquidityAlerts)) {
          setAdminLiquidityAlerts(res.liquidityAlerts);
        }
      } catch (err) {
        setSponsorConnectionStatus(prev => ({
          ...prev,
          [provider]: {
            connected: false,
            usdtBalance: 0,
            message: err instanceof Error ? err.message : 'Erreur test connexion.',
            loading: false,
            tested: true
          }
        }));
      }
    },
    [adminPin, adminEmail, adminSessionToken, apiFormInputs]
  );

  useEffect(() => {
    if (screen === 'admin' && adminTab === 'apis') {
      void handleTestSponsorConnection('bybit');
      void handleTestSponsorConnection('okx');
      void handleTestSponsorConnection('binance');
    }
  }, [screen, adminTab, handleTestSponsorConnection]);

  const handleAdminSaveApiKeys = async (provider: 'bybit' | 'okx' | 'binance') => {
    if (!(await ensureOnlineOrBlock())) return;
    const form = apiFormInputs[provider];
    const cleanKey = form.apiKey.trim();
    const cleanSecret = form.secret.trim();
    const cleanPassphrase = form.passphrase.trim();
    if (!cleanKey && !cleanSecret && !cleanPassphrase) {
      showToast('Veuillez saisir au moins une clé ou secret à mettre à jour.');
      return;
    }
    setApiActionLoading(`save-${provider}`);

    const persistAdminFallbackMeta = (mode: string) => {
      try {
        const storageKey = 'saloma_admin_api_fallback_v1';
        const existingRaw = window.localStorage.getItem(storageKey);
        const existing = existingRaw ? (JSON.parse(existingRaw) as Record<string, unknown>) : {};
        const maskedPreview =
          cleanKey.length > 8
            ? `${cleanKey.slice(0, 4)}****${cleanKey.slice(-4)}`
            : cleanKey
              ? '****'
              : '';
        existing[provider] = {
          mode,
          hasApiKey: Boolean(cleanKey),
          apiKeyMasked: maskedPreview,
          hasSecret: Boolean(cleanSecret),
          hasPassphrase: Boolean(cleanPassphrase),
          updatedAt: Date.now()
        };
        window.localStorage.setItem(storageKey, JSON.stringify(existing));
      } catch {
        // ignore storage quota errors
      }
    };

    try {
      const res = await apiRequest<{
        success?: boolean;
        mode?: string;
        message?: string;
        apis?: AdminApisConfig;
      }>(`/api/admin/apis/${provider}`, {
        method: 'POST',
        adminPin,
        adminEmail,
        adminToken: adminSessionToken,
        body: {
          apiKey: cleanKey,
          secret: cleanSecret,
          passphrase: cleanPassphrase
        }
      });

      if (res.apis) {
        setAdminApisConfig(res.apis);
      }
      persistAdminFallbackMeta(res.mode || 'fallback_local');
      setApiFormInputs(prev => ({
        ...prev,
        [provider]: { apiKey: '', secret: '', passphrase: '' }
      }));

      if (res.mode === 'fallback_local') {
        showToast('Clés prises en compte pour cette session - à mettre aussi dans Vercel');
      } else {
        showToast(res.message || 'Clés enregistrées ✅');
      }
      void handleTestSponsorConnection(provider);
    } catch (err) {
      console.error(`[SALOMA Admin] Erreur sauvegarde ${provider}:`, err);
      persistAdminFallbackMeta('fallback_local');
      setApiFormInputs(prev => ({
        ...prev,
        [provider]: { apiKey: '', secret: '', passphrase: '' }
      }));
      showToast('Clés prises en compte pour cette session - à mettre aussi dans Vercel');
    } finally {
      setApiActionLoading(null);
    }
  };

  const handleAdminSaveFees = async () => {
    if (!(await ensureOnlineOrBlock())) return;
    const parseNum = (s: string) => Number(String(s || '').replace(',', '.'));
    const bybitRecoveryMarginPct = parseNum(adminFeeInputs.bybitRecoveryMarginPct);
    const tradeFeePct = parseNum(adminFeeInputs.tradeFeePct);
    const exchangeFeePct = parseNum(adminFeeInputs.exchangeFeePct);
    const withdrawFeePct = parseNum(adminFeeInputs.withdrawFeePct);
    const networkFeeUsdt = parseNum(adminFeeInputs.networkFeeUsdt);

    if (
      !Number.isFinite(bybitRecoveryMarginPct) ||
      bybitRecoveryMarginPct < 0 ||
      bybitRecoveryMarginPct > 5 ||
      !Number.isFinite(tradeFeePct) ||
      tradeFeePct < 0 ||
      tradeFeePct > 5 ||
      !Number.isFinite(exchangeFeePct) ||
      exchangeFeePct < 0 ||
      exchangeFeePct > 5 ||
      !Number.isFinite(withdrawFeePct) ||
      withdrawFeePct < 0 ||
      withdrawFeePct > 5
    ) {
      showToast('Les pourcentages (%) doivent être compris entre 0 et 5%.');
      return;
    }
    if (!Number.isFinite(networkFeeUsdt) || networkFeeUsdt < 0 || networkFeeUsdt > 100) {
      showToast('Frais Réseau (USDT) doit être compris entre 0 et 100 USDT.');
      return;
    }

    setAdminFeeSaving(true);
    try {
      const res = await apiRequest<{
        success?: boolean;
        ok?: boolean;
        error?: string;
        message?: string;
        salomaFees?: AdminSalomaFeesConfig;
        apis?: AdminApisConfig;
        marketComparison?: AdminMarketComparisonRow[];
      }>('/api/admin/fees', {
        method: 'POST',
        adminPin,
        adminEmail,
        adminToken: adminSessionToken,
        body: {
          bybitRecoveryMarginPct,
          tradeFeePct,
          exchangeFeePct,
          withdrawFeePct,
          networkFeeUsdt
        }
      });
      if (res.success === false || res.ok === false) {
        showToast(res.error || res.message || 'Erreur sauvegarde frais Admin.');
        return;
      }
      if (res.salomaFees) {
        setAdminFeeInputs({
          bybitRecoveryMarginPct: String(res.salomaFees.bybitRecoveryMarginPct),
          tradeFeePct: String(res.salomaFees.tradeFeePct),
          exchangeFeePct: String(res.salomaFees.exchangeFeePct),
          withdrawFeePct: String(res.salomaFees.withdrawFeePct),
          networkFeeUsdt: String(res.salomaFees.networkFeeUsdt)
        });
        setAdminBot3FeeEnabled(Boolean(res.salomaFees.bot3FeeEnabled ?? false));
        setSalomaFees({
          tradeFeePct: res.salomaFees.tradeFeePct,
          exchangeFeePct: res.salomaFees.exchangeFeePct,
          withdrawFeePct: res.salomaFees.withdrawFeePct,
          networkFeeUsdt: res.salomaFees.networkFeeUsdt
        });
        setApiMarginInputs(prev => ({
          ...prev,
          bybit: String(res.salomaFees!.bybitRecoveryMarginPct)
        }));
      }
      if (res.apis) setAdminApisConfig(res.apis);
      if (res.marketComparison) setAdminMarketComparison(res.marketComparison);
      showToast(res.message || '✓ Frais SALOMA & Marge récupération Bybit mis à jour !');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur sauvegarde frais Admin.');
    } finally {
      setAdminFeeSaving(false);
    }
  };

  const handleToggleAdminBot3Fee = async () => {
    if (!(await ensureOnlineOrBlock())) return;
    if (adminBot3FeeSaving) return;
    const nextEnabled = !adminBot3FeeEnabled;
    setAdminBot3FeeSaving(true);
    try {
      const res = await apiRequest<{
        success?: boolean;
        ok?: boolean;
        bot3FeeEnabled?: boolean;
        error?: string;
        message?: string;
      }>('/api/admin/bot3-fee', {
        method: 'POST',
        adminPin,
        adminEmail,
        adminToken: adminSessionToken,
        body: { enabled: nextEnabled }
      });
      if (res.success === false || res.ok === false) {
        showToast(res.error || res.message || 'Erreur mise à jour Frais SALOMA BOT 3.');
        return;
      }
      setAdminBot3FeeEnabled(Boolean(res.bot3FeeEnabled ?? nextEnabled));
      showToast(
        res.message ||
          (nextEnabled
            ? '✓ Frais SALOMA 0.1% - BOT 3 activé (ON)'
            : '✓ Frais SALOMA 0.1% - BOT 3 désactivé (OFF — 0 frais)')
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur mise à jour Frais SALOMA BOT 3.');
    } finally {
      setAdminBot3FeeSaving(false);
    }
  };

  const handleAdminSaveApiMargin = async (provider: 'bybit' | 'okx' | 'binance') => {
    if (!(await ensureOnlineOrBlock())) return;
    const parsed = Number(String(apiMarginInputs[provider] || '').replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 5) {
      showToast('La Marge % doit être comprise entre 0 et 5%.');
      return;
    }
    setApiActionLoading(`margin-${provider}`);
    try {
      const form = apiFormInputs[provider];
      const res = await apiRequest<{
        success?: boolean;
        ok?: boolean;
        connected?: boolean;
        error?: string;
        message?: string;
        apis?: AdminApisConfig;
        salomaFees?: AdminSalomaFeesConfig;
        marketComparison?: AdminMarketComparisonRow[];
      }>(`/api/admin/apis/${provider}/margin`, {
        method: 'POST',
        adminPin,
        adminEmail,
        adminToken: adminSessionToken,
        body: {
          marginPct: parsed,
          ...(form?.apiKey?.trim() ? { apiKey: form.apiKey.trim() } : {}),
          ...(form?.secret?.trim() ? { secret: form.secret.trim() } : {})
        }
      });
      if (res.apis) setAdminApisConfig(res.apis);
      if (res.marketComparison) {
        setAdminMarketComparison(res.marketComparison);
      }
      if (res.salomaFees) {
        setAdminFeeInputs(prev => ({
          ...prev,
          bybitRecoveryMarginPct: String(res.salomaFees!.bybitRecoveryMarginPct)
        }));
      }
      if (res.success === false || res.ok === false) {
        showToast(res.error || res.message || 'Connexion BYBIT requise avant d’appliquer.');
        return;
      }
      const savedEntry = res.apis?.providers.find(p => p.id === provider);
      if (savedEntry) {
        setApiMarginInputs(prev => ({ ...prev, [provider]: String(savedEntry.marginPct ?? parsed) }));
      }
      showToast(res.message || `✓ Marge ${provider.toUpperCase()} mise à jour (${parsed}%) !`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur mise à jour marge.');
    } finally {
      setApiActionLoading(null);
    }
  };

  const handleAdminToggleApi = async (provider: 'bybit' | 'okx' | 'binance', nextEnabled: boolean) => {
    if (!(await ensureOnlineOrBlock())) return;
    setApiActionLoading(`toggle-${provider}`);
    try {
      const form = apiFormInputs[provider];
      const res = await apiRequest<{
        success?: boolean;
        ok?: boolean;
        connected?: boolean;
        error?: string;
        message?: string;
        apis?: AdminApisConfig;
        marketComparison?: AdminMarketComparisonRow[];
      }>(`/api/admin/apis/${provider}/toggle`, {
        method: 'POST',
        adminPin,
        adminEmail,
        adminToken: adminSessionToken,
        body: {
          enabled: nextEnabled,
          ...(form?.apiKey?.trim() ? { apiKey: form.apiKey.trim() } : {}),
          ...(form?.secret?.trim() ? { secret: form.secret.trim() } : {}),
          ...(form?.passphrase?.trim() ? { passphrase: form.passphrase.trim() } : {})
        }
      });
      if (res.apis) setAdminApisConfig(res.apis);
      if (res.marketComparison) setAdminMarketComparison(res.marketComparison);
      if (res.success === false || res.ok === false) {
        showToast(res.error || res.message || `Connexion ${provider.toUpperCase()} requise.`);
        return;
      }
      showToast(res.message || `${provider.toUpperCase()} ${nextEnabled ? 'activée' : 'désactivée'}.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Action impossible.');
    } finally {
      setApiActionLoading(null);
    }
  };

  const handleAdminSetPrimaryApi = async (provider: 'bybit' | 'okx' | 'binance') => {
    if (!(await ensureOnlineOrBlock())) return;
    setApiActionLoading(`primary-${provider}`);
    try {
      const res = await apiRequest<{
        success?: boolean;
        ok?: boolean;
        error?: string;
        message?: string;
        apis?: AdminApisConfig;
        salomaFees?: AdminSalomaFeesConfig;
        marketComparison?: AdminMarketComparisonRow[];
        bybitStatus?: {
          online: boolean;
          latencyMs: number;
          updatedAt: number;
          primaryExchange?: 'BYBIT' | 'OKX' | 'BINANCE';
        };
      }>('/api/admin/apis/primary', {
        method: 'POST',
        adminPin,
        adminEmail,
        adminToken: adminSessionToken,
        body: { primaryApi: provider }
      });
      if (res.apis) setAdminApisConfig(res.apis);
      if (res.marketComparison) setAdminMarketComparison(res.marketComparison);
      if (res.bybitStatus) setAdminBybitStatus(res.bybitStatus);
      if (res.salomaFees) {
        setAdminFeeInputs({
          bybitRecoveryMarginPct: String(res.salomaFees.bybitRecoveryMarginPct),
          tradeFeePct: String(res.salomaFees.tradeFeePct),
          exchangeFeePct: String(res.salomaFees.exchangeFeePct),
          withdrawFeePct: String(res.salomaFees.withdrawFeePct),
          networkFeeUsdt: String(res.salomaFees.networkFeeUsdt)
        });
      }
      if (res.success === false || res.ok === false) {
        showToast(res.error || res.message || 'Erreur sélection API principale.');
        return;
      }
      setActiveBrokerExchange(provider.toUpperCase() as 'BYBIT' | 'OKX' | 'BINANCE');
      showToast(res.message || `★ ${provider.toUpperCase()} définie comme API principale pour les ordres !`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur sélection API principale.');
    } finally {
      setApiActionLoading(null);
    }
  };

  const handleAdminUnlock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAdminUnlockError('');
    if (!(await ensureOnlineOrBlock())) return;

    const cleanEmail = adminUnlockEmail.trim().toLowerCase();
    const cleanEmailCode = adminUnlockEmailCode.trim();
    const cleanCode = adminUnlockInput1.trim();

    if (!cleanEmail || !cleanEmailCode || !cleanCode) {
      setAdminUnlockError(
        'Veuillez saisir Email, Code 6 chiffres reçu par email et Code à 9 chiffres.'
      );
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setAdminUnlockError('Adresse e-mail administrateur invalide.');
      return;
    }
    if (!/^\d{6}$/.test(cleanEmailCode)) {
      setAdminUnlockError('Le code reçu par email doit contenir exactement 6 chiffres.');
      return;
    }
    if (!/^\d{9}$/.test(cleanCode)) {
      setAdminUnlockError('Le code de sécurité administrateur doit contenir exactement 9 chiffres.');
      return;
    }
    if (!adminChallengeToken) {
      setAdminUnlockError('Veuillez d\'abord cliquer sur "Envoyer" pour recevoir le code à 6 chiffres par email.');
      return;
    }
    if (adminOtpSecondsLeft <= 0) {
      setAdminUnlockError('Code expiré, demandez un nouveau code');
      return;
    }

    setAdminUnlockLoading(true);
    try {
      const res = await apiRequest<{
        success?: boolean;
        ok?: boolean;
        email: string;
        adminSessionToken?: string;
      }>('/api/admin/verify', {
        method: 'POST',
        body: {
          email: cleanEmail,
          emailCode: cleanEmailCode,
          code: cleanCode,
          challengeToken: adminChallengeToken
        }
      });
      const verifiedEmail = (res.email || cleanEmail).trim().toLowerCase();
      const issuedAdminToken = res.adminSessionToken || '';

      setAdminPin(cleanCode);
      setAdminEmail(verifiedEmail);
      setAdminSessionToken(issuedAdminToken);
      await fetchAdminOverview(cleanCode, verifiedEmail, issuedAdminToken);
      setAdminUnlockEmail('');
      setAdminUnlockEmailCode('');
      setAdminChallengeToken('');
      setAdminOtpSecondsLeft(0);
      setAdminEmailSentTo('');
      setAdminUnlockInput1('');
      setActiveModal(null);
      setScreen('admin');
      showToast('Accès Administrateur Déverrouillé');
    } catch (err) {
      setAdminPin('');
      setAdminEmail('');
      setAdminSessionToken('');
      setAdminUnlockError(
        err instanceof Error
          ? err.message
          : 'Accès refusé : Email, Code 6 chiffres ou Code 9 chiffres incorrect.'
      );
    } finally {
      setAdminUnlockLoading(false);
    }
  };

  const handleAdminValidateTx = async (tx: AppwriteDepotRetraitRow) => {
    if (!(await ensureOnlineOrBlock())) return;
    const coinMatch = coins.find(c => c.symbol.toUpperCase() === (tx.devise || '').toUpperCase());
    try {
      await apiRequest(`/api/admin/transactions/${tx.$id}/validate`, {
        method: 'POST',
        adminPin,
        adminEmail,
        adminToken: adminSessionToken,
        body: { priceUsd: coinMatch ? coinMatch.price : 0 }
      });
      await fetchAdminOverview(adminPin, adminEmail);
      if (sessionToken) await loadDashboard(sessionToken);
      showToast('✓ Transaction validée dans Appwrite !');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur validation.');
    }
  };

  const handleAdminRejectTx = async (tx: AppwriteDepotRetraitRow) => {
    if (!(await ensureOnlineOrBlock())) return;
    const coinMatch = coins.find(c => c.symbol.toUpperCase() === (tx.devise || '').toUpperCase());
    try {
      await apiRequest(`/api/admin/transactions/${tx.$id}/reject`, {
        method: 'POST',
        adminPin,
        adminEmail,
        adminToken: adminSessionToken,
        body: { priceUsd: coinMatch ? coinMatch.price : 0 }
      });
      await fetchAdminOverview(adminPin, adminEmail);
      if (sessionToken) await loadDashboard(sessionToken);
      showToast('Transaction refusée.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur refus.');
    }
  };

  const handleAdminKycAction = async (userRowId: string, action: 'validate' | 'reject') => {
    if (!(await ensureOnlineOrBlock())) return;
    setAdminKycActionId(`${action}-${userRowId}`);
    try {
      await apiRequest(`/api/admin/kyc/${userRowId}/${action}`, {
        method: 'POST',
        adminPin,
        adminEmail,
        adminToken: adminSessionToken
      });
      await fetchAdminOverview(adminPin, adminEmail);
      if (sessionToken) await loadDashboard(sessionToken);
      showToast(action === 'validate' ? '✓ KYC client validé !' : 'KYC client refusé.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur action KYC.');
    } finally {
      setAdminKycActionId(null);
    }
  };

  const handleToggleProblemResolved = async (prob: AppwriteProblemRow) => {
    if (!(await ensureOnlineOrBlock())) return;
    const nextResolved = prob.statut !== 'resolu';
    try {
      await apiRequest(`/api/admin/problemes/${prob.$id}/toggle`, {
        method: 'POST',
        adminPin,
        adminEmail,
        adminToken: adminSessionToken,
        body: { resolved: nextResolved }
      });
      await fetchAdminOverview(adminPin, adminEmail);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur mise à jour.');
    }
  };

  const handleChangeAdminCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeChangeMsg(null);
    if (!(await ensureOnlineOrBlock())) return;
    if (!/^\d{9}$/.test(newCodeInput1) || newCodeInput1 !== newCodeInput2) {
      setCodeChangeMsg({ text: 'Le nouveau code doit comporter 9 chiffres identiques.', isError: true });
      return;
    }
    try {
      const res = await apiRequest<{ ok: boolean; adminSessionToken?: string }>('/api/admin/pin', {
        method: 'POST',
        adminPin: oldCodeInput,
        adminEmail,
        adminToken: adminSessionToken,
        body: { newPin: newCodeInput1 }
      });
      setAdminPin(newCodeInput1);
      if (res.adminSessionToken) {
        setAdminSessionToken(res.adminSessionToken);
      }
      setOldCodeInput('');
      setNewCodeInput1('');
      setNewCodeInput2('');
      setCodeChangeMsg({ text: 'Succès : Code administrateur 9 chiffres mis à jour !', isError: false });
      showToast('Code Administrateur modifié');
    } catch (err) {
      setCodeChangeMsg({
        text: err instanceof Error ? err.message : 'Ancien code administrateur incorrect.',
        isError: true
      });
    }
  };

  const realBuyPercent = useMemo(() => {
    if (adminTrades.length === 0) return 50;
    const buys = adminTrades.filter(t => t.type === 'achat').length;
    return Math.round((buys / adminTrades.length) * 100);
  }, [adminTrades]);

  const adminRealStats = useMemo(() => {
    const swapFeesUsd = adminEchanges.reduce((s, e) => s + (Number(e.frais) || 0), 0);
    const withdrawFeesAr = adminTransactions
      .filter(t => t.type === 'retrait' && t.devise === 'Ar')
      .reduce((s, t) => s + (Number(t.frais) || 0), 0);
    const pendingDeposits = adminTransactions.filter(t => t.statut === 'en_attente').length;
    return {
      swapFeesUsd,
      withdrawFeesAr,
      pendingDeposits,
      totalClients: adminUsers.length
    };
  }, [adminEchanges, adminTransactions, adminUsers]);

  // Logo secret 4x click
  const handleLogoClick = () => {
    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    const n = logoClicks + 1;
    if (n >= 4) {
      setLogoClicks(0);
      setAdminUnlockEmail('');
      setAdminUnlockEmailCode('');
      setAdminChallengeToken('');
      setAdminOtpSecondsLeft(0);
      setAdminEmailSentTo('');
      setAdminUnlockInput1('');
      setAdminUnlockError('');
      setActiveModal('adminUnlock');
    } else {
      setLogoClicks(n);
      clickTimeoutRef.current = setTimeout(() => setLogoClicks(0), 2000);
    }
  };

  // --- LIVE ORDER BOOK & CANDLESTICKS ---
  const orderBook = useMemo(() => {
    const mid = selectedCoin.price || 1;
    const step = mid * 0.0006;
    const asks = Array.from({ length: 5 }, (_, idx) => {
      const level = 5 - idx;
      const price = mid + step * level;
      const qty = Number(
        ((0.15 + ((idx * 17 + Math.round(mid)) % 19) * 0.08) * (mid > 100 ? 1 : 250)).toFixed(mid > 100 ? 3 : 1)
      );
      const depth = 25 + ((level * 14 + Math.round(mid)) % 70);
      return { price, qty, depth };
    });
    const bids = Array.from({ length: 5 }, (_, idx) => {
      const level = idx + 1;
      const price = Math.max(0.0000001, mid - step * level);
      const qty = Number(
        ((0.18 + ((idx * 13 + Math.round(mid)) % 17) * 0.09) * (mid > 100 ? 1 : 250)).toFixed(mid > 100 ? 3 : 1)
      );
      const depth = 28 + ((level * 16 + Math.round(mid)) % 68);
      return { price, qty, depth };
    });
    return { asks, bids, spread: (step * 2).toFixed(mid < 1 ? 5 : 2) };
  }, [selectedCoin.price]);

  const candlestickData = useMemo(() => {
    const base = selectedCoin.price;
    const candles = [];
    let cur = base * 0.985;
    const factor =
      selectedTimeframe === '1m'
        ? 0.005
        : selectedTimeframe === '5m'
        ? 0.009
        : selectedTimeframe === '15m'
        ? 0.015
        : selectedTimeframe === '1h'
        ? 0.022
        : selectedTimeframe === '4h'
        ? 0.035
        : 0.05;

    for (let i = 0; i < 26; i++) {
      const delta = (Math.sin(i * 0.8) * factor + Math.cos(i * 1.3) * factor * 0.45) * base;
      const open = cur;
      const close = cur + delta;
      const high = Math.max(open, close) + factor * 0.35 * base;
      const low = Math.min(open, close) - factor * 0.35 * base;
      candles.push({ open, close, high, low, isUp: close >= open });
      cur = close;
    }
    return candles;
  }, [selectedCoin.id, selectedCoin.price, selectedTimeframe]);

  const renderWalletCoinChainNetworkSelector = () => (
    <div className="space-y-3">
      {/* 1. COIN : MENU DÉROULANT AVEC RECHERCHE (50 COINS) */}
      <div className="relative">
        <label className="text-[11px] font-bold text-purple-300 block mb-1">
          1. Coin ({coins.length} Coins disponibles) :
        </label>
        <button
          type="button"
          onClick={() => {
            setIsWalletCoinDropdownOpen(!isWalletCoinDropdownOpen);
            setWalletCoinSearchTerm('');
          }}
          className="w-full px-3 py-2.5 rounded-xl bg-[#150D2E] border-2 border-[#8B5CF6]/70 text-white text-xs font-black flex items-center justify-between shadow-inner"
        >
          <span className="flex items-center gap-2 min-w-0">
            <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[10px] border shrink-0 ${selectedWalletCoin.iconBg}`}>
              {selectedWalletCoin.symbol.slice(0, 3)}
            </span>
            <span className="truncate">
              {selectedWalletCoin.symbol} • {selectedWalletCoin.name}
            </span>
          </span>
          <ChevronDown className={`w-4 h-4 text-purple-300 shrink-0 transition-transform ${isWalletCoinDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {isWalletCoinDropdownOpen && (
          <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-[#190F38] border-2 border-[#8B5CF6] rounded-2xl p-2.5 shadow-2xl max-h-60 flex flex-col gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-purple-300 absolute left-2.5 top-2.5" />
              <input
                type="text"
                autoFocus
                value={walletCoinSearchTerm}
                onChange={e => setWalletCoinSearchTerm(e.target.value)}
                placeholder="Rechercher parmi 50 coins (USDT, BTC, SOL, MATIC...)"
                className="w-full pl-8 pr-2.5 py-1.5 rounded-xl bg-[#100926] border border-purple-500/50 text-white text-xs focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>
            <div className="overflow-y-auto space-y-1 flex-1 pr-0.5">
              {filteredWalletCoins.length === 0 ? (
                <div className="text-center py-3 text-[11px] text-purple-400">Aucun coin trouvé</div>
              ) : (
                filteredWalletCoins.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedWalletCoinId(c.id);
                      setSelectedNetworkIndex(0);
                      setCopiedDepositAddress(false);
                      setIsWalletCoinDropdownOpen(false);
                      setWalletCoinSearchTerm('');
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition ${
                      selectedWalletCoinId === c.id
                        ? 'bg-[#7C3AED] text-white'
                        : 'bg-[#150D2E] text-purple-200 hover:bg-[#23154D]'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="font-black text-white">{c.symbol}</span>
                      <span className="text-[11px] opacity-80 truncate">{c.name}</span>
                    </span>
                    <span className="text-[10px] font-mono opacity-85 shrink-0 ml-2">
                      {getNetworkShortLabel(c.networks[0])}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. CHAÎNE & RÉSEAU : 2 MENUS DÉROULANTS VISIBLES */}
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="text-[11px] font-bold text-purple-300 block mb-1">
            2. Chaîne :
          </label>
          <select
            value={activeBlockchain}
            onChange={e => {
              const chosenChain = e.target.value;
              const matchIdx = selectedWalletCoin.networks.findIndex(
                n => getBlockchainFromNetwork(n) === chosenChain
              );
              setSelectedNetworkIndex(matchIdx >= 0 ? matchIdx : 0);
              setCopiedDepositAddress(false);
            }}
            className="w-full px-2.5 py-2.5 rounded-xl bg-[#150D2E] border-2 border-emerald-500/50 text-emerald-300 text-xs font-black focus:outline-none focus:border-emerald-400"
          >
            {availableBlockchains.map(chainName => (
              <option key={chainName} value={chainName} className="bg-[#150D2E] text-white">
                {chainName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold text-purple-300 block mb-1">
            3. Réseau :
          </label>
          <select
            value={selectedNetworkIndex < selectedWalletCoin.networks.length ? selectedNetworkIndex : 0}
            onChange={e => {
              setSelectedNetworkIndex(Number(e.target.value));
              setCopiedDepositAddress(false);
            }}
            className="w-full px-2.5 py-2.5 rounded-xl bg-[#150D2E] border-2 border-[#8B5CF6]/60 text-white text-xs font-black focus:outline-none focus:border-[#8B5CF6]"
          >
            {selectedWalletCoin.networks.map((net, idx) => (
              <option key={`${net.chain}-${idx}`} value={idx} className="bg-[#150D2E] text-white">
                {getNetworkShortLabel(net)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  const renderCoinSearchDropdown = (
    currentCoin: Coin,
    isOpen: boolean,
    setOpen: (v: boolean) => void,
    searchVal: string,
    setSearchVal: (v: string) => void,
    list: Coin[],
    onSelect: (c: Coin) => void
  ) => (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(!isOpen);
          setSearchVal('');
        }}
        className="w-full p-2.5 rounded-2xl bg-[#190F38] border-2 border-[#8B5CF6]/70 shadow-[0_0_16px_rgba(124,58,237,0.28)] flex items-center justify-between transition active:scale-[0.99]"
      >
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-[11px] border ${currentCoin.iconBg}`}>
            {currentCoin.symbol.slice(0, 3)}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-sm text-white">{currentCoin.symbol}/USDT</span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/60 text-emerald-300 text-[9px] font-black tracking-wider">
                <span className={`w-1.5 h-1.5 rounded-full bg-emerald-400 ${isWsLive ? 'animate-pulse' : 'opacity-60'}`} />
                LIVE
              </span>
              <span className="text-[10px] text-purple-300 font-medium truncate max-w-[90px]">{currentCoin.name}</span>
            </div>
            <span className="text-xs font-mono font-bold text-purple-200">
              ${formatCoinPrice(currentCoin.price)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md ${
              currentCoin.change24h >= 0
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-rose-500/20 text-rose-400'
            }`}
          >
            {currentCoin.change24h >= 0 ? '+' : ''}
            {currentCoin.change24h}%
          </span>
          <ChevronDown className={`w-4 h-4 text-purple-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-[#1D1240] border-2 border-[#8B5CF6] rounded-2xl p-2.5 shadow-2xl max-h-72 flex flex-col space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-purple-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Rechercher un coin (BTC, ETH, SOL, PEPE...)"
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              autoFocus
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#150D2E] border border-purple-500/40 text-white text-xs placeholder-purple-400/50 focus:outline-none focus:border-[#8B5CF6]"
            />
          </div>
          <div className="overflow-y-auto space-y-1 pr-1 flex-1">
            {list.map(coin => (
              <div
                key={coin.id}
                onClick={() => {
                  onSelect(coin);
                  setOpen(false);
                }}
                className={`p-2 rounded-xl flex items-center justify-between cursor-pointer transition ${
                  currentCoin.id === coin.id
                    ? 'bg-[#7C3AED] text-white shadow'
                    : 'bg-[#150D2E] hover:bg-[#23154D] text-purple-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[10px] border ${coin.iconBg}`}>
                    {coin.symbol.slice(0, 3)}
                  </div>
                  <div>
                    <span className="font-bold text-xs block">
                      {coin.symbol} <span className="opacity-75 font-normal">({coin.name})</span>
                    </span>
                    <span className="text-[10px] opacity-80 font-mono">${formatCoinPrice(coin.price)}</span>
                  </div>
                </div>
                <span className={`text-[10px] font-mono font-bold ${coin.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {coin.change24h >= 0 ? '+' : ''}
                  {coin.change24h}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  if (bootstrapping) {
    return (
      <div className="min-h-screen bg-[#150D2E] text-white flex flex-col items-center justify-center p-6 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#7C3AED] to-[#8B5CF6] flex items-center justify-center font-black text-3xl shadow-[0_0_30px_rgba(124,58,237,0.7)] animate-pulse">
          S
        </div>
        <span className="text-xs font-bold text-purple-300 tracking-wider">
          Chargement sécurisé de votre session SALOMA...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#150D2E] text-slate-100 flex flex-col justify-between selection:bg-[#7C3AED] selection:text-white relative">
      {/* VIOLET GLOW AMBIENT */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[580px] h-[340px] bg-gradient-to-b from-[#7C3AED]/35 via-[#8B5CF6]/15 to-transparent blur-3xl pointer-events-none z-0" />

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] max-w-[90vw] bg-[#1F1042]/95 border-2 border-[#8B5CF6] shadow-[0_0_25px_rgba(139,92,246,0.6)] backdrop-blur-md px-4 py-2 rounded-2xl flex items-center gap-2 text-xs font-bold text-purple-100">
          <Zap className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
      <OfflineIndicator
        blocked={!isOnline || offlineBlocked}
        onRetry={handleRetryConnectivity}
      />

      {/* ========================================================
          SPLASH SCREEN
         ======================================================== */}
      {screen === 'splash' && (
        <div className="min-h-screen flex flex-col justify-between p-6 max-w-md mx-auto w-full z-10 relative">
          <div className="flex justify-between items-center pt-2">
            <div className="flex items-center gap-2 cursor-pointer" onClick={handleLogoClick}>
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#7C3AED] via-[#8B5CF6] to-[#7C3AED] flex items-center justify-center font-black text-xl text-white shadow-[0_0_20px_rgba(124,58,237,0.8)] border border-purple-300/50">
                S
              </div>
              <span className="font-black tracking-widest text-2xl text-transparent bg-clip-text bg-gradient-to-r from-purple-100 via-white to-purple-200 drop-shadow-[0_0_15px_rgba(139,92,246,0.9)]">
                SALOMA
              </span>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#1F1042] text-purple-200 border border-[#8B5CF6]/50">
              FR / MG
            </span>
          </div>

          <div className="my-auto text-center flex flex-col items-center justify-center py-6">
            <div
              onClick={handleLogoClick}
              className="relative cursor-pointer group active:scale-95 transition-transform"
            >
              <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-[#7C3AED] via-[#8B5CF6] to-[#4C1D95] flex items-center justify-center shadow-[0_0_70px_rgba(139,92,246,0.8)] border-2 border-purple-300/60 relative animate-pulse-glow">
                <span className="text-6xl font-black text-white tracking-widest drop-shadow-lg">S</span>
                <div className="absolute -bottom-2.5 px-3 py-0.5 rounded-full bg-[#150D2E] border border-[#8B5CF6] text-[10px] font-black text-purple-200 tracking-wider shadow">
                  CRYPTO PRO
                </div>
              </div>
            </div>

            <h1 className="mt-7 text-4xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-100 to-purple-300 drop-shadow-[0_0_25px_rgba(139,92,246,0.9)]">
              SALOMA
            </h1>
            <p className="mt-1 text-xs font-semibold text-purple-300/80 tracking-wide">
              Échange Crypto & Trading Haingana sy Azo Antoka
            </p>

            <div className="grid grid-cols-4 gap-2 mt-8 w-full max-w-xs">
              <div className="bg-[#1F1042]/90 border border-[#8B5CF6]/50 p-2.5 rounded-2xl flex flex-col items-center">
                <ArrowRightLeft className="w-5 h-5 text-purple-300 mb-1" />
                <span className="text-[11px] font-bold text-white">Échange</span>
                <span className="text-[9px] text-purple-300/70">Pro</span>
              </div>
              <div className="bg-[#1F1042]/90 border border-[#8B5CF6]/50 p-2.5 rounded-2xl flex flex-col items-center">
                <Wallet className="w-5 h-5 text-[#8B5CF6] mb-1" />
                <span className="text-[11px] font-bold text-white">Wallet</span>
                <span className="text-[9px] text-purple-300/70">Poketra</span>
              </div>
              <div className="bg-[#1F1042]/90 border border-[#8B5CF6]/50 p-2.5 rounded-2xl flex flex-col items-center">
                <BarChart2 className="w-5 h-5 text-emerald-400 mb-1" />
                <span className="text-[11px] font-bold text-white">Trading</span>
                <span className="text-[9px] text-purple-300/70">x5</span>
              </div>
              <div className="bg-[#1F1042]/90 border border-[#8B5CF6]/50 p-2.5 rounded-2xl flex flex-col items-center">
                <Gift className="w-5 h-5 text-amber-400 mb-1" />
                <span className="text-[11px] font-bold text-white">Earn</span>
                <span className="text-[9px] text-purple-300/70">20% + 8%</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 pb-4">
            {appwriteStatusError && (
              <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-400/50 text-amber-200 text-xs font-bold text-center">
                {appwriteStatusError}
              </div>
            )}
            <button
              onClick={() => setScreen('login')}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#7C3AED] text-white font-extrabold text-sm shadow-[0_0_30px_rgba(124,58,237,0.7)] border-2 border-purple-300/50 flex items-center justify-center gap-2 active:scale-[0.98] transition"
            >
              <span>Se Connecter</span>
            </button>
            <button
              onClick={() => setScreen('signup')}
              className="w-full py-3.5 rounded-2xl bg-[#7C3AED]/25 hover:bg-[#7C3AED]/45 text-purple-100 text-sm font-bold border-2 border-[#8B5CF6] shadow-[0_0_15px_rgba(124,58,237,0.3)] transition"
            >
              Créer compte
            </button>
            <PWAInstallButton />
            <footer className="pt-2 text-center text-[11px] text-purple-300/80 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setScreen('conditions')}
                className="underline hover:text-white"
              >
                Conditions d&apos;utilisation
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => openPrivacyPolicy('splash')}
                className="underline hover:text-white font-semibold"
              >
                Politique de Confidentialité
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* ========================================================
          CRÉER COMPTE (APPWRITE AUTH + USERS_SALOMA + WALLETS)
         ======================================================== */}
      {screen === 'signup' && (
        <div className="min-h-screen p-5 max-w-md mx-auto w-full z-10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <button onClick={() => setScreen('splash')} className="p-2 rounded-xl bg-[#23154D] text-purple-300">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="text-center">
                <h2 className="font-black text-xl text-white">Créer compte SALOMA</h2>
                <span className="text-xs text-purple-300/80">Fisoratana anarana vaovao</span>
              </div>
              <div className="w-9" />
            </div>

            {appwriteStatusError && !signUpError && (
              <div className="p-3 mb-4 rounded-xl bg-amber-500/15 border border-amber-400/50 text-amber-200 text-xs font-bold">
                {appwriteStatusError}
              </div>
            )}

            {signUpError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold">
                {signUpError}
              </div>
            )}

            <form onSubmit={handleSignUpSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-purple-300 block mb-1">Nom *</label>
                  <input
                    type="text"
                    required
                    placeholder="Rakoto"
                    value={signUpData.nom}
                    onChange={e => setSignUpData({ ...signUpData, nom: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#1D1240] border-2 border-[#8B5CF6]/40 text-white placeholder-purple-400/50 focus:outline-none focus:border-[#8B5CF6]"
                  />
                </div>
                <div>
                  <label className="font-bold text-purple-300 block mb-1">Prénom</label>
                  <input
                    type="text"
                    placeholder="Nirina"
                    value={signUpData.prenom}
                    onChange={e => setSignUpData({ ...signUpData, prenom: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#1D1240] border-2 border-[#8B5CF6]/40 text-white placeholder-purple-400/50 focus:outline-none focus:border-[#8B5CF6]"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-purple-300 block mb-1">Email *</label>
                <input
                  type="email"
                  required
                  placeholder="nirina@gmail.com"
                  value={signUpData.email}
                  onChange={e => setSignUpData({ ...signUpData, email: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#1D1240] border-2 border-[#8B5CF6]/40 text-white placeholder-purple-400/50 focus:outline-none focus:border-[#8B5CF6]"
                />
              </div>

              <div>
                <label className="font-bold text-purple-300 block mb-1">Vérification Email *</label>
                <input
                  type="email"
                  required
                  placeholder="Confirmez votre email"
                  value={signUpData.confirmEmail}
                  onChange={e => setSignUpData({ ...signUpData, confirmEmail: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#1D1240] border-2 border-[#8B5CF6]/40 text-white placeholder-purple-400/50 focus:outline-none focus:border-[#8B5CF6]"
                />
                {signUpData.confirmEmail.length > 0 && (
                  <span
                    className={`text-[10px] font-bold block mt-1 ${
                      emailsMatch ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {emailsMatch ? '✓ Emails identiques' : '✗ Les deux adresses email doivent être identiques'}
                  </span>
                )}
                <span className="text-[10px] text-purple-300/75 block mt-1">
                  Un code de vérification à 6 chiffres sera envoyé à cet email après l’inscription.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-purple-300 block">Mot de passe *</label>
                <div className="relative">
                  <input
                    type={showSignUpPassword ? 'text' : 'password'}
                    required
                    placeholder="Ex: Saloma@2026"
                    value={signUpData.password}
                    onChange={e => setSignUpData({ ...signUpData, password: e.target.value })}
                    className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-[#1D1240] border-2 border-[#8B5CF6]/40 text-white placeholder-purple-400/50 focus:outline-none focus:border-[#8B5CF6]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignUpPassword(prev => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-purple-300 hover:text-white"
                  >
                    {showSignUpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="grid grid-cols-5 gap-1 h-1.5">
                  {[1, 2, 3, 4, 5].map(level => (
                    <div
                      key={level}
                      className={`rounded-full transition-colors ${
                        passwordChecks.score >= level
                          ? passwordChecks.score <= 2
                            ? 'bg-rose-500'
                            : passwordChecks.score <= 4
                            ? 'bg-amber-400'
                            : 'bg-emerald-500'
                          : 'bg-[#2A1A5E]'
                      }`}
                    />
                  ))}
                </div>
                {signUpData.password.length > 0 && passwordChecks.missing.length > 0 && (
                  <p className="text-[10px] font-bold text-rose-400">
                    Manque : {passwordChecks.missing.join(', ')}
                  </p>
                )}
              </div>

              <div>
                <label className="font-bold text-purple-300 block mb-1">Confirmer mot de passe *</label>
                <div className="relative">
                  <input
                    type={showSignUpConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder="Retapez le mot de passe"
                    value={signUpData.confirmPassword}
                    onChange={e => setSignUpData({ ...signUpData, confirmPassword: e.target.value })}
                    className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-[#1D1240] border-2 border-[#8B5CF6]/40 text-white placeholder-purple-400/50 focus:outline-none focus:border-[#8B5CF6]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignUpConfirmPassword(prev => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-purple-300 hover:text-white"
                  >
                    {showSignUpConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {signUpData.confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="text-[10px] font-bold text-rose-400 mt-1">
                    Les mots de passe ne correspondent pas
                  </p>
                )}
              </div>

              <div>
                <label className="font-bold text-purple-300 block mb-1">Pays d'origine</label>
                <select
                  value={signUpData.paysOrigine}
                  onChange={e => setSignUpData({ ...signUpData, paysOrigine: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#1D1240] border-2 border-[#8B5CF6]/40 text-white focus:outline-none focus:border-[#8B5CF6]"
                >
                  {COUNTRY_OPTIONS.map(country => (
                    <option key={country.label} value={country.label}>
                      {country.label} ({country.dialCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-purple-300 block mb-1">Téléphone *</label>
                <div className="flex items-center rounded-xl bg-[#1D1240] border-2 border-[#8B5CF6]/40 focus-within:border-[#8B5CF6] overflow-hidden">
                  <span className="px-3 py-2.5 bg-[#261654] text-purple-100 font-mono font-black border-r border-[#8B5CF6]/40 select-none shrink-0">
                    {selectedCountryOption.dialCode}
                  </span>
                  <input
                    type="tel"
                    inputMode="tel"
                    required
                    placeholder={selectedCountryOption.placeholder}
                    value={signUpData.numero}
                    onChange={e => {
                      const raw = e.target.value;
                      const stripped = raw.startsWith(selectedCountryOption.dialCode)
                        ? raw.slice(selectedCountryOption.dialCode.length)
                        : raw;
                      setSignUpData({ ...signUpData, numero: stripped.replace(/[^0-9 ]/g, '') });
                    }}
                    className="flex-1 min-w-0 px-3 py-2.5 bg-transparent text-white font-mono placeholder-purple-400/50 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-purple-300 block mb-1">Code parrainage (optionnel)</label>
                <input
                  type="text"
                  placeholder="Ex: SALOMA-ABC123"
                  value={signUpData.parrain}
                  onChange={e => setSignUpData({ ...signUpData, parrain: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#1D1240] border border-[#8B5CF6]/40 text-white placeholder-purple-400/50 focus:outline-none focus:border-[#8B5CF6]"
                />
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer bg-[#1D1240]/70 p-3 rounded-xl border border-[#8B5CF6]/30">
                <input
                  type="checkbox"
                  checked={signUpData.accepteConditions}
                  onChange={e => setSignUpData({ ...signUpData, accepteConditions: e.target.checked })}
                  className="mt-0.5 rounded border-[#8B5CF6] text-[#7C3AED] shrink-0"
                />
                <span className="text-xs text-purple-200 leading-snug">
                  J'accepte les{' '}
                  <button
                    type="button"
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      setScreen('conditions');
                    }}
                    className="text-[#A78BFA] font-black underline hover:text-white"
                  >
                    Conditions d'utilisation
                  </button>
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer bg-[#1D1240]/70 p-3 rounded-xl border border-[#8B5CF6]/30">
                <input
                  type="checkbox"
                  required
                  checked={signUpData.acceptePolitique}
                  onChange={e => setSignUpData({ ...signUpData, acceptePolitique: e.target.checked })}
                  className="mt-0.5 rounded border-[#8B5CF6] text-[#7C3AED] shrink-0"
                />
                <span className="text-xs text-purple-200 leading-snug">
                  J&apos;accepte la{' '}
                  <button
                    type="button"
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      openPrivacyPolicy('signup');
                    }}
                    className="text-[#A78BFA] font-black underline hover:text-white"
                  >
                    Politique de Confidentialité
                  </button>
                </span>
              </label>

              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => openPrivacyPolicy('signup')}
                  className="text-xs font-bold text-[#A78BFA] underline hover:text-white"
                >
                  Politique de confidentialité
                </button>
              </div>

              <TurnstileWidget
                siteKey={turnstileSiteKey}
                resetKey={signUpTurnstileReset}
                onVerify={tok => {
                  signUpTurnstileTokenRef.current = tok;
                }}
                onExpire={() => {
                  signUpTurnstileTokenRef.current = '';
                }}
              />

              <button
                type="submit"
                disabled={!canSubmitSignUp || signUpLoading}
                className="w-full mt-2 py-4 rounded-2xl bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#7C3AED] text-white font-black text-sm shadow-[0_0_25px_rgba(124,58,237,0.75)] disabled:opacity-45 disabled:cursor-not-allowed transition"
              >
                {signUpLoading ? 'Création du compte...' : "S'inscrire"}
              </button>
            </form>
          </div>

          <footer className="text-center pt-4">
            <button onClick={() => setScreen('login')} className="text-xs text-purple-300">
              Déjà un compte ? <span className="text-[#8B5CF6] font-bold underline">Se connecter</span>
            </button>
          </footer>
        </div>
      )}

      {/* ========================================================
          ÉCRAN OBLIGATOIRE : VÉRIFICATION PAR CODE EMAIL APPWRITE
         ======================================================== */}
      {screen === 'verifyEmail' && (
        <div className="min-h-screen p-6 max-w-md mx-auto w-full z-10 flex flex-col justify-between">
          <div className="my-auto bg-[#1D1240] border-2 border-[#8B5CF6] rounded-3xl p-6 space-y-5 shadow-[0_0_40px_rgba(124,58,237,0.45)]">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-[#7C3AED]/30 border-2 border-[#8B5CF6] flex items-center justify-center">
                <Mail className="w-7 h-7 text-purple-200" />
              </div>
              <h2 className="font-black text-xl text-white">Entrez le code reçu par email</h2>
              <p className="text-xs text-purple-200/80 leading-relaxed">
                Un code de sécurité à 6 chiffres a été envoyé à{' '}
                <strong className="text-white font-mono">{userRow?.email}</strong>. Vérifiez votre boîte de réception et vos spams.
              </p>
            </div>

            {verifyOtpError && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold text-center">
                {verifyOtpError}
              </div>
            )}

            <form onSubmit={handleVerifyEmailCode} className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                placeholder="000000"
                value={verifyOtpInput}
                onChange={e => {
                  setVerifyOtpInput(e.target.value.replace(/[^0-9]/g, ''));
                  setVerifyOtpError('');
                }}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#150D2E] border-2 border-[#8B5CF6]/60 text-white font-mono text-2xl font-black text-center tracking-[0.4em] focus:outline-none focus:border-[#8B5CF6]"
              />

              <button
                type="submit"
                disabled={verifyOtpLoading || verifyOtpInput.length !== 6}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white font-black text-sm shadow-[0_0_25px_rgba(124,58,237,0.6)] disabled:opacity-50"
              >
                {verifyOtpLoading ? 'Vérification...' : 'Vérifier le code'}
              </button>
            </form>

            <div className="flex items-center justify-between pt-2 border-t border-purple-500/25 text-xs">
              <button
                type="button"
                disabled={resendCooldown > 0 || resendLoading}
                onClick={handleResendEmailCode}
                className="font-bold text-[#A78BFA] hover:text-white disabled:opacity-50 flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5" />
                {resendCooldown > 0
                  ? `Renvoyer le code (${resendCooldown}s)`
                  : resendLoading
                  ? 'Envoi...'
                  : 'Renvoyer le code'}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="text-rose-300 hover:text-rose-200 font-bold"
              >
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          CONDITIONS D'UTILISATION
         ======================================================== */}
      {screen === 'conditions' && (
        <div className="min-h-screen p-5 max-w-md mx-auto w-full z-10 flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setScreen('signup')} className="p-2 rounded-xl bg-[#23154D] text-purple-300">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <span className="text-[11px] font-mono font-black px-3 py-1 rounded-full bg-[#7C3AED]/30 border border-[#8B5CF6] text-purple-100">
                condition.saloma
              </span>
              <h2 className="font-black text-base text-white mt-1">Conditions d'utilisation SALOMA</h2>
            </div>
            <div className="w-9" />
          </div>

          <div className="flex-1 p-4 rounded-3xl bg-[#1D1240] border-2 border-[#8B5CF6]/60 text-xs text-purple-100/90 leading-relaxed space-y-4 overflow-y-auto max-h-[72vh]">
            <p className="font-bold text-white text-sm border-b border-purple-500/30 pb-2">
              Règlement Général et Conditions d'Utilisation de la Plateforme Financière SALOMA
            </p>
            <p>
              <strong>1. Unicité & Sécurité :</strong> Chaque compte SALOMA est strictement personnel et vérifié par code email à 6 chiffres. Tous les nouveaux comptes démarrent à 0 Ar.
            </p>
            <p>
              <strong>2. Dépôts, Retraits & KYC :</strong> Toute demande de dépôt ou de retrait est enregistrée avec le statut initial « en_attente » pour vérification et validation sécurisée. Le niveau KYC 2 est requis avant tout retrait.
            </p>
            <p>
              <strong>3. Exécution Marché &amp; Marge Isolée :</strong> SALOMA affiche directement le prix final en temps réel sur le Trading et l&apos;Échange, avec marge isolée individuelle par position. Les transferts blockchain externes affichent leurs paramètres réseau avant confirmation.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setSignUpData(prev => ({ ...prev, accepteConditions: true }));
              setScreen('signup');
            }}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white font-black text-xs"
          >
            Accepter et revenir à l'inscription
          </button>
        </div>
      )}

      {/* ========================================================
          POLITIQUE DE CONFIDENTIALITÉ - SALOMA
         ======================================================== */}
      {screen === 'privacy' && (
        <div className="min-h-screen p-5 max-w-md mx-auto w-full z-10 flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setScreen(privacyReturnScreen)}
              className="p-2 rounded-xl bg-[#23154D] text-purple-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <span className="text-[11px] font-mono font-black px-3 py-1 rounded-full bg-[#7C3AED]/30 border border-[#8B5CF6] text-purple-100">
                confidentialite.saloma
              </span>
              <h2 className="font-black text-base text-white mt-1">Politique de Confidentialité</h2>
            </div>
            <div className="w-9" />
          </div>

          <div className="flex-1 p-4 rounded-3xl bg-[#1D1240] border-2 border-[#8B5CF6]/60 text-xs text-purple-100/90 leading-relaxed space-y-3 overflow-y-auto max-h-[72vh]">
            <div className="border-b border-purple-500/30 pb-2 space-y-1">
              <p className="font-black text-white text-sm">POLITIQUE DE CONFIDENTIALITÉ - SALOMA</p>
              <p className="text-[11px] text-purple-300 font-semibold">
                Dernière mise à jour : 16 Novembre 2026
              </p>
            </div>

            <p>
              <strong>1. DONNÉES COLLECTÉES :</strong> Nom, prénom, email, téléphone, photo de profil, documents KYC (CIN, adresse, code postal), historique Trade, Portefeuille, Earn.
            </p>
            <p>
              <strong>2. UTILISATION :</strong> Vérifier votre identité (KYC Niveau 1 et 2), sécuriser votre compte, améliorer SALOMA, lutter contre la fraude.
            </p>
            <p>
              <strong>3. KYC :</strong> Niveau 1 auto-validé. Niveau 2 vérifié manuellement par l&apos;Admin. Vos documents CIN ne sont jamais vendus ni partagés. Ils sont visibles uniquement par l&apos;Admin pour validation.
            </p>
            <p>
              <strong>4. SÉCURITÉ :</strong> Vérification Cloudflare Turnstile contre les robots, mot de passe crypté, données protégées.
            </p>
            <p>
              <strong>5. HISTORIQUE :</strong> Vous pouvez effacer votre historique Trade, Portefeuille et Earn à tout moment.
            </p>
            <p>
              <strong>6. PARTAGE :</strong> Nous ne vendons JAMAIS vos données. Aucun partage avec nos partenaires de marché ou toute autre plateforme sans votre accord.
            </p>
            <p>
              <strong>7. VOS DROITS :</strong> Vous pouvez demander la suppression de votre compte et de vos données à tout moment en contactant l&apos;Admin.
            </p>
            <p>
              <strong>8. CONTACT :</strong> Via le support dans l&apos;application SALOMA.
            </p>
            <p className="pt-2 border-t border-purple-500/30 font-bold text-white">
              En utilisant SALOMA, vous acceptez cette politique.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (privacyReturnScreen === 'signup') {
                setSignUpData(prev => ({ ...prev, acceptePolitique: true }));
              }
              setScreen(privacyReturnScreen);
            }}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white font-black text-xs"
          >
            {privacyReturnScreen === 'signup'
              ? 'Accepter et revenir à l’inscription'
              : 'Retour'}
          </button>
        </div>
      )}

      {/* ========================================================
          CONNEXION SCREEN (EMAIL + MOT DE PASSE APPWRITE)
         ======================================================== */}
      {screen === 'login' && (
        <div className="min-h-screen p-5 max-w-md mx-auto w-full z-10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <button onClick={() => setScreen('splash')} className="p-2 rounded-xl bg-[#23154D] text-purple-300">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="text-center">
                <h2 className="font-black text-xl text-white">Connexion SALOMA</h2>
                <span className="text-xs text-purple-300/80">Fidirana amin'ny kaonty</span>
              </div>
              <div className="w-9" />
            </div>

            {appwriteStatusError && !loginError && (
              <div className="p-3 mb-4 rounded-xl bg-amber-500/15 border border-amber-400/50 text-amber-200 text-xs font-bold flex items-center justify-between gap-2">
                <span>{appwriteStatusError}</span>
                <button
                  type="button"
                  onClick={() => void handleRetryLogin()}
                  className="shrink-0 px-2.5 py-1.5 rounded-lg bg-amber-500/25 border border-amber-300/50 text-amber-100 text-[11px] font-black flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Réessayer</span>
                </button>
              </div>
            )}

            {loginError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-bold space-y-2">
                <p>{loginError}</p>
                <button
                  type="button"
                  onClick={() => void handleRetryLogin()}
                  disabled={loginLoading}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Réessayer</span>
                </button>
              </div>
            )}

            <form onSubmit={handleRealLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-purple-300 mb-1">Email</label>
                <input
                  type="email"
                  required
                  placeholder="nirina@gmail.com"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1D1240] border-2 border-[#8B5CF6]/40 text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-purple-300 mb-1">Mot de passe</label>
                <div className="relative">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-[#1D1240] border-2 border-[#8B5CF6]/40 text-white text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(p => !p)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-purple-300 hover:text-white"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setForgotError('');
                    setForgotStep('email');
                    setScreen('forgotPassword');
                  }}
                  className="text-xs font-bold text-[#A78BFA] hover:text-white underline"
                >
                  Mot de passe oublié ?
                </button>
              </div>

              <TurnstileWidget
                siteKey={turnstileSiteKey}
                resetKey={loginTurnstileReset}
                onVerify={tok => {
                  loginTurnstileTokenRef.current = tok || TURNSTILE_FALLBACK_TOKEN;
                  loginTurnstileReadyRef.current = true;
                  setLoginTurnstileReady(true);
                }}
                onExpire={() => {
                  loginTurnstileTokenRef.current = TURNSTILE_FALLBACK_TOKEN;
                }}
                onReadyChange={ready => {
                  loginTurnstileReadyRef.current = ready;
                  setLoginTurnstileReady(ready);
                }}
              />

              <button
                type="submit"
                disabled={loginLoading || !loginTurnstileReady}
                className="w-full min-h-[48px] py-3.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white font-black text-sm shadow-[0_0_20px_rgba(124,58,237,0.6)] disabled:opacity-45 disabled:cursor-not-allowed transition"
              >
                {loginLoading
                  ? 'Connexion...'
                  : !loginTurnstileReady
                  ? 'Vérification...'
                  : 'Se Connecter'}
              </button>
            </form>
          </div>
          <footer className="text-center pt-4 space-y-2">
            <div>
              <button onClick={() => setScreen('signup')} className="text-xs text-purple-300">
                Pas encore de compte ? <span className="text-[#8B5CF6] font-bold underline">Créer compte</span>
              </button>
            </div>
            <div>
              <button
                type="button"
                onClick={() => openPrivacyPolicy('login')}
                className="text-[11px] text-purple-300/80 underline hover:text-white"
              >
                Politique de Confidentialité
              </button>
            </div>
          </footer>
        </div>
      )}

      {/* ========================================================
          MOT DE PASSE OUBLIÉ (RECOVERY OTP APPWRITE)
         ======================================================== */}
      {screen === 'forgotPassword' && (
        <div className="min-h-screen p-5 max-w-md mx-auto w-full z-10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <button onClick={() => setScreen('login')} className="p-2 rounded-xl bg-[#23154D] text-purple-300">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="text-center">
                <h2 className="font-black text-xl text-white">Mot de passe oublié</h2>
                <span className="text-xs text-purple-300/80">Récupération par code email</span>
              </div>
              <div className="w-9" />
            </div>

            {forgotError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold">
                {forgotError}
              </div>
            )}

            {forgotStep === 'email' ? (
              <form onSubmit={handleSendForgotCode} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-purple-300 mb-1">Votre adresse e-mail</label>
                  <input
                    type="email"
                    required
                    placeholder="nirina@gmail.com"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#1D1240] border-2 border-[#8B5CF6]/40 text-white text-xs"
                  />
                </div>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white font-black text-sm disabled:opacity-60"
                >
                  {forgotLoading ? 'Envoi...' : 'Envoyer le code à 6 chiffres'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-purple-300 mb-1">Code à 6 chiffres reçu par email</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    placeholder="123456"
                    value={forgotCode}
                    onChange={e => setForgotCode(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#1D1240] border-2 border-[#8B5CF6]/40 text-white font-mono text-center tracking-widest text-base font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-300 mb-1">Nouveau mot de passe (min 8 caractères)</label>
                  <div className="relative">
                    <input
                      type={showForgotPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      placeholder="Nouveau mot de passe"
                      value={forgotNewPassword}
                      onChange={e => setForgotNewPassword(e.target.value)}
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-[#1D1240] border-2 border-[#8B5CF6]/40 text-white text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(p => !p)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-purple-300"
                    >
                      {showForgotPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-black text-sm disabled:opacity-60"
                >
                  {forgotLoading ? 'Mise à jour...' : 'Réinitialiser le mot de passe'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          MAIN APPLICATION (MENU: EARN | TRADING | ÉCHANGE | PORTEFEUILLE)
         ======================================================== */}
      {screen === 'main' && (
        <div className="flex-1 flex flex-col max-w-md mx-auto w-full pb-20 relative z-10">
          {/* TOP BAR */}
          <header className="sticky top-0 z-30 bg-[#150D2E]/95 backdrop-blur-md border-b-2 border-[#8B5CF6]/40 px-3 py-2.5 flex items-center justify-between gap-2 shadow-[0_4px_20px_rgba(21,13,46,0.85)]">
            <div className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0 select-none" onClick={handleLogoClick}>
              <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-tr from-[#7C3AED] via-[#8B5CF6] to-[#7C3AED] flex items-center justify-center text-white font-black text-lg shadow-[0_0_15px_rgba(124,58,237,0.8)] border border-purple-300/50">
                S
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-black text-2xl sm:text-[26px] tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-purple-100 via-white to-purple-200 drop-shadow-[0_0_14px_rgba(139,92,246,0.95)] leading-none block">
                  SALOMA
                </span>
                <span className="text-[10px] leading-tight text-purple-200/90 font-semibold block mt-0.5 truncate">
                  Notre plateforme, service financier, trade (profit)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setActiveModal('notifications')}
                className="relative p-1.5 rounded-xl bg-[#23154D] text-purple-200 border border-[#8B5CF6]/40 shadow"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center border border-[#150D2E]">
                    {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveModal('kyc')}
                className="p-1.5 rounded-xl bg-[#23154D] text-purple-300 border border-[#8B5CF6]/30 flex items-center gap-1 shadow"
                title="KYC"
              >
                <ShieldCheck className={`w-4 h-4 ${(userRow?.kyc_level ?? 0) >= 2 ? 'text-emerald-400' : 'text-amber-400'}`} />
                <span className="text-[10px] font-bold text-purple-200">N{userRow?.kyc_level ?? 0}</span>
              </button>
              <button
                onClick={() => setActiveModal('profile')}
                className="p-1.5 rounded-xl bg-[#7C3AED]/35 text-white border-2 border-[#8B5CF6] shadow-[0_0_12px_rgba(124,58,237,0.5)]"
                title="Profil"
              >
                <User className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* MAIN TAB CONTENT */}
          <main className="flex-1 px-3 py-3 overflow-y-auto">
            {/* ========================================================
                TAB 1: EARN RÉEL (Appwrite `earn` + `Wallets`)
               ======================================================== */}
            {activeTab === 'earn' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-black text-white flex items-center gap-2">
                    <Gift className="w-5 h-5 text-amber-400" />
                    SALOMA Earn (Harena)
                  </h2>
                  <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Total gagné : +{totalEarnAr.toLocaleString('fr-FR')} Ar
                  </span>
                </div>

                {/* COURBE D'ÉVOLUTION DU SOLDE EARN (MONTÉE / DESCENTE) + 2 BOUTONS RETRAIT */}
                {(() => {
                  const pts = earnBalanceCurve;
                  const lastPt = pts[pts.length - 1] || { value: 0, delta: 0, isDown: false };
                  const values = pts.map(p => p.value);
                  const minVal = Math.min(...values, 0);
                  const maxVal = Math.max(...values, 1);
                  const span = Math.max(1, maxVal - minVal);
                  const w = 340;
                  const h = 112;
                  const padX = 12;
                  const padY = 14;
                  const coords = pts.map((p, idx) => {
                    const x =
                      pts.length <= 1
                        ? w - padX
                        : padX + (idx / (pts.length - 1)) * (w - padX * 2);
                    const y = padY + (1 - (p.value - minVal) / span) * (h - padY * 2);
                    return { x, y, ...p };
                  });
                  const polyPoints = coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
                  const areaPoints =
                    coords.length > 0
                      ? `${coords[0].x.toFixed(1)},${(h - padY + 6).toFixed(1)} ${polyPoints} ${coords[
                          coords.length - 1
                        ].x.toFixed(1)},${(h - padY + 6).toFixed(1)}`
                      : '';
                  const earnSoldeActuel = lastPt.value;
                  const lastSegmentDown = lastPt.isDown;

                  return (
                    <div className="p-4 rounded-3xl bg-[#1D1240] border-2 border-[#8B5CF6]/70 space-y-3 shadow-[0_0_24px_rgba(124,58,237,0.22)]">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 block">
                            Évolution Solde Earn
                          </span>
                          <div className="flex items-baseline gap-2 mt-0.5">
                            <span className="text-xl font-black font-mono text-white">
                              {earnSoldeActuel.toLocaleString('fr-FR')} Ar
                            </span>
                            <span
                              className={`text-[10px] font-black font-mono inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded ${
                                lastSegmentDown
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'bg-emerald-500/20 text-emerald-300'
                              }`}
                            >
                              {lastSegmentDown ? (
                                <TrendingDown className="w-3 h-3" />
                              ) : (
                                <TrendingUp className="w-3 h-3" />
                              )}
                              {lastPt.delta >= 0 ? '+' : ''}
                              {lastPt.delta.toLocaleString('fr-FR')} Ar
                            </span>
                          </div>
                        </div>
                        <div className="text-right text-[10px] font-mono">
                          <span className="text-purple-300 block">
                            Fond actif : <strong className="text-white">{fondEpargneAr.toLocaleString('fr-FR')} Ar</strong>
                          </span>
                          <span className="text-emerald-300 block">
                            Profit : <strong>+{profitEarnDisponibleAr.toLocaleString('fr-FR')} Ar</strong>
                          </span>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-[#150D2E] border border-[#8B5CF6]/30 p-2">
                        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-28 overflow-visible">
                          <defs>
                            <linearGradient id="earnAreaGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.35" />
                              <stop offset="100%" stopColor="#150D2E" stopOpacity="0.02" />
                            </linearGradient>
                          </defs>
                          <line x1={padX} y1={padY} x2={w - padX} y2={padY} stroke="#7C3AED" strokeOpacity="0.18" strokeDasharray="3 3" />
                          <line x1={padX} y1={h / 2} x2={w - padX} y2={h / 2} stroke="#7C3AED" strokeOpacity="0.18" strokeDasharray="3 3" />
                          <line x1={padX} y1={h - padY} x2={w - padX} y2={h - padY} stroke="#7C3AED" strokeOpacity="0.22" />

                          {areaPoints && <polygon points={areaPoints} fill="url(#earnAreaGrad)" />}

                          {coords.length === 1 && (
                            <line
                              x1={padX}
                              y1={coords[0].y}
                              x2={w - padX}
                              y2={coords[0].y}
                              stroke="#8B5CF6"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                            />
                          )}

                          {coords.slice(1).map((c, idx) => {
                            const prev = coords[idx];
                            const segDown = c.value < prev.value || c.isDown;
                            return (
                              <line
                                key={`seg-${idx}`}
                                x1={prev.x}
                                y1={prev.y}
                                x2={c.x}
                                y2={c.y}
                                stroke={segDown ? '#F43F5E' : '#10B981'}
                                strokeWidth="2.75"
                                strokeLinecap="round"
                              />
                            );
                          })}

                          {coords.map((c, idx) => (
                            <circle
                              key={`pt-${idx}`}
                              cx={c.x}
                              cy={c.y}
                              r={idx === coords.length - 1 ? 4.2 : 2.8}
                              fill={c.isDown ? '#F43F5E' : idx === 0 ? '#8B5CF6' : '#10B981'}
                              stroke="#150D2E"
                              strokeWidth="1.5"
                            />
                          ))}
                        </svg>
                        <div className="flex justify-between items-center text-[9px] font-mono text-purple-300 px-1 pt-1 border-t border-purple-500/20">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Montée
                            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block ml-1.5" /> Descente
                          </span>
                          <span>Max : {maxVal.toLocaleString('fr-FR')} Ar</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 text-xs">
                        <button
                          type="button"
                          disabled={earnWithdrawLoading !== null}
                          onClick={handleWithdrawEarnProfit}
                          className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-[11px] shadow flex items-center justify-center gap-1.5 disabled:opacity-50 transition"
                        >
                          <ArrowDownLeft className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {earnWithdrawLoading === 'profit' ? 'Retrait...' : 'RETIRER LE PROFIT'}
                          </span>
                        </button>
                        <button
                          type="button"
                          disabled={earnWithdrawLoading !== null}
                          onClick={handleWithdrawEarnFund}
                          className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] hover:brightness-110 text-white font-black text-[11px] shadow flex items-center justify-center gap-1.5 disabled:opacity-50 transition"
                        >
                          <Wallet className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {earnWithdrawLoading === 'fund' ? 'Retrait...' : 'RETIRER LE FOND'}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Cadeau de bienvenue réel */}
                <div className="p-4 rounded-3xl bg-gradient-to-br from-[#2D165A] via-[#1F1042] to-[#150D2E] border-2 border-[#8B5CF6] space-y-2.5 shadow-[0_0_24px_rgba(124,58,237,0.35)]">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Bonus Nouveau Inscrit
                  </span>
                  <h3 className="font-black text-white text-base">Boîte Cadeau Surprise (+10 000 Ar)</h3>
                  <p className="text-xs text-purple-200/80">
                    Ouvrez votre récompense de bienvenue créditée instantanément dans votre Portefeuille réel.
                  </p>
                  {welcomeGiftClaimed ? (
                    <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                      ✓ Bonus +10 000 Ar déjà crédité dans votre Portefeuille !
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={earnLoadingId === 'welcome-gift'}
                      onClick={() =>
                        claimEarnReward({
                          type_gain: 'bonus_bienvenue',
                          montant: 10000,
                          description: 'Cadeau de bienvenue SALOMA',
                          task_id: 'welcome-gift'
                        })
                      }
                      className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-[#8B5CF6] to-amber-500 text-white font-black text-xs shadow border border-amber-300/40 flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      <Gift className="w-4 h-4" />
                      <span>
                        {earnLoadingId === 'welcome-gift' ? 'Crédit en cours...' : 'Réclamer +10 000 Ar'}
                      </span>
                    </button>
                  )}
                </div>

                {/* Affiliation réelle */}
                <div className="p-4 rounded-3xl bg-[#1D1240] border-2 border-[#8B5CF6]/50 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm text-white">Affiliation 20% sur investissement</span>
                    <span className="text-xs font-black text-emerald-400 bg-emerald-500/20 px-2 py-1 rounded">
                      20% Gain
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#150D2E] text-xs flex justify-between items-center border border-purple-500/20">
                    <span className="text-purple-300 font-mono">Code : {userRow?.code_parrainage || '---'}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(`https://saloma.mg/join?ref=${userRow?.code_parrainage || ''}`);
                        showToast("Lien d'affiliation copié !");
                      }}
                      className="px-3 py-1 bg-[#7C3AED] text-white rounded-lg font-bold"
                    >
                      Copier lien
                    </button>
                  </div>

                  {(() => {
                    const refCode = userRow?.code_parrainage || '';
                    const refUrl = `https://saloma.mg/join?ref=${refCode}`;
                    const shareText = `Rejoins SALOMA Crypto & Trading avec mon code ${refCode} !`;
                    const encodedUrl = encodeURIComponent(refUrl);
                    const encodedMsg = encodeURIComponent(`${shareText} ${refUrl}`);
                    return (
                      <div className="grid grid-cols-5 gap-1.5 text-[10px] font-bold">
                        <a
                          href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2 px-1 rounded-xl bg-[#1877F2]/25 border border-[#1877F2]/60 text-blue-200 flex flex-col items-center justify-center gap-0.5"
                        >
                          <Share2 className="w-3.5 h-3.5 text-blue-400" />
                          <span>Facebook</span>
                        </a>
                        <a
                          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodedUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2 px-1 rounded-xl bg-slate-800/80 border border-slate-500/50 text-white flex flex-col items-center justify-center gap-0.5"
                        >
                          <span className="text-xs font-black leading-none">𝕏</span>
                          <span>X</span>
                        </a>
                        <a
                          href={`https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(shareText)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2 px-1 rounded-xl bg-[#229ED9]/25 border border-[#229ED9]/60 text-sky-200 flex flex-col items-center justify-center gap-0.5"
                        >
                          <Send className="w-3.5 h-3.5 text-sky-400" />
                          <span>Telegram</span>
                        </a>
                        <a
                          href={`https://wa.me/?text=${encodedMsg}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2 px-1 rounded-xl bg-emerald-600/25 border border-emerald-500/60 text-emerald-200 flex flex-col items-center justify-center gap-0.5"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                          <span>WhatsApp</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(`${shareText} ${refUrl}`);
                            showToast('Message + lien copiés !');
                          }}
                          className="py-2 px-1 rounded-xl bg-[#7C3AED]/30 border border-[#8B5CF6]/60 text-purple-100 flex flex-col items-center justify-center gap-0.5"
                        >
                          <Copy className="w-3.5 h-3.5 text-purple-300" />
                          <span>Copier</span>
                        </button>
                      </div>
                    );
                  })()}
                </div>

                {/* Tâches Vidéo réelles */}
                {(() => {
                  const availableTasks = VIDEO_TASKS_CATALOG.filter(t => !completedVideoIds.has(t.id));
                  const activeTask = VIDEO_TASKS_CATALOG.find(v => v.id === watchingVideoId);

                  return (
                    <div className="p-4 rounded-3xl bg-[#1D1240] border-2 border-[#8B5CF6]/60 space-y-3">
                      <div className="flex justify-between items-center gap-2">
                        <div className="flex items-center gap-2">
                          <Video className="w-5 h-5 text-amber-400" />
                          <div>
                            <span className="font-black text-sm text-white block">Tâche Vidéo</span>
                            <span className="text-[10px] text-purple-300">+2 500 Ar / vidéo regardée</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/50">
                          {availableTasks.length} dispo
                        </span>
                      </div>

                      {activeTask && (
                        <div className="p-3.5 rounded-2xl bg-[#0F0922] border-2 border-amber-400/60 space-y-1.5 text-center">
                          <Play className="w-6 h-6 text-amber-400 animate-pulse mx-auto" />
                          <span className="text-xs font-black text-white block">{activeTask.title}</span>
                          <span className="text-[11px] font-mono text-emerald-300 font-bold">
                            Crédit dans {videoCountdown}s...
                          </span>
                        </div>
                      )}

                      {availableTasks.length === 0 ? (
                        <div className="p-3 rounded-2xl bg-[#150D2E] border border-purple-500/20 text-center text-xs text-purple-300">
                          Toutes les tâches vidéo ont été complétées !
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {availableTasks.map(task => (
                            <div
                              key={task.id}
                              className="p-2.5 rounded-2xl bg-[#150D2E] border border-purple-500/30 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <span className="font-bold text-xs text-white block truncate">{task.title}</span>
                                <span className="text-[10px] text-purple-300">
                                  {task.sponsor} • +{task.rewardAr.toLocaleString('fr-FR')} Ar
                                </span>
                              </div>
                              <button
                                type="button"
                                disabled={Boolean(watchingVideoId) || earnLoadingId === task.id}
                                onClick={() => {
                                  setWatchingVideoId(task.id);
                                  setVideoCountdown(task.durationSec);
                                }}
                                className="px-3 py-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] disabled:opacity-50 text-white text-[11px] font-black flex items-center gap-1 shrink-0"
                              >
                                <Play className="w-3.5 h-3.5" />
                                <span>Regarder</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="p-3 rounded-2xl bg-[#190E38] border border-dashed border-[#8B5CF6]/70 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Megaphone className="w-4 h-4 text-amber-300 shrink-0" />
                          <span className="text-[10px] text-purple-300">Espace Publicité & Sponsors SALOMA</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Épargne réelle */}
                <div className="p-4 rounded-3xl bg-[#1D1240] border-2 border-[#8B5CF6]/50 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm text-white">Épargne SALOMA 8% / an</span>
                    <span className="text-xs font-bold text-emerald-400">Tahiry azo antoka</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={epargneAmountInput}
                      onChange={e => setEpargneAmountInput(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="Montant Ar"
                      className="flex-1 px-3 py-2 rounded-xl bg-[#150D2E] border border-purple-500/30 text-white font-mono text-xs"
                    />
                    <button
                      type="button"
                      disabled={earnLoadingId === 'epargne'}
                      onClick={() => {
                        const amt = Math.round(Number(epargneAmountInput));
                        if (isNaN(amt) || amt <= 0) {
                          showToast('Montant invalide.');
                          return;
                        }
                        claimEarnReward({
                          type_gain: 'epargne',
                          montant: amt,
                          description: `Plan Épargne 365j (8%/an)`
                        });
                      }}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs disabled:opacity-50"
                    >
                      Souscrire
                    </button>
                  </div>
                  {epargnePlans.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-[11px] px-1 text-purple-300 font-bold">
                        <span>Capital Épargne restant bloqué :</span>
                        <span className="font-mono text-emerald-400">
                          {fondEpargneAr.toLocaleString('fr-FR')} Ar
                        </span>
                      </div>
                      {epargnePlans.map(ep => (
                        <div
                          key={ep.$id}
                          className="p-2 rounded-xl bg-[#150D2E] flex justify-between text-xs border border-emerald-500/20"
                        >
                          <span className="text-purple-200 font-bold">{ep.description}</span>
                          <span className="font-mono text-emerald-400 font-bold">
                            {Number(ep.montant).toLocaleString('fr-FR')} Ar
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Historique des gains Earn */}
                <div className="p-3.5 rounded-2xl bg-[#1D1240] border border-[#8B5CF6]/40 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-white">
                      Historique des gains ({earnList.length})
                    </span>
                    {earnList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setClearHistoryTarget('earn')}
                        className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/50 text-rose-300 text-[10px] font-black inline-flex items-center gap-1 transition"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Tout supprimer</span>
                      </button>
                    )}
                  </div>
                  {earnList.length === 0 ? (
                    <p className="text-[11px] text-purple-400 text-center py-2">Aucun gain enregistré</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {earnList.map(e => {
                        const isWithdraw = e.type_gain === 'retrait_fond' || e.type_gain === 'retrait_profit';
                        return (
                          <div
                            key={e.$id}
                            className="p-2 rounded-xl bg-[#150D2E] flex justify-between items-center text-[11px] border border-purple-500/20"
                          >
                            <div>
                              <span className="font-bold text-white block">{e.description}</span>
                              <span className="text-[10px] text-purple-400">
                                {e.date ? new Date(e.date).toLocaleString('fr-FR') : ''}
                              </span>
                            </div>
                            <span
                              className={`font-mono font-bold ${
                                isWithdraw ? 'text-rose-400' : 'text-emerald-400'
                              }`}
                            >
                              {isWithdraw ? '-' : e.type_gain === 'epargne' ? '' : '+'}
                              {Number(e.montant).toLocaleString('fr-FR')} Ar
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ========================================================
                TAB 2: ÉCHANGE BYBIT STYLE (Order Book à gauche, Graphique au centre, Formulaire Échange simple)
               ======================================================== */}
            {activeTab === 'exchange' && (
              <div className="space-y-3">
                {renderCoinSearchDropdown(
                  selectedCoin,
                  isCoinDropdownOpen,
                  setIsCoinDropdownOpen,
                  coinSearchTerm,
                  setCoinSearchTerm,
                  filteredCoinsDropdown,
                  c => {
                    setSelectedCoinId(c.id);
                    setSwapToSym(c.symbol.toUpperCase());
                  }
                )}

                {/* BYBIT EXCHANGE LAYOUT: Order Book à gauche + Graphique au centre */}
                <div className="grid grid-cols-12 gap-2 items-stretch">
                  {/* GAUCHE : ORDER BOOK */}
                  <div className="col-span-5 p-2.5 rounded-2xl bg-[#190F38] border border-[#8B5CF6]/50 flex flex-col justify-between space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-black text-white border-b border-purple-500/20 pb-1">
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3 h-3 text-[#8B5CF6]" />
                        Order Book
                      </span>
                      <span className="text-[9px] text-purple-300 font-mono">USDT</span>
                    </div>

                    {/* ASKS (ROUGE) */}
                    <div className="space-y-0.5 text-[9px] font-mono">
                      {orderBook.asks.map((ask, i) => (
                        <div key={`ex-ask-${i}`} className="relative flex justify-between items-center py-0.5 px-1 rounded overflow-hidden">
                          <div className="absolute right-0 top-0 bottom-0 bg-rose-500/15" style={{ width: `${ask.depth}%` }} />
                          <span className="text-rose-400 font-bold z-10">{formatCoinPrice(ask.price)}</span>
                          <span className="text-slate-300 z-10">{ask.qty}</span>
                        </div>
                      ))}
                    </div>

                    {/* PRIX SALOMA CENTRAL */}
                    <div className="py-1 px-1.5 rounded-lg bg-[#100926] border border-[#8B5CF6]/40 text-center">
                      <span className="text-xs font-black font-mono text-white block">
                        ${formatCoinPrice(selectedCoin.price)}
                      </span>
                      <span
                        className={`text-[9px] font-mono font-bold ${
                          selectedCoin.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {selectedCoin.change24h >= 0 ? '+' : ''}
                        {selectedCoin.change24h}%
                      </span>
                    </div>

                    {/* BIDS (VERT) */}
                    <div className="space-y-0.5 text-[9px] font-mono">
                      {orderBook.bids.map((bid, i) => (
                        <div key={`ex-bid-${i}`} className="relative flex justify-between items-center py-0.5 px-1 rounded overflow-hidden">
                          <div className="absolute right-0 top-0 bottom-0 bg-emerald-500/15" style={{ width: `${bid.depth}%` }} />
                          <span className="text-emerald-400 font-bold z-10">{formatCoinPrice(bid.price)}</span>
                          <span className="text-slate-300 z-10">{bid.qty}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                    {/* CENTRE : GRAPHIQUE BOUGIE LIVE */}
                  <div className="col-span-7 p-2.5 rounded-2xl bg-[#190F38] border-2 border-[#8B5CF6]/50 flex flex-col justify-between space-y-2">
                    <div className="flex flex-wrap justify-between items-center gap-1">
                      <span className="font-black text-[11px] text-white flex items-center gap-1.5">
                        <Activity className="w-3 h-3 text-[#8B5CF6]" />
                        {selectedCoin.symbol}/USDT
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/60 text-emerald-300 text-[8px] font-black">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          LIVE
                        </span>
                      </span>
                      <div className="flex gap-0.5 text-[9px] font-mono font-bold">
                        {(['1m', '5m', '15m', '1h', '1D'] as const).map(tf => (
                          <button
                            key={tf}
                            type="button"
                            onClick={() => setSelectedTimeframe(tf)}
                            className={`px-1 py-0.5 rounded border transition ${
                              selectedTimeframe === tf
                                ? 'bg-[#7C3AED] border-purple-300 text-white'
                                : 'bg-[#150D2E] border-purple-500/20 text-purple-300'
                            }`}
                          >
                            {tf}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex-1 min-h-[144px] w-full bg-[#100926] rounded-xl p-1.5 relative overflow-hidden border border-purple-500/20">
                      <svg className="w-full h-full" viewBox="0 0 260 130" preserveAspectRatio="none">
                        {candlestickData.map((c, idx) => {
                          const x = idx * 10 + 2;
                          const min = selectedCoin.price * 0.96;
                          const max = selectedCoin.price * 1.04;
                          const scale = (val: number) => 120 - ((val - min) / (max - min)) * 110;
                          const rectY = Math.min(scale(c.open), scale(c.close));
                          const rectH = Math.max(2, Math.abs(scale(c.close) - scale(c.open)));
                          const color = c.isUp ? '#10B981' : '#EF4444';
                          return (
                            <g key={idx}>
                              <line x1={x + 3} y1={scale(c.high)} x2={x + 3} y2={scale(c.low)} stroke={color} strokeWidth="1" />
                              <rect x={x} y={rectY} width="6" height={rectH} fill={color} rx="1" />
                            </g>
                          );
                        })}
                      </svg>
                      <div className="absolute right-1.5 top-1.5 bg-[#7C3AED]/90 text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded">
                        ${formatCoinPrice(selectedCoin.price)}
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[9px] font-mono text-purple-300 px-0.5">
                      <span>24h H: ${formatCoinPrice(selectedCoin.high24h)}</span>
                      <span>24h B: ${formatCoinPrice(selectedCoin.low24h)}</span>
                    </div>
                  </div>
                </div>

                {/* FORMULAIRE ÉCHANGE SIMPLE (Tu donnes / Tu reçois) — UN SEUL BOUTON ÉCHANGER */}
                <div className="p-3.5 rounded-2xl bg-[#190F38] border-2 border-[#8B5CF6]/60 space-y-3 shadow-[0_0_20px_rgba(124,58,237,0.2)]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-white flex items-center gap-1.5">
                      <ArrowRightLeft className="w-3.5 h-3.5 text-[#8B5CF6]" />
                      Échange Instantané SALOMA
                    </span>
                    <span className="text-[10px] font-mono font-bold text-emerald-300">Prix final inclus</span>
                  </div>

                  {/* TU DONNES */}
                  <div className="p-3 rounded-xl bg-[#100926] border border-purple-500/30 space-y-1.5">
                    <div className="flex justify-between text-[11px] text-purple-300">
                      <span className="font-bold">Tu donnes</span>
                      <span className="font-mono text-[10px]">
                        Dispo : {getAvailableExchangeBalance(swapFromSym).toLocaleString('fr-FR', { maximumFractionDigits: 6 })} {swapFromSym === 'AR' ? 'Ar' : swapFromSym}
                      </span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={swapAmountInput}
                        placeholder="0.00"
                        onChange={e => setSwapAmountInput(sanitizeDecimalInput(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl bg-[#190F38] border border-purple-500/40 text-white font-mono font-black text-sm focus:border-[#8B5CF6] focus:outline-none"
                      />
                      <select
                        value={swapFromSym}
                        onChange={e => setSwapFromSym(e.target.value)}
                        className="bg-[#23154D] text-white text-xs font-black px-3 py-2 rounded-xl border border-[#8B5CF6]"
                      >
                        {exchangeCurrencies.map(c => (
                          <option key={c.symbol} value={c.symbol}>
                            {c.symbol === 'AR' ? 'Ar' : c.symbol}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex justify-between items-center gap-1.5 pt-1">
                      {[25, 50, 75, 100].map(pct => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => {
                            const bal = getAvailableExchangeBalance(swapFromSym);
                            setSwapAmountInput(
                              swapFromSym === 'AR'
                                ? String(Math.floor((bal * pct) / 100))
                                : ((bal * pct) / 100).toFixed(6)
                            );
                          }}
                          className="flex-1 py-1 rounded-lg bg-[#190F38] hover:bg-[#7C3AED]/40 border border-purple-500/30 text-[10px] font-mono font-bold text-purple-200"
                        >
                          {pct === 100 ? 'MAX' : `${pct}%`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* BOUTON INVERSER */}
                  <div className="flex justify-center -my-1.5">
                    <button
                      type="button"
                      onClick={handleFlipExchangePair}
                      title="Inverser les devises"
                      className="p-2 rounded-xl bg-[#23154D] hover:bg-[#7C3AED] border border-[#8B5CF6] text-white transition active:scale-95"
                    >
                      <ArrowUpDown className="w-4 h-4" />
                    </button>
                  </div>

                  {/* TU REÇOIS */}
                  <div className="p-3 rounded-xl bg-[#100926] border border-purple-500/30 space-y-1.5">
                    <div className="flex justify-between text-[11px] text-purple-300">
                      <span className="font-bold">Tu reçois (estimé)</span>
                      <span className="font-mono text-[10px]">
                        Dispo : {getAvailableExchangeBalance(swapToSym).toLocaleString('fr-FR', { maximumFractionDigits: 6 })} {swapToSym === 'AR' ? 'Ar' : swapToSym}
                      </span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <div className="flex-1 px-3 py-2 rounded-xl bg-[#190F38] border border-purple-500/20 text-emerald-400 font-mono font-black text-sm truncate">
                        {(() => {
                          const amt = parseDecimalValue(swapAmountInput);
                          if (amt <= 0 || !fromCurrencyObj.priceUsd || !toCurrencyObj.priceUsd) return '0.0000';
                          const brutOut = (amt * fromCurrencyObj.priceUsd) / toCurrencyObj.priceUsd;
                          const netOut = brutOut * (1 - (salomaFees.exchangeFeePct || 0.1) / 100);
                          return netOut < 1 ? netOut.toFixed(6) : netOut.toFixed(4);
                        })()}
                      </div>
                      <select
                        value={swapToSym}
                        onChange={e => setSwapToSym(e.target.value)}
                        className="bg-[#23154D] text-white text-xs font-black px-3 py-2 rounded-xl border border-[#8B5CF6]"
                      >
                        {exchangeCurrencies.map(c => (
                          <option key={c.symbol} value={c.symbol}>
                            {c.symbol === 'AR' ? 'Ar' : c.symbol}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex justify-between text-[10px] font-mono text-purple-300 pt-0.5">
                      <span>
                        1 {fromCurrencyObj.symbol === 'AR' ? 'Ar' : fromCurrencyObj.symbol} ≈{' '}
                        {((fromCurrencyObj.priceUsd || 0) / (toCurrencyObj.priceUsd || 1)).toFixed(
                          toCurrencyObj.symbol === 'AR' ? 2 : 6
                        )}{' '}
                        {toCurrencyObj.symbol === 'AR' ? 'Ar' : toCurrencyObj.symbol}
                      </span>
                      <span className="text-amber-300">Frais SALOMA : {salomaFees.exchangeFeePct}%</span>
                    </div>
                  </div>

                  {/* UN SEUL BOUTON : ÉCHANGER */}
                  <button
                    type="button"
                    disabled={exchangeSubmitting}
                    onClick={handleExecuteExchange}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white font-black text-sm shadow-[0_0_20px_rgba(124,58,237,0.45)] flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-50"
                  >
                    <Repeat className="w-4 h-4" />
                    <span>{exchangeSubmitting ? 'ÉCHANGE EN COURS...' : 'ÉCHANGER'}</span>
                  </button>
                </div>

                {/* RÉCAPITULATIF ÉCHANGE */}
                <div className="p-3.5 rounded-2xl bg-[#1D1240] border-2 border-[#8B5CF6]/50 space-y-2">
                  <span className="text-xs font-black text-white flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-purple-400" />
                    Récapitulatif de l&apos;Échange
                  </span>
                  {(() => {
                    const amt = parseDecimalValue(swapAmountInput);
                    const taux = fromCurrencyObj.priceUsd / (toCurrencyObj.priceUsd || 1);
                    const brutRecu = amt * taux;
                    const exchangeFeeAmt = brutRecu * ((salomaFees.exchangeFeePct || 0.1) / 100);
                    const netRecu = Math.max(0, brutRecu - exchangeFeeAmt);
                    const outDec = toCurrencyObj.symbol === 'AR' ? 2 : 6;
                    const outLabel = toCurrencyObj.symbol === 'AR' ? 'Ar' : toCurrencyObj.symbol;
                    return (
                      <div className="overflow-hidden rounded-xl border border-purple-500/30 text-xs">
                        <table className="w-full text-left">
                          <tbody className="divide-y divide-purple-500/20 bg-[#150D2E]">
                            <tr>
                              <td className="px-3 py-2 text-purple-300">Montant envoyé</td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-white">
                                {amt.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} {fromCurrencyObj.symbol === 'AR' ? 'Ar' : fromCurrencyObj.symbol}
                              </td>
                            </tr>
                            <tr>
                              <td className="px-3 py-2 text-purple-300">Taux appliqué</td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-purple-200">
                                1 {fromCurrencyObj.symbol === 'AR' ? 'Ar' : fromCurrencyObj.symbol} ≈{' '}
                                {taux.toFixed(outDec)} {outLabel}
                              </td>
                            </tr>
                            <tr>
                              <td className="px-3 py-2 text-purple-300">Montant brut</td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-purple-100">
                                {brutRecu.toFixed(outDec)} {outLabel}
                              </td>
                            </tr>
                            <tr>
                              <td className="px-3 py-2 text-amber-300 font-bold">
                                Frais SALOMA ({salomaFees.exchangeFeePct}%)
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-amber-300">
                                -{exchangeFeeAmt.toFixed(outDec)} {outLabel}
                              </td>
                            </tr>
                            <tr className="bg-[#1F1042]/70 font-bold">
                              <td className="px-3 py-2 text-white">Total Net reçu</td>
                              <td className="px-3 py-2 text-right font-mono text-emerald-400">
                                {netRecu.toFixed(outDec)} {outLabel}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>

                {/* HISTORIQUE DES ÉCHANGES (Appwrite `echanges`) */}
                <div className="p-3.5 rounded-2xl bg-[#190F38] border border-[#8B5CF6]/40 space-y-2">
                  <span className="text-xs font-black text-white flex items-center gap-1.5">
                    <Repeat className="w-3.5 h-3.5 text-[#8B5CF6]" />
                    Historique des Échanges ({echangesList.length})
                  </span>
                  {echangesList.length === 0 ? (
                    <div className="text-center py-3 text-xs text-purple-400/70">Aucun échange effectué</div>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {echangesList.map(ex => (
                        <div
                          key={ex.$id}
                          className="flex justify-between items-center p-2 rounded-xl bg-[#100926] text-[11px] border border-purple-500/20"
                        >
                          <div>
                            <span className="font-bold text-white">
                              {ex.montant_envoye} {ex.de_devise} → {Number(ex.montant_recu).toFixed(6)} {ex.vers_devise}
                            </span>
                            <span className="text-[10px] text-purple-400 block font-mono">
                              Taux: {Number(ex.taux).toFixed(6)} • {ex.date ? new Date(ex.date).toLocaleString('fr-FR') : ''}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-400">{ex.statut}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ========================================================
                TAB 3: TRADING RÉEL — A) MANUEL STRATÉGIE | B) AUTO STRATÉGIE (BOT)
               ======================================================== */}
            {activeTab === 'trading' && (
              <div className="space-y-3">
                {renderCoinSearchDropdown(
                  selectedCoin,
                  isCoinDropdownOpen,
                  setIsCoinDropdownOpen,
                  coinSearchTerm,
                  setCoinSearchTerm,
                  filteredCoinsDropdown,
                  c => setSelectedCoinId(c.id)
                )}

                {/* 2 CHOIX DE STRATÉGIE : MANUEL VS AUTO BOT */}
                <div className="grid grid-cols-2 gap-1.5 bg-[#190E38] p-1 rounded-2xl border border-[#8B5CF6]/45">
                  <button
                    type="button"
                    onClick={() => setTradeStrategyChoice('MANUEL')}
                    className={`py-2 px-2 rounded-xl text-[11px] font-black transition flex items-center justify-center gap-1.5 ${
                      tradeStrategyChoice === 'MANUEL'
                        ? 'bg-[#7C3AED] text-white shadow-[0_0_15px_rgba(124,58,237,0.5)]'
                        : 'text-purple-300 hover:text-white'
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>A) Manuel Stratégie</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTradeStrategyChoice('BOT')}
                    className={`py-2 px-2 rounded-xl text-[11px] font-black transition flex items-center justify-center gap-1.5 ${
                      tradeStrategyChoice === 'BOT'
                        ? 'bg-gradient-to-r from-emerald-600 to-[#7C3AED] text-white shadow-[0_0_15px_rgba(16,185,129,0.35)]'
                        : 'text-purple-300 hover:text-white'
                    }`}
                  >
                    <Bot className="w-3.5 h-3.5" />
                    <span>B) Auto Stratégie (Bot)</span>
                  </button>
                </div>

                {/* 1. BOUGIE LIVE */}
                <div className="p-3 rounded-2xl bg-[#1D1240] border-2 border-[#8B5CF6]/50 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-sm text-white">{selectedCoin.symbol}/USDT</span>
                    <div className="flex gap-1 text-[10px] font-mono font-bold text-purple-300">
                      {(['1m', '5m', '15m', '1h', '4h', '1D'] as const).map(tf => (
                        <button
                          key={tf}
                          onClick={() => setSelectedTimeframe(tf)}
                          className={`px-2 py-0.5 rounded-lg border transition ${
                            selectedTimeframe === tf
                              ? 'bg-[#7C3AED] border-purple-300 text-white shadow'
                              : 'bg-[#150D2E] border-purple-500/20 text-purple-300'
                          }`}
                        >
                          {tf}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-36 w-full bg-[#150D2E] rounded-xl p-2 relative overflow-hidden border border-purple-500/25">
                    <svg className="w-full h-full" viewBox="0 0 260 140" preserveAspectRatio="none">
                      {candlestickData.map((c, idx) => {
                        const x = idx * 10 + 2;
                        const min = selectedCoin.price * 0.96;
                        const max = selectedCoin.price * 1.04;
                        const scale = (val: number) => 130 - ((val - min) / (max - min)) * 120;
                        const rectY = Math.min(scale(c.open), scale(c.close));
                        const rectH = Math.max(2, Math.abs(scale(c.close) - scale(c.open)));
                        const color = c.isUp ? '#10B981' : '#EF4444';
                        return (
                          <g key={idx}>
                            <line x1={x + 3} y1={scale(c.high)} x2={x + 3} y2={scale(c.low)} stroke={color} strokeWidth="1" />
                            <rect x={x} y={rectY} width="6" height={rectH} fill={color} rx="1" />
                          </g>
                        );
                      })}
                    </svg>
                    <div className="absolute right-2 top-2 bg-[#7C3AED] text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow">
                      {selectedTimeframe}: ${formatCoinPrice(selectedCoin.price)}
                    </div>
                  </div>
                </div>

                {/* 2. PRIX ACTUEL SALOMA + WALLET INTERNE SALOMA */}
                <div className="p-3 rounded-2xl bg-[#1D1240] border-2 border-[#8B5CF6]/50 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-purple-300 uppercase">Prix SALOMA</span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/60 text-emerald-300 text-[9px] font-black">
                          <span className={`w-1.5 h-1.5 rounded-full bg-emerald-400 ${isWsLive ? 'animate-pulse' : 'opacity-60'}`} />
                          LIVE MARCHÉ
                        </span>
                        <button
                          type="button"
                          onClick={() => openPriceAlertsModal(selectedCoin.symbol)}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#7C3AED]/30 border border-[#8B5CF6]/60 text-purple-100 text-[9px] font-black hover:bg-[#7C3AED]/50"
                        >
                          <Bell className="w-2.5 h-2.5 text-amber-300" />
                          <span>Alerte prix</span>
                          {activePriceAlertsCount > 0 && (
                            <span className="px-1 rounded bg-amber-500 text-black text-[8px] font-black">
                              {activePriceAlertsCount}
                            </span>
                          )}
                        </button>
                      </div>
                      <span className="text-2xl font-black text-white font-mono">
                        ${formatCoinPrice(selectedCoin.price)}
                      </span>
                    </div>
                    {tradingModeType === 'SPOT' && tradeStrategyChoice === 'MANUEL' ? (
                      <div className="text-right space-y-0.5">
                        <span className="text-[10px] text-purple-300 block">Wallet SALOMA (Spot)</span>
                        <span className="text-xs font-mono font-black text-emerald-400 block">
                          {clientUsdtBalance.toLocaleString('en-US', { maximumFractionDigits: 4 })} USDT
                        </span>
                        <span className="text-[11px] font-mono font-bold text-white block">
                          {clientSelectedCryptoBalance.toFixed(6)} {selectedCoin.symbol}
                        </span>
                      </div>
                    ) : (
                      <div className="text-right">
                        <span className="text-[10px] text-purple-400 block">Solde Compte Trade</span>
                        <span className="text-sm font-mono font-black text-emerald-400">
                          {Math.round(soldeCompteTradeAr).toLocaleString('fr-FR')} Ar
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setConvertDirection('WALLET_TO_TRADE');
                            setActiveModal('convert');
                          }}
                          className="mt-0.5 text-[10px] font-bold text-[#8B5CF6] underline block ml-auto"
                        >
                          ⇄ Convertir Wallet → Trade
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="pt-1.5 border-t border-purple-500/20 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-emerald-300 font-bold">
                      {tradingModeType === 'SPOT' ? 'Wallet Interne SALOMA' : 'Exécution Directe • Plateforme'}
                    </span>
                    <span className="text-purple-200">
                      {tradingModeType === 'SPOT' ? 'Achat / Vente Instantané' : 'Marge Isolée Individuelle'}
                    </span>
                  </div>
                </div>

                {/* ====================================================
                    MODE A : MANUEL STRATÉGIE (SPOT + LEVIER)
                   ==================================================== */}
                {tradeStrategyChoice === 'MANUEL' && (
                  <>
                    <div className="flex items-center gap-2 bg-[#190E38] p-1 rounded-xl border border-purple-500/30">
                      <button
                        onClick={() => {
                          setTradingModeType('SPOT');
                          setSpotUnavailableNotice(null);
                        }}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                          tradingModeType === 'SPOT'
                            ? 'bg-emerald-600/40 border border-emerald-500/50 text-emerald-300 shadow'
                            : 'text-purple-300 hover:text-white'
                        }`}
                      >
                        SPOT (Varotra mivantana)
                      </button>
                      <button
                        onClick={() => {
                          setTradingModeType('LEVIER');
                          setSpotUnavailableNotice(null);
                        }}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                          tradingModeType === 'LEVIER'
                            ? 'bg-[#7C3AED] border border-purple-300 text-white shadow-[0_0_15px_rgba(124,58,237,0.5)]'
                            : 'text-purple-300 hover:text-white'
                        }`}
                      >
                        LEVIER (x1 à x100)
                      </button>
                    </div>

                    {/* 3. BOUTONS BUY / SELL CÔTE À CÔTE (GAUCHE = BUY, DROITE = SELL) */}
                    <div className="p-3.5 rounded-2xl bg-[#1D1240] border-2 border-[#8B5CF6]/60 space-y-3">
                      {spotUnavailableNotice && tradingModeType === 'SPOT' && (
                        <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-400/60 text-amber-200 text-xs font-bold flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
                          <span>{spotUnavailableNotice}</span>
                        </div>
                      )}

                      {tradingModeType === 'SPOT' ? (
                        <div className="space-y-2.5">
                          <div className="p-2.5 rounded-xl bg-[#150D2E] border border-emerald-500/40 flex justify-between items-center gap-2">
                            <div>
                              <span className="text-[10px] font-black text-emerald-300 block">
                                Wallet Spot SALOMA (USDT ⇄ {selectedCoin.symbol})
                              </span>
                              <span className="text-[10px] font-mono text-purple-200 block">
                                USDT: {clientUsdtBalance.toFixed(4)} • {selectedCoin.symbol}: {clientSelectedCryptoBalance.toFixed(6)}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setTradingModeType('LEVIER')}
                              className="text-[10px] px-2.5 py-1 rounded bg-[#7C3AED] text-white font-bold shrink-0"
                            >
                              Levier
                            </button>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[10px] font-bold text-purple-300 px-0.5">
                              <span>
                                Montant ({spotOrderUnit === 'USDT' ? 'USDT' : selectedCoin.symbol}) • <strong className="text-emerald-300">Min : 1$</strong>
                              </span>
                              <span className="font-mono text-emerald-300">
                                {spotOrderUnit === 'USDT'
                                  ? `≈ ${spotOrderCryptoEquiv.toFixed(6)} ${selectedCoin.symbol}`
                                  : `≈ ${spotOrderUsdtEquiv.toFixed(2)} USDT`}
                              </span>
                            </div>
                            <div className="grid grid-cols-12 gap-1.5 items-center">
                              <div className="col-span-7">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={spotAmountInput}
                                  onChange={e => {
                                    setSelectedSpotPercent(null);
                                    setSpotUnavailableNotice(null);
                                    setSpotAmountInput(sanitizeDecimalInput(e.target.value));
                                  }}
                                  placeholder={
                                    spotOrderUnit === 'USDT'
                                      ? 'Min : 1$ (1 USDT)'
                                      : `Min : 1$ (${formatMinCoinQty(computeMinCoinForUsd(selectedCoin.price, selectedCoin.symbol, MIN_SPOT_USD))} ${selectedCoin.symbol})`
                                  }
                                  className="w-full px-2.5 py-1.5 rounded-xl bg-[#150D2E] border border-purple-500/40 text-white text-xs font-mono font-bold focus:outline-none focus:border-[#8B5CF6]"
                                />
                              </div>
                              <div className="col-span-5 grid grid-cols-2 gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSpotOrderUnit('USDT');
                                    setSelectedSpotPercent(null);
                                  }}
                                  className={`py-1.5 rounded-xl text-[10px] font-black border transition ${
                                    spotOrderUnit === 'USDT'
                                      ? 'bg-[#7C3AED] border-purple-300 text-white'
                                      : 'bg-[#150D2E] border-purple-500/40 text-purple-300'
                                  }`}
                                >
                                  USDT
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSpotOrderUnit('CRYPTO');
                                    setSelectedSpotPercent(null);
                                  }}
                                  className={`py-1.5 rounded-xl text-[10px] font-black border transition ${
                                    spotOrderUnit === 'CRYPTO'
                                      ? 'bg-[#7C3AED] border-purple-300 text-white'
                                      : 'bg-[#150D2E] border-purple-500/40 text-purple-300'
                                  }`}
                                >
                                  {selectedCoin.symbol}
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-5 gap-1">
                            {([25, 50, 75, 100, 'MAX'] as const).map(p => (
                              <button
                                key={String(p)}
                                type="button"
                                onClick={() => applySpotPercent(p)}
                                className={`py-1 rounded-lg text-[10px] font-mono font-black border transition ${
                                  selectedSpotPercent === p
                                    ? 'bg-[#7C3AED] border-purple-300 text-white shadow'
                                    : 'bg-[#150D2E] border-purple-500/30 text-purple-200'
                                }`}
                              >
                                {p === 'MAX' ? 'MAX' : `${p}%`}
                              </button>
                            ))}
                          </div>

                          {(() => {
                            const spotFeeUsdt = Number(
                              (spotOrderUsdtEquiv * ((salomaFees.tradeFeePct || 0.1) / 100)).toFixed(4)
                            );
                            const spotTotalBuyUsdt = Number((spotOrderUsdtEquiv + spotFeeUsdt).toFixed(4));
                            const spotNetSellUsdt = Number(Math.max(0, spotOrderUsdtEquiv - spotFeeUsdt).toFixed(4));
                            return (
                              <div className="p-2.5 rounded-xl bg-[#150D2E] border border-purple-500/30 text-[10px] font-mono space-y-1.5">
                                <div className="text-amber-300 font-bold leading-snug">
                                  Trade : {spotOrderUsdtEquiv.toFixed(2)} USDT - Frais SALOMA {salomaFees.tradeFeePct}% = {spotFeeUsdt.toFixed(4)} USDT - Total : {spotTotalBuyUsdt.toFixed(4)} USDT
                                </div>
                                <div className="flex justify-between pt-1 border-t border-purple-500/20">
                                  <span className="text-purple-300">BUY (débit total) :</span>
                                  <span className="text-emerald-300 font-bold">
                                    +{spotOrderCryptoEquiv.toFixed(6)} {selectedCoin.symbol} • -{spotTotalBuyUsdt.toFixed(4)} USDT
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-purple-300">SELL (net reçu) :</span>
                                  <span className="text-rose-300 font-bold">
                                    +{spotNetSellUsdt.toFixed(4)} USDT • -{spotOrderCryptoEquiv.toFixed(6)} {selectedCoin.symbol}
                                  </span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="p-2.5 rounded-xl bg-[#150D2E] border border-[#8B5CF6]/50 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black text-purple-200">
                                Levier : {numericLeverage}x (Max 100x)
                              </span>
                              <button
                                type="button"
                                onClick={() => setTradingModeType('SPOT')}
                                className="text-[9px] px-2 py-0.5 rounded bg-[#23154D] text-purple-200 font-bold flex items-center gap-0.5"
                              >
                                <ArrowLeft className="w-2.5 h-2.5" /> SPOT
                              </button>
                            </div>
                            <div className="grid grid-cols-6 gap-1">
                              {LEVERAGE_PRESETS.map(levPreset => {
                                const isSelected = numericLeverage === levPreset;
                                return (
                                  <button
                                    key={levPreset}
                                    type="button"
                                    onClick={() => setLeverageInput(String(levPreset))}
                                    className={`py-1 rounded-lg text-[10px] font-mono font-black border transition ${
                                      isSelected
                                        ? 'bg-[#7C3AED] border-purple-300 text-white shadow'
                                        : 'bg-[#1F1042] border-purple-500/30 text-purple-200 hover:border-[#8B5CF6]'
                                    }`}
                                  >
                                    x{levPreset}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={leverageInput}
                                onChange={e => {
                                  const digits = e.target.value.replace(/[^0-9]/g, '');
                                  if (!digits) {
                                    setLeverageInput('');
                                    return;
                                  }
                                  const clamped = Math.min(100, Math.max(1, parseInt(digits, 10)));
                                  setLeverageInput(String(clamped));
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-[#1F1042] border border-[#8B5CF6]/60 text-white font-mono font-black text-xs text-center"
                              />
                              <span className="font-mono font-black text-purple-200 text-xs">x</span>
                            </div>
                            <span className="text-[9px] text-rose-300 font-mono block">
                              Liq. à {liquidationThreshold}% contre vous • Marge Isolée
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[10px] font-bold text-purple-300 px-0.5">
                              <span>
                                Montant ({selectedTradeCurrencyObj.shortLabel}) • <strong className="text-emerald-300">Min : 5$</strong>
                              </span>
                              <span className="font-mono text-emerald-300">
                                {tradeAmountCurrency === 'ARIARY'
                                  ? `≈ $${(numericAmountAr / USD_TO_MGA).toFixed(2)} USD`
                                  : `≈ ${numericAmountAr.toLocaleString('fr-FR')} Ar`}
                              </span>
                            </div>
                            <div className="grid grid-cols-12 gap-1.5 items-center">
                              <div className="col-span-8">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={tradeAmountInput}
                                  onChange={e => {
                                    setSelectedTradePercent(null);
                                    setTradeAmountInput(sanitizeDecimalInput(e.target.value));
                                  }}
                                  placeholder={`Montant (${selectedTradeCurrencyObj.shortLabel})`}
                                  className="w-full px-2.5 py-1.5 rounded-xl bg-[#150D2E] border border-purple-500/40 text-white text-xs font-mono font-bold focus:outline-none focus:border-[#8B5CF6]"
                                />
                              </div>
                              <div className="col-span-4">
                                <select
                                  aria-label="Devise du montant"
                                  value={tradeAmountCurrency}
                                  onChange={e => handleChangeTradeAmountCurrency(e.target.value)}
                                  className="w-full px-2 py-1.5 rounded-xl bg-[#23154D] border border-[#8B5CF6]/70 text-white text-[11px] font-black focus:outline-none"
                                >
                                  {tradeAmountCurrencies.map(c => (
                                    <option key={c.symbol} value={c.symbol}>
                                      {c.symbol === 'ARIARY' ? 'ARIARY' : c.symbol}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-5 gap-1">
                            {([25, 50, 75, 100, 'MAX'] as const).map(p => (
                              <button
                                key={String(p)}
                                type="button"
                                onClick={() => applyTradePercent(p)}
                                className={`py-1 rounded-lg text-[10px] font-mono font-black border transition ${
                                  selectedTradePercent === p
                                    ? 'bg-[#7C3AED] border-purple-300 text-white shadow'
                                    : 'bg-[#150D2E] border-purple-500/30 text-purple-200'
                                }`}
                              >
                                {p === 'MAX' ? 'MAX' : `${p}%`}
                              </button>
                            ))}
                          </div>

                          {(() => {
                            const levFeeAr = Math.round(numericAmountAr * ((salomaFees.tradeFeePct || 0.1) / 100));
                            return (
                              <div className="p-2 rounded-xl bg-[#150D2E] border border-amber-500/35 text-[10px] font-mono text-amber-300 font-bold">
                                Trade : {numericAmountAr.toLocaleString('fr-FR')} Ar - Frais SALOMA {salomaFees.tradeFeePct}% = {levFeeAr.toLocaleString('fr-FR')} Ar - Total : {(numericAmountAr + levFeeAr).toLocaleString('fr-FR')} Ar
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {(autoBuyEnabled || autoSellEnabled) && (
                        <div className="px-2.5 py-1.5 rounded-xl bg-[#150D2E] border border-[#8B5CF6]/60 flex items-center justify-between text-[10px] font-bold">
                          <span className="text-purple-100 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            AUTO actif :{' '}
                            <strong className="text-white">
                              {[autoBuyEnabled ? 'BUY' : '', autoSellEnabled ? 'SELL' : '']
                                .filter(Boolean)
                                .join(' + ')}
                            </strong>{' '}
                            • {selectedCoin.symbol}/USDT
                          </span>
                          <span className="font-mono text-purple-300">
                            {tradingModeType === 'SPOT' ? 'SPOT' : `x${numericLeverage}`}
                          </span>
                        </div>
                      )}

                      {/* GAUCHE = BUY + AUTO | DROITE = SELL + AUTO */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1.5">
                          <button
                            type="button"
                            disabled={tradeSubmitting}
                            onClick={() => void handleExecuteTrade('BUY', 'Manuel')}
                            className="w-full py-3 px-2 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-500 text-white font-black text-xs shadow flex flex-col items-center justify-center active:scale-95 transition disabled:opacity-50"
                          >
                            <span className="flex items-center gap-1 text-sm">
                              <TrendingUp className="w-4 h-4" /> BUY
                            </span>
                            <span className="text-[10px] font-bold opacity-95">Mividy (Hausse)</span>
                            <span className="text-[9px] font-mono bg-black/20 px-1.5 py-0.5 rounded mt-1">
                              {tradingModeType === 'SPOT' ? 'SPOT x1' : `x${numericLeverage}`}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleToggleAutoTrade('BUY')}
                            className={`w-full py-1.5 px-2 rounded-xl border text-[10px] font-black flex items-center justify-center gap-1.5 transition ${
                              autoBuyEnabled
                                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                                : 'bg-[#150D2E] border-purple-500/40 text-purple-200 hover:border-emerald-400/60'
                            }`}
                          >
                            <Bot className="w-3.5 h-3.5" />
                            <span>{autoBuyEnabled ? 'AUTO BUY : ACTIF' : 'AUTO BUY'}</span>
                          </button>
                        </div>

                        <div className="space-y-1.5">
                          <button
                            type="button"
                            disabled={tradeSubmitting}
                            onClick={() => void handleExecuteTrade('SELL', 'Manuel')}
                            className="w-full py-3 px-2 rounded-2xl bg-gradient-to-br from-rose-600 to-rose-500 text-white font-black text-xs shadow flex flex-col items-center justify-center active:scale-95 transition disabled:opacity-50"
                          >
                            <span className="flex items-center gap-1 text-sm">
                              <TrendingDown className="w-4 h-4" /> SELL
                            </span>
                            <span className="text-[10px] font-bold opacity-95">Mivarotra (Baisse)</span>
                            <span className="text-[9px] font-mono bg-black/20 px-1.5 py-0.5 rounded mt-1">
                              {tradingModeType === 'SPOT' ? 'SPOT x1' : `x${numericLeverage}`}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleToggleAutoTrade('SELL')}
                            className={`w-full py-1.5 px-2 rounded-xl border text-[10px] font-black flex items-center justify-center gap-1.5 transition ${
                              autoSellEnabled
                                ? 'bg-rose-500/25 border-rose-400 text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                                : 'bg-[#150D2E] border-purple-500/40 text-purple-200 hover:border-rose-400/60'
                            }`}
                          >
                            <Bot className="w-3.5 h-3.5" />
                            <span>{autoSellEnabled ? 'AUTO SELL : ACTIF' : 'AUTO SELL'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Positions Actives (Hedge Spot USDT + Marge Isolée Individuelle) */}
                      {activeTrades.length > 0 && (
                        <div className="pt-2 space-y-2 border-t border-purple-500/20">
                          <span className="text-xs font-bold text-white block">
                            Positions en cours ({activeTrades.length}) :
                          </span>
                          {activeTrades.map(tr => {
                            const isHedgeSpot = (tr.mode || '').startsWith('Hedge');
                            const livePrice = getLivePriceForPair(tr.paire, tr.prix);
                            const lev = Math.max(1, tr.leverage || 1);
                            const diff =
                              tr.type === 'achat'
                                ? (livePrice - tr.prix) / (tr.prix || 1)
                                : (tr.prix - livePrice) / (tr.prix || 1);
                            const amountUsdt = Number((Number(tr.montant) / USD_TO_MGA).toFixed(4));
                            const cryptoQty = tr.prix > 0 ? amountUsdt / tr.prix : 0;
                            const feeUsdt = amountUsdt * ((salomaFees.tradeFeePct || 0.1) / 100);
                            const livePnlUsdt = Number(((livePrice - tr.prix) * cryptoQty - feeUsdt).toFixed(4));
                            const liveProfitAr = Math.max(-Math.round(tr.montant), Math.round(tr.montant * diff * lev));
                            const isProfit = isHedgeSpot ? livePnlUsdt >= 0 : liveProfitAr >= 0;
                            const liqPrice =
                              lev > 1
                                ? tr.type === 'achat'
                                  ? tr.prix * (1 - 1 / lev)
                                  : tr.prix * (1 + 1 / lev)
                                : 0;
                            return (
                              <div
                                key={tr.$id}
                                className="p-2.5 rounded-xl bg-[#150D2E] border border-purple-500/30 text-xs space-y-1"
                              >
                                <div className="flex justify-between items-center">
                                  <span
                                    className={`text-[10px] font-black px-2 py-0.5 rounded ${
                                      tr.type === 'achat'
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : 'bg-rose-500/20 text-rose-400'
                                    }`}
                                  >
                                    {tr.type === 'achat' ? 'BUY' : 'SELL'} {isHedgeSpot ? 'SPOT' : `x${lev}`} • {tr.paire}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleClosePosition(tr)}
                                    className="px-2.5 py-1 rounded bg-rose-600/80 hover:bg-rose-500 text-white font-black text-[10px] transition"
                                  >
                                    {isHedgeSpot ? 'SELL / CLOSE' : 'Clôturer'}
                                  </button>
                                </div>
                                <div className="flex justify-between text-[11px] font-mono">
                                  <span className="text-purple-300">
                                    {isHedgeSpot
                                      ? `${amountUsdt.toFixed(2)} USDT (${cryptoQty.toFixed(6)}) @ $${formatCoinPrice(tr.prix)}`
                                      : `Marge Isolée: ${Number(tr.montant).toLocaleString('fr-FR')} Ar @ $${formatCoinPrice(tr.prix)}`}
                                  </span>
                                  <span className={`font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {isHedgeSpot
                                      ? `${isProfit ? '+' : ''}${livePnlUsdt.toFixed(4)} USDT`
                                      : `${isProfit ? '+' : ''}${liveProfitAr.toLocaleString('fr-FR')} Ar`}
                                  </span>
                                </div>
                                {liqPrice > 0 && (
                                  <div className="flex justify-between text-[9px] font-mono text-rose-300/90">
                                    <span>Liq. Individuelle : ${formatCoinPrice(liqPrice)}</span>
                                    <span>
                                      {(tr.mode || 'Pont Marché').replace(/\s*\[(BYBIT|OKX|BINANCE)\]/gi, '') || 'Pont Marché'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* ====================================================
                    MODE B : AUTO STRATÉGIE (BOTS POUR DÉBUTANT)
                   ==================================================== */}
                {tradeStrategyChoice === 'BOT' && (
                  <div className="p-3.5 rounded-2xl bg-[#1D1240] border-2 border-emerald-500/50 space-y-3 shadow-[0_0_20px_rgba(16,185,129,0.18)]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bot className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-black text-white">Bots Trading Automatiques</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-emerald-300">Exécution Auto</span>
                    </div>

                    {/* CHOIX DES BOTS : SPOT GRID BOT (BOT 1), ROBOT ÉCHANGE (BOT 2) & BOT 3 TRÈS INTELLIGENT */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedBotType('SPOT_GRID')}
                        className={`p-3 rounded-xl border text-left transition space-y-1 ${
                          selectedBotType === 'SPOT_GRID'
                            ? 'bg-[#251552] border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                            : 'bg-[#150D2E] border-purple-500/30 opacity-80'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs text-white">1. Spot Grid Bot</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">Auto</span>
                        </div>
                        <p className="text-[10px] text-purple-200 leading-snug">
                          Achète bas et vend haut automatiquement en grille.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedBotType('BOT_ECHANGE')}
                        className={`p-3 rounded-xl border text-left transition space-y-1 ${
                          selectedBotType === 'BOT_ECHANGE'
                            ? 'bg-[#251552] border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                            : 'bg-[#150D2E] border-purple-500/30 opacity-80'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-black text-xs text-white">2. ROBOT ÉCHANGE</span>
                          <span
                            className={`text-[9px] font-mono-num font-black ${
                              botExchangeEngine.enabled ? 'text-emerald-400' : 'text-purple-200'
                            }`}
                          >
                            {botExchangeEngine.enabled ? 'ON' : 'Spot'}
                          </span>
                        </div>
                        <p className="text-[10px] text-purple-200 leading-snug">
                          Spot uniquement · Buy -3% · Échange +2% · Sortie anticipée +1% · Stop Loss -2%.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedBotType('BOT_3')}
                        className={`col-span-2 p-3 rounded-xl border text-left transition space-y-1 ${
                          selectedBotType === 'BOT_3'
                            ? 'bg-[#251552] border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                            : 'bg-[#150D2E] border-[#8B5CF6]/50 opacity-90 hover:opacity-100'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black text-xs text-white">
                            3. BOT 3 — TRÈS INTELLIGENT SALOMA
                          </span>
                          <span
                            className={`text-[10px] font-mono-num font-black ${
                              bot3Engine.state.enabled ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {bot3Engine.state.enabled ? 'ON' : 'OFF'}
                          </span>
                        </div>
                        <p className="text-[10px] text-purple-200 leading-snug">
                          100% autonome · Scan bougie 1m (1..9 / 9..5) · Limit Order · Compound · Avatar 3D Live
                        </p>
                      </button>
                    </div>

                    {selectedBotType === 'BOT_3' ? (
                      <Bot3Panel
                        engine={bot3Engine}
                        coins={coins}
                        formatCoinPrice={formatCoinPrice}
                      />
                    ) : selectedBotType === 'BOT_ECHANGE' ? (
                      <BotExchangePanel
                        engine={botExchangeEngine}
                        formatCoinPrice={formatCoinPrice}
                      />
                    ) : (
                      <>
                    {/* CONFIGURATION SIMPLE DU BOT 1 (SPOT GRID BOT) */}
                    <div className="p-3 rounded-xl bg-[#150D2E] border border-purple-500/30 space-y-2.5 text-xs">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-purple-300 font-bold">Paire sélectionnée :</span>
                        <span className="font-mono font-black text-white">{selectedCoin.symbol}/USDT (${formatCoinPrice(selectedCoin.price)})</span>
                      </div>

                      <div>
                        <div className="flex justify-between items-center text-[11px] mb-1">
                          <label className="font-bold text-purple-300">
                            Montant investi ({selectedBotCurrencyObj.shortLabel}) • <strong className="text-emerald-300">Min : 5$</strong>
                          </label>
                          <span className="font-mono text-[10px] text-emerald-300">
                            {botAmountCurrency === 'ARIARY'
                              ? `≈ $${(numericBotAmountAr / USD_TO_MGA).toFixed(2)} USD`
                              : `≈ ${numericBotAmountAr.toLocaleString('fr-FR')} Ar`}
                          </span>
                        </div>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={botAmountInput}
                            onChange={e => setBotAmountInput(sanitizeDecimalInput(e.target.value))}
                            placeholder={`Ex: ${botAmountCurrency === 'ARIARY' ? '25000' : '5'}`}
                            className="flex-1 px-3 py-2 rounded-xl bg-[#100926] border border-purple-500/40 text-white font-mono font-bold text-xs focus:outline-none focus:border-[#8B5CF6]"
                          />
                          <select
                            aria-label="Devise du montant Bot"
                            value={botAmountCurrency}
                            onChange={e => handleChangeBotAmountCurrency(e.target.value)}
                            className="px-2.5 py-2 rounded-xl bg-[#23154D] border border-[#8B5CF6]/70 text-white text-xs font-black focus:outline-none"
                          >
                            {tradeAmountCurrencies.map(c => (
                              <option key={c.symbol} value={c.symbol}>
                                {c.symbol === 'ARIARY' ? 'ARIARY' : c.symbol}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-4 gap-1 mt-1.5">
                          {[25, 50, 75, 100].map(pct => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() =>
                                setBotAmountInput(
                                  formatConvertedCurrencyAmount(
                                    (soldeCompteTradeAr * pct) / 100,
                                    botAmountCurrency,
                                    selectedBotCurrencyObj.priceAr
                                  )
                                )
                              }
                              className="py-1 rounded-lg bg-[#190F38] border border-purple-500/30 text-[10px] font-mono font-bold text-purple-200"
                            >
                              {pct === 100 ? 'MAX' : `${pct}%`}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-purple-300 block mb-1">
                          Mode Grille (Fourchette ±5% auto) :
                        </label>
                        <div className="grid grid-cols-3 gap-1">
                          {(['Prudent (5 grilles)', 'Équilibré (10 grilles)', 'Dynamique (20 grilles)'] as const).map(prof => (
                            <button
                              key={prof}
                              type="button"
                              onClick={() => setBotGridProfile(prof)}
                              className={`py-1.5 px-1 rounded-lg text-[10px] font-bold border transition ${
                                botGridProfile === prof
                                  ? 'bg-[#7C3AED] border-purple-300 text-white'
                                  : 'bg-[#100926] border-purple-500/30 text-purple-200'
                              }`}
                            >
                              {prof}
                            </button>
                          ))}
                        </div>
                        <div className="flex justify-between text-[10px] font-mono text-emerald-300 mt-1.5">
                          <span>Bas: ${formatCoinPrice(selectedCoin.price * 0.95)}</span>
                          <span>Haut: ${formatCoinPrice(selectedCoin.price * 1.05)}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={botSubmitting}
                        onClick={handleStartBot}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-[#7C3AED] text-white font-black text-xs shadow flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-50"
                      >
                        <Play className="w-4 h-4" />
                        <span>
                          {botSubmitting ? 'DÉMARRAGE...' : 'START SPOT GRID BOT'}
                        </span>
                      </button>
                    </div>

                    {/* BOTS ACTIFS AVEC BOUTON STOP */}
                    <div className="space-y-2 pt-1">
                      <span className="text-xs font-black text-white block">
                        Bots en cours d'exécution ({activeBotTrades.length})
                      </span>
                      {activeBotTrades.length === 0 ? (
                        <div className="p-3 rounded-xl bg-[#150D2E] text-center text-[11px] text-purple-300 border border-purple-500/20">
                          Aucun bot actif. Choisissez un bot et cliquez sur START.
                        </div>
                      ) : (
                        activeBotTrades.map(botTr => {
                          const livePrice = getLivePriceForPair(botTr.paire, botTr.prix);
                          const diff = (livePrice - botTr.prix) / (botTr.prix || 1);
                          const liveProfitAr = Math.round(botTr.montant * diff);
                          const isProfit = liveProfitAr >= 0;
                          return (
                            <div
                              key={botTr.$id}
                              className="p-3 rounded-xl bg-[#150D2E] border border-emerald-500/40 text-xs space-y-1.5"
                            >
                              <div className="flex justify-between items-center gap-2">
                                <div>
                                  <span className="text-[10px] font-black text-emerald-300 flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                    {botTr.mode}
                                  </span>
                                  <span className="font-bold text-white text-xs block">{botTr.paire}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleClosePosition(botTr)}
                                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] flex items-center gap-1"
                                >
                                  <Square className="w-3 h-3" />
                                  STOP BOT
                                </button>
                              </div>
                              <div className="flex justify-between text-[11px] font-mono pt-1 border-t border-purple-500/20">
                                <span className="text-purple-300">
                                  Capital: {Number(botTr.montant).toLocaleString('fr-FR')} Ar @ ${formatCoinPrice(botTr.prix)}
                                </span>
                                <span className={`font-black ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {isProfit ? '+' : ''}
                                  {liveProfitAr.toLocaleString('fr-FR')} Ar
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                      </>
                    )}
                  </div>
                )}

                {/* 4. CARNET D'ORDRES */}
                <div className="p-3 rounded-2xl bg-[#190F38] border border-[#8B5CF6]/45 space-y-2">
                  <div className="flex justify-between items-center text-[11px] font-black text-white">
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-[#8B5CF6]" />
                      Carnet d'ordres {selectedCoin.symbol}/USDT
                    </span>
                    <span className="text-[10px] font-mono text-purple-300">Écart: ${orderBook.spread}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-emerald-400/80 font-bold pb-0.5 border-b border-purple-500/20">
                        <span>Achat (Prix)</span>
                        <span>Qté</span>
                      </div>
                      {orderBook.bids.map((bid, i) => (
                        <div key={i} className="relative flex justify-between items-center py-0.5 px-1 rounded overflow-hidden">
                          <div className="absolute left-0 top-0 bottom-0 bg-emerald-500/15" style={{ width: `${bid.depth}%` }} />
                          <span className="text-emerald-400 font-bold z-10">${formatCoinPrice(bid.price)}</span>
                          <span className="text-slate-200 z-10">{bid.qty}</span>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-rose-400/80 font-bold pb-0.5 border-b border-purple-500/20">
                        <span>Vente (Prix)</span>
                        <span>Qté</span>
                      </div>
                      {orderBook.asks.map((ask, i) => (
                        <div key={i} className="relative flex justify-between items-center py-0.5 px-1 rounded overflow-hidden">
                          <div className="absolute right-0 top-0 bottom-0 bg-rose-500/15" style={{ width: `${ask.depth}%` }} />
                          <span className="text-rose-400 font-bold z-10">${formatCoinPrice(ask.price)}</span>
                          <span className="text-slate-200 z-10">{ask.qty}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 5. TABLEAU */}
                <div className="p-3.5 rounded-2xl bg-[#1D1240] border-2 border-[#8B5CF6]/50 space-y-2">
                  <span className="text-xs font-black text-white flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-purple-400" />
                    Tableau : Position &amp; Levier
                  </span>
                  {(() => {
                    const isManualSpot = tradeStrategyChoice === 'MANUEL' && tradingModeType === 'SPOT';
                    const activeAmt = isManualSpot
                      ? Math.round(spotOrderUsdtEquiv * USD_TO_MGA)
                      : tradeStrategyChoice === 'BOT'
                      ? numericBotAmountAr
                      : numericAmountAr;
                    const activeLev = tradeStrategyChoice === 'BOT' ? 1 : tradingModeType === 'SPOT' ? 1 : numericLeverage;
                    const feeAr = Math.round(activeAmt * ((salomaFees.tradeFeePct || 0.1) / 100));
                    return (
                      <div className="overflow-hidden rounded-xl border border-purple-500/30 text-xs">
                        <table className="w-full text-left">
                          <tbody className="divide-y divide-purple-500/20 bg-[#150D2E]">
                            <tr>
                              <td className="px-3 py-2 text-purple-300">Montant Trade</td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-white">
                                {isManualSpot
                                  ? `${spotOrderUsdtEquiv.toFixed(2)} USDT`
                                  : `${activeAmt.toLocaleString('fr-FR')} Ar`}
                              </td>
                            </tr>
                            <tr>
                              <td className="px-3 py-2 text-amber-300 font-bold">
                                Frais SALOMA ({salomaFees.tradeFeePct}%)
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-amber-300">
                                {isManualSpot
                                  ? `${(spotOrderUsdtEquiv * ((salomaFees.tradeFeePct || 0.1) / 100)).toFixed(4)} USDT`
                                  : `${feeAr.toLocaleString('fr-FR')} Ar`}
                              </td>
                            </tr>
                            <tr>
                              <td className="px-3 py-2 text-purple-300">Prix SALOMA appliqué</td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-purple-200">
                                ${formatCoinPrice(selectedCoin.price)}
                              </td>
                            </tr>
                            <tr className="bg-[#1F1042]/70 font-bold">
                              <td className="px-3 py-2 text-white">
                                Valeur position (x{activeLev})
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-emerald-400">
                                {isManualSpot
                                  ? `${spotOrderUsdtEquiv.toFixed(2)} USDT`
                                  : `${(activeAmt * activeLev).toLocaleString('fr-FR')} Ar`}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>

                {/* 6. HISTORIQUE TRADING (Appwrite `trades` terminés) */}
                <div className="p-3.5 rounded-2xl bg-[#1D1240] border-2 border-[#8B5CF6]/50 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-white flex items-center gap-1.5">
                      <BarChart2 className="w-3.5 h-3.5 text-purple-400" />
                      Historique des Ordres ({closedTrades.length})
                    </span>
                    {closedTrades.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setClearHistoryTarget('trade')}
                        className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/50 text-rose-300 text-[10px] font-black inline-flex items-center gap-1 transition"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Tout supprimer</span>
                      </button>
                    )}
                  </div>
                  {closedTrades.length === 0 ? (
                    <div className="text-center py-3 text-xs text-purple-400/70">Aucun trade clôturé</div>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {closedTrades.map(item => {
                        const isSpotOrder = (item.mode || '').startsWith('Spot ');
                        return (
                          <div
                            key={item.$id}
                            className="flex justify-between items-center p-2 rounded-xl bg-[#150D2E] text-xs"
                          >
                            <div>
                              <span className="font-bold text-white">
                                {item.type === 'achat' ? 'BUY' : 'SELL'} {item.paire}{' '}
                                {isSpotOrder ? 'SPOT' : `x${item.leverage || 1}`}
                                {item.mode && item.mode !== 'Manuel' && !isSpotOrder ? ` • ${item.mode}` : ''}
                              </span>
                              <span className="text-[10px] text-purple-400 block">
                                Prix SALOMA : ${formatCoinPrice(item.prix)}
                                {!isSpotOrder ? ` → $${formatCoinPrice(item.close_price || item.prix)}` : ''}
                              </span>
                            </div>
                            {isSpotOrder ? (
                              <span className="font-mono font-bold text-emerald-300 text-[11px]">
                                {(item.mode || '').replace(/^Spot\s+/i, '')}
                              </span>
                            ) : (
                              <span
                                className={`font-mono font-bold ${
                                  (Number(item.profit) || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {(Number(item.profit) || 0) >= 0 ? '+' : ''}
                                {Number(item.profit || 0).toLocaleString('fr-FR')} Ar
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ========================================================
                TAB 4: PORTEFEUILLE RÉEL (Appwrite `Wallets` + `depots_retraits`)
               ======================================================== */}
            {activeTab === 'wallet' && (
              <div className="space-y-4">
                {appwriteStatusError && (
                  <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-400/50 text-amber-200 text-xs font-bold">
                    {appwriteStatusError} — Live Balance : 0 Ar
                  </div>
                )}
                <div className="p-4 rounded-3xl bg-gradient-to-br from-[#2D165A] via-[#1F1042] to-[#150D2E] border-2 border-[#8B5CF6] shadow-[0_0_25px_rgba(124,58,237,0.5)]">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-purple-300">Solde Total Portefeuille</span>
                    <button
                      onClick={() => setDisplayCurrency(displayCurrency === 'MGA' ? 'USD' : 'MGA')}
                      className="px-2.5 py-0.5 rounded-full bg-purple-900/60 text-[10px] text-purple-200 border border-purple-400/40 font-bold"
                    >
                      {displayCurrency === 'MGA' ? 'Afficher en USD' : 'Afficher en Ariary'}
                    </button>
                  </div>
                  <h1 className="text-3xl font-black text-white font-mono">
                    {formatMoney(soldeTotalAr)}
                  </h1>
                  <p className="text-xs font-bold text-purple-300 font-mono mt-0.5">
                    ≈ {formatMoney(soldeTotalAr, displayCurrency === 'MGA' ? 'USD' : 'MGA')} • {clientUsdtBalance.toFixed(2)} USDT SALOMA
                  </p>

                  {/* 2 SOLDES SÉPARÉS : WALLET & COMPTE TRADE */}
                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-purple-500/20 text-xs">
                    <div className="bg-[#150D2E]/90 p-3 rounded-2xl border border-emerald-500/35 space-y-0.5">
                      <span className="text-[10px] text-emerald-300 block font-black uppercase">
                        1. WALLET (Dépôt/Retrait)
                      </span>
                      <span className="font-black text-emerald-400 font-mono text-sm block">
                        {formatMoney(soldeDisponibleAr)}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-emerald-200 block">
                        {clientUsdtBalance.toFixed(4)} USDT SALOMA
                      </span>
                    </div>
                    <div className="bg-[#150D2E]/90 p-3 rounded-2xl border border-[#8B5CF6]/50 space-y-0.5">
                      <span className="text-[10px] text-purple-200 block font-black uppercase">
                        2. COMPTE TRADE
                      </span>
                      <span className="font-black text-white font-mono text-sm block">
                        {formatMoney(soldeCompteTradeAr)}
                      </span>
                      <span className="text-[9px] text-amber-300 font-mono block">
                        {soldeBloqueAr > 0
                          ? `Marge isolée: ${formatMoney(soldeBloqueAr)}`
                          : 'Prêt pour Manuel & Bots'}
                      </span>
                    </div>
                  </div>

                  {/* 3 BOUTONS : DÉPÔT | CONVERTIR | RETRAIT */}
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <button
                      type="button"
                      onClick={handleOpenDeposit}
                      className="py-2.5 rounded-2xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1"
                    >
                      <ArrowDownLeft className="w-4 h-4" /> Dépôt
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConvertDirection('WALLET_TO_TRADE');
                        setConvertAmountInput('');
                        setActiveModal('convert');
                      }}
                      className="py-2.5 rounded-2xl bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center gap-1 shadow"
                    >
                      <ArrowRightLeft className="w-4 h-4" /> Convertir
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenWithdraw}
                      className="py-2.5 rounded-2xl bg-[#7C3AED] text-white font-bold text-xs flex items-center justify-center gap-1"
                    >
                      <ArrowUpRight className="w-4 h-4" /> Retrait
                    </button>
                  </div>
                </div>

                {/* Soldes Cryptos réels depuis coins_json (50 COINS) */}
                <div className="p-3.5 rounded-2xl bg-[#1D1240] border-2 border-[#8B5CF6]/50 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-purple-400" /> Actifs Crypto Portefeuille
                    </span>
                    <span className="text-[10px] text-purple-300 font-bold">{coins.length} Coins</span>
                  </div>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {coins.map(coin => (
                      <div
                        key={coin.id}
                        onClick={() => {
                          setSelectedWalletCoinId(coin.id);
                          setSelectedNetworkIndex(0);
                          setCopiedDepositAddress(false);
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition border ${
                          selectedWalletCoinId === coin.id
                            ? 'bg-[#251552] border-[#8B5CF6]'
                            : 'bg-[#150D2E] border-purple-500/20 hover:border-purple-400/40'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs border shrink-0 ${coin.iconBg}`}>
                            {coin.symbol.slice(0, 3)}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-xs text-white block truncate">
                              {coin.name} ({coin.symbol})
                            </span>
                            <span className="text-[10px] text-purple-400 block font-mono truncate">
                              ${formatCoinPrice(coin.price)} • {coin.networks[0]?.chain || coin.symbol}
                            </span>
                          </div>
                        </div>
                        <span className="font-mono text-xs text-white font-bold shrink-0">
                          {(coinsJson[coin.symbol.toUpperCase()] || 0).toFixed(6)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Historique réel des dépôts et retraits (depots_retraits) */}
                <div className="p-3.5 rounded-2xl bg-[#1D1240] border border-[#8B5CF6]/40 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-white">
                      Historique Dépôts &amp; Retraits ({depotsRetraitsList.length})
                    </span>
                    {depotsRetraitsList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setClearHistoryTarget('wallet')}
                        className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/50 text-rose-300 text-[10px] font-black inline-flex items-center gap-1 transition"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Tout supprimer</span>
                      </button>
                    )}
                  </div>

                  {depotsRetraitsList.length === 0 ? (
                    <div className="p-3 rounded-xl bg-[#150D2E] text-center text-[11px] text-purple-400 border border-purple-500/20">
                      Aucune transaction enregistrée
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto">
                      {depotsRetraitsList.map(tx => (
                        <div
                          key={tx.$id}
                          className="p-2.5 rounded-xl bg-[#150D2E] flex justify-between items-center text-[11px] border border-purple-500/20"
                        >
                          <div>
                            <span className="font-bold text-white uppercase block">
                              {tx.type} • {Number(tx.montant).toLocaleString('fr-FR')} {tx.devise}
                            </span>
                            <span className="text-[10px] text-purple-400 block">
                              {tx.methode} ({tx.numero_compte}) • {tx.date ? new Date(tx.date).toLocaleString('fr-FR') : ''}
                            </span>
                          </div>
                          <span
                            className={`font-mono font-bold px-2 py-0.5 rounded text-[10px] ${
                              tx.statut === 'valide'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : tx.statut === 'refuse'
                                ? 'bg-rose-500/20 text-rose-400'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {tx.statut}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            <footer className="mt-5 pt-3 pb-2 border-t border-purple-500/20 text-center text-[11px] text-purple-300/80 flex items-center justify-center">
              <span>© SALOMA</span>
            </footer>
          </main>

          {/* BOTTOM NAVIGATION */}
          <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#150D2E]/95 backdrop-blur-lg border-t-2 border-[#8B5CF6]/50 px-2 py-2 flex items-center justify-around z-30 shadow-[0_-4px_25px_rgba(21,13,46,0.9)]">
            <button
              onClick={() => setActiveTab('earn')}
              className={`flex-1 flex flex-col items-center gap-0.5 transition ${
                activeTab === 'earn' ? 'text-[#8B5CF6] font-black' : 'text-purple-300/60'
              }`}
            >
              <Gift className="w-5 h-5" />
              <span className="text-[10px]">Earn</span>
            </button>
            <button
              onClick={() => setActiveTab('trading')}
              className={`flex-1 flex flex-col items-center gap-0.5 transition ${
                activeTab === 'trading' ? 'text-[#8B5CF6] font-black' : 'text-purple-300/60'
              }`}
            >
              <BarChart2 className="w-5 h-5" />
              <span className="text-[10px]">Trading</span>
            </button>
            <button
              onClick={() => setActiveTab('exchange')}
              className={`flex-1 flex flex-col items-center gap-0.5 transition ${
                activeTab === 'exchange' ? 'text-[#8B5CF6] font-black' : 'text-purple-300/60'
              }`}
            >
              <Repeat className="w-5 h-5" />
              <span className="text-[10px]">Échange</span>
            </button>
            <button
              onClick={() => setActiveTab('wallet')}
              className={`flex-1 flex flex-col items-center gap-0.5 transition ${
                activeTab === 'wallet' ? 'text-[#8B5CF6] font-black' : 'text-purple-300/60'
              }`}
            >
              <Wallet className="w-5 h-5" />
              <span className="text-[10px]">Portefeuille</span>
            </button>
          </nav>
        </div>
      )}

      {/* ========================================================
          MODAL: NOTIFICATIONS APPWRITE REALTIME
         ======================================================== */}
      {activeModal === 'notifications' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#1D1240] border-2 border-[#8B5CF6] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-3 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-[#8B5CF6]" />
                <h3 className="font-black text-white text-base">
                  Notifications ({unreadNotificationsCount} non lues)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openPriceAlertsModal(selectedCoin.symbol)}
                  className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-400/40 inline-flex items-center gap-1"
                >
                  <Bell className="w-3 h-3" />
                  <span>Alertes prix{activePriceAlertsCount > 0 ? ` (${activePriceAlertsCount})` : ''}</span>
                </button>
                {unreadNotificationsCount > 0 && (
                  <button
                    onClick={handleMarkAllNotificationsRead}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-[#7C3AED]/40 text-purple-100 border border-[#8B5CF6]/50"
                  >
                    Tout lire
                  </button>
                )}
                <button onClick={() => setActiveModal(null)} className="text-purple-300">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {notificationsList.length === 0 ? (
                <div className="p-6 text-center text-xs text-purple-300">Aucune notification pour le moment.</div>
              ) : (
                notificationsList.map(notif => (
                  <div
                    key={notif.$id}
                    onClick={() => handleMarkNotificationRead(notif)}
                    className={`p-3 rounded-2xl border cursor-pointer transition space-y-1 ${
                      notif.lu
                        ? 'bg-[#150D2E]/80 border-purple-500/20 opacity-80'
                        : 'bg-[#251552] border-[#8B5CF6] shadow-[0_0_12px_rgba(124,58,237,0.35)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-xs text-white flex items-center gap-1.5">
                        {!notif.lu && <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />}
                        {notif.titre}
                      </span>
                      <span className="text-[9px] font-mono text-purple-300">
                        {notif.date ? new Date(notif.date).toLocaleString('fr-FR') : ''}
                      </span>
                    </div>
                    <p className="text-xs text-purple-100">{notif.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: ALERTES DE PRIX CRYPTO (HAUSSIÈRE / BAISSIÈRE)
         ======================================================== */}
      {activeModal === 'priceAlerts' && (() => {
        const alertCoinObj =
          coins.find(c => c.symbol.toUpperCase() === alertCoinSymbol.toUpperCase()) || selectedCoin;
        const currentLivePrice = alertCoinObj.price || 0;
        return (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-[#1D1240] border-2 border-[#8B5CF6] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[92vh] overflow-y-auto">
              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="p-1.5 rounded-lg bg-[#23154D] text-purple-300"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="text-center">
                  <h3 className="font-black text-white text-base flex items-center justify-center gap-1.5">
                    <Bell className="w-4 h-4 text-amber-300" />
                    <span>Alertes de Prix SALOMA</span>
                  </h3>
                  <span className="text-[10px] text-purple-300">
                    Notification Push &amp; In-App dès que le seuil est atteint
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="p-1.5 rounded-lg bg-[#23154D] text-purple-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* STATUT NOTIFICATION PUSH NAVIGATEUR */}
              <div className="p-2.5 rounded-xl bg-[#150D2E] border border-purple-500/30 flex items-center justify-between gap-2 text-[11px]">
                <span className="text-purple-200 font-bold">
                  Push navigateur :{' '}
                  <strong
                    className={
                      pushPermission === 'granted'
                        ? 'text-emerald-400'
                        : pushPermission === 'denied'
                        ? 'text-rose-400'
                        : 'text-amber-300'
                    }
                  >
                    {pushPermission === 'granted'
                      ? 'Activé ✓'
                      : pushPermission === 'denied'
                      ? 'Bloqué (In-App actif)'
                      : pushPermission === 'unsupported'
                      ? 'In-App actif'
                      : 'Non activé'}
                  </strong>
                </span>
                {pushPermission !== 'granted' && pushPermission !== 'unsupported' && (
                  <button
                    type="button"
                    onClick={handleRequestPushPermission}
                    className="px-2.5 py-1 rounded-lg bg-[#7C3AED] text-white text-[10px] font-black shrink-0"
                  >
                    Activer Push
                  </button>
                )}
              </div>

              {/* FORMULAIRE NOUVELLE ALERTE */}
              <form onSubmit={handleCreatePriceAlert} className="p-3.5 rounded-2xl bg-[#150D2E] border border-[#8B5CF6]/50 space-y-3 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-purple-300">Cryptomonnaie *</label>
                    <span className="text-[10px] font-mono text-emerald-300 font-bold">
                      Prix actuel : ${formatCoinPrice(currentLivePrice)}
                    </span>
                  </div>
                  <select
                    value={alertCoinObj.symbol}
                    onChange={e => {
                      const nextSym = e.target.value;
                      setAlertCoinSymbol(nextSym);
                      const nextCoin = coins.find(c => c.symbol === nextSym);
                      if (nextCoin) {
                        const mult = alertDirection === 'above' ? 1.02 : 0.98;
                        setAlertTargetPriceInput(formatCoinPrice(nextCoin.price * mult).replace(/,/g, ''));
                      }
                    }}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#190F38] border-2 border-[#8B5CF6]/40 text-white font-bold"
                  >
                    {coins.map(c => (
                      <option key={c.id} value={c.symbol}>
                        {c.symbol} — {c.name} (${formatCoinPrice(c.price)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-purple-300 block mb-1">Type d’alerte *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAlertDirection('above');
                        if (currentLivePrice > 0) {
                          setAlertTargetPriceInput(formatCoinPrice(currentLivePrice * 1.02).replace(/,/g, ''));
                        }
                      }}
                      className={`p-2.5 rounded-xl border-2 text-left transition flex items-center gap-2 ${
                        alertDirection === 'above'
                          ? 'bg-emerald-600/25 border-emerald-400 text-white'
                          : 'bg-[#190F38] border-purple-500/30 text-purple-300'
                      }`}
                    >
                      <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <span className="font-black block">Haussière</span>
                        <span className="text-[10px] opacity-85">Prix ≥ cible</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAlertDirection('below');
                        if (currentLivePrice > 0) {
                          setAlertTargetPriceInput(formatCoinPrice(currentLivePrice * 0.98).replace(/,/g, ''));
                        }
                      }}
                      className={`p-2.5 rounded-xl border-2 text-left transition flex items-center gap-2 ${
                        alertDirection === 'below'
                          ? 'bg-rose-600/25 border-rose-400 text-white'
                          : 'bg-[#190F38] border-purple-500/30 text-purple-300'
                      }`}
                    >
                      <TrendingDown className="w-4 h-4 text-rose-400 shrink-0" />
                      <div>
                        <span className="font-black block">Baissière</span>
                        <span className="text-[10px] opacity-85">Prix ≤ cible</span>
                      </div>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-purple-300 block mb-1">
                    Seuil cible en USD ($) *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={alertTargetPriceInput}
                    onChange={e => setAlertTargetPriceInput(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder={`Ex: ${formatCoinPrice(currentLivePrice)}`}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#190F38] border-2 border-[#8B5CF6]/40 text-white font-mono font-bold"
                  />
                  <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                    {[-5, -2, 2, 5].map(pct => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          if (currentLivePrice <= 0) return;
                          setAlertDirection(pct >= 0 ? 'above' : 'below');
                          setAlertTargetPriceInput(
                            formatCoinPrice(currentLivePrice * (1 + pct / 100)).replace(/,/g, '')
                          );
                        }}
                        className={`py-1 rounded-lg bg-[#190F38] border border-purple-500/30 text-[10px] font-mono font-bold ${
                          pct >= 0 ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {pct > 0 ? `+${pct}%` : `${pct}%`}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="font-bold text-purple-300 block mb-1">Note (optionnel)</label>
                  <input
                    type="text"
                    maxLength={120}
                    value={alertNoteInput}
                    onChange={e => setAlertNoteInput(e.target.value)}
                    placeholder={`Ex: Objectif ${alertCoinObj.symbol}`}
                    className="w-full px-3 py-2 rounded-xl bg-[#190F38] border border-[#8B5CF6]/40 text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={alertSubmitting}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white font-black text-xs shadow disabled:opacity-60"
                >
                  {alertSubmitting ? 'Enregistrement...' : 'Créer l’alerte de prix'}
                </button>
              </form>

              {/* LISTE DES ALERTES UTILISATEUR */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-purple-200">
                  <span>Mes alertes ({priceAlertsList.length})</span>
                  <span className="text-[10px] font-mono text-emerald-300">
                    {activePriceAlertsCount} active{activePriceAlertsCount > 1 ? 's' : ''}
                  </span>
                </div>

                {priceAlertsList.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-[#150D2E] border border-purple-500/20 text-center text-xs text-purple-300">
                    Aucune alerte configurée. Créez une alerte haussière ou baissière ci-dessus.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {priceAlertsList.map(alert => {
                      const live =
                        coins.find(c => c.symbol.toUpperCase() === alert.symbol.toUpperCase())?.price || 0;
                      const diffPct =
                        live > 0 ? (((alert.targetPriceUsd - live) / live) * 100).toFixed(2) : null;
                      return (
                        <div
                          key={alert.id}
                          className={`p-3 rounded-2xl border space-y-1.5 text-xs ${
                            alert.triggered
                              ? 'bg-emerald-950/35 border-emerald-400/50'
                              : alert.active
                              ? 'bg-[#150D2E] border-[#8B5CF6]/50'
                              : 'bg-[#150D2E]/60 border-purple-500/20 opacity-75'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-white">{alert.symbol}/USDT</span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                                  alert.direction === 'above'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-rose-500/20 text-rose-300'
                                }`}
                              >
                                {alert.direction === 'above' ? 'Haussière ≥' : 'Baissière ≤'} $
                                {formatCoinPrice(alert.targetPriceUsd)}
                              </span>
                            </div>
                            <span
                              className={`text-[9px] font-mono font-black px-1.5 py-0.5 rounded ${
                                alert.triggered
                                  ? 'bg-emerald-500/25 text-emerald-300'
                                  : alert.active
                                  ? 'bg-[#7C3AED]/30 text-purple-200'
                                  : 'bg-slate-600/30 text-slate-300'
                              }`}
                            >
                              {alert.triggered ? 'Atteinte ✓' : alert.active ? 'Active' : 'En pause'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-purple-300">
                            <span>
                              Actuel : ${formatCoinPrice(live)}
                              {diffPct !== null && ` (${Number(diffPct) >= 0 ? '+' : ''}${diffPct}%)`}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleToggleOrRearmAlert(alert)}
                                className="px-2 py-0.5 rounded bg-[#23154D] border border-purple-400/40 text-purple-100 font-bold"
                              >
                                {alert.triggered ? 'Réactiver' : alert.active ? 'Pause' : 'Activer'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePriceAlert(alert.id)}
                                className="p-1 rounded bg-rose-500/20 text-rose-300"
                                title="Supprimer l’alerte"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          {alert.note && <p className="text-[10px] text-purple-200 italic">{alert.note}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================
          MODAL: DÉPÔT CRYPTO UNIQUEMENT (50 COINS + CHAÎNE & RÉSEAU)
         ======================================================== */}
      {activeModal === 'deposit' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#1D1240] border-2 border-[#8B5CF6] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <button onClick={() => setActiveModal(null)} className="p-1.5 rounded-lg bg-[#23154D] text-purple-300">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h3 className="font-black text-white text-base">Dépôt Crypto SALOMA</h3>
              <button onClick={() => setActiveModal(null)} className="p-1.5 rounded-lg bg-[#23154D] text-purple-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            {renderWalletCoinChainNetworkSelector()}

            <div className="p-3.5 rounded-2xl bg-[#150D2E] border border-[#8B5CF6]/50 space-y-2 text-center">
              <div className="flex items-center justify-between text-[10px] font-bold bg-[#190F38] px-2.5 py-1.5 rounded-xl border border-purple-500/30">
                <span className="text-purple-300">
                  Chaîne : <strong className="text-emerald-300">{activeBlockchain}</strong>
                </span>
                <span className="text-purple-300">
                  Réseau : <strong className="text-white">{activeNetworkLabel}</strong>
                </span>
              </div>
              <span className="text-[10px] font-bold text-purple-300 block uppercase">
                Adresse de dépôt {selectedWalletCoin.symbol} ({activeNetwork.name})
              </span>
              <span className="font-mono text-xs text-white break-all block bg-[#100926] p-2.5 rounded-xl border border-purple-500/20">
                {activeClientDepositAddress ||
                  (walletAddressPhase === 'loading'
                    ? 'Génération de votre adresse wallet...'
                    : provisionalClientDepositAddress)}
              </span>
              {!activeClientDepositAddress && (
                <div className="flex flex-wrap items-center justify-center gap-2 text-[10px]">
                  {walletAddressPhase === 'slow' && (
                    <span className="text-amber-300 font-bold">
                      Adresse provisoire ({selectedWalletCoin.symbol})
                    </span>
                  )}
                  {walletAddressPhase === 'timeout' && (
                    <button
                      type="button"
                      onClick={() => {
                        setWalletAddressPhase('loading');
                        setWalletAddressRetryCount(c => c + 1);
                        void fetchWalletAddressesFast(selectedWalletCoin.symbol, activeNetwork.chain);
                      }}
                      className="text-amber-300 font-bold underline"
                    >
                      Cliquez pour générer
                    </button>
                  )}
                  {walletAddressPhase !== 'loading' && (
                    <button
                      type="button"
                      onClick={() => {
                        setWalletAddressPhase('loading');
                        setWalletAddressRetryCount(c => c + 1);
                        void fetchWalletAddressesFast(selectedWalletCoin.symbol, activeNetwork.chain);
                      }}
                      className="px-2 py-0.5 rounded bg-[#23154D] border border-purple-400/40 text-purple-100 font-bold"
                    >
                      Réessayer
                    </button>
                  )}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-purple-300 pt-1">
                <div className="text-left font-mono space-y-0.5">
                  <span className="block text-emerald-300 font-bold">
                    Min Dépôt : 1$ équivalent (ex: 1 USDT)
                  </span>
                  <span className="block text-purple-200">
                    Min {selectedWalletCoin.symbol} : {activeMinDepositCoinQtyLabel} {selectedWalletCoin.symbol}
                  </span>
                  <span className="block text-purple-400">Coût réseau : {activeNetwork.withdrawFee} {selectedWalletCoin.symbol}</span>
                </div>
                <button
                  type="button"
                  disabled={!displayedClientDepositAddress}
                  onClick={() => {
                    if (!displayedClientDepositAddress) return;
                    navigator.clipboard?.writeText(displayedClientDepositAddress);
                    setCopiedDepositAddress(true);
                    showToast(`✓ Adresse ${selectedWalletCoin.symbol} (${activeNetworkLabel}) copiée !`);
                    setTimeout(() => setCopiedDepositAddress(false), 2000);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#7C3AED] text-white text-[11px] font-bold inline-flex items-center gap-1 disabled:opacity-50"
                >
                  {copiedDepositAddress ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedDepositAddress ? 'Adresse copiée ✓' : 'Copier adresse'}</span>
                </button>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-purple-300 block mb-1">
                  Montant envoyé ({selectedWalletCoin.symbol}) *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={depositAmountInput}
                  onChange={e => setDepositAmountInput(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder={`Min: ${activeMinDepositCoinQtyLabel} ${selectedWalletCoin.symbol} (1$)`}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#150D2E] border-2 border-[#8B5CF6]/40 text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-purple-300 block mb-1">
                  TX Hash (Identifiant Transaction Blockchain) *
                </label>
                <input
                  type="text"
                  value={depositAccountInput}
                  onChange={e => setDepositAccountInput(e.target.value)}
                  placeholder="Collez votre TX Hash ici (ex: 0x9f8a... ou hash TRON)"
                  className="w-full px-3 py-2.5 rounded-xl bg-[#150D2E] border-2 border-[#8B5CF6]/40 text-white font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-purple-300 block mb-1">Note / Adresse expéditrice (optionnel)</label>
                <input
                  type="text"
                  value={depositPreuveInput}
                  onChange={e => setDepositPreuveInput(e.target.value)}
                  placeholder="Optionnel"
                  className="w-full px-3 py-2.5 rounded-xl bg-[#150D2E] border border-[#8B5CF6]/40 text-white"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={depositSubmitting}
              onClick={handleConfirmDepositRequest}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-xs font-black shadow disabled:opacity-60"
            >
              {depositSubmitting ? 'Envoi en cours...' : 'Envoyer la demande de dépôt Crypto'}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: CONVERTIR WALLET ⇄ COMPTE TRADE (0% FRAIS)
         ======================================================== */}
      {activeModal === 'convert' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#1D1240] border-2 border-[#8B5CF6] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <button onClick={() => setActiveModal(null)} className="p-1.5 rounded-lg bg-[#23154D] text-purple-300">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h3 className="font-black text-white text-base">Convertir Wallet ⇄ Compte Trade</h3>
              <button onClick={() => setActiveModal(null)} className="p-1.5 rounded-lg bg-[#23154D] text-purple-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setConvertDirection('WALLET_TO_TRADE')}
                className={`p-3 rounded-2xl border-2 text-left transition ${
                  convertDirection === 'WALLET_TO_TRADE'
                    ? 'bg-[#251552] border-emerald-400 text-white'
                    : 'bg-[#150D2E] border-purple-500/30 text-purple-300'
                }`}
              >
                <span className="font-black block">Wallet → Trade</span>
                <span className="text-[10px] opacity-85">Pour trader (Manuel/Bot)</span>
              </button>
              <button
                type="button"
                onClick={() => setConvertDirection('TRADE_TO_WALLET')}
                className={`p-3 rounded-2xl border-2 text-left transition ${
                  convertDirection === 'TRADE_TO_WALLET'
                    ? 'bg-[#251552] border-amber-400 text-white'
                    : 'bg-[#150D2E] border-purple-500/30 text-purple-300'
                }`}
              >
                <span className="font-black block">Trade → Wallet</span>
                <span className="text-[10px] opacity-85">Pour retirer (Crypto)</span>
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-[#150D2E] border border-purple-500/30 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-purple-300">De ({convertDirection === 'WALLET_TO_TRADE' ? 'WALLET' : 'COMPTE TRADE'}) :</span>
                <span className="font-mono font-black text-emerald-400">
                  {Math.round(convertDirection === 'WALLET_TO_TRADE' ? soldeDisponibleAr : soldeCompteTradeAr).toLocaleString('fr-FR')} Ar
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-purple-300">Vers ({convertDirection === 'WALLET_TO_TRADE' ? 'COMPTE TRADE' : 'WALLET'}) :</span>
                <span className="font-mono font-bold text-white">
                  {Math.round(convertDirection === 'WALLET_TO_TRADE' ? soldeCompteTradeAr : soldeDisponibleAr).toLocaleString('fr-FR')} Ar
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <label className="font-bold text-purple-300 block">Montant à transférer (Ar) *</label>
              <input
                type="text"
                inputMode="numeric"
                value={convertAmountInput}
                onChange={e => setConvertAmountInput(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Ex: 10000"
                className="w-full px-3 py-2.5 rounded-xl bg-[#150D2E] border-2 border-[#8B5CF6]/50 text-white font-mono font-black text-sm"
              />
              <div className="grid grid-cols-4 gap-1.5">
                {[25, 50, 75, 100].map(pct => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      const maxAvail = convertDirection === 'WALLET_TO_TRADE' ? soldeDisponibleAr : soldeCompteTradeAr;
                      setConvertAmountInput(String(Math.floor((maxAvail * pct) / 100)));
                    }}
                    className="py-1.5 rounded-lg bg-[#150D2E] border border-purple-500/30 text-[10px] font-mono font-bold text-purple-200"
                  >
                    {pct === 100 ? 'MAX' : `${pct}%`}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[11px] font-mono text-emerald-400 pt-1">
                <span>Coût de transfert interne :</span>
                <span className="font-black">0 Ar (Gratuit)</span>
              </div>
            </div>

            <button
              type="button"
              disabled={convertSubmitting}
              onClick={handleConfirmConvertWalletTrade}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white font-black text-xs shadow disabled:opacity-60"
            >
              {convertSubmitting ? 'Transfert en cours...' : 'Confirmer la Conversion'}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: RETRAIT CRYPTO UNIQUEMENT (50 COINS + 0.15% + FRAIS RÉSEAU)
         ======================================================== */}
      {activeModal === 'withdraw' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#1D1240] border-2 border-[#8B5CF6] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <button onClick={() => setActiveModal(null)} className="p-1.5 rounded-lg bg-[#23154D] text-purple-300">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h3 className="font-black text-white text-base">Retrait Crypto SALOMA (WALLET)</h3>
              <button onClick={() => setActiveModal(null)} className="p-1.5 rounded-lg bg-[#23154D] text-purple-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[#150D2E] border border-purple-500/30 flex justify-between text-xs">
              <span className="text-purple-300">Solde WALLET retirable :</span>
              <span className="font-mono font-black text-emerald-400">
                {(coinsJson[selectedWalletCoin.symbol.toUpperCase()] || 0).toFixed(6)} {selectedWalletCoin.symbol} ({Math.round(soldeDisponibleAr).toLocaleString('fr-FR')} Ar)
              </span>
            </div>

            {renderWalletCoinChainNetworkSelector()}

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1 gap-2">
                  <label className="font-bold text-purple-300 block">
                    Montant à retirer ({selectedWalletCoin.symbol}) *
                  </label>
                  <span className="text-[10px] font-mono text-emerald-300 font-bold">
                    Min : {activeMinCoinQtyLabel} {selectedWalletCoin.symbol} (1$)
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={withdrawAmountInput}
                    onChange={e => setWithdrawAmountInput(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder={`Min: ${activeMinCoinQtyLabel} ${selectedWalletCoin.symbol} (1$)`}
                    className="w-full px-3 py-2.5 pr-16 rounded-xl bg-[#150D2E] border-2 border-[#8B5CF6]/40 text-white font-mono font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const coinSym = selectedWalletCoin.symbol.toUpperCase();
                      const coinBal = coinsJson[coinSym] || 0;
                      if (coinBal > 0) {
                        setWithdrawAmountInput(String(coinBal));
                      } else {
                        const cPrice = selectedWalletCoin.price || 1;
                        const maxEquiv = soldeDisponibleAr / (cPrice * USD_TO_MGA);
                        setWithdrawAmountInput(maxEquiv > 0 ? maxEquiv.toFixed(6) : '0');
                      }
                    }}
                    className="absolute right-1.5 top-1.5 px-2.5 py-1 rounded-lg bg-[#7C3AED] text-white text-[10px] font-black"
                  >
                    MAX
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="font-bold text-purple-300 block">
                    Adresse de réception {selectedWalletCoin.symbol} ({activeBlockchain} • {activeNetworkLabel}) *
                  </label>
                  {activeClientDepositAddress && (
                    <button
                      type="button"
                      onClick={() => setWithdrawAccountInput(activeClientDepositAddress)}
                      className="text-[10px] font-bold text-emerald-300 underline shrink-0"
                    >
                      Mon adresse
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={withdrawAccountInput}
                  onChange={e => setWithdrawAccountInput(e.target.value)}
                  placeholder={`Entrez votre adresse ${activeBlockchain} (${activeNetworkLabel})...`}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#150D2E] border-2 border-[#8B5CF6]/40 text-white font-mono"
                />
              </div>

              {/* RETRAIT SEUL = FRAIS SALOMA (0.15%) + FRAIS RÉSEAU SÉPARÉS ET AFFICHÉS CLAIREMENT */}
              {(() => {
                const amt = parseFloat(withdrawAmountInput) || 0;
                const salomaFee = amt * ((salomaFees.withdrawFeePct || 0.15) / 100);
                const netFee = effectiveWalletNetworkFee;
                const totalFrais = salomaFee + netFee;
                const netRec = Math.max(0, amt - totalFrais);
                return (
                  <div className="p-3 rounded-xl bg-[#100926] border border-amber-500/40 space-y-1.5 text-[11px]">
                    <div className="text-[10px] font-mono font-bold text-amber-300 pb-1 border-b border-purple-500/20">
                      Retrait : Frais SALOMA {salomaFees.withdrawFeePct}% + Frais Réseau {netFee} {selectedWalletCoin.symbol}
                    </div>
                    <div className="flex justify-between text-purple-300">
                      <span>Chaîne / Réseau sélectionné :</span>
                      <span className="font-bold text-emerald-300">
                        {activeBlockchain} • {activeNetworkLabel}
                      </span>
                    </div>
                    <div className="flex justify-between text-purple-300">
                      <span>Frais SALOMA ({salomaFees.withdrawFeePct}%) :</span>
                      <span className="font-mono font-bold text-amber-300">
                        {salomaFee.toFixed(6)} {selectedWalletCoin.symbol}
                      </span>
                    </div>
                    <div className="flex justify-between text-purple-300">
                      <span>Frais Réseau ({activeNetworkLabel}) :</span>
                      <span className="font-mono font-black text-amber-300">
                        {netFee} {selectedWalletCoin.symbol}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-purple-500/20 font-bold">
                      <span className="text-white">Montant net reçu :</span>
                      <span className="font-mono text-emerald-400">
                        {netRec.toFixed(6)} {selectedWalletCoin.symbol}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <TurnstileWidget
              siteKey={turnstileSiteKey}
              resetKey={withdrawTurnstileReset}
              onVerify={tok => {
                withdrawTurnstileTokenRef.current = tok;
              }}
              onExpire={() => {
                withdrawTurnstileTokenRef.current = '';
              }}
            />

            <button
              type="button"
              disabled={withdrawSubmitting}
              onClick={handleConfirmWithdraw}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white font-black text-xs shadow disabled:opacity-45 disabled:cursor-not-allowed transition"
            >
              {withdrawSubmitting ? 'Traitement...' : 'Confirmer et Envoyer le Retrait Crypto'}
            </button>
          </div>
        </div>
      )}

      {/* KYC */}
      {activeModal === 'kyc' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#1D1240] border-2 border-[#8B5CF6] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-white text-base">Vérification KYC</h3>
              <button onClick={() => setActiveModal(null)} className="text-purple-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 rounded-xl bg-[#150D2E] text-xs flex justify-between font-bold text-white">
              <span>KYC Niveau 1 : Email vérifié</span>
              <span className="text-emerald-400">✓ Auto-validé</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#150D2E] text-xs space-y-3 border border-[#8B5CF6]/30">
              <div className="flex justify-between items-center font-bold text-white">
                <span>KYC Niveau 2 : Pièces d&apos;identité</span>
                <span
                  className={
                    (userRow?.kyc_level ?? 0) >= 2 || userRow?.kyc_statut === 'valide'
                      ? 'text-emerald-400'
                      : userRow?.kyc_statut === 'en_attente'
                      ? 'text-amber-400'
                      : userRow?.kyc_statut === 'refuse'
                      ? 'text-rose-400'
                      : 'text-purple-300'
                  }
                >
                  {(userRow?.kyc_level ?? 0) >= 2 || userRow?.kyc_statut === 'valide'
                    ? '✓ Validé'
                    : userRow?.kyc_statut === 'en_attente'
                    ? '⏳ En attente Admin'
                    : userRow?.kyc_statut === 'refuse'
                    ? '✕ Refusé'
                    : 'À compléter'}
                </span>
              </div>

              {(userRow?.kyc_level ?? 0) >= 2 || userRow?.kyc_statut === 'valide' ? (
                <div className="space-y-1.5 text-[11px] bg-[#1D1240] p-3 rounded-xl border border-emerald-500/30">
                  <div className="flex justify-between text-purple-300">
                    <span>CIN :</span>
                    <span className="font-mono font-bold text-white">{userRow?.kyc_cin || '---'}</span>
                  </div>
                  <div className="flex justify-between text-purple-300">
                    <span>Adresse :</span>
                    <span className="font-bold text-white text-right max-w-[65%]">{userRow?.kyc_adresse || '---'}</span>
                  </div>
                  <div className="flex justify-between text-purple-300">
                    <span>Code Postal :</span>
                    <span className="font-mono font-bold text-white">{userRow?.kyc_code_postal || '---'}</span>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleValidateKyc} className="space-y-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-purple-300 block mb-1">Numéro CIN</label>
                    <input
                      type="text"
                      required
                      value={kycCinInput}
                      onChange={e => setKycCinInput(e.target.value)}
                      placeholder="Ex: 101 241 058 920"
                      className="w-full px-3 py-2 rounded-xl bg-[#1D1240] border border-[#8B5CF6]/50 text-white font-mono text-xs focus:outline-none focus:border-[#8B5CF6]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-purple-300 block mb-1">Adresse complète</label>
                    <input
                      type="text"
                      required
                      value={kycAdresseInput}
                      onChange={e => setKycAdresseInput(e.target.value)}
                      placeholder="Ex: Lot II M 45 Antananarivo"
                      className="w-full px-3 py-2 rounded-xl bg-[#1D1240] border border-[#8B5CF6]/50 text-white text-xs focus:outline-none focus:border-[#8B5CF6]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-purple-300 block mb-1">Code Postal</label>
                    <input
                      type="text"
                      required
                      value={kycCodePostalInput}
                      onChange={e => setKycCodePostalInput(e.target.value)}
                      placeholder="Ex: 101"
                      className="w-full px-3 py-2 rounded-xl bg-[#1D1240] border border-[#8B5CF6]/50 text-white font-mono text-xs focus:outline-none focus:border-[#8B5CF6]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={kycSubmitting}
                    className="w-full py-2.5 bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white rounded-xl font-black text-xs disabled:opacity-50"
                  >
                    {kycSubmitting
                      ? 'Envoi en cours...'
                      : userRow?.kyc_statut === 'en_attente'
                      ? 'Mettre à jour & Renvoyer KYC'
                      : 'Envoyer KYC Niveau 2'}
                  </button>
                </form>
              )}
            </div>

            <button
              onClick={() => setActiveModal('reportProblem')}
              className="w-full py-2.5 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-200 font-bold text-xs flex items-center justify-center gap-1.5"
            >
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Signaler problème</span>
            </button>
          </div>
        </div>
      )}

      {/* GUIDE */}
      {activeModal === 'guide' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#1D1240] border-2 border-[#8B5CF6] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-white text-base">Mode d'emploi (Torolalana)</h3>
              <button onClick={() => setActiveModal(null)} className="text-purple-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-xs text-purple-200 space-y-2 leading-relaxed">
              <p>• <strong>Portefeuille & Convertir</strong> : Gérez votre <strong>WALLET</strong> (dépôt/retrait Crypto uniquement) et votre <strong>COMPTE TRADE</strong>. Utilisez <strong>Convertir</strong> (0 Ar) pour transférer entre Wallet et Compte Trade.</p>
              <p>• <strong>Trading</strong> : Manuel (Spot / Levier) ou Auto Stratégie (Spot Grid Bot / Robot Échange / BOT 3) en Marge Isolée individuelle au prix final affiché.</p>
              <p>• <strong>Échange</strong> : Convertissez Ar ⇄ Crypto ou Crypto ⇄ Crypto instantanément au prix final SALOMA affiché.</p>
              <p>• <strong>Retrait Crypto</strong> : Transferts blockchain sécurisés (USDT TRC20, BTC, ETH et 50 cryptos) avec paramètres réseau affichés avant confirmation.</p>
            </div>
          </div>
        </div>
      )}

      {/* PROFIL CLIENT */}
      {activeModal === 'profile' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#1D1240] border-2 border-[#8B5CF6] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-white text-base">Profil Client</h3>
              <button onClick={() => setActiveModal(null)} className="text-purple-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#150D2E] text-xs space-y-2">
              <div className="flex justify-between text-purple-300">
                <span>Nom complet :</span>
                <span className="font-bold text-white">
                  {[userRow?.prenom, userRow?.nom].filter(Boolean).join(' ') || userRow?.name}
                </span>
              </div>
              <div className="flex justify-between text-purple-300">
                <span>Téléphone :</span>
                <span className="font-mono text-white">{userRow?.telephone}</span>
              </div>
              <div className="flex justify-between text-purple-300">
                <span>Email :</span>
                <span className="font-mono text-purple-200">{userRow?.email}</span>
              </div>
              <div className="flex justify-between text-purple-300">
                <span>Code parrainage :</span>
                <span className="font-mono font-bold text-emerald-400">{userRow?.code_parrainage}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => setActiveModal('kyc')}
                className="p-2.5 rounded-xl bg-[#23154D] text-white font-bold flex items-center justify-center gap-1"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> KYC (N{userRow?.kyc_level ?? 0})
              </button>
              <button
                onClick={() => setActiveModal('guide')}
                className="p-2.5 rounded-xl bg-[#23154D] text-white font-bold flex items-center justify-center gap-1"
              >
                <HelpCircle className="w-4 h-4 text-[#8B5CF6]" /> Mode d'emploi
              </button>
            </div>
            <button
              onClick={() => setActiveModal('reportProblem')}
              className="w-full py-2.5 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-200 text-xs font-black flex items-center justify-center gap-1.5"
            >
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Signaler problème</span>
            </button>
            <PWAInstallButton />
            <button
              onClick={handleLogout}
              className="w-full py-2.5 rounded-xl bg-rose-500/20 text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              <span>Se Déconnecter</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL: SIGNALER PROBLÈME */}
      {activeModal === 'reportProblem' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#1D1240] border-2 border-[#8B5CF6] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h3 className="font-black text-white text-base">Signaler problème</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-purple-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-purple-200 block">
                Décrivez votre problème (Soraty eto ny olana) :
              </label>
              <textarea
                rows={4}
                value={problemInput}
                onChange={e => setProblemInput(e.target.value)}
                placeholder="Écrivez votre problème ici (dépôt, retrait, KYC, trading...)"
                className="w-full p-3 rounded-xl bg-[#150D2E] border-2 border-[#8B5CF6]/50 text-white text-xs focus:outline-none focus:border-[#8B5CF6] resize-none"
              />
              <button
                type="button"
                disabled={problemSubmitting}
                onClick={handleSubmitProblem}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white font-black text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{problemSubmitting ? 'Envoi...' : 'Envoyer le problème'}</span>
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span>Vous pouvez nous parler directement</span>
              </div>
              <div className="flex items-center justify-between gap-2 bg-[#150D2E] p-2.5 rounded-xl border border-emerald-500/30">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-[10px] text-purple-300 block">WhatsApp SALOMA</span>
                    <span className="text-sm font-mono font-black text-white">0386340354</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText('0386340354');
                      setWhatsappCopied(true);
                      setTimeout(() => setWhatsappCopied(false), 2000);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-[#23154D] text-purple-200 text-[10px] font-bold flex items-center gap-1"
                  >
                    {whatsappCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{whatsappCopied ? 'Copied' : 'Copie'}</span>
                  </button>
                  <a
                    href="https://wa.me/261386340354"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-black"
                  >
                    WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADMIN UNLOCK */}
      {activeModal === 'adminUnlock' && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1D1240] border-2 border-[#8B5CF6] shadow-[0_0_40px_rgba(139,92,246,0.8)] w-full max-w-sm rounded-3xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-black text-white text-base">Entrée Administrateur</h3>
                  <span className="text-[10px] text-purple-300 block">
                    Email + Code 6 chiffres par Email + Code à 9 chiffres
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAdminUnlockEmail('');
                  setAdminUnlockEmailCode('');
                  setAdminChallengeToken('');
                  setAdminOtpSecondsLeft(0);
                  setAdminEmailSentTo('');
                  setAdminUnlockInput1('');
                  setAdminUnlockError('');
                  setActiveModal(null);
                }}
                className="text-purple-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {adminUnlockError && (
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold">
                {adminUnlockError}
              </div>
            )}
            <form onSubmit={handleAdminUnlock} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-purple-300 block mb-1">
                  Email Administrateur *
                </label>
                <div className="flex items-stretch gap-1.5">
                  <input
                    type="email"
                    required
                    placeholder="Email administrateur"
                    value={adminUnlockEmail}
                    onChange={e => {
                      const nextVal = e.target.value;
                      setAdminUnlockEmail(nextVal);
                      if (nextVal.trim().toLowerCase() !== adminEmailSentTo) {
                        setAdminEmailSentTo('');
                        setAdminChallengeToken('');
                        setAdminOtpSecondsLeft(0);
                      }
                    }}
                    className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-[#150D2E] border-2 border-[#8B5CF6]/50 text-white text-xs"
                  />
                  <button
                    type="button"
                    disabled={adminEmailSending || adminEmailCooldown > 0}
                    onClick={() => void sendAdminEmailCode(adminUnlockEmail)}
                    className="shrink-0 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white font-black text-xs border border-purple-300/40 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {adminEmailSending
                      ? 'Envoi...'
                      : adminEmailCooldown > 0
                      ? `Renvoyer dans ${adminEmailCooldown}s`
                      : adminEmailSentTo && adminEmailSentTo === adminUnlockEmail.trim().toLowerCase()
                      ? 'Renvoyer'
                      : 'Envoyer'}
                  </button>
                </div>
                {adminEmailSending && (
                  <span className="text-[11px] text-purple-300 font-bold block mt-1.5">
                    Envoi du code à 6 chiffres en cours...
                  </span>
                )}
                {!adminEmailSending &&
                  adminEmailSentTo &&
                  adminEmailSentTo === adminUnlockEmail.trim().toLowerCase() && (
                    <div className="mt-1.5 space-y-1">
                      <span className="text-[11px] text-emerald-400 font-bold block">
                        ✓ Code envoyé - Vérifiez votre email
                      </span>
                      {adminOtpSecondsLeft > 0 ? (
                        <span className="text-[11px] font-mono font-bold text-amber-300 block">
                          Code valide {formatOtpCountdown(adminOtpSecondsLeft)}
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-rose-400 block">
                          Code expiré, renvoyez un nouveau code
                        </span>
                      )}
                    </div>
                  )}
              </div>

              <div>
                <label className="font-bold text-purple-300 block mb-1">
                  Code de vérification 6 chiffres reçu par email *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  placeholder="000000 (6 chiffres)"
                  value={adminUnlockEmailCode}
                  onChange={e =>
                    setAdminUnlockEmailCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))
                  }
                  className="w-full px-3 py-2.5 rounded-xl bg-[#150D2E] border-2 border-[#8B5CF6]/50 text-white font-mono text-center tracking-widest text-base font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-purple-300 block mb-1">
                  Code de sécurité (9 chiffres) *
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={9}
                  required
                  placeholder="••••••••• (9 chiffres)"
                  value={adminUnlockInput1}
                  onChange={e => setAdminUnlockInput1(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#150D2E] border-2 border-[#8B5CF6]/50 text-white font-mono text-center tracking-widest text-lg font-bold"
                />
              </div>

              <button
                type="submit"
                disabled={adminUnlockLoading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white font-black text-xs disabled:opacity-50"
              >
                {adminUnlockLoading ? 'Vérification...' : "Déverrouiller l'Administration"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: CONFIRMATION SUPPRESSION COMPLÈTE HISTORIQUE
         ======================================================== */}
      {clearHistoryTarget && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1D1240] border-2 border-rose-500/70 w-full max-w-sm rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                  <Trash2 className="w-4 h-4" />
                </div>
                <h3 className="font-black text-white text-sm">
                  {clearHistoryTarget === 'trade'
                    ? 'Tout supprimer — Historique Trade'
                    : clearHistoryTarget === 'wallet'
                    ? 'Tout supprimer — Historique Portefeuille'
                    : 'Tout supprimer — Historique Earn'}
                </h3>
              </div>
              <button
                type="button"
                disabled={clearHistorySubmitting}
                onClick={() => setClearHistoryTarget(null)}
                className="p-1.5 rounded-lg bg-[#23154D] text-purple-300 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-[#150D2E] border border-rose-500/30 text-xs text-purple-200 leading-relaxed space-y-1.5">
              <p>
                Voulez-vous vraiment supprimer définitivement{' '}
                <strong className="text-white">
                  {clearHistoryTarget === 'trade'
                    ? `tout l'historique des ordres (${closedTrades.length})`
                    : clearHistoryTarget === 'wallet'
                    ? `tout l'historique Portefeuille (${depotsRetraitsList.length})`
                    : `tout l'historique Earn (${earnList.length})`}
                </strong>{' '}
                ?
              </p>
              <p className="text-[11px] text-purple-400">
                Cette action est irréversible. Vos soldes actuels ne seront pas modifiés.
              </p>
              {clearHistoryTarget === 'wallet' && depotsRetraitsList.some(tx => tx.statut === 'en_attente') && (
                <p className="text-[11px] text-amber-300 font-bold">
                  Note : les demandes encore en attente de validation restent conservées.
                </p>
              )}
              {clearHistoryTarget === 'trade' && activeTrades.length > 0 && (
                <p className="text-[11px] text-amber-300 font-bold">
                  Note : vos positions actuellement ouvertes restent actives.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <button
                type="button"
                disabled={clearHistorySubmitting}
                onClick={() => setClearHistoryTarget(null)}
                className="py-3 rounded-xl bg-[#150D2E] border border-purple-500/40 text-purple-200 font-bold disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={clearHistorySubmitting}
                onClick={handleConfirmClearHistory}
                className="py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 text-white font-black shadow disabled:opacity-60"
              >
                {clearHistorySubmitting ? 'Suppression...' : 'Oui, tout supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          APP ADMIN (DONNÉES RÉELLES APPWRITE)
         ======================================================== */}
      {screen === 'admin' && (
        <div className="min-h-screen p-4 max-w-md mx-auto w-full z-10 flex flex-col space-y-4 pb-12">
          <div className="flex justify-between items-center bg-[#1D1240] p-3 rounded-2xl border-2 border-[#8B5CF6]/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#7C3AED] flex items-center justify-center text-white font-black text-xs">
                ADM
              </div>
              <div>
                <h2 className="font-black text-white text-sm">Panneau Admin SALOMA</h2>
                <span className="text-[10px] text-emerald-400 font-mono">
                  {adminUsers.length} clients inscrits • {adminRealStats.pendingDeposits} en attente
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() =>
                  fetchAdminOverview(adminPin, adminEmail)
                    .then(() => showToast('Données Admin actualisées'))
                    .catch(err => showToast(err instanceof Error ? err.message : 'Erreur chargement Admin.'))
                }
                className="p-1.5 rounded-xl bg-[#23154D] text-emerald-300 border border-emerald-500/30"
              >
                <RefreshCw className={`w-4 h-4 ${adminLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => {
                  setAdminPin('');
                  setAdminEmail('');
                  setAdminSessionToken('');
                  setScreen(sessionToken ? 'main' : 'splash');
                }}
                className="px-3 py-1.5 rounded-xl bg-[#150D2E] text-purple-200 border border-purple-500/30 text-xs font-bold"
              >
                Retour
              </button>
            </div>
          </div>

          {/* ALERTE LIQUIDITÉ SPONSOR (VISIBLE CÔTÉ ADMIN SEULEMENT) */}
          {adminLiquidityAlerts.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-rose-950/75 border-2 border-rose-500 space-y-2.5 shadow-[0_0_24px_rgba(244,63,94,0.3)]">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0" />
                  <div>
                    <h3 className="font-black text-rose-100 text-xs">
                      {adminLiquidityAlerts[0]?.message || 'Liquidité Bybit insuffisante - Recharger le compte sponsor'}
                    </h3>
                    <span className="text-[10px] text-rose-200/90 block">
                      {adminLiquidityAlerts.length} alerte(s) active(s) • Trades Spot temporairement bloqués
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleClearLiquidityAlert()}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black shrink-0"
                >
                  Tout résoudre
                </button>
              </div>
              <div className="space-y-1.5">
                {adminLiquidityAlerts.map(al => (
                  <div
                    key={al.id}
                    className="p-2.5 rounded-xl bg-[#150D2E]/90 border border-rose-500/40 text-[11px] flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <span className="font-mono font-black text-white block">
                        {al.sponsor} • {al.side} {al.pair} ({al.asset})
                      </span>
                      <span className="text-[10px] font-mono text-amber-200 block">
                        Requis: {al.requiredAmount} {al.asset} • Disponible: {al.availableAmount} {al.asset}
                      </span>
                      <span className="text-[9px] text-rose-300/90 block truncate">{al.reason}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setAdminTab('apis');
                          void handleTestSponsorConnection(
                            al.sponsor.toLowerCase() as 'bybit' | 'okx' | 'binance'
                          );
                        }}
                        className="px-2 py-1 rounded bg-[#23154D] text-purple-200 text-[10px] font-bold"
                      >
                        Tester
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleClearLiquidityAlert(al.id)}
                        className="px-2 py-1 rounded bg-emerald-600 text-white text-[10px] font-bold"
                      >
                        Résolu
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SÉPARATION STRICTE ADMIN : LIQUIDITÉ BYBIT VS ARGENT CLIENTS SALOMA VS FRAIS 0.1% */}
          <div className="grid grid-cols-1 gap-2">
            <div className="p-3 rounded-2xl bg-[#190F38] border-2 border-sky-400/60 flex items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-black text-sky-300 uppercase block">
                  1. Total Liquidité BYBIT (Mon Argent — Compte Liquidité SALOMA)
                </span>
                <span className="text-[10px] text-purple-300 block">
                  {adminExchangeSummary?.bybitLiquidityConnected
                    ? 'Connecté en direct • Sert uniquement au hedge Admin'
                    : 'Solde Admin BYBIT (Tester connexion dans APIs)'}
                </span>
              </div>
              <span className="font-mono font-black text-base text-sky-300 shrink-0">
                {(adminExchangeSummary?.totalBybitLiquidityUsdt ?? 0).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 4
                })}{' '}
                USDT
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-2xl bg-[#190F38] border-2 border-purple-400/60 space-y-0.5">
                <span className="text-[9px] font-black text-purple-300 uppercase block">
                  2. Total Argent Clients SALOMA
                </span>
                <span className="font-mono font-black text-sm text-white block">
                  {(adminExchangeSummary?.totalClientsBalanceUsdt ?? 0).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}{' '}
                  USDT
                </span>
                <span className="text-[10px] font-mono text-purple-300 block">
                  {(adminExchangeSummary?.totalClientsBalanceAr ?? 0).toLocaleString('fr-FR')} Ar (Portefeuilles clients)
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-[#190F38] border-2 border-emerald-400/60 space-y-0.5">
                <span className="text-[9px] font-black text-emerald-300 uppercase block">
                  3. Total Frais 0.1% gagnés SALOMA
                </span>
                <span className="font-mono font-black text-sm text-emerald-400 block">
                  +{(adminExchangeSummary?.totalSalomaFeesUsdt ?? 0).toFixed(4)} USDT
                </span>
                <span className="text-[10px] font-mono text-amber-300 block">
                  +{(adminExchangeSummary?.totalSalomaFeesAr ?? 0).toLocaleString('fr-FR')} Ar • Hedge BYBIT payé :{' '}
                  {(adminExchangeSummary?.totalBybitFeesPaidUsdt ?? 0).toFixed(4)} USDT
                </span>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#190F38] border-2 border-[#8B5CF6]/70 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-black text-white">Activité Réelle Trades ({adminTrades.length})</span>
              <span className="font-mono font-bold text-emerald-300 text-[11px]">
                <Users className="w-3.5 h-3.5 inline mr-1" />
                {adminUsers.length} Clients
              </span>
            </div>
            <div className="flex justify-between items-center text-sm font-black font-mono">
              <span className="text-emerald-400">BUY {realBuyPercent}%</span>
              <span className="text-rose-400">SELL {100 - realBuyPercent}%</span>
            </div>
            <div className="h-3 w-full rounded-full overflow-hidden flex bg-[#100926]">
              <div className="bg-emerald-500" style={{ width: `${realBuyPercent}%` }} />
              <div className="bg-rose-500" style={{ width: `${100 - realBuyPercent}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1 bg-[#190E38] p-1 rounded-2xl border border-purple-500/30 text-center text-[10px]">
            {(
              [
                ['overview', 'Clients'],
                ['kyc', 'KYC Client'],
                ['profit', 'Profit'],
                ['trading', 'Trades'],
                ['wallet', 'Dépôts'],
                ['adminWallet', 'Portefeuille'],
                ['apis', 'APIs'],
                ['security', 'Sécu']
              ] as const
            ).map(([id, label]) => {
              const pendingKycCount =
                id === 'kyc'
                  ? adminUsers.filter(u => u.kyc_statut === 'en_attente').length
                  : 0;
              return (
                <button
                  key={id}
                  onClick={() => setAdminTab(id)}
                  className={`py-2 px-1 rounded-xl font-bold transition relative flex items-center justify-center gap-1 ${
                    adminTab === id ? 'bg-[#7C3AED] text-white shadow' : 'text-purple-300'
                  }`}
                >
                  <span>{label}</span>
                  {pendingKycCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[9px] font-black leading-tight">
                      {pendingKycCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {adminTab === 'kyc' && (() => {
            const kycClients = [...adminUsers]
              .filter(
                u =>
                  Boolean(u.kyc_cin) ||
                  Boolean(u.kyc_adresse) ||
                  Boolean(u.kyc_code_postal) ||
                  Boolean(u.kyc_statut) ||
                  (u.kyc_level ?? 0) >= 1
              )
              .sort((a, b) => {
                const rank = (u: AppwriteUserRow) =>
                  u.kyc_statut === 'en_attente' ? 0 : u.kyc_statut === 'refuse' ? 1 : 2;
                return rank(a) - rank(b);
              });

            const pendingCount = kycClients.filter(u => u.kyc_statut === 'en_attente').length;
            const validatedCount = kycClients.filter(
              u => (u.kyc_level ?? 0) >= 2 || u.kyc_statut === 'valide'
            ).length;

            return (
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-[#1D1240] border-2 border-[#8B5CF6]/60 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      <div>
                        <h3 className="font-black text-white text-sm">KYC CLIENT ({kycClients.length})</h3>
                        <span className="text-[10px] text-purple-300 block">
                          Niveau 1 : Auto-validé • Niveau 2 : Validation Admin
                        </span>
                      </div>
                    </div>
                    <div className="text-right text-[10px] font-mono">
                      <span className="text-amber-300 block font-bold">{pendingCount} en attente</span>
                      <span className="text-emerald-400 block font-bold">{validatedCount} validés</span>
                    </div>
                  </div>

                  {kycClients.length === 0 ? (
                    <div className="p-4 rounded-xl bg-[#150D2E] border border-purple-500/20 text-center text-xs text-purple-300">
                      Aucun client n&apos;a encore soumis de demande KYC.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[65vh] overflow-y-auto">
                      {kycClients.map(cli => {
                        const isValidated = (cli.kyc_level ?? 0) >= 2 || cli.kyc_statut === 'valide';
                        const isPending = cli.kyc_statut === 'en_attente';
                        const isRejected = cli.kyc_statut === 'refuse';
                        const isValidatingThis = adminKycActionId === `validate-${cli.$id}`;
                        const isRejectingThis = adminKycActionId === `reject-${cli.$id}`;

                        return (
                          <div
                            key={cli.$id}
                            className={`p-3 rounded-2xl bg-[#150D2E] border-2 space-y-2.5 text-xs ${
                              isPending
                                ? 'border-amber-500/60'
                                : isValidated
                                ? 'border-emerald-500/40'
                                : isRejected
                                ? 'border-rose-500/40'
                                : 'border-purple-500/30'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <span className="font-black text-white block truncate">
                                  {[cli.prenom, cli.nom].filter(Boolean).join(' ') || cli.name || 'Client'}
                                </span>
                                <span className="text-[10px] text-purple-300 block truncate">
                                  {cli.email} • {cli.telephone || '---'}
                                </span>
                              </div>
                              <span
                                className={`text-[10px] font-black px-2 py-0.5 rounded-lg shrink-0 ${
                                  isValidated
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : isPending
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : isRejected
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                    : 'bg-purple-500/20 text-purple-200 border border-purple-500/30'
                                }`}
                              >
                                {isValidated
                                  ? '✓ Validé (N2)'
                                  : isPending
                                  ? '⏳ En attente'
                                  : isRejected
                                  ? '✕ Refusé'
                                  : `Niveau ${cli.kyc_level ?? 1}`}
                              </span>
                            </div>

                            <div className="p-2.5 rounded-xl bg-[#1D1240] border border-purple-500/25 space-y-1 text-[11px]">
                              <div className="flex justify-between gap-2">
                                <span className="text-purple-300 font-bold">CIN :</span>
                                <span className="font-mono font-black text-white text-right">
                                  {cli.kyc_cin || 'Non renseigné'}
                                </span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-purple-300 font-bold">ADRESSE :</span>
                                <span className="font-bold text-white text-right">
                                  {cli.kyc_adresse || 'Non renseignée'}
                                </span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-purple-300 font-bold">CODE POSTAL :</span>
                                <span className="font-mono font-black text-white text-right">
                                  {cli.kyc_code_postal || 'Non renseigné'}
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                disabled={adminKycActionId !== null}
                                onClick={() => handleAdminKycAction(cli.$id, 'validate')}
                                className="py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] flex items-center justify-center gap-1 disabled:opacity-50 transition"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{isValidatingThis ? 'Validation...' : 'VALIDER'}</span>
                              </button>
                              <button
                                type="button"
                                disabled={adminKycActionId !== null}
                                onClick={() => handleAdminKycAction(cli.$id, 'reject')}
                                className="py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-[11px] flex items-center justify-center gap-1 disabled:opacity-50 transition"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>{isRejectingThis ? 'Refus...' : 'REFUSER'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {adminTab === 'overview' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-[#1D1240] border-2 border-[#8B5CF6]/50 space-y-2.5">
                <span className="text-xs font-black text-white block">
                  Clients Appwrite ({adminUsers.length})
                </span>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {adminUsers.map(cli => (
                    <div key={cli.$id} className="p-2.5 rounded-xl bg-[#150D2E] border border-purple-500/20 text-xs space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white">{cli.name || cli.nom}</span>
                        <span className="font-mono text-emerald-400 font-black">
                          {Number(cli.solde || 0).toLocaleString('fr-FR')} Ar
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] text-purple-300">
                        <span>{cli.email}</span>
                        <span>{cli.email_verifie ? '✓ Email vérifié' : 'Non vérifié'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#1D1240] border-2 border-amber-500/50 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-white">
                    Problèmes Clients ({adminProblems.length})
                  </span>
                  <button
                    onClick={() => setFilterOnlyProblems(!filterOnlyProblems)}
                    className="px-2 py-1 rounded-lg bg-[#23154D] text-[10px] text-amber-300 font-bold"
                  >
                    {filterOnlyProblems ? 'Tous' : 'Non résolus'}
                  </button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {adminProblems
                    .filter(p => !filterOnlyProblems || p.statut !== 'resolu')
                    .map(rep => (
                      <div key={rep.$id} className="p-2.5 rounded-xl bg-[#150D2E] border border-purple-500/30 text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="font-bold text-white">{rep.nom}</span>
                          <span className="text-[10px] text-purple-400">{rep.telephone}</span>
                        </div>
                        <p className="text-purple-100">{rep.message}</p>
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleToggleProblemResolved(rep)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              rep.statut === 'resolu'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-amber-500/20 text-amber-200'
                            }`}
                          >
                            {rep.statut === 'resolu' ? '✓ Résolu' : 'Marquer Résolu'}
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              NOUVELLE PAGE ADMIN PROFIT (Jour/Semaine/Mois + Bybit VS SALOMA)
             ======================================================== */}
          {adminTab === 'profit' && (
            <div className="space-y-4">
              {/* CARTES PROFIT TOTAL : JOUR / SEMAINE / MOIS */}
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ['jour', 'Profit Jour'],
                    ['semaine', 'Profit Semaine'],
                    ['mois', 'Profit Mois']
                  ] as const
                ).map(([periodKey, label]) => {
                  const val = adminProfits?.[periodKey]?.totalAr || 0;
                  const active = adminProfitPeriod === periodKey;
                  return (
                    <button
                      key={periodKey}
                      type="button"
                      onClick={() => setAdminProfitPeriod(periodKey)}
                      className={`p-3 rounded-2xl border-2 text-left transition ${
                        active
                          ? 'bg-[#251552] border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                          : 'bg-[#1D1240] border-[#8B5CF6]/40'
                      }`}
                    >
                      <span className="text-[10px] font-bold text-purple-300 block">{label}</span>
                      <span className="text-sm font-black font-mono text-emerald-400 block mt-0.5">
                        {Math.round(val).toLocaleString('fr-FR')} Ar
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* SÉPARATION : TRADE 0.1%, ÉCHANGE 0.1%, RETRAIT 0.15% + FRAIS RÉSEAU */}
              <div className="p-3.5 rounded-2xl bg-[#1D1240] border-2 border-[#8B5CF6]/60 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-white">
                    Détail Revenus SALOMA ({adminProfitPeriod === 'jour' ? '24h' : adminProfitPeriod === 'semaine' ? '7 jours' : adminProfitPeriod === 'mois' ? '30 jours' : 'Total'})
                  </span>
                  <button
                    type="button"
                    onClick={() => setAdminProfitPeriod('total')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      adminProfitPeriod === 'total' ? 'bg-[#7C3AED] text-white' : 'bg-[#150D2E] text-purple-300'
                    }`}
                  >
                    Tout voir
                  </button>
                </div>

                {(() => {
                  const bucket = adminProfits?.[adminProfitPeriod] || {
                    tradeAr: 0,
                    echangeAr: 0,
                    retraitAr: 0,
                    totalAr: 0
                  };
                  return (
                    <div className="space-y-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-[#150D2E] border border-emerald-500/30 flex justify-between items-center">
                        <div>
                          <span className="font-bold text-white block">1. Trade ({salomaFees.tradeFeePct}%)</span>
                          <span className="text-[10px] text-purple-300">Commission transparente sur ordres Manuel, Spot & Bots</span>
                        </div>
                        <span className="font-mono font-black text-emerald-400">
                          +{Math.round(bucket.tradeAr).toLocaleString('fr-FR')} Ar
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-[#150D2E] border border-purple-500/30 flex justify-between items-center">
                        <div>
                          <span className="font-bold text-white block">2. Échange ({salomaFees.exchangeFeePct}%)</span>
                          <span className="text-[10px] text-purple-300">Commission transparente sur conversions Ar/Crypto</span>
                        </div>
                        <span className="font-mono font-black text-purple-300">
                          +{Math.round(bucket.echangeAr).toLocaleString('fr-FR')} Ar
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-[#150D2E] border border-amber-500/30 flex justify-between items-center">
                        <div>
                          <span className="font-bold text-white block">3. Retrait ({salomaFees.withdrawFeePct}% + Frais Réseau {salomaFees.networkFeeUsdt} USDT)</span>
                          <span className="text-[10px] text-purple-300">Frais SALOMA + Frais Réseau séparés</span>
                        </div>
                        <span className="font-mono font-black text-amber-300">
                          +{Math.round(bucket.retraitAr).toLocaleString('fr-FR')} Ar
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-gradient-to-r from-[#251552] to-[#190F38] border border-emerald-400/50 flex justify-between items-center">
                        <span className="font-black text-white">TOTAL PROFIT</span>
                        <span className="font-mono font-black text-base text-emerald-400">
                          +{Math.round(bucket.totalAr).toLocaleString('fr-FR')} Ar
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* PRIX SPONSOR VS PRIX CLIENT SALOMA + MARGE % + FRAIS ESTIMÉS + PROFIT NET (ADMIN ONLY) */}
              <div className="p-3.5 rounded-2xl bg-[#1D1240] border-2 border-[#8B5CF6]/50 space-y-2.5">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-xs font-black text-white block">
                      Prix {adminBybitStatus?.primaryExchange || activeBrokerExchange} (Sponsor) vs Prix Client SALOMA
                    </span>
                    <span className="text-[10px] text-purple-300 block">
                      Prix Client = Prix Sponsor × (1 + Marge %) • Frais Sponsor 0.1% et Profit net affichés uniquement ici
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded inline-flex items-center gap-1 ${
                      adminBybitStatus?.online ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {adminBybitStatus?.online && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                    {adminBybitStatus?.online
                      ? `${adminBybitStatus.primaryExchange || 'BYBIT'} LIVE`
                      : 'Cache'}
                  </span>
                </div>

                <div className="overflow-x-auto overflow-y-auto max-h-80 rounded-xl border border-purple-500/30 text-[10px]">
                  <table className="w-full text-left font-mono">
                    <thead className="bg-[#100926] text-purple-300 text-[9px] sticky top-0">
                      <tr>
                        <th className="px-2 py-2">Paire</th>
                        <th className="px-2 py-2 text-right">Sponsor</th>
                        <th className="px-2 py-2 text-right">Marge</th>
                        <th className="px-2 py-2 text-right">Client</th>
                        <th className="px-2 py-2 text-right">Frais est.</th>
                        <th className="px-2 py-2 text-right">Profit net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-500/20 bg-[#150D2E]">
                      {adminMarketComparison.map(row => {
                        const sp = Number((row.sponsorPrice ?? row.bybitPrice).toFixed(8));
                        const mPct = row.marginPct ?? 0.1;
                        const sponsorFeePct = row.bybitHiddenFeePct ?? 0.1;
                        const cp = Number(
                          (row.clientPrice ?? row.salomaPrice ?? sp * (1 + mPct / 100)).toFixed(8)
                        );
                        const estFee = Number(
                          (row.estimatedFee ?? (row.symbol === 'USDT' ? 0 : sp * (sponsorFeePct / 100))).toFixed(8)
                        );
                        const rawNet =
                          row.symbol === 'USDT' || Math.abs(mPct - sponsorFeePct) < 1e-9
                            ? 0
                            : Number(
                                (row.estimatedNetProfit !== undefined
                                  ? row.estimatedNetProfit
                                  : cp - sp - estFee
                                ).toFixed(8)
                              );
                        const netProfit = Math.abs(rawNet) < 1e-8 ? 0 : rawNet;
                        return (
                          <tr key={row.symbol}>
                            <td className="px-2 py-1.5 font-bold text-white">{row.symbol}</td>
                            <td className="px-2 py-1.5 text-right text-sky-300">
                              ${formatCoinPrice(sp)}
                            </td>
                            <td className="px-2 py-1.5 text-right text-purple-200">
                              {mPct}%
                            </td>
                            <td className="px-2 py-1.5 text-right text-emerald-400 font-bold">
                              ${formatCoinPrice(cp)}
                            </td>
                            <td className="px-2 py-1.5 text-right text-amber-300">
                              ${estFee < 0.0001 ? estFee.toFixed(8) : formatCoinPrice(estFee)}
                            </td>
                            <td
                              className={`px-2 py-1.5 text-right font-bold ${
                                netProfit >= 0 ? 'text-emerald-300' : 'text-rose-400'
                              }`}
                            >
                              {netProfit > 0 ? '+' : netProfit < 0 ? '-' : ''}$
                              {Math.abs(netProfit).toFixed(8)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {adminTab === 'trading' && (
            <div className="space-y-4">
              {/* ADMIN AUTO BUY / SELL : CONFIGURATION MARGE BYBIT & FRAIS SALOMA */}
              <div className="p-4 rounded-3xl bg-[#1D1240] border-2 border-emerald-400/70 space-y-3 shadow-[0_0_20px_rgba(16,185,129,0.18)]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h3 className="font-black text-white text-sm">Auto Buy / Sell — Marge Bybit &amp; Frais SALOMA</h3>
                      <span className="text-[10px] text-purple-300 block">
                        Modifiable en temps réel : récupération frais Bybit (cachée) + frais SALOMA transparents client
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-xl bg-[#150D2E] border border-sky-500/40 space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="font-black text-sky-300 text-[11px]">
                        % Marge récupération frais Bybit (cachée dans Prix Client)
                      </label>
                      <span className="text-[9px] font-mono text-purple-300">Défaut: 0.1%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={5}
                        step={0.01}
                        value={adminFeeInputs.bybitRecoveryMarginPct}
                        onChange={e =>
                          setAdminFeeInputs(prev => ({ ...prev, bybitRecoveryMarginPct: e.target.value }))
                        }
                        className="flex-1 px-3 py-1.5 rounded-lg bg-[#100926] border border-sky-500/50 text-white font-mono font-bold text-xs"
                      />
                      <span className="font-mono font-black text-sky-300">%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-xl bg-[#150D2E] border border-emerald-500/40 space-y-1">
                      <label className="font-black text-emerald-300 text-[10px] block">
                        Frais Trade % (défaut 0.1%)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={5}
                        step={0.01}
                        value={adminFeeInputs.tradeFeePct}
                        onChange={e => setAdminFeeInputs(prev => ({ ...prev, tradeFeePct: e.target.value }))}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#100926] border border-emerald-500/50 text-white font-mono font-bold text-xs"
                      />
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#150D2E] border border-purple-500/40 space-y-1">
                      <label className="font-black text-purple-300 text-[10px] block">
                        Frais Échange % (défaut 0.1%)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={5}
                        step={0.01}
                        value={adminFeeInputs.exchangeFeePct}
                        onChange={e => setAdminFeeInputs(prev => ({ ...prev, exchangeFeePct: e.target.value }))}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#100926] border border-purple-500/50 text-white font-mono font-bold text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-xl bg-[#150D2E] border border-amber-500/40 space-y-1">
                      <label className="font-black text-amber-300 text-[10px] block">
                        Frais Retrait % (défaut 0.15%)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={5}
                        step={0.01}
                        value={adminFeeInputs.withdrawFeePct}
                        onChange={e => setAdminFeeInputs(prev => ({ ...prev, withdrawFeePct: e.target.value }))}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#100926] border border-amber-500/50 text-white font-mono font-bold text-xs"
                      />
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#150D2E] border border-amber-500/40 space-y-1">
                      <label className="font-black text-amber-300 text-[10px] block">
                        Frais Réseau (USDT, déf. 0.50)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.05}
                        value={adminFeeInputs.networkFeeUsdt}
                        onChange={e => setAdminFeeInputs(prev => ({ ...prev, networkFeeUsdt: e.target.value }))}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#100926] border border-amber-500/50 text-white font-mono font-bold text-xs"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={adminFeeSaving}
                  onClick={() => void handleAdminSaveFees()}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-[#7C3AED] text-white font-black text-xs shadow disabled:opacity-50"
                >
                  {adminFeeSaving ? 'Enregistrement...' : 'Enregistrer Marge Bybit & Frais SALOMA'}
                </button>

                <div className="p-2.5 rounded-xl bg-[#150D2E] border border-purple-500/40 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-black text-white text-xs block">
                      Frais SALOMA 0.1% - BOT 3
                    </span>
                    <span className="text-[10px] text-purple-300 block">
                      {adminBot3FeeEnabled
                        ? 'ON : 0.1% du profit net déduit par trade clôturé (ex: 10 000 Ar → 10 Ar)'
                        : 'OFF par défaut : 0 frais déduit sur BOT 3'}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={adminBot3FeeSaving}
                    onClick={() => void handleToggleAdminBot3Fee()}
                    className={`px-3.5 py-2 rounded-xl font-black text-xs shrink-0 border transition disabled:opacity-50 ${
                      adminBot3FeeEnabled
                        ? 'bg-emerald-600 border-emerald-300 text-white'
                        : 'bg-[#100926] border-rose-400/70 text-rose-300'
                    }`}
                  >
                    {adminBot3FeeSaving ? '...' : adminBot3FeeEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              {/* TABLE SÉPARÉE 1 : ClientTrade (Base interne SALOMA) */}
              <div className="p-3.5 rounded-2xl bg-[#1D1240] border-2 border-[#8B5CF6]/60 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-white block">
                    1. ClientTrade — Base Interne SALOMA ({(adminExchangeSummary?.clientTrades || []).length || adminTrades.length})
                  </span>
                  <span className="text-[10px] font-mono text-emerald-300 font-bold">
                    Frais SALOMA 0.1%
                  </span>
                </div>
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {(adminExchangeSummary?.clientTrades || []).length > 0 ? (
                    adminExchangeSummary!.clientTrades.map(ct => (
                      <div key={ct.id} className="p-2.5 rounded-xl bg-[#150D2E] text-xs border border-purple-500/25 space-y-1">
                        <div className="flex justify-between font-bold">
                          <span className="text-white">
                            {ct.side} {ct.pair} • {ct.amountUsdt.toFixed(2)} USDT
                          </span>
                          <span
                            className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                              ct.status === 'OPEN'
                                ? 'bg-amber-500/20 text-amber-300'
                                : ct.status === 'CANCELLED_REFUNDED'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            {ct.status}
                          </span>
                        </div>
                        <div className="flex justify-between text-[10px] font-mono text-purple-300">
                          <span>Client: {ct.clientId.slice(0, 8)} • Entrée ${formatCoinPrice(ct.entryPrice)}</span>
                          <span>Frais SALOMA: {ct.salomaFeeUsdt.toFixed(4)} USDT</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-mono">
                          <span className="text-purple-400">
                            {ct.exitPrice ? `Sortie $${formatCoinPrice(ct.exitPrice)}` : 'Position ouverte'}
                          </span>
                          <span className={ct.pnlUsdt >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                            PnL: {ct.pnlUsdt >= 0 ? '+' : ''}{ct.pnlUsdt.toFixed(4)} USDT
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    adminTrades.map(tr => (
                      <div key={tr.$id} className="p-2.5 rounded-xl bg-[#150D2E] text-xs border border-purple-500/20 space-y-1">
                        <div className="flex justify-between font-bold">
                          <span className="text-white">
                            {tr.paire} ({tr.type}) {tr.mode ? `• ${tr.mode}` : ''}
                          </span>
                          <span className="text-purple-300 font-mono">{tr.statut}</span>
                        </div>
                        <div className="flex justify-between text-[11px] font-mono">
                          <span className="text-purple-400">{Number(tr.montant).toLocaleString('fr-FR')} Ar</span>
                          <span className={Number(tr.profit) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            Profit: {Number(tr.profit).toLocaleString('fr-FR')} Ar
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* TABLE SÉPARÉE 2 : HedgeTrade (Ordres réels BYBIT avec API KEY Admin) */}
              <div className="p-3.5 rounded-2xl bg-[#1D1240] border-2 border-sky-400/60 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-sky-200 block">
                    2. HedgeTrade — Couverture Réelle BYBIT Admin ({(adminExchangeSummary?.hedgeTrades || []).length})
                  </span>
                  <span className="text-[10px] font-mono text-amber-300 font-bold">
                    Frais BYBIT 0.1%
                  </span>
                </div>
                {(adminExchangeSummary?.hedgeTrades || []).length === 0 ? (
                  <p className="text-[11px] text-purple-300 text-center py-3">
                    Aucun ordre Hedge BYBIT enregistré pour le moment.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-72 overflow-y-auto">
                    {adminExchangeSummary!.hedgeTrades.map(ht => (
                      <div key={ht.id} className="p-2.5 rounded-xl bg-[#150D2E] text-xs border border-sky-500/30 space-y-1">
                        <div className="flex justify-between font-bold">
                          <span className="text-sky-200">
                            {ht.exchange} {ht.side} {ht.pair} • {ht.amountUsdt.toFixed(2)} USDT
                          </span>
                          <span
                            className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                              ht.status === 'OPEN'
                                ? 'bg-sky-500/20 text-sky-300'
                                : ht.status === 'FAILED'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            {ht.status}
                          </span>
                        </div>
                        <div className="flex justify-between text-[10px] font-mono text-purple-300">
                          <span>ClientTrade: {ht.clientTradeId.slice(0, 10)}</span>
                          <span>Order BYBIT: {ht.bybitEntryOrderId || ht.bybitExitOrderId || '---'}</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-mono">
                          <span className="text-amber-300">Frais BYBIT (0.1%): {ht.bybitFeeUsdt.toFixed(4)} USDT</span>
                          {ht.error && <span className="text-rose-300 truncate max-w-[55%]">{ht.error}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {adminTab === 'wallet' && (
            <div className="p-3.5 rounded-2xl bg-[#1D1240] border-2 border-[#8B5CF6]/50 space-y-2">
              <span className="text-xs font-bold text-white block">
                Dépôts & Retraits Appwrite ({adminTransactions.length})
              </span>
              {adminTransactions.length === 0 ? (
                <p className="text-xs text-purple-400 text-center py-4">Aucune transaction</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {adminTransactions.map(tx => (
                    <div
                      key={tx.$id}
                      className="flex justify-between items-center p-2.5 rounded-xl bg-[#150D2E] text-xs border border-purple-500/20 gap-2"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-white uppercase block truncate">
                          {tx.type} • {Number(tx.montant).toLocaleString('fr-FR')} {tx.devise}
                        </span>
                        <span className="text-[10px] text-purple-300 block truncate">
                          {tx.methode} • {tx.numero_compte}
                        </span>
                        {Number(tx.frais) > 0 && (
                          <span className="text-[9px] text-amber-300 font-mono block">
                            Frais réseau: {tx.frais} {tx.devise}
                          </span>
                        )}
                        <span className="text-[9px] text-purple-400 font-mono block">
                          User: {tx.user_id.slice(0, 8)} • {tx.date ? new Date(tx.date).toLocaleString('fr-FR') : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {tx.statut === 'en_attente' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleAdminValidateTx(tx)}
                              className="px-2 py-1 rounded bg-emerald-600 text-white text-[10px] font-bold"
                            >
                              Valider
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdminRejectTx(tx)}
                              className="px-2 py-1 rounded bg-rose-600 text-white text-[10px] font-bold"
                            >
                              Refuser
                            </button>
                          </>
                        ) : (
                          <span
                            className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                              tx.statut === 'valide'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            {tx.statut}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {adminTab === 'adminWallet' && (
            <AdminWalletView
              adminPin={adminPin}
              adminEmail={adminEmail}
              adminSessionToken={adminSessionToken}
              coins={coins}
              salomaFees={salomaFees}
              usdToMga={USD_TO_MGA}
              showToast={showToast}
              initialWallet={adminOwnWallet}
              initialTransactions={adminOwnWalletTxs}
              initialWalletAddresses={adminOwnWalletAddresses}
              onWalletUpdated={(nextWallet, nextTxs) => {
                setAdminOwnWallet(nextWallet);
                setAdminOwnWalletTxs(nextTxs);
              }}
            />
          )}

          {/* ========================================================
              ADMIN - 3 APIS SÉPARÉES : BYBIT / OKX / BINANCE (SECRETS **** + STATUT TEMPS RÉEL + MARGE %)
             ======================================================== */}
          {adminTab === 'apis' && (
            <div className="space-y-4">
              {/* ADMIN CONFIGURATION FRAIS SALOMA & MARGE RÉCUPÉRATION BYBIT */}
              <div className="p-4 rounded-3xl bg-[#1D1240] border-2 border-emerald-400/70 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-black text-white text-sm">Auto Buy / Sell — Marge Bybit &amp; Frais SALOMA</h3>
                    <span className="text-[10px] text-purple-300 block">
                      Bybit garantit la liquidité • SALOMA récupère {adminFeeInputs.bybitRecoveryMarginPct}% dans le prix + affiche ses frais au client
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="col-span-2 p-2.5 rounded-xl bg-[#150D2E] border border-sky-500/40 space-y-1">
                    <label className="font-black text-sky-300 text-[10px] block">
                      % Marge récupération frais Bybit (défaut 0.1%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      step={0.01}
                      value={adminFeeInputs.bybitRecoveryMarginPct}
                      onChange={e =>
                        setAdminFeeInputs(prev => ({ ...prev, bybitRecoveryMarginPct: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#100926] border border-sky-500/50 text-white font-mono font-bold text-xs"
                    />
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#150D2E] border border-emerald-500/40 space-y-1">
                    <label className="font-black text-emerald-300 text-[10px] block">
                      Frais Trade % (déf. 0.1%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      step={0.01}
                      value={adminFeeInputs.tradeFeePct}
                      onChange={e => setAdminFeeInputs(prev => ({ ...prev, tradeFeePct: e.target.value }))}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#100926] border border-emerald-500/50 text-white font-mono font-bold text-xs"
                    />
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#150D2E] border border-purple-500/40 space-y-1">
                    <label className="font-black text-purple-300 text-[10px] block">
                      Frais Échange % (déf. 0.1%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      step={0.01}
                      value={adminFeeInputs.exchangeFeePct}
                      onChange={e => setAdminFeeInputs(prev => ({ ...prev, exchangeFeePct: e.target.value }))}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#100926] border border-purple-500/50 text-white font-mono font-bold text-xs"
                    />
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#150D2E] border border-amber-500/40 space-y-1">
                    <label className="font-black text-amber-300 text-[10px] block">
                      Frais Retrait % (déf. 0.15%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      step={0.01}
                      value={adminFeeInputs.withdrawFeePct}
                      onChange={e => setAdminFeeInputs(prev => ({ ...prev, withdrawFeePct: e.target.value }))}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#100926] border border-amber-500/50 text-white font-mono font-bold text-xs"
                    />
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#150D2E] border border-amber-500/40 space-y-1">
                    <label className="font-black text-amber-300 text-[10px] block">
                      Frais Réseau (USDT, déf. 0.50)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.05}
                      value={adminFeeInputs.networkFeeUsdt}
                      onChange={e => setAdminFeeInputs(prev => ({ ...prev, networkFeeUsdt: e.target.value }))}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#100926] border border-amber-500/50 text-white font-mono font-bold text-xs"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={adminFeeSaving}
                  onClick={() => void handleAdminSaveFees()}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-[#7C3AED] text-white font-black text-xs shadow disabled:opacity-50"
                >
                  {adminFeeSaving ? 'Enregistrement...' : 'Enregistrer Marge Bybit & Frais SALOMA'}
                </button>

                <div className="p-2.5 rounded-xl bg-[#150D2E] border border-purple-500/40 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-black text-white text-xs block">
                      Frais SALOMA 0.1% - BOT 3
                    </span>
                    <span className="text-[10px] text-purple-300 block">
                      {adminBot3FeeEnabled
                        ? 'ON : 0.1% du profit net déduit par trade clôturé (ex: 10 000 Ar → 10 Ar)'
                        : 'OFF par défaut : 0 frais déduit sur BOT 3'}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={adminBot3FeeSaving}
                    onClick={() => void handleToggleAdminBot3Fee()}
                    className={`px-3.5 py-2 rounded-xl font-black text-xs shrink-0 border transition disabled:opacity-50 ${
                      adminBot3FeeEnabled
                        ? 'bg-emerald-600 border-emerald-300 text-white'
                        : 'bg-[#100926] border-rose-400/70 text-rose-300'
                    }`}
                  >
                    {adminBot3FeeSaving ? '...' : adminBot3FeeEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              {/* CHOIX DE L'API PRINCIPALE POUR ENVOI DES ORDRES */}
              <div className="p-4 rounded-3xl bg-[#1D1240] border-2 border-[#8B5CF6] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Server className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h3 className="font-black text-white text-sm">API Principale (Broker Pur)</h3>
                      <span className="text-[10px] text-purple-300">
                        Sélectionnez l’API qui reçoit et liquide les ordres clients
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void handleTestSponsorConnection('bybit');
                      void handleTestSponsorConnection('okx');
                      void handleTestSponsorConnection('binance');
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-[#23154D] hover:bg-[#7C3AED] border border-[#8B5CF6]/60 text-[10px] font-black text-white inline-flex items-center gap-1 transition"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${
                        sponsorConnectionStatus.bybit.loading ||
                        sponsorConnectionStatus.okx.loading ||
                        sponsorConnectionStatus.binance.loading
                          ? 'animate-spin'
                          : ''
                      }`}
                    />
                    <span>Tester Tout</span>
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['bybit', 'okx', 'binance'] as const).map(id => {
                    const isPrimary = (adminApisConfig?.primaryApi || 'bybit') === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        disabled={apiActionLoading === `primary-${id}`}
                        onClick={() => handleAdminSetPrimaryApi(id)}
                        className={`py-2.5 px-2 rounded-2xl border-2 text-xs font-black transition ${
                          isPrimary
                            ? 'bg-gradient-to-r from-emerald-600 to-[#7C3AED] border-emerald-300 text-white shadow'
                            : 'bg-[#150D2E] border-purple-500/30 text-purple-200 hover:border-[#8B5CF6]'
                        }`}
                      >
                        <span className="block">{id.toUpperCase()}</span>
                        <span className="text-[9px] font-mono opacity-90">
                          {isPrimary ? '★ Principale' : 'Sélectionner'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3 BLOCS SÉPARÉS : BYBIT | OKX | BINANCE */}
              {(['bybit', 'okx', 'binance'] as const).map(id => {
                const cfg = adminApisConfig?.providers.find(p => p.id === id) || {
                  id,
                  label: id.toUpperCase(),
                  enabled: id === 'bybit',
                  isPrimary: id === 'bybit',
                  marginPct: 0.1,
                  hasApiKey: false,
                  apiKeyMasked: '',
                  hasSecret: false,
                  secretMasked: '',
                  hasPassphrase: false,
                  passphraseMasked: ''
                };
                const inputs = apiFormInputs[id];
                const conn = sponsorConnectionStatus[id];
                const marginStr = apiMarginInputs[id] ?? String(cfg.marginPct ?? 0.1);
                const parsedMargin = Number(String(marginStr).replace(',', '.'));
                const safeMarginPct = Number.isFinite(parsedMargin) ? Math.min(5, Math.max(0, parsedMargin)) : 0.1;
                const sampleSponsorPrice = 0.00008;
                const sampleClientPrice = Number((sampleSponsorPrice * (1 + safeMarginPct / 100)).toFixed(8));
                const sampleFeeEst = Number((sampleSponsorPrice * 0.001).toFixed(8));
                const rawSampleNet =
                  Math.abs(safeMarginPct - 0.1) < 1e-9
                    ? 0
                    : Number((sampleClientPrice - sampleSponsorPrice - sampleFeeEst).toFixed(8));
                const sampleNetProfit = Math.abs(rawSampleNet) < 1e-8 ? 0 : rawSampleNet;

                return (
                  <div
                    key={id}
                    className={`p-4 rounded-3xl bg-[#1D1240] border-2 space-y-3 ${
                      cfg.isPrimary
                        ? 'border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                        : 'border-[#8B5CF6]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-black text-white text-sm">{cfg.label} API</h4>
                          {cfg.isPrimary && (
                            <span className="text-[9px] font-black px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/50">
                              ★ PRINCIPALE
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-purple-300 block">
                          {cfg.hasSecret ? 'Secret Admin : ****' : 'Fallback Admin : non saisi'}
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={apiActionLoading === `toggle-${id}`}
                        onClick={() => handleAdminToggleApi(id, !cfg.enabled)}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition shrink-0 ${
                          cfg.enabled
                            ? 'bg-emerald-600/25 border border-emerald-400 text-emerald-300'
                            : 'bg-rose-600/20 border border-rose-500/50 text-rose-300'
                        }`}
                      >
                        {cfg.enabled ? '● Activée (Désactiver)' : '○ Désactivée (Activer)'}
                      </button>
                    </div>

                    {/* INDICATEUR CONNEXION EN TEMPS RÉEL + BOUTON TESTER CONNEXION */}
                    <div className="p-2.5 rounded-2xl bg-[#150D2E] border border-[#8B5CF6]/40 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        {conn.loading ? (
                          <span className="text-[11px] font-mono font-bold text-purple-200 flex items-center gap-1.5">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#8B5CF6]" />
                            Vérification en cours...
                          </span>
                        ) : conn.connected ? (
                          <div>
                            <span className="text-[11px] font-mono font-black text-emerald-300 block">
                              Connecté ✅ - Solde: {conn.usdtBalance.toLocaleString('en-US', { maximumFractionDigits: 4 })} USDT
                            </span>
                            <span className="text-[9px] font-mono text-purple-300 block">
                              Source : {conn.source === 'vercel_env' ? 'Variables Vercel' : 'Clés saisies Admin'}
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-[11px] font-mono font-black text-rose-300 block">
                              Non connecté ❌
                            </span>
                            {conn.tested && conn.message && (
                              <span className="text-[9px] font-mono text-rose-200/80 block truncate">
                                {conn.message}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={conn.loading}
                        onClick={() => void handleTestSponsorConnection(id)}
                        className="px-2.5 py-1.5 rounded-xl bg-[#23154D] hover:bg-[#7C3AED] border border-[#8B5CF6]/70 text-white text-[10px] font-black shrink-0 inline-flex items-center gap-1 disabled:opacity-50 transition"
                      >
                        <RefreshCw className={`w-3 h-3 ${conn.loading ? 'animate-spin' : ''}`} />
                        <span>Tester Connexion</span>
                      </button>
                    </div>

                    {/* CHAMP MODIFIABLE : MARGE % (RÉCUPÉRATION FRAIS) PAR SPONSOR */}
                    <div className="p-3 rounded-2xl bg-[#150D2E] border border-emerald-500/35 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-[11px] font-black text-emerald-300">
                          Marge % (récupération frais) — {cfg.label}
                        </label>
                        <span className="text-[10px] font-mono text-purple-300">0% – 5%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={5}
                          step={0.01}
                          value={marginStr}
                          onChange={e =>
                            setApiMarginInputs(prev => ({
                              ...prev,
                              [id]: e.target.value
                            }))
                          }
                          className="flex-1 px-3 py-2 rounded-xl bg-[#100926] border border-[#8B5CF6]/60 text-white font-mono font-black text-xs focus:outline-none focus:border-emerald-400"
                        />
                        <span className="font-mono font-black text-purple-200 text-xs">%</span>
                        <button
                          type="button"
                          disabled={apiActionLoading === `margin-${id}`}
                          onClick={() => void handleAdminSaveApiMargin(id)}
                          className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] shrink-0 disabled:opacity-50 transition"
                        >
                          {apiActionLoading === `margin-${id}` ? '...' : 'Appliquer'}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1 border-t border-purple-500/20 text-[10px] font-mono">
                        <span className="text-purple-300">Prix Sponsor ex:</span>
                        <span className="text-right text-sky-300">${sampleSponsorPrice.toFixed(8)}</span>
                        <span className="text-purple-300">Prix Client ({safeMarginPct}%):</span>
                        <span className="text-right text-emerald-400 font-bold">${sampleClientPrice.toFixed(8)}</span>
                        <span className="text-purple-300">Frais estimés (0.1%):</span>
                        <span className="text-right text-amber-300">${sampleFeeEst.toFixed(8)}</span>
                        <span className="text-purple-300">Profit net estimé:</span>
                        <span className={`text-right font-bold ${sampleNetProfit >= 0 ? 'text-emerald-300' : 'text-rose-400'}`}>
                          {sampleNetProfit > 0 ? '+' : sampleNetProfit < 0 ? '-' : ''}${Math.abs(sampleNetProfit).toFixed(8)}
                        </span>
                      </div>
                    </div>

                    {/* CHAMPS CLÉ / SECRET CONSERVÉS EN SECOURS */}
                    <div className="space-y-2.5 text-xs">
                      <div>
                        <label className="text-[10px] font-bold text-purple-300 block mb-1">
                          {cfg.label} API Key {cfg.hasApiKey ? `(${cfg.apiKeyMasked})` : ''}
                        </label>
                        <input
                          type="text"
                          value={inputs.apiKey}
                          onChange={e =>
                            setApiFormInputs(prev => ({
                              ...prev,
                              [id]: { ...prev[id], apiKey: e.target.value }
                            }))
                          }
                          placeholder={cfg.hasApiKey ? `Clé actuelle : ${cfg.apiKeyMasked}` : `Entrez votre ${cfg.label} API Key`}
                          className="w-full px-3 py-2 rounded-xl bg-[#150D2E] border border-[#8B5CF6]/50 text-white font-mono text-xs"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-purple-300 block mb-1">
                          {cfg.label} Secret {cfg.hasSecret ? '(**** Masqué)' : ''}
                        </label>
                        <input
                          type="password"
                          autoComplete="new-password"
                          value={inputs.secret}
                          onChange={e =>
                            setApiFormInputs(prev => ({
                              ...prev,
                              [id]: { ...prev[id], secret: e.target.value }
                            }))
                          }
                          placeholder={cfg.hasSecret ? '**************** (laisser vide pour conserver)' : `Entrez votre ${cfg.label} Secret`}
                          className="w-full px-3 py-2 rounded-xl bg-[#150D2E] border border-[#8B5CF6]/50 text-white font-mono text-xs"
                        />
                      </div>

                      {id === 'okx' && (
                        <div>
                          <label className="text-[10px] font-bold text-purple-300 block mb-1">
                            OKX Passphrase {cfg.hasPassphrase ? '(**** Masqué)' : ''}
                          </label>
                          <input
                            type="password"
                            autoComplete="new-password"
                            value={inputs.passphrase}
                            onChange={e =>
                              setApiFormInputs(prev => ({
                                ...prev,
                                okx: { ...prev.okx, passphrase: e.target.value }
                              }))
                            }
                            placeholder={cfg.hasPassphrase ? '************ (laisser vide pour conserver)' : 'Entrez votre OKX Passphrase'}
                            className="w-full px-3 py-2 rounded-xl bg-[#150D2E] border border-[#8B5CF6]/50 text-white font-mono text-xs"
                          />
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={apiActionLoading === `save-${id}`}
                        onClick={() => handleAdminSaveApiKeys(id)}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white font-black text-xs shadow disabled:opacity-50"
                      >
                        {apiActionLoading === `save-${id}`
                          ? 'Enregistrement...'
                          : `Enregistrer clés ${cfg.label}`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {adminTab === 'security' && (
            <div className="space-y-4">
              {/* CLOUDFLARE TURNSTILE : AUTOMATIQUE / INVISIBLE (SITE KEY PUBLIQUE UNIQUEMENT) */}
              <div className="p-4 rounded-3xl bg-[#1D1240] border-2 border-[#8B5CF6] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h3 className="font-black text-white text-sm">Cloudflare Turnstile (Invisible)</h3>
                      <span className="text-[10px] text-purple-300 block">
                        Vérification automatique en arrière-plan sans case à cocher
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-[9px] font-black px-2 py-0.5 rounded border ${
                      turnstileSiteKey && turnstileSiteKey !== TEST_TURNSTILE_SITE_KEY
                        ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                        : 'bg-purple-500/20 border-purple-400/50 text-purple-200'
                    }`}
                  >
                    {turnstileSiteKey && turnstileSiteKey !== TEST_TURNSTILE_SITE_KEY
                      ? 'Site Key Active'
                      : 'Mode Invisible'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#150D2E] border border-[#8B5CF6]/40 space-y-2 text-[11px]">
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-purple-300 font-bold">Site Key (Publique) :</span>
                    <span className="font-mono text-white font-bold truncate max-w-[60%]">
                      {turnstileSiteKey}
                    </span>
                  </div>
                  <p className="text-purple-300/80 leading-relaxed">
                    Configurez <span className="font-mono text-white">NEXT_PUBLIC_CLOUDFLARE_SITE_KEY</span>{' '}
                    (publique) et <span className="font-mono text-white">CLOUDFLARE_TURNSTILE_SECRET_KEY</span>{' '}
                    uniquement dans les variables d&apos;environnement Vercel (jamais stockée dans l&apos;interface).
                  </p>
                </div>
              </div>

              {/* MODIFICATION CODE ADMINISTRATEUR */}
              <div className="p-4 rounded-3xl bg-[#1D1240] border-2 border-[#8B5CF6] space-y-4">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-amber-400" />
                  <h3 className="font-black text-white text-sm">Modification Code Administrateur</h3>
                </div>
                {codeChangeMsg && (
                  <div
                    className={`p-2.5 rounded-xl border text-xs font-bold ${
                      codeChangeMsg.isError
                        ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                        : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                    }`}
                  >
                    {codeChangeMsg.text}
                  </div>
                )}
                <form onSubmit={handleChangeAdminCode} className="space-y-3 text-xs">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={9}
                    required
                    value={oldCodeInput}
                    onChange={e => setOldCodeInput(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Ancien code 9 chiffres"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#150D2E] border-2 border-[#8B5CF6]/50 text-white font-mono text-center tracking-widest"
                  />
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={9}
                    required
                    value={newCodeInput1}
                    onChange={e => setNewCodeInput1(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Nouveau code 9 chiffres"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#150D2E] border-2 border-[#8B5CF6]/50 text-white font-mono text-center tracking-widest"
                  />
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={9}
                    required
                    value={newCodeInput2}
                    onChange={e => setNewCodeInput2(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Confirmer nouveau code 9 chiffres"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#150D2E] border-2 border-[#8B5CF6]/50 text-white font-mono text-center tracking-widest"
                  />
                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white font-black text-xs"
                  >
                    Enregistrer le Nouveau Code
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
