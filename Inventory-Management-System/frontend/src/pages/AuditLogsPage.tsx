import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';
import { ShieldCheck, Search, Filter } from 'lucide-react';

interface AuditRecord {
  id: number;
  user_email: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: string;
  ip_address?: string;
  timestamp: string;
}

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionSearch, setActionSearch] = useState('');

  useEffect(() => {
    loadLogs();
  }, [actionSearch]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      let endpoint = `/audit?limit=100`;
      if (actionSearch) endpoint += `&action=${encodeURIComponent(actionSearch)}`;
      const data = await apiRequest<AuditRecord[]>(endpoint);
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-navy-900 tracking-tight">
            Security & Compliance Audit Trail
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable system logs tracking logins, status changes, transfers, and administrative actions.
          </p>
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            value={actionSearch}
            onChange={(e) => setActionSearch(e.target.value)}
            placeholder="Filter action (e.g. LOGIN, ASSET, HOD)..."
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy-600"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading audit events...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">No audit events found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">User Email</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Audit Details</th>
                  <th className="py-3 px-4">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(l.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-navy-900 font-semibold">{l.user_email || 'SYSTEM'}</td>
                    <td className="py-3 px-4">
                      <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-bold text-[10px]">
                        {l.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-sans">
                      {l.entity_type} {l.entity_id ? `(#${l.entity_id})` : ''}
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-700 max-w-sm">
                      {l.details}
                    </td>
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                      {l.ip_address || '127.0.0.1'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
