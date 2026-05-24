import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Menu, Settings, MapPin, DollarSign, Shield, Mic, MicOff } from 'lucide-react';
import type { UserProfile, Gig, GigMatch, ChatMessage } from '../lib/supabase';
import { useMiloChat } from '../hooks/useMiloChat';
import { TelemetryCard } from './TelemetryCard';
import { MatchCard } from './MatchCard';

type Props = {
  profile: UserProfile;
  userId: string;
  sessionId: string;
  activeGigs: Gig[];
  matches: GigMatch[];
  totalEscrow: number;
  onOpenSettings: () => void;
  onSaveGig: (gig: Omit<Gig, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'applicant_count'>) => Promise<{ data: Gig | null; error: unknown }>;
  onSaveMatches: (gigId: string, matches: GigMatch[]) => Promise<void>;
  onUpdateMatchDecision: (matchId: string, decision: 'accepted' | 'rejected') => Promise<void>;
  onReleaseEscrow: (matchId: string) => Promise<void>;
  onPersistMessage: (msg: Omit<ChatMessage, 'id' | 'user_id' | 'created_at'>) => Promise<void>;
};

function renderMarkdown(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/\n/g, '<br />');
}

export function ChatPage({
  profile, userId, sessionId, activeGigs, matches, totalEscrow,
  onOpenSettings, onSaveGig, onSaveMatches, onUpdateMatchDecision, onReleaseEscrow, onPersistMessage,
}: Props) {
  const [input, setInput] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [activeTab, setActiveTab] = useState<'browse' | 'my-gigs'>('browse');
  const [isListening, setIsListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  const { entries, isThinking, handleUserMessage, handleAcceptMatch, handleDeclineMatch, handleReleaseEscrow } = useMiloChat({
    profile, userId, sessionId, onSaveGig, onSaveMatches, onUpdateMatchDecision, onReleaseEscrow, onPersistMessage,
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [entries, isThinking]);

  const submit = () => {
    const val = input.trim();
    if (!val) return;
    setInput('');
    void handleUserMessage(val);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  const toggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const acceptedMatch = matches.find((m) => m.decision === 'accepted');
  const gigLocked = !!acceptedMatch;
  const pendingMatches = matches.filter((m) => m.decision === null && m.escrow_status === 'pending');
  const acceptedMatches = matches.filter((m) => m.decision === 'accepted');

  return (
    <div className="flex h-full">
      {/* Left Sidebar */}
      {showSidebar && (
        <div className="w-80 flex-shrink-0 border-r border-surface-700/40 bg-surface-900/30 flex flex-col">
          <div className="p-4 border-b border-surface-700/40">
            <div className="flex gap-2 mb-3">
              {(['browse', 'my-gigs'] as const).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${activeTab === tab ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : 'bg-surface-800/50 text-surface-400 hover:bg-surface-800'}`}>
                  {tab === 'browse' ? 'Browse Gigs' : 'My Gigs'}
                </button>
              ))}
            </div>
            {totalEscrow > 0 && (
              <div className="p-3 bg-accent-500/10 border border-accent-500/20 rounded-xl">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-accent-400" />
                  <span className="text-xs text-accent-400 font-semibold">Escrow: ${totalEscrow.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {activeTab === 'browse' ? (
              <>
                <h3 className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">Available Near You</h3>
                {activeGigs.filter((g) => g.type === 'post' && g.status === 'open').length === 0 ? (
                  <p className="text-xs text-surface-600">No gigs available. Ask Milo to search!</p>
                ) : (
                  activeGigs.filter((g) => g.type === 'post' && g.status === 'open').slice(0, 5).map((gig) => (
                    <div key={gig.id} className="p-3 bg-surface-800/40 rounded-xl border border-surface-700/40 card-hover">
                      <p className="text-sm text-white font-semibold truncate">{gig.title}</p>
                      <p className="text-xs text-surface-400 mt-1">{gig.category}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="flex items-center gap-1 text-xs text-surface-500"><DollarSign className="w-3 h-3 text-brand-400" />${gig.pay_min} - ${gig.pay_max}</span>
                        <span className="flex items-center gap-1 text-xs text-surface-500"><MapPin className="w-3 h-3 text-cyan-400" />{gig.campus_location || 'Campus'}</span>
                      </div>
                    </div>
                  ))
                )}
                {pendingMatches.length > 0 && (
                  <>
                    <h3 className="text-xs font-bold text-surface-500 uppercase tracking-wider mt-4 mb-2">Pending Matches</h3>
                    {pendingMatches.map((m) => (
                      <div key={m.id} className="p-3 bg-accent-500/10 rounded-xl border border-accent-500/30">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-white font-semibold">{m.matched_user_name}</span>
                          <span className="text-xs text-accent-400 font-bold">{m.match_score}%</span>
                        </div>
                        <p className="text-xs text-surface-400 mt-1">{m.title}</p>
                      </div>
                    ))}
                  </>
                )}
              </>
            ) : (
              <>
                <h3 className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">Your Active Gigs</h3>
                {activeGigs.length === 0 ? (
                  <p className="text-xs text-surface-600">No active gigs. Tell Milo what you need!</p>
                ) : (
                  activeGigs.slice(0, 10).map((gig) => (
                    <div key={gig.id} className="p-3 bg-surface-800/40 rounded-xl border border-surface-700/40">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${gig.status === 'open' ? 'bg-surface-400' : gig.status === 'matched' ? 'bg-brand-400' : gig.status === 'in_progress' ? 'bg-cyan-400' : 'bg-blue-400'}`} />
                        <span className="text-xs text-surface-400 capitalize">{gig.status.replace('_', ' ')}</span>
                      </div>
                      <p className="text-sm text-white font-semibold truncate">{gig.title}</p>
                      <p className="text-xs text-surface-500 mt-1">{gig.category}</p>
                    </div>
                  ))
                )}
                {acceptedMatches.length > 0 && (
                  <>
                    <h3 className="text-xs font-bold text-surface-500 uppercase tracking-wider mt-4 mb-2">Accepted</h3>
                    {acceptedMatches.map((m) => (
                      <div key={m.id} className="p-3 bg-brand-500/10 rounded-xl border border-brand-500/30">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-white font-semibold">{m.matched_user_name}</span>
                          <span className="text-xs text-brand-400 font-semibold">{m.escrow_status}</span>
                        </div>
                        <p className="text-xs text-surface-400 mt-1">{m.title}</p>
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
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700/40 glass-light">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowSidebar(!showSidebar)} className="lg:hidden p-2 hover:bg-surface-800 rounded-lg transition-all">
              <Menu className="w-4 h-4 text-surface-400" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-brand-400 to-brand-600 rounded-lg flex items-center justify-center shadow-glow">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Milo</h2>
                <p className="text-xs text-brand-400 font-medium">Agentic Concierge</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-surface-800/50 rounded-lg border border-surface-700/50">
              <Sparkles className="w-3.5 h-3.5 text-accent-400" />
              <span className="text-xs text-surface-400 font-medium">AI-Powered</span>
            </div>
            <button onClick={onOpenSettings} className="p-2 hover:bg-surface-800 rounded-lg transition-all">
              <Settings className="w-4 h-4 text-surface-400" />
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
                  <div className="w-7 h-7 bg-gradient-to-br from-brand-400 to-brand-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 max-w-[85%]"><TelemetryCard /></div>
                </div>
              );
            }

            if (entry.type === 'match_cards' && entry.matches) {
              return (
                <div key={entry.id} className="flex gap-3">
                  <div className="w-7 h-7 bg-gradient-to-br from-brand-400 to-brand-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 max-w-[92%] space-y-3">
                    <p className="text-xs text-surface-500 font-bold">{entry.matches.length} match{entry.matches.length !== 1 ? 'es' : ''} found</p>
                    {entry.matches.map((m) => (
                      <MatchCard key={m.id} match={m} gigLocked={gigLocked} chosenWorker={m.decision === 'accepted'}
                        onAccept={(id) => void handleAcceptMatch(id, entry.matches!)}
                        onDecline={(id) => void handleDeclineMatch(id)}
                        onReleaseEscrow={(id) => void handleReleaseEscrow(id, entry.matches!)} />
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <div key={entry.id} className={`flex gap-3 ${isAgent ? '' : 'flex-row-reverse'}`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${isAgent ? 'bg-gradient-to-br from-brand-400 to-brand-600' : 'bg-surface-700'}`}>
                  {isAgent ? <Bot className="w-4 h-4 text-white" /> : <User className="w-4 h-4 text-surface-300" />}
                </div>
                <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  isAgent
                    ? entry.type === 'error' ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-tl-sm'
                      : entry.type === 'status' ? 'bg-brand-500/10 border border-brand-500/30 text-brand-300 rounded-tl-sm'
                      : 'bg-surface-800/80 text-surface-200 rounded-tl-sm'
                    : 'bg-gradient-to-br from-brand-500 to-brand-600 text-white rounded-tr-sm'
                }`} dangerouslySetInnerHTML={{ __html: renderMarkdown(entry.content) }} />
              </div>
            );
          })}

          {isThinking && (
            <div className="flex gap-3">
              <div className="w-7 h-7 bg-gradient-to-br from-brand-400 to-brand-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="px-4 py-3 bg-surface-800/80 rounded-2xl rounded-tl-sm">
                <div className="flex gap-1.5 items-center h-4">
                  {[0, 150, 300].map((d) => (
                    <div key={d} className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input with Voice Typing */}
        <div className="px-4 pb-4 pt-2 border-t border-surface-700/40">
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey}
                placeholder="Message Milo..." rows={1}
                className="w-full px-4 py-3 bg-surface-800/60 border border-surface-700/60 hover:border-surface-600 focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/20 rounded-xl text-white placeholder-surface-500 text-sm resize-none focus:outline-none transition-all"
                style={{ minHeight: '48px', maxHeight: '120px' }}
                onInput={(e) => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }} />
            </div>
            <button onClick={toggleVoice}
              className={`w-11 h-11 flex items-center justify-center rounded-xl transition-all flex-shrink-0 ${isListening ? 'bg-rose-500 hover:bg-rose-400 shadow-lg shadow-rose-500/30 animate-pulse' : 'bg-surface-700 hover:bg-surface-600'}`}
              title={isListening ? 'Stop listening' : 'Voice typing'}>
              {isListening ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4 text-surface-300" />}
            </button>
            <button onClick={submit} disabled={!input.trim() || isThinking}
              className="w-11 h-11 flex items-center justify-center bg-gradient-to-br from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 disabled:from-surface-700 disabled:to-surface-700 disabled:cursor-not-allowed rounded-xl transition-all shadow-glow disabled:shadow-none flex-shrink-0">
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
          <p className="text-xs text-surface-600 mt-2 text-center">Enter to send - Shift+Enter for new line - Mic for voice</p>
        </div>
      </div>
    </div>
  );
}
