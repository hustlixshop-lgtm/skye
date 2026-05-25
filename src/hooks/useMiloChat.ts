import { useState, useCallback, useRef, useEffect } from 'react';
import type { UserProfile, Gig, GigMatch, ChatMessage } from '../lib/supabase';
import type { ConversationPhase, ExtractedGigData, GigCategory } from '../lib/miloAgent';
import {
  detectCategory,
  detectMode,
  extractPayRange,
  extractLocation,
  getMiloGreeting,
  getMiloResponse,
} from '../lib/miloAgent';
import { sendWebhookRequest, buildWebhookPayload, type WebhookMatch } from '../lib/webhook';
import { supabase } from '../lib/supabase';

type ChatEntry = {
  id: string;
  role: 'user' | 'agent';
  content: string;
  type: 'text' | 'telemetry' | 'match_cards' | 'status' | 'error';
  matches?: GigMatch[];
  showTelemetry?: boolean;
  timestamp: Date;
};

type UseMiloChatOptions = {
  profile: UserProfile;
  userId: string;
  sessionId: string | null;
  onSaveGig: (gig: Omit<Gig, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'applicant_count'>) => Promise<{ data: Gig | null; error: unknown }>;
  onSaveMatches: (gigId: string, matches: GigMatch[]) => Promise<void>;
  onUpdateMatchDecision: (matchId: string, decision: 'accepted' | 'rejected') => Promise<void>;
  onReleaseEscrow: (matchId: string) => Promise<void>;
  onFinishAndPay: (matchId: string) => Promise<void>;
  onPersistMessage: (msg: Omit<ChatMessage, 'id' | 'user_id' | 'created_at'>) => Promise<void>;
};

function makeEntry(role: 'user' | 'agent', content: string, type: ChatEntry['type'] = 'text', extra?: Partial<ChatEntry>): ChatEntry {
  return { id: crypto.randomUUID(), role, content, type, timestamp: new Date(), ...extra };
}

