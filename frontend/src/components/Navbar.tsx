import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth, UserRole } from '../context/AuthContext';
import { QrCode, Bell, LogOut, Menu, X, Mail, Building, ChevronDown } from 'lucide-react';
import { apiRequest } from '../services/api';
import { triggerSelectionGreeting } from './effects/SelectionGreetingRobot';

interface NotificationItem {
  id: number;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

interface NavbarProps {
  onOpenQRScanner: () => void;
  onToggleMobileSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenQRScanner, onToggleMobileSidebar }) => {
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    if (user) {
      loadNotifications();
      const interval = setInterval(loadNotifications, 15000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const loadNotifications = async () => {
    try {
      const data = await apiRequest<NotificationItem[]>('/notifications');
      setNotifications(data);
    } catch {
      // Ignore background poll errors
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await apiRequest(`/notifications/${id}/read`, { method: 'PUT' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error(err);
    }
  };

  const markAllRead = async () => {
    for (const n of notifications.filter(item => !item.is_read)) {
      await markAsRead(n.id);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Handle ESC key to dismiss overlays
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowProfileModal(false);
        setShowNotifications(false);
      }
    };
    if (showProfileModal || showNotifications) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [showProfileModal, showNotifications]);

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'ADMIN': return 'Administrator';
      case 'LAB_INSTRUCTOR': return 'Lab Instructor';
      case 'TECHNICIAN': return 'Technician';
      case 'HOD': return 'HOD - AI & DS';
      case 'PRINCIPAL': return 'Principal';
      default: return role;
    }
  };

  return (
    <header className="relative bg-[#040817]/95 text-white border-b border-cyan-500/20 sticky top-0 z-40 backdrop-blur-2xl transition-all">
      {/* Top subtle neon highlight */}
      <div className="h-[2px] w-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 shadow-[0_0_10px_#00F0FF]" />

      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Left Brand Area */}
          <div className="flex items-center space-x-3.5">
            <button
              onClick={onToggleMobileSidebar}
              className="lg:hidden p-1.5 text-slate-300 hover:text-cyan-300 hover:bg-slate-800/60 rounded-xl transition"
              title="Toggle Navigation Menu"
            >
              <Menu className="h-6 w-6" />
            </button>

            {/* Circular Official SMVITM Logo with Cyber Ring */}
            <div className="relative group cursor-pointer flex-shrink-0" title="Shri Madhwa Vadiraja Institute of Technology & Management">
              <div className="w-12 h-12 rounded-full p-[2px] bg-gradient-to-tr from-cyan-400 via-blue-500 to-purple-500 shadow-[0_0_16px_rgba(0,240,255,0.45)] group-hover:shadow-[0_0_24px_rgba(0,240,255,0.7)] transition-all">
                <img
                  src="/images/smvitm_round_logo.png"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/images/smvitm_logo.png';
                  }}
                  alt="SMVITM Logo"
                  className="w-full h-full object-contain rounded-full bg-white p-0.5"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white leading-none drop-shadow-[0_0_10px_rgba(0,240,255,0.35)]">
                  SMVITM Bantakal
                </h1>
                <span className="text-[11px] font-bold bg-[#071F38] text-cyan-300 px-3 py-0.5 rounded-full border border-cyan-400/50 shadow-[0_0_10px_rgba(0,240,255,0.25)]">
                  Dept of AI & DS
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium tracking-wide mt-1">
                AI-Powered Smart Inventory Management System
              </p>
            </div>
          </div>

          {/* Center Futuristic Cyber Circuit Traces */}
          <div className="hidden xl:flex items-center flex-1 max-w-md mx-6 justify-center pointer-events-none opacity-80">
            <svg className="w-full h-10 text-cyan-400 drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]" viewBox="0 0 360 40" fill="none">
              <path d="M 0 20 L 80 20 L 100 10 L 260 10 L 280 20 L 360 20" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" />
              <path d="M 40 20 L 60 30 L 220 30 L 240 20" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.5" />
              <circle cx="80" cy="20" r="3" fill="#00F0FF" />
              <circle cx="100" cy="10" r="3" fill="#00F0FF" />
              <circle cx="260" cy="10" r="3" fill="#00F0FF" />
              <circle cx="220" cy="30" r="3" fill="#00F0FF" />
              <circle cx="280" cy="20" r="3" fill="#00F0FF" />
            </svg>
          </div>

          {/* Right Controls */}
          <div className="flex items-center space-x-3.5">
            {/* Scan QR Button */}
            <button
              onClick={() => {
                triggerSelectionGreeting('Launching QR Scanner!');
                onOpenQRScanner();
              }}
              className="flex items-center space-x-2 bg-[#061830] hover:bg-[#0A2446] text-cyan-300 px-4 py-2 rounded-xl border border-cyan-400 hover:border-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.3)] transition active:scale-95"
              title="Scan Laboratory or Asset QR"
            >
              <QrCode className="h-4 w-4 text-cyan-400 drop-shadow-[0_0_6px_#00F0FF]" />
              <span className="text-xs font-bold tracking-wide">Scan QR</span>
            </button>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="w-10 h-10 rounded-full bg-[#07132B] hover:bg-[#0B1E40] border border-cyan-500/30 text-slate-300 hover:text-cyan-300 flex items-center justify-center transition relative shadow-[0_0_10px_rgba(0,240,255,0.15)]"
                title="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 bg-rose-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold shadow-[0_0_10px_#F43F5E] animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-[#070F22]/95 text-slate-100 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] border border-cyan-500/30 backdrop-blur-2xl z-50 overflow-hidden">
                  <div className="p-3.5 bg-[#0A1633] border-b border-cyan-500/20 text-white flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <Bell className="h-4 w-4 text-cyan-400 drop-shadow-[0_0_6px_#00F0FF]" />
                      <span className="font-bold text-xs tracking-wide">Notifications Panel</span>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-[10px] text-cyan-300 hover:text-cyan-200 hover:underline font-semibold"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/80">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 text-xs">
                        No notifications recorded.
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          onClick={() => markAsRead(n.id)}
                          className={`p-3 text-xs cursor-pointer hover:bg-cyan-950/30 transition ${!n.is_read ? 'bg-cyan-950/20 font-medium' : ''}`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-semibold text-slate-100">{n.title}</span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-slate-300 leading-relaxed text-[11px]">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Pill */}
            {user && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowProfileModal(true)}
                  className="flex items-center space-x-3 bg-[#06142E] hover:bg-[#0B214A] border border-cyan-500/30 px-3.5 py-1.5 rounded-2xl transition shadow-[0_0_12px_rgba(0,240,255,0.15)] group"
                  title="View User Profile"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-[0_0_8px_#00F0FF] border border-cyan-300/40">
                    {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="text-left hidden md:block">
                    <div className="text-xs font-bold text-white group-hover:text-cyan-200 transition">
                      {user.full_name}
                    </div>
                    <div className="text-[10px] text-cyan-300/90 font-medium">
                      {getRoleLabel(user.role)}
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-cyan-300 transition" />
                </button>

                <button
                  onClick={logout}
                  title="Sign Out"
                  className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-xl transition"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            )}

          </div>

        </div>
      </div>

      {/* User Profile Modal Dialog rendered in Portal outside header stacking context */}
      {showProfileModal && user && createPortal(
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150"
          onClick={() => setShowProfileModal(false)}
        >
          <div 
            className="bg-[#081026] text-slate-100 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] max-w-sm w-full overflow-hidden border border-cyan-500/40 animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#0B1736] text-white p-4.5 px-6 flex justify-between items-center border-b border-cyan-500/20">
              <h3 className="font-bold text-sm tracking-wide text-white">User Account Profile</h3>
              <button 
                onClick={() => setShowProfileModal(false)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs overflow-y-auto">
              <div className="flex items-center space-x-3.5 pb-3 border-b border-cyan-500/15">
                <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-600 text-white flex items-center justify-center font-black text-base shadow-[0_0_12px_rgba(0,240,255,0.5)] border border-cyan-300/40">
                  {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <div className="font-bold text-sm text-white">{user.full_name}</div>
                  <div className="text-cyan-300 text-[11px] font-semibold mt-0.5">{getRoleLabel(user.role)}</div>
                </div>
              </div>

              <div className="space-y-2.5 text-slate-300">
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                  <span className="font-mono text-[11px] text-slate-200">{user.email}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Building className="h-4 w-4 text-purple-400 flex-shrink-0" />
                  <span className="text-slate-300 font-medium">Dept of Artificial Intelligence & Data Science</span>
                </div>
              </div>

              <div className="pt-3 border-t border-cyan-500/15 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition border border-slate-700 active:scale-95"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileModal(false);
                    logout();
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition shadow-[0_0_12px_rgba(244,63,94,0.4)] active:scale-95"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>

            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
};
