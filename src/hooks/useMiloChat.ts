import { useState, useCallback, useRef } from 'react';
import type { UserProfile, GigMatch, ChatMessage } from '../lib/supabase';
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
  onSaveGig: (gig: Parameters<import('../hooks/useAppState').useAppState['saveGig']>[0]) => Promise<{ data: import('../lib/supabase').Gig | null; error: unknown }>;
  onSaveMatches: (gigId: string, matches: GigMatch[]) => Promise<void>;
  onUpdateMatchDecision: (matchId: string, decision: 'accepted' | 'rejected') => Promise<void>;
  onReleaseEscrow: (matchId: string) => Promise<void>;
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

export function useMiloChat({
  profile,
  userId,
  onSaveGig,
  onSaveMatches,
  onUpdateMatchDecision,
  onReleaseEscrow,
  onPersistMessage,
}: UseMiloChatOptions) {
  const [entries, setEntries] = useState<ChatEntry[]>(() => [
    makeEntry('agent', getMiloGreeting()),
  ]);
  const [phase, setPhase] = useState<ConversationPhase>('mode_select');
  const [gigData, setGigData] = useState<ExtractedGigData>(INITIAL_GIG_DATA);
  const [isThinking, setIsThinking] = useState(false);
  const [currentGigId, setCurrentGigId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const addEntry = useCallback((entry: ChatEntry) => {
    setEntries((prev) => [...prev, entry]);
  }, []);

  const agentSay = useCallback((content: string, type: ChatEntry['type'] = 'text', extra?: Partial<ChatEntry>) => {
    const entry = makeEntry('agent', content, type, extra);
    setEntries((prev) => [...prev, entry]);
    void onPersistMessage({ role: 'agent', content, message_type: type === 'match_cards' ? 'match_cards' : 'text', metadata: {} });
    return entry;
  }, [onPersistMessage]);

  const resetConversation = useCallback(() => {
    setPhase('mode_select');
    setGigData(INITIAL_GIG_DATA);
    setCurrentGigId(null);
  }, []);

  const handleWebhookFlow = useCallback(async (data: ExtractedGigData, rawMessage: string) => {
    const gigId = crypto.randomUUID();

    // Save gig to DB
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

    // Show telemetry
    const telEntry = makeEntry('agent', '', 'telemetry', { showTelemetry: true });
    setEntries((prev) => [...prev, telEntry]);
    setPhase('submitted');

    // Build and send webhook
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

      // Convert to GigMatch shape
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
      setPhase('browsing_matches');
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      agentSay(
        "The matching service timed out. Please try again — your gig has been saved.",
        'error'
      );
      resetConversation();
    } finally {
      setIsThinking(false);
    }
  }, [profile, userId, onSaveGig, onSaveMatches, agentSay, resetConversation]);

  const handleUserMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isThinking) return;

    const userEntry = makeEntry('user', trimmed);
    setEntries((prev) => [...prev, userEntry]);
    void onPersistMessage({ role: 'user', content: trimmed, message_type: 'text', metadata: {} });

    const lower = trimmed.toLowerCase();

    // Allow mode switch at any time
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

    // Small natural delay
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 300));

    if (phase === 'mode_select' || phase === 'greeting') {
      const mode = detectMode(trimmed) ?? (lower.includes('post') ? 'post' : lower.includes('find') || lower.includes('search') || lower.includes('earn') ? 'search' : null);

      if (!mode) {
        agentSay("I can help you **post a gig** (need something done) or **find a gig** (earn money). Which would you like?");
        setIsThinking(false);
        return;
      }

      setGigData((prev) => ({ ...prev, mode }));
      setPhase('collect_category');
      agentSay(
        mode === 'post'
          ? "What kind of help do you need? (e.g. moving furniture, tutoring, car maintenance, tech support...)"
          : "What kind of gig are you looking for? (e.g. tutoring, errands, design work, tech support...)"
      );
      setIsThinking(false);
      return;
    }

    if (phase === 'collect_category') {
      const category = detectCategory(trimmed) as GigCategory;
      const updatedData: ExtractedGigData = {
        ...gigData,
        category,
        description: trimmed,
        title: category !== 'Other' ? category : trimmed.slice(0, 60),
      };
      setGigData(updatedData);
      setPhase('collect_location');
      agentSay(getMiloResponse('collect_category', updatedData, trimmed));
      setIsThinking(false);
      return;
    }

    if (phase === 'collect_location') {
      const loc = extractLocation(trimmed);
      const isRemote = trimmed.toLowerCase().includes('remote') || trimmed.toLowerCase().includes('online');
      const pay = extractPayRange(trimmed);

      const updatedData: ExtractedGigData = {
        ...gigData,
        campus_location: loc || gigData.campus_location,
        is_remote: isRemote,
        pay_min: pay.min ?? gigData.pay_min,
        pay_max: pay.max ?? gigData.pay_max,
      };
      setGigData(updatedData);

      if (updatedData.pay_min === null) {
        setPhase('collect_pay');
        agentSay(getMiloResponse('collect_pay', updatedData, trimmed));
      } else {
        setPhase('confirm');
        agentSay(getMiloResponse('confirm', updatedData, trimmed));
      }
      setIsThinking(false);
      return;
    }

    if (phase === 'collect_pay') {
      const pay = extractPayRange(trimmed);
      const updatedData: ExtractedGigData = {
        ...gigData,
        pay_min: pay.min ?? profile.pay_min,
        pay_max: pay.max ?? profile.pay_max,
      };
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
        await handleWebhookFlow(gigData, trimmed);
      } else {
        // Re-collect
        setPhase('collect_category');
        agentSay("No problem! Let's adjust. What would you like to change — the category, location, or pay range?");
        setIsThinking(false);
      }
      return;
    }

    if (phase === 'browsing_matches' || phase === 'submitted') {
      agentSay("Your matches are shown above. You can accept or decline each one. Want to post another gig or search for something else?");
      resetConversation();
      setIsThinking(false);
      return;
    }

    agentSay("I'm not sure I understood that. Are you looking to post a gig or find one?");
    setPhase('mode_select');
    setIsThinking(false);
  }, [phase, gigData, isThinking, profile, agentSay, handleWebhookFlow, resetConversation, onPersistMessage]);

  const handleAcceptMatch = useCallback(async (matchId: string, allMatches: GigMatch[]) => {
    await onUpdateMatchDecision(matchId, 'accepted');
    const match = allMatches.find((m) => m.id === matchId);
    agentSay(
      match
        ? `Payment of **$${match.pay_max}** is now held in escrow. ${match.matched_user_name} has been notified — your gig is in progress!`
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
    agentSay(
      match ? `Escrow released — $${match.pay_max} sent to ${match.matched_user_name}. Gig complete!` : 'Escrow payment released.',
      'status'
    );
  }, [onReleaseEscrow, agentSay]);

  return {
    entries,
    phase,
    isThinking,
    currentGigId,
    handleUserMessage,
    handleAcceptMatch,
    handleDeclineMatch,
    handleReleaseEscrow,
  };
}
