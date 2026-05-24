import { useState } from 'react';
import { ArrowLeft, DollarSign, Wallet as WalletIcon2, TrendingUp, TrendingDown, Shield, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import type { Wallet as WalletType, WalletTransaction } from '../lib/supabase';

type Props = {
  wallet: WalletType | null;
  transactions: WalletTransaction[];
  totalEscrow: number;
  onDeposit: (amount: number) => Promise<{ error: string | null | unknown }>;
  onBack: () => void;
};

export function WalletPage({ wallet, transactions, totalEscrow, onDeposit, onBack }: Props) {
  const [depositAmount, setDepositAmount] = useState('');
  const [depositing, setDepositing] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const balance = wallet?.balance ?? 0;

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      setDepositError('Enter a valid amount');
      return;
    }
    setDepositing(true);
    setDepositError(null);
    const result = await onDeposit(amount);
    setDepositing(false);
    if (result.error) {
      setDepositError(String(result.error));
    } else {
      setDepositAmount('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    }
  };

  const typeIcon = (type: WalletTransaction['type']) => {
    switch (type) {
      case 'deposit': return <TrendingUp className="w-4 h-4 text-emerald-400" />;
      case 'escrow_hold': return <Shield className="w-4 h-4 text-amber-400" />;
      case 'escrow_release': return <CheckCircle className="w-4 h-4 text-blue-400" />;
      case 'escrow_refund': return <TrendingDown className="w-4 h-4 text-cyan-400" />;
      case 'payment_sent': return <TrendingDown className="w-4 h-4 text-rose-400" />;
      case 'payment_received': return <TrendingUp className="w-4 h-4 text-emerald-400" />;
    }
  };

  const typeLabel: Record<WalletTransaction['type'], string> = {
    deposit: 'Deposit',
    escrow_hold: 'Escrow Held',
    escrow_release: 'Escrow Released',
    escrow_refund: 'Escrow Refund',
    payment_sent: 'Payment Sent',
    payment_received: 'Payment Received',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-cyan-900/8 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800/60 bg-slate-900/30 backdrop-blur-sm">
          <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg transition-all">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-white">Wallet</h2>
            <p className="text-xs text-slate-400">Simulated balance & transactions</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto p-6 space-y-6">
            {/* Balance Card */}
            <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-xl flex items-center justify-center">
                  <WalletIcon2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Available Balance</p>
                  <p className="text-3xl font-bold text-white">${balance.toFixed(2)}</p>
                </div>
              </div>

              {totalEscrow > 0 && (
                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-400" />
                    <span className="text-sm text-amber-400">Escrow: ${totalEscrow.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Funds held in trust for active gigs</p>
                </div>
              )}

              {/* Deposit */}
              <div className="mt-4 pt-4 border-t border-slate-700/50">
                <label className="block text-sm font-medium text-slate-300 mb-2">Add Funds (Simulated)</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => { setDepositAmount(e.target.value); setDepositError(null); }}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all"
                    />
                  </div>
                  <button
                    onClick={handleDeposit}
                    disabled={depositing || !depositAmount}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed rounded-xl text-white text-sm font-semibold transition-all shadow-sm shadow-emerald-500/20 disabled:shadow-none"
                  >
                    {depositing ? 'Adding...' : success ? 'Added!' : 'Add'}
                  </button>
                </div>
                {depositError && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-rose-400">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {depositError}
                  </div>
                )}
                <div className="flex gap-2 mt-3">
                  {[10, 25, 50, 100, 250].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setDepositAmount(String(amt))}
                      className="px-3 py-1.5 text-xs bg-slate-800/60 hover:bg-slate-700 border border-slate-700/50 rounded-lg text-slate-300 hover:text-white transition-all"
                    >
                      ${amt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Transaction History */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Transaction History</h3>
              {transactions.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No transactions yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center gap-3 p-3 bg-slate-800/40 border border-slate-700/40 rounded-xl">
                      <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
                        {typeIcon(tx.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium">{typeLabel[tx.type]}</p>
                        <p className="text-xs text-slate-500 truncate">{tx.description}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-sm font-semibold ${
                          tx.type === 'deposit' || tx.type === 'payment_received' || tx.type === 'escrow_refund'
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }`}>
                          {tx.type === 'deposit' || tx.type === 'payment_received' || tx.type === 'escrow_refund' ? '+' : '-'}${tx.amount.toFixed(2)}
                        </p>
                        <p className="text-xs text-slate-600">{new Date(tx.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
