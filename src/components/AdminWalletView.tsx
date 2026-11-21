import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  Copy,
  Layers,
  Search,
  Trash2,
  X
} from 'lucide-react';
import {
  type Coin,
  type PublicSalomaFees,
  MIN_DEPOSIT_USD,
  MIN_WITHDRAW_USD,
  computeMinCoinForUsd,
  formatCoinPrice,
  formatMinCoinQty,
  getBlockchainFromNetwork,
  getNetworkShortLabel,
  isKnownTokenContractAddress,
  resolveWalletAddressForChain
} from '../services/priceAggregator';
import { apiRequest } from '../lib/appwrite';

export interface AdminWalletRow {
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

export interface AdminWalletTxRow {
  $id: string;
  user_id: string;
  type: 'depot' | 'retrait';
  montant: number;
  methode: string;
  numero_compte: string;
  statut: 'en_attente' | 'valide' | 'refuse';
  preuve?: string;
  date?: string;
  devise: string;
  frais?: number;
}

interface AdminWalletViewProps {
  adminPin: string;
  adminEmail: string;
  adminSessionToken: string;
  coins: Coin[];
  salomaFees: PublicSalomaFees;
  usdToMga: number;
  showToast: (msg: string) => void;
  initialWallet?: AdminWalletRow | null;
  initialTransactions?: AdminWalletTxRow[];
  initialWalletAddresses?: Record<string, string>;
  onWalletUpdated?: (wallet: AdminWalletRow, transactions: AdminWalletTxRow[]) => void;
}

function parseCoinsJson(raw?: string): Record<string, number> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export const AdminWalletView: React.FC<AdminWalletViewProps> = ({
  adminPin,
  adminEmail,
  adminSessionToken,
  coins,
  salomaFees,
  usdToMga,
  showToast,
  initialWallet = null,
  initialTransactions = [],
  initialWalletAddresses = {},
  onWalletUpdated
}) => {
  const [walletRow, setWalletRow] = useState<AdminWalletRow | null>(initialWallet);
  const [txList, setTxList] = useState<AdminWalletTxRow[]>(initialTransactions);
  const [walletAddresses, setWalletAddresses] = useState<Record<string, string>>(initialWalletAddresses);
  const [displayCurrency, setDisplayCurrency] = useState<'MGA' | 'USD'>('MGA');
  const [loading, setLoading] = useState<boolean>(false);

  const [activeModal, setActiveModal] = useState<'deposit' | 'withdraw' | 'convert' | 'clearHistory' | null>(null);

  const [selectedWalletCoinId, setSelectedWalletCoinId] = useState<string>('usdt');
  const [selectedNetworkIndex, setSelectedNetworkIndex] = useState<number>(0);
  const [isWalletCoinDropdownOpen, setIsWalletCoinDropdownOpen] = useState<boolean>(false);
  const [walletCoinSearchTerm, setWalletCoinSearchTerm] = useState<string>('');

  const [depositAmountInput, setDepositAmountInput] = useState<string>('');
  const [depositAccountInput, setDepositAccountInput] = useState<string>('');
  const [depositPreuveInput, setDepositPreuveInput] = useState<string>('');
  const [depositSubmitting, setDepositSubmitting] = useState<boolean>(false);
  const [copiedDepositAddress, setCopiedDepositAddress] = useState<boolean>(false);

  const [withdrawAmountInput, setWithdrawAmountInput] = useState<string>('');
  const [withdrawAccountInput, setWithdrawAccountInput] = useState<string>('');
  const [withdrawSubmitting, setWithdrawSubmitting] = useState<boolean>(false);

  const [convertDirection, setConvertDirection] = useState<'WALLET_TO_TRADE' | 'TRADE_TO_WALLET'>('WALLET_TO_TRADE');
  const [convertAmountInput, setConvertAmountInput] = useState<string>('');
  const [convertSubmitting, setConvertSubmitting] = useState<boolean>(false);

  const [clearingHistory, setClearingHistory] = useState<boolean>(false);

  useEffect(() => {
    if (initialWallet) setWalletRow(initialWallet);
  }, [initialWallet]);

  useEffect(() => {
    if (Array.isArray(initialTransactions)) setTxList(initialTransactions);
  }, [initialTransactions]);

  useEffect(() => {
    if (initialWalletAddresses && Object.keys(initialWalletAddresses).length > 0) {
      setWalletAddresses(initialWalletAddresses);
    }
  }, [initialWalletAddresses]);

  const loadAdminWallet = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{
        wallet: AdminWalletRow;
        transactions: AdminWalletTxRow[];
        walletAddresses?: Record<string, string>;
      }>('/api/admin/wallet', {
        adminPin,
        adminEmail,
        adminToken: adminSessionToken
      });
      if (data.wallet) setWalletRow(data.wallet);
      if (Array.isArray(data.transactions)) setTxList(data.transactions);
      if (data.walletAddresses && typeof data.walletAddresses === 'object') {
        setWalletAddresses(data.walletAddresses);
      }
      if (data.wallet) {
        onWalletUpdated?.(data.wallet, data.transactions || []);
      }
    } catch {
      // keep existing state when transient error occurs
    } finally {
      setLoading(false);
    }
  }, [adminPin, adminEmail, adminSessionToken, onWalletUpdated]);

  useEffect(() => {
    void loadAdminWallet();
  }, [loadAdminWallet]);

  const soldeDisponibleAr = Number(walletRow?.solde_disponible) || 0;
  const soldeCompteTradeAr = Number(walletRow?.compte_trade) || 0;
  const soldeBloqueAr = Number(walletRow?.solde_bloque) || 0;
  const soldeTotalAr =
    Number(walletRow?.solde_total) || soldeDisponibleAr + soldeCompteTradeAr + soldeBloqueAr;
  const coinsJson = useMemo(() => parseCoinsJson(walletRow?.coins_json), [walletRow?.coins_json]);
  const adminUsdtBalance = Number(coinsJson['USDT'] || 0);

  const formatMoney = useCallback(
    (mga: number, currency = displayCurrency) => {
      if (currency === 'USD') {
        const usd = mga / usdToMga;
        return `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
      return `${Math.round(mga).toLocaleString('fr-FR')} Ar`;
    },
    [displayCurrency, usdToMga]
  );

  const selectedWalletCoin = useMemo(
    () => coins.find(c => c.id === selectedWalletCoinId) || coins.find(c => c.id === 'usdt') || coins[0],
    [coins, selectedWalletCoinId]
  );

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
  const activeAdminDepositAddress = useMemo(
    () => resolveWalletAddressForChain(walletAddresses, activeNetwork.chain, selectedWalletCoin.symbol),
    [walletAddresses, activeNetwork.chain, selectedWalletCoin.symbol]
  );

  const activeMinCoinQty = useMemo(
    () =>
      computeMinCoinForUsd(selectedWalletCoin.price, selectedWalletCoin.symbol, MIN_WITHDRAW_USD) ||
      activeNetwork.minWithdraw,
    [selectedWalletCoin.price, selectedWalletCoin.symbol, activeNetwork.minWithdraw]
  );
  const activeMinCoinQtyLabel = useMemo(() => formatMinCoinQty(activeMinCoinQty), [activeMinCoinQty]);

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

  const handleOpenDeposit = () => {
    setIsWalletCoinDropdownOpen(false);
    setWalletCoinSearchTerm('');
    setCopiedDepositAddress(false);
    setActiveModal('deposit');
  };

  const handleOpenWithdraw = () => {
    setIsWalletCoinDropdownOpen(false);
    setWalletCoinSearchTerm('');
    setActiveModal('withdraw');
  };

  const handleConfirmDepositRequest = async () => {
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
      const res = await apiRequest<{
        wallet: AdminWalletRow;
        transaction: AdminWalletTxRow;
        transactions: AdminWalletTxRow[];
      }>('/api/admin/wallet/deposit', {
        method: 'POST',
        adminPin,
        adminEmail,
        adminToken: adminSessionToken,
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
      setWalletRow(res.wallet);
      setTxList(res.transactions || [res.transaction, ...txList]);
      onWalletUpdated?.(res.wallet, res.transactions || [res.transaction, ...txList]);
      setDepositAmountInput('');
      setDepositAccountInput('');
      setDepositPreuveInput('');
      setActiveModal(null);
      showToast('✓ Dépôt Admin crédité sur votre Portefeuille Admin');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors du dépôt Admin.');
    } finally {
      setDepositSubmitting(false);
    }
  };

  const handleConfirmWithdraw = async () => {
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
    if (!withdrawAccountInput.trim() || withdrawAccountInput.trim().length < 6) {
      showToast(
        `Veuillez entrer une adresse de réception ${coinSym} (${activeBlockchain} • ${activeNetworkLabel}) valide.`
      );
      return;
    }
    if (isKnownTokenContractAddress(withdrawAccountInput)) {
      showToast('Adresse refusée : ceci est une adresse de contrat token, pas une adresse wallet.');
      return;
    }

    setWithdrawSubmitting(true);
    try {
      const res = await apiRequest<{
        wallet: AdminWalletRow;
        transaction: AdminWalletTxRow;
        transactions: AdminWalletTxRow[];
      }>('/api/admin/wallet/withdraw', {
        method: 'POST',
        adminPin,
        adminEmail,
        adminToken: adminSessionToken,
        body: {
          montant: amt,
          methode: 'Crypto',
          numero_compte: withdrawAccountInput.trim(),
          devise: coinSym,
          chain: activeBlockchain,
          networkCode: activeNetwork.chain,
          networkLabel: activeNetworkLabel,
          priceUsd: selectedWalletCoin.price || 0
        }
      });
      setWalletRow(res.wallet);
      setTxList(res.transactions || [res.transaction, ...txList]);
      onWalletUpdated?.(res.wallet, res.transactions || [res.transaction, ...txList]);
      setWithdrawAmountInput('');
      setWithdrawAccountInput('');
      setActiveModal(null);
      showToast('✓ Retrait Admin enregistré');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors du retrait Admin.');
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  const handleConfirmConvertWalletTrade = async () => {
    const amt = Math.round(Number(convertAmountInput));
    if (isNaN(amt) || amt < 100) {
      showToast('Montant minimum de conversion : 100 Ar.');
      return;
    }
    const maxAvail = convertDirection === 'WALLET_TO_TRADE' ? soldeDisponibleAr : soldeCompteTradeAr;
    if (amt > maxAvail) {
      showToast(
        convertDirection === 'WALLET_TO_TRADE'
          ? 'Solde WALLET Admin insuffisant.'
          : 'Solde COMPTE TRADE Admin insuffisant.'
      );
      return;
    }

    setConvertSubmitting(true);
    try {
      const res = await apiRequest<{ wallet: AdminWalletRow }>('/api/admin/wallet/convert', {
        method: 'POST',
        adminPin,
        adminEmail,
        adminToken: adminSessionToken,
        body: {
          direction: convertDirection,
          amount: amt
        }
      });
      setWalletRow(res.wallet);
      onWalletUpdated?.(res.wallet, txList);
      setConvertAmountInput('');
      setActiveModal(null);
      showToast(
        convertDirection === 'WALLET_TO_TRADE'
          ? `✓ ${amt.toLocaleString('fr-FR')} Ar transféré vers Compte Trade Admin !`
          : `✓ ${amt.toLocaleString('fr-FR')} Ar transféré vers Wallet Admin !`
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de la conversion.');
    } finally {
      setConvertSubmitting(false);
    }
  };

  const handleClearAdminWalletHistory = async () => {
    setClearingHistory(true);
    try {
      await apiRequest<{ ok: boolean }>('/api/admin/wallet/history', {
        method: 'DELETE',
        adminPin,
        adminEmail,
        adminToken: adminSessionToken
      });
      setTxList([]);
      if (walletRow) onWalletUpdated?.(walletRow, []);
      setActiveModal(null);
      showToast('✓ Historique Portefeuille Admin supprimé');
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erreur lors de la suppression de l'historique.");
    } finally {
      setClearingHistory(false);
    }
  };

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
            <span
              className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[10px] border shrink-0 ${selectedWalletCoin.iconBg}`}
            >
              {selectedWalletCoin.symbol.slice(0, 3)}
            </span>
            <span className="truncate">
              {selectedWalletCoin.symbol} • {selectedWalletCoin.name}
            </span>
          </span>
          <ChevronDown
            className={`w-4 h-4 text-purple-300 shrink-0 transition-transform ${
              isWalletCoinDropdownOpen ? 'rotate-180' : ''
            }`}
          />
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
          <label className="text-[11px] font-bold text-purple-300 block mb-1">2. Chaîne :</label>
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
            className="w-full px-2.5 py-2.5 rounded-xl bg-[#150D2E] border-2 border-[#8B5CF6]/50 text-white text-xs font-bold focus:outline-none focus:border-[#8B5CF6]"
          >
            {availableBlockchains.map(chainName => (
              <option key={chainName} value={chainName}>
                {chainName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold text-purple-300 block mb-1">3. Réseau :</label>
          <select
            value={selectedNetworkIndex}
            onChange={e => {
              setSelectedNetworkIndex(Number(e.target.value));
              setCopiedDepositAddress(false);
            }}
            className="w-full px-2.5 py-2.5 rounded-xl bg-[#150D2E] border-2 border-[#8B5CF6]/50 text-white text-xs font-bold focus:outline-none focus:border-[#8B5CF6]"
          >
            {selectedWalletCoin.networks.map((net, idx) => (
              <option key={`${net.chain}-${idx}`} value={idx}>
                {getNetworkShortLabel(net)} • {net.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-3xl bg-gradient-to-br from-[#2D165A] via-[#1F1042] to-[#150D2E] border-2 border-[#8B5CF6] shadow-[0_0_25px_rgba(124,58,237,0.5)]">
        <div className="flex justify-between items-start mb-2">
          <span className="text-xs font-bold text-purple-300">
            Solde Total Portefeuille{loading ? ' • Sync...' : ''}
          </span>
          <button
            type="button"
            onClick={() => setDisplayCurrency(displayCurrency === 'MGA' ? 'USD' : 'MGA')}
            className="px-2.5 py-0.5 rounded-full bg-purple-900/60 text-[10px] text-purple-200 border border-purple-400/40 font-bold"
          >
            {displayCurrency === 'MGA' ? 'Afficher en USD' : 'Afficher en Ariary'}
          </button>
        </div>
        <h1 className="text-3xl font-black text-white font-mono">{formatMoney(soldeTotalAr)}</h1>
        <p className="text-xs font-bold text-purple-300 font-mono mt-0.5">
          ≈ {formatMoney(soldeTotalAr, displayCurrency === 'MGA' ? 'USD' : 'MGA')} •{' '}
          {adminUsdtBalance.toFixed(2)} USDT SALOMA
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
              {adminUsdtBalance.toFixed(4)} USDT SALOMA
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

      {/* Soldes Cryptos réels de l'Admin depuis coins_json (50 COINS) */}
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
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs border shrink-0 ${coin.iconBg}`}
                >
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

      {/* Historique réel des dépôts et retraits Admin */}
      <div className="p-3.5 rounded-2xl bg-[#1D1240] border border-[#8B5CF6]/40 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-black text-white">
            Historique Dépôts &amp; Retraits ({txList.length})
          </span>
          {txList.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveModal('clearHistory')}
              className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/50 text-rose-300 text-[10px] font-black inline-flex items-center gap-1 transition"
            >
              <Trash2 className="w-3 h-3" />
              <span>Tout supprimer</span>
            </button>
          )}
        </div>

        {txList.length === 0 ? (
          <div className="p-3 rounded-xl bg-[#150D2E] text-center text-[11px] text-purple-400 border border-purple-500/20">
            Aucune transaction enregistrée
          </div>
        ) : (
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {txList.map(tx => (
              <div
                key={tx.$id}
                className="p-2.5 rounded-xl bg-[#150D2E] flex justify-between items-center text-[11px] border border-purple-500/20"
              >
                <div className="min-w-0 pr-2">
                  <span className="font-bold text-white uppercase block truncate">
                    {tx.type} • {Number(tx.montant).toLocaleString('fr-FR')} {tx.devise}
                  </span>
                  <span className="text-[10px] text-purple-400 block truncate">
                    {tx.methode} ({tx.numero_compte}) •{' '}
                    {tx.date ? new Date(tx.date).toLocaleString('fr-FR') : ''}
                  </span>
                </div>
                <span
                  className={`font-mono font-bold px-2 py-0.5 rounded text-[10px] shrink-0 ${
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

      {/* MODAL: DÉPÔT CRYPTO ADMIN */}
      {activeModal === 'deposit' && (
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
              <h3 className="font-black text-white text-base">Dépôt Crypto SALOMA</h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-lg bg-[#23154D] text-purple-300"
              >
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
                {activeAdminDepositAddress || 'Génération de votre adresse wallet...'}
              </span>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-purple-300 pt-1">
                <div className="text-left font-mono space-y-0.5">
                  <span className="block text-emerald-300 font-bold">
                    Min Dépôt : 1$ équivalent (ex: 1 USDT)
                  </span>
                  <span className="block text-purple-200">
                    Min {selectedWalletCoin.symbol} : {activeMinDepositCoinQtyLabel} {selectedWalletCoin.symbol}
                  </span>
                  <span className="block text-purple-400">
                    Coût réseau : {activeNetwork.withdrawFee} {selectedWalletCoin.symbol}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={!activeAdminDepositAddress}
                  onClick={() => {
                    if (!activeAdminDepositAddress) return;
                    navigator.clipboard?.writeText(activeAdminDepositAddress);
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
                <label className="font-bold text-purple-300 block mb-1">
                  Note / Adresse expéditrice (optionnel)
                </label>
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

      {/* MODAL: CONVERTIR ADMIN WALLET ⇄ COMPTE TRADE */}
      {activeModal === 'convert' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#1D1240] border-2 border-[#8B5CF6] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-lg bg-[#23154D] text-purple-300"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h3 className="font-black text-white text-base">Convertir Wallet ⇄ Compte Trade</h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-lg bg-[#23154D] text-purple-300"
              >
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
                <span className="text-purple-300">
                  De ({convertDirection === 'WALLET_TO_TRADE' ? 'WALLET' : 'COMPTE TRADE'}) :
                </span>
                <span className="font-mono font-black text-emerald-400">
                  {Math.round(
                    convertDirection === 'WALLET_TO_TRADE' ? soldeDisponibleAr : soldeCompteTradeAr
                  ).toLocaleString('fr-FR')}{' '}
                  Ar
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-purple-300">
                  Vers ({convertDirection === 'WALLET_TO_TRADE' ? 'COMPTE TRADE' : 'WALLET'}) :
                </span>
                <span className="font-mono font-bold text-white">
                  {Math.round(
                    convertDirection === 'WALLET_TO_TRADE' ? soldeCompteTradeAr : soldeDisponibleAr
                  ).toLocaleString('fr-FR')}{' '}
                  Ar
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
                placeholder="Ex: 50000"
                className="w-full px-3 py-2.5 rounded-xl bg-[#150D2E] border-2 border-[#8B5CF6]/40 text-white font-mono font-bold"
              />
              <div className="grid grid-cols-4 gap-1.5">
                {[25, 50, 75, 100].map(pct => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      const maxAvail =
                        convertDirection === 'WALLET_TO_TRADE'
                          ? soldeDisponibleAr
                          : soldeCompteTradeAr;
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

      {/* MODAL: RETRAIT CRYPTO ADMIN */}
      {activeModal === 'withdraw' && (
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
              <h3 className="font-black text-white text-base">Retrait Crypto SALOMA (WALLET)</h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-lg bg-[#23154D] text-purple-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[#150D2E] border border-purple-500/30 flex justify-between text-xs">
              <span className="text-purple-300">Solde WALLET retirable :</span>
              <span className="font-mono font-black text-emerald-400">
                {(coinsJson[selectedWalletCoin.symbol.toUpperCase()] || 0).toFixed(6)}{' '}
                {selectedWalletCoin.symbol} ({Math.round(soldeDisponibleAr).toLocaleString('fr-FR')} Ar)
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
                        const maxEquiv = soldeDisponibleAr / (cPrice * usdToMga);
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
                  {activeAdminDepositAddress && (
                    <button
                      type="button"
                      onClick={() => setWithdrawAccountInput(activeAdminDepositAddress)}
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

              {(() => {
                const amt = parseFloat(withdrawAmountInput) || 0;
                const salomaFee = amt * ((salomaFees.withdrawFeePct || 0.15) / 100);
                const netFee = effectiveWalletNetworkFee;
                const totalFrais = salomaFee + netFee;
                const netRec = Math.max(0, amt - totalFrais);
                return (
                  <div className="p-3 rounded-xl bg-[#100926] border border-amber-500/40 space-y-1.5 text-[11px]">
                    <div className="text-[10px] font-mono font-bold text-amber-300 pb-1 border-b border-purple-500/20">
                      Retrait : Frais SALOMA {salomaFees.withdrawFeePct}% + Frais Réseau {netFee}{' '}
                      {selectedWalletCoin.symbol}
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

      {/* MODAL: CONFIRMATION SUPPRESSION HISTORIQUE ADMIN */}
      {activeModal === 'clearHistory' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1D1240] border-2 border-rose-500/70 w-full max-w-sm rounded-3xl p-5 space-y-4">
            <h3 className="font-black text-white text-sm">Supprimer l&apos;historique ?</h3>
            <p className="text-xs text-purple-200 leading-relaxed">
              Voulez-vous supprimer tout l&apos;historique des dépôts et retraits de votre Portefeuille Admin ?
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="py-2.5 rounded-xl bg-[#150D2E] border border-purple-500/40 text-purple-200 font-bold"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={clearingHistory}
                onClick={handleClearAdminWalletHistory}
                className="py-2.5 rounded-xl bg-rose-600 text-white font-black disabled:opacity-60"
              >
                {clearingHistory ? 'Suppression...' : 'Tout supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
