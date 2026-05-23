import React, { useState, useRef } from 'react';
import { ArrowLeft, User, MapPin, DollarSign, Tag, Clock, Camera, Save, Loader2, Check, X } from 'lucide-react';
import type { UserProfile } from '../lib/supabase';
import { LocationMap } from './LocationMap';

const SKILL_OPTIONS = [
  'SAT Prep', 'ACT Prep', 'AP Calculus', 'AP Physics', 'AP Chemistry',
  'Essay Writing', 'College Applications', 'AI Research', 'Advanced Calculus',
  'Statistics', 'Programming', 'Web Development', 'Graphic Design',
  'Photography', 'Video Editing', 'Spanish', 'French', 'Chinese',
  'Moving & Lifting', 'Pet Care', 'Cooking', 'Event Planning',
  'Tech Support', 'Car Maintenance', 'Cleaning', 'Errands', 'Tutoring',
];

const AVATARS = [
  'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?w=150&h=150&fit=crop',
  'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?w=150&h=150&fit=crop',
  'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?w=150&h=150&fit=crop',
  'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?w=150&h=150&fit=crop',
  'https://images.pexels.com/photos/1137511/pexels-photo-1137511.jpeg?w=150&h=150&fit=crop',
  'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?w=150&h=150&fit=crop',
];

type Props = {
  profile: UserProfile;
  onSave: (data: Partial<UserProfile>) => Promise<void>;
  onBack: () => void;
};

