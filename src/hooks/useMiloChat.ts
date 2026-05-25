import { useState, useCallback, useRef, useEffect } from 'react';
import type { UserProfile, Gig, GigMatch, ChatMessage } from '../lib/supabase';
import type { ConversationPhase } from '../lib/miloAgent';
import { getMiloGreeting } from '../lib/miloAgent';
import { supabase } from '../lib/supabase';
import { MATCH_ENDPOINT } from '../lib/webhook';

export type ChatEntry = {
  id: string;
  role: 'user' | 'agent' | 'system_cards';
  content: string;
  type: 'text' | 'telemetry' | 'match_cards' | 'system_cards' | 'status' | 'error';
  matches?: GigMatch[];
  showTelemetry?: boolean;
  timestamp: Date;
};

type UseMiloChatOptions = {
  profile: UserProfile;
  userId: string;
  sessionId: string | null;
  matches: GigMatch[];
  onSaveGig: (gig: Omit<Gig, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'applicant_count'>) => Promise<{ data: Gig | null; error: unknown }>;
  onSaveMatches: (gigId: string, matches: GigMatch[]) => Promise<void>;
  onUpdateMatchDecision: (matchId: string, decision: 'accepted' | 'rejected') => Promise<void>;
  onReleaseEscrow: (matchId: string) => Promise<void>;
  onFinishAndPay: (matchId: string) => Promise<void>;
  onPersistMessage: (msg: Omit<ChatMessage, 'id' | 'user_id' | 'created_at'>) => Promise<void>;
};

function makeEntry(role: 'user' | 'agent' | 'system_cards', content: string, type: ChatEntry['type'] = 'text', extra?: Partial<ChatEntry>): ChatEntry {
  return { id: crypto.randomUUID(), role, content, type, timestamp: new Date(), ...extra };
}

function dbMessageToEntry(msg: ChatMessage): ChatEntry {
  const meta = (msg.metadata as Record<string, unknown>) || {};
  let matches: GigMatch[] | undefined;
  if (msg.message_type === 'match_cards' && meta.matches && Array.isArray(meta.matches)) {
    matches = meta.matches as GigMatch[];
  }
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    type: (msg.message_type as ChatEntry['type']) || 'text',
    matches,
    showTelemetry: msg.message_type === 'telemetry' ? true : undefined,
    timestamp: new Date(msg.created_at),
  };
}

