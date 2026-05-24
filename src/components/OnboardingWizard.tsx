import { useState } from 'react';
import { MapPin, Clock, DollarSign, Tag, ChevronRight, Sparkles, User } from 'lucide-react';
import type { UserProfile } from '../lib/supabase';

const SKILL_TAGS = [
  'Tech/AI', 'Programming', 'Web Development', 'Fitness', 'Indie Music', 'Gamer',
  'Culinary Arts', 'Photography', 'Graphic Design', 'Tutoring', 'Pet Care',
  'Event Planning', 'Tech Support', 'Cleaning', 'Errands', 'Moving & Lifting',
  'Streaming', 'Robotics', 'Music Production', 'Creative Writing', 'Dance',
  'Car Maintenance', 'Video Editing', 'Sports Training', 'Nutrition',
];

const WALK_TIMES: { label: string; value: 10 | 20 | 40 }[] = [
  { label: 'Less than a 10 min walk', value: 10 },
  { label: '10-20 min walk', value: 20 },
  { label: '20+ min walk', value: 40 },
];

const ROLES: { label: string; value: 'poster' | 'finder' | 'both'; desc: string }[] = [
  { label: 'Post Gigs', value: 'poster', desc: 'I need help' },
  { label: 'Find Gigs', value: 'finder', desc: 'I want to earn' },
  { label: 'Both', value: 'both', desc: 'I do both' },
];

