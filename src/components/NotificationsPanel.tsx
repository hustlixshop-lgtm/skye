import React from 'react';
import { Bell, CheckCircle, XCircle, DollarSign, MapPin, User, Shield, Briefcase, Check } from 'lucide-react';
import type { Notification } from '../lib/supabase';

type Props = {
  notifications: Notification[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClose: () => void;
};

const typeConfig: Record<Notification['type'], { icon: React.ReactNode; color: string }> = {
  gig_match: { icon: <MapPin className="w-4 h-4" />, color: 'text-cyan-400 bg-cyan-500/10' },
  gig_application: { icon: <User className="w-4 h-4" />, color: 'text-blue-400 bg-blue-500/10' },
  application_accepted: { icon: <CheckCircle className="w-4 h-4" />, color: 'text-emerald-400 bg-emerald-500/10' },
  application_rejected: { icon: <XCircle className="w-4 h-4" />, color: 'text-rose-400 bg-rose-500/10' },
  escrow_held: { icon: <Shield className="w-4 h-4" />, color: 'text-amber-400 bg-amber-500/10' },
  escrow_released: { icon: <CheckCircle className="w-4 h-4" />, color: 'text-emerald-400 bg-emerald-500/10' },
  escrow_refund: { icon: <DollarSign className="w-4 h-4" />, color: 'text-cyan-400 bg-cyan-500/10' },
  payment_received: { icon: <DollarSign className="w-4 h-4" />, color: 'text-emerald-400 bg-emerald-500/10' },
  gig_completed: { icon: <Briefcase className="w-4 h-4" />, color: 'text-blue-400 bg-blue-500/10' },
};

export function NotificationsPanel({ notifications, unreadCount, onMarkRead, onMarkAllRead, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-md bg-slate-900 border-l border-slate-800/60 flex flex-col h-full animate-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold text-white">Notifications</h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 text-xs bg-cyan-500/20 text-cyan-400 rounded-full">{unreadCount}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-all"
              >
                <Check className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg transition-all">
              <XCircle className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {notifications.length === 0 ? (
            <div className="text-center py-16">
              <Bell className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400">No notifications yet</p>
              <p className="text-xs text-slate-600 mt-1">We'll notify you about gig matches and applications</p>
            </div>
          ) : (
            notifications.map((notif) => {
              const config = typeConfig[notif.type];
              return (
                <div
                  key={notif.id}
                  onClick={() => { if (!notif.is_read) onMarkRead(notif.id); }}
                  className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                    notif.is_read
                      ? 'bg-slate-800/20 border-slate-700/30'
                      : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.color}`}>
                    {config.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-white">{notif.title}</h4>
                      {!notif.is_read && <div className="w-2 h-2 rounded-full bg-cyan-400" />}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{notif.body}</p>
                    <p className="text-xs text-slate-600 mt-1.5">{new Date(notif.created_at).toLocaleString()}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