const INITIAL_GIG_DATA: ExtractedGigData = {
  mode: null,
  category: null,
  title: '',
  description: '',
  campus_location: '',
  is_remote: false,
  pay_min: null,
  pay_max: null,
};

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
  onSaveGig,
  onSaveMatches,
  onUpdateMatchDecision,
  onReleaseEscrow,
  onFinishAndPay,
  onPersistMessage,
}: UseMiloChatOptions) {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [phase, setPhase] = useState<ConversationPhase>('mode_select');
  const [gigData, setGigData] = useState<ExtractedGigData>(INITIAL_GIG_DATA);
  const [isThinking, setIsThinking] = useState(false);
  const [currentGigId, setCurrentGigId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const loadedSessionRef = useRef<string | null>(null);

  // Load chat messages from DB when sessionId changes
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
          // Determine current phase from last message
          const last = data[data.length - 1] as ChatMessage;
          if (last.message_type === 'match_cards') {
            setPhase('browsing_matches');
          } else if (last.message_type === 'status' || last.message_type === 'error') {
            setPhase('mode_select');
          } else {
            setPhase('mode_select');
          }
        } else {
          setEntries([makeEntry('agent', getMiloGreeting())]);
          setPhase('mode_select');
        }
      } catch (err) {
        console.warn('Failed to load chat messages:', err);
        // Fallback to greeting
        setEntries([makeEntry('agent', getMiloGreeting())]);
        setPhase('mode_select');
      }
    }
    loadMessages();
  }, [sessionId]);

  const agentSay = useCallback((content: string, type: ChatEntry['type'] = 'text', extra?: Partial<ChatEntry>) => {
    const entry = makeEntry('agent', content, type, extra);
    setEntries((prev) => [...prev, entry]);
    // Persist with metadata containing matches for reconstruction
    const metadata: Record<string, unknown> = {};
    if (type === 'match_cards' && extra?.matches) {
      metadata.matches = extra.matches;
    }
    void onPersistMessage({ role: 'agent', content, message_type: type === 'match_cards' ? 'match_cards' : type === 'telemetry' ? 'telemetry' : 'text', metadata, session_id: sessionId });
    return entry;
  }, [onPersistMessage, sessionId]);

  const resetConversation = useCallback(() => {
    setPhase('mode_select');
    setGigData(INITIAL_GIG_DATA);
    setCurrentGigId(null);
  }, []);

  const handleWebhookFlow = useCallback(async (data: ExtractedGigData, rawMessage: string) => {
    const gigId = crypto.randomUUID();

    const savedGig = await onSaveGig({
      type: data.mode!,
      title: data.title || data.category || 'Campus Gig',
      content: data.description,
      category: data.category || 'Other',
      pay_min: data.pay_min ?? 0,
      pay_max: data.pay_max ?? 0,
      currency: 'USD',
      campus_location: data.campus_location,
      is_remote: data.is_remote,
      poster_name: profile.name,
      status: 'open',
      escrow_held: false,
      escrow_amount: 0,
      escrow_released: false,
      webhook_payload: null,
    });

    const resolvedGigId = savedGig.data?.id ?? gigId;
    setCurrentGigId(resolvedGigId);

    const telEntry = makeEntry('agent', '', 'telemetry', { showTelemetry: true });
    setEntries((prev) => [...prev, telEntry]);
    void onPersistMessage({ role: 'agent', content: '', message_type: 'telemetry', metadata: {}, session_id: sessionId });
    setPhase('submitted');

    const payload = buildWebhookPayload(profile, rawMessage, {
      gig_id: resolvedGigId,
      gig_type: data.mode!,
      category: data.category || 'Other',
      title: data.title || data.category || 'Campus Gig',
      content: data.description,
      pay_min: data.pay_min ?? 0,
      pay_max: data.pay_max ?? 0,
      campus_location: data.campus_location,
      is_remote: data.is_remote,
      extracted_topic: data.category || 'General',
    });

    try {
      abortRef.current = new AbortController();
      const response = await sendWebhookRequest(payload, abortRef.current.signal);

      if (!response.success || response.matches.length === 0) {
        agentSay("I couldn't find any matches right now. Try adjusting your preferences or check back shortly.", 'status');
        resetConversation();
        return;
      }

      const gigMatches: GigMatch[] = response.matches.map((m: WebhookMatch) => ({
        id: m.id,
        gig_id: resolvedGigId,
        user_id: userId,
        matched_user_name: m.matched_user_name,
        matched_user_id: m.matched_user_id,
        match_score: m.match_score,
        title: m.title,
        category: m.category,
        pay_min: m.pay_min,
        pay_max: m.pay_max,
        campus_location: m.campus_location,
        walk_time_mins: m.walk_time_mins,
        description: m.description,
        distance_miles: m.distance_miles,
        interest_tags: m.interest_tags,
        reasoning: m.reasoning,
        decision: null,
        escrow_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      await onSaveMatches(resolvedGigId, gigMatches);

      const top = gigMatches[0];
      agentSay(
        `Match Confirmed: **${top.matched_user_name}** is a **${top.match_score}% fit** and only a **${top.walk_time_mins}-minute walk** away. Here are your top matches:`,
        'text'
      );

      const matchEntry = makeEntry('agent', '', 'match_cards', { matches: gigMatches });
      setEntries((prev) => [...prev, matchEntry]);
      // Persist match cards with match data in metadata for reload
      void onPersistMessage({ role: 'agent', content: '', message_type: 'match_cards', metadata: { matches: gigMatches }, session_id: sessionId });
      setPhase('browsing_matches');
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      agentSay(
        "The matching service timed out. Please try again - your gig has been saved.",
        'error'
      );
      resetConversation();
    } finally {
      setIsThinking(false);
    }
  }, [profile, userId, onSaveGig, onSaveMatches, agentSay, resetConversation, sessionId]);

  const handleWorkerModeFlow = useCallback(async (data: ExtractedGigData, rawMessage: string) => {
    const telEntry = makeEntry('agent', '', 'telemetry', { showTelemetry: true });
    setEntries((prev) => [...prev, telEntry]);
    void onPersistMessage({ role: 'agent', content: '', message_type: 'telemetry', metadata: {}, session_id: sessionId });
    setPhase('submitted');

    try {
      // Generate mock available gigs based on user preferences
      const categories = ['Tech Support', 'Tutoring', 'Moving & Lifting', 'Pet Care', 'Photography', 'Graphic Design', 'Errands', 'Event Help'];
      const locations = ['East Hall', 'North Campus', 'Student Union', 'Library', 'Engineering Quad', 'South Dorms', 'Arts Building', 'West Village'];

      const availableGigs: GigMatch[] = [];
      const numGigs = 3 + Math.floor(Math.random() * 2); // 3-4 gigs

      for (let i = 0; i < numGigs; i++) {
        const cat = data.category !== 'Other' && data.category ? data.category : categories[Math.floor(Math.random() * categories.length)];
        const loc = locations[Math.floor(Math.random() * locations.length)];
        const payMin = data.pay_min ?? 15;
        const payMax = data.pay_max ?? 40;
        const posterName = ['Sam Johnson', 'Taylor Lee', 'Jordan Kim', 'Casey Brown', 'Riley Davis'][i % 5];

        availableGigs.push({
          id: crypto.randomUUID(),
          gig_id: crypto.randomUUID(),
          user_id: userId,
          matched_user_name: posterName,
          matched_user_id: `poster-${i}`,
          match_score: 75 + Math.floor(Math.random() * 20),
          title: `${cat} Help Needed`,
          category: cat,
          pay_min: payMin,
          pay_max: payMax,
          campus_location: loc,
          walk_time_mins: 3 + Math.floor(Math.random() * 12),
          description: `Looking for someone skilled in ${cat.toLowerCase()}. Flexible timing, pay negotiable.`,
          distance_miles: 0.3 + Math.random() * 1.5,
          interest_tags: [cat, 'Flexible Schedule', 'Quick Turnaround'],
          reasoning: {
            interest_similarity_weight: 65 + Math.floor(Math.random() * 20),
            distance_penalization_factor: 50 + Math.floor(Math.random() * 30),
            contextual_boost: 70,
            details: `Matches your interest in ${cat.toLowerCase()}. Located ${loc}.`,
          },
          decision: null,
          escrow_status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      agentSay(
        `Found **${availableGigs.length} available gigs** matching your interests! Here's what's available:`,
        'text'
      );

      const gigEntry = makeEntry('agent', '', 'match_cards', { matches: availableGigs });
      setEntries((prev) => [...prev, gigEntry]);
      void onPersistMessage({ role: 'agent', content: '', message_type: 'match_cards', metadata: { matches: availableGigs }, session_id: sessionId });
      setPhase('browsing_matches');
    } catch (err: unknown) {
      agentSay(
        "Something went wrong finding gigs. Please try again.",
        'error'
      );
      resetConversation();
    } finally {
      setIsThinking(false);
    }
  }, [userId, agentSay, resetConversation, sessionId, onPersistMessage]);

  const handleUserMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isThinking) return;

    const userEntry = makeEntry('user', trimmed);
    setEntries((prev) => [...prev, userEntry]);
    void onPersistMessage({ role: 'user', content: trimmed, message_type: 'text', metadata: {}, session_id: sessionId });

    const lower = trimmed.toLowerCase();

    if ((lower.includes('switch') || lower.includes('actually')) && phase !== 'mode_select') {
      const newMode = detectMode(trimmed);
      if (newMode) {
        setGigData({ ...INITIAL_GIG_DATA, mode: newMode });
        setPhase('collect_category');
        agentSay(`Switched to ${newMode === 'post' ? 'posting' : 'finding'} mode! What kind of ${newMode === 'post' ? 'help do you need' : 'gig are you looking for'}?`);
        return;
      }
    }

    setIsThinking(true);
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 300));

    if (phase === 'mode_select' || phase === 'greeting') {
      const mode = detectMode(trimmed) ?? (lower.includes('post') || lower.includes('need someone') || lower.includes('hire') ? 'post' : lower.includes('find') || lower.includes('search') || lower.includes('earn') || lower.includes('work') || lower.includes('job') || lower.includes('gig') ? 'search' : null);
      if (!mode) {
        agentSay("I can help you **post a gig** (need something done) or **find a gig** (earn money). Which would you like?");
        setIsThinking(false);
        return;
      }
      setGigData((prev) => ({ ...prev, mode }));
      setPhase('collect_category');
      agentSay(mode === 'post' ? "What kind of help do you need? (e.g. moving furniture, tutoring, tech support...)" : "What kind of gig are you looking for? (e.g. tutoring, errands, design work...)");
      setIsThinking(false);
      return;
    }

    if (phase === 'collect_category') {
      const category = detectCategory(trimmed) as GigCategory;
      const updatedData: ExtractedGigData = { ...gigData, category, description: trimmed, title: category !== 'Other' ? category : trimmed.slice(0, 60) };
      setGigData(updatedData);

      // For search mode, skip location/pay and go directly to confirm
      if (gigData.mode === 'search') {
        setPhase('confirm');
        agentSay(getMiloResponse('confirm', updatedData, trimmed));
      } else {
        setPhase('collect_location');
        agentSay(getMiloResponse('collect_category', updatedData, trimmed));
      }
      setIsThinking(false);
      return;
    }

    if (phase === 'collect_location') {
      const loc = extractLocation(trimmed);
      const isRemote = trimmed.toLowerCase().includes('remote') || trimmed.toLowerCase().includes('online');
      const pay = extractPayRange(trimmed);
      const updatedData: ExtractedGigData = { ...gigData, campus_location: loc || gigData.campus_location, is_remote: isRemote, pay_min: pay.min ?? gigData.pay_min, pay_max: pay.max ?? gigData.pay_max };
      setGigData(updatedData);
      if (updatedData.pay_min === null) { setPhase('collect_pay'); agentSay(getMiloResponse('collect_pay', updatedData, trimmed)); }
      else { setPhase('confirm'); agentSay(getMiloResponse('confirm', updatedData, trimmed)); }
      setIsThinking(false);
      return;
    }

    if (phase === 'collect_pay') {
      const pay = extractPayRange(trimmed);
      const updatedData: ExtractedGigData = { ...gigData, pay_min: pay.min ?? profile.pay_min, pay_max: pay.max ?? profile.pay_max };
      setGigData(updatedData);
      setPhase('confirm');
      agentSay(getMiloResponse('confirm', updatedData, trimmed));
      setIsThinking(false);
      return;
    }

    if (phase === 'confirm') {
      const confirmed = lower.includes('yes') || lower.includes('correct') || lower.includes('good') || lower.includes('post it') || lower.includes('submit') || lower.includes('looks right') || lower === 'y';
      if (confirmed) {
        agentSay(getMiloResponse('submitted', gigData, trimmed));
        if (gigData.mode === 'search') {
          await handleWorkerModeFlow(gigData, trimmed);
        } else {
          await handleWebhookFlow(gigData, trimmed);
        }
      } else {
        setPhase('collect_category');
        agentSay("No problem! Let's adjust. What would you like to change?");
        setIsThinking(false);
      }
      return;
    }

    if (phase === 'browsing_matches' || phase === 'submitted') {
      agentSay("Your options are shown above. Accept or decline each one. Want to search for something else?");
      resetConversation();
      setIsThinking(false);
      return;
    }

    agentSay("I'm not sure I understood that. Are you looking to post a gig or find one to work on?");
    setPhase('mode_select');
    setIsThinking(false);
  }, [phase, gigData, isThinking, profile, agentSay, handleWebhookFlow, handleWorkerModeFlow, resetConversation, onPersistMessage, sessionId]);

  const handleAcceptMatch = useCallback(async (matchId: string, allMatches: GigMatch[]) => {
    await onUpdateMatchDecision(matchId, 'accepted');
    const match = allMatches.find((m) => m.id === matchId);
    agentSay(
      match
        ? `**$${match.pay_max}** is now held in escrow. Waiting on **${match.matched_user_name}** to accept the job. Open their demo profile to respond on their behalf.`
        : 'Match accepted! Escrow is now active.',
      'status'
    );
  }, [onUpdateMatchDecision, agentSay]);

  const handleDeclineMatch = useCallback(async (matchId: string) => {
    await onUpdateMatchDecision(matchId, 'rejected');
  }, [onUpdateMatchDecision]);

  const handleReleaseEscrow = useCallback(async (matchId: string, allMatches: GigMatch[]) => {
    await onReleaseEscrow(matchId);
    const match = allMatches.find((m) => m.id === matchId);
    agentSay(match ? `Escrow released - $${match.pay_max} sent to ${match.matched_user_name}. Gig complete!` : 'Escrow payment released.', 'status');
  }, [onReleaseEscrow, agentSay]);

  const handleFinishAndPay = useCallback(async (matchId: string, allMatches: GigMatch[]) => {
    await onFinishAndPay(matchId);
    const match = allMatches.find((m) => m.id === matchId);
    agentSay(
      match
        ? `Payment complete! **$${match.pay_max}** was released from escrow to ${match.matched_user_name}. Thanks for using Milo.`
        : 'Payment released. Gig complete!',
      'status'
    );
  }, [onFinishAndPay, agentSay]);

  return { entries, phase, isThinking, currentGigId, handleUserMessage, handleAcceptMatch, handleDeclineMatch, handleReleaseEscrow, handleFinishAndPay };
}
