import { useState } from 'react';
import { Sparkles, LogOut, Settings, Wallet, Briefcase, Bell, MessageSquare, Plus, HardHat } from 'lucide-react';
import { AuthPage } from './components/AuthPage';
import { OnboardingWizard } from './components/OnboardingWizard';
import { ChatPage } from './components/ChatPage';
import { SettingsPage } from './components/SettingsPage';
import { GigsPage } from './components/GigsPage';
import { WalletPage } from './components/WalletPage';
import { NotificationsPanel } from './components/NotificationsPanel';
import { ContractorPortal } from './components/ContractorPortal';
import { useAppState } from './hooks/useAppState';
import type { Gig } from './lib/supabase';

type Page = 'onboarding' | 'chat' | 'settings' | 'gigs' | 'wallet' | 'contractor';

function App() {
  const [page, setPage] = useState<Page>('chat');
  const [showNotifications, setShowNotifications] = useState(false);

  const {
    userId, session, authLoading, profile, activeGigs, allOpenGigs, matches, sessions,
    currentSessionId, wallet, transactions, notifications, applications, loading,
    totalEscrow, unreadCount,
    signUp, signIn, signOut, saveProfile,
    createSession, deleteSession, switchSession, addMessage,
    saveGig, saveMatches, updateMatchDecision, releaseEscrow,
    depositFunds, applyToGig,
    markGigComplete, approvePayment, requestRedo,
    markNotificationRead, markAllNotificationsRead,
  } = useAppState();

  const handleSignUp = async (email: string, password: string, name: string) => {
    const result = await signUp(email, password, name);
    if (result.error) return { error: result.error.message };
    return { error: null };
  };
  const handleSignIn = async (email: string, password: string) => {
    const result = await signIn(email, password);
    if (result.error) return { error: result.error.message };
    return { error: null };
  };
  const handleSaveGig = async (gig: Omit<Gig, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'applicant_count'>) => {
    return saveGig(gig);
  };

  if (authLoading) {
    return (
      <div className="h-screen bg-surface-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-brand-400 to-brand-600 rounded-2xl flex items-center justify-center animate-pulse shadow-glow">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <p className="text-surface-400 text-sm font-medium">Loading Milo...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthPage onSignUp={handleSignUp} onSignIn={handleSignIn} />;
  }

  if (loading) {
    return (
      <div className="h-screen bg-surface-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-brand-400 to-brand-600 rounded-2xl flex items-center justify-center animate-pulse shadow-glow">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <p className="text-surface-400 text-sm font-medium">Loading your data...</p>
        </div>
      </div>
    );
  }

  if (!profile?.onboarding_complete || page === 'onboarding') {
    return (
      <OnboardingWizard
        onComplete={async (data) => {
          await saveProfile({ ...data, onboarding_complete: true });
          await createSession('Welcome Chat');
          setPage('chat');
        }}
      />
    );
  }

  if (page === 'settings') {
    return (
      <div className="h-screen bg-surface-950">
        <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-brand-900/6 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 h-full">
          <SettingsPage profile={profile} onSave={async (data) => { await saveProfile(data); }} onBack={() => setPage('chat')} />
        </div>
      </div>
    );
  }

  if (page === 'gigs') {
    return <GigsPage profile={profile} allOpenGigs={allOpenGigs} applications={applications} onApplyToGig={applyToGig} onBack={() => setPage('chat')} />;
  }

  if (page === 'wallet') {
    return <WalletPage wallet={wallet} transactions={transactions} totalEscrow={totalEscrow} onDeposit={depositFunds} onBack={() => setPage('chat')} />;
  }

  if (page === 'contractor') {
    return (
      <ContractorPortal
        profile={profile} activeGigs={activeGigs} matches={matches} wallet={wallet}
        notifications={notifications}
        onMarkComplete={markGigComplete} onApprovePayment={approvePayment}
        onRequestRedo={requestRedo} onBack={() => setPage('chat')}
      />
    );
  }

  // Chat page (default)
  return (
    <div className="h-screen bg-surface-950 flex flex-col">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-brand-900/6 via-transparent to-transparent pointer-events-none" />

      {/* Header */}
      <header className="relative z-20 border-b border-surface-700/40 glass-light flex-shrink-0">
        <div className="px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 bg-gradient-to-br from-brand-400 to-brand-600 rounded-xl flex items-center justify-center shadow-glow">
                <Sparkles className="w-4.5 h-4.5 text-white" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-brand-400 rounded-full border-2 border-surface-900 animate-pulse-glow" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-white tracking-tight leading-none">Milo</h1>
              <p className="text-xs text-surface-500 leading-none mt-0.5">Campus Gig Marketplace</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={() => setShowNotifications(true)} className="relative p-2 hover:bg-surface-800 rounded-lg transition-all">
              <Bell className="w-4.5 h-4.5 text-surface-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-brand-500 rounded-full text-[10px] text-white font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <button onClick={() => setPage('gigs')} className="p-2 hover:bg-surface-800 rounded-lg transition-all" title="Available Gigs">
              <Briefcase className="w-4.5 h-4.5 text-surface-400" />
            </button>
            <button onClick={() => setPage('contractor')} className="p-2 hover:bg-surface-800 rounded-lg transition-all" title="Contractor Portal">
              <HardHat className="w-4.5 h-4.5 text-surface-400" />
            </button>
            <button onClick={() => setPage('wallet')} className="p-2 hover:bg-surface-800 rounded-lg transition-all" title="Wallet">
              <Wallet className="w-4.5 h-4.5 text-surface-400" />
            </button>
            <button onClick={() => setPage('settings')} className="p-2 hover:bg-surface-800 rounded-lg transition-all" title="Settings">
              <Settings className="w-4.5 h-4.5 text-surface-400" />
            </button>
            <button onClick={signOut} className="p-2 hover:bg-surface-800 rounded-lg transition-all" title="Sign Out">
              <LogOut className="w-4.5 h-4.5 text-surface-400" />
            </button>

            {profile && (
              <div className="flex items-center gap-2 ml-2">
                {profile.avatar_url && (
                  <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-lg object-cover border border-surface-700" />
                )}
                <div className="hidden sm:block text-right">
                  <p className="text-sm text-white font-semibold">{profile.name}</p>
                  <p className="text-xs text-surface-400">{profile.role} - {profile.campus_location || 'No location'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Chat Session Bar */}
      <div className="relative z-10 border-b border-surface-700/30 bg-surface-900/30">
        <div className="px-5 py-2 flex items-center gap-2 overflow-x-auto scrollbar-none">
          <button onClick={async () => { await createSession(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 rounded-lg text-brand-400 font-semibold transition-all whitespace-nowrap flex-shrink-0">
            <Plus className="w-3.5 h-3.5" /> New Chat
          </button>
          {sessions.map((s) => (
            <button key={s.id} onClick={() => switchSession(s.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all whitespace-nowrap flex-shrink-0 ${
                currentSessionId === s.id ? 'bg-surface-800 border-surface-600 text-white' : 'bg-surface-800/30 border-surface-700/50 text-surface-400 hover:border-surface-600 hover:text-surface-300'
              }`}>
              <MessageSquare className="w-3 h-3" />
              {s.title}
              <span onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                className="ml-1 text-surface-600 hover:text-rose-400 transition-all">x</span>
            </button>
          ))}
        </div>
      </div>

      {/* Body - fills remaining height */}
      <div className="relative z-10 flex-1 overflow-hidden">
        {currentSessionId ? (
          <ChatPage
            profile={profile} userId={userId!} sessionId={currentSessionId}
            activeGigs={activeGigs} matches={matches} totalEscrow={totalEscrow}
            onOpenSettings={() => setPage('settings')}
            onSaveGig={handleSaveGig} onSaveMatches={saveMatches}
            onUpdateMatchDecision={updateMatchDecision} onReleaseEscrow={releaseEscrow}
            onPersistMessage={addMessage}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 bg-surface-800/50 rounded-2xl flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-surface-600" />
            </div>
            <div className="text-center">
              <p className="text-surface-400 text-lg font-semibold">No active chat</p>
              <p className="text-surface-600 text-sm mt-1">Start a new chat to talk with Milo</p>
            </div>
            <button onClick={async () => { await createSession(); }}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 rounded-xl text-white font-bold text-sm transition-all shadow-glow">
              <Plus className="w-4 h-4" /> Start New Chat
            </button>
          </div>
        )}
      </div>

      {showNotifications && (
        <NotificationsPanel notifications={notifications} unreadCount={unreadCount}
          onMarkRead={markNotificationRead} onMarkAllRead={markAllNotificationsRead}
          onClose={() => setShowNotifications(false)} />
      )}
    </div>
  );
}

export default App;
