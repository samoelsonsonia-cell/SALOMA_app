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

export type ApiProviderId = 'binance' | 'bybit' | 'okx';

export interface ApiProviderStatus {
  id: ApiProviderId;
  label: string;
  enabled: boolean;
  online: boolean;
  latencyMs: number;
  lastSync: number;
  errorCount: number;
}

export interface Coin {
  id: string;
  symbol: string;
  name: string;
  sponsorPrice: number; // Exact live exchange price (Bybit / OKX / Binance)
  price: number; // PRIX SALOMA = PRIX EXCHANGE EXACT (1:1 via WebSocket)
  change24h: number;
  high24h: number;
  low24h: number;
  volume24hUsd: number;
  iconBg: string;
  iconColor: string;
  bestSource: ApiProviderId;
  apiPrices: Record<ApiProviderId, number>;
  networks: CoinNetwork[];
}

export const TEST_MIN_USD = 0.5;

export function computeMinCoinForUsd(
  priceUsd: number,
  symbol?: string,
  targetUsd = TEST_MIN_USD
): number {
  const cleanSym = String(symbol || '').toUpperCase().trim();
  if (cleanSym === 'USDT') return Number(targetUsd.toFixed(2));
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) return 0;

  const raw = targetUsd / priceUsd;
  if (raw >= 1000) return Math.round(raw);
  if (raw >= 1) return Number(raw.toFixed(2));
  if (raw >= 0.01) return Number(raw.toFixed(4));
  if (raw >= 0.0001) return Number(raw.toFixed(5));
  return Number(raw.toFixed(7));
}

export function formatMinCoinQty(qty: number): string {
  if (!Number.isFinite(qty) || qty <= 0) return '0';
  if (qty >= 1000) return Math.round(qty).toString();
  if (qty >= 1) return Number(qty.toFixed(2)).toString();
  if (qty >= 0.01) return Number(qty.toFixed(4)).toString();
  if (qty >= 0.0001) return Number(qty.toFixed(5)).toString();
  return qty.toFixed(7).replace(/0+$/, '').replace(/\.$/, '');
}