type Props = {
  onComplete: (data: Omit<UserProfile, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => void;
};

export function OnboardingWizard({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [role, setRole] = useState<'poster' | 'finder' | 'both'>('both');
  const [location, setLocation] = useState('');
  const [walkTime, setWalkTime] = useState<10 | 20 | 40>(10);
  const [payMin, setPayMin] = useState(15);
  const [payMax, setPayMax] = useState(40);
  const [skills, setSkills] = useState<string[]>([]);

  const toggleSkill = (tag: string) => {
    setSkills((prev) => prev.includes(tag) ? prev.filter((s) => s !== tag) : [...prev, tag]);
  };

  const canAdvance = () => {
    if (step === 0) return name.trim().length > 0;
    if (step === 2) return location.trim().length > 0;
    if (step === 3) return payMin > 0 && payMax >= payMin;
    return true;
  };

  const handleFinish = () => {
    onComplete({
      name: name.trim(),
      role,
      campus_location: location.trim(),
      max_walk_time_mins: walkTime,
      pay_min: payMin,
      pay_max: payMax,
      skills_interests: skills,
      onboarding_complete: true,
      avatar_url: null,
      bio: '',
      latitude: null,
      longitude: null,
      skills: [],
      availability: 'flexible',
    });
  };

  const steps = [
    {
      icon: <User className="w-6 h-6 text-brand-400" />,
      title: 'Welcome to Milo',
      subtitle: 'Your campus gig concierge',
      content: (
        <div className="space-y-4">
          <p className="text-surface-400 text-sm">Set up your profile in 60 seconds.</p>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Your Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex Chen"
              className="w-full px-4 py-3 bg-surface-800 border border-surface-700 rounded-xl text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/60 transition-all" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">I want to...</label>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map((r) => (
                <button key={r.value} onClick={() => setRole(r.value)}
                  className={`p-3 rounded-xl border text-left transition-all ${role === r.value ? 'border-brand-500 bg-brand-500/10 text-white' : 'border-surface-700 bg-surface-800/50 text-surface-400 hover:border-surface-600'}`}>
                  <div className="font-semibold text-sm">{r.label}</div>
                  <div className="text-xs text-surface-500 mt-0.5">{r.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      icon: <Clock className="w-6 h-6 text-cyan-400" />,
      title: 'Proximity',
      subtitle: 'How far are you willing to go?',
      content: (
        <div className="space-y-3">
          {WALK_TIMES.map((wt) => (
            <button key={wt.value} onClick={() => setWalkTime(wt.value)}
              className={`w-full p-4 rounded-xl border text-left transition-all flex items-center justify-between ${walkTime === wt.value ? 'border-brand-500 bg-brand-500/10 text-white' : 'border-surface-700 bg-surface-800/50 text-surface-400 hover:border-surface-600'}`}>
              <span className="text-sm">{wt.label}</span>
              {walkTime === wt.value && <div className="w-2 h-2 rounded-full bg-brand-400" />}
            </button>
          ))}
        </div>
      ),
    },
    {
      icon: <MapPin className="w-6 h-6 text-brand-400" />,
      title: 'Campus Location',
      subtitle: 'Where are you based?',
      content: (
        <div className="space-y-4">
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. East Hall, North Campus..."
            className="w-full px-4 py-3 bg-surface-800 border border-surface-700 rounded-xl text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/60 transition-all" autoFocus />
          <div className="flex flex-wrap gap-2">
            {['East Hall', 'North Campus', 'Student Union', 'Library', 'Engineering Quad', 'South Dorms'].map((loc) => (
              <button key={loc} onClick={() => setLocation(loc)}
                className="px-3 py-1.5 text-xs bg-surface-800 hover:bg-surface-700 border border-surface-700 hover:border-surface-600 rounded-lg text-surface-400 hover:text-white transition-all">{loc}</button>
            ))}
          </div>
        </div>
      ),
    },
    {
      icon: <DollarSign className="w-6 h-6 text-accent-400" />,
      title: 'Pay Range',
      subtitle: 'Your expected hourly rates',
      content: (
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-surface-300">Minimum</label>
              <span className="text-brand-400 font-mono font-semibold">${payMin}/hr</span>
            </div>
            <input type="range" min={5} max={100} step={5} value={payMin} onChange={(e) => setPayMin(Number(e.target.value))} className="w-full accent-brand-500" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-surface-300">Maximum</label>
              <span className="text-brand-400 font-mono font-semibold">${payMax}/hr</span>
            </div>
            <input type="range" min={5} max={200} step={5} value={payMax} onChange={(e) => setPayMax(Math.max(Number(e.target.value), payMin))} className="w-full accent-brand-500" />
          </div>
          <div className="p-3 bg-surface-800/50 rounded-xl border border-surface-700 text-center">
            <span className="text-surface-400 text-sm">Range: </span>
            <span className="text-white font-bold">${payMin} - ${payMax} / hr</span>
          </div>
        </div>
      ),
    },
    {
      icon: <Tag className="w-6 h-6 text-accent-400" />,
      title: 'Skills & Interests',
      subtitle: 'What are you into?',
      content: (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto pr-1">
            {SKILL_TAGS.map((tag) => (
              <button key={tag} onClick={() => toggleSkill(tag)}
                className={`px-3 py-1.5 text-sm rounded-full border transition-all ${skills.includes(tag) ? 'border-brand-500 bg-brand-500/20 text-brand-300' : 'border-surface-700 bg-surface-800/50 text-surface-400 hover:border-surface-600 hover:text-white'}`}>
                {tag}
              </button>
            ))}
          </div>
          {skills.length > 0 && <p className="text-xs text-surface-500">{skills.length} selected</p>}
        </div>
      ),
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="h-screen bg-surface-950 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg my-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-gradient-to-br from-brand-400 to-brand-600 rounded-2xl flex items-center justify-center shadow-glow">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">Milo</h1>
            <p className="text-xs text-surface-400">Campus Gig Marketplace</p>
          </div>
        </div>

        <div className="flex gap-1.5 mb-8">
          {steps.map((_, i) => (
            <div key={i} className={`h-1 rounded-full flex-1 transition-all duration-300 ${i <= step ? 'bg-brand-500' : 'bg-surface-700'}`} />
          ))}
        </div>

        <div className="glass rounded-2xl border border-surface-700/50 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-surface-800 rounded-xl">{current.icon}</div>
            <div>
              <h2 className="text-xl font-bold text-white">{current.title}</h2>
              <p className="text-sm text-surface-400">{current.subtitle}</p>
            </div>
          </div>
          {current.content}
          <div className="flex items-center justify-between mt-8">
            <button onClick={() => setStep((s) => s - 1)} disabled={step === 0}
              className="px-4 py-2 text-sm text-surface-400 hover:text-white disabled:opacity-0 transition-all">Back</button>
            <button onClick={isLast ? handleFinish : () => setStep((s) => s + 1)} disabled={!canAdvance()}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 disabled:from-surface-700 disabled:to-surface-700 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-glow disabled:shadow-none">
              {isLast ? 'Start Using Milo' : 'Continue'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="text-center text-xs text-surface-600 mt-4">Step {step + 1} of {steps.length}</p>
      </div>
    </div>
  );
}
