import React, { useState, useEffect } from 'react';
import { useAuth, UserRole } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import {
  Box,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRightLeft,
  ShoppingCart,
  QrCode,
  Wrench,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  Cpu,
  Users,
  Database,
  Building,
  FileText,
  ShieldAlert,
  Plus,
  Bot,
  Sparkles
} from 'lucide-react';
import { PageId } from '../components/Sidebar';
import { AIRobotAssistant } from '../components/AIRobotAssistant';

interface DashboardStats {
  role: string;
  total_assets: number;
  assets_working: number;
  assets_fault: number;
  assets_repair: number;
  assets_damaged: number;
  assets_missing: number;
  bulk_working: number;
  bulk_damaged: number;
  bulk_missing: number;
  bulk_repair: number;
  open_faults: number;
  low_stock_items: number;
  pending_transfers: number;
  pending_purchases: number;
  tech_assigned: number;
  tech_in_progress: number;
  category_data: { category: string; count: number }[];
  lab_breakdown: { lab_id: number; name: string; code: string; total_assets: number; open_faults: number }[];
}

interface DashboardPageProps {
  onNavigate: (page: PageId) => void;
  onOpenQRScanner: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate, onOpenQRScanner }) => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [robotAssistantOpen, setRobotAssistantOpen] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<DashboardStats>('/reports/dashboard-stats');
      setStats(data);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-navy-900"></div>
      </div>
    );
  }

  const role = user?.role || 'LAB_INSTRUCTOR';

  return (
    <div className="space-y-6">
      
      {/* Institutional Header Banner */}
      <div className="bg-gradient-to-r from-navy-900 via-navy-800 to-navy-900 rounded-2xl p-6 text-white shadow-lg border border-navy-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2 text-cyan-300 text-xs font-semibold tracking-wider uppercase mb-1">
            <Cpu className="h-4 w-4" />
            <span>SMVITM Lab Administration Portal • {role.replace('_', ' ')} View</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Welcome, {user?.full_name}
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Department of Artificial Intelligence and Data Science • Shri Madhwa Vadiraja Institute of Technology & Management.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setRobotAssistantOpen(prev => !prev)}
            className="flex items-center space-x-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold border border-emerald-300/30 transition shadow-md active:scale-95"
            title="Chat with AI Inventory Intelligence Robot"
          >
            <Bot className="h-4 w-4 text-emerald-200 animate-pulse" />
            <span>AI Robot</span>
          </button>

          <button
            onClick={onOpenQRScanner}
            className="flex items-center space-x-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold border border-cyan-300/30 transition shadow-md shadow-cyan-950/20 active:scale-95"
            title="Scan Asset QR Code or Lookup Equipment"
          >
            <QrCode className="h-4 w-4 text-cyan-100" />
            <span>QR Scanner</span>
          </button>
          {(role === 'LAB_INSTRUCTOR' || role === 'ADMIN') && (
            <button
              onClick={() => onNavigate('faults')}
              className="flex items-center space-x-2 bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl text-xs font-semibold transition shadow"
            >
              <Wrench className="h-4 w-4" />
              <span>Report Fault</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. LAB INSTRUCTOR SPECIFIC DASHBOARD VIEW */}
      {/* ========================================================================= */}
      {role === 'LAB_INSTRUCTOR' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div
              onClick={() => onNavigate('inventory')}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Assigned Lab Assets
                  </span>
                  <div className="text-2xl font-black text-navy-900 mt-1">{stats.total_assets}</div>
                </div>
                <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl">
                  <Box className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-3 text-xs text-emerald-600 font-semibold flex items-center">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {stats.assets_working} Verified Working
              </div>
            </div>

            <div
              onClick={() => onNavigate('faults')}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Faults Under Repair
                  </span>
                  <div className="text-2xl font-black text-rose-600 mt-1">{stats.open_faults}</div>
                </div>
                <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
                  <AlertTriangle className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-500">
                {stats.assets_repair} under technician diagnosis
              </div>
            </div>

            <div
              onClick={() => onNavigate('inventory')}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Bulk Buffer Alerts
                  </span>
                  <div className="text-2xl font-black text-amber-600 mt-1">{stats.low_stock_items}</div>
                </div>
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                  <Clock className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-500">
                Items below minimum safety stock
              </div>
            </div>

            <div
              onClick={() => onNavigate('transfers')}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Pending Transfers
                  </span>
                  <div className="text-2xl font-black text-purple-700 mt-1">{stats.pending_transfers}</div>
                </div>
                <div className="p-2.5 bg-purple-50 text-purple-700 rounded-xl">
                  <ArrowRightLeft className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-500">
                Awaiting HOD / Dispatch confirmation
              </div>
            </div>

          </div>

          {/* Quick Action Dock */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="font-bold text-sm text-navy-900">Lab Instructor Action Dock</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <button
                onClick={onOpenQRScanner}
                className="p-3 bg-cyan-50/80 hover:bg-cyan-100 rounded-xl border border-cyan-200 text-left transition"
              >
                <QrCode className="h-4 w-4 text-cyan-700 mb-1" />
                <div className="font-semibold text-xs text-slate-800">QR Scanner</div>
                <div className="text-[10px] text-slate-500">Scan bench asset</div>
              </button>
              <button
                onClick={() => onNavigate('inventory')}
                className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-left transition"
              >
                <Plus className="h-4 w-4 text-navy-900 mb-1" />
                <div className="font-semibold text-xs text-slate-800">Add Equipment</div>
                <div className="text-[10px] text-slate-500">Register new workstation</div>
              </button>
              <button
                onClick={() => onNavigate('faults')}
                className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-left transition"
              >
                <Wrench className="h-4 w-4 text-rose-600 mb-1" />
                <div className="font-semibold text-xs text-slate-800">Report Fault</div>
                <div className="text-[10px] text-slate-500">Trigger AI diagnosis</div>
              </button>
              <button
                onClick={() => onNavigate('transfers')}
                className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-left transition"
              >
                <ArrowRightLeft className="h-4 w-4 text-purple-600 mb-1" />
                <div className="font-semibold text-xs text-slate-800">Transfer Request</div>
                <div className="text-[10px] text-slate-500">Relocate to Lab 2</div>
              </button>
              <button
                onClick={() => onNavigate('timetable')}
                className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-left transition"
              >
                <Clock className="h-4 w-4 text-blue-600 mb-1" />
                <div className="font-semibold text-xs text-slate-800">Schedule Timetable</div>
                <div className="text-[10px] text-slate-500">Reserve lab session</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TECHNICIAN SPECIFIC WORKBENCH VIEW */}
      {/* ========================================================================= */}
      {role === 'TECHNICIAN' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Assigned Repair Jobs
              </span>
              <div className="text-3xl font-black text-amber-600 mt-1">
                {stats.tech_assigned}
              </div>
              <div className="text-xs text-slate-500 mt-2">New repair tickets awaiting diagnosis</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Repairs In Progress
              </span>
              <div className="text-3xl font-black text-blue-600 mt-1">
                {stats.tech_in_progress}
              </div>
              <div className="text-xs text-slate-500 mt-2">Under bench testing or parts assembly</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Active Campus Faults
              </span>
              <div className="text-3xl font-black text-navy-900 mt-1">
                {stats.open_faults}
              </div>
              <div className="text-xs text-slate-500 mt-2">Overall laboratory equipment faults</div>
            </div>

          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center space-x-2 text-amber-900 font-bold text-sm">
                <Wrench className="h-5 w-5 text-amber-700" />
                <span>Technician Repair Workstation Ready</span>
              </div>
              <p className="text-xs text-amber-800 mt-1">
                Update technical findings, request electrical/computing spare parts, and submit completed equipment repairs for Lab Instructor verification.
              </p>
            </div>
            <button
              onClick={() => onNavigate('faults')}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold transition shadow flex-shrink-0"
            >
              Open Active Repair Queue
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. HOD SPECIFIC APPROVALS COCKPIT */}
      {/* ========================================================================= */}
      {role === 'HOD' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            <div
              onClick={() => onNavigate('requests')}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer"
            >
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Purchase Requests For Review
              </span>
              <div className="text-3xl font-black text-purple-700 mt-1">
                {stats.pending_purchases}
              </div>
              <div className="text-xs text-slate-500 mt-2">Awaiting departmental endorsement</div>
            </div>

            <div
              onClick={() => onNavigate('transfers')}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer"
            >
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Inter-Lab Transfers
              </span>
              <div className="text-3xl font-black text-navy-900 mt-1">
                {stats.pending_transfers}
              </div>
              <div className="text-xs text-slate-500 mt-2">Awaiting HOD allocation review</div>
            </div>

            <div
              onClick={() => onNavigate('inventory')}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer"
            >
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Department Total Assets
              </span>
              <div className="text-3xl font-black text-emerald-600 mt-1">
                {stats.total_assets}
              </div>
              <div className="text-xs text-slate-500 mt-2">Spread across AI & DS laboratories</div>
            </div>

          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center space-x-2 text-emerald-900 font-bold text-sm">
                <ShieldCheck className="h-5 w-5 text-emerald-700" />
                <span>Departmental Approvals Queue</span>
              </div>
              <p className="text-xs text-emerald-800 mt-1">
                Review equipment requisitions and inter-lab transfer justifications before institutional escalation to the Principal.
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => onNavigate('requests')}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold transition shadow"
              >
                Review Purchases
              </button>
              <button
                onClick={() => onNavigate('transfers')}
                className="px-4 py-2 bg-navy-800 hover:bg-navy-900 text-white rounded-xl text-xs font-semibold transition shadow"
              >
                Review Transfers
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. PRINCIPAL SPECIFIC EXECUTIVE VIEW */}
      {/* ========================================================================= */}
      {role === 'PRINCIPAL' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            <div
              onClick={() => onNavigate('requests')}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer"
            >
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Institutional Requisitions
              </span>
              <div className="text-3xl font-black text-rose-600 mt-1">
                {stats.pending_purchases}
              </div>
              <div className="text-xs text-slate-500 mt-2">Awaiting executive sanction</div>
            </div>

            <div
              onClick={() => onNavigate('inventory')}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer"
            >
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Campus Capital Assets
              </span>
              <div className="text-3xl font-black text-navy-900 mt-1">
                {stats.total_assets}
              </div>
              <div className="text-xs text-slate-500 mt-2">AI & Data Science Labs</div>
            </div>

            <div
              onClick={() => onNavigate('reports')}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer"
            >
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Lab Operational Health
              </span>
              <div className="text-3xl font-black text-emerald-600 mt-1">
                {stats.total_assets > 0 ? Math.round((stats.assets_working / stats.total_assets) * 100) : 100}%
              </div>
              <div className="text-xs text-slate-500 mt-2">Average equipment readiness</div>
            </div>

          </div>

          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center space-x-2 text-rose-900 font-bold text-sm">
                <ShieldAlert className="h-5 w-5 text-rose-700" />
                <span>Executive Budget Sanctions Portal</span>
              </div>
              <p className="text-xs text-rose-800 mt-1">
                Review high-value academic computing equipment requisitions recommended by the Head of Department.
              </p>
            </div>
            <button
              onClick={() => onNavigate('requests')}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition shadow flex-shrink-0"
            >
              Inspect Requisitions
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. ADMINISTRATOR SPECIFIC COMMAND CENTER */}
      {/* ========================================================================= */}
      {role === 'ADMIN' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            
            <div
              onClick={() => onNavigate('users')}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer"
            >
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Active User Accounts
              </span>
              <div className="text-2xl font-black text-purple-700 mt-1">5</div>
              <div className="text-xs text-slate-500 mt-2">RBAC roles provisioned</div>
            </div>

            <div
              onClick={() => onNavigate('inventory')}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer"
            >
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Total Tracked Assets
              </span>
              <div className="text-2xl font-black text-navy-900 mt-1">{stats.total_assets}</div>
              <div className="text-xs text-slate-500 mt-2">2 Active Laboratories</div>
            </div>

            <div
              onClick={() => onNavigate('audit')}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer"
            >
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Security Audit Log
              </span>
              <div className="text-2xl font-black text-emerald-600 mt-1">Live</div>
              <div className="text-xs text-slate-500 mt-2">Immutable action stream</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Database Engine
              </span>
              <div className="text-2xl font-black text-cyan-700 mt-1">Connected</div>
              <div className="text-xs text-slate-500 mt-2">PostgreSQL-ready / SQLite Fallback</div>
            </div>

          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center space-x-2 text-purple-900 font-bold text-sm">
                <Users className="h-5 w-5 text-purple-700" />
                <span>System Administration & Access Control</span>
              </div>
              <p className="text-xs text-purple-800 mt-1">
                Configure user roles, allocate laboratory scopes, monitor system audit trails, and manage database migrations.
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => onNavigate('users')}
                className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-semibold transition shadow"
              >
                Manage Users
              </button>
              <button
                onClick={() => onNavigate('audit')}
                className="px-4 py-2 bg-navy-800 hover:bg-navy-900 text-white rounded-xl text-xs font-semibold transition shadow"
              >
                Audit Trail
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* UNIVERSAL LABORATORY AND CATEGORY STATUS BREAKDOWNS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Laboratory Status Breakdown */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-sm text-navy-900">
              Laboratory Readiness Breakdown
            </h3>
            <span className="text-xs text-slate-400">Department of AI & DS</span>
          </div>

          <div className="space-y-3">
            {stats.lab_breakdown.map((lab) => (
              <div
                key={lab.lab_id}
                className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex justify-between items-center transition"
              >
                <div>
                  <div className="font-semibold text-slate-800 text-sm">{lab.name}</div>
                  <div className="text-xs text-slate-500">Code: {lab.code}</div>
                </div>
                <div className="flex items-center space-x-4 text-xs">
                  <div className="text-right">
                    <span className="font-bold text-navy-900 block">{lab.total_assets} Assets</span>
                    <span className={`text-[11px] ${lab.open_faults > 0 ? 'text-rose-600 font-semibold' : 'text-emerald-600'}`}>
                      {lab.open_faults} open issues
                    </span>
                  </div>
                  <button
                    onClick={() => onNavigate('inventory')}
                    className="p-1.5 text-slate-400 hover:text-navy-900 transition"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Equipment Category Breakdown */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-sm text-navy-900">
              Equipment Categories
            </h3>
            <span className="text-xs text-slate-400">Total: {stats.total_assets}</span>
          </div>

          <div className="space-y-3">
            {stats.category_data.map((cat, i) => {
              const percent = stats.total_assets > 0 ? Math.round((cat.count / stats.total_assets) * 100) : 0;
              return (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-700">{cat.category}</span>
                    <span className="font-bold text-navy-900">{cat.count} ({percent}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-navy-800 h-full rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Interactive Floating AI Robot Assistant Component */}
      <AIRobotAssistant
        key={robotAssistantOpen ? 'robot-open' : 'robot-closed'}
        onNavigate={onNavigate}
        onOpenQRScanner={onOpenQRScanner}
        initialOpen={robotAssistantOpen}
      />

    </div>
  );
};