const RAW_INITIAL_COINS: Coin[] = [
  {
    id: 'btc',
    symbol: 'BTC',
    name: 'Bitcoin',
    sponsorPrice: 68420.0,
    price: 68420.0,
    change24h: 3.42,
    high24h: 69180.0,
    low24h: 66350.0,
    volume24hUsd: 2480000000,
    iconBg: 'bg-amber-500/25 text-amber-300 border-amber-400/40 shadow-[0_0_10px_rgba(245,158,11,0.3)]',
    iconColor: 'text-amber-400',
    bestSource: 'bybit',
    apiPrices: { binance: 68420.0, bybit: 68420.0, okx: 68420.0 },
    networks: [
      { chain: 'BTC-Native', name: 'Bitcoin (Native SegWit bech32)', depositFee: 0, withdrawFee: 0.00025, feeSymbol: 'BTC', minDeposit: 0.0001, minWithdraw: 0.0005, addressExample: 'bc1q9h6x743j2y0z5v4km89x2026saloma' },
      { chain: 'Taproot', name: 'Bitcoin (Taproot bech32m)', depositFee: 0, withdrawFee: 0.0002, feeSymbol: 'BTC', minDeposit: 0.0001, minWithdraw: 0.0005, addressExample: 'bc1p5d7rjq7g6e8z8e9q8v8026saloma' },
      { chain: 'Lightning', name: 'Lightning Network (Instantané)', depositFee: 0, withdrawFee: 0.00001, feeSymbol: 'BTC', minDeposit: 0.00001, minWithdraw: 0.0001, addressExample: 'lnbc10u1p3saloma9823610924' },
      { chain: 'BEP20', name: 'BNB Smart Chain (BEP20)', depositFee: 0, withdrawFee: 0.00008, feeSymbol: 'BTC', minDeposit: 0.0002, minWithdraw: 0.0004, addressExample: '0x71C8A331c2612745345719329705E32bA' },
      { chain: 'ERC20', name: 'Ethereum ERC20 (WBTC)', depositFee: 0, withdrawFee: 0.00035, feeSymbol: 'BTC', minDeposit: 0.0005, minWithdraw: 0.001, addressExample: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' }
    ]
  },
  {
    id: 'eth',
    symbol: 'ETH',
    name: 'Ethereum',
    sponsorPrice: 3580.0,
    price: 3580.0,
    change24h: 2.15,
    high24h: 3640.0,
    low24h: 3490.0,
    volume24hUsd: 1320000000,
    iconBg: 'bg-indigo-500/25 text-indigo-300 border-indigo-400/40 shadow-[0_0_10px_rgba(99,102,241,0.3)]',
    iconColor: 'text-indigo-400',
    bestSource: 'bybit',
    apiPrices: { binance: 3580.0, bybit: 3580.0, okx: 3580.0 },
    networks: [
      { chain: 'ERC20', name: 'Ethereum Mainnet (ERC20)', depositFee: 0, withdrawFee: 0.0035, feeSymbol: 'ETH', minDeposit: 0.005, minWithdraw: 0.01, addressExample: '0x992B28B3eB9229555C09F6eF83A8992026' },
      { chain: 'Arbitrum', name: 'Arbitrum One (L2 Rapide)', depositFee: 0, withdrawFee: 0.0006, feeSymbol: 'ETH', minDeposit: 0.001, minWithdraw: 0.002, addressExample: '0x992B28B3eB9229555C09F6eF83A8992026' },
      { chain: 'Optimism', name: 'OP Mainnet (Optimism)', depositFee: 0, withdrawFee: 0.0006, feeSymbol: 'ETH', minDeposit: 0.001, minWithdraw: 0.002, addressExample: '0x992B28B3eB9229555C09F6eF83A8992026' },
      { chain: 'Base', name: 'Base Network (L2)', depositFee: 0, withdrawFee: 0.0004, feeSymbol: 'ETH', minDeposit: 0.001, minWithdraw: 0.002, addressExample: '0x992B28B3eB9229555C09F6eF83A8992026' },
      { chain: 'BEP20', name: 'BNB Smart Chain (BEP20)', depositFee: 0, withdrawFee: 0.0008, feeSymbol: 'ETH', minDeposit: 0.002, minWithdraw: 0.005, addressExample: '0x992B28B3eB9229555C09F6eF83A8992026' },
      { chain: 'Polygon', name: 'Polygon POS (WETH)', depositFee: 0, withdrawFee: 0.0005, feeSymbol: 'ETH', minDeposit: 0.001, minWithdraw: 0.002, addressExample: '0x992B28B3eB9229555C09F6eF83A8992026' }
    ]
  },
  {
    id: 'usdt',
    symbol: 'USDT',
    name: 'Tether USD',
    sponsorPrice: 1.0,
    price: 1.0,
    change24h: 0.01,
    high24h: 1.001,
    low24h: 0.999,
    volume24hUsd: 5400000000,
    iconBg: 'bg-emerald-500/25 text-emerald-300 border-emerald-400/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]',
    iconColor: 'text-emerald-400',
    bestSource: 'bybit',
    apiPrices: { binance: 1.0, bybit: 1.0, okx: 1.0 },
    networks: [
      { chain: 'TRC20', name: 'TRON (TRC20 - Rapide & Populaire)', depositFee: 0, withdrawFee: 1.2, feeSymbol: 'USDT', minDeposit: 5, minWithdraw: 5, addressExample: 'TJX9zK2B7YmNQ9sLo2481A2026SalomaTRC' },
      { chain: 'BEP20', name: 'BNB Smart Chain (BEP20 - Frais bas)', depositFee: 0, withdrawFee: 0.35, feeSymbol: 'USDT', minDeposit: 5, minWithdraw: 5, addressExample: '0x882a4C82b28F03294E83b271391781290' },
      { chain: 'ERC20', name: 'Ethereum (ERC20 Mainnet)', depositFee: 0, withdrawFee: 4.5, feeSymbol: 'USDT', minDeposit: 10, minWithdraw: 20, addressExample: '0x43bFa92104192bC18E9712aD90176882a' },
      { chain: 'Polygon', name: 'Polygon POS Network', depositFee: 0, withdrawFee: 0.4, feeSymbol: 'USDT', minDeposit: 5, minWithdraw: 5, addressExample: '0x43bFa92104192bC18E9712aD90176882a' },
      { chain: 'Solana', name: 'Solana (SPL Token)', depositFee: 0, withdrawFee: 0.8, feeSymbol: 'USDT', minDeposit: 5, minWithdraw: 5, addressExample: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk9817' },
      { chain: 'Arbitrum', name: 'Arbitrum One (L2)', depositFee: 0, withdrawFee: 0.5, feeSymbol: 'USDT', minDeposit: 5, minWithdraw: 5, addressExample: '0x43bFa92104192bC18E9712aD90176882a' },
      { chain: 'Optimism', name: 'OP Mainnet (L2)', depositFee: 0, withdrawFee: 0.5, feeSymbol: 'USDT', minDeposit: 5, minWithdraw: 5, addressExample: '0x43bFa92104192bC18E9712aD90176882a' },
      { chain: 'AVAX-C', name: 'Avalanche C-Chain', depositFee: 0, withdrawFee: 0.6, feeSymbol: 'USDT', minDeposit: 5, minWithdraw: 5, addressExample: '0x43bFa92104192bC18E9712aD90176882a' },
      { chain: 'TON', name: 'TON Network (Telegram)', depositFee: 0, withdrawFee: 0.2, feeSymbol: 'USDT', minDeposit: 5, minWithdraw: 5, addressExample: 'EQBvW8Z5huBkMJYdn3PCDnHo4619' }
    ]
  },
  {
    id: 'sol',
    symbol: 'SOL',
    name: 'Solana',
    sponsorPrice: 184.5,
    price: 184.5,
    change24h: 5.84,
    high24h: 189.4,
    low24h: 173.1,
    volume24hUsd: 690000000,
    iconBg: 'bg-purple-500/25 text-purple-300 border-purple-400/40 shadow-[0_0_10px_rgba(168,85,247,0.3)]',
    iconColor: 'text-purple-400',
    bestSource: 'bybit',
    apiPrices: { binance: 184.5, bybit: 184.5, okx: 184.5 },
    networks: [
      { chain: 'Solana', name: 'Solana Native Mainnet (Ultra-Rapide)', depositFee: 0, withdrawFee: 0.01, feeSymbol: 'SOL', minDeposit: 0.05, minWithdraw: 0.1, addressExample: '7Np41oeYqPefeNQEHSv13918z88fSalomaSol' },
      { chain: 'BEP20', name: 'BNB Smart Chain (BEP20)', depositFee: 0, withdrawFee: 0.015, feeSymbol: 'SOL', minDeposit: 0.05, minWithdraw: 0.1, addressExample: '0x38Bc491A2026aD728F6b2819876291' }
    ]
  },
  {
    id: 'bnb',
    symbol: 'BNB',
    name: 'BNB Chain',
    sponsorPrice: 598.0,
    price: 598.0,
    change24h: -1.12,
    high24h: 610.0,
    low24h: 589.5,
    volume24hUsd: 420000000,
    iconBg: 'bg-yellow-500/25 text-yellow-300 border-yellow-400/40 shadow-[0_0_10px_rgba(234,179,8,0.3)]',
    iconColor: 'text-yellow-400',
    bestSource: 'bybit',
    apiPrices: { binance: 598.0, bybit: 598.0, okx: 598.0 },
    networks: [
      { chain: 'BEP20', name: 'BNB Smart Chain (BEP20 Native)', depositFee: 0, withdrawFee: 0.001, feeSymbol: 'BNB', minDeposit: 0.01, minWithdraw: 0.02, addressExample: '0x55d398326f99059fF775485246999027B3197955' },
      { chain: 'opBNB', name: 'opBNB Mainnet (L2)', depositFee: 0, withdrawFee: 0.0005, feeSymbol: 'BNB', minDeposit: 0.01, minWithdraw: 0.02, addressExample: '0x55d398326f99059fF775485246999027B3197955' }
    ]
  },
  {
    id: 'saloma',
    symbol: 'SALOMA',
    name: 'Saloma Native Coin',
    sponsorPrice: 1.25,
    price: 1.25,
    change24h: 14.8,
    high24h: 1.32,
    low24h: 1.02,
    volume24hUsd: 84000000,
    iconBg: 'bg-[#7C3AED]/40 text-purple-200 border-[#8B5CF6] shadow-[0_0_15px_rgba(124,58,237,0.6)]',
    iconColor: 'text-[#8B5CF6]',
    bestSource: 'bybit',
    apiPrices: { binance: 1.25, bybit: 1.25, okx: 1.25 },
    networks: [
      { chain: 'SalomaNet', name: 'Saloma High-Speed Mainnet (0 Gas)', depositFee: 0, withdrawFee: 0.0, feeSymbol: 'SALOMA', minDeposit: 1, minWithdraw: 2, addressExample: 'saloma1vola98273645gasy2026official' },
      { chain: 'BEP20', name: 'BNB Smart Chain (BEP20 Wrapped)', depositFee: 0, withdrawFee: 0.5, feeSymbol: 'SALOMA', minDeposit: 5, minWithdraw: 10, addressExample: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8' },
      { chain: 'Polygon', name: 'Polygon POS Bridge', depositFee: 0, withdrawFee: 0.2, feeSymbol: 'SALOMA', minDeposit: 5, minWithdraw: 10, addressExample: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8' }
    ]
  },
  {
    id: 'xrp',
    symbol: 'XRP',
    name: 'Ripple',
    sponsorPrice: 0.62,
    price: 0.62,
    change24h: 4.2,
    high24h: 0.635,
    low24h: 0.588,
    volume24hUsd: 540000000,
    iconBg: 'bg-blue-500/25 text-blue-300 border-blue-400/40',
    iconColor: 'text-blue-400',
    bestSource: 'bybit',
    apiPrices: { binance: 0.62, bybit: 0.62, okx: 0.62 },
    networks: [
      { chain: 'Ripple', name: 'XRP Ledger (Ripple Native)', depositFee: 0, withdrawFee: 0.25, feeSymbol: 'XRP', minDeposit: 1, minWithdraw: 5, addressExample: 'rEb8TK3gBgk5auZyyb6328026Saloma' },
      { chain: 'BEP20', name: 'BNB Smart Chain (BEP20)', depositFee: 0, withdrawFee: 0.3, feeSymbol: 'XRP', minDeposit: 1, minWithdraw: 5, addressExample: '0x1d2f0da169ceb9fc7b3144628db156f3f6c60dbe' }
    ]
  },
  {
    id: 'doge',
    symbol: 'DOGE',
    name: 'Dogecoin',
    sponsorPrice: 0.165,
    price: 0.165,
    change24h: -2.4,
    high24h: 0.171,
    low24h: 0.159,
    volume24hUsd: 390000000,
    iconBg: 'bg-amber-600/25 text-amber-200 border-amber-500/40',
    iconColor: 'text-amber-300',
    bestSource: 'bybit',
    apiPrices: { binance: 0.165, bybit: 0.165, okx: 0.165 },
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
    price: 0.495,
    change24h: 1.85,
    high24h: 0.512,
    low24h: 0.478,
    volume24hUsd: 210000000,
    iconBg: 'bg-sky-500/25 text-sky-300 border-sky-400/40',
    iconColor: 'text-sky-400',
    bestSource: 'bybit',
    apiPrices: { binance: 0.495, bybit: 0.495, okx: 0.495 },
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
    price: 5.85,
    change24h: 7.2,
    high24h: 5.98,
    low24h: 5.42,
    volume24hUsd: 185000000,
    iconBg: 'bg-cyan-500/25 text-cyan-300 border-cyan-400/40',
    iconColor: 'text-cyan-400',
    bestSource: 'bybit',
    apiPrices: { binance: 5.85, bybit: 5.85, okx: 5.85 },
    networks: [
      { chain: 'TON', name: 'The Open Network (TON Native)', depositFee: 0, withdrawFee: 0.05, feeSymbol: 'TON', minDeposit: 0.2, minWithdraw: 0.5, addressExample: 'EQBvW8Z5huBkMJYdn3PCDnHo4619SalomaTON' },
      { chain: 'BEP20', name: 'BNB Smart Chain (BEP20)', depositFee: 0, withdrawFee: 0.08, feeSymbol: 'TON', minDeposit: 0.5, minWithdraw: 1, addressExample: '0x76a797a59ba2c17726896976b7b3747bfd1d220f' }
    ]
  },
  {
    id: 'avax',
    symbol: 'AVAX',
    name: 'Avalanche',
    sponsorPrice: 34.2,
    price: 34.2,
    change24h: 3.1,
    high24h: 35.1,
    low24h: 32.8,
    volume24hUsd: 260000000,
    iconBg: 'bg-red-500/25 text-red-300 border-red-400/40',
    iconColor: 'text-red-400',
    bestSource: 'bybit',
    apiPrices: { binance: 34.2, bybit: 34.2, okx: 34.2 },
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
    price: 2.15,
    change24h: 9.4,
    high24h: 2.24,
    low24h: 1.94,
    volume24hUsd: 310000000,
    iconBg: 'bg-blue-600/25 text-blue-200 border-blue-400/40',
    iconColor: 'text-blue-300',
    bestSource: 'bybit',
    apiPrices: { binance: 2.15, bybit: 2.15, okx: 2.15 },
    networks: [
      { chain: 'Sui', name: 'Sui Native Mainnet', depositFee: 0, withdrawFee: 0.05, feeSymbol: 'SUI', minDeposit: 1, minWithdraw: 2, addressExample: '0x43bFa92104192bC18E9712aD90176882aSalomaSui' }
    ]
  },
  {
    id: 'pepe',
    symbol: 'PEPE',
    name: 'Pepe Coin',
    sponsorPrice: 0.0000098,
    price: 0.0000098,
    change24h: 16.5,
    high24h: 0.0000105,
    low24h: 0.0000081,
    volume24hUsd: 480000000,
    iconBg: 'bg-green-600/25 text-green-300 border-green-500/40',
    iconColor: 'text-green-300',
    bestSource: 'bybit',
    apiPrices: { binance: 0.0000098, bybit: 0.0000098, okx: 0.0000098 },
    networks: [
      { chain: 'ERC20', name: 'Ethereum Mainnet (ERC20)', depositFee: 0, withdrawFee: 250000, feeSymbol: 'PEPE', minDeposit: 500000, minWithdraw: 1000000, addressExample: '0x6982508145454Ce325dDbE47a25d4ec3d2311933' },
      { chain: 'BEP20', name: 'BNB Smart Chain (BEP20)', depositFee: 0, withdrawFee: 100000, feeSymbol: 'PEPE', minDeposit: 200000, minWithdraw: 500000, addressExample: '0x25d887ce7a35172C62FeBFD67a1856620DAEb000' }
    ]
  },
  {
    id: 'ltc',
    symbol: 'LTC',
    name: 'Litecoin',
    sponsorPrice: 86.4,
    price: 86.4,
    change24h: 1.45,
    high24h: 88.0,
    low24h: 84.1,
    volume24hUsd: 175000000,
    iconBg: 'bg-slate-400/25 text-slate-200 border-slate-400/40',
    iconColor: 'text-slate-300',
    bestSource: 'bybit',
    apiPrices: { binance: 86.4, bybit: 86.4, okx: 86.4 },
    networks: [
      { chain: 'Litecoin', name: 'Litecoin Native (bech32)', depositFee: 0, withdrawFee: 0.001, feeSymbol: 'LTC', minDeposit: 0.01, minWithdraw: 0.02, addressExample: 'ltc1q9h6x743j2y0z5v4km89x2026saloma' },
      { chain: 'BEP20', name: 'BNB Smart Chain (BEP20)', depositFee: 0, withdrawFee: 0.002, feeSymbol: 'LTC', minDeposit: 0.01, minWithdraw: 0.02, addressExample: '0x4338665cbb7b2485a8855a139b75d5e34ab0db94' }
    ]
  },
  {
    id: 'trx',
    symbol: 'TRX',
    name: 'TRON',
    sponsorPrice: 0.162,
    price: 0.162,
    change24h: 2.8,
    high24h: 0.166,
    low24h: 0.157,
    volume24hUsd: 290000000,
    iconBg: 'bg-rose-500/25 text-rose-300 border-rose-400/40',
    iconColor: 'text-rose-400',
    bestSource: 'bybit',
    apiPrices: { binance: 0.162, bybit: 0.162, okx: 0.162 },
    networks: [
      { chain: 'TRC20', name: 'TRON Mainnet (TRC20)', depositFee: 0, withdrawFee: 1.0, feeSymbol: 'TRX', minDeposit: 10, minWithdraw: 15, addressExample: 'TJX9zK2B7YmNQ9sLo2481A2026SalomaTRC' },
      { chain: 'BEP20', name: 'BNB Smart Chain (BEP20)', depositFee: 0, withdrawFee: 1.2, feeSymbol: 'TRX', minDeposit: 10, minWithdraw: 15, addressExample: '0xce7de646e7208a4ef112cb6ed5038fa6cc6b12e3' }
    ]
  },
  {
    id: 'link',
    symbol: 'LINK',
    name: 'Chainlink',
    sponsorPrice: 17.8,
    price: 17.8,
    change24h: 4.1,
    high24h: 18.25,
    low24h: 16.95,
    volume24hUsd: 225000000,
    iconBg: 'bg-blue-500/25 text-blue-200 border-blue-400/40',
    iconColor: 'text-blue-400',
    bestSource: 'bybit',
    apiPrices: { binance: 17.8, bybit: 17.8, okx: 17.8 },
    networks: [
      { chain: 'ERC20', name: 'Ethereum (ERC20)', depositFee: 0, withdrawFee: 0.25, feeSymbol: 'LINK', minDeposit: 0.5, minWithdraw: 1, addressExample: '0x514910771AF9Ca656af840dff83E8264EcF986CA' },
      { chain: 'BEP20', name: 'BNB Smart Chain (BEP20)', depositFee: 0, withdrawFee: 0.05, feeSymbol: 'LINK', minDeposit: 0.2, minWithdraw: 0.5, addressExample: '0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD' },
      { chain: 'Polygon', name: 'Polygon POS', depositFee: 0, withdrawFee: 0.04, feeSymbol: 'LINK', minDeposit: 0.2, minWithdraw: 0.5, addressExample: '0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39' }
    ]
  },
  {
    id: 'dot',
    symbol: 'DOT',
    name: 'Polkadot',
    sponsorPrice: 6.45,
    price: 6.45,
    change24h: 2.35,
    high24h: 6.72,
    low24h: 6.18,
    volume24hUsd: 165000000,
    iconBg: 'bg-pink-500/25 text-pink-300 border-pink-400/40',
    iconColor: 'text-pink-400',
    bestSource: 'bybit',
    apiPrices: { binance: 6.45, bybit: 6.45, okx: 6.45 },
    networks: [
      { chain: 'Polkadot', name: 'Polkadot Relay Chain', depositFee: 0, withdrawFee: 0.1, feeSymbol: 'DOT', minDeposit: 1, minWithdraw: 2, addressExample: '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5' },
      { chain: 'BEP20', name: 'BNB Smart Chain (BEP20)', depositFee: 0, withdrawFee: 0.08, feeSymbol: 'DOT', minDeposit: 1, minWithdraw: 2, addressExample: '0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402' }
    ]
  },
  {
    id: 'bch',
    symbol: 'BCH',
    name: 'Bitcoin Cash',
    sponsorPrice: 445.0,
    price: 445.0,
    change24h: 1.9,
    high24h: 458.0,
    low24h: 431.0,
    volume24hUsd: 195000000,
    iconBg: 'bg-emerald-600/25 text-emerald-300 border-emerald-500/40',
    iconColor: 'text-emerald-400',
    bestSource: 'bybit',
    apiPrices: { binance: 445.0, bybit: 445.0, okx: 445.0 },
    networks: [
      { chain: 'BCH', name: 'Bitcoin Cash Native', depositFee: 0, withdrawFee: 0.001, feeSymbol: 'BCH', minDeposit: 0.01, minWithdraw: 0.02, addressExample: 'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a' },
      { chain: 'BEP20', name: 'BNB Smart Chain (BEP20)', depositFee: 0, withdrawFee: 0.001, feeSymbol: 'BCH', minDeposit: 0.01, minWithdraw: 0.02, addressExample: '0x8fF795a6F4D97E7887C79beA79aba5cc76444aDf' }
    ]
  },
  {
    id: 'shib',
    symbol: 'SHIB',
    name: 'Shiba Inu',
    sponsorPrice: 0.0000245,
    price: 0.0000245,
    change24h: 6.4,
    high24h: 0.000026,
    low24h: 0.0000228,
    volume24hUsd: 410000000,
    iconBg: 'bg-orange-500/25 text-orange-300 border-orange-400/40',
    iconColor: 'text-orange-400',
    bestSource: 'bybit',
    apiPrices: { binance: 0.0000245, bybit: 0.0000245, okx: 0.0000245 },
    networks: [
      { chain: 'ERC20', name: 'Ethereum Mainnet (ERC20)', depositFee: 0, withdrawFee: 200000, feeSymbol: 'SHIB', minDeposit: 400000, minWithdraw: 800000, addressExample: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE' },
      { chain: 'BEP20', name: 'BNB Smart Chain (BEP20)', depositFee: 0, withdrawFee: 60000, feeSymbol: 'SHIB', minDeposit: 150000, minWithdraw: 300000, addressExample: '0x2859e4544C4bB03966803b044A93563Bd2D0DD4D' }
    ]
  },
  {
    id: 'near',
    symbol: 'NEAR',
    name: 'NEAR Protocol',
    sponsorPrice: 5.75,
    price: 5.75,
    change24h: 4.8,
    high24h: 5.95,
    low24h: 5.4,
    volume24hUsd: 230000000,
    iconBg: 'bg-teal-500/25 text-teal-300 border-teal-400/40',
    iconColor: 'text-teal-400',
    bestSource: 'bybit',
    apiPrices: { binance: 5.75, bybit: 5.75, okx: 5.75 },
    networks: [
      { chain: 'NEAR', name: 'NEAR Protocol Native', depositFee: 0, withdrawFee: 0.01, feeSymbol: 'NEAR', minDeposit: 0.2, minWithdraw: 0.5, addressExample: 'saloma2026.near' },
      { chain: 'BEP20', name: 'BNB Smart Chain (BEP20)', depositFee: 0, withdrawFee: 0.02, feeSymbol: 'NEAR', minDeposit: 0.2, minWithdraw: 0.5, addressExample: '0x1Fa4a73a3F0133f0025378af00236f3aBX2026' }
    ]
  },
  {
    id: 'uni',
    symbol: 'UNI',
    name: 'Uniswap',
    sponsorPrice: 9.85,
    price: 9.85,
    change24h: 3.15,
    high24h: 10.2,
    low24h: 9.45,
    volume24hUsd: 185000000,
    iconBg: 'bg-fuchsia-500/25 text-fuchsia-300 border-fuchsia-400/40',
    iconColor: 'text-fuchsia-400',
    bestSource: 'bybit',
    apiPrices: { binance: 9.85, bybit: 9.85, okx: 9.85 },
    networks: [
      { chain: 'ERC20', name: 'Ethereum Mainnet (ERC20)', depositFee: 0, withdrawFee: 0.45, feeSymbol: 'UNI', minDeposit: 0.5, minWithdraw: 1, addressExample: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984' },
      { chain: 'Arbitrum', name: 'Arbitrum One (L2)', depositFee: 0, withdrawFee: 0.08, feeSymbol: 'UNI', minDeposit: 0.2, minWithdraw: 0.5, addressExample: '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0' }
    ]
  },
  {
    id: 'apt',
    symbol: 'APT',
    name: 'Aptos',
    sponsorPrice: 9.4,
    price: 9.4,
    change24h: 5.1,
    high24h: 9.85,
    low24h: 8.85,
    volume24hUsd: 175000000,
    iconBg: 'bg-zinc-400/25 text-zinc-200 border-zinc-400/40',
    iconColor: 'text-zinc-300',
    bestSource: 'bybit',
    apiPrices: { binance: 9.4, bybit: 9.4, okx: 9.4 },
    networks: [
      { chain: 'Aptos', name: 'Aptos Native Mainnet', depositFee: 0, withdrawFee: 0.01, feeSymbol: 'APT', minDeposit: 0.2, minWithdraw: 0.5, addressExample: '0x882a4c82b28f03294e83b271391781290salomaapt' }
    ]
  },
  {
    id: 'arb',
    symbol: 'ARB',
    name: 'Arbitrum',
    sponsorPrice: 0.89,
    price: 0.89,
    change24h: 2.9,
    high24h: 0.93,
    low24h: 0.85,
    volume24hUsd: 215000000,
    iconBg: 'bg-sky-600/25 text-sky-200 border-sky-400/40',
    iconColor: 'text-sky-300',
    bestSource: 'bybit',
    apiPrices: { binance: 0.89, bybit: 0.89, okx: 0.89 },
    networks: [
      { chain: 'Arbitrum', name: 'Arbitrum One Native', depositFee: 0, withdrawFee: 0.5, feeSymbol: 'ARB', minDeposit: 1, minWithdraw: 3, addressExample: '0x912CE59144191C1204E64559FE8253a0e49E6548' },
      { chain: 'ERC20', name: 'Ethereum Mainnet (ERC20)', depositFee: 0, withdrawFee: 3.5, feeSymbol: 'ARB', minDeposit: 5, minWithdraw: 10, addressExample: '0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1' }
    ]
  },
  {
    id: 'op',
    symbol: 'OP',
    name: 'Optimism',
    sponsorPrice: 1.92,
    price: 1.92,
    change24h: 3.6,
    high24h: 2.01,
    low24h: 1.83,
    volume24hUsd: 160000000,
    iconBg: 'bg-red-600/25 text-red-200 border-red-400/40',
    iconColor: 'text-red-400',
    bestSource: 'bybit',
    apiPrices: { binance: 1.92, bybit: 1.92, okx: 1.92 },
    networks: [
      { chain: 'Optimism', name: 'OP Mainnet Native', depositFee: 0, withdrawFee: 0.25, feeSymbol: 'OP', minDeposit: 1, minWithdraw: 2, addressExample: '0x4200000000000000000000000000000000000042' }
    ]
  },
  {
    id: 'atom',
    symbol: 'ATOM',
    name: 'Cosmos Hub',
    sponsorPrice: 7.35,
    price: 7.35,
    change24h: 1.4,
    high24h: 7.6,
    low24h: 7.1,
    volume24hUsd: 140000000,
    iconBg: 'bg-indigo-600/25 text-indigo-200 border-indigo-400/40',
    iconColor: 'text-indigo-300',
    bestSource: 'bybit',
    apiPrices: { binance: 7.35, bybit: 7.35, okx: 7.35 },
    networks: [
      { chain: 'Cosmos', name: 'Cosmos Hub (ATOM Native)', depositFee: 0, withdrawFee: 0.02, feeSymbol: 'ATOM', minDeposit: 0.2, minWithdraw: 0.5, addressExample: 'cosmos1h6x743j2y0z5v4km89x2026saloma' }
    ]
  },
  {
    id: 'icp',
    symbol: 'ICP',
    name: 'Internet Computer',
    sponsorPrice: 10.4,
    price: 10.4,
    change24h: 4.5,
    high24h: 10.9,
    low24h: 9.85,
    volume24hUsd: 130000000,
    iconBg: 'bg-violet-500/25 text-violet-200 border-violet-400/40',
    iconColor: 'text-violet-300',
    bestSource: 'bybit',
    apiPrices: { binance: 10.4, bybit: 10.4, okx: 10.4 },
    networks: [
      { chain: 'ICP', name: 'Internet Computer Mainnet', depositFee: 0, withdrawFee: 0.005, feeSymbol: 'ICP', minDeposit: 0.1, minWithdraw: 0.2, addressExample: 'saloma2026-icp-principal-account' }
    ]
  },
  {
    id: 'fil',
    symbol: 'FIL',
    name: 'Filecoin',
    sponsorPrice: 4.85,
    price: 4.85,
    change24h: 2.2,
    high24h: 5.02,
    low24h: 4.68,
    volume24hUsd: 145000000,
    iconBg: 'bg-cyan-600/25 text-cyan-200 border-cyan-400/40',
    iconColor: 'text-cyan-300',
    bestSource: 'bybit',
    apiPrices: { binance: 4.85, bybit: 4.85, okx: 4.85 },
    networks: [
      { chain: 'Filecoin', name: 'Filecoin Mainnet (f1/f4)', depositFee: 0, withdrawFee: 0.01, feeSymbol: 'FIL', minDeposit: 0.2, minWithdraw: 0.5, addressExample: 'f1abjxfbp274xpdqcpuaykwkfb43omjotacm2p3za' },
      { chain: 'BEP20', name: 'BNB Smart Chain (BEP20)', depositFee: 0, withdrawFee: 0.02, feeSymbol: 'FIL', minDeposit: 0.2, minWithdraw: 0.5, addressExample: '0x0D8Ce2A99Bb6e3B7Db580eD848240e4a0F9aE153' }
    ]
  },
  {
    id: 'hbar',
    symbol: 'HBAR',
    name: 'Hedera',
    sponsorPrice: 0.145,
    price: 0.145,
    change24h: 6.2,
    high24h: 0.152,
    low24h: 0.135,
    volume24hUsd: 165000000,
    iconBg: 'bg-slate-600/25 text-slate-200 border-slate-400/40',
    iconColor: 'text-slate-300',
    bestSource: 'bybit',
    apiPrices: { binance: 0.145, bybit: 0.145, okx: 0.145 },
    networks: [
      { chain: 'Hedera', name: 'Hedera Hashgraph Mainnet', depositFee: 0, withdrawFee: 1.0, feeSymbol: 'HBAR', minDeposit: 5, minWithdraw: 10, addressExample: '0.0.4829104' }
    ]
  },
  {
    id: 'xlm',
    symbol: 'XLM',
    name: 'Stellar',
    sponsorPrice: 0.285,
    price: 0.285,
    change24h: 3.9,
    high24h: 0.296,
    low24h: 0.271,
    volume24hUsd: 190000000,
    iconBg: 'bg-blue-400/25 text-blue-200 border-blue-300/40',
    iconColor: 'text-blue-300',
    bestSource: 'bybit',
    apiPrices: { binance: 0.285, bybit: 0.285, okx: 0.285 },
    networks: [
      { chain: 'Stellar', name: 'Stellar Lumens Network', depositFee: 0, withdrawFee: 0.1, feeSymbol: 'XLM', minDeposit: 5, minWithdraw: 10, addressExample: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN' }
    ]
  },
  {
    id: 'vet',
    symbol: 'VET',
    name: 'VeChain',
    sponsorPrice: 0.036,
    price: 0.036,
    change24h: 2.75,
    high24h: 0.038,
    low24h: 0.0345,
    volume24hUsd: 88000000,
    iconBg: 'bg-sky-500/25 text-sky-200 border-sky-400/40',
    iconColor: 'text-sky-300',
    bestSource: 'bybit',
    apiPrices: { binance: 0.036, bybit: 0.036, okx: 0.036 },
    networks: [
      { chain: 'VeChain', name: 'VeChainThor Mainnet', depositFee: 0, withdrawFee: 10, feeSymbol: 'VET', minDeposit: 50, minWithdraw: 100, addressExample: '0x992B28B3eB9229555C09F6eF83A8992026' }
    ]
  },
  {
    id: 'algo',
    symbol: 'ALGO',
    name: 'Algorand',
    sponsorPrice: 0.245,
    price: 0.245,
    change24h: 1.95,
    high24h: 0.256,
    low24h: 0.236,
    volume24hUsd: 92000000,
    iconBg: 'bg-emerald-500/25 text-emerald-200 border-emerald-400/40',
    iconColor: 'text-emerald-300',
    bestSource: 'bybit',
    apiPrices: { binance: 0.245, bybit: 0.245, okx: 0.245 },
    networks: [
      { chain: 'Algorand', name: 'Algorand Mainnet', depositFee: 0, withdrawFee: 0.1, feeSymbol: 'ALGO', minDeposit: 2, minWithdraw: 5, addressExample: 'SALOMA743J2Y0Z5V4KM89X2026ALGORANDADDRESS' }
    ]
  },
  {
    id: 'inj',
    symbol: 'INJ',
    name: 'Injective',
    sponsorPrice: 23.4,
    price: 23.4,
    change24h: 5.4,
    high24h: 24.5,
    low24h: 22.1,
    volume24hUsd: 155000000,
    iconBg: 'bg-cyan-500/25 text-cyan-200 border-cyan-400/40',
    iconColor: 'text-cyan-300',
    bestSource: 'bybit',
    apiPrices: { binance: 23.4, bybit: 23.4, okx: 23.4 },
    networks: [
      { chain: 'Injective', name: 'Injective Native Mainnet', depositFee: 0, withdrawFee: 0.02, feeSymbol: 'INJ', minDeposit: 0.1, minWithdraw: 0.2, addressExample: 'inj1h6x743j2y0z5v4km89x2026saloma' },
      { chain: 'ERC20', name: 'Ethereum Mainnet (ERC20)', depositFee: 0, withdrawFee: 0.25, feeSymbol: 'INJ', minDeposit: 0.2, minWithdraw: 0.5, addressExample: '0xe28b3B32B6c345A34Ff64674606124d55ca0a778' }
    ]
  },
  {
    id: 'sei',
    symbol: 'SEI',
    name: 'Sei Network',
    sponsorPrice: 0.48,
    price: 0.48,
    change24h: 4.3,
    high24h: 0.51,
    low24h: 0.455,
    volume24hUsd: 135000000,
    iconBg: 'bg-rose-600/25 text-rose-200 border-rose-400/40',
    iconColor: 'text-rose-300',
    bestSource: 'bybit',
    apiPrices: { binance: 0.48, bybit: 0.48, okx: 0.48 },
    networks: [
      { chain: 'Sei', name: 'Sei Native Mainnet', depositFee: 0, withdrawFee: 0.1, feeSymbol: 'SEI', minDeposit: 2, minWithdraw: 5, addressExample: 'sei1h6x743j2y0z5v4km89x2026saloma' }
    ]
  },
  {
    id: 'tia',
    symbol: 'TIA',
    name: 'Celestia',
    sponsorPrice: 6.15,
    price: 6.15,
    change24h: 3.7,
    high24h: 6.42,
    low24h: 5.88,
    volume24hUsd: 125000000,
    iconBg: 'bg-purple-600/25 text-purple-200 border-purple-400/40',
    iconColor: 'text-purple-300',
    bestSource: 'bybit',
    apiPrices: { binance: 6.15, bybit: 6.15, okx: 6.15 },
    networks: [
      { chain: 'Celestia', name: 'Celestia Native Mainnet', depositFee: 0, withdrawFee: 0.02, feeSymbol: 'TIA', minDeposit: 0.5, minWithdraw: 1, addressExample: 'celestia1h6x743j2y0z5v4km89x2026saloma' }
    ]
  },
  {
    id: 'render',
    symbol: 'RENDER',
    name: 'Render Network',
    sponsorPrice: 7.4,
    price: 7.4,
    change24h: 8.1,
    high24h: 7.85,
    low24h: 6.82,
    volume24hUsd: 210000000,
    iconBg: 'bg-red-500/25 text-red-200 border-red-400/40',
    iconColor: 'text-red-300',
    bestSource: 'bybit',
    apiPrices: { binance: 7.4, bybit: 7.4, okx: 7.4 },
    networks: [
      { chain: 'Solana', name: 'Solana SPL Mainnet', depositFee: 0, withdrawFee: 0.1, feeSymbol: 'RENDER', minDeposit: 0.5, minWithdraw: 1, addressExample: 'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof' }
    ]
  },
  {
    id: 'fet',
    symbol: 'FET',
    name: 'Artificial Superintelligence',
    sponsorPrice: 1.48,
    price: 1.48,
    change24h: 6.9,
    high24h: 1.56,
    low24h: 1.38,
    volume24hUsd: 195000000,
    iconBg: 'bg-indigo-500/25 text-indigo-200 border-indigo-400/40',
    iconColor: 'text-indigo-300',
    bestSource: 'bybit',
    apiPrices: { binance: 1.48, bybit: 1.48, okx: 1.48 },
    networks: [
      { chain: 'ERC20', name: 'Ethereum Mainnet (ERC20)', depositFee: 0, withdrawFee: 2.5, feeSymbol: 'FET', minDeposit: 5, minWithdraw: 10, addressExample: '0xaea46A60368A7bD060eec7DF8CBa43b7EF41Ad85' },
      { chain: 'Fetch', name: 'Fetch.ai Native Mainnet', depositFee: 0, withdrawFee: 0.1, feeSymbol: 'FET', minDeposit: 1, minWithdraw: 2, addressExample: 'fetch1h6x743j2y0z5v4km89x2026saloma' }
    ]
  },
  {
    id: 'jup',
    symbol: 'JUP',
    name: 'Jupiter',
    sponsorPrice: 1.08,
    price: 1.08,
    change24h: 5.2,
    high24h: 1.14,
    low24h: 1.01,
    volume24hUsd: 145000000,
    iconBg: 'bg-teal-500/25 text-teal-200 border-teal-400/40',
    iconColor: 'text-teal-300',
    bestSource: 'bybit',
    apiPrices: { binance: 1.08, bybit: 1.08, okx: 1.08 },
    networks: [
      { chain: 'Solana', name: 'Solana SPL (Jupiter)', depositFee: 0, withdrawFee: 0.2, feeSymbol: 'JUP', minDeposit: 1, minWithdraw: 2, addressExample: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' }
    ]
  },
  {
    id: 'wif',
    symbol: 'WIF',
    name: 'dogwifhat',
    sponsorPrice: 2.65,
    price: 2.65,
    change24h: 11.4,
    high24h: 2.85,
    low24h: 2.34,
    volume24hUsd: 320000000,
    iconBg: 'bg-amber-500/25 text-amber-200 border-amber-400/40',
    iconColor: 'text-amber-300',
    bestSource: 'bybit',
    apiPrices: { binance: 2.65, bybit: 2.65, okx: 2.65 },
    networks: [
      { chain: 'Solana', name: 'Solana SPL Mainnet', depositFee: 0, withdrawFee: 0.1, feeSymbol: 'WIF', minDeposit: 1, minWithdraw: 2, addressExample: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm' }
    ]
  },
  {
    id: 'bonk',
    symbol: 'BONK',
    name: 'Bonk',
    sponsorPrice: 0.000032,
    price: 0.000032,
    change24h: 9.8,
    high24h: 0.000035,
    low24h: 0.0000285,
    volume24hUsd: 270000000,
    iconBg: 'bg-orange-500/25 text-orange-200 border-orange-400/40',
    iconColor: 'text-orange-300',
    bestSource: 'bybit',
    apiPrices: { binance: 0.000032, bybit: 0.000032, okx: 0.000032 },
    networks: [
      { chain: 'Solana', name: 'Solana SPL Mainnet', depositFee: 0, withdrawFee: 10000, feeSymbol: 'BONK', minDeposit: 50000, minWithdraw: 100000, addressExample: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' }
    ]
  },
  {
    id: 'floki',
    symbol: 'FLOKI',
    name: 'Floki Inu',
    sponsorPrice: 0.000185,
    price: 0.000185,
    change24h: 7.4,
    high24h: 0.000198,
    low24h: 0.000171,
    volume24hUsd: 185000000,
    iconBg: 'bg-yellow-500/25 text-yellow-200 border-yellow-400/40',
    iconColor: 'text-yellow-300',
    bestSource: 'bybit',
    apiPrices: { binance: 0.000185, bybit: 0.000185, okx: 0.000185 },
    networks: [
      { chain: 'BEP20', name: 'BNB Smart Chain (BEP20)', depositFee: 0, withdrawFee: 5000, feeSymbol: 'FLOKI', minDeposit: 20000, minWithdraw: 40000, addressExample: '0xfb5B838b6cfEEdC2873aB27866079AC55363D37E' },
      { chain: 'ERC20', name: 'Ethereum Mainnet (ERC20)', depositFee: 0, withdrawFee: 25000, feeSymbol: 'FLOKI', minDeposit: 50000, minWithdraw: 100000, addressExample: '0xcf0C122c6b73ff809C693DB761e7BaeBe62b6a2E' }
    ]
  },
  {
    id: 'aave',
    symbol: 'AAVE',
    name: 'Aave',
    sponsorPrice: 168.5,
    price: 168.5,
    change24h: 4.3,
    high24h: 174.0,
    low24h: 160.2,
    volume24hUsd: 155000000,
    iconBg: 'bg-purple-500/25 text-purple-200 border-purple-400/40',
    iconColor: 'text-purple-300',
    bestSource: 'bybit',
    apiPrices: { binance: 168.5, bybit: 168.5, okx: 168.5 },
    networks: [
      { chain: 'ERC20', name: 'Ethereum Mainnet (ERC20)', depositFee: 0, withdrawFee: 0.03, feeSymbol: 'AAVE', minDeposit: 0.05, minWithdraw: 0.1, addressExample: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9' },
      { chain: 'Polygon', name: 'Polygon POS', depositFee: 0, withdrawFee: 0.005, feeSymbol: 'AAVE', minDeposit: 0.02, minWithdraw: 0.05, addressExample: '0xD6DF932A45C0f255f85145f286eA0b292B21C90B' }
    ]
  },
  {
    id: 'mkr',
    symbol: 'MKR',
    name: 'Maker',
    sponsorPrice: 1740.0,
    price: 1740.0,
    change24h: 2.1,
    high24h: 1790.0,
    low24h: 1690.0,
    volume24hUsd: 95000000,
    iconBg: 'bg-emerald-500/25 text-emerald-200 border-emerald-400/40',
    iconColor: 'text-emerald-300',
    bestSource: 'bybit',
    apiPrices: { binance: 1740.0, bybit: 1740.0, okx: 1740.0 },
    networks: [
      { chain: 'ERC20', name: 'Ethereum Mainnet (ERC20)', depositFee: 0, withdrawFee: 0.003, feeSymbol: 'MKR', minDeposit: 0.005, minWithdraw: 0.01, addressExample: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2' }
    ]
  },
  {
    id: 'ldo',
    symbol: 'LDO',
    name: 'Lido DAO',
    sponsorPrice: 1.54,
    price: 1.54,
    change24h: 3.4,
    high24h: 1.62,
    low24h: 1.47,
    volume24hUsd: 98000000,
    iconBg: 'bg-sky-500/25 text-sky-200 border-sky-400/40',
    iconColor: 'text-sky-300',
    bestSource: 'bybit',
    apiPrices: { binance: 1.54, bybit: 1.54, okx: 1.54 },
    networks: [
      { chain: 'ERC20', name: 'Ethereum Mainnet (ERC20)', depositFee: 0, withdrawFee: 2.0, feeSymbol: 'LDO', minDeposit: 5, minWithdraw: 10, addressExample: '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32' }
    ]
  },
  {
    id: 'grt',
    symbol: 'GRT',
    name: 'The Graph',
    sponsorPrice: 0.225,
    price: 0.225,
    change24h: 4.1,
    high24h: 0.236,
    low24h: 0.214,
    volume24hUsd: 86000000,
    iconBg: 'bg-violet-600/25 text-violet-200 border-violet-400/40',
    iconColor: 'text-violet-300',
    bestSource: 'bybit',
    apiPrices: { binance: 0.225, bybit: 0.225, okx: 0.225 },
    networks: [
      { chain: 'Arbitrum', name: 'Arbitrum One (L2)', depositFee: 0, withdrawFee: 1.0, feeSymbol: 'GRT', minDeposit: 5, minWithdraw: 10, addressExample: '0x9623063377AD1B27544C965cCd7342f7EA7e88C7' },
      { chain: 'ERC20', name: 'Ethereum Mainnet (ERC20)', depositFee: 0, withdrawFee: 15.0, feeSymbol: 'GRT', minDeposit: 30, minWithdraw: 50, addressExample: '0xc944E90C64B2c07662A292be6244BDf05Cda44a7' }
    ]
  },
  {
    id: 'imx',
    symbol: 'IMX',
    name: 'Immutable',
    sponsorPrice: 1.62,
    price: 1.62,
    change24h: 2.8,
    high24h: 1.7,
    low24h: 1.55,
    volume24hUsd: 78000000,
    iconBg: 'bg-cyan-500/25 text-cyan-200 border-cyan-400/40',
    iconColor: 'text-cyan-300',
    bestSource: 'bybit',
    apiPrices: { binance: 1.62, bybit: 1.62, okx: 1.62 },
    networks: [
      { chain: 'ERC20', name: 'Ethereum Mainnet (ERC20)', depositFee: 0, withdrawFee: 2.0, feeSymbol: 'IMX', minDeposit: 5, minWithdraw: 10, addressExample: '0xF57e7e7C23978C3cAEC3C3548E3D615c346e79fF' }
    ]
  },
  {
    id: 'stx',
    symbol: 'STX',
    name: 'Stacks',
    sponsorPrice: 1.98,
    price: 1.98,
    change24h: 5.5,
    high24h: 2.08,
    low24h: 1.85,
    volume24hUsd: 112000000,
    iconBg: 'bg-orange-600/25 text-orange-200 border-orange-400/40',
    iconColor: 'text-orange-300',
    bestSource: 'bybit',
    apiPrices: { binance: 1.98, bybit: 1.98, okx: 1.98 },
    networks: [
      { chain: 'Stacks', name: 'Stacks Bitcoin L2 Mainnet', depositFee: 0, withdrawFee: 0.2, feeSymbol: 'STX', minDeposit: 1, minWithdraw: 2, addressExample: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE' }
    ]
  },
  {
    id: 'rune',
    symbol: 'RUNE',
    name: 'THORChain',
    sponsorPrice: 5.42,
    price: 5.42,
    change24h: 4.9,
    high24h: 5.68,
    low24h: 5.12,
    volume24hUsd: 128000000,
    iconBg: 'bg-emerald-500/25 text-emerald-200 border-emerald-400/40',
    iconColor: 'text-emerald-300',
    bestSource: 'bybit',
    apiPrices: { binance: 5.42, bybit: 5.42, okx: 5.42 },
    networks: [
      { chain: 'THORChain', name: 'THORChain Native Mainnet', depositFee: 0, withdrawFee: 0.05, feeSymbol: 'RUNE', minDeposit: 0.5, minWithdraw: 1, addressExample: 'thor1h6x743j2y0z5v4km89x2026saloma' }
    ]
  },
  {
    id: 'etc',
    symbol: 'ETC',
    name: 'Ethereum Classic',
    sponsorPrice: 24.8,
    price: 24.8,
    change24h: 1.7,
    high24h: 25.6,
    low24h: 24.0,
    volume24hUsd: 118000000,
    iconBg: 'bg-green-600/25 text-green-200 border-green-400/40',
    iconColor: 'text-green-400',
    bestSource: 'bybit',
    apiPrices: { binance: 24.8, bybit: 24.8, okx: 24.8 },
    networks: [
      { chain: 'ETC', name: 'Ethereum Classic Native', depositFee: 0, withdrawFee: 0.01, feeSymbol: 'ETC', minDeposit: 0.1, minWithdraw: 0.2, addressExample: '0x992B28B3eB9229555C09F6eF83A8992026' },
      { chain: 'BEP20', name: 'BNB Smart Chain (BEP20)', depositFee: 0, withdrawFee: 0.01, feeSymbol: 'ETC', minDeposit: 0.1, minWithdraw: 0.2, addressExample: '0x3d6545b08693daE087E957cb1180ee38B9e3c25E' }
    ]
  },
  {
    id: 'pol',
    symbol: 'POL',
    name: 'Polygon Ecosystem',
    sponsorPrice: 0.44,
    price: 0.44,
    change24h: 2.6,
    high24h: 0.46,
    low24h: 0.42,
    volume24hUsd: 142000000,
    iconBg: 'bg-purple-500/25 text-purple-200 border-purple-400/40',
    iconColor: 'text-purple-400',
    bestSource: 'bybit',
    apiPrices: { binance: 0.44, bybit: 0.44, okx: 0.44 },
    networks: [
      { chain: 'Polygon', name: 'Polygon POS Mainnet', depositFee: 0, withdrawFee: 0.2, feeSymbol: 'POL', minDeposit: 2, minWithdraw: 5, addressExample: '0x0000000000000000000000000000000000001010' },
      { chain: 'ERC20', name: 'Ethereum Mainnet (ERC20)', depositFee: 0, withdrawFee: 8.0, feeSymbol: 'POL', minDeposit: 20, minWithdraw: 40, addressExample: '0x455e53CBB86018Ac2B8092FdCd39d8444aFFC3F6' }
    ]
  },
  {
    id: 'ondo',
    symbol: 'ONDO',
    name: 'Ondo Finance',
    sponsorPrice: 0.96,
    price: 0.96,
    change24h: 6.1,
    high24h: 1.02,
    low24h: 0.89,
    volume24hUsd: 162000000,
    iconBg: 'bg-slate-500/25 text-slate-200 border-slate-400/40',
    iconColor: 'text-slate-300',
    bestSource: 'bybit',
    apiPrices: { binance: 0.96, bybit: 0.96, okx: 0.96 },
    networks: [
      { chain: 'ERC20', name: 'Ethereum Mainnet (ERC20)', depositFee: 0, withdrawFee: 3.0, feeSymbol: 'ONDO', minDeposit: 10, minWithdraw: 20, addressExample: '0xfAbA6f8e4a5E8Ab82F62fe7C39859FA577269BE3' }
    ]
  }
];

export const INITIAL_COINS: Coin[] = RAW_INITIAL_COINS.map(coin => {
  const minEquiv = computeMinCoinForUsd(coin.price, coin.symbol, TEST_MIN_USD);
  return {
    ...coin,
    networks: coin.networks.map(net => ({
      ...net,
      minDeposit: minEquiv,
      minWithdraw: minEquiv
    }))
  };
});

export const INITIAL_API_PROVIDERS: ApiProviderStatus[] = [
  {
    id: 'bybit',
    label: 'Flux Marché Temps Réel',
    enabled: true,
    online: true,
    latencyMs: 12,
    lastSync: Date.now(),
    errorCount: 0
  }
];

export function getBlockchainFromNetwork(net: CoinNetwork): string {
  const map: Record<string, string> = {
    TRC20: 'Tron',
    ERC20: 'Ethereum',
    BEP20: 'BSC',
    opBNB: 'BSC (opBNB)',
    Solana: 'Solana',
    'BTC-Native': 'Bitcoin',
    Taproot: 'Bitcoin',
    Lightning: 'Bitcoin',
    Arbitrum: 'Arbitrum',
    Optimism: 'Optimism',
    Base: 'Base',
    Polygon: 'Polygon',
    'AVAX-C': 'Avalanche',
    TON: 'TON',
    SalomaNet: 'SalomaNet',
    Ripple: 'Ripple',
    Dogecoin: 'Dogecoin',
    Cardano: 'Cardano',
    Litecoin: 'Litecoin',
    Polkadot: 'Polkadot',
    BCH: 'Bitcoin Cash',
    Sui: 'Sui',
    NEAR: 'NEAR',
    Aptos: 'Aptos',
    Cosmos: 'Cosmos',
    ICP: 'Internet Computer',
    Filecoin: 'Filecoin',
    Hedera: 'Hedera',
    Stellar: 'Stellar',
    VeChain: 'VeChain',
    Algorand: 'Algorand',
    Injective: 'Injective',
    Sei: 'Sei',
    Celestia: 'Celestia',
    Fetch: 'Fetch.ai',
    Stacks: 'Stacks',
    THORChain: 'THORChain',
    ETC: 'Ethereum Classic'
  };
  return map[net.chain] || net.chain;
}

export function getNetworkShortLabel(net: CoinNetwork): string {
  const map: Record<string, string> = {
    Solana: 'SOL (SPL)',
    'BTC-Native': 'BTC (SegWit)',
    'AVAX-C': 'AVAX C-Chain',
    Polygon: 'Polygon POS',
    Arbitrum: 'Arbitrum One',
    Optimism: 'OP Mainnet',
    Base: 'Base L2'
  };
  return map[net.chain] || net.chain;
}

export function findCoinNetwork(
  symbol: string,
  chainOrNetwork?: string,
  livePriceUsd?: number
): CoinNetwork | null {
  const cleanSym = symbol.toUpperCase().trim();
  const coin = INITIAL_COINS.find(
    c => c.symbol.toUpperCase() === cleanSym || (cleanSym === 'MATIC' && c.symbol.toUpperCase() === 'POL')
  );
  if (!coin || coin.networks.length === 0) return null;
  let baseNet: CoinNetwork;
  if (!chainOrNetwork) {
    baseNet = coin.networks[0];
  } else {
    const q = chainOrNetwork.toLowerCase().trim();
    baseNet =
      coin.networks.find(
        n =>
          n.chain.toLowerCase() === q ||
          n.name.toLowerCase() === q ||
          getNetworkShortLabel(n).toLowerCase() === q
      ) || coin.networks[0];
  }
  const effectivePrice =
    Number.isFinite(livePriceUsd) && Number(livePriceUsd) > 0
      ? Number(livePriceUsd)
      : coin.price;
  const minEquiv = computeMinCoinForUsd(effectivePrice, coin.symbol, TEST_MIN_USD);
  return {
    ...baseNet,
    minDeposit: minEquiv > 0 ? minEquiv : baseNet.minDeposit,
    minWithdraw: minEquiv > 0 ? minEquiv : baseNet.minWithdraw
  };
}

export const CRYPTO_WALLET_CONFIG: Record<
  'USDT' | 'BTC' | 'ETH',
  {
    symbol: 'USDT' | 'BTC' | 'ETH';
    label: string;
    chain: string;
    networkLabel: string;
    depositAddress: string;
    withdrawFee: number;
    minDeposit: number;
    minWithdraw: number;
  }
> = {
  USDT: {
    symbol: 'USDT',
    label: 'Tether USD (TRC20)',
    chain: 'TRC20',
    networkLabel: 'TRON (TRC20)',
    depositAddress: 'TJX9zK2B7YmNQ9sLo2481A2026SalomaTRC',
    withdrawFee: 1.2,
    minDeposit: 0.5,
    minWithdraw: 0.5
  },
  BTC: {
    symbol: 'BTC',
    label: 'Bitcoin (BTC)',
    chain: 'BTC-Native',
    networkLabel: 'Bitcoin (Native SegWit bech32)',
    depositAddress: 'bc1q9h6x743j2y0z5v4km89x2026saloma',
    withdrawFee: 0.00025,
    minDeposit: computeMinCoinForUsd(68420, 'BTC', TEST_MIN_USD),
    minWithdraw: computeMinCoinForUsd(68420, 'BTC', TEST_MIN_USD)
  },
  ETH: {
    symbol: 'ETH',
    label: 'Ethereum (ERC20)',
    chain: 'ERC20',
    networkLabel: 'Ethereum Mainnet (ERC20)',
    depositAddress: '0x992B28B3eB9229555C09F6eF83A8992026',
    withdrawFee: 0.0035,
    minDeposit: computeMinCoinForUsd(3580, 'ETH', TEST_MIN_USD),
    minWithdraw: computeMinCoinForUsd(3580, 'ETH', TEST_MIN_USD)
  }
};

export const SALOMA_TRADE_FEE_RATE = 0.001; // 0.1%
export const SALOMA_EXCHANGE_FEE_RATE = 0.001; // 0.1%
export const SALOMA_WITHDRAW_FEE_RATE = 0.0015; // 0.15% + frais réseau

export interface PublicSalomaFees {
  tradeFeePct: number;
  exchangeFeePct: number;
  withdrawFeePct: number;
  networkFeeUsdt: number;
}

export const DEFAULT_PUBLIC_SALOMA_FEES: PublicSalomaFees = {
  tradeFeePct: 0.1,
  exchangeFeePct: 0.1,
  withdrawFeePct: 0.15,
  networkFeeUsdt: 0.5
};

export interface BackendPublicCoin {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24hUsd: number;
}

export async function fetchSalomaFees(): Promise<PublicSalomaFees | null> {
  try {
    const res = await fetch('/api/fees');
    if (!res.ok) return null;
    const data = (await res.json()) as { salomaFees?: PublicSalomaFees };
    return data.salomaFees || null;
  } catch {
    return null;
  }
}

export async function fetchSalomaMarketPrices(): Promise<{
  coins: BackendPublicCoin[];
  activeExchange: 'BYBIT' | 'OKX' | 'BINANCE';
  wsOnline?: boolean;
  salomaFees?: PublicSalomaFees;
  latencyMs: number;
  ok: boolean;
}> {
  const start = performance.now();
  try {
    const res = await fetch('/api/market/prices');
    const latencyMs = Math.round(performance.now() - start);
    if (!res.ok) return { coins: [], activeExchange: 'BYBIT', latencyMs, ok: false };
    const data = (await res.json()) as {
      coins?: BackendPublicCoin[];
      activeExchange?: 'BYBIT' | 'OKX' | 'BINANCE';
      wsOnline?: boolean;
      salomaFees?: PublicSalomaFees;
    };
    return {
      coins: Array.isArray(data.coins) ? data.coins : [],
      activeExchange: data.activeExchange || 'BYBIT',
      wsOnline: Boolean(data.wsOnline),
      salomaFees: data.salomaFees,
      latencyMs,
      ok: Array.isArray(data.coins) && data.coins.length > 0
    };
  } catch {
    return { coins: [], activeExchange: 'BYBIT', latencyMs: 0, ok: false };
  }
}

export function mergeSalomaMarketPrices(
  prevCoins: Coin[],
  backendCoins: BackendPublicCoin[]
): Coin[] {
  if (backendCoins.length === 0) return prevCoins;
  const map = new Map(backendCoins.map(c => [c.symbol.toUpperCase(), c]));
  return prevCoins.map(coin => {
    const fresh = map.get(coin.symbol.toUpperCase());
    if (!fresh) return coin;
    const minEquiv = computeMinCoinForUsd(fresh.price, coin.symbol, TEST_MIN_USD);
    return {
      ...coin,
      price: fresh.price,
      sponsorPrice: fresh.price,
      change24h: fresh.change24h,
      high24h: fresh.high24h,
      low24h: fresh.low24h,
      volume24hUsd: fresh.volume24hUsd,
      networks:
        minEquiv > 0
          ? coin.networks.map(net => ({
              ...net,
              minDeposit: minEquiv,
              minWithdraw: minEquiv
            }))
          : coin.networks
    };
  });
}

export interface PriceStreamHandlers {
  onSnapshot: (payload: {
    coins: BackendPublicCoin[];
    activeExchange: 'BYBIT' | 'OKX' | 'BINANCE';
    wsOnline: boolean;
    salomaFees?: PublicSalomaFees;
    updatedAt: number;
  }) => void;
  onTick: (payload: {
    coin: BackendPublicCoin;
    activeExchange: 'BYBIT' | 'OKX' | 'BINANCE';
    wsOnline: boolean;
    updatedAt: number;
  }) => void;
  onStatusChange?: (connected: boolean) => void;
}

export function subscribeToPricesWebSocket(handlers: PriceStreamHandlers): () => void {
  if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
    return () => {};
  }

  let closed = false;
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let retryDelayMs = 1500;
  let consecutiveFailures = 0;

  const connect = () => {
    if (closed) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws/prices`;
    try {
      ws = new WebSocket(url);
    } catch {
      handlers.onStatusChange?.(false);
      consecutiveFailures++;
      if (consecutiveFailures <= 4) {
        reconnectTimer = setTimeout(connect, retryDelayMs);
        retryDelayMs = Math.min(retryDelayMs * 2, 30000);
      }
      return;
    }

    ws.onopen = () => {
      consecutiveFailures = 0;
      retryDelayMs = 1500;
      handlers.onStatusChange?.(true);
    };

    ws.onmessage = ev => {
      try {
        const msg = JSON.parse(String(ev.data)) as {
          type?: 'snapshot' | 'tick';
          coins?: BackendPublicCoin[];
          coin?: BackendPublicCoin;
          activeExchange?: 'BYBIT' | 'OKX' | 'BINANCE';
          wsOnline?: boolean;
          salomaFees?: PublicSalomaFees;
          updatedAt?: number;
        };
        if (msg.type === 'snapshot' && Array.isArray(msg.coins)) {
          handlers.onSnapshot({
            coins: msg.coins,
            activeExchange: msg.activeExchange || 'BYBIT',
            wsOnline: Boolean(msg.wsOnline ?? true),
            salomaFees: msg.salomaFees,
            updatedAt: msg.updatedAt || Date.now()
          });
        } else if (msg.type === 'tick' && msg.coin) {
          handlers.onTick({
            coin: msg.coin,
            activeExchange: msg.activeExchange || 'BYBIT',
            wsOnline: Boolean(msg.wsOnline ?? true),
            updatedAt: msg.updatedAt || Date.now()
          });
        }
      } catch {
        // ignore malformed frame
      }
    };

    ws.onerror = () => {
      handlers.onStatusChange?.(false);
    };

    ws.onclose = () => {
      handlers.onStatusChange?.(false);
      consecutiveFailures++;
      if (!closed && consecutiveFailures <= 5) {
        reconnectTimer = setTimeout(connect, retryDelayMs);
        retryDelayMs = Math.min(retryDelayMs * 2, 30000);
      }
    };
  };

  connect();

  return () => {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (ws) {
      try {
        ws.close();
      } catch {
        // ignore close error
      }
    }
  };
}

export function formatCoinPrice(val: number): string {
  if (val < 0.0001) return val.toFixed(8);
  if (val < 0.001) return val.toFixed(7);
  if (val < 1) return val.toFixed(5);
  if (val < 10) return val.toFixed(4);
  if (val < 100) return val.toFixed(3);
  return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
