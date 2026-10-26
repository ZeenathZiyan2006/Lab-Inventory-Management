import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import {
  Box,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRightLeft,
  QrCode,
  Wrench,
  ChevronRight,
  ShieldAlert,
  Plus,
  Bot,
  Zap,
  FlaskConical,
  Cpu
} from 'lucide-react';
import { PageId } from '../components/Sidebar';
import { AIRobotAssistant } from '../components/AIRobotAssistant';
import { triggerSelectionGreeting } from '../components/effects/SelectionGreetingRobot';

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
        <div className="flex flex-col items-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400"></div>
          <span className="text-xs text-cyan-300 font-semibold tracking-wider uppercase">Loading Neon Command Hub...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5 pb-6">
      
      {/* ========================================================================= */}
      {/* CAMPUS HERO BANNER WITH AUTHENTIC NIGHT CAMPUS PHOTO                      */}
      {/* ========================================================================= */}
        <div className="relative rounded-3xl overflow-hidden border border-cyan-500/35 bg-[#050C1F] shadow-[0_12px_40px_rgba(0,0,0,0.7)] min-h-[220px]">
          
          {/* Right-aligned illuminated night campus photo */}
          <div
            className="absolute right-0 top-0 bottom-0 w-full md:w-[65%] lg:w-[60%] bg-cover bg-center pointer-events-none"
            style={{
              backgroundImage: `url('/images/smvitm_night_campus.png')`,
              maskImage: 'linear-gradient(to right, transparent 0%, black 35%, black 100%)',
              WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 35%, black 100%)'
            }}
          />

          {/* Deep cyber dark blue gradient on left to guarantee text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#04091A] via-[#061230]/90 to-transparent pointer-events-none" />

          {/* Glowing circuit line decoration on the left */}
          <svg className="absolute left-0 bottom-0 w-80 h-32 text-cyan-400/40 pointer-events-none drop-shadow-[0_0_8px_#00F0FF]" viewBox="0 0 320 120" fill="none">
            <path d="M 0 100 L 120 100 L 150 70 L 260 70 L 280 40 L 320 40" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="120" cy="100" r="3" fill="#00F0FF" />
            <circle cx="150" cy="70" r="3" fill="#00F0FF" />
            <circle cx="260" cy="70" r="3" fill="#00F0FF" />
            <circle cx="280" cy="40" r="3" fill="#00F0FF" />
          </svg>

          <div className="relative z-10 p-6 sm:p-7 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 min-h-[210px]">
            {/* Left Titles - Shifted up with dedicated top alignment & breathing space */}
            <div className="space-y-1.5 max-w-xl self-start pt-1 sm:pt-2">
              <div className="text-[11px] font-bold text-cyan-400 tracking-widest uppercase drop-shadow-[0_0_6px_#00F0FF]">
                SMVITM LAB ADMINISTRATION PORTAL
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]">
                Welcome, {user?.full_name || 'Thrisha K. Puthran'}
              </h2>
              <div className="text-xs sm:text-sm text-slate-200 font-medium">
                Department of Artificial Intelligence and Data Science
              </div>
              <div className="text-[11px] sm:text-xs text-slate-400">
                Shri Madhwa Vadiraja Institute of Technology & Management
              </div>
            </div>

            {/* Bottom-Right Action Buttons Cluster */}
            <div className="flex items-center flex-wrap gap-2.5 self-start lg:self-end pb-1">
              <button
                onClick={() => {
                  triggerSelectionGreeting('Connecting to AI Robot!');
                  setRobotAssistantOpen(prev => !prev);
                }}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-2xl bg-[#062038]/90 hover:bg-[#0A2F52] text-cyan-300 text-xs font-bold border border-cyan-400 shadow-[0_0_12px_rgba(0,240,255,0.35)] transition active:scale-95"
              >
                <Bot className="h-4 w-4 text-cyan-300 drop-shadow-[0_0_4px_#00F0FF]" />
                <span>AI Robot</span>
              </button>

              <button
                onClick={() => {
                  triggerSelectionGreeting('Scanning Asset QR!');
                  onOpenQRScanner();
                }}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-2xl bg-[#1C0E36]/90 hover:bg-[#2A1652] text-purple-300 text-xs font-bold border border-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.35)] transition active:scale-95"
              >
                <QrCode className="h-4 w-4 text-purple-300 drop-shadow-[0_0_4px_#A855F7]" />
                <span>QR Scanner</span>
              </button>

              <button
                onClick={() => {
                  triggerSelectionGreeting('Opening Fault Desk!');
                  onNavigate('faults');
                }}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-2xl bg-[#280A22]/90 hover:bg-[#3D0E34] text-pink-300 text-xs font-bold border border-pink-400 shadow-[0_0_12px_rgba(236,72,153,0.35)] transition active:scale-95"
              >
                <Wrench className="h-4 w-4 text-pink-300 drop-shadow-[0_0_4px_#EC4899]" />
                <span>Report Fault</span>
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* ROW 1: 4 GLOWING STATISTIC CARDS (EXACT REPLICA OF USER REFERENCE)       */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          
          {/* Card 1: ASSIGNED LAB ASSETS (Electric Cyan Glass) */}
          <div
            onClick={() => {
              triggerSelectionGreeting('Viewing Lab Assets!');
              onNavigate('inventory');
            }}
            className="relative p-4 rounded-3xl bg-gradient-to-b from-[#041026] to-[#020714] border-2 border-cyan-400 shadow-[0_0_20px_rgba(0,240,255,0.35),inset_0_0_15px_rgba(0,240,255,0.08)] hover:shadow-[0_0_28px_rgba(0,240,255,0.55)] transition-all duration-300 cursor-pointer group overflow-hidden"
          >
            {/* Top glass bevel specular highlight */}
            <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-300 to-transparent opacity-80" />

            <div className="flex items-center justify-between">
              {/* Double Concentric Ring Icon Badge */}
              <div className="w-12 h-12 rounded-full border-2 border-cyan-400 p-[3px] flex items-center justify-center shadow-[0_0_12px_#00F0FF]">
                <div className="w-full h-full rounded-full border border-cyan-300/80 bg-cyan-950/80 flex items-center justify-center text-cyan-300">
                  <Box className="h-5 w-5 drop-shadow-[0_0_4px_#00F0FF]" />
                </div>
              </div>
              <span className="text-[11px] font-bold text-slate-200 tracking-wider uppercase">
                ASSIGNED LAB ASSETS
              </span>
            </div>

            <div className="flex items-end justify-between mt-3 px-1">
              <div className="text-4xl font-black text-white drop-shadow-[0_0_12px_rgba(0,240,255,0.5)]">
                {stats.total_assets}
              </div>
              {/* Exact Cyan Telemetry Inventory Trend Line & Gradient Columns */}
              <div className="w-28 h-11 relative">
                <svg className="w-full h-full" viewBox="0 0 100 40" fill="none">
                  <defs>
                    <linearGradient id="cyanBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="#00F0FF" stopOpacity="0.05" />
                    </linearGradient>
                    <linearGradient id="cyanAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#00F0FF" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <polygon points="0,32 18,24 36,28 54,30 74,10 96,16 96,40 0,40" fill="url(#cyanAreaGrad)" />
                  <rect x="16" y="24" width="3.5" height="16" fill="url(#cyanBarGrad)" rx="1" />
                  <rect x="34" y="28" width="3.5" height="12" fill="url(#cyanBarGrad)" rx="1" />
                  <rect x="52" y="30" width="3.5" height="10" fill="url(#cyanBarGrad)" rx="1" />
                  <rect x="64" y="18" width="3.5" height="22" fill="url(#cyanBarGrad)" rx="1" />
                  <rect x="72" y="10" width="3.5" height="30" fill="url(#cyanBarGrad)" rx="1" />
                  <rect x="84" y="13" width="3.5" height="27" fill="url(#cyanBarGrad)" rx="1" />
                  <rect x="94" y="16" width="3.5" height="24" fill="url(#cyanBarGrad)" rx="1" />
                  <polyline points="0,32 18,24 36,28 54,30 74,10 96,16" stroke="#00F0FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="74" cy="10" r="3" fill="#FFFFFF" stroke="#00F0FF" strokeWidth="2" style={{ filter: 'drop-shadow(0 0 6px #00F0FF)' }} />
                  <circle cx="96" cy="16" r="2.5" fill="#00F0FF" />
                </svg>
              </div>
            </div>

            <div className="mt-3 text-[11px] text-cyan-300 font-bold flex items-center">
              <CheckCircle2 className="h-4 w-4 mr-1.5 text-cyan-400 drop-shadow-[0_0_5px_#00F0FF]" />
              <span>{stats.assets_working} Verified Working</span>
            </div>
          </div>

          {/* Card 2: FAULTS UNDER REPAIR (Electric Magenta Glass) */}
          <div
            onClick={() => {
              triggerSelectionGreeting('Checking Fault Repairs!');
              onNavigate('faults');
            }}
            className="relative p-4 rounded-3xl bg-gradient-to-b from-[#180624] to-[#0a0210] border-2 border-fuchsia-500 shadow-[0_0_20px_rgba(217,70,239,0.35),inset_0_0_15px_rgba(217,70,239,0.08)] hover:shadow-[0_0_28px_rgba(217,70,239,0.55)] transition-all duration-300 cursor-pointer group overflow-hidden"
          >
            {/* Top glass bevel specular highlight */}
            <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-fuchsia-300 to-transparent opacity-80" />

            <div className="flex items-center justify-between">
              {/* Double Concentric Ring Icon Badge */}
              <div className="w-12 h-12 rounded-full border-2 border-fuchsia-400 p-[3px] flex items-center justify-center shadow-[0_0_12px_#D946EF]">
                <div className="w-full h-full rounded-full border border-fuchsia-300/80 bg-fuchsia-950/80 flex items-center justify-center text-fuchsia-300">
                  <AlertTriangle className="h-5 w-5 drop-shadow-[0_0_4px_#D946EF]" />
                </div>
              </div>
              <span className="text-[11px] font-bold text-slate-200 tracking-wider uppercase">
                FAULTS UNDER REPAIR
              </span>
            </div>

            <div className="flex items-end justify-between mt-3 px-1">
              <div className="text-4xl font-black text-fuchsia-400 drop-shadow-[0_0_12px_rgba(217,70,239,0.5)]">
                {stats.open_faults}
              </div>
              {/* Exact Magenta Telemetry Repair Trend Line & Gradient Columns */}
              <div className="w-28 h-11 relative">
                <svg className="w-full h-full" viewBox="0 0 100 40" fill="none">
                  <defs>
                    <linearGradient id="magentaBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#D946EF" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="#D946EF" stopOpacity="0.05" />
                    </linearGradient>
                    <linearGradient id="magentaAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#D946EF" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#D946EF" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <polygon points="0,35 20,33 38,22 56,28 80,8 96,15 96,40 0,40" fill="url(#magentaAreaGrad)" />
                  <rect x="18" y="33" width="3.5" height="7" fill="url(#magentaBarGrad)" rx="1" />
                  <rect x="36" y="22" width="3.5" height="18" fill="url(#magentaBarGrad)" rx="1" />
                  <rect x="54" y="28" width="3.5" height="12" fill="url(#magentaBarGrad)" rx="1" />
                  <rect x="68" y="18" width="3.5" height="22" fill="url(#magentaBarGrad)" rx="1" />
                  <rect x="78" y="8" width="3.5" height="32" fill="url(#magentaBarGrad)" rx="1" />
                  <rect x="94" y="15" width="3.5" height="25" fill="url(#magentaBarGrad)" rx="1" />
                  <polyline points="0,35 20,33 38,22 56,28 80,8 96,15" stroke="#D946EF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="80" cy="8" r="3" fill="#FFFFFF" stroke="#D946EF" strokeWidth="2" style={{ filter: 'drop-shadow(0 0 6px #D946EF)' }} />
                  <circle cx="96" cy="15" r="2.5" fill="#D946EF" />
                </svg>
              </div>
            </div>

            <div className="mt-3 text-[11px] text-fuchsia-300 font-bold flex items-center">
              <AlertTriangle className="h-4 w-4 mr-1.5 text-fuchsia-400 drop-shadow-[0_0_5px_#D946EF]" />
              <span>{stats.assets_repair || 1} under technician diagnosis</span>
            </div>
          </div>

          {/* Card 3: BULK BUFFER ALERTS (Electric Gold Glass) */}
          <div
            onClick={() => {
              triggerSelectionGreeting('Checking Buffer Stock!');
              onNavigate('inventory');
            }}
            className="relative p-4 rounded-3xl bg-gradient-to-b from-[#181304] to-[#0c0902] border-2 border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.35),inset_0_0_15px_rgba(250,204,21,0.08)] hover:shadow-[0_0_28px_rgba(250,204,21,0.55)] transition-all duration-300 cursor-pointer group overflow-hidden"
          >
            {/* Top glass bevel specular highlight */}
            <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-yellow-200 to-transparent opacity-80" />

            <div className="flex items-center justify-between">
              {/* Double Concentric Ring Icon Badge */}
              <div className="w-12 h-12 rounded-full border-2 border-yellow-400 p-[3px] flex items-center justify-center shadow-[0_0_12px_#FACC15]">
                <div className="w-full h-full rounded-full border border-yellow-300/80 bg-yellow-950/80 flex items-center justify-center text-yellow-300">
                  <ShieldAlert className="h-5 w-5 drop-shadow-[0_0_4px_#FACC15]" />
                </div>
              </div>
              <span className="text-[11px] font-bold text-slate-200 tracking-wider uppercase">
                BULK BUFFER ALERTS
              </span>
            </div>

            <div className="flex items-end justify-between mt-3 px-1">
              <div className="text-4xl font-black text-yellow-300 drop-shadow-[0_0_12px_rgba(250,204,21,0.5)]">
                {stats.low_stock_items}
              </div>
              {/* Exact 8-Bar Safety Buffer Histogram in Gold / Amber */}
              <div className="w-28 h-11 relative">
                <svg className="w-full h-full" viewBox="0 0 100 40" fill="none">
                  <defs>
                    <linearGradient id="yellowBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FDE047" />
                      <stop offset="100%" stopColor="#854D0E" />
                    </linearGradient>
                  </defs>
                  <rect x="6" y="36" width="6" height="4" fill="url(#yellowBarGrad)" opacity="0.35" rx="1.5" />
                  <rect x="17" y="32" width="6" height="8" fill="url(#yellowBarGrad)" opacity="0.45" rx="1.5" />
                  <rect x="28" y="27" width="6" height="13" fill="url(#yellowBarGrad)" opacity="0.6" rx="1.5" />
                  <rect x="39" y="21" width="6" height="19" fill="url(#yellowBarGrad)" opacity="0.75" rx="1.5" />
                  <rect x="50" y="15" width="6" height="25" fill="url(#yellowBarGrad)" opacity="0.85" rx="1.5" />
                  <rect x="61" y="10" width="6" height="30" fill="url(#yellowBarGrad)" opacity="0.95" rx="1.5" />
                  <rect x="72" y="5" width="6" height="35" fill="url(#yellowBarGrad)" rx="1.5" style={{ filter: 'drop-shadow(0 0 4px #FACC15)' }} />
                  <rect x="83" y="1" width="6" height="39" fill="url(#yellowBarGrad)" rx="1.5" style={{ filter: 'drop-shadow(0 0 6px #FACC15)' }} />
                </svg>
              </div>
            </div>

            <div className="mt-3 text-[11px] text-yellow-200 font-bold flex items-center">
              <AlertTriangle className="h-4 w-4 mr-1.5 text-yellow-400" />
              <span>Items below minimum safety stock</span>
            </div>
          </div>

          {/* Card 4: PENDING TRANSFERS (Electric Blue Glass) */}
          <div
            onClick={() => {
              triggerSelectionGreeting('Inspecting Transfers!');
              onNavigate('transfers');
            }}
            className="relative p-4 rounded-3xl bg-gradient-to-b from-[#080d2b] to-[#040616] border-2 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.35),inset_0_0_15px_rgba(59,130,246,0.08)] hover:shadow-[0_0_28px_rgba(59,130,246,0.55)] transition-all duration-300 cursor-pointer group overflow-hidden"
          >
            {/* Top glass bevel specular highlight */}
            <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-blue-300 to-transparent opacity-80" />

            <div className="flex items-center justify-between">
              {/* Double Concentric Ring Icon Badge */}
              <div className="w-12 h-12 rounded-full border-2 border-blue-400 p-[3px] flex items-center justify-center shadow-[0_0_12px_#3B82F6]">
                <div className="w-full h-full rounded-full border border-blue-300/80 bg-blue-950/80 flex items-center justify-center text-blue-300">
                  <ArrowRightLeft className="h-5 w-5 drop-shadow-[0_0_4px_#3B82F6]" />
                </div>
              </div>
              <span className="text-[11px] font-bold text-slate-200 tracking-wider uppercase">
                PENDING TRANSFERS
              </span>
            </div>

            <div className="flex items-end justify-between mt-3 px-1">
              <div className="text-4xl font-black text-blue-300 drop-shadow-[0_0_12px_rgba(59,130,246,0.5)]">
                {stats.pending_transfers}
              </div>
              {/* Exact Blue Telemetry Transfer Trend Line & Gradient Columns */}
              <div className="w-28 h-11 relative">
                <svg className="w-full h-full" viewBox="0 0 100 40" fill="none">
                  <defs>
                    <linearGradient id="blueBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.05" />
                    </linearGradient>
                    <linearGradient id="blueAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <polygon points="0,36 22,28 40,33 58,30 82,8 96,15 96,40 0,40" fill="url(#blueAreaGrad)" />
                  <rect x="20" y="28" width="3.5" height="12" fill="url(#blueBarGrad)" rx="1" />
                  <rect x="38" y="33" width="3.5" height="7" fill="url(#blueBarGrad)" rx="1" />
                  <rect x="56" y="30" width="3.5" height="10" fill="url(#blueBarGrad)" rx="1" />
                  <rect x="70" y="19" width="3.5" height="21" fill="url(#blueBarGrad)" rx="1" />
                  <rect x="80" y="8" width="3.5" height="32" fill="url(#blueBarGrad)" rx="1" />
                  <rect x="94" y="15" width="3.5" height="25" fill="url(#blueBarGrad)" rx="1" />
                  <polyline points="0,36 22,28 40,33 58,30 82,8 96,15" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="82" cy="8" r="3" fill="#FFFFFF" stroke="#3B82F6" strokeWidth="2" style={{ filter: 'drop-shadow(0 0 6px #3B82F6)' }} />
                  <circle cx="96" cy="15" r="2.5" fill="#3B82F6" />
                </svg>
              </div>
            </div>

            <div className="mt-3 text-[11px] text-blue-200 font-bold flex items-center">
              <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5 text-blue-400" />
              <span>Awaiting HOD / Dispatch confirmation</span>
            </div>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* ROW 2: INSTRUCTOR ACTION DOCK (EXACT REPLICA OF USER REFERENCE IMAGE 2)    */}
        {/* ========================================================================= */}
        <div className="relative rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 bg-[#030919]/95 border border-cyan-400/70 shadow-[0_0_25px_rgba(0,210,255,0.2),inset_0_0_20px_rgba(0,150,255,0.06)] overflow-hidden space-y-3">
          {/* Futuristic Glowing Tech / Circuit Background */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-10 left-1/4 w-96 h-40 bg-cyan-500/15 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 right-1/4 w-96 h-40 bg-blue-600/15 rounded-full blur-3xl" />
            <svg className="absolute inset-0 w-full h-full opacity-25" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="dockLineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#00f0ff" stopOpacity="0" />
                  <stop offset="50%" stopColor="#00f0ff" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
              </defs>
              <line x1="8%" y1="22%" x2="42%" y2="22%" stroke="url(#dockLineGrad)" strokeWidth="1" />
              <circle cx="42%" cy="22%" r="2" fill="#00f0ff" />
              <line x1="58%" y1="78%" x2="92%" y2="78%" stroke="url(#dockLineGrad)" strokeWidth="1" />
              <circle cx="58%" cy="78%" r="2" fill="#3b82f6" />
              <path d="M 60 8 L 90 8 L 110 24" fill="none" stroke="#00f0ff" strokeWidth="0.8" strokeDasharray="3 3" />
            </svg>
          </div>

          {/* Header */}
          <div className="relative z-10 flex items-center space-x-2 text-white font-bold text-xs sm:text-sm tracking-wide">
            <Zap className="h-4 w-4 text-cyan-400 fill-cyan-400 drop-shadow-[0_0_8px_#00F0FF]" />
            <span>Instructor Action Dock</span>
          </div>

          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3">
            
            {/* Option 1: QR Scanner (Cyan Neon Glass) */}
            <button
              onClick={() => {
                triggerSelectionGreeting('Scanning Asset QR!');
                onOpenQRScanner();
              }}
              className="relative p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-b from-[#062438]/90 via-[#031828]/95 to-[#020e1a] border border-cyan-400 shadow-[0_0_12px_rgba(0,240,255,0.25),inset_0_0_12px_rgba(0,240,255,0.08)] text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(0,240,255,0.45)] group flex flex-col justify-between min-h-[88px] sm:min-h-[92px]"
            >
              {/* Circular Outlined Icon Badge */}
              <div className="w-8 h-8 rounded-full border border-cyan-400 p-[1.5px] flex items-center justify-center shadow-[0_0_8px_#00F0FF] bg-cyan-950/50">
                <div className="w-full h-full rounded-full border border-cyan-300/60 flex items-center justify-center text-cyan-300">
                  <QrCode className="h-4 w-4 drop-shadow-[0_0_4px_#00F0FF]" />
                </div>
              </div>

              <div className="mt-2 w-full">
                <div className="text-xs sm:text-[13px] font-bold text-white group-hover:text-cyan-200 transition-colors whitespace-nowrap">
                  QR Scanner
                </div>
                <div className="flex items-center justify-between mt-0.5 w-full">
                  <span className="text-[10px] sm:text-[11px] text-cyan-200/70 font-medium whitespace-nowrap">
                    Scan bench asset
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-cyan-400 group-hover:translate-x-1 transition-transform flex-shrink-0 ml-1" />
                </div>
              </div>
            </button>

            {/* Option 2: Add Equipment (Electric Blue Glass) */}
            <button
              onClick={() => {
                triggerSelectionGreeting('Adding Equipment!');
                onNavigate('inventory');
              }}
              className="relative p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-b from-[#052147]/90 via-[#031733]/95 to-[#020d20] border border-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.25),inset_0_0_12px_rgba(56,189,248,0.08)] text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(56,189,248,0.45)] group flex flex-col justify-between min-h-[88px] sm:min-h-[92px]"
            >
              {/* Circular Outlined Icon Badge */}
              <div className="w-8 h-8 rounded-full border border-sky-400 p-[1.5px] flex items-center justify-center shadow-[0_0_8px_#38BDF8] bg-sky-950/50">
                <div className="w-full h-full rounded-full border border-sky-300/60 flex items-center justify-center text-sky-300">
                  <Plus className="h-4 w-4 drop-shadow-[0_0_4px_#38BDF8]" />
                </div>
              </div>

              <div className="mt-2 w-full">
                <div className="text-xs sm:text-[13px] font-bold text-white group-hover:text-sky-200 transition-colors whitespace-nowrap">
                  Add Equipment
                </div>
                <div className="flex items-center justify-between mt-0.5 w-full">
                  <span className="text-[10px] sm:text-[11px] text-sky-200/70 font-medium whitespace-nowrap">
                    Register new workstation
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-sky-400 group-hover:translate-x-1 transition-transform flex-shrink-0 ml-1" />
                </div>
              </div>
            </button>

            {/* Option 3: Report Fault (Electric Purple Glass) */}
            <button
              onClick={() => {
                triggerSelectionGreeting('Reporting Fault!');
                onNavigate('faults');
              }}
              className="relative p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-b from-[#240c3d]/90 via-[#170629]/95 to-[#0c0317] border border-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.25),inset_0_0_12px_rgba(168,85,247,0.08)] text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(168,85,247,0.45)] group flex flex-col justify-between min-h-[88px] sm:min-h-[92px]"
            >
              {/* Circular Outlined Icon Badge */}
              <div className="w-8 h-8 rounded-full border border-purple-400 p-[1.5px] flex items-center justify-center shadow-[0_0_8px_#A855F7] bg-purple-950/50">
                <div className="w-full h-full rounded-full border border-purple-300/60 flex items-center justify-center text-purple-300">
                  <Wrench className="h-4 w-4 drop-shadow-[0_0_4px_#A855F7]" />
                </div>
              </div>

              <div className="mt-2 w-full">
                <div className="text-xs sm:text-[13px] font-bold text-white group-hover:text-purple-200 transition-colors whitespace-nowrap">
                  Report Fault
                </div>
                <div className="flex items-center justify-between mt-0.5 w-full">
                  <span className="text-[10px] sm:text-[11px] text-purple-200/70 font-medium whitespace-nowrap">
                    Trigger AI diagnosis
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-purple-400 group-hover:translate-x-1 transition-transform flex-shrink-0 ml-1" />
                </div>
              </div>
            </button>

            {/* Option 4: Transfer Request (Electric Magenta Glass) */}
            <button
              onClick={() => {
                triggerSelectionGreeting('Transfer Request!');
                onNavigate('transfers');
              }}
              className="relative p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-b from-[#2b0838]/90 via-[#1c0426]/95 to-[#0e0214] border border-fuchsia-400 shadow-[0_0_12px_rgba(217,70,239,0.25),inset_0_0_12px_rgba(217,70,239,0.08)] text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(217,70,239,0.45)] group flex flex-col justify-between min-h-[88px] sm:min-h-[92px]"
            >
              {/* Circular Outlined Icon Badge */}
              <div className="w-8 h-8 rounded-full border border-fuchsia-400 p-[1.5px] flex items-center justify-center shadow-[0_0_8px_#D946EF] bg-fuchsia-950/50">
                <div className="w-full h-full rounded-full border border-fuchsia-300/60 flex items-center justify-center text-fuchsia-300">
                  <ArrowRightLeft className="h-4 w-4 drop-shadow-[0_0_4px_#D946EF]" />
                </div>
              </div>

              <div className="mt-2 w-full">
                <div className="text-xs sm:text-[13px] font-bold text-white group-hover:text-fuchsia-200 transition-colors whitespace-nowrap">
                  Transfer Request
                </div>
                <div className="flex items-center justify-between mt-0.5 w-full">
                  <span className="text-[10px] sm:text-[11px] text-fuchsia-200/70 font-medium whitespace-nowrap">
                    Relocate to Lab 2
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-fuchsia-400 group-hover:translate-x-1 transition-transform flex-shrink-0 ml-1" />
                </div>
              </div>
            </button>

            {/* Option 5: Schedule Timetable (Electric Cyan-Blue Glass) */}
            <button
              onClick={() => {
                triggerSelectionGreeting('Schedule Timetable!');
                onNavigate('timetable');
              }}
              className="relative p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-b from-[#042038]/90 via-[#021526]/95 to-[#010c17] border border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.25),inset_0_0_12px_rgba(6,182,212,0.08)] text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(6,182,212,0.45)] group flex flex-col justify-between min-h-[88px] sm:min-h-[92px]"
            >
              {/* Circular Outlined Icon Badge */}
              <div className="w-8 h-8 rounded-full border border-cyan-400 p-[1.5px] flex items-center justify-center shadow-[0_0_8px_#06B6D4] bg-cyan-950/50">
                <div className="w-full h-full rounded-full border border-cyan-300/60 flex items-center justify-center text-cyan-300">
                  <Clock className="h-4 w-4 drop-shadow-[0_0_4px_#06B6D4]" />
                </div>
              </div>

              <div className="mt-2 w-full">
                <div className="text-xs sm:text-[13px] font-bold text-white group-hover:text-cyan-200 transition-colors whitespace-nowrap">
                  Schedule Timetable
                </div>
                <div className="flex items-center justify-between mt-0.5 w-full">
                  <span className="text-[10px] sm:text-[11px] text-cyan-200/70 font-medium whitespace-nowrap">
                    Reserve lab session
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-cyan-400 group-hover:translate-x-1 transition-transform flex-shrink-0 ml-1" />
                </div>
              </div>
            </button>

          </div>
        </div>

        {/* ========================================================================= */}
        {/* ROW 3: LABORATORY READINESS BREAKDOWN & EQUIPMENT CATEGORIES               */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Laboratory Readiness Breakdown */}
          <div className="lg:col-span-7 rounded-3xl p-5 bg-[#050C1F]/85 border border-cyan-500/30 shadow-[0_8px_32px_rgba(0,0,0,0.6)] space-y-3.5">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2 text-white font-bold text-xs sm:text-sm">
                <FlaskConical className="h-4 w-4 text-cyan-400 drop-shadow-[0_0_6px_#00F0FF]" />
                <span>Laboratory Readiness Breakdown</span>
              </div>
              <span className="text-[11px] font-bold text-cyan-300 bg-[#061D3B] px-2.5 py-0.5 rounded-full border border-cyan-400/40">
                Department of AI & DS
              </span>
            </div>

            <div className="space-y-3 pt-1">
              {stats.lab_breakdown.map((lab) => (
                <div
                  key={lab.lab_id}
                  onClick={() => onNavigate('inventory')}
                  className="flex items-center justify-between p-3 rounded-2xl bg-[#06132D]/80 hover:bg-[#091D45] border border-cyan-500/25 hover:border-cyan-400/60 transition cursor-pointer group"
                >
                  <div className="flex items-center space-x-3.5">
                    {/* Lab photo thumbnail */}
                    <img
                      src="/images/lab_thumb.png"
                      alt="Lab View"
                      className="w-16 h-11 object-cover rounded-xl border border-cyan-500/30 shadow-xs"
                    />
                    <div>
                      <div className="font-bold text-white text-xs sm:text-sm group-hover:text-cyan-200 transition">
                        {lab.name}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Code: <span className="text-cyan-300 font-mono">{lab.code}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className="text-xs font-bold text-cyan-300">
                        {lab.total_assets} Assets
                      </div>
                      <div className="text-[10px] text-pink-400 font-semibold">
                        {lab.open_faults} open issues
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Equipment Categories */}
          <div className="lg:col-span-5 rounded-3xl p-5 bg-[#050C1F]/85 border border-cyan-500/30 shadow-[0_8px_32px_rgba(0,0,0,0.6)] space-y-3.5">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2 text-white font-bold text-xs sm:text-sm">
                <Cpu className="h-4 w-4 text-cyan-400 drop-shadow-[0_0_6px_#00F0FF]" />
                <span>Equipment Categories</span>
              </div>
              <span className="text-[11px] font-bold text-cyan-300 bg-[#061D3B] px-2.5 py-0.5 rounded-full border border-cyan-400/40">
                Total: {stats.total_assets}
              </span>
            </div>

            <div className="space-y-4 pt-1">
              {stats.category_data.map((cat, i) => {
                const percent = stats.total_assets > 0 ? Math.round((cat.count / stats.total_assets) * 100) : 0;
                return (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 rounded-md bg-cyan-950/80 border border-cyan-400/40 flex items-center justify-center text-cyan-400">
                          {i === 0 ? <Box className="h-3 w-3" /> : <Cpu className="h-3 w-3" />}
                        </div>
                        <span className="font-semibold text-slate-200">{cat.category}</span>
                      </div>
                      <span className="font-bold text-cyan-300">{cat.count} ({percent}%)</span>
                    </div>

                    <div className="w-full bg-[#030816] h-2.5 rounded-full overflow-hidden border border-cyan-500/25 p-[1px]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          i === 0
                            ? 'bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_0_8px_#00F0FF]'
                            : 'bg-gradient-to-r from-blue-500 to-purple-500 shadow-[0_0_8px_#A855F7]'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      {/* ========================================================================= */}
      {/* CRITICAL: PRESERVE EXISTING AI ROBOT ASSISTANT UNCHANGED                  */}
      {/* ========================================================================= */}
      <div className="assistant-isolated">
        <AIRobotAssistant
          key={robotAssistantOpen ? 'robot-open' : 'robot-closed'}
          onNavigate={onNavigate}
          onOpenQRScanner={onOpenQRScanner}
          initialOpen={robotAssistantOpen}
        />
      </div>

    </div>
  );
};
