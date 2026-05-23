import { useState, useEffect, useCallback } from 'react';
import { supabase, type UserProfile, type Gig, type GigMatch, type ChatMessage } from '../lib/supabase';

const ANONYMOUS_USER_KEY = 'milo_anon_user_id';

function getOrCreateAnonUserId(): string {
  let id = localStorage.getItem(ANONYMOUS_USER_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(ANONYMOUS_USER_KEY, id);
  }
  return id;
}

export function useAppState() {
  const [userId] = useState<string>(getOrCreateAnonUserId);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeGigs, setActiveGigs] = useState<Gig[]>([]);
  const [matches, setMatches] = useState<GigMatch[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [profileRes, gigsRes, messagesRes] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('gigs').select('*').eq('user_id', userId).in('status', ['open', 'matched', 'in_progress']).order('created_at', { ascending: false }),
        supabase.from('chat_messages').select('*').eq('user_id', userId).order('created_at', { ascending: true }).limit(100),
      ]);

      if (profileRes.data) setProfile(profileRes.data as UserProfile);
      if (gigsRes.data) setActiveGigs(gigsRes.data as Gig[]);
      if (messagesRes.data) setMessages(messagesRes.data as ChatMessage[]);

      setLoading(false);
    }
    load();
  }, [userId]);

  const saveProfile = useCallback(async (data: Partial<Omit<UserProfile, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
    const payload = { ...data, user_id: userId };
    const { data: saved, error } = await supabase
      .from('user_profiles')
      .upsert([payload], { onConflict: 'user_id' })
      .select()
      .single();

    if (!error && saved) setProfile(saved as UserProfile);
    return { error };
  }, [userId]);

  const addMessage = useCallback(async (msg: Omit<ChatMessage, 'id' | 'user_id' | 'created_at'>) => {
    const optimistic: ChatMessage = {
      ...msg,
      id: crypto.randomUUID(),
      user_id: userId,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    await supabase.from('chat_messages').insert([{ ...msg, user_id: userId }]);
  }, [userId]);

  const saveGig = useCallback(async (gig: Omit<Gig, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('gigs')
      .insert([{ ...gig, user_id: userId }])
      .select()
      .single();

    if (!error && data) {
      setActiveGigs((prev) => [data as Gig, ...prev]);
      return { data: data as Gig, error: null };
    }
    return { data: null, error };
  }, [userId]);

  const saveMatches = useCallback(async (gigId: string, incomingMatches: GigMatch[]) => {
    const rows = incomingMatches.map((m) => ({ ...m, gig_id: gigId, user_id: userId }));
    await supabase.from('gig_matches').insert(rows);
    setMatches((prev) => [...incomingMatches, ...prev]);
  }, [userId]);

  const updateMatchDecision = useCallback(async (matchId: string, decision: 'accepted' | 'rejected') => {
    await supabase.from('gig_matches').update({ decision, escrow_status: decision === 'accepted' ? 'held' : 'pending' }).eq('id', matchId);
    setMatches((prev) => prev.map((m) => m.id === matchId ? { ...m, decision, escrow_status: decision === 'accepted' ? 'held' : 'pending' } : m));

    if (decision === 'accepted') {
      const match = matches.find((m) => m.id === matchId);
      if (match) {
        await supabase.from('gigs').update({ status: 'matched', escrow_held: true, escrow_amount: match.pay_max }).eq('id', match.gig_id);
        setActiveGigs((prev) => prev.map((g) => g.id === match.gig_id ? { ...g, status: 'matched', escrow_held: true, escrow_amount: match.pay_max } : g));
      }
    }
  }, [matches]);

  const releaseEscrow = useCallback(async (matchId: string) => {
    await supabase.from('gig_matches').update({ escrow_status: 'released' }).eq('id', matchId);
    setMatches((prev) => prev.map((m) => m.id === matchId ? { ...m, escrow_status: 'released' } : m));
  }, []);

  const totalEscrow = activeGigs.reduce((sum, g) => sum + (g.escrow_held && !g.escrow_released ? g.escrow_amount : 0), 0);

  return {
    userId,
    profile,
    activeGigs,
    matches,
    messages,
    loading,
    totalEscrow,
    saveProfile,
    addMessage,
    saveGig,
    saveMatches,
    updateMatchDecision,
    releaseEscrow,
  };
}
