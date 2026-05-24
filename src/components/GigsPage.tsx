import { useState, useMemo } from 'react';
import { ArrowLeft, MapPin, DollarSign, Clock, Tag, Users, Search, Filter, Send, CheckCircle, User } from 'lucide-react';
import type { Gig, GigApplication, UserProfile } from '../lib/supabase';

type Props = {
  profile: UserProfile;
  allOpenGigs: Gig[];
  applications: GigApplication[];
  onApplyToGig: (gig: Gig, message: string) => Promise<{ error: string | null | unknown }>;
  onBack: () => void;
};

const CATEGORIES = ['All', 'Tutoring & Academic Help', 'Tech Support & Repairs', 'Moving & Lifting', 'Cleaning & Organization', 'Photography & Videography', 'Graphic Design & Creative Work', 'Food & Grocery Runs', 'Pet Care', 'Event Help & Setup', 'Other'];

export function GigsPage({ profile, allOpenGigs, applications, onApplyToGig, onBack }: Props) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [applyingTo, setApplyingTo] = useState<string | null>(null);
  const [applyMessage, setApplyMessage] = useState('');
  const [applied, setApplied] = useState<Set<string>>(() => {
    const s = new Set<string>();
    applications.filter((a) => a.applicant_id === profile.user_id).forEach((a) => s.add(a.gig_id));
    return s;
  });

  const filtered = useMemo(() => {
    return allOpenGigs.filter((g) => {
      if (g.user_id === profile.user_id) return false;
      if (category !== 'All' && g.category !== category) return false;
      if (search) {
        const q = search.toLowerCase();
        return g.title.toLowerCase().includes(q) || g.content.toLowerCase().includes(q) || g.category.toLowerCase().includes(q) || g.campus_location.toLowerCase().includes(q);
      }
      return true;
    });
  }, [allOpenGigs, category, search, profile.user_id]);

  const handleApply = async (gig: Gig) => {
    if (!applyMessage.trim()) return;
    const result = await onApplyToGig(gig, applyMessage.trim());
    if (!result.error) {
      setApplied((prev) => new Set([...prev, gig.id]));
      setApplyingTo(null);
      setApplyMessage('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-cyan-900/8 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800/60 bg-slate-900/30 backdrop-blur-sm">
          <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg transition-all">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-white">Available Gigs</h2>
            <p className="text-xs text-slate-400">{filtered.length} gigs matching your criteria</p>
          </div>
        </div>

        {/* Filters */}
        <div className="px-5 py-3 border-b border-slate-800/40 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search gigs by title, category, or location..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800/60 border border-slate-700/60 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 text-xs rounded-full border whitespace-nowrap transition-all ${
                  category === cat
                    ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400'
                    : 'bg-slate-800/40 border-slate-700/40 text-slate-400 hover:border-slate-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Gigs List */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <Filter className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400">No gigs found matching your criteria</p>
              <p className="text-xs text-slate-600 mt-1">Try adjusting your filters or search</p>
            </div>
          ) : (
            filtered.map((gig) => (
              <div key={gig.id} className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4 hover:border-slate-600 transition-all">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-semibold truncate">{gig.title}</h3>
                    <div className="flex items-center gap-1 mt-1">
                      <Tag className="w-3 h-3 text-cyan-400" />
                      <span className="text-xs text-slate-400">{gig.category}</span>
                    </div>
                  </div>
                  <span className="px-2 py-1 text-xs rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex-shrink-0 ml-3">
                    {gig.status}
                  </span>
                </div>

                <p className="text-sm text-slate-400 mb-3 line-clamp-2">{gig.content || gig.category}</p>

                <div className="flex flex-wrap gap-3 mb-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    <span>${gig.pay_min} - ${gig.pay_max}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-blue-400" />
                    <span>{gig.campus_location || 'Campus'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    <span>{gig.applicant_count} applicant{gig.applicant_count !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{new Date(gig.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {gig.poster_name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-xs text-slate-300">{gig.poster_name}</span>
                </div>

                {applied.has(gig.id) ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-400">
                    <CheckCircle className="w-4 h-4" />
                    <span>Applied</span>
                  </div>
                ) : applyingTo === gig.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={applyMessage}
                      onChange={(e) => setApplyMessage(e.target.value)}
                      placeholder="Why are you a good fit for this gig?"
                      rows={2}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApply(gig)}
                        disabled={!applyMessage.trim()}
                        className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:from-slate-700 disabled:to-slate-700 rounded-lg text-white text-xs font-semibold transition-all"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Submit Application
                      </button>
                      <button
                        onClick={() => { setApplyingTo(null); setApplyMessage(''); }}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 text-xs font-semibold transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setApplyingTo(gig.id)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 rounded-lg text-white text-xs font-semibold transition-all shadow-sm shadow-cyan-500/20"
                  >
                    <User className="w-3.5 h-3.5" />
                    Apply Now
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
