import React, { useState, useEffect } from 'react';
import { useAuth, UserRole } from '../context/AuthContext';
import { QrCode, Bell, LogOut, User as UserIcon, Menu, X, ShieldAlert, CheckCircle, Mail, Phone, Building } from 'lucide-react';
import { apiRequest } from '../services/api';

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

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return <span className="bg-purple-100 text-purple-800 text-[10px] px-2.5 py-0.5 rounded-full font-bold border border-purple-200">Administrator</span>;
      case 'LAB_INSTRUCTOR':
        return <span className="bg-blue-100 text-blue-800 text-[10px] px-2.5 py-0.5 rounded-full font-bold border border-blue-200">Lab Instructor</span>;
      case 'TECHNICIAN':
        return <span className="bg-amber-100 text-amber-800 text-[10px] px-2.5 py-0.5 rounded-full font-bold border border-amber-200">Technician</span>;
      case 'HOD':
        return <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2.5 py-0.5 rounded-full font-bold border border-emerald-200">HOD - AI & DS</span>;
      case 'PRINCIPAL':
        return <span className="bg-rose-100 text-rose-800 text-[10px] px-2.5 py-0.5 rounded-full font-bold border border-rose-200">Principal</span>;
    }
  };

  return (
    <header className="bg-navy-900 text-white shadow-md border-b border-navy-700 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Mobile Menu Toggle & Brand Logo */}
          <div className="flex items-center space-x-3">
            <button
              onClick={onToggleMobileSidebar}
              className="lg:hidden p-1.5 text-slate-300 hover:text-white hover:bg-navy-800 rounded-lg transition"
              title="Toggle Navigation Menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <img
              src="/images/smvitm-logo.jfif"
              alt="SMVITM Official Logo"
              className="h-11 w-11 object-contain rounded-md bg-white p-0.5 shadow-sm"
            />
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-sm sm:text-base font-bold tracking-tight text-white leading-tight">
                  SMVITM Bantakal
                </h1>
                <span className="hidden sm:inline-block text-[11px] bg-navy-800 text-cyan-300 px-2 py-0.5 rounded border border-navy-600 font-semibold">
                  Dept of AI & DS
                </span>
              </div>
              <p className="text-[11px] text-slate-300 hidden md:block">
                AI-Powered Smart Inventory Management System
              </p>
            </div>
          </div>

          {/* User Controls */}
          <div className="flex items-center space-x-2.5">
            {/* Quick QR Scanner Button */}
            <button
              onClick={onOpenQRScanner}
              title="Scan Laboratory or Asset QR"
              className="flex items-center space-x-1.5 bg-navy-800 hover:bg-navy-700 text-cyan-300 text-xs px-3 py-1.5 rounded-lg border border-navy-600 transition shadow-sm font-medium"
            >
              <QrCode className="h-4 w-4" />
              <span className="hidden sm:inline">Scan QR</span>
            </button>

            {/* Notification Bell with Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-slate-300 hover:text-white hover:bg-navy-800 rounded-lg relative transition"
                title="Notifications Panel"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-4 w-4 bg-rose-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
                  <div className="p-3.5 bg-navy-900 text-white flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <Bell className="h-4 w-4 text-cyan-400" />
                      <span className="font-semibold text-xs">Notifications Panel</span>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-[10px] text-cyan-300 hover:underline"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 text-xs">
                        No notifications recorded.
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          onClick={() => markAsRead(n.id)}
                          className={`p-3 text-xs cursor-pointer hover:bg-slate-50 transition ${!n.is_read ? 'bg-blue-50/70 font-medium' : ''}`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-semibold text-navy-900">{n.title}</span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-slate-600 leading-relaxed text-[11px]">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Pill & Sign-Out Control */}
            {user && (
              <div className="flex items-center space-x-2 pl-2 border-l border-navy-700">
                <button
                  onClick={() => setShowProfileModal(true)}
                  className="flex items-center space-x-2 text-left hover:bg-navy-800 p-1.5 rounded-lg transition"
                  title="View User Profile"
                >
                  <div className="h-8 w-8 rounded-full bg-navy-700 text-cyan-300 flex items-center justify-center font-bold text-xs border border-navy-600">
                    {user.full_name.charAt(0)}
                  </div>
                  <div className="hidden lg:block">
                    <div className="text-xs font-semibold text-white truncate max-w-[140px]">
                      {user.full_name}
                    </div>
                    <div className="mt-0.5">{getRoleBadge(user.role)}</div>
                  </div>
                </button>

                <button
                  onClick={logout}
                  title="Sign Out"
                  className="p-2 text-slate-300 hover:text-rose-400 hover:bg-navy-800 rounded-lg transition"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            )}

          </div>

        </div>
      </div>

      {/* User Profile Modal Dialog */}
      {showProfileModal && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200">
            <div className="bg-navy-900 text-white p-4 flex justify-between items-center">
              <h3 className="font-semibold text-sm">Authenticated User Profile</h3>
              <button onClick={() => setShowProfileModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              
              <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
                <div className="h-12 w-12 rounded-full bg-navy-900 text-cyan-300 flex items-center justify-center font-black text-base shadow">
                  {user.full_name.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-900">{user.full_name}</div>
                  <div className="mt-1">{getRoleBadge(user.role)}</div>
                </div>
              </div>

              <div className="space-y-2.5 text-slate-700">
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <span className="font-mono text-[11px] text-slate-800">{user.email}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Building className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <span>Dept of Artificial Intelligence & Data Science</span>
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-1">
                    Laboratory Access Scope:
                  </span>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-800 font-medium">
                    {user.assigned_labs && user.assigned_labs.length > 0 ? (
                      <span>Assigned to Lab {user.assigned_labs.join(', Lab ')}</span>
                    ) : (
                      <span>All Institutional Laboratories (Role Wide)</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                <button
                  onClick={() => setShowProfileModal(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowProfileModal(false);
                    logout();
                  }}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition shadow"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </header>
  );
};
