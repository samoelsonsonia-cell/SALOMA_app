/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * SALOMA - Crypto Exchange & Trading Platform
 * Colors: Violet Brillant #7C3AED, #8B5CF6, Fond Sombre #150D2E
 * Mobile-First, Français (Malagasy)
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  Repeat,
  Bot,
  Gift,
  Users,
  ShieldCheck,
  Copy,
  Check,
  ArrowLeft,
  X,
  Lock,
  AlertTriangle,
  RefreshCw,
  BarChart2,
  Zap,
  HelpCircle,
  User,
  Trash2,
  CheckCircle2,
  Layers,
  Activity,
  ArrowRightLeft,
  Server,
  Search,
  ChevronDown,
  Sliders,
  Play,
  RotateCcw
} from 'lucide-react';

// --- DATA STRUCTURES ---

export interface CoinNetwork {
  chain: string;
  name: string;
  depositFee: number;
  withdrawFee: number;
  feeSymbol: string;
  minDeposit: number;
  minWithdraw: number;
  addressExample: string;
}

export interface Coin {
  id: string;
  symbol: string;
  name: string;
  sponsorPrice: number; // Internal Bybit feed
  price: number; // SALOMA price (confidential discount)
  change24h: number;
  iconBg: string;
  iconColor: string;
  networks: CoinNetwork[];
}

export interface Position {
  id: string;
  clientName?: string;
  coinId: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  currentPrice: number;
  amountUsd: number;
  leverage: number;
  liquidationPrice: number;
  pnlUsd: number;
  pnlPercent: number;
  timestamp: number;
  mode: 'Manuel' | 'Auto' | 'Semi-Auto';
}

export interface TradeHistoryItem {
  id: string;
  clientName?: string;
  coinSymbol: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  closePrice: number;
  amountUsd: number;
  leverage: number;
  pnlUsd: number;
  pnlPercent: number;
  timestamp: number;
  mode: 'Manuel' | 'Auto' | 'Semi-Auto';
}

export interface ExchangeHistoryItem {
  id: string;
  fromCoin: string;
  toCoin: string;
  fromAmount: number;
  toAmount: number;
  feeUsd: number;
  timestamp: number;
}

export interface WalletTransaction {
  id: string;
  type: 'DEPOT' | 'RETRAIT' | 'TRANSFERT';
  coinSymbol: string;
  network?: string;
  amount: number;
  amountUsd: number;
  salomaFee: number;
  networkFee: number;
  totalDebited: number;
  netReceived: number;
  status: 'Complété' | 'En attente' | 'Vérifié';
  address?: string;
  timestamp: number;
  transferDetails?: {
    from: 'Trading' | 'Wallet';
    to: 'Trading' | 'Wallet';
  };
}

export interface ClientRecord {
  id: string;
  name: string;
  country: string;
  investmentUsd: number;
  problems: string;
  hasProblem: boolean;
  email: string;
  phone: string;
  kycLevel: number;
  registeredAt: string;
}

