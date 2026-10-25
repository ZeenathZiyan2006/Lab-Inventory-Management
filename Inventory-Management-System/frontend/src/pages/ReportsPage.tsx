import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  Layers,
  ArrowRight
} from 'lucide-react';

interface Stats {
  total_assets: number;
  assets_working: number;
  assets_fault: number;
  assets_repair: number;
  assets_damaged: number;
  assets_missing: number;
  category_data: { category: string; count: number }[];
  lab_breakdown: { lab_id: number; name: string; code: string; total_assets: number; open_faults: number }[];
}

export const ReportsPage: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await apiRequest<Stats>('/reports/dashboard-stats');
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = async (labId?: number) => {
    try {
      const endpoint = labId ? `/inventory/export-csv?lab_id=${labId}` : `/inventory/export-csv`;
      const blob = await apiRequest<Blob>(endpoint);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SMVITM_Report_${labId ? `Lab${labId}` : 'All'}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  if (loading || !stats) {
    return <div className="p-12 text-center text-slate-400 text-xs">Loading analytics reports...</div>;
  }

  const workingRate = stats.total_assets > 0
    ? Math.round((stats.assets_working / stats.total_assets) * 100)
    : 100;

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-navy-900 tracking-tight">
            Institutional Laboratory Reports & Analytics
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational reliability metrics, category shares, and downloadable CSV audit sheets.
          </p>
        </div>

        <button
          onClick={() => downloadCSV()}
          className="flex items-center space-x-1.5 bg-navy-900 hover:bg-navy-800 text-white px-4 py-2 rounded-xl text-xs font-semibold transition shadow-md shadow-navy-900/10"
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>Export Complete Inventory CSV</span>
        </button>
      </div>

      {/* Operational Health Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Equipment Operational Rate
          </div>
          <div className="text-3xl font-black text-emerald-600">
            {workingRate}%
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${workingRate}%` }} />
          </div>
          <div className="text-[11px] text-slate-500 pt-1">
            {stats.assets_working} of {stats.total_assets} assets fully functional.
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Under Maintenance / Repair
          </div>
          <div className="text-3xl font-black text-blue-600">
            {stats.assets_repair + stats.assets_fault}
          </div>
          <div className="text-[11px] text-slate-500 pt-1">
            Active repair jobs diagnosed or undergoing technical work.
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Damaged / Missing / Retired
          </div>
          <div className="text-3xl font-black text-rose-600">
            {stats.assets_damaged + stats.assets_missing}
          </div>
          <div className="text-[11px] text-slate-500 pt-1">
            Equipment requiring institutional write-off or replacement.
          </div>
        </div>

      </div>

      {/* Per Laboratory Breakdown and Export Buttons */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <h3 className="font-bold text-sm text-navy-900">
          Laboratory Specific Export & Audit Sheets
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {stats.lab_breakdown.map((lab) => (
            <div
              key={lab.lab_id}
              className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center"
            >
              <div>
                <div className="font-bold text-slate-900 text-sm">{lab.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Code: {lab.code} • {lab.total_assets} Registered Assets
                </div>
              </div>
              <button
                onClick={() => downloadCSV(lab.lab_id)}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-navy-900 border border-slate-300 rounded-lg text-xs font-semibold flex items-center space-x-1 transition shadow-sm"
              >
                <Download className="h-3.5 w-3.5" />
                <span>CSV</span>
              </button>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