export function useMiloChat({
  profile,
  userId,
  sessionId,
  matches,
  onSaveGig,
  onSaveMatches,
  onUpdateMatchDecision,
  onReleaseEscrow,
  onFinishAndPay,
  onPersistMessage,
}: UseMiloChatOptions) {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [phase, setPhase] = useState<ConversationPhase>('mode_select');
  const [isThinking, setIsThinking] = useState(false);
  const loadedSessionRef = useRef<string | null>(null);

  // Sync historical chat database logs on session instantiation
  useEffect(() => {
    if (!sessionId || sessionId === loadedSessionRef.current) return;
    loadedSessionRef.current = sessionId;

    async function loadMessages() {
      try {
        const { data } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        if (data && data.length > 0) {
          setEntries(data.map((m) => dbMessageToEntry(m as ChatMessage)));
          const last = data[data.length - 1] as ChatMessage;
          if (last.message_type === 'match_cards') {
            setPhase('browsing_matches');
          } else {
            setPhase('mode_select');
          }
        } else {
          setEntries([makeEntry('agent', getMiloGreeting())]);
          setPhase('mode_select');
        }
      } catch (err) {
        console.warn('Failed to restore historical conversation data:', err);
        setEntries([makeEntry('agent', getMiloGreeting())]);
        setPhase('mode_select');
      }
    }
    loadMessages();
  }, [sessionId]);

  const agentSay = useCallback((content: string, type: ChatEntry['type'] = 'text', extra?: Partial<ChatEntry>) => {
    const entry = makeEntry('agent', content, type, extra);
    setEntries((prev) => [...prev, entry]);
    
    const metadata: Record<string, unknown> = {};
    if (type === 'match_cards' && extra?.matches) {
      metadata.matches = extra.matches;
    }
    void onPersistMessage({ 
      role: 'agent', 
      content, 
      message_type: type === 'match_cards' ? 'match_cards' : type === 'telemetry' ? 'telemetry' : 'text', 
      metadata, 
      session_id: sessionId 
    });
    return entry;
  }, [onPersistMessage, sessionId]);

  const handleUserMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isThinking) return;

    const lower = trimmed.toLowerCase();

    // 1. Escrow / Transaction short-circuit checks
    if (lower.includes('complete order') || lower.includes('approve payment') || lower.includes('finish order') || lower.includes('release payment')) {
      const activeHeldMatch = matches.find((m) => m.decision === 'accepted' && m.escrow_status === 'held');
      if (activeHeldMatch) {
        setIsThinking(true);
        await onFinishAndPay(activeHeldMatch.id);
        agentSay(`Payment complete! $${activeHeldMatch.pay_max} released to ${activeHeldMatch.matched_user_name}.`, 'status');
        setIsThinking(false);
        return;
      }
    }

    setIsThinking(true);

    // 2. Real-time safe state extraction capturing history BEFORE appending user bubble
    let historicalSnapshot: ChatEntry[] = [];
    const userEntry = makeEntry('user', trimmed);
    
    setEntries((prev) => {
      historicalSnapshot = [...prev];
      return [...prev, userEntry];
    });

    void onPersistMessage({ role: 'user', content: trimmed, message_type: 'text', metadata: {}, session_id: sessionId });

    try {
      // 3. Map clean dialog logs explicitly formatting roles for main.py's ChatMessagePayload schema
      const historicalMessages = historicalSnapshot
        .filter((e) => e.type === 'text' && e.content && !e.content.includes("Welcome! I am Milo"))
        .map((e) => ({
          role: e.role === 'agent' ? 'assistant' : 'user',
          content: e.content,
        }));

      // Append current user turn entry explicitly at the tail end of the array timeline
      historicalMessages.push({
        role: 'user',
        content: trimmed
      });

      const isPosting = lower.includes('post') || lower.includes('hire') || lower.includes('need help') || lower.includes('pay') || lower.includes('looking for');
      
      // 4. Compile payload packet matching ContextualChatPayload in main.py perfectly
      const payload = {
        session_id: sessionId || "fallback-session",
        messages: historicalMessages,
        user_profile: {
          user_id: userId,
          role: isPosting ? "finder" : "worker", 
          location: profile.campus_location || "Main Campus", 
          max_walk_time_mins: profile.max_walk_time_mins || 15,
          payment_range: {
            min: profile.pay_min ?? 10,
            max: profile.pay_max ?? 50,
          },
          skills_interests: profile.skills_interests || ["tutoring"]
        }
      };

      console.log("🚀 SENDING PAYLOAD TO FASTAPI MAIN.PY:", payload);

      const response = await fetch(MATCH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`Server returned evaluation status: ${response.status}`);
      
      const data = await response.json();
      console.log("✅ SYSTEM EVALUATION RESPONSE:", data);

      const serverMessage = data.message || data.milo_response || "Checking campus listings...";
      agentSay(serverMessage, 'text');

      if (data.slots_complete && Array.isArray(data.matches) && data.matches.length > 0) {
        const resolvedGigId = crypto.randomUUID();
        const compiledMatches: GigMatch[] = data.matches.map((m: any) => ({
          ...m,
          gig_id: m.gig_id || resolvedGigId,
          user_id: m.user_id || userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));

        await onSaveMatches(resolvedGigId, compiledMatches);

        const systemCardsEntry = makeEntry('system_cards', '', 'system_cards', { matches: compiledMatches });
        setEntries((prev) => [...prev, systemCardsEntry]);
        void onPersistMessage({ role: 'agent', content: '', message_type: 'text', metadata: { matches: compiledMatches }, session_id: sessionId });
        setPhase('browsing_matches');
      } else {
        setPhase('mode_select');
      }
    } catch (err) {
      console.error("❌ MILO ROUTING CRITICAL ERROR:", err);
      agentSay("I hit a temporary synchronization bottleneck. Let's step back—what can I set up for you?", 'error');
      setPhase('mode_select');
    } finally {
      setIsThinking(false);
    }
  }, [entries, isThinking, profile, userId, sessionId, matches, onSaveGig, onSaveMatches, onPersistMessage, agentSay]);

  const handleAcceptMatch = useCallback(async (matchId: string, allMatches: GigMatch[]) => {
    await onUpdateMatchDecision(matchId, 'accepted');
    const targetMatch = allMatches.find((m) => m.id === matchId);
    agentSay(
      targetMatch
        ? `You accepted the match. **$${targetMatch.pay_max}** is initialized in escrow. Once work concludes, confirm via chat or interface to release the payment.`
        : 'Match confirmed. Escrow status transformed to held.',
      'status'
    );
  }, [onUpdateMatchDecision, agentSay]);

  const handleDeclineMatch = useCallback(async (matchId: string) => {
    await onUpdateMatchDecision(matchId, 'rejected');
  }, [onUpdateMatchDecision]);

  const handleReleaseEscrow = useCallback(async (matchId: string, allMatches: GigMatch[]) => {
    await onReleaseEscrow(matchId);
    const targetMatch = allMatches.find((m) => m.id === matchId);
    agentSay(targetMatch ? `Escrow securely dispatched: $${targetMatch.pay_max} transferred to ${targetMatch.matched_user_name}.` : 'Escrow contract successfully paid.', 'status');
  }, [onReleaseEscrow, agentSay]);

  const handleFinishAndPay = useCallback(async (matchId: string, allMatches: GigMatch[]) => {
    await onFinishAndPay(matchId);
    const targetMatch = allMatches.find((m) => m.id === matchId);
    agentSay(
      targetMatch
        ? `Transaction completed. **$${targetMatch.pay_max}** was released directly out of holding to ${targetMatch.matched_user_name}.`
        : 'Payment cleared. Order finalized!',
      'status'
    );
  }, [onFinishAndPay, agentSay]);

  return { 
    entries, 
    phase, 
    isThinking, 
    handleUserMessage, 
    handleAcceptMatch, 
    handleDeclineMatch, 
    handleReleaseEscrow, 
    handleFinishAndPay 
  };
}