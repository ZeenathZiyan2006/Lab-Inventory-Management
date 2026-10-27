import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Box,
  Wrench,
  ArrowLeftRight,
  ShoppingCart,
  Calendar,
  Bot,
  BarChart3,
  Users,
  ShieldCheck,
  FlaskConical,
  X
} from 'lucide-react';
import { triggerSelectionGreeting } from './effects/SelectionGreetingRobot';

export type PageId =
  | 'dashboard'
  | 'labs'
  | 'inventory'
  | 'faults'
  | 'transfers'
  | 'requests'
  | 'timetable'
  | 'ai'
  | 'reports'
  | 'users'
  | 'audit';

interface SidebarProps {
  currentPage: PageId;
  onSelectPage: (page: PageId) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onSelectPage,
  isOpenMobile = false,
  onCloseMobile
}) => {
  const { user } = useAuth();
  if (!user) return null;

  const role = user.role;

  const navItems = [
    {
      id: 'dashboard' as PageId,
      label: 'Dashboard',
      icon: LayoutDashboard,
      roles: ['ADMIN', 'LAB_INSTRUCTOR', 'TECHNICIAN', 'HOD', 'PRINCIPAL']
    },
    {
      id: 'labs' as PageId,
      label: 'Laboratories',
      icon: FlaskConical,
      roles: ['ADMIN', 'LAB_INSTRUCTOR', 'HOD', 'PRINCIPAL']
    },
    {
      id: 'inventory' as PageId,
      label: 'Lab Inventory',
      icon: Box,
      roles: ['ADMIN', 'LAB_INSTRUCTOR', 'HOD', 'PRINCIPAL']
    },
    {
      id: 'faults' as PageId,
      label: 'Faults & Repairs',
      icon: Wrench,
      roles: ['ADMIN', 'LAB_INSTRUCTOR', 'TECHNICIAN']
    },
    {
      id: 'transfers' as PageId,
      label: 'Inter-Lab Transfers',
      icon: ArrowLeftRight,
      roles: ['ADMIN', 'LAB_INSTRUCTOR', 'HOD', 'PRINCIPAL']
    },
    {
      id: 'requests' as PageId,
      label: 'Purchase Requests',
      icon: ShoppingCart,
      roles: ['ADMIN', 'LAB_INSTRUCTOR', 'HOD', 'PRINCIPAL']
    },
    {
      id: 'timetable' as PageId,
      label: 'Lab Timetable',
      icon: Calendar,
      roles: ['ADMIN', 'LAB_INSTRUCTOR']
    },
    {
      id: 'ai' as PageId,
      label: 'AI Insights & Assistant',
      icon: Bot,
      roles: ['ADMIN', 'LAB_INSTRUCTOR', 'TECHNICIAN', 'HOD', 'PRINCIPAL']
    },
    {
      id: 'reports' as PageId,
      label: 'Reports & Export',
      icon: BarChart3,
      roles: ['ADMIN', 'LAB_INSTRUCTOR', 'HOD', 'PRINCIPAL']
    },
    {
      id: 'users' as PageId,
      label: 'User Management',
      icon: Users,
      roles: ['ADMIN']
    },
    {
      id: 'audit' as PageId,
      label: 'Audit Trail',
      icon: ShieldCheck,
      roles: ['ADMIN']
    }
  ];

  const visibleItems = navItems.filter(item => item.roles.includes(role));

  const content = (
    <div className="flex flex-col justify-between h-full p-3.5 relative z-10 overflow-y-auto scrollbar-none">
      <div>
        {/* Navigation Menu Header */}
        <div className="flex justify-between items-center px-3 py-2 mb-2">
          <span className="text-[11px] font-bold tracking-widest text-cyan-400 uppercase">
            NAVIGATION MENU
          </span>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1.5">
          {visibleItems.map(item => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  triggerSelectionGreeting(`Opening ${item.label}!`);
                  onSelectPage(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all duration-200 relative ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.5)] border border-cyan-300/40'
                    : 'text-slate-300 hover:text-cyan-200 hover:bg-[#0A1733]/60 hover:border-cyan-500/25 border border-transparent'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-white drop-shadow-[0_0_6px_#ffffff]' : 'text-cyan-400 drop-shadow-[0_0_4px_#00F0FF]'}`} />
                <span className="tracking-wide text-[12px]">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* SMVITM Bottom Brand Card */}
      <div className="pt-4 border-t border-cyan-500/20 mt-4">
        <div className="flex items-center space-x-3 p-2 rounded-2xl bg-[#040C1E]/60 border border-cyan-500/20">
          <div className="w-9 h-9 rounded-full p-[1.5px] bg-gradient-to-tr from-cyan-400 to-purple-500 flex-shrink-0">
            <img
              src="/images/smvitm_round_logo.png"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/images/smvitm_logo.png';
              }}
              alt="SMVITM Logo"
              className="w-full h-full object-contain rounded-full bg-white p-0.5"
            />
          </div>
          <div>
            <div className="text-xs font-bold text-white tracking-wide">
              SMVITM <span className="text-cyan-300 font-semibold">Bantakal</span>
            </div>
            <div className="text-[9px] text-cyan-400/80 font-medium tracking-wider">
              Knowledge • Innovation • Excellence
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar rounded card - Constant / Sticky Navigation Menu */}
      <aside className="hidden lg:block w-64 m-4 mr-0 rounded-3xl bg-[#050C1D]/85 border border-cyan-500/25 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] flex-shrink-0 sticky top-24 self-start h-[calc(100vh-6.75rem)] max-h-[calc(100vh-6.75rem)] overflow-hidden z-30">
        {/* Subtle corner glow accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />
        {content}
      </aside>

      {/* Mobile drawer overlay */}
      {isOpenMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
            onClick={onCloseMobile}
          />
          <aside className="relative w-72 bg-[#050C1D] text-slate-300 z-50 h-full shadow-2xl flex flex-col border-r border-cyan-500/20">
            {content}
          </aside>
        </div>
      )}
    </>
  );
};
