import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, Shield, DollarSign, Briefcase, Timer, RotateCcw, User } from 'lucide-react';
import type { Gig, GigMatch, UserProfile, Notification } from '../lib/supabase';

type Props = {
  profile: UserProfile;
  activeGigs: Gig[];
  matches: GigMatch[];
  wallet: { balance: number } | null;
  notifications: Notification[];
  onMarkComplete: (gigId: string, matchId: string) => Promise<void>;
  onApprovePayment: (gigId: string, matchId: string, amount: number, recipientId: string) => Promise<void>;
  onRequestRedo: (gigId: string, matchId: string) => Promise<void>;

  onBack: () => void;
};

function formatDuration(ms: number): string {
  const hrs = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function ContractorPortal({ profile, activeGigs, matches, wallet, notifications, onMarkComplete, onApprovePayment, onRequestRedo, onBack }: Props) {
  const [timers, setTimers] = useState<Record<string, number>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Timer for in-progress gigs
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers((prev) => {
        const next = { ...prev };
        for (const gig of activeGigs) {
          if (gig.status === 'matched' || gig.status === 'in_progress') {
            next[gig.id] = (prev[gig.id] || 0) + 1000;
          }
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeGigs]);

  const acceptedMatches = matches.filter((m) => m.decision === 'accepted');
  const matchedGigs = activeGigs.filter((g) => g.status === 'matched' || g.status === 'in_progress');

  // Find gigs where contractor marked complete (pending approval)
  const pendingApprovalNotifs = notifications.filter((n) => n.type === 'gig_completion_pending');

  const handleAction = async (action: string, fn: () => Promise<void>) => {
    setActionLoading(action);
    await fn();
    setActionLoading(null);
  };

  return (
    <div className="h-screen bg-surface-950 flex flex-col">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand-900/8 via-transparent to-transparent pointer-events-none" />

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-700/40 glass-light relative z-10">
        <button onClick={onBack} className="p-2 hover:bg-surface-800 rounded-lg transition-all">
          <ArrowLeft className="w-5 h-5 text-surface-400" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-accent-400 to-accent-600 rounded-xl flex items-center justify-center">
            <Briefcase className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Contractor Portal</h2>
            <p className="text-xs text-surface-400">Manage your active gigs</p>
          </div>
        </div>
        {wallet && (
          <div className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-brand-500/10 border border-brand-500/20 rounded-lg">
            <DollarSign className="w-3.5 h-3.5 text-brand-400" />
            <span className="text-xs text-brand-400 font-semibold">${wallet.balance.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4 relative z-10">
        {matchedGigs.length === 0 && acceptedMatches.length === 0 && pendingApprovalNotifs.length === 0 ? (
          <div className="text-center py-16">
            <Briefcase className="w-16 h-16 text-surface-700 mx-auto mb-4" />
            <p className="text-surface-400 text-lg font-medium">No active gigs</p>
            <p className="text-surface-600 text-sm mt-1">Accepted gigs will appear here</p>
          </div>
        ) : (
          <>
            {/* Pending Approval Section (for the user who posted) */}
            {pendingApprovalNotifs.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-accent-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Pending Your Approval
                </h3>
                {pendingApprovalNotifs.map((notif) => {
                  const gigId = notif.reference_id || '';
                  const gig = activeGigs.find((g) => g.id === gigId);
                  const match = acceptedMatches.find((m) => m.gig_id === gigId);
                  if (!gig || !match) return null;
                  return (
                    <div key={notif.id} className="p-4 bg-accent-500/5 border border-accent-500/30 rounded-xl mb-3 animate-slide-up">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-4 h-4 text-accent-400" />
                        <h4 className="text-white font-semibold text-sm">{gig.title}</h4>
                      </div>
                      <p className="text-xs text-surface-400 mb-3">{notif.body}</p>
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="w-3.5 h-3.5 text-accent-400" />
                        <span className="text-xs text-accent-400">Escrow: ${gig.escrow_amount.toFixed(2)}</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleAction(`approve-${gigId}`, () => onApprovePayment(gigId, match!.id, gig!.escrow_amount, match!.matched_user_id))}
                          disabled={actionLoading !== null}
                          className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 rounded-lg text-white text-xs font-bold transition-all shadow-glow disabled:opacity-50">
                          <DollarSign className="w-3.5 h-3.5" /> Approve Payment
                        </button>
                        <button onClick={() => handleAction(`redo-${gigId}`, () => onRequestRedo(gigId, match!.id))}
                          disabled={actionLoading !== null}
                          className="flex items-center gap-1.5 px-4 py-2.5 bg-surface-700 hover:bg-surface-600 border border-surface-600 rounded-lg text-surface-300 text-xs font-bold transition-all disabled:opacity-50">
                          <RotateCcw className="w-3.5 h-3.5" /> Request Redo
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Active Gigs as Contractor */}
            {matchedGigs.map((gig) => {
              const match = acceptedMatches.find((m) => m.gig_id === gig.id);
              const timerMs = timers[gig.id] || 0;
              const isPostedByMe = gig.user_id === profile.user_id;

              return (
                <div key={gig.id} className="p-5 bg-surface-800/40 border border-surface-700/40 rounded-xl card-hover animate-slide-up">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${gig.status === 'in_progress' ? 'bg-brand-400 animate-pulse' : 'bg-cyan-400'}`} />
                      <span className="text-xs text-surface-400 font-semibold uppercase">{gig.status.replace('_', ' ')}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-700/50 rounded-lg">
                      <Timer className="w-3.5 h-3.5 text-brand-400" />
                      <span className="text-xs text-brand-400 font-mono font-semibold">{formatDuration(timerMs)}</span>
                    </div>
                  </div>

                  <h4 className="text-white font-bold text-base mb-1">{gig.title}</h4>
                  <p className="text-xs text-surface-400 mb-3">{gig.category} - {gig.campus_location || 'Campus'}</p>

                  <div className="flex flex-wrap gap-3 mb-3">
                    <span className="flex items-center gap-1.5 text-xs text-surface-400">
                      <DollarSign className="w-3.5 h-3.5 text-brand-400" />${gig.pay_min} - ${gig.pay_max}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-surface-400">
                      <Shield className="w-3.5 h-3.5 text-accent-400" />
                      Escrow: ${gig.escrow_amount.toFixed(2)} ({gig.escrow_held ? 'Held' : 'None'})
                    </span>
                  </div>

                  {match && (
                    <div className="flex items-center gap-2 mb-3 p-2 bg-surface-700/30 rounded-lg">
                      <User className="w-3.5 h-3.5 text-surface-500" />
                      <span className="text-xs text-surface-400">Worker: <span className="text-white font-medium">{match.matched_user_name}</span></span>
                    </div>
                  )}

                  {/* Contractor actions */}
                  {!isPostedByMe && match && gig.status !== 'completed' && (
                    <button onClick={() => handleAction(`complete-${gig.id}`, () => onMarkComplete(gig.id, match.id))}
                      disabled={actionLoading !== null}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-brand-500 to-cyan-500 hover:from-brand-400 hover:to-cyan-400 rounded-lg text-white text-xs font-bold transition-all shadow-glow disabled:opacity-50">
                      <CheckCircle className="w-3.5 h-3.5" /> Mark as Complete
                    </button>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
