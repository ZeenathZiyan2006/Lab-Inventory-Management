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
  Building2,
  X
} from 'lucide-react';

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
      icon: Building2,
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
    <div className="flex flex-col justify-between h-full p-4">
      <div>
        <div className="flex justify-between items-center px-3 py-2">
          <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Navigation Menu
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
        <nav className="mt-2 space-y-1">
          {visibleItems.map(item => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectPage(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-navy-700 text-white shadow-sm border border-navy-500'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 text-xs text-slate-400">
        <div className="font-semibold text-slate-200 mb-1">SMVITM Campus</div>
        <div>Vishwa Madhwa Vadiraja Nagar, Bantakal, Udupi - 574115</div>
        <div className="text-[10px] text-cyan-400 mt-1">Affiliated to VTU Belagavi</div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop static sidebar */}
      <aside className="hidden lg:block w-64 bg-slate-900 text-slate-300 flex-shrink-0 min-h-[calc(100vh-4rem)] border-r border-slate-800">
        {content}
      </aside>

      {/* Mobile drawer overlay */}
      {isOpenMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <aside className="relative w-72 bg-slate-900 text-slate-300 z-50 h-full shadow-2xl flex flex-col">
            {content}
          </aside>
        </div>
      )}
    </>
  );
};
