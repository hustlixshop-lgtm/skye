import { useState } from 'react';
import { MapPin, DollarSign, Clock, Star, CheckCircle, XCircle, Shield, Tag, ChevronDown, ChevronUp, Navigation, Zap, Hourglass, BadgeCheck } from 'lucide-react';
import type { GigMatch } from '../lib/supabase';
import type { ContractorDecision } from '../lib/demoStore';

type Props = {
  match: GigMatch;
  gigLocked?: boolean;
  chosenWorker?: boolean;
  contractorDecision?: ContractorDecision;
  scheduledFor?: string | null;
  onAccept: (matchId: string) => void;
  onDecline: (matchId: string) => void;
  onReleaseEscrow?: (matchId: string) => void;
  onFinishAndPay?: (matchId: string) => void;
};

export function MatchCard({ match, gigLocked, chosenWorker, contractorDecision = 'pending', scheduledFor, onAccept, onDecline, onReleaseEscrow, onFinishAndPay }: Props) {
  const [showReasoning, setShowReasoning] = useState(false);

  const scoreBg = match.match_score >= 90
    ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-500/30'
    : match.match_score >= 75
    ? 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/30'
    : match.match_score >= 60
    ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
    : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30';

  const escrowMap: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pending', color: 'text-gray-400 bg-gray-100 dark:bg-gray-800' },
    held: { label: 'Held', color: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10' },
    released: { label: 'Released', color: 'text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10' },
    disputed: { label: 'Disputed', color: 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10' },
  };
  const escrowBadge = escrowMap[match.escrow_status];
  const isDecided = match.decision !== null;
  const isGreyed = gigLocked && !chosenWorker;

  return (
    <div className={`rounded-lg border p-3 transition-all ${
      isGreyed ? 'border-gray-100 dark:border-gray-800/30 bg-gray-50/50 dark:bg-gray-900/20 opacity-30 pointer-events-none' :
      match.decision === 'accepted' ? 'border-brand-300 dark:border-brand-500/30 bg-brand-50/50 dark:bg-brand-500/5' :
      match.decision === 'rejected' ? 'border-gray-100 dark:border-gray-800/30 bg-gray-50 dark:bg-gray-900/20 opacity-40' :
      'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 hover:border-brand-300 dark:hover:border-brand-700 card-hover'
    }`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <h4 className="text-sm text-gray-900 dark:text-white font-semibold truncate">{match.matched_user_name}</h4>
            {match.decision === 'accepted' && (
              <span className="flex items-center gap-0.5 text-[10px] text-brand-600 dark:text-brand-400 font-medium">
                <CheckCircle className="w-3 h-3" /> Chosen
              </span>
            )}
          </div>
          <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400">
            <Tag className="w-2.5 h-2.5 text-brand-500" /> {match.category}
          </span>
        </div>
        <div className={`flex items-center gap-0.5 px-2 py-0.5 rounded-md border text-xs font-bold ml-2 flex-shrink-0 ${scoreBg}`}>
          <Star className="w-3 h-3 fill-current" /> {match.match_score}%
        </div>
      </div>

      {match.interest_tags && match.interest_tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {match.interest_tags.map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-500/20">
              {tag}
            </span>
          ))}
        </div>
      )}

      <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">{match.description}</p>

      <div className="flex flex-wrap gap-2 mb-2">
        <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
          <DollarSign className="w-3 h-3 text-brand-500" /> ${match.pay_min}-${match.pay_max}
        </span>
        <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
          <MapPin className="w-3 h-3 text-gray-400" /> {match.campus_location}
        </span>
        <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
          <Clock className="w-3 h-3 text-gray-400" /> {match.walk_time_mins}m walk
        </span>
        {match.distance_miles != null && (
          <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
            <Navigation className="w-3 h-3 text-brand-500" /> {match.distance_miles} mi
          </span>
        )}
      </div>

      {match.decision === 'accepted' && escrowBadge && (
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <div className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md ${escrowBadge.color}`}>
            <Shield className="w-2.5 h-2.5" /> {escrowBadge.label}
          </div>
          {contractorDecision === 'pending' && (
            <div className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400">
              <Hourglass className="w-2.5 h-2.5" /> Awaiting {match.matched_user_name}
            </div>
          )}
          {contractorDecision === 'accepted' && (
            <div className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400">
              <BadgeCheck className="w-2.5 h-2.5" /> Contractor accepted - task started
            </div>
          )}
          {contractorDecision === 'completed' && (
            <div className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400">
              <CheckCircle className="w-2.5 h-2.5" /> Marked complete
              {scheduledFor && ` (due ${new Date(scheduledFor).toLocaleString()})`}
            </div>
          )}
          {contractorDecision === 'declined' && (
            <div className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400">
              <XCircle className="w-2.5 h-2.5" /> Contractor declined - escrow refunded
            </div>
          )}
          {contractorDecision === 'paid' && (
            <div className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400">
              <BadgeCheck className="w-2.5 h-2.5" /> Paid
            </div>
          )}
        </div>
      )}

      {match.reasoning && (
        <div className="mb-2">
          <button onClick={() => setShowReasoning(!showReasoning)}
            className="flex items-center gap-1 text-[10px] text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium transition-colors">
            <Zap className="w-2.5 h-2.5" />
            {showReasoning ? 'Hide' : 'Show'} Reasoning
            {showReasoning ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
          </button>
          {showReasoning && (
            <div className="mt-1.5 p-2.5 bg-gray-50 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 rounded-md text-[10px] space-y-1.5 animate-slide-up font-mono">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Interest Similarity</span>
                <span className="text-brand-600 dark:text-brand-400 font-semibold">{match.reasoning.interest_similarity_weight}%</span>
              </div>
              <div className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full" style={{ width: `${match.reasoning.interest_similarity_weight}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Distance Penalty</span>
                <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{match.reasoning.distance_penalization_factor}%</span>
              </div>
              <div className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${match.reasoning.distance_penalization_factor}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Context Boost</span>
                <span className="text-amber-600 dark:text-amber-400 font-semibold">{match.reasoning.contextual_boost}%</span>
              </div>
              <div className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${match.reasoning.contextual_boost}%` }} />
              </div>
              <p className="text-gray-400 pt-0.5 leading-relaxed">{match.reasoning.details}</p>
            </div>
          )}
        </div>
      )}

      {!isDecided && !gigLocked && (
        <div className="flex gap-1.5 mt-2">
          <button onClick={() => onAccept(match.id)}
            className="flex-1 flex items-center justify-center gap-1 py-2 bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-md transition-colors">
            <CheckCircle className="w-3 h-3" /> Accept
          </button>
          <button onClick={() => onDecline(match.id)}
            className="flex-1 flex items-center justify-center gap-1 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-300 text-xs font-medium rounded-md transition-colors">
            <XCircle className="w-3 h-3" /> Decline
          </button>
        </div>
      )}
      {match.decision === 'accepted' && match.escrow_status === 'held' && contractorDecision === 'completed' && onFinishAndPay && (
        <button onClick={() => onFinishAndPay(match.id)}
          className="w-full mt-2 py-2 bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-md transition-colors">
          Finish & Pay ${match.pay_max.toFixed(2)}
        </button>
      )}
      {match.decision === 'accepted' && match.escrow_status === 'held' && contractorDecision !== 'completed' && contractorDecision !== 'declined' && onReleaseEscrow && (
        <button onClick={() => onReleaseEscrow(match.id)}
          className="w-full mt-2 py-2 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-medium rounded-md transition-colors">
          Release Escrow Early
        </button>
      )}
    </div>
  );
}