// --- EXTENSIVE GLOBAL COINS LIST ---
const INITIAL_COINS: Coin[] = [
  {
    id: 'btc',
    symbol: 'BTC',
    name: 'Bitcoin',
    sponsorPrice: 68420.00,
    price: 68150.00,
    change24h: 3.42,
    iconBg: 'bg-amber-500/25 text-amber-300 border-amber-400/40 shadow-[0_0_10px_rgba(245,158,11,0.3)]',
    iconColor: 'text-amber-400',
    networks: [
      { chain: 'BTC-Native', name: 'Bitcoin (Native SegWit bech32)', depositFee: 0, withdrawFee: 0.00025, feeSymbol: 'BTC', minDeposit: 0.0001, minWithdraw: 0.0005, addressExample: 'bc1q9h6x743j2y0z5v4km89x2026saloma' },
      { chain: 'Taproot', name: 'Bitcoin (Taproot bech32m)', depositFee: 0, withdrawFee: 0.0002, feeSymbol: 'BTC', minDeposit: 0.0001, minWithdraw: 0.0005, addressExample: 'bc1p5d7rjq7g6e8z8e9q8v8026saloma' },
      { chain: 'Lightning', name: 'Lightning Network (Fast / Instantané)', depositFee: 0, withdrawFee: 0.00001, feeSymbol: 'BTC', minDeposit: 0.00001, minWithdraw: 0.0001, addressExample: 'lnbc10u1p3saloma9823610924' },
      { chain: 'BEP20', name: 'BNB Smart Chain (BEP20 Wrapped)', depositFee: 0, withdrawFee: 0.00008, feeSymbol: 'BTC', minDeposit: 0.0002, minWithdraw: 0.0004, addressExample: '0x71C8A331c2612745345719329705E32bA' },
      { chain: 'ERC20', name: 'Ethereum ERC20 (WBTC)', depositFee: 0, withdrawFee: 0.00035, feeSymbol: 'BTC', minDeposit: 0.0005, minWithdraw: 0.001, addressExample: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' }
    ]
  },
  {
    id: 'eth',
    symbol: 'ETH',
    name: 'Ethereum',
    sponsorPrice: 3580.00,
    price: 3562.00,
    change24h: 2.15,
    iconBg: 'bg-indigo-500/25 text-indigo-300 border-indigo-400/40 shadow-[0_0_10px_rgba(99,102,241,0.3)]',
    iconColor: 'text-indigo-400',
    networks: [
      { chain: 'ERC20', name: 'Ethereum Mainnet (ERC20)', depositFee: 0, withdrawFee: 0.0035, feeSymbol: 'ETH', minDeposit: 0.005, minWithdraw: 0.01, addressExample: '0x992B28B3eB9229555C09F6eF83A8992026' },
      { chain: 'Arbitrum', name: 'Arbitrum One (L2 Rapide)', depositFee: 0, withdrawFee: 0.0006, feeSymbol: 'ETH', minDeposit: 0.001, minWithdraw: 0.002, addressExample: '0x992B28B3eB9229555C09F6eF83A8992026' },
      { chain: 'Optimism', name: 'OP Mainnet (Optimism)', depositFee: 0, withdrawFee: 0.0006, feeSymbol: 'ETH', minDeposit: 0.001, minWithdraw: 0.002, addressExample: '0x992B28B3eB9229555C09F6eF83A8992026' },
      { chain: 'Base', name: 'Base Network (Coinbase L2)', depositFee: 0, withdrawFee: 0.0004, feeSymbol: 'ETH', minDeposit: 0.001, minWithdraw: 0.002, addressExample: '0x992B28B3eB9229555C09F6eF83A8992026' },
      { chain: 'BEP20', name: 'BNB Smart Chain (BEP20)', depositFee: 0, withdrawFee: 0.0008, feeSymbol: 'ETH', minDeposit: 0.002, minWithdraw: 0.005, addressExample: '0x992B28B3eB9229555C09F6eF83A8992026' },
      { chain: 'Polygon', name: 'Polygon POS (WETH)', depositFee: 0, withdrawFee: 0.0005, feeSymbol: 'ETH', minDeposit: 0.001, minWithdraw: 0.002, addressExample: '0x992B28B3eB9229555C09F6eF83A8992026' }
    ]
  },
  {
    id: 'usdt',
    symbol: 'USDT',
    name: 'Tether USD',
    sponsorPrice: 1.0002,
    price: 1.00,
    change24h: 0.01,
    iconBg: 'bg-emerald-500/25 text-emerald-300 border-emerald-400/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]',
    iconColor: 'text-emerald-400',
    networks: [
      { chain: 'TRC20', name: 'TRON (TRC20 - Le plus populaire & rapide)', depositFee: 0, withdrawFee: 1.20, feeSymbol: 'USDT', minDeposit: 1, minWithdraw: 5, addressExample: 'TJX9zK2B7YmNQ9sLo2481A2026SalomaTRC' },
      { chain: 'ERC20', name: 'Ethereum (ERC20 Mainnet)', depositFee: 0, withdrawFee: 4.50, feeSymbol: 'USDT', minDeposit: 10, minWithdraw: 20, addressExample: '0x43bFa92104192bC18E9712aD90176882a' },
      { chain: 'BEP20', name: 'BNB Smart Chain (BEP20 - Très faibles frais)', depositFee: 0, withdrawFee: 0.35, feeSymbol: 'USDT', minDeposit: 1, minWithdraw: 3, addressExample: '0x882a4C82b28F03294E83b271391781290' },
      { chain: 'Polygon', name: 'Polygon POS Network', depositFee: 0, withdrawFee: 0.40, feeSymbol: 'USDT', minDeposit: 1, minWithdraw: 3, addressExample: '0x43bFa92104192bC18E9712aD90176882a' },
      { chain: 'Solana', name: 'Solana (SPL Token)', depositFee: 0, withdrawFee: 0.80, feeSymbol: 'USDT', minDeposit: 1, minWithdraw: 5, addressExample: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk9817' },
      { chain: 'Arbitrum', name: 'Arbitrum One (L2)', depositFee: 0, withdrawFee: 0.50, feeSymbol: 'USDT', minDeposit: 1, minWithdraw: 5, addressExample: '0x43bFa92104192bC18E9712aD90176882a' },
      { chain: 'Optimism', name: 'OP Mainnet (L2)', depositFee: 0, withdrawFee: 0.50, feeSymbol: 'USDT', minDeposit: 1, minWithdraw: 5, addressExample: '0x43bFa92104192bC18E9712aD90176882a' },
      { chain: 'AVAX-C', name: 'Avalanche C-Chain', depositFee: 0, withdrawFee: 0.60, feeSymbol: 'USDT', minDeposit: 1, minWithdraw: 5, addressExample: '0x43bFa92104192bC18E9712aD90176882a' },
      { chain: 'TON', name: 'TON Network (Telegram Ecosystem)', depositFee: 0, withdrawFee: 0.20, feeSymbol: 'USDT', minDeposit: 1, minWithdraw: 3, addressExample: 'EQBvW8Z5huBkMJYdn3PCDnHo4619' }
    ]
  },
  {
    id: 'sol',
    symbol: 'SOL',
    name: 'Solana',
    sponsorPrice: 184.50,
    price: 183.20,
    change24h: 5.84,
    iconBg: 'bg-purple-500/25 text-purple-300 border-purple-400/40 shadow-[0_0_10px_rgba(168,85,247,0.3)]',
    iconColor: 'text-purple-400',
    networks: [
      { chain: 'Solana', name: 'Solana Native Mainnet (Ultra-Rapide)', depositFee: 0, withdrawFee: 0.01, feeSymbol: 'SOL', minDeposit: 0.05, minWithdraw: 0.1, addressExample: '7Np41oeYqPefeNQEHSv13918z88fSalomaSol' },
      { chain: 'BEP20', name: 'BNB Smart Chain (BEP20)', depositFee: 0, withdrawFee: 0.015, feeSymbol: 'SOL', minDeposit: 0.05, minWithdraw: 0.1, addressExample: '0x38Bc491A2026aD728F6b2819876291' }
    ]
  },
  {
    id: 'bnb',
    symbol: 'BNB',
    name: 'BNB Chain',
    sponsorPrice: 598.00,
    price: 594.50,
    change24h: -1.12,
    iconBg: 'bg-yellow-500/25 text-yellow-300 border-yellow-400/40 shadow-[0_0_10px_rgba(234,179,8,0.3)]',
    iconColor: 'text-yellow-400',
    networks: [
      { chain: 'BEP20', name: 'BNB Smart Chain (BEP20 Native)', depositFee: 0, withdrawFee: 0.001, feeSymbol: 'BNB', minDeposit: 0.01, minWithdraw: 0.02, addressExample: '0x55d398326f99059fF775485246999027B3197955' },
      { chain: 'Beacon', name: 'BNB Beacon Chain (BEP2)', depositFee: 0, withdrawFee: 0.002, feeSymbol: 'BNB', minDeposit: 0.02, minWithdraw: 0.05, addressExample: 'bnb1grpf0955h0ykzq3as5x00eSaloma' },
      { chain: 'opBNB', name: 'opBNB Mainnet (L2)', depositFee: 0, withdrawFee: 0.0005, feeSymbol: 'BNB', minDeposit: 0.01, minWithdraw: 0.02, addressExample: '0x55d398326f99059fF775485246999027B3197955' }
    ]
  },
  {
    id: 'saloma',
    symbol: 'SALOMA',
    name: 'Saloma Native Coin',
    sponsorPrice: 1.25,
    price: 1.18,
    change24h: 14.80,
    iconBg: 'bg-[#7C3AED]/40 text-purple-200 border-[#8B5CF6] shadow-[0_0_15px_rgba(124,58,237,0.6)]',
    iconColor: 'text-[#8B5CF6]',
    networks: [
      { chain: 'SalomaNet', name: 'Saloma High-Speed Mainnet (0 Gas)', depositFee: 0, withdrawFee: 0.00, feeSymbol: 'SALOMA', minDeposit: 1, minWithdraw: 2, addressExample: 'saloma1vola98273645gasy2026official' },
      { chain: 'BEP20', name: 'BNB Smart Chain (BEP20 Wrapped)', depositFee: 0, withdrawFee: 0.5, feeSymbol: 'SALOMA', minDeposit: 5, minWithdraw: 10, addressExample: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8' },
      { chain: 'Polygon', name: 'Polygon POS Bridge', depositFee: 0, withdrawFee: 0.2, feeSymbol: 'SALOMA', minDeposit: 5, minWithdraw: 10, addressExample: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8' }
    ]
  },
  {
    id: 'xrp',
    symbol: 'XRP',
    name: 'Ripple',
    sponsorPrice: 0.62,
    price: 0.612,
    change24h: 4.20,
    iconBg: 'bg-blue-500/25 text-blue-300 border-blue-400/40',
    iconColor: 'text-blue-400',
    networks: [
      { chain: 'Ripple', name: 'XRP Ledger (Ripple Native - Tag Requis)', depositFee: 0, withdrawFee: 0.25, feeSymbol: 'XRP', minDeposit: 1, minWithdraw: 5, addressExample: 'rEb8TK3gBgk5auZyyb6328026Saloma' },
      { chain: 'BEP20', name: 'BNB Smart Chain (BEP20)', depositFee: 0, withdrawFee: 0.30, feeSymbol: 'XRP', minDeposit: 1, minWithdraw: 5, addressExample: '0x1d2f0da169ceb9fc7b3144628db156f3f6c60dbe' }
    ]
  },
  {
    id: 'doge',
    symbol: 'DOGE',
    name: 'Dogecoin',
    sponsorPrice: 0.165,
    price: 0.162,
    change24h: -2.40,
    iconBg: 'bg-amber-600/25 text-amber-200 border-amber-500/40',
    iconColor: 'text-amber-300',
    networks: [
      { chain: 'Dogecoin', name: 'Dogecoin Core Network', depositFee: 0, withdrawFee: 2.0, feeSymbol: 'DOGE', minDeposit: 10, minWithdraw: 20, addressExample: 'D8vG43901kLx2026SalomaMadagascar' },
      { chain: 'BEP20', name: 'BNB Smart Chain (BEP20)', depositFee: 0, withdrawFee: 1.5, feeSymbol: 'DOGE', minDeposit: 10, minWithdraw: 20, addressExample: '0xba2ae424d960c26247dd6c32edc70b295c744c43' }
    ]
  },
  {
    id: 'ada',
    symbol: 'ADA',
    name: 'Cardano',
    sponsorPrice: 0.495,
    price: 0.489,
    change24h: 1.85,
    iconBg: 'bg-sky-500/25 text-sky-300 border-sky-400/40',
    iconColor: 'text-sky-400',
    networks: [
      { chain: 'Cardano', name: 'Cardano Native (Shelley)', depositFee: 0, withdrawFee: 0.8, feeSymbol: 'ADA', minDeposit: 2, minWithdraw: 5, addressExample: 'addr1q9h6x743j2y0z5v4km89x2026saloma' },
      { chain: 'BEP20', name: 'BNB Smart Chain (BEP20)', depositFee: 0, withdrawFee: 0.5, feeSymbol: 'ADA', minDeposit: 2, minWithdraw: 5, addressExample: '0x3ee2200efb3400fabb9aacf31297cbdd1d435d47' }
    ]
  },
  {
    id: 'ton',
    symbol: 'TON',
    name: 'Toncoin',
    sponsorPrice: 5.85,
    price: 5.78,
    change24h: 7.20,
    iconBg: 'bg-cyan-500/25 text-cyan-300 border-cyan-400/40',
    iconColor: 'text-cyan-400',
    networks: [
      { chain: 'TON', name: 'The Open Network (TON Native)', depositFee: 0, withdrawFee: 0.05, feeSymbol: 'TON', minDeposit: 0.2, minWithdraw: 0.5, addressExample: 'EQBvW8Z5huBkMJYdn3PCDnHo4619SalomaTON' },
      { chain: 'BEP20', name: 'BNB Smart Chain (BEP20)', depositFee: 0, withdrawFee: 0.08, feeSymbol: 'TON', minDeposit: 0.5, minWithdraw: 1, addressExample: '0x76a797a59ba2c17726896976b7b3747bfd1d220f' }
    ]
  },
  {
    id: 'avax',
    symbol: 'AVAX',
    name: 'Avalanche',
    sponsorPrice: 34.20,
    price: 33.85,
    change24h: 3.10,
    iconBg: 'bg-red-500/25 text-red-300 border-red-400/40',
    iconColor: 'text-red-400',
    networks: [
      { chain: 'AVAX-C', name: 'Avalanche C-Chain Native', depositFee: 0, withdrawFee: 0.01, feeSymbol: 'AVAX', minDeposit: 0.1, minWithdraw: 0.2, addressExample: '0x1ceb83918a2026salomaavax0192' },
      { chain: 'BEP20', name: 'BNB Smart Chain (BEP20)', depositFee: 0, withdrawFee: 0.02, feeSymbol: 'AVAX', minDeposit: 0.1, minWithdraw: 0.2, addressExample: '0x1ceb83918a2026salomaavax0192' }
    ]
  },
  {
    id: 'sui',
    symbol: 'SUI',
    name: 'Sui Network',
    sponsorPrice: 2.15,
    price: 2.12,
    change24h: 9.40,
    iconBg: 'bg-blue-600/25 text-blue-200 border-blue-400/40',
    iconColor: 'text-blue-300',
    networks: [
      { chain: 'Sui', name: 'Sui Native Mainnet', depositFee: 0, withdrawFee: 0.05, feeSymbol: 'SUI', minDeposit: 1, minWithdraw: 2, addressExample: '0x43bFa92104192bC18E9712aD90176882aSalomaSui' }
    ]
  },
  {
    id: 'pepe',
    symbol: 'PEPE',
    name: 'Pepe Coin',
    sponsorPrice: 0.0000098,
    price: 0.0000084,
    change24h: 16.50,
    iconBg: 'bg-green-600/25 text-green-300 border-green-500/40',
    iconColor: 'text-green-300',
    networks: [
      { chain: 'ERC20', name: 'Ethereum Mainnet (ERC20)', depositFee: 0, withdrawFee: 250000, feeSymbol: 'PEPE', minDeposit: 500000, minWithdraw: 1000000, addressExample: '0x6982508145454Ce325dDbE47a25d4ec3d2311933' },
      { chain: 'BEP20', name: 'BNB Smart Chain (BEP20)', depositFee: 0, withdrawFee: 100000, feeSymbol: 'PEPE', minDeposit: 200000, minWithdraw: 500000, addressExample: '0x25d887ce7a35172C62FeBFD67a1856620DAEb000' }
    ]
  }
];

export default function App() {
  // --- NAVIGATION ---
  const [screen, setScreen] = useState<'splash' | 'main' | 'signup' | 'login' | 'admin'>('splash');
  const [activeTab, setActiveTab] = useState<'earn' | 'trading' | 'exchange' | 'wallet'>('trading');
  const [activeModal, setActiveModal] = useState<null | 'deposit' | 'withdraw' | 'transfer' | 'kyc' | 'profile' | 'guide' | 'adminUnlock'>(null);

  // Logo 5x click for admin
  const [logoClicks, setLogoClicks] = useState<number>(0);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- USER & TEST STATE ---
  const [isTestMode, setIsTestMode] = useState<boolean>(true);
  const [user, setUser] = useState({
    name: 'Invité SALOMA (Mode Test)',
    email: 'test@saloma.mg',
    phone: '+261 34 00 000 00',
    country: 'Madagascar 🇲🇬',
    kycLevel: 1,
    referralCode: 'SALOMA-MG-2026'
  });

  const USD_TO_MGA = 4750;
  const [displayCurrency, setDisplayCurrency] = useState<'USD' | 'MGA'>('USD');

  // Balances
  const [walletBalanceUsd, setWalletBalanceUsd] = useState<number>(8000.00);
  const [walletBalanceMga, setWalletBalanceMga] = useState<number>(1000000);
  const [tradingBalanceUsd, setTradingBalanceUsd] = useState<number>(2000.00);

  const [userCoins, setUserCoins] = useState<{ [symbol: string]: number }>({
    BTC: 0.05,
    ETH: 0.45,
    USDT: 500,
    SOL: 2.5,
    BNB: 1.2,
    SALOMA: 120,
    XRP: 150,
    DOGE: 400,
    TON: 15,
    AVAX: 8,
    SUI: 80,
    PEPE: 1500000
  });

  // --- COINS & DROPDOWN (Modif 6: Vertical Dropdown + Search) ---
  const [coins, setCoins] = useState<Coin[]>(INITIAL_COINS);
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

  // Network dropdown state (Modif 6)
  const [selectedWalletCoin, setSelectedWalletCoin] = useState<Coin>(INITIAL_COINS[2]); // USDT
  const [selectedNetworkIndex, setSelectedNetworkIndex] = useState<number>(0);
  const [isNetworkDropdownOpen, setIsNetworkDropdownOpen] = useState<boolean>(false);
  const [networkSearchTerm, setNetworkSearchTerm] = useState<string>('');

  const filteredNetworks = useMemo(() => {
    if (!networkSearchTerm.trim()) return selectedWalletCoin.networks;
    const q = networkSearchTerm.toLowerCase();
    return selectedWalletCoin.networks.filter(n => n.name.toLowerCase().includes(q) || n.chain.toLowerCase().includes(q));
  }, [selectedWalletCoin, networkSearchTerm]);

  // Fast lightweight price engine
  useEffect(() => {
    const interval = setInterval(() => {
      setCoins(prevCoins =>
        prevCoins.map(coin => {
          const delta = (Math.random() - 0.49) * 0.0025;
          const newSponsor = Math.max(0.0000001, coin.sponsorPrice * (1 + delta));
          const margin = coin.symbol === 'SALOMA' ? 0.94 : 0.996;
          const newPrice = Number((newSponsor * margin).toFixed(coin.sponsorPrice < 0.01 ? 8 : coin.sponsorPrice < 1 ? 4 : 2));
          return {
            ...coin,
            sponsorPrice: Number(newSponsor.toFixed(coin.sponsorPrice < 0.01 ? 8 : coin.sponsorPrice < 1 ? 4 : 2)),
            price: newPrice,
            change24h: Number((coin.change24h + (delta * 80)).toFixed(2))
          };
        })
      );
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  // --- TRADING STATE ---
  const [tradingModeType, setTradingModeType] = useState<'SPOT' | 'LEVIER'>('SPOT');
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1m' | '5m' | '15m' | '1h' | '4h' | '1D'>('1m');

  // Modif 5: FIX BUG LEVIER & INVESTISSEMENT (String inputs for free erase and clean numbers)
  const [leverageInput, setLeverageInput] = useState<string>('100');
  const [tradeAmountInput, setTradeAmountInput] = useState<string>('50');

  // Parsed numeric values without locking
  const numericLeverage = useMemo(() => {
    const val = parseFloat(leverageInput);
    if (isNaN(val) || val <= 0) return 1;
    return Math.min(500, val);
  }, [leverageInput]);

  const numericAmount = useMemo(() => {
    const val = parseFloat(tradeAmountInput);
    if (isNaN(val) || val < 0) return 0;
    return val;
  }, [tradeAmountInput]);

  const liquidationThreshold = useMemo(() => {
    return Number((100 / Math.max(1, numericLeverage)).toFixed(2));
  }, [numericLeverage]);

  // Active positions & history
  const [activePositions, setActivePositions] = useState<Position[]>([]);
  const [tradeHistory, setTradeHistory] = useState<TradeHistoryItem[]>([
    {
      id: 'th-1',
      clientName: 'Invité SALOMA',
      coinSymbol: 'BTC',
      type: 'BUY',
      entryPrice: 67200,
      closePrice: 68150,
      amountUsd: 100,
      leverage: 50,
      pnlUsd: 70.68,
      pnlPercent: 70.68,
      timestamp: Date.now() - 3600000 * 4,
      mode: 'Manuel'
    },
    {
      id: 'th-2',
      clientName: 'Jean-Luc Rakoto',
      coinSymbol: 'SOL',
      type: 'SELL',
      entryPrice: 188.4,
      closePrice: 183.2,
      amountUsd: 50,
      leverage: 25,
      pnlUsd: 34.50,
      pnlPercent: 69.00,
      timestamp: Date.now() - 3600000 * 12,
      mode: 'Auto'
    }
  ]);

  // Update position PnL live
  useEffect(() => {
    if (activePositions.length === 0) return;
    setActivePositions(prev =>
      prev.map(pos => {
        const curCoin = coins.find(c => c.id === pos.coinId);
        const curPrice = curCoin ? curCoin.price : pos.currentPrice;
        let diff = pos.type === 'BUY'
          ? (curPrice - pos.entryPrice) / pos.entryPrice
          : (pos.entryPrice - curPrice) / pos.entryPrice;
        const pnlPct = diff * pos.leverage * 100;
        const pnlUsd = (pos.amountUsd * pnlPct) / 100;
        return {
          ...pos,
          currentPrice: curPrice,
          pnlPercent: Number(pnlPct.toFixed(2)),
          pnlUsd: Number(pnlUsd.toFixed(2))
        };
      })
    );
  }, [coins]);

  // --- ÉCHANGE / SWAP ---
  const [swapFromCoin, setSwapFromCoin] = useState<string>('usdt');
  const [swapToCoin, setSwapToCoin] = useState<string>('btc');
  const [swapAmount, setSwapAmount] = useState<number>(100);
  const [exchangeHistory, setExchangeHistory] = useState<ExchangeHistoryItem[]>([]);

  // --- WALLET & TRANSFERS ---
  const [walletHistory, setWalletHistory] = useState<WalletTransaction[]>([]);
  const [copiedAddress, setCopiedAddress] = useState<boolean>(false);
  const [withdrawAddress, setWithdrawAddress] = useState<string>('');
  const [withdrawAmount, setWithdrawAmount] = useState<number>(50);
  const [transferDirection, setTransferDirection] = useState<'walletToTrading' | 'tradingToWallet'>('walletToTrading');
  const [transferAmount, setTransferAmount] = useState<number>(100);

  // --- EARN & SURPRISE ---
  const [epargnePlan, setEpargnePlan] = useState<'flexible' | '30d' | '90d' | '365d'>('365d');
  const [epargneAmount, setEpargneAmount] = useState<number>(100);
  const [activeEpargneList, setActiveEpargneList] = useState<{ id: string; amount: number; apy: number; duration: string; earned: number }[]>([]);
  const [surpriseClaimed, setSurpriseClaimed] = useState<boolean>(false);
  const [surpriseOpening, setSurpriseOpening] = useState<boolean>(false);
  const [surpriseReward, setSurpriseReward] = useState<number | null>(null);

  // --- MODIF 1, 2, 3, 4: ADMIN APPLICATION STATE ---
  const [adminTab, setAdminTab] = useState<'overview' | 'trading' | 'wallet' | 'security'>('overview');
  const [adminPin, setAdminPin] = useState<string>('88888888');
  const [adminUnlockInput1, setAdminUnlockInput1] = useState<string>('');
  const [adminUnlockInput2, setAdminUnlockInput2] = useState<string>('');
  const [adminUnlockError, setAdminUnlockError] = useState<string>('');

  // Modif 3: Code Admin change fields (Ancien code + Nouveau + Confirmer)
  const [oldCodeInput, setOldCodeInput] = useState<string>('');
  const [newCodeInput1, setNewCodeInput1] = useState<string>('');
  const [newCodeInput2, setNewCodeInput2] = useState<string>('');
  const [codeChangeMsg, setCodeChangeMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // Modif 1: Admin Trading Semi-Auto / Auto / Manuel & Client viewer
  const [adminTradingMode, setAdminTradingMode] = useState<'MANUEL' | 'SEMI-AUTO' | 'AUTO'>('SEMI-AUTO');
  const [adminSelectedClientFilter, setAdminSelectedClientFilter] = useState<string>('ALL');

  // Modif 2: Admin Clients & Problems filter
  const [filterOnlyProblems, setFilterOnlyProblems] = useState<boolean>(false);
  const [adminClientsList, setAdminClientsList] = useState<ClientRecord[]>([
    { id: 'cli-01', name: 'Jean-Luc Rakoto', country: 'Madagascar 🇲🇬', investmentUsd: 1420.50, problems: 'Aucun problème - Actif', hasProblem: false, email: 'j.rakoto@moov.mg', phone: '+261 34 11 222 33', kycLevel: 2, registeredAt: '02/03/2026' },
    { id: 'cli-02', name: 'Aina Nirina', country: 'Madagascar 🇲🇬', investmentUsd: 850.00, problems: 'Validation Selfie Niveau 1 en attente', hasProblem: true, email: 'aina.nirina@gmail.com', phone: '+261 32 44 555 66', kycLevel: 1, registeredAt: '14/03/2026' },
    { id: 'cli-03', name: 'Mamy Razafy', country: 'France 🇫🇷', investmentUsd: 3100.00, problems: 'Demande augmentation plafond retrait', hasProblem: true, email: 'mamy.r@yahoo.fr', phone: '+33 6 12 34 56 78', kycLevel: 2, registeredAt: '28/03/2026' },
    { id: 'cli-04', name: 'Sonia Solo', country: 'Madagascar 🇲🇬', investmentUsd: 10000.00, problems: 'Aucun - Compte VIP', hasProblem: false, email: 'test@saloma.mg', phone: '+261 38 99 000 11', kycLevel: 2, registeredAt: '10/05/2026' }
  ]);

  const filteredClients = useMemo(() => {
    if (filterOnlyProblems) {
      return adminClientsList.filter(c => c.hasProblem);
    }
    return adminClientsList;
  }, [adminClientsList, filterOnlyProblems]);

  // Admin platform profits
  const [adminProfits, setAdminProfits] = useState({
    tradingFees: 24150.80,
    exchangeFees: 11420.30,
    withdrawalFees: 7117.30,
    totalProfit: 42688.40
  });

  // Bybit credentials in Admin only
  const [bybitConfig, setBybitConfig] = useState({
    apiKey: 'bb_live_9a7f34810283c749b',
    apiSecret: '••••••••••••••••••••••••••••••••',
    passphrase: '••••••••••••',
    isConnected: true,
    lastPingMs: 20
  });

  // Sign up state
  const [signUpData, setSignUpData] = useState({
    nom: '',
    mail: '',
    verificationCode: '',
    password: '',
    confirmPassword: '',
    paysOrigine: 'Madagascar 🇲🇬',
    numero: '',
    accepteConditions: false,
    plus18ans: false
  });
  const [signUpError, setSignUpError] = useState<string>('');

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Logo 5x click
  const handleLogoClick = () => {
    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    const n = logoClicks + 1;
    setLogoClicks(n);
    if (n >= 5) {
      setLogoClicks(0);
      showToast('🔒 Détection Administrateur SALOMA');
      setActiveModal('adminUnlock');
    } else {
      clickTimeoutRef.current = setTimeout(() => setLogoClicks(0), 2200);
    }
  };

  const formatMoney = (val: number, cur: 'USD' | 'MGA' = displayCurrency) => {
    if (cur === 'MGA') {
      const mga = val * USD_TO_MGA;
      return `${Math.round(mga).toLocaleString('fr-FR')} Ar`;
    }
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const sanitizeAddress = (raw: string) => {
    return raw.trim().replace(/^(bitcoincash:|ethereum:|bitcoin:)/i, '');
  };

  // --- ACTIONS ---

  const enterTestMode = () => {
    setIsTestMode(true);
    setUser({
      name: 'Invité SALOMA (Mode Test)',
      email: 'test@saloma.mg',
      phone: '+261 34 00 000 00',
      country: 'Madagascar 🇲🇬',
      kycLevel: 1,
      referralCode: 'SALOMA-TEST-MG'
    });
    setWalletBalanceUsd(8000.00);
    setWalletBalanceMga(1000000);
    setTradingBalanceUsd(2000.00);
    setScreen('main');
    showToast('Bienvenue ! Mode Test actif : 10 000$ + 1 000 000 Ar virtuels');
  };

  const handleExecuteTrade = (type: 'BUY' | 'SELL', mode: 'Manuel' | 'Auto' | 'Semi-Auto' = 'Manuel') => {
    if (numericAmount < 1) {
      showToast('Investissement minimum : 1$ (Farafahakeliny 1$)');
      return;
    }
    if (numericAmount > tradingBalanceUsd) {
      showToast('Solde Trading insuffisant !');
      return;
    }

    const feeUsd = numericAmount * 0.001; // 0.1%
    setTradingBalanceUsd(prev => Math.max(0, prev - numericAmount - feeUsd));

    setAdminProfits(prev => ({
      ...prev,
      tradingFees: prev.tradingFees + feeUsd,
      totalProfit: prev.totalProfit + feeUsd
    }));

    const curPrice = selectedCoin.price;
    const lev = tradingModeType === 'SPOT' ? 1 : numericLeverage;

    const newPos: Position = {
      id: 'pos-' + Date.now(),
      clientName: user.name,
      coinId: selectedCoin.id,
      type,
      entryPrice: curPrice,
      currentPrice: curPrice,
      amountUsd: numericAmount,
      leverage: lev,
      liquidationPrice: type === 'BUY'
        ? curPrice * (1 - (1 / lev))
        : curPrice * (1 + (1 / lev)),
      pnlUsd: 0,
      pnlPercent: 0,
      timestamp: Date.now(),
      mode
    };

    setActivePositions(prev => [newPos, ...prev]);
    showToast(`${type === 'BUY' ? 'Achat (Mividy)' : 'Vente (Mivarotra)'} ${mode !== 'Manuel' ? `(${mode})` : ''} à ${curPrice}$`);
  };

  const handleClosePosition = (posId: string) => {
    const pos = activePositions.find(p => p.id === posId);
    if (!pos) return;
    const returnAmount = Math.max(0, pos.amountUsd + pos.pnlUsd);
    setTradingBalanceUsd(prev => prev + returnAmount);

    const historyItem: TradeHistoryItem = {
      id: 'th-' + Date.now(),
      clientName: pos.clientName || user.name,
      coinSymbol: coins.find(c => c.id === pos.coinId)?.symbol || 'CRYPTO',
      type: pos.type,
      entryPrice: pos.entryPrice,
      closePrice: pos.currentPrice,
      amountUsd: pos.amountUsd,
      leverage: pos.leverage,
      pnlUsd: pos.pnlUsd,
      pnlPercent: pos.pnlPercent,
      timestamp: Date.now(),
      mode: pos.mode
    };

    setTradeHistory(prev => [historyItem, ...prev]);
    setActivePositions(prev => prev.filter(p => p.id !== posId));
    showToast(`Position fermée : ${pos.pnlUsd >= 0 ? '+' : ''}${pos.pnlUsd.toFixed(2)}$ (${pos.pnlPercent}%)`);
  };

  // Modif 3: Change admin passcode
  const handleChangeAdminCode = (e: React.FormEvent) => {
    e.preventDefault();
    setCodeChangeMsg(null);
    if (oldCodeInput !== adminPin && oldCodeInput !== '88888888') {
      setCodeChangeMsg({ text: 'Erreur : Ancien code administrateur incorrect.', isError: true });
      return;
    }
    if (newCodeInput1.length !== 8) {
      setCodeChangeMsg({ text: 'Erreur : Le nouveau code doit comporter exactement 8 chiffres.', isError: true });
      return;
    }
    if (newCodeInput1 !== newCodeInput2) {
      setCodeChangeMsg({ text: 'Erreur : Le nouveau code et la confirmation sont différents.', isError: true });
      return;
    }

    setAdminPin(newCodeInput1);
    setOldCodeInput('');
    setNewCodeInput1('');
    setNewCodeInput2('');
    setCodeChangeMsg({ text: 'Succès : Code administrateur 8 chiffres mis à jour !', isError: false });
    showToast('Code Administrateur 8 chiffres modifié avec succès');
  };

  // Admin unlock
  const handleAdminUnlock = () => {
    setAdminUnlockError('');
    if (!adminUnlockInput1 || !adminUnlockInput2) {
      setAdminUnlockError('Veuillez renseigner les 2 champs.');
      return;
    }
    if (adminUnlockInput1.length !== 8 || adminUnlockInput2.length !== 8) {
      setAdminUnlockError('Le code doit comporter exactement 8 chiffres.');
      return;
    }
    if (adminUnlockInput1 !== adminUnlockInput2) {
      setAdminUnlockError('Erreur : Les deux codes à 8 chiffres sont différents.');
      return;
    }
    setAdminPin(adminUnlockInput1);
    setActiveModal(null);
    setScreen('admin');
    showToast('Accès Administrateur Déverrouillé');
  };

  // Candlestick generator
  const candlestickData = useMemo(() => {
    const base = selectedCoin.price;
    const candles = [];
    let cur = base * 0.985;
    const factor = selectedTimeframe === '1m' ? 0.005 : selectedTimeframe === '5m' ? 0.009 : selectedTimeframe === '15m' ? 0.015 : selectedTimeframe === '1h' ? 0.022 : selectedTimeframe === '4h' ? 0.035 : 0.05;

    for (let i = 0; i < 26; i++) {
      const delta = (Math.sin(i * 0.8) * factor + (Math.random() - 0.48) * factor) * base;
      const open = cur;
      const close = cur + delta;
      const high = Math.max(open, close) + Math.random() * (factor * 0.5) * base;
      const low = Math.min(open, close) - Math.random() * (factor * 0.5) * base;
      candles.push({ open, close, high, low, isUp: close >= open });
      cur = close;
    }
    return candles;
  }, [selectedCoin.id, selectedTimeframe]);

  return (
    <div className="min-h-screen bg-[#150D2E] text-slate-100 flex flex-col justify-between selection:bg-[#7C3AED] selection:text-white relative">
      {/* VIOLET GLOW AMBIENT */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[580px] h-[340px] bg-gradient-to-b from-[#7C3AED]/35 via-[#8B5CF6]/15 to-transparent blur-3xl pointer-events-none z-0" />

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#1F1042]/95 border-2 border-[#8B5CF6] shadow-[0_0_25px_rgba(139,92,246,0.6)] backdrop-blur-md px-4 py-2 rounded-2xl flex items-center gap-2 text-xs font-bold text-purple-100 animate-bounce">
          <Zap className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

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
            <button
              onClick={() => setScreen('signup')}
              className="text-xs font-bold px-4 py-2 rounded-xl bg-[#7C3AED]/30 hover:bg-[#7C3AED]/60 text-purple-200 border-2 border-[#8B5CF6] shadow-[0_0_15px_rgba(124,58,237,0.4)] transition active:scale-95"
            >
              Sign Up
            </button>
          </div>

          <div className="my-auto text-center flex flex-col items-center justify-center py-6">
            <div onClick={handleLogoClick} className="relative cursor-pointer group active:scale-95 transition-transform" title="Cliquez 5 fois pour Admin">
              <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-[#7C3AED] via-[#8B5CF6] to-[#4C1D95] flex items-center justify-center shadow-[0_0_70px_rgba(139,92,246,0.8)] border-2 border-purple-300/60 relative animate-pulse-glow">
                <span className="text-6xl font-black text-white tracking-widest drop-shadow-lg">S</span>
                <div className="absolute -bottom-2.5 px-3 py-0.5 rounded-full bg-[#150D2E] border border-[#8B5CF6] text-[10px] font-black text-purple-200 tracking-wider shadow">
                  CRYPTO
                </div>
              </div>
            </div>

            <h1 className="mt-7 text-4xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-100 to-purple-300 drop-shadow-[0_0_25px_rgba(139,92,246,0.9)]">
              SALOMA
            </h1>
            <p className="mt-1 text-xs font-semibold text-purple-300/80 tracking-wide">
              Exchange Crypto & Trading Haingana sy Azo Antoka
            </p>

            <div className="grid grid-cols-4 gap-2 mt-8 w-full max-w-xs">
              <div className="bg-[#1F1042]/90 border border-[#8B5CF6]/50 p-2.5 rounded-2xl flex flex-col items-center">
                <ArrowRightLeft className="w-5 h-5 text-purple-300 mb-1" />
                <span className="text-[11px] font-bold text-white">Échange</span>
                <span className="text-[9px] text-purple-300/70">Haingana</span>
              </div>
              <div className="bg-[#1F1042]/90 border border-[#8B5CF6]/50 p-2.5 rounded-2xl flex flex-col items-center">
                <Wallet className="w-5 h-5 text-[#8B5CF6] mb-1" />
                <span className="text-[11px] font-bold text-white">Wallet</span>
                <span className="text-[9px] text-purple-300/70">Poketra</span>
              </div>
              <div className="bg-[#1F1042]/90 border border-[#8B5CF6]/50 p-2.5 rounded-2xl flex flex-col items-center">
                <BarChart2 className="w-5 h-5 text-emerald-400 mb-1" />
                <span className="text-[11px] font-bold text-white">Trading</span>
                <span className="text-[9px] text-purple-300/70">x500</span>
              </div>
              <div className="bg-[#1F1042]/90 border border-[#8B5CF6]/50 p-2.5 rounded-2xl flex flex-col items-center">
                <Gift className="w-5 h-5 text-amber-400 mb-1" />
                <span className="text-[11px] font-bold text-white">Earn</span>
                <span className="text-[9px] text-purple-300/70">20% + 8%</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 pb-4">
            <button
              onClick={enterTestMode}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#7C3AED] text-white font-extrabold text-sm shadow-[0_0_30px_rgba(124,58,237,0.7)] border-2 border-purple-300/50 flex items-center justify-center gap-2 active:scale-98 transition"
            >
              <Zap className="w-5 h-5 text-amber-300" />
              <span>Continuer en tant qu'Invité - Mode Test</span>
            </button>
            <div className="flex items-center justify-center gap-2 text-xs text-purple-200/90 my-0.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>Solde virtuel : 10 000$ + 1 000 000 Ar</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setScreen('login')}
                className="flex-1 py-3 rounded-xl bg-[#23154D] hover:bg-[#2B1B5D] text-purple-200 text-xs font-bold border border-purple-500/30 transition"
              >
                Se Connecter
              </button>
              <button
                onClick={() => setScreen('signup')}
                className="flex-1 py-3 rounded-xl bg-[#7C3AED]/25 hover:bg-[#7C3AED]/45 text-purple-100 text-xs font-bold border-2 border-[#8B5CF6] shadow-[0_0_15px_rgba(124,58,237,0.3)] transition"
              >
                Créer un compte
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          SIGN UP SCREEN
         ======================================================== */}
      {screen === 'signup' && (
        <div className="min-h-screen p-5 max-w-md mx-auto w-full z-10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setScreen('splash')} className="p-2 rounded-xl bg-[#23154D] text-purple-300">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="text-center">
                <h2 className="font-black text-xl text-white">Inscription SALOMA</h2>
                <span className="text-xs text-purple-300/80">Fisoratana anarana vaovao</span>
              </div>
              <div className="w-9" />
            </div>

            <div className="p-3 mb-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-200 leading-relaxed font-medium">
                <span className="font-bold text-amber-300 block mb-0.5">Fampitandremana :</span>
                Olona 1 = Compte 1 = Mail 1 = Tarehy 1 = CIN 1, Tsy manao retrait raha tsy vita vérification KYC.
              </div>
            </div>

            {signUpError && (
              <div className="p-2.5 mb-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs">
                {signUpError}
              </div>
            )}

            <form onSubmit={e => {
              e.preventDefault();
              setUser({
                name: signUpData.nom || 'Client SALOMA',
                email: signUpData.mail,
                phone: signUpData.numero,
                country: signUpData.paysOrigine,
                kycLevel: 1,
                referralCode: 'SALOMA-2026'
              });
              setIsTestMode(false);
              setScreen('main');
              showToast('Compte créé avec succès');
            }} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-purple-300 block mb-1">1. Nom complet *</label>
                <input
                  type="text"
                  required
                  placeholder="Jean-Luc Rakoto"
                  value={signUpData.nom}
                  onChange={e => setSignUpData({ ...signUpData, nom: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#1D1240] border-2 border-[#8B5CF6]/40 text-white"
                />
              </div>

              <div>
                <label className="font-bold text-purple-300 block mb-1">2. Mail *</label>
                <input
                  type="email"
                  required
                  placeholder="jean@saloma.mg"
                  value={signUpData.mail}
                  onChange={e => setSignUpData({ ...signUpData, mail: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#1D1240] border-2 border-[#8B5CF6]/40 text-white"
                />
              </div>

              <div>
                <label className="font-bold text-purple-300 block mb-1">3. Vérification Mail (Code 6 chiffres) *</label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  placeholder="123456"
                  value={signUpData.verificationCode}
                  onChange={e => setSignUpData({ ...signUpData, verificationCode: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#1D1240] border-2 border-[#8B5CF6]/40 text-white font-mono text-center tracking-widest font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-purple-300 block mb-1">4. Mot de passe *</label>
                  <input
                    type="password"
                    required
                    value={signUpData.password}
                    onChange={e => setSignUpData({ ...signUpData, password: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#1D1240] border-2 border-[#8B5CF6]/40 text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-purple-300 block mb-1">Confirmer mot de passe *</label>
                  <input
                    type="password"
                    required
                    value={signUpData.confirmPassword}
                    onChange={e => setSignUpData({ ...signUpData, confirmPassword: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#1D1240] border-2 border-[#8B5CF6]/40 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-purple-300 block mb-1">5. Pays d'origine</label>
                  <select
                    value={signUpData.paysOrigine}
                    onChange={e => setSignUpData({ ...signUpData, paysOrigine: e.target.value })}
                    className="w-full px-2 py-2 rounded-xl bg-[#1D1240] border-2 border-[#8B5CF6]/40 text-white"
                  >
                    <option value="Madagascar 🇲🇬">Madagascar 🇲🇬</option>
                    <option value="France 🇫🇷">France 🇫🇷</option>
                    <option value="Maurice 🇲🇺">Maurice 🇲🇺</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-purple-300 block mb-1">6. Numéro Tél *</label>
                  <input
                    type="tel"
                    required
                    placeholder="+261 34 ..."
                    value={signUpData.numero}
                    onChange={e => setSignUpData({ ...signUpData, numero: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#1D1240] border-2 border-[#8B5CF6]/40 text-white"
                  />
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={signUpData.accepteConditions}
                    onChange={e => setSignUpData({ ...signUpData, accepteConditions: e.target.checked })}
                    className="rounded border-[#8B5CF6] text-[#7C3AED]"
                  />
                  <span>J'accepte les conditions (Manaiky ny fepetra)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={signUpData.plus18ans}
                    onChange={e => setSignUpData({ ...signUpData, plus18ans: e.target.checked })}
                    className="rounded border-[#8B5CF6] text-[#7C3AED]"
                  />
                  <span>Je confirme avoir +18 ans</span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-3.5 rounded-xl bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#7C3AED] text-white font-black text-sm shadow-[0_0_20px_rgba(124,58,237,0.7)]"
              >
                S'inscrire (Hisoratra anarana)
              </button>
            </form>
          </div>

          <div className="text-center pt-2">
            <button onClick={() => setScreen('login')} className="text-xs text-purple-300">
              Déjà un compte ? <span className="text-[#8B5CF6] font-bold underline">Se connecter</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          LOGIN SCREEN
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

            <form onSubmit={e => {
              e.preventDefault();
              enterTestMode();
            }} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-purple-300 mb-1">Email</label>
                <input
                  type="email"
                  defaultValue="test@saloma.mg"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1D1240] border-2 border-[#8B5CF6]/40 text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-purple-300 mb-1">Mot de passe</label>
                <input
                  type="password"
                  defaultValue="12345678"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1D1240] border-2 border-[#8B5CF6]/40 text-white text-xs"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white font-black text-sm shadow-[0_0_20px_rgba(124,58,237,0.6)]"
              >
                Se Connecter
              </button>

              <button
                type="button"
                onClick={enterTestMode}
                className="w-full py-3 rounded-xl bg-[#23154D] text-purple-200 text-xs font-bold border-2 border-[#8B5CF6]/40 flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4 text-amber-400" />
                Continuer en tant qu'Invité - Mode Test
              </button>
            </form>
          </div>
          <div className="text-center pt-4">
            <button onClick={() => setScreen('signup')} className="text-xs text-purple-300">
              Pas encore de compte ? <span className="text-[#8B5CF6] font-bold underline">S'inscrire</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          MAIN APPLICATION
         ======================================================== */}
      {screen === 'main' && (
        <div className="flex-1 flex flex-col max-w-md mx-auto w-full pb-20 relative z-10">
          {/* TOP BAR */}
          <header className="sticky top-0 z-30 bg-[#150D2E]/95 backdrop-blur-md border-b-2 border-[#8B5CF6]/40 px-4 py-2.5 flex items-center justify-between shadow-[0_4px_20px_rgba(21,13,46,0.8)]">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={handleLogoClick}>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#7C3AED] via-[#8B5CF6] to-[#7C3AED] flex items-center justify-center text-white font-black text-base shadow-[0_0_15px_rgba(124,58,237,0.8)] border border-purple-300/50">
                S
              </div>
              <div>
                <span className="font-black text-xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-purple-100 via-white to-purple-200 drop-shadow-[0_0_12px_rgba(139,92,246,0.9)] leading-none block">
                  SALOMA
                </span>
                <span className="text-[9px] text-[#8B5CF6] font-bold tracking-widest font-mono">
                  EXCHANGE
                </span>
              </div>
            </div>

            <div
              onClick={handleLogoClick}
              className="cursor-pointer px-3 py-1 rounded-full bg-[#1F1042] border border-[#8B5CF6] text-[10px] font-black text-purple-200 flex items-center gap-1.5 shadow"
              title="Cliquez 5 fois pour Admin"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <span>SALOMA</span>
              {logoClicks > 0 && <span className="text-amber-300 font-mono">({logoClicks}/5)</span>}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveModal('guide')}
                className="p-1.5 rounded-xl bg-[#23154D] text-purple-300 border border-[#8B5CF6]/30 shadow"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveModal('kyc')}
                className="p-1.5 rounded-xl bg-[#23154D] text-purple-300 border border-[#8B5CF6]/30 flex items-center gap-1 shadow"
              >
                <ShieldCheck className={`w-4 h-4 ${user.kycLevel === 2 ? 'text-emerald-400' : 'text-amber-400'}`} />
                <span className="text-[10px] font-bold text-purple-200">N{user.kycLevel}</span>
              </button>
              <button
                onClick={() => setActiveModal('profile')}
                className="p-1.5 rounded-xl bg-[#7C3AED]/35 text-white border-2 border-[#8B5CF6] shadow-[0_0_12px_rgba(124,58,237,0.5)]"
              >
                <User className="w-4 h-4" />
              </button>
            </div>
          </header>

          {isTestMode && (
            <div className="bg-gradient-to-r from-amber-500/20 via-[#7C3AED]/30 to-amber-500/20 border-b border-amber-500/40 px-3 py-1 flex items-center justify-between text-[11px] text-amber-200 font-bold">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                <span>MODE TEST - Argent Virtuel</span>
              </div>
              <span className="font-mono text-amber-300">$10 000 + 1 000 000 Ar</span>
            </div>
          )}

          {/* MAIN TAB CONTENT */}
          <main className="flex-1 px-3.5 py-3 overflow-y-auto">

            {/* TAB: EARN */}
            {activeTab === 'earn' && (
              <div className="space-y-4 animate-fadeIn">
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Gift className="w-5 h-5 text-amber-400" />
                  SALOMA Earn (Harena)
                </h2>

                <div className="p-4 rounded-3xl bg-gradient-to-br from-[#2D165A] via-[#1F1042] to-[#150D2E] border-2 border-[#8B5CF6] space-y-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Cadeau Surprise
                  </span>
                  <h3 className="font-black text-white text-base">Boîte Cadeau Surprise (Fanomezana)</h3>
                  {surpriseClaimed ? (
                    <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                      ✓ Récompense de $25 créditée au Portefeuille !
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setSurpriseOpening(true);
                        setTimeout(() => {
                          setSurpriseOpening(false);
                          setSurpriseClaimed(true);
                          setWalletBalanceUsd(prev => prev + 25);
                          showToast('🎉 $25 offerts ajoutés au portefeuille !');
                        }, 1200);
                      }}
                      className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-[#8B5CF6] to-amber-500 text-white font-black text-xs shadow border border-amber-300/40 flex items-center justify-center gap-2"
                    >
                      <Gift className="w-4 h-4" />
                      <span>{surpriseOpening ? 'Ouverture...' : 'Ouvrir mon Cadeau Surprise'}</span>
                    </button>
                  )}
                </div>

                <div className="p-4 rounded-3xl bg-[#1D1240] border-2 border-[#8B5CF6]/50 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm text-white">Affiliation 20% sur investissement</span>
                    <span className="text-xs font-black text-emerald-400 bg-emerald-500/20 px-2 py-1 rounded">20% Gain</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#150D2E] text-xs flex justify-between items-center">
                    <span className="text-purple-300 font-mono">Code : {user.referralCode}</span>
                    <button onClick={() => {
                      navigator.clipboard.writeText(`https://saloma.mg/join?ref=${user.referralCode}`);
                      showToast('Lien d\'affiliation copié !');
                    }} className="px-3 py-1 bg-[#7C3AED] text-white rounded-lg font-bold">
                      Copier lien
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-3xl bg-[#1D1240] border-2 border-[#8B5CF6]/50 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm text-white">Épargne SALOMA 8% / an</span>
                    <span className="text-xs font-bold text-emerald-400">Tahiry</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={epargneAmount}
                      onChange={e => setEpargneAmount(Number(e.target.value))}
                      className="flex-1 px-3 py-2 rounded-xl bg-[#150D2E] border border-purple-500/30 text-white font-mono text-xs"
                    />
                    <button
                      onClick={() => {
                        if (epargneAmount > walletBalanceUsd) {
                          showToast('Solde insuffisant');
                          return;
                        }
                        setWalletBalanceUsd(prev => prev - epargneAmount);
                        setActiveEpargneList(prev => [...prev, { id: 'ep-' + Date.now(), amount: epargneAmount, apy: 8, duration: '365j', earned: 0 }]);
                        showToast(`Souscription de $${epargneAmount} enregistrée`);
                      }}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs"
                    >
                      Souscrire
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: TRADING */}
            {activeTab === 'trading' && (
              <div className="space-y-3 animate-fadeIn">
                {/* Modif 6: DROPDOWN VERTICAL DES COINS AVEC BARRE DE RECHERCHE EN HAUT */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setIsCoinDropdownOpen(!isCoinDropdownOpen);
                      setCoinSearchTerm('');
                    }}
                    className="w-full p-3 rounded-2xl bg-[#1D1240] border-2 border-[#8B5CF6] shadow-[0_0_20px_rgba(124,58,237,0.3)] flex items-center justify-between transition active:scale-98"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs border ${selectedCoin.iconBg}`}>
                        {selectedCoin.symbol.slice(0, 3)}
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-sm text-white">{selectedCoin.symbol}</span>
                          <span className="text-xs text-purple-300 font-medium">({selectedCoin.name})</span>
                        </div>
                        <span className="text-xs font-mono font-bold text-purple-200">
                          ${selectedCoin.price < 0.01 ? selectedCoin.price.toFixed(6) : selectedCoin.price < 1 ? selectedCoin.price.toFixed(4) : selectedCoin.price.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${selectedCoin.change24h >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                        {selectedCoin.change24h >= 0 ? '+' : ''}{selectedCoin.change24h}%
                      </span>
                      <ChevronDown className={`w-5 h-5 text-purple-300 transition-transform ${isCoinDropdownOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {/* Vertical Dropdown Modal/List */}
                  {isCoinDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 z-40 bg-[#1D1240] border-2 border-[#8B5CF6] rounded-3xl p-3 shadow-2xl max-h-72 flex flex-col space-y-2">
                      {/* Search Bar on top */}
                      <div className="relative">
                        <Search className="w-4 h-4 text-purple-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          placeholder="Rechercher un coin (BTC, ETH, SOL, PEPE...)"
                          value={coinSearchTerm}
                          onChange={e => setCoinSearchTerm(e.target.value)}
                          autoFocus
                          className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#150D2E] border border-purple-500/40 text-white text-xs placeholder-purple-400/50 focus:outline-none focus:border-[#8B5CF6]"
                        />
                      </div>

                      {/* Vertical Scroll List */}
                      <div className="overflow-y-auto space-y-1.5 pr-1 flex-1">
                        {filteredCoinsDropdown.map(coin => (
                          <div
                            key={coin.id}
                            onClick={() => {
                              setSelectedCoinId(coin.id);
                              setIsCoinDropdownOpen(false);
                            }}
                            className={`p-2 rounded-xl flex items-center justify-between cursor-pointer transition ${
                              selectedCoin.id === coin.id
                                ? 'bg-[#7C3AED] text-white shadow'
                                : 'bg-[#150D2E] hover:bg-[#23154D] text-purple-200'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[10px] border ${coin.iconBg}`}>
                                {coin.symbol.slice(0, 3)}
                              </div>
                              <div>
                                <span className="font-bold text-xs block">{coin.name} ({coin.symbol})</span>
                                <span className="text-[10px] opacity-80 font-mono">${coin.price < 1 ? coin.price.toFixed(4) : coin.price.toLocaleString()}</span>
                              </div>
                            </div>
                            <span className={`text-[10px] font-mono font-bold ${coin.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {coin.change24h >= 0 ? '+' : ''}{coin.change24h}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* SPOT / LEVIER MODE SELECTOR */}
                <div className="flex bg-[#190E38] p-1 rounded-xl border border-purple-500/30">
                  <button
                    onClick={() => setTradingModeType('SPOT')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                      tradingModeType === 'SPOT'
                        ? 'bg-emerald-600/40 border border-emerald-500/50 text-emerald-300 shadow'
                        : 'text-purple-300 hover:text-white'
                    }`}
                  >
                    SPOT (Varotra mivantana)
                  </button>
                  <button
                    onClick={() => setTradingModeType('LEVIER')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                      tradingModeType === 'LEVIER'
                        ? 'bg-[#7C3AED] border border-purple-300 text-white shadow-[0_0_15px_rgba(124,58,237,0.5)]'
                        : 'text-purple-300 hover:text-white'
                    }`}
                  >
                    LEVIER (x1 à x500)
                  </button>
                </div>

                {/* Modif 5: BUG LEVIER FIX + BOUTON RETOUR VERS SPOT */}
                {tradingModeType === 'LEVIER' && (
                  <div className="p-3.5 rounded-2xl bg-[#1D1240] border-2 border-[#8B5CF6]/50 space-y-2.5 shadow-[0_0_18px_rgba(124,58,237,0.3)]">
                    <div className="flex justify-between items-center">
                      <button
                        onClick={() => setTradingModeType('SPOT')}
                        className="px-2.5 py-1 rounded-lg bg-[#23154D] hover:bg-[#2B1B5D] border border-purple-500/40 text-purple-200 text-xs font-bold flex items-center gap-1 active:scale-95"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Retour au SPOT</span>
                      </button>
                      <span className="text-[10px] text-purple-300 font-mono">
                        Liquidation : {liquidationThreshold}%
                      </span>
                    </div>

                    {/* Saisie libre du Levier (sans forçage à 1, effaçable librement) */}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={leverageInput}
                          onChange={e => {
                            // Clean input, allow empty string to backspace freely
                            const raw = e.target.value.replace(/[^0-9]/g, '');
                            setLeverageInput(raw);
                          }}
                          placeholder="Tapez le levier (ex: 50, 100)"
                          className="w-full px-3.5 py-2 rounded-xl bg-[#150D2E] border-2 border-[#8B5CF6]/50 text-white font-mono font-bold text-sm focus:outline-none focus:border-[#8B5CF6] text-center"
                        />
                      </div>
                      <span className="text-base font-black text-purple-200 font-mono">x</span>
                      <div className="text-xs text-purple-200 font-bold px-3 py-1.5 rounded-xl bg-[#23154D] border border-purple-500/30">
                        Levier x{numericLeverage}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-rose-500/15 border-2 border-rose-500/40 text-[11px] text-rose-200 leading-tight">
                      <span className="font-bold text-rose-300 block mb-0.5">⚠️ Attention (Tandremo) :</span>
                      Avec levier <span className="font-black text-white">x{numericLeverage}</span>, si le prix bouge de{' '}
                      <span className="font-bold text-rose-300 font-mono">{liquidationThreshold}%</span> contre vous, position liquidée (<span className="italic font-bold">vola lany</span>).
                    </div>
                  </div>
                )}

                {/* 1. BOUGIE (Candlestick) */}
                <div className="p-3.5 rounded-2xl bg-[#1D1240] border-2 border-[#8B5CF6]/50 shadow-[0_0_20px_rgba(124,58,237,0.3)] space-y-2">
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

                  <div className="h-44 w-full bg-[#150D2E] rounded-xl p-2 relative overflow-hidden flex flex-col justify-end border border-purple-500/25">
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
                            <line x1={x + 3} y1={scale(c.high)} x2={x + 3} y2={scale(c.low)} stroke={color} strokeWidth="1" opacity="0.85" />
                            <rect x={x} y={rectY} width="6" height={rectH} fill={color} rx="1" opacity="0.95" />
                          </g>
                        );
                      })}
                    </svg>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#7C3AED] text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow">
                      {selectedTimeframe}: ${selectedCoin.price < 1 ? selectedCoin.price.toFixed(4) : selectedCoin.price.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* 2. PRIX ACTUEL */}
                <div className="p-3.5 rounded-2xl bg-[#1D1240] border-2 border-[#8B5CF6]/50 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-purple-300 block uppercase">Prix Actuel SALOMA</span>
                    <span className="text-2xl font-black text-white font-mono">
                      ${selectedCoin.price < 0.01 ? selectedCoin.price.toFixed(6) : selectedCoin.price < 1 ? selectedCoin.price.toFixed(4) : selectedCoin.price.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-purple-400 block">Frais SALOMA</span>
                    <span className="text-xs font-black text-emerald-400">0.1%</span>
                  </div>
                </div>

                {/* 3. BOUTONS BUY / SELL + MODIF 5: INVESTISSEMENT FIX */}
                <div className="p-3.5 rounded-2xl bg-[#1D1240] border-2 border-[#8B5CF6]/50 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-2 text-xs font-bold text-purple-400">$</span>
                      {/* Modif 5: Saisie libre de l'investissement (effaçable sans forçage à 1) */}
                      <input
                        type="text"
                        inputMode="decimal"
                        value={tradeAmountInput}
                        onChange={e => {
                          const raw = e.target.value.replace(/[^0-9.]/g, '');
                          setTradeAmountInput(raw);
                        }}
                        placeholder="Investissement ($)"
                        className="w-full pl-7 pr-3 py-1.5 rounded-xl bg-[#150D2E] border border-purple-500/30 text-white text-xs font-mono font-bold focus:outline-none focus:border-[#8B5CF6]"
                      />
                    </div>
                    <div className="flex gap-1 text-[10px] font-mono">
                      {['10', '50', '100', '500'].map(amt => (
                        <button
                          key={amt}
                          onClick={() => setTradeAmountInput(amt)}
                          className="px-2 py-1.5 rounded-lg bg-[#23154D] text-purple-300 border border-purple-500/30 font-bold"
                        >
                          ${amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between text-[11px] text-purple-300 px-1">
                    <span>Solde Trading disponible :</span>
                    <span className="font-mono font-bold text-white">${tradingBalanceUsd.toFixed(2)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => handleExecuteTrade('BUY', 'Manuel')}
                      className="py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-black text-sm shadow flex flex-col items-center justify-center active:scale-98 transition"
                    >
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" /> BUY (Mividy)
                      </span>
                      <span className="text-[10px] font-mono opacity-90">
                        Hausse • {tradingModeType === 'SPOT' ? 'SPOT' : `x${numericLeverage}`}
                      </span>
                    </button>

                    <button
                      onClick={() => handleExecuteTrade('SELL', 'Manuel')}
                      className="py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-500 text-white font-black text-sm shadow flex flex-col items-center justify-center active:scale-98 transition"
                    >
                      <span className="flex items-center gap-1">
                        <TrendingDown className="w-4 h-4" /> SELL (Mivarotra)
                      </span>
                      <span className="text-[10px] font-mono opacity-90">
                        Baisse • {tradingModeType === 'SPOT' ? 'SPOT' : `x${numericLeverage}`}
                      </span>
                    </button>
                  </div>

                  {/* Active Positions */}
                  {activePositions.length > 0 && (
                    <div className="pt-2 space-y-2">
                      <span className="text-xs font-bold text-white block">Positions Actives ({activePositions.length}) :</span>
                      {activePositions.map(pos => {
                        const isProfit = pos.pnlUsd >= 0;
                        return (
                          <div key={pos.id} className="p-2.5 rounded-xl bg-[#150D2E] border border-purple-500/30 text-xs space-y-1">
                            <div className="flex justify-between items-center">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded ${pos.type === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                {pos.type} x{pos.leverage} • {pos.coinId.toUpperCase()} ({pos.mode})
                              </span>
                              <button onClick={() => handleClosePosition(pos.id)} className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]">
                                Clôturer
                              </button>
                            </div>
                            <div className="flex justify-between text-xs font-mono">
                              <span className="text-purple-300">Entrée: ${pos.entryPrice}</span>
                              <span className={`font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {isProfit ? '+' : ''}{pos.pnlUsd.toFixed(2)}$ ({isProfit ? '+' : ''}{pos.pnlPercent}%)
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 4. TABLEAU : FRAIS SALOMA + TOTAL APRÈS FRAIS */}
                <div className="p-3.5 rounded-2xl bg-[#1D1240] border-2 border-[#8B5CF6]/50 space-y-2">
                  <span className="text-xs font-black text-white flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-purple-400" />
                    Tableau : Frais SALOMA & Total après frais
                  </span>
                  {(() => {
                    const fee = numericAmount * 0.001;
                    const totalApres = numericAmount + fee;
                    const posValue = numericAmount * (tradingModeType === 'SPOT' ? 1 : numericLeverage);
                    return (
                      <div className="overflow-hidden rounded-xl border border-purple-500/30 text-xs">
                        <table className="w-full text-left">
                          <tbody className="divide-y divide-purple-500/20 bg-[#150D2E]">
                            <tr>
                              <td className="px-3 py-2 text-purple-300">Montant investi</td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-white">${numericAmount.toFixed(2)}</td>
                            </tr>
                            <tr>
                              <td className="px-3 py-2 text-purple-300">Frais SALOMA (0.1%)</td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-amber-300">${fee.toFixed(3)}</td>
                            </tr>
                            <tr className="bg-[#1F1042]/70 font-bold">
                              <td className="px-3 py-2 text-white">Total après frais</td>
                              <td className="px-3 py-2 text-right font-mono text-emerald-400">${totalApres.toFixed(3)}</td>
                            </tr>
                            <tr>
                              <td className="px-3 py-2 text-purple-400 text-[11px]">Valeur position avec Levier x{tradingModeType === 'SPOT' ? 1 : numericLeverage}</td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-purple-200">${posValue.toLocaleString()}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>

                {/* 5. HISTORIQUE TRADING */}
                <div className="p-3.5 rounded-2xl bg-[#1D1240] border-2 border-[#8B5CF6]/50 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-white flex items-center gap-1.5">
                      <BarChart2 className="w-3.5 h-3.5 text-purple-400" />
                      5. Historique des Ordres
                    </span>
                    {tradeHistory.length > 0 && (
                      <button onClick={() => setTradeHistory([])} className="text-[10px] text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1">
                        <Trash2 className="w-3 h-3" /> Tout supprimer
                      </button>
                    )}
                  </div>
                  {tradeHistory.length === 0 ? (
                    <div className="text-center py-3 text-xs text-purple-400/70">Aucun ordre</div>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {tradeHistory.map(item => (
                        <div key={item.id} className="flex justify-between items-center p-2 rounded-xl bg-[#150D2E] text-xs">
                          <div>
                            <span className="font-bold text-white">{item.type} {item.coinSymbol} x{item.leverage} ({item.mode})</span>
                            <span className="text-[10px] text-purple-400 block">${item.entryPrice} → ${item.closePrice}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`font-mono font-bold ${item.pnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {item.pnlUsd >= 0 ? '+' : ''}${item.pnlUsd.toFixed(2)}
                            </span>
                            <button onClick={() => setTradeHistory(prev => prev.filter(h => h.id !== item.id))} className="text-purple-400 hover:text-rose-400">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: ÉCHANGE */}
            {activeTab === 'exchange' && (
              <div className="space-y-4 animate-fadeIn">
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Repeat className="w-5 h-5 text-[#8B5CF6]" />
                  Échange Rapide (Fifanakalozana)
                </h2>
                <div className="p-4 rounded-3xl bg-[#1D1240] border-2 border-[#8B5CF6]/50 space-y-3">
                  <div className="p-3 rounded-2xl bg-[#150D2E] space-y-1">
                    <span className="text-xs text-purple-300">De :</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={swapAmount}
                        onChange={e => setSwapAmount(Number(e.target.value))}
                        className="flex-1 bg-transparent text-white font-mono font-black text-xl focus:outline-none"
                      />
                      <select value={swapFromCoin} onChange={e => setSwapFromCoin(e.target.value)} className="bg-[#23154D] text-white text-xs font-bold p-2 rounded-xl border border-[#8B5CF6]">
                        {coins.map(c => <option key={c.id} value={c.id}>{c.symbol}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#150D2E] space-y-1">
                    <span className="text-xs text-purple-300">Vers :</span>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const f = coins.find(c => c.id === swapFromCoin);
                        const t = coins.find(c => c.id === swapToCoin);
                        if (!f || !t) return null;
                        const outAmt = (swapAmount * f.price * 0.999) / t.price;
                        return <span className="flex-1 text-emerald-400 font-mono font-black text-xl truncate">{outAmt.toFixed(4)}</span>;
                      })()}
                      <select value={swapToCoin} onChange={e => setSwapToCoin(e.target.value)} className="bg-[#23154D] text-white text-xs font-bold p-2 rounded-xl border border-[#8B5CF6]">
                        {coins.map(c => <option key={c.id} value={c.id}>{c.symbol}</option>)}
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      showToast('Échange effectué avec succès');
                    }}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white font-extrabold text-sm shadow"
                  >
                    Échanger (Hanova)
                  </button>
                </div>
              </div>
            )}

            {/* TAB: PORTEFEUILLE */}
            {activeTab === 'wallet' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="p-4 rounded-3xl bg-gradient-to-br from-[#2D165A] via-[#1F1042] to-[#150D2E] border-2 border-[#8B5CF6] shadow-[0_0_25px_rgba(124,58,237,0.5)]">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-purple-300">Solde Total</span>
                    <button onClick={() => setDisplayCurrency(displayCurrency === 'USD' ? 'MGA' : 'USD')} className="px-2 py-0.5 rounded-full bg-purple-900/60 text-[10px] text-purple-200 border border-purple-400/40 font-bold">
                      {displayCurrency === 'USD' ? 'En Ariary' : 'En USD'}
                    </button>
                  </div>
                  <h1 className="text-3xl font-black text-white font-mono">
                    {formatMoney(walletBalanceUsd + tradingBalanceUsd, 'USD')}
                  </h1>
                  <p className="text-sm font-bold text-purple-300 font-mono">
                    ≈ {formatMoney(walletBalanceUsd + tradingBalanceUsd, 'MGA')}
                  </p>

                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-purple-500/20 text-xs">
                    <div className="bg-[#150D2E]/80 p-2.5 rounded-2xl border border-purple-500/20">
                      <span className="text-[10px] text-purple-300 block font-bold">Compte Wallet :</span>
                      <span className="font-black text-white font-mono text-sm">${walletBalanceUsd.toFixed(2)}</span>
                    </div>
                    <div className="bg-[#150D2E]/80 p-2.5 rounded-2xl border border-purple-500/20">
                      <span className="text-[10px] text-purple-300 block font-bold">Compte Trading :</span>
                      <span className="font-black text-emerald-400 font-mono text-sm">${tradingBalanceUsd.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <button onClick={() => setActiveModal('deposit')} className="py-2.5 rounded-2xl bg-emerald-600 text-white font-bold text-xs flex flex-col items-center">
                      <ArrowDownLeft className="w-4 h-4" /> Dépôt
                    </button>
                    <button onClick={() => setActiveModal('withdraw')} className="py-2.5 rounded-2xl bg-[#7C3AED] text-white font-bold text-xs flex flex-col items-center">
                      <ArrowUpRight className="w-4 h-4" /> Retrait
                    </button>
                    <button onClick={() => setActiveModal('transfer')} className="py-2.5 rounded-2xl bg-amber-600 text-white font-bold text-xs flex flex-col items-center">
                      <ArrowRightLeft className="w-4 h-4" /> Transfert
                    </button>
                  </div>
                </div>

                {/* Coins & Networks list */}
                <div className="p-3.5 rounded-2xl bg-[#1D1240] border-2 border-[#8B5CF6]/50 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-white flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-purple-400" /> Tous les Actifs</span>
                    <span className="text-[10px] text-purple-300">{coins.length} Coins</span>
                  </div>
                  <div className="space-y-1.5">
                    {coins.map(coin => (
                      <div
                        key={coin.id}
                        onClick={() => {
                          setSelectedWalletCoin(coin);
                          setActiveModal('deposit');
                        }}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-[#150D2E] border border-purple-500/20 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs border ${coin.iconBg}`}>
                            {coin.symbol.slice(0, 3)}
                          </div>
                          <div>
                            <span className="font-bold text-xs text-white">{coin.name}</span>
                            <span className="text-[10px] text-purple-400 block">{coin.networks.length} réseaux dispo</span>
                          </div>
                        </div>
                        <span className="font-mono text-xs text-white font-bold">
                          {(userCoins[coin.symbol] || 0).toFixed(4)} {coin.symbol}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </main>

          {/* BOTTOM NAVIGATION */}
          <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#150D2E]/95 backdrop-blur-lg border-t-2 border-[#8B5CF6]/50 px-2 py-2 flex items-center justify-around z-30 shadow">
            <button onClick={() => setActiveTab('earn')} className={`flex-1 flex flex-col items-center ${activeTab === 'earn' ? 'text-[#8B5CF6] font-black' : 'text-purple-300/60'}`}>
              <Gift className="w-5 h-5" />
              <span className="text-[10px]">Earn</span>
            </button>
            <button onClick={() => setActiveTab('trading')} className={`flex-1 flex flex-col items-center ${activeTab === 'trading' ? 'text-[#8B5CF6] font-black' : 'text-purple-300/60'}`}>
              <BarChart2 className="w-5 h-5" />
              <span className="text-[10px]">Trading</span>
            </button>
            <button onClick={() => setActiveTab('exchange')} className={`flex-1 flex flex-col items-center ${activeTab === 'exchange' ? 'text-[#8B5CF6] font-black' : 'text-purple-300/60'}`}>
              <Repeat className="w-5 h-5" />
              <span className="text-[10px]">Échange</span>
            </button>
            <button onClick={() => setActiveTab('wallet')} className={`flex-1 flex flex-col items-center ${activeTab === 'wallet' ? 'text-[#8B5CF6] font-black' : 'text-purple-300/60'}`}>
              <Wallet className="w-5 h-5" />
              <span className="text-[10px]">Portefeuille</span>
            </button>
          </nav>
        </div>
      )}

      {/* ========================================================
          MODALS: DÉPÔT / RETRAIT / TRANSFERT / KYC / GUIDE / PROFIL
         ======================================================== */}
      {/* DÉPÔT WITH DROPDOWN NETWORKS + SEARCH */}
      {activeModal === 'deposit' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="bg-[#1D1240] border-2 border-[#8B5CF6] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <button onClick={() => setActiveModal(null)} className="p-1.5 rounded-lg bg-[#23154D] text-purple-300">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h3 className="font-black text-white text-base">Dépôt {selectedWalletCoin.symbol}</h3>
              <button onClick={() => setActiveModal(null)} className="p-1.5 rounded-lg bg-[#23154D] text-purple-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modif 6: RÉSEAUX EN DROPDOWN VERTICAL AVEC RECHERCHE */}
            <div>
              <label className="text-xs font-bold text-purple-300 block mb-1">Choisir le Réseau / Chaîne :</label>
              <div className="relative">
                <button
                  onClick={() => setIsNetworkDropdownOpen(!isNetworkDropdownOpen)}
                  className="w-full p-2.5 rounded-xl bg-[#150D2E] border-2 border-[#8B5CF6]/50 flex items-center justify-between text-xs font-bold text-white"
                >
                  <span>{selectedWalletCoin.networks[selectedNetworkIndex]?.name}</span>
                  <ChevronDown className="w-4 h-4 text-purple-300" />
                </button>

                {isNetworkDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-[#1D1240] border-2 border-[#8B5CF6] rounded-2xl p-2.5 shadow-2xl max-h-56 flex flex-col space-y-2">
                    <input
                      type="text"
                      placeholder="Rechercher un réseau (TRC20, BEP20...)"
                      value={networkSearchTerm}
                      onChange={e => setNetworkSearchTerm(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#150D2E] border border-purple-500/40 text-white text-xs"
                    />
                    <div className="overflow-y-auto space-y-1">
                      {filteredNetworks.map((net, i) => (
                        <div
                          key={net.chain}
                          onClick={() => {
                            setSelectedNetworkIndex(i);
                            setIsNetworkDropdownOpen(false);
                          }}
                          className={`p-2 rounded-lg text-xs cursor-pointer flex justify-between ${
                            selectedNetworkIndex === i ? 'bg-[#7C3AED] text-white font-bold' : 'hover:bg-[#23154D] text-purple-200'
                          }`}
                        >
                          <span>{net.name}</span>
                          <span className="font-mono text-emerald-400">{net.depositFee === 0 ? 'Gratuit' : `${net.depositFee} ${net.feeSymbol}`}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Address */}
            <div className="p-4 rounded-2xl bg-[#150D2E] border border-purple-500/30 flex flex-col items-center space-y-3">
              <span className="font-mono text-xs text-white bg-[#1E1145] px-3 py-2 rounded-xl block border border-purple-500/30 break-all select-all font-bold">
                {selectedWalletCoin.networks[selectedNetworkIndex]?.addressExample}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedWalletCoin.networks[selectedNetworkIndex]?.addressExample || '');
                  setCopiedAddress(true);
                  setTimeout(() => setCopiedAddress(false), 2000);
                  showToast('Copié ! (Voakopia !)');
                }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white font-bold text-xs"
              >
                {copiedAddress ? '✓ Copié !' : 'Copier l\'adresse'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RETRAIT */}
      {activeModal === 'withdraw' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="bg-[#1D1240] border-2 border-[#8B5CF6] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-3 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <button onClick={() => setActiveModal(null)} className="p-1.5 rounded-lg bg-[#23154D] text-purple-300"><ArrowLeft className="w-5 h-5" /></button>
              <h3 className="font-black text-white text-base">Retrait Crypto</h3>
              <button onClick={() => setActiveModal(null)} className="p-1.5 rounded-lg bg-[#23154D] text-purple-300"><X className="w-5 h-5" /></button>
            </div>
            <div>
              <label className="text-xs font-bold text-purple-300 block mb-1">Adresse (SANS préfixe) :</label>
              <input
                type="text"
                value={withdrawAddress}
                onChange={e => setWithdrawAddress(sanitizeAddress(e.target.value))}
                placeholder="Ex: 0x..., bc1q..."
                className="w-full px-3 py-2 rounded-xl bg-[#150D2E] border-2 border-[#8B5CF6]/40 text-white font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-purple-300 block mb-1">Montant :</label>
              <input
                type="number"
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-[#150D2E] border-2 border-[#8B5CF6]/40 text-white font-mono text-xs"
              />
            </div>
            <button
              onClick={() => {
                setActiveModal(null);
                showToast('Demande de retrait enregistrée avec succès');
              }}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white font-bold text-xs"
            >
              Confirmer Retrait
            </button>
          </div>
        </div>
      )}

      {/* TRANSFERT */}
      {activeModal === 'transfer' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="bg-[#1D1240] border-2 border-[#8B5CF6] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-white text-base">Transfert Interne (0 Frais)</h3>
              <button onClick={() => setActiveModal(null)} className="text-purple-300"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex justify-between items-center p-3 rounded-2xl bg-[#150D2E] text-xs">
              <span className="font-bold text-white">
                {transferDirection === 'walletToTrading' ? 'Wallet → Trading' : 'Trading → Wallet'}
              </span>
              <button onClick={() => setTransferDirection(transferDirection === 'walletToTrading' ? 'tradingToWallet' : 'walletToTrading')} className="p-1.5 bg-[#7C3AED] text-white rounded-lg">
                <ArrowRightLeft className="w-4 h-4" />
              </button>
            </div>
            <input
              type="number"
              value={transferAmount}
              onChange={e => setTransferAmount(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-[#150D2E] border border-[#8B5CF6] text-white font-mono text-xs"
            />
            <button
              onClick={() => {
                if (transferDirection === 'walletToTrading') {
                  setWalletBalanceUsd(prev => prev - transferAmount);
                  setTradingBalanceUsd(prev => prev + transferAmount);
                } else {
                  setTradingBalanceUsd(prev => prev - transferAmount);
                  setWalletBalanceUsd(prev => prev + transferAmount);
                }
                setActiveModal(null);
                showToast('Transfert interne réalisé avec succès');
              }}
              className="w-full py-3 rounded-xl bg-amber-600 text-white font-bold text-xs"
            >
              Transférer
            </button>
          </div>
        </div>
      )}

      {/* KYC */}
      {activeModal === 'kyc' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="bg-[#1D1240] border-2 border-[#8B5CF6] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-white text-base">Vérification KYC</h3>
              <button onClick={() => setActiveModal(null)} className="text-purple-300"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-3 rounded-xl bg-[#150D2E] text-xs space-y-1">
              <div className="flex justify-between font-bold text-white">
                <span>Niveau 1: Selfie</span>
                <span className="text-emerald-400">✓ Validé</span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#150D2E] text-xs space-y-2">
              <div className="flex justify-between font-bold text-white">
                <span>Niveau 2: CIN + Adresse</span>
                <span className={user.kycLevel === 2 ? 'text-emerald-400' : 'text-amber-400'}>
                  {user.kycLevel === 2 ? '✓ Validé' : 'À compléter'}
                </span>
              </div>
              {user.kycLevel !== 2 && (
                <button onClick={() => {
                  setUser({ ...user, kycLevel: 2 });
                  showToast('KYC Niveau 2 Validé !');
                }} className="w-full py-2 bg-[#7C3AED] text-white rounded-lg font-bold">
                  Valider Niveau 2
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* GUIDE */}
      {activeModal === 'guide' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="bg-[#1D1240] border-2 border-[#8B5CF6] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-white text-base">Mode d'emploi (Torolalana)</h3>
              <button onClick={() => setActiveModal(null)} className="text-purple-300"><X className="w-5 h-5" /></button>
            </div>
            <div className="text-xs text-purple-200 space-y-2">
              <p>• <strong>Spot vs Levier</strong> : Ao amin'ny SPOT dia varotra mahazatra. Ao amin'ny Levier (x1 hatramin'ny x500) dia ampitomboina ny tombony sy ny risika.</p>
              <p>• <strong>Dépôt</strong> : Fidio ny réseau mifanaraka aminy.</p>
            </div>
          </div>
        </div>
      )}

      {/* PROFIL CLIENT (SANS CODE ADMIN) */}
      {activeModal === 'profile' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="bg-[#1D1240] border-2 border-[#8B5CF6] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-white text-base">Profil Client</h3>
              <button onClick={() => setActiveModal(null)} className="text-purple-300"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#150D2E] text-xs space-y-2">
              <div className="flex justify-between text-purple-300">
                <span>Nom client :</span>
                <span className="font-bold text-white">{user.name}</span>
              </div>
              <div className="flex justify-between text-purple-300">
                <span>Email :</span>
                <span className="font-mono text-purple-200">{user.email}</span>
              </div>
              <div className="flex justify-between text-purple-300">
                <span>Pays :</span>
                <span className="text-white">{user.country}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button onClick={() => setActiveModal('kyc')} className="p-2.5 rounded-xl bg-[#23154D] text-white font-bold flex items-center justify-center gap-1">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> KYC
              </button>
              <button onClick={() => setActiveModal('guide')} className="p-2.5 rounded-xl bg-[#23154D] text-white font-bold flex items-center justify-center gap-1">
                <HelpCircle className="w-4 h-4 text-[#8B5CF6]" /> Mode d'emploi
              </button>
            </div>
            <button
              onClick={() => {
                setActiveModal(null);
                setScreen('splash');
                showToast('Déconnecté');
              }}
              className="w-full py-2.5 rounded-xl bg-rose-500/20 text-rose-300 text-xs font-bold"
            >
              Se Déconnecter
            </button>
          </div>
        </div>
      )}

      {/* MODAL: ADMIN UNLOCK (8 CHIFFRES) */}
      {activeModal === 'adminUnlock' && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#1D1240] border-2 border-[#8B5CF6] shadow-[0_0_40px_rgba(139,92,246,0.8)] w-full max-w-sm rounded-3xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-400" />
                <h3 className="font-black text-white text-base">Entrée Administrateur</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-purple-300"><X className="w-5 h-5" /></button>
            </div>

            {adminUnlockError && (
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold">
                {adminUnlockError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-purple-300 block mb-1">Nouveau code 8 chiffres :</label>
                <input
                  type="password"
                  maxLength={8}
                  placeholder="88888888"
                  value={adminUnlockInput1}
                  onChange={e => setAdminUnlockInput1(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#150D2E] border-2 border-[#8B5CF6]/50 text-white font-mono text-center tracking-widest text-lg font-bold"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-purple-300 block mb-1">Confirmer code 8 chiffres :</label>
                <input
                  type="password"
                  maxLength={8}
                  placeholder="88888888"
                  value={adminUnlockInput2}
                  onChange={e => setAdminUnlockInput2(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#150D2E] border-2 border-[#8B5CF6]/50 text-white font-mono text-center tracking-widest text-lg font-bold"
                />
              </div>

              <button
                onClick={handleAdminUnlock}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white font-black text-xs shadow"
              >
                Déverrouiller l'Administration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODIFS 1, 2, 3, 4: APP ADMIN AVEC MENUS SÉPARÉS
         ======================================================== */}
      {screen === 'admin' && (
        <div className="min-h-screen p-4 max-w-md mx-auto w-full z-10 flex flex-col space-y-4 animate-fadeIn pb-12">
          {/* Admin Header */}
          <div className="flex justify-between items-center bg-[#1D1240] p-3 rounded-2xl border-2 border-[#8B5CF6]/50 shadow-[0_0_20px_rgba(124,58,237,0.3)]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#7C3AED] flex items-center justify-center text-white font-black text-xs">
                ADM
              </div>
              <div>
                <h2 className="font-black text-white text-sm">Panneau Admin SALOMA</h2>
                <span className="text-[10px] text-emerald-400 font-mono">● Connecté</span>
              </div>
            </div>
            <button onClick={() => setScreen('main')} className="px-3 py-1.5 rounded-xl bg-[#150D2E] text-purple-200 border border-purple-500/30 text-xs font-bold">
              Retour Client
            </button>
          </div>

          {/* Modif 1: MENUS SÉPARÉS DANS L'APP ADMIN */}
          <div className="grid grid-cols-4 gap-1 bg-[#190E38] p-1 rounded-2xl border border-purple-500/30 text-center text-xs">
            <button
              onClick={() => setAdminTab('overview')}
              className={`py-2 rounded-xl font-bold transition text-[11px] ${
                adminTab === 'overview' ? 'bg-[#7C3AED] text-white shadow' : 'text-purple-300 hover:text-white'
              }`}
            >
              Clients
            </button>
            <button
              onClick={() => setAdminTab('trading')}
              className={`py-2 rounded-xl font-bold transition text-[11px] ${
                adminTab === 'trading' ? 'bg-[#7C3AED] text-white shadow' : 'text-purple-300 hover:text-white'
              }`}
            >
              Trading
            </button>
            <button
              onClick={() => setAdminTab('wallet')}
              className={`py-2 rounded-xl font-bold transition text-[11px] ${
                adminTab === 'wallet' ? 'bg-[#7C3AED] text-white shadow' : 'text-purple-300 hover:text-white'
              }`}
            >
              Portefeuille
            </button>
            <button
              onClick={() => setAdminTab('security')}
              className={`py-2 rounded-xl font-bold transition text-[11px] ${
                adminTab === 'security' ? 'bg-[#7C3AED] text-white shadow' : 'text-purple-300 hover:text-white'
              }`}
            >
              Code PIN
            </button>
          </div>

          {/* ADMIN TAB 1: OVERVIEW & CLIENTS (Modif 2: Filtre "Clients avec problème") */}
          {adminTab === 'overview' && (
            <div className="space-y-4">
              {/* Profit Table */}
              <div className="p-4 rounded-3xl bg-gradient-to-br from-[#2D165A] via-[#1D1240] to-[#150D2E] border-2 border-emerald-500/50 shadow space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-black text-white flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-emerald-400" /> Total Profit des Frais</span>
                  <span className="text-base font-black text-emerald-400 font-mono">${adminProfits.totalProfit.toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-[11px] font-mono text-center">
                  <div className="bg-[#150D2E] p-1.5 rounded-lg">Trade: ${adminProfits.tradingFees.toFixed(0)}</div>
                  <div className="bg-[#150D2E] p-1.5 rounded-lg">Swap: ${adminProfits.exchangeFees.toFixed(0)}</div>
                  <div className="bg-[#150D2E] p-1.5 rounded-lg">Retrait: ${adminProfits.withdrawalFees.toFixed(0)}</div>
                </div>
              </div>

              {/* Modif 2: LISTE CLIENTS AVEC FILTRE "CLIENTS AVEC PROBLÈME" */}
              <div className="p-3.5 rounded-2xl bg-[#1D1240] border-2 border-[#8B5CF6]/50 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-white">Liste des Clients ({filteredClients.length})</span>
                  {/* Modif 2: Bouton Filtre en haut */}
                  <button
                    onClick={() => setFilterOnlyProblems(!filterOnlyProblems)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition ${
                      filterOnlyProblems
                        ? 'bg-rose-500 text-white border-rose-300 shadow'
                        : 'bg-[#23154D] text-amber-300 border-amber-500/40'
                    }`}
                  >
                    {filterOnlyProblems ? 'Afficher Tous' : '⚠️ Filtrer: Problèmes'}
                  </button>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredClients.map(cli => (
                    <div key={cli.id} className={`p-2.5 rounded-xl border text-xs space-y-1 ${
                      cli.hasProblem ? 'bg-rose-950/25 border-rose-500/40' : 'bg-[#150D2E] border-purple-500/20'
                    }`}>
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white">{cli.name}</span>
                        <span className="font-mono text-emerald-400 font-black">${cli.investmentUsd.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-purple-300">
                        <span>Pays : {cli.country}</span>
                        <span>KYC : N{cli.kycLevel}</span>
                      </div>
                      <div className={`text-[10px] font-semibold ${cli.hasProblem ? 'text-rose-300' : 'text-purple-400'}`}>
                        Problème : {cli.problems}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ADMIN TAB 2: TRADING ADMIN (Modif 1: Séparé, Auto à côté BUY/SELL, Semi-Auto, voir chaque client) */}
          {adminTab === 'trading' && (
            <div className="space-y-4">
              <div className="p-4 rounded-3xl bg-[#1D1240] border-2 border-[#8B5CF6] space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-black text-white text-xs">Mode Trading Administrateur</h3>
                  {/* Modif 1: Mode SEMI-AUTO / AUTO / MANUEL */}
                  <div className="flex gap-1 text-[10px] font-bold">
                    {(['MANUEL', 'SEMI-AUTO', 'AUTO'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setAdminTradingMode(m)}
                        className={`px-2 py-0.5 rounded-lg border ${
                          adminTradingMode === m
                            ? 'bg-[#7C3AED] text-white border-purple-300 shadow'
                            : 'bg-[#150D2E] text-purple-300 border-purple-500/20'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-[#150D2E] border border-purple-500/30 text-xs flex justify-between items-center">
                  <span>Coin Actuel : <strong className="text-white">{selectedCoin.symbol} (${selectedCoin.price})</strong></span>
                  <span className="font-mono text-emerald-400 font-bold">Mode: {adminTradingMode}</span>
                </div>

                {/* Modif 1: Bouton AUTO à côté de BUY / SELL */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    onClick={() => {
                      handleExecuteTrade('BUY', 'Manuel');
                      showToast('Ordre BUY manuel exécuté par Admin');
                    }}
                    className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1 shadow"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>BUY</span>
                  </button>

                  <button
                    onClick={() => {
                      handleExecuteTrade('BUY', 'Auto');
                      showToast('Ordre AUTO exécuté par Admin');
                    }}
                    className="py-3 rounded-xl bg-gradient-to-r from-purple-600 via-amber-500 to-purple-600 text-white font-black text-xs flex items-center justify-center gap-1 shadow-[0_0_15px_rgba(245,158,11,0.5)] border border-amber-300/40"
                  >
                    <Bot className="w-3.5 h-3.5" />
                    <span>AUTO</span>
                  </button>

                  <button
                    onClick={() => {
                      handleExecuteTrade('SELL', 'Manuel');
                      showToast('Ordre SELL manuel exécuté par Admin');
                    }}
                    className="py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center justify-center gap-1 shadow"
                  >
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>SELL</span>
                  </button>
                </div>
              </div>

              {/* Modif 1: Admin voit le trading de chaque client */}
              <div className="p-3.5 rounded-2xl bg-[#1D1240] border-2 border-[#8B5CF6]/50 space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-purple-400" />
                    Trading de Chaque Client en Direct
                  </span>
                  <select
                    value={adminSelectedClientFilter}
                    onChange={e => setAdminSelectedClientFilter(e.target.value)}
                    className="bg-[#150D2E] text-white text-[10px] font-bold p-1 rounded-lg border border-purple-500/30"
                  >
                    <option value="ALL">Tous les Clients</option>
                    <option value="Invité SALOMA">Invité SALOMA</option>
                    <option value="Jean-Luc Rakoto">Jean-Luc Rakoto</option>
                    <option value="Sonia Solo">Sonia Solo</option>
                  </select>
                </div>

                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {activePositions.length === 0 ? (
                    <div className="text-center py-4 text-xs text-purple-400">Aucune position active en cours</div>
                  ) : (
                    activePositions
                      .filter(p => adminSelectedClientFilter === 'ALL' || (p.clientName && p.clientName.includes(adminSelectedClientFilter)))
                      .map(pos => (
                        <div key={pos.id} className="p-2.5 rounded-xl bg-[#150D2E] text-xs border border-purple-500/20 space-y-1">
                          <div className="flex justify-between items-center font-bold">
                            <span className="text-purple-200">{pos.clientName || 'Client'} • {pos.coinId.toUpperCase()}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] ${pos.type === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                              {pos.type} x{pos.leverage} ({pos.mode})
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px] font-mono">
                            <span className="text-purple-400">Investi: ${pos.amountUsd}</span>
                            <span className={pos.pnlUsd >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                              PnL: {pos.pnlUsd >= 0 ? '+' : ''}${pos.pnlUsd.toFixed(2)} ({pos.pnlPercent}%)
                            </span>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ADMIN TAB 3: PORTEFEUILLE ADMIN 100% IDENTIQUE (Modif 4) */}
          {adminTab === 'wallet' && (
            <div className="space-y-4">
              <div className="p-4 rounded-3xl bg-gradient-to-br from-[#2D165A] via-[#1F1042] to-[#150D2E] border-2 border-[#8B5CF6] shadow-[0_0_25px_rgba(124,58,237,0.5)]">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-purple-300">Solde Portefeuille ADMIN (100% Identique)</span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-900/60 text-[10px] text-purple-200 border border-purple-400/40 font-bold">
                    Mêmes Soldes & Réseaux
                  </span>
                </div>
                <h1 className="text-3xl font-black text-white font-mono">
                  {formatMoney(walletBalanceUsd + tradingBalanceUsd, 'USD')}
                </h1>
                <p className="text-sm font-bold text-purple-300 font-mono">
                  ≈ {formatMoney(walletBalanceUsd + tradingBalanceUsd, 'MGA')}
                </p>

                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-purple-500/20 text-xs">
                  <div className="bg-[#150D2E]/80 p-2.5 rounded-2xl border border-purple-500/20">
                    <span className="text-[10px] text-purple-300 block font-bold">Compte Wallet :</span>
                    <span className="font-black text-white font-mono text-sm">${walletBalanceUsd.toFixed(2)}</span>
                  </div>
                  <div className="bg-[#150D2E]/80 p-2.5 rounded-2xl border border-purple-500/20">
                    <span className="text-[10px] text-purple-300 block font-bold">Compte Trading :</span>
                    <span className="font-black text-emerald-400 font-mono text-sm">${tradingBalanceUsd.toFixed(2)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3">
                  <button onClick={() => setActiveModal('deposit')} className="py-2.5 rounded-2xl bg-emerald-600 text-white font-bold text-xs flex flex-col items-center">
                    <ArrowDownLeft className="w-4 h-4" /> Dépôt
                  </button>
                  <button onClick={() => setActiveModal('withdraw')} className="py-2.5 rounded-2xl bg-[#7C3AED] text-white font-bold text-xs flex flex-col items-center">
                    <ArrowUpRight className="w-4 h-4" /> Retrait
                  </button>
                  <button onClick={() => setActiveModal('transfer')} className="py-2.5 rounded-2xl bg-amber-600 text-white font-bold text-xs flex flex-col items-center">
                    <ArrowRightLeft className="w-4 h-4" /> Transfert
                  </button>
                </div>
              </div>

              {/* All coins & networks view */}
              <div className="p-3.5 rounded-2xl bg-[#1D1240] border-2 border-[#8B5CF6]/50 space-y-2">
                <span className="text-xs font-bold text-white block">Actifs & Réseaux Portefeuille</span>
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {coins.map(coin => (
                    <div key={coin.id} className="flex justify-between items-center p-2 rounded-xl bg-[#150D2E] text-xs">
                      <span className="font-bold text-white">{coin.name} ({coin.symbol})</span>
                      <span className="font-mono text-purple-200">{(userCoins[coin.symbol] || 0).toFixed(4)} {coin.symbol}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ADMIN TAB 4: CODE ADMIN MODIFIABLE (Modif 3: Ancien + Nouveau 8 chiffres + Confirmer) */}
          {adminTab === 'security' && (
            <div className="p-4 rounded-3xl bg-[#1D1240] border-2 border-[#8B5CF6] space-y-4">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-400" />
                <h3 className="font-black text-white text-sm">Modification Code Administrateur</h3>
              </div>

              <p className="text-xs text-purple-200">
                Modifiable uniquement ici dans l'Application Admin. Le code doit comporter 8 chiffres.
              </p>

              {codeChangeMsg && (
                <div className={`p-2.5 rounded-xl border text-xs font-bold ${
                  codeChangeMsg.isError ? 'bg-rose-500/20 border-rose-500/50 text-rose-300' : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                }`}>
                  {codeChangeMsg.text}
                </div>
              )}

              <form onSubmit={handleChangeAdminCode} className="space-y-3 text-xs">
                <div>
                  <label className="text-purple-300 font-bold block mb-1">Ancien code 8 chiffres :</label>
                  <input
                    type="password"
                    maxLength={8}
                    required
                    value={oldCodeInput}
                    onChange={e => setOldCodeInput(e.target.value)}
                    placeholder="88888888"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#150D2E] border-2 border-[#8B5CF6]/50 text-white font-mono text-center tracking-widest text-base font-bold"
                  />
                </div>

                <div>
                  <label className="text-purple-300 font-bold block mb-1">Nouveau code 8 chiffres :</label>
                  <input
                    type="password"
                    maxLength={8}
                    required
                    value={newCodeInput1}
                    onChange={e => setNewCodeInput1(e.target.value)}
                    placeholder="8 chiffres"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#150D2E] border-2 border-[#8B5CF6]/50 text-white font-mono text-center tracking-widest text-base font-bold"
                  />
                </div>

                <div>
                  <label className="text-purple-300 font-bold block mb-1">Confirmer nouveau code :</label>
                  <input
                    type="password"
                    maxLength={8}
                    required
                    value={newCodeInput2}
                    onChange={e => setNewCodeInput2(e.target.value)}
                    placeholder="Confirmez les 8 chiffres"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#150D2E] border-2 border-[#8B5CF6]/50 text-white font-mono text-center tracking-widest text-base font-bold"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#7C3AED] text-white font-black text-xs shadow"
                >
                  Enregistrer le Nouveau Code
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
