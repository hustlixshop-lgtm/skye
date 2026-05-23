import React from 'react';
import { MapPin, Clock, DollarSign, Star, CheckCircle, XCircle, Shield, Tag } from 'lucide-react';
import type { GigMatch } from '../lib/supabase';

type Props = {
  match: GigMatch;
  onAccept: (matchId: string) => void;
  onDecline: (matchId: string) => void;
  onReleaseEscrow?: (matchId: string) => void;
};

export function MatchCard({ match, onAccept, onDecline, onReleaseEscrow }: Props) {
  const scoreColor =
    match.match_score >= 90
      ? 'text-emerald-400 bg-emerald-400/10 border-emerald-500/30'
      : match.match_score >= 80
      ? 'text-cyan-400 bg-cyan-400/10 border-cyan-500/30'
      : match.match_score >= 70
      ? 'text-amber-400 bg-amber-400/10 border-amber-500/30'
      : 'text-rose-400 bg-rose-400/10 border-rose-500/30';

  const escrowBadge = {
    pending: { label: 'Escrow: Pending', color: 'text-slate-400 bg-slate-700/50' },
    held: { label: 'Escrow: Held', color: 'text-amber-400 bg-amber-400/10' },
    released: { label: 'Escrow: Released', color: 'text-emerald-400 bg-emerald-400/10' },
    disputed: { label: 'Escrow: Disputed', color: 'text-rose-400 bg-rose-400/10' },
  }[match.escrow_status];

  const isDecided = match.decision !== null;

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        match.decision === 'accepted'
          ? 'border-emerald-500/40 bg-emerald-500/5'
          : match.decision === 'rejected'
          ? 'border-slate-700/30 bg-slate-800/20 opacity-50'
          : 'border-slate-700/60 bg-slate-800/40 hover:border-slate-600'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-white font-semibold text-sm truncate">{match.matched_user_name}</h4>
            {match.decision === 'accepted' && (
              <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                <CheckCircle className="w-3 h-3" /> Accepted
              </span>
            )}
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
            <Tag className="w-3 h-3" />
            {match.category}
          </span>
        </div>
        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold ml-3 flex-shrink-0 ${scoreColor}`}>
          <Star className="w-3 h-3 fill-current" />
          {match.match_score}% match
        </div>
      </div>

      {/* Details */}
      <p className="text-xs text-slate-400 mb-3 line-clamp-2">{match.description}</p>

      <div className="flex flex-wrap gap-3 mb-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          <span>${match.pay_min}–${match.pay_max}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <MapPin className="w-3.5 h-3.5 text-blue-400" />
          <span>{match.campus_location}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>{match.walk_time_mins} min walk</span>
        </div>
      </div>

      {/* Escrow badge */}
      {match.decision === 'accepted' && (
        <div className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg mb-3 ${escrowBadge.color}`}>
          <Shield className="w-3 h-3" />
          {escrowBadge.label}
        </div>
      )}

      {/* Actions */}
      {!isDecided ? (
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => onAccept(match.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white text-xs font-semibold rounded-lg transition-all shadow-sm shadow-emerald-500/20"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Accept
          </button>
          <button
            onClick={() => onDecline(match.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 text-xs font-semibold rounded-lg transition-all"
          >
            <XCircle className="w-3.5 h-3.5" />
            Decline
          </button>
        </div>
      ) : match.decision === 'accepted' && match.escrow_status === 'held' && onReleaseEscrow ? (
        <button
          onClick={() => onReleaseEscrow(match.id)}
          className="w-full mt-3 py-2 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 text-xs font-semibold rounded-lg transition-all"
        >
          Release Escrow Payment
        </button>
      ) : null}
    </div>
  );
}
