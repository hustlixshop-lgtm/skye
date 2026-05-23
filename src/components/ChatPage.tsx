import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Menu, Settings, MapPin, DollarSign, Clock, Tag, CheckCircle, XCircle, Shield } from 'lucide-react';
import type { UserProfile, Gig, GigMatch, ChatMessage } from '../lib/supabase';
import { useMiloChat } from '../hooks/useMiloChat';
import { TelemetryCard } from './TelemetryCard';
import { MatchCard } from './MatchCard';

type Props = {
  profile: UserProfile;
  userId: string;
  activeGigs: Gig[];
  matches: GigMatch[];
  totalEscrow: number;
  onOpenSettings: () => void;
  onSaveGig: (gig: Parameters<import('../hooks/useAppState').useAppState['saveGig']>[0]) => Promise<{ data: Gig | null; error: unknown }>;
  onSaveMatches: (gigId: string, matches: GigMatch[]) => Promise<void>;
  onUpdateMatchDecision: (matchId: string, decision: 'accepted' | 'rejected') => Promise<void>;
  onReleaseEscrow: (matchId: string) => Promise<void>;
  onPersistMessage: (msg: Omit<ChatMessage, 'id' | 'user_id' | 'created_at'>) => Promise<void>;
};

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br />');
}

export function ChatPage({
  profile,
  userId,
  activeGigs,
  matches,
  totalEscrow,
  onOpenSettings,
  onSaveGig,
  onSaveMatches,
  onUpdateMatchDecision,
  onReleaseEscrow,
  onPersistMessage,
}: Props) {
  const [input, setInput] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [activeTab, setActiveTab] = useState<'browse' | 'my-gigs'>('browse');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    entries,
    isThinking,
    handleUserMessage,
    handleAcceptMatch,
    handleDeclineMatch,
    handleReleaseEscrow,
  } = useMiloChat({
    profile,
    userId,
    onSaveGig,
    onSaveMatches,
    onUpdateMatchDecision,
    onReleaseEscrow,
    onPersistMessage,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries, isThinking]);

  const submit = () => {
    const val = input.trim();
    if (!val) return;
    setInput('');
    void handleUserMessage(val);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const pendingMatches = matches.filter((m) => m.decision === null && m.escrow_status === 'pending');
  const acceptedMatches = matches.filter((m) => m.decision === 'accepted');

  return (
    <div className="flex h-full">
      {/* Left Sidebar - Gig Browser */}
      {showSidebar && (
        <div className="w-80 flex-shrink-0 border-r border-slate-800/60 bg-slate-900/30 flex flex-col">
          <div className="p-4 border-b border-slate-800/60">
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTab('browse')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'browse'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
                }`}
              >
                Browse Gigs
              </button>
              <button
                onClick={() => setActiveTab('my-gigs')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'my-gigs'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
                }`}
              >
                My Gigs
              </button>
            </div>

            {totalEscrow > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span className="text-xs text-amber-400">Escrow: ${totalEscrow.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {activeTab === 'browse' ? (
              <>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Available Near You</h3>
                {activeGigs.filter((g) => g.type === 'post' && g.status === 'open').length === 0 ? (
                  <p className="text-xs text-slate-600">No gigs available. Ask Milo to search for you!</p>
                ) : (
                  activeGigs
                    .filter((g) => g.type === 'post' && g.status === 'open')
                    .slice(0, 5)
                    .map((gig) => (
                      <div key={gig.id} className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/40 hover:border-slate-600 transition-all">
                        <p className="text-sm text-white font-medium truncate">{gig.title}</p>
                        <p className="text-xs text-slate-400 mt-1">{gig.category}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <DollarSign className="w-3 h-3 text-emerald-400" />${gig.pay_min}–${gig.pay_max}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <MapPin className="w-3 h-3 text-blue-400" />{gig.campus_location || 'Campus'}
                          </span>
                        </div>
                      </div>
                    ))
                )}

                {pendingMatches.length > 0 && (
                  <>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-4 mb-2">Pending Matches</h3>
                    {pendingMatches.map((m) => (
                      <div key={m.id} className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-white font-medium">{m.matched_user_name}</span>
                          <span className="text-xs text-amber-400">{m.match_score}%</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{m.title}</p>
                      </div>
                    ))}
                  </>
                )}
              </>
            ) : (
              <>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Your Active Gigs</h3>
                {activeGigs.length === 0 ? (
                  <p className="text-xs text-slate-600">No active gigs. Tell Milo what you need!</p>
                ) : (
                  activeGigs.slice(0, 10).map((gig) => (
                    <div key={gig.id} className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/40">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${
                          gig.status === 'open' ? 'bg-slate-400' :
                          gig.status === 'matched' ? 'bg-emerald-400' :
                          gig.status === 'in_progress' ? 'bg-cyan-400' : 'bg-blue-400'
                        }`} />
                        <span className="text-xs text-slate-400 capitalize">{gig.status.replace('_', ' ')}</span>
                      </div>
                      <p className="text-sm text-white font-medium truncate">{gig.title}</p>
                      <p className="text-xs text-slate-500 mt-1">{gig.category}</p>
                    </div>
                  ))
                )}

                {acceptedMatches.length > 0 && (
                  <>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-4 mb-2">Accepted Matches</h3>
                    {acceptedMatches.map((m) => (
                      <div key={m.id} className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-white font-medium">{m.matched_user_name}</span>
                          <span className="text-xs text-emerald-400">{m.escrow_status}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{m.title}</p>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60 bg-slate-900/30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="lg:hidden p-2 hover:bg-slate-800 rounded-lg transition-all"
            >
              <Menu className="w-4 h-4 text-slate-400" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Milo</h2>
                <p className="text-xs text-emerald-400">Your Agentic Concierge</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs text-slate-400">AI-Powered</span>
            </div>
            <button
              onClick={onOpenSettings}
              className="p-2 hover:bg-slate-800 rounded-lg transition-all"
            >
              <Settings className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
          {entries.map((entry) => {
            const isAgent = entry.role === 'agent';

            if (entry.type === 'telemetry') {
              return (
                <div key={entry.id} className="flex gap-3">
                  <div className="w-7 h-7 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 max-w-[85%]">
                    <TelemetryCard />
                  </div>
                </div>
              );
            }

            if (entry.type === 'match_cards' && entry.matches) {
              return (
                <div key={entry.id} className="flex gap-3">
                  <div className="w-7 h-7 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 max-w-[90%] space-y-3">
                    <p className="text-xs text-slate-500 font-medium">
                      {entry.matches.length} match{entry.matches.length !== 1 ? 'es' : ''} found
                    </p>
                    {entry.matches.map((m) => (
                      <MatchCard
                        key={m.id}
                        match={m}
                        onAccept={(id) => void handleAcceptMatch(id, entry.matches!)}
                        onDecline={(id) => void handleDeclineMatch(id)}
                        onReleaseEscrow={(id) => void handleReleaseEscrow(id, entry.matches!)}
                      />
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={entry.id}
                className={`flex gap-3 ${isAgent ? '' : 'flex-row-reverse'}`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    isAgent
                      ? 'bg-gradient-to-br from-cyan-400 to-blue-500'
                      : 'bg-slate-700'
                  }`}
                >
                  {isAgent ? (
                    <Bot className="w-4 h-4 text-white" />
                  ) : (
                    <User className="w-4 h-4 text-slate-300" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    isAgent
                      ? entry.type === 'error'
                        ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-tl-sm'
                        : entry.type === 'status'
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-tl-sm'
                        : 'bg-slate-800/80 text-slate-200 rounded-tl-sm'
                      : 'bg-gradient-to-br from-cyan-500 to-blue-500 text-white rounded-tr-sm'
                  }`}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(entry.content) }}
                />
              </div>
            );
          })}

          {isThinking && (
            <div className="flex gap-3">
              <div className="w-7 h-7 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="px-4 py-3 bg-slate-800/80 rounded-2xl rounded-tl-sm">
                <div className="flex gap-1 items-center h-4">
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 pb-4 pt-2 border-t border-slate-800/60">
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Message Milo..."
                rows={1}
                className="w-full px-4 py-3 pr-4 bg-slate-800/60 border border-slate-700/60 hover:border-slate-600 focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 rounded-xl text-white placeholder-slate-500 text-sm resize-none focus:outline-none transition-all"
                style={{ minHeight: '48px', maxHeight: '120px' }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                }}
              />
            </div>
            <button
              onClick={submit}
              disabled={!input.trim() || isThinking}
              className="w-11 h-11 flex items-center justify-center bg-gradient-to-br from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed rounded-xl transition-all shadow-lg shadow-cyan-500/20 disabled:shadow-none flex-shrink-0"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
          <p className="text-xs text-slate-600 mt-2 text-center">
            Press Enter to send
          </p>
        </div>
      </div>
    </div>
  );
}