export function SettingsPage({ profile, onSave, onBack }: Props) {
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio || '');
  const [campusLocation, setCampusLocation] = useState(profile.campus_location);
  const [lat, setLat] = useState(profile.latitude);
  const [lng, setLng] = useState(profile.longitude);
  const [payMin, setPayMin] = useState(profile.pay_min);
  const [payMax, setPayMax] = useState(profile.pay_max);
  const [walkTime, setWalkTime] = useState<10 | 20 | 40>(profile.max_walk_time_mins);
  const [availability, setAvailability] = useState(profile.availability || 'flexible');
  const [skills, setSkills] = useState<string[]>(profile.skills_interests || []);
  const [customSkills, setCustomSkills] = useState<string[]>(profile.skills || []);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || AVATARS[0]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const toggleSkill = (skill: string) => {
    setSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]));
  };

  const addCustomSkill = () => {
    const skill = newSkill.trim();
    if (skill && !customSkills.includes(skill) && !SKILL_OPTIONS.includes(skill)) {
      setCustomSkills((prev) => [...prev, skill]);
      setNewSkill('');
    }
  };

  const removeCustomSkill = (skill: string) => {
    setCustomSkills((prev) => prev.filter((s) => s !== skill));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        name,
        bio,
        campus_location: campusLocation,
        latitude: lat,
        longitude: lng,
        pay_min: payMin,
        pay_max: payMax,
        max_walk_time_mins: walkTime,
        availability: availability as UserProfile['availability'],
        skills_interests: skills,
        skills: customSkills,
        avatar_url: avatarUrl,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-lg border-b border-slate-800/60 px-4 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back to Chat</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 rounded-lg text-white text-sm font-semibold transition-all disabled:from-slate-700 disabled:to-slate-700"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-8">
        {/* Profile Picture */}
        <section>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
            <User className="w-5 h-5 text-cyan-400" />
            Profile Picture
          </h3>
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={avatarUrl}
                alt="Profile"
                className="w-20 h-20 rounded-xl object-cover border-2 border-slate-700"
              />
              <button
                onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                className="absolute -bottom-1 -right-1 w-7 h-7 bg-cyan-500 rounded-lg flex items-center justify-center text-white hover:bg-cyan-400 transition-all"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>
            <div>
              <p className="text-sm text-white font-medium">{name}</p>
              <p className="text-xs text-slate-400">{profile.role} · {campusLocation || 'No location'}</p>
            </div>
          </div>

          {showAvatarPicker && (
            <div className="mt-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
              <p className="text-xs text-slate-400 mb-3">Choose an avatar:</p>
              <div className="flex flex-wrap gap-3">
                {AVATARS.map((url) => (
                  <button
                    key={url}
                    onClick={() => {
                      setAvatarUrl(url);
                      setShowAvatarPicker(false);
                    }}
                    className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                      avatarUrl === url ? 'border-cyan-500' : 'border-transparent hover:border-slate-600'
                    }`}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Name & Bio */}
        <section>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
            <User className="w-5 h-5 text-cyan-400" />
            Profile Information
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">About Me</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell others about yourself, your experience, and what you're looking for..."
                rows={3}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all resize-none"
              />
            </div>
          </div>
        </section>

        {/* Location */}
        <section>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
            <MapPin className="w-5 h-5 text-cyan-400" />
            Location
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Campus Location</label>
              <input
                type="text"
                value={campusLocation}
                onChange={(e) => setCampusLocation(e.target.value)}
                placeholder="e.g. East Hall, North Campus"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Map Location</label>
              <LocationMap
                latitude={lat}
                longitude={lng}
                campusLocation={campusLocation}
                editable
                onLocationSelect={(newLat, newLng) => {
                  setLat(newLat);
                  setLng(newLng);
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Maximum Walking Distance</label>
              <select
                value={walkTime}
                onChange={(e) => setWalkTime(Number(e.target.value) as 10 | 20 | 40)}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
              >
                <option value={10}>Less than 10 min walk</option>
                <option value={20}>10-20 min walk</option>
                <option value={40}>20+ min walk</option>
              </select>
            </div>
          </div>
        </section>

        {/* Pay Range */}
        <section>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
            <DollarSign className="w-5 h-5 text-cyan-400" />
            Pay Expectations
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-300">Minimum: ${payMin}/hr</label>
              <label className="text-sm font-medium text-slate-300">Maximum: ${payMax}/hr</label>
            </div>
            <div className="flex gap-4">
              <input
                type="range"
                min={5} max={100} step={5}
                value={payMin}
                onChange={(e) => setPayMin(Number(e.target.value))}
                className="flex-1 accent-cyan-500"
              />
              <input
                type="range"
                min={5} max={200} step={5}
                value={payMax}
                onChange={(e) => setPayMax(Math.max(Number(e.target.value), payMin))}
                className="flex-1 accent-cyan-500"
              />
            </div>
            <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700 text-center">
              <span className="text-slate-400 text-sm">Target range: </span>
              <span className="text-white font-semibold">${payMin} – ${payMax} / hr</span>
            </div>
          </div>
        </section>

        {/* Availability */}
        <section>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
            <Clock className="w-5 h-5 text-cyan-400" />
            Availability
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { value: 'flexible', label: 'Flexible' },
              { value: 'mornings', label: 'Mornings' },
              { value: 'afternoons', label: 'Afternoons' },
              { value: 'evenings', label: 'Evenings' },
              { value: 'weekends_only', label: 'Weekends Only' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setAvailability(opt.value as UserProfile['availability'])}
                className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                  availability === opt.value
                    ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400'
                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* Skills & Interests */}
        <section>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
            <Tag className="w-5 h-5 text-cyan-400" />
            Skills & Interests
          </h3>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {SKILL_OPTIONS.map((skill) => (
                <button
                  key={skill}
                  onClick={() => toggleSkill(skill)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-all ${
                    skills.includes(skill)
                      ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300'
                      : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-white'
                  }`}
                >
                  {skill}
                </button>
              ))}
            </div>

            {/* Custom skills */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Or add your own:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  placeholder="e.g. Drone Photography"
                  className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomSkill();
                    }
                  }}
                />
                <button
                  onClick={addCustomSkill}
                  disabled={!newSkill.trim()}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 rounded-lg text-sm text-white transition-all"
                >
                  Add
                </button>
              </div>
            </div>

            {customSkills.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {customSkills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-sm text-emerald-400"
                  >
                    {skill}
                    <button
                      onClick={() => removeCustomSkill(skill)}
                      className="hover:text-emerald-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
