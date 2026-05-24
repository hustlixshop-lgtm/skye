import { useState } from 'react';
import { MapPin, DollarSign, Clock, Star, CheckCircle, XCircle, Shield, Tag, ChevronDown, ChevronUp, Navigation, Zap } from 'lucide-react';
import type { GigMatch } from '../lib/supabase';

type Props = {
  match: GigMatch;
  gigLocked?: boolean;
  chosenWorker?: boolean;
  onAccept: (matchId: string) => void;
  onDecline: (matchId: string) => void;
  onReleaseEscrow?: (matchId: string) => void;
};

export function MatchCard({ match, gigLocked, chosenWorker, onAccept, onDecline, onReleaseEscrow }: Props) {
  const [showReasoning, setShowReasoning] = useState(false);

  const scoreColor = match.match_score >= 90
    ? 'text-brand-400 bg-brand-500/15 border-brand-500/30'
    : match.match_score >= 75
    ? 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30'
    : match.match_score >= 60
    ? 'text-accent-400 bg-accent-500/15 border-accent-500/30'
    : 'text-rose-400 bg-rose-500/15 border-rose-500/30';

  const escrowMap: Record<string, { label: string; color: string }> = {
    pending: { label: 'Escrow: Pending', color: 'text-surface-400 bg-surface-700/50' },
    held: { label: 'Escrow: Held', color: 'text-accent-400 bg-accent-500/10' },
    released: { label: 'Escrow: Released', color: 'text-brand-400 bg-brand-500/10' },
    disputed: { label: 'Escrow: Disputed', color: 'text-rose-400 bg-rose-500/10' },
  };
  const escrowBadge = escrowMap[match.escrow_status];

  const isDecided = match.decision !== null;
  const isGreyed = gigLocked && !chosenWorker;

  return (
    <div className={`rounded-xl border p-4 transition-all animate-slide-up ${isGreyed ? 'border-surface-700/20 bg-surface-900/20 opacity-40 pointer-events-none' : match.decision === 'accepted' ? 'border-brand-500/40 bg-brand-500/5' : match.decision === 'rejected' ? 'border-surface-700/30 bg-surface-800/20 opacity-50' : 'border-surface-700/50 bg-surface-800/40 hover:border-surface-600 card-hover'}`}>

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-white font-semibold text-sm truncate">{match.matched_user_name}</h4>
            {match.decision === 'accepted' && (
              <span className="flex items-center gap-1 text-xs text-brand-400 font-medium">
                <CheckCircle className="w-3 h-3" /> Chosen
              </span>
            )}
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-surface-400">
            <Tag className="w-3 h-3 text-brand-400" />
            {match.category}
          </span>
        </div>
        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold ml-3 flex-shrink-0 ${scoreColor}`}>
          <Star className="w-3 h-3 fill-current" />
          {match.match_score}%
        </div>
      </div>

      {/* Interest Tags */}
      {match.interest_tags && match.interest_tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {match.interest_tags.map((tag) => (
            <span key={tag} className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-brand-500/10 text-brand-300 border border-brand-500/20">
              {tag}
            </span>
          ))}
        </div>
      )}

      <p className="text-xs text-surface-400 mb-3 line-clamp-2">{match.description}</p>

      <div className="flex flex-wrap gap-3 mb-3">
        <div className="flex items-center gap-1.5 text-xs text-surface-400">
          <DollarSign className="w-3.5 h-3.5 text-brand-400" />
          <span>${match.pay_min} - ${match.pay_max}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-surface-400">
          <MapPin className="w-3.5 h-3.5 text-cyan-400" />
          <span>{match.campus_location}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-surface-400">
          <Clock className="w-3.5 h-3.5 text-accent-400" />
          <span>{match.walk_time_mins} min walk</span>
        </div>
        {match.distance_miles != null && (
          <div className="flex items-center gap-1.5 text-xs text-surface-400">
            <Navigation className="w-3.5 h-3.5 text-brand-400" />
            <span>{match.distance_miles} mi away</span>
          </div>
        )}
      </div>

      {/* Escrow badge */}
      {match.decision === 'accepted' && escrowBadge && (
        <div className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg mb-3 ${escrowBadge.color}`}>
          <Shield className="w-3 h-3" /> {escrowBadge.label}
        </div>
      )}



      {/* Algorithmic Reasoning Panel */}
      {match.reasoning && (
        <div className="mb-3">
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 font-medium transition-all"
          >
            <Zap className="w-3 h-3" />
            {showReasoning ? 'Hide' : 'Show'} Algorithmic Reasoning
            {showReasoning ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showReasoning && (
            <div className="mt-2 p-3 bg-surface-900/80 border border-surface-700/50 rounded-lg font-mono text-[11px] space-y-2 animate-slide-up">
              <div className="flex items-center justify-between">
                <span className="text-surface-400">Interest Similarity Weight</span>
                <span className="text-brand-400 font-semibold">{match.reasoning.interest_similarity_weight}%</span>
              </div>
              <div className="w-full h-1.5 bg-surface-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-full" style={{ width: `${match.reasoning.interest_similarity_weight}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-surface-400">Distance Penalization Factor</span>
                <span className="text-cyan-400 font-semibold">{match.reasoning.distance_penalization_factor}%</span>
              </div>
              <div className="w-full h-1.5 bg-surface-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full" style={{ width: `${match.reasoning.distance_penalization_factor}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-surface-400">Agent Contextual Boost</span>
                <span className="text-accent-400 font-semibold">{match.reasoning.contextual_boost}%</span>
              </div>
              <div className="w-full h-1.5 bg-surface-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-accent-500 to-accent-400 rounded-full" style={{ width: `${match.reasoning.contextual_boost}%` }} />
              </div>
              <p className="text-surface-500 pt-1 leading-relaxed">{match.reasoning.details}</p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {!isDecided && !gigLocked ? (
        <div className="flex gap-2 mt-3">
          <button onClick={() => onAccept(match.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gradient-to-r from-brand-500 to-cyan-500 hover:from-brand-400 hover:to-cyan-400 text-white text-xs font-bold rounded-lg transition-all shadow-sm shadow-brand-500/20">
            <CheckCircle className="w-3.5 h-3.5" /> Accept
          </button>
          <button onClick={() => onDecline(match.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-surface-700 hover:bg-surface-600 border border-surface-600 text-surface-300 text-xs font-bold rounded-lg transition-all">
            <XCircle className="w-3.5 h-3.5" /> Decline
          </button>
        </div>
      ) : match.decision === 'accepted' && match.escrow_status === 'held' && onReleaseEscrow ? (
        <button onClick={() => onReleaseEscrow(match.id)}
          className="w-full mt-3 py-2.5 border border-brand-500/40 text-brand-400 hover:bg-brand-500/10 text-xs font-bold rounded-lg transition-all">
          Release Escrow Payment
        </button>
      ) : null}
    </div>
  );
}
