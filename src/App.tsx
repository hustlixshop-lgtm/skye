import { useState } from 'react';
import { Sparkles, LogOut, Settings, Wallet, Briefcase, Bell, MessageSquare, Plus } from 'lucide-react';
import { AuthPage } from './components/AuthPage';
import { OnboardingWizard } from './components/OnboardingWizard';
import { ChatPage } from './components/ChatPage';
import { SettingsPage } from './components/SettingsPage';
import { GigsPage } from './components/GigsPage';
import { WalletPage } from './components/WalletPage';
import { NotificationsPanel } from './components/NotificationsPanel';
import { useAppState } from './hooks/useAppState';
import type { Gig } from './lib/supabase';

type Page = 'onboarding' | 'chat' | 'settings' | 'gigs' | 'wallet';

function App() {
  const [page, setPage] = useState<Page>('chat');
  const [showNotifications, setShowNotifications] = useState(false);

  const {
    userId,
    session,
    authLoading,
    profile,
    activeGigs,
    allOpenGigs,
    matches,
    sessions,
    currentSessionId,
    wallet,
    transactions,
    notifications,
    applications,
    loading,
    totalEscrow,
    unreadCount,
    signUp,
    signIn,
    signOut,
    saveProfile,
    createSession,
    deleteSession,
    switchSession,
    addMessage,
    saveGig,
    saveMatches,
    updateMatchDecision,
    releaseEscrow,
    depositFunds,
    applyToGig,
    markNotificationRead,
    markAllNotificationsRead,
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center animate-pulse">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <p className="text-slate-400 text-sm">Loading Milo...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthPage onSignUp={handleSignUp} onSignIn={handleSignIn} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center animate-pulse">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <p className="text-slate-400 text-sm">Loading your data...</p>
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
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-cyan-900/8 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 h-screen">
          <SettingsPage
            profile={profile}
            onSave={async (data) => { await saveProfile(data); }}
            onBack={() => setPage('chat')}
          />
        </div>
      </div>
    );
  }

  if (page === 'gigs') {
    return (
      <GigsPage
        profile={profile}
        allOpenGigs={allOpenGigs}
        applications={applications}
        onApplyToGig={applyToGig}
        onBack={() => setPage('chat')}
      />
    );
  }

  if (page === 'wallet') {
    return (
      <WalletPage
        wallet={wallet}
        transactions={transactions}
        totalEscrow={totalEscrow}
        onDeposit={depositFunds}
        onBack={() => setPage('chat')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-cyan-900/8 via-transparent to-transparent pointer-events-none" />

      <header className="relative z-20 border-b border-slate-800/50 backdrop-blur-sm flex-shrink-0">
        <div className="px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center">
                <Sparkles className="w-4.5 h-4.5 text-white" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900 animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight leading-none">Milo</h1>
              <p className="text-xs text-slate-500 leading-none mt-0.5">Campus Gig Marketplace</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowNotifications(true)}
              className="relative p-2 hover:bg-slate-800 rounded-lg transition-all"
            >
              <Bell className="w-4.5 h-4.5 text-slate-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-cyan-500 rounded-full text-[10px] text-white font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <button onClick={() => setPage('gigs')} className="p-2 hover:bg-slate-800 rounded-lg transition-all" title="Available Gigs">
              <Briefcase className="w-4.5 h-4.5 text-slate-400" />
            </button>
            <button onClick={() => setPage('wallet')} className="p-2 hover:bg-slate-800 rounded-lg transition-all" title="Wallet">
              <Wallet className="w-4.5 h-4.5 text-slate-400" />
            </button>
            <button onClick={() => setPage('settings')} className="p-2 hover:bg-slate-800 rounded-lg transition-all" title="Settings">
              <Settings className="w-4.5 h-4.5 text-slate-400" />
            </button>
            <button onClick={signOut} className="p-2 hover:bg-slate-800 rounded-lg transition-all" title="Sign Out">
              <LogOut className="w-4.5 h-4.5 text-slate-400" />
            </button>

            {profile && (
              <div className="flex items-center gap-2 ml-2">
                {profile.avatar_url && (
                  <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-lg object-cover border border-slate-700" />
                )}
                <div className="hidden sm:block text-right">
                  <p className="text-sm text-white font-medium">{profile.name}</p>
                  <p className="text-xs text-slate-400">{profile.role} - {profile.campus_location || 'No location'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="relative z-10 border-b border-slate-800/40 bg-slate-900/30">
        <div className="px-5 py-2 flex items-center gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={async () => { await createSession(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-cyan-400 font-medium transition-all whitespace-nowrap flex-shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            New Chat
          </button>
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => switchSession(s.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all whitespace-nowrap flex-shrink-0 ${
                currentSessionId === s.id
                  ? 'bg-slate-800 border-slate-600 text-white'
                  : 'bg-slate-800/30 border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-slate-300'
              }`}
            >
              <MessageSquare className="w-3 h-3" />
              {s.title}
              <span
                onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                className="ml-1 text-slate-600 hover:text-rose-400 transition-all"
              >
                x
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="relative z-10 flex-1 overflow-hidden" style={{ height: 'calc(100vh - 105px)' }}>
        {currentSessionId ? (
          <ChatPage
            profile={profile}
            userId={userId!}
            sessionId={currentSessionId}
            activeGigs={activeGigs}
            matches={matches}
            totalEscrow={totalEscrow}
            onOpenSettings={() => setPage('settings')}
            onSaveGig={handleSaveGig}
            onSaveMatches={saveMatches}
            onUpdateMatchDecision={updateMatchDecision}
            onReleaseEscrow={releaseEscrow}
            onPersistMessage={addMessage}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 bg-slate-800/50 rounded-2xl flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-slate-600" />
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-lg font-medium">No active chat</p>
              <p className="text-slate-600 text-sm mt-1">Start a new chat to talk with Milo</p>
            </div>
            <button
              onClick={async () => { await createSession(); }}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 rounded-xl text-white font-semibold text-sm transition-all shadow-lg shadow-cyan-500/20"
            >
              <Plus className="w-4 h-4" />
              Start New Chat
            </button>
          </div>
        )}
      </div>

      {showNotifications && (
        <NotificationsPanel
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkRead={markNotificationRead}
          onMarkAllRead={markAllNotificationsRead}
          onClose={() => setShowNotifications(false)}
        />
      )}
    </div>
  );
}

export default App;
