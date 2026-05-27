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

function makeEntry(
  role: 'user' | 'agent' | 'system_cards',
  content: string,
  type: ChatEntry['type'] = 'text',
  extra?: Partial<ChatEntry>
): ChatEntry {
  return { id: crypto.randomUUID(), role, content, type, timestamp: new Date(), ...extra };
}

function dbMessageToEntry(msg: ChatMessage): ChatEntry {
  const meta = (msg?.metadata as Record<string, unknown>) || {};
  let matches: GigMatch[] | undefined;
  if (msg?.message_type === 'match_cards' && meta?.matches && Array.isArray(meta.matches)) {
    matches = meta.matches as GigMatch[];
  }
  return {
    id: msg?.id || crypto.randomUUID(),
    role: msg?.role || 'agent',
    content: msg?.content || '',
    type: (msg?.message_type as ChatEntry['type']) || 'text',
    matches,
    showTelemetry: msg?.message_type === 'telemetry' ? true : undefined,
    timestamp: msg?.created_at ? new Date(msg.created_at) : new Date(),
  };
}

export function useMiloChat({
  profile,
  userId,
  sessionId,
  matches: globalMatches,
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

  const [activeRole, setActiveRole] = useState<'finder' | 'worker'>(
    profile?.role === 'both' ? 'worker' : (profile?.role as 'finder' | 'worker') || 'worker'
  );

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
          if (last?.message_type === 'match_cards' || (last?.message_type as string) === 'system_cards') {
            setPhase('browsing_matches');
          } else {
            setPhase('mode_select');
          }
        } else {
          // TS FIX: Removed arguments that getMiloGreeting doesn't accept
          setEntries([makeEntry('agent', getMiloGreeting())]);
          setPhase('mode_select');
        }
      } catch (err) {
        // TS FIX: Removed arguments that getMiloGreeting doesn't accept
        setEntries([makeEntry('agent', getMiloGreeting())]);
        setPhase('mode_select');
      }
    }
    loadMessages();
  }, [sessionId]);

  const agentSay = useCallback(
    (content: string, type: ChatEntry['type'] = 'text', extra?: Partial<ChatEntry>) => {
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
        session_id: sessionId,
      });
      return entry;
    },
    [onPersistMessage, sessionId]
  );

  const handleUserMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isThinking) return;

      const lower = trimmed.toLowerCase();

      if (
        lower.includes('complete order') ||
        lower.includes('approve payment') ||
        lower.includes('finish order') ||
        lower.includes('release payment')
      ) {
        const activeHeldMatch = globalMatches?.find(
          (m) => m?.decision === 'accepted' && m?.escrow_status === 'held'
        );
        if (activeHeldMatch) {
          setIsThinking(true);
          await onFinishAndPay(activeHeldMatch.id);
          
          if (activeRole === 'worker') {
            agentSay(`Payment processed completely! **$${activeHeldMatch?.pay_max ?? 0}** has arrived safely in your account balance from ${activeHeldMatch?.matched_user_name ?? 'the client'}.`, 'status');
          } else {
            agentSay(`Payment complete! $${activeHeldMatch?.pay_max ?? 0} released out of your escrow holding to ${activeHeldMatch?.matched_user_name ?? 'the provider'}.`, 'status');
          }
          
          setIsThinking(false);
          return;
        }
      }

      setIsThinking(true);
      const userEntry = makeEntry('user', trimmed);

      const historicalMessages = entries
        .filter(
          (e) =>
            (e.type === 'text' || e.type === 'status') &&
            e.content &&
            !e.content.includes('Welcome! I am Milo')
        )
        .map((e) => ({
          role: e.role === 'agent' ? 'assistant' : 'user',
          content: e.content,
        }));

      historicalMessages.push({ role: 'user', content: trimmed });
      setEntries((prev) => [...prev, userEntry]);

      void onPersistMessage({
        role: 'user',
        content: trimmed,
        message_type: 'text',
        metadata: {},
        session_id: sessionId,
      });

      const telemetryId = crypto.randomUUID();
      const telemetryEntry: ChatEntry = {
        id: telemetryId,
        role: 'agent',
        content: '',
        type: 'telemetry',
        timestamp: new Date(),
      };
      setEntries((prev) => [...prev, telemetryEntry]);

      try {
        const payload = {
          session_id: sessionId || 'fallback-session',
          messages: historicalMessages,
          user_profile: {
            user_id: userId,
            role: profile?.role || 'both',
            location: profile?.campus_location || 'Main Campus',
            max_walk_time_mins: profile?.max_walk_time_mins || 15,
            payment_range: {
              min: profile?.pay_min ?? 10,
              max: profile?.pay_max ?? 50,
            },
            skills_interests: profile?.skills_interests || ['tutoring'],
          },
        };

        const response = await fetch(MATCH_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error(`Server returned status: ${response.status}`);

        const data = await response.json();
        setEntries((prev) => prev.filter((e) => e.id !== telemetryId));

        const actionDirective = data?.directive?.action;
        let determinedRole = activeRole;
        if (actionDirective === 'search_gigs') determinedRole = 'worker';
        if (actionDirective === 'post_gig') determinedRole = 'finder';
        setActiveRole(determinedRole);

        const serverMessage = data?.message || data?.milo_response || 'Checking campus listings...';
        agentSay(serverMessage, 'text');

        if (Array.isArray(data?.matches) && data.matches.length > 0) {
          const resolvedGigId = crypto.randomUUID();
          
          const compiledMatches: GigMatch[] = data.matches.map((m: any) => {
            const posterId = determinedRole === 'worker' ? (m?.poster_id || m?.user_id || 'mock-client') : userId;
            const workerId = determinedRole === 'worker' ? userId : (m?.matched_user_id || m?.worker_id || 'mock-worker');

            return {
              ...m,
              gig_id: m?.gig_id || resolvedGigId,
              user_id: posterId, 
              matched_user_id: workerId,
              is_poster: determinedRole === 'finder',
              decision: m?.decision ?? null,
              escrow_status: m?.escrow_status ?? 'pending',
              pay_max: m?.pay_max ?? profile?.pay_max ?? 50,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
          });

          await onSaveMatches(resolvedGigId, compiledMatches);

          const systemCardsEntry = makeEntry('system_cards', '', 'system_cards', {
            matches: compiledMatches,
          });
          setEntries((prev) => [...prev, systemCardsEntry]);

          void onPersistMessage({
            role: 'agent',
            content: '',
            message_type: 'match_cards',
            metadata: { matches: compiledMatches },
            session_id: sessionId,
          });

          setPhase('browsing_matches');
        } else {
          setPhase('mode_select');
        }
      } catch (err) {
        setEntries((prev) => prev.filter((e) => e.id !== telemetryId));
        agentSay("I hit a temporary synchronization bottleneck. Let's step back—what can I find for you?", 'error');
        setPhase('mode_select');
      } finally {
        setIsThinking(false);
      }
    },
    [
      entries,
      isThinking,
      profile,
      userId,
      sessionId,
      globalMatches,
      onSaveGig,
      onSaveMatches,
      onPersistMessage,
      agentSay,
      onFinishAndPay,
      activeRole,
    ]
  );

  const handleAcceptMatch = useCallback(
    async (matchId: string, allMatches: GigMatch[] = []) => {
      await onUpdateMatchDecision(matchId, 'accepted');
      
      // TS FIX: Safety fallback search for match details
      const targetMatch = allMatches.find((m) => m.id === matchId) || globalMatches?.find((m) => m.id === matchId);
      
      if (activeRole === 'worker') {
        agentSay(
          targetMatch
            ? `Excellent! You accepted the gig from **${targetMatch.matched_user_name ?? 'Client'}**. They have safely escrowed **$${targetMatch.pay_max ?? 0}** for you. When you finish the task, type 'Complete Order' here to receive your funds.`
            : 'Gig assignment accepted. Client funds are initialized in escrow holding.',
          'status'
        );
      } else {
        agentSay(
          targetMatch
            ? `You accepted the match. **$${targetMatch.pay_max ?? 0}** is initialized in escrow out of your profile balance. Once work concludes, type 'Complete Order' to release the payment to ${targetMatch.matched_user_name ?? 'the worker'}.`
            : 'Match confirmed. Escrow status transformed to held.',
          'status'
        );
      }
    },
    [activeRole, onUpdateMatchDecision, agentSay, globalMatches]
  );

  const handleDeclineMatch = useCallback(
    async (matchId: string) => {
      await onUpdateMatchDecision(matchId, 'rejected');
    },
    [onUpdateMatchDecision]
  );

  const handleReleaseEscrow = useCallback(
    async (matchId: string, allMatches: GigMatch[] = []) => {
      await onReleaseEscrow(matchId);
      
      // TS FIX: Safety fallback search for match details
      const targetMatch = allMatches.find((m) => m.id === matchId) || globalMatches?.find((m) => m.id === matchId);
      
      if (activeRole === 'worker') {
        agentSay(targetMatch ? `Funds released! **$${targetMatch.pay_max ?? 0}** has been deposited to your account.` : 'Escrow contract settled successfully.', 'status');
      } else {
        agentSay(targetMatch ? `Escrow securely dispatched: $${targetMatch.pay_max ?? 0} transferred to ${targetMatch.matched_user_name ?? 'the worker'}.` : 'Escrow contract successfully paid.', 'status');
      }
    },
    [activeRole, onReleaseEscrow, agentSay, globalMatches]
  );

  const handleFinishAndPay = useCallback(
    async (matchId: string, allMatches: GigMatch[] = []) => {
      await onFinishAndPay(matchId);
      
      // TS FIX: Safety fallback search for match details
      const targetMatch = allMatches.find((m) => m.id === matchId) || globalMatches?.find((m) => m.id === matchId);
      
      if (activeRole === 'worker') {
        agentSay(
          targetMatch
            ? `Transaction completed. **$${targetMatch.pay_max ?? 0}** was released out of holding directly into your profile balance from ${targetMatch.matched_user_name ?? 'the client'}!`
            : 'Payment cleared. Order finalized!',
          'status'
        );
      } else {
        agentSay(
          targetMatch
            ? `Transaction completed. **$${targetMatch.pay_max ?? 0}** was released directly out of holding to ${targetMatch.matched_user_name ?? 'the worker'}.`
            : 'Payment cleared. Order finalized!',
          'status'
        );
      }
    },
    [activeRole, onFinishAndPay, agentSay, globalMatches]
  );

  return {
    entries,
    phase,
    isThinking,
    handleUserMessage,
    handleAcceptMatch,
    handleDeclineMatch,
    handleReleaseEscrow,
    handleFinishAndPay,
  };
}