import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import {
  ArrowLeftRight,
  Plus,
  CheckCircle,
  XCircle,
  Truck,
  PackageCheck,
  ShieldCheck,
  Clock,
  X,
  Search,
  Filter,
  Download,
  AlertTriangle,
  Eye,
  RefreshCw,
  FileText,
  Activity,
  Layers,
  HelpCircle,
  AlertOctagon
} from 'lucide-react';

export const TRANSFER_STATUSES = [
  'Pending Approval',
  'Approved',
  'Dispatched',
  'Completed',
  'Rejected',
  'Cancelled',
  'Disputed'
];

interface ApprovalDecision {
  id: number;
  transfer_id: number;
  approver_id: number;
  approver_name?: string;
  role_at_approval: string;
  stage: string;
  decision: string;
  comments?: string;
  created_at: string;
}

interface StatusHistory {
  id: number;
  transfer_id: number;
  user_id?: number;
  user_name?: string;
  previous_status?: string;
  new_status: string;
  action?: string;
  reason?: string;
  created_at: string;
}

interface TransferItem {
  id: number;
  request_number: string;
  source_lab_id: number;
  source_lab_name?: string;
  destination_lab_id: number;
  destination_lab_name?: string;
  asset_id?: number;
  asset_custom_id?: string;
  asset_name?: string;
  bulk_id?: number;
  bulk_item_name?: string;
  quantity: number;
  requested_by_id: number;
  requested_by_name?: string;
  reason: string;
  priority: string;
  notes?: string;
  status: string;
  requires_hod_approval: boolean;
  hod_approved_by_id?: number;
  hod_approved_by_name?: string;
  hod_approval_status: string;
  hod_remarks?: string;
  requires_principal_approval: boolean;
  principal_approved_by_id?: number;
  principal_approved_by_name?: string;
  principal_approval_status: string;
  principal_remarks?: string;
  dispatched_by_id?: number;
  dispatched_by_name?: string;
  dispatched_at?: string;
  dispatch_notes?: string;
  received_by_id?: number;
  received_by_name?: string;
  received_at?: string;
  receipt_condition?: string;
  receipt_discrepancy_notes?: string;
  rejection_reason?: string;
  cancellation_reason?: string;
  created_at: string;
  updated_at: string;
  approval_decisions?: ApprovalDecision[];
  status_history?: StatusHistory[];
}

interface StockMovement {
  id: number;
  item_type: string;
  item_id: number;
  item_name: string;
  from_lab_id?: number;
  from_lab_name?: string;
  to_lab_id?: number;
  to_lab_name?: string;
  quantity: number;
  reference_type: string;
  reference_id?: string;
  user_name?: string;
  notes?: string;
  timestamp: string;
}

interface Laboratory {
  id: number;
  name: string;
  code: string;
}

interface AssetOption {
  id: number;
  asset_id: string;
  name: string;
  category: string;
  status: string;
}

interface BulkOption {
  id: number;
  name: string;
  working_quantity: number;
  total_quantity: number;
}

export const TransfersPage: React.FC = () => {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [labs, setLabs] = useState<Laboratory[]>([]);
  const [sourceAssets, setSourceAssets] = useState<AssetOption[]>([]);
  const [sourceBulkItems, setSourceBulkItems] = useState<BulkOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [labFilter, setLabFilter] = useState('');

  // Modals
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<TransferItem | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState<TransferItem | null>(null);
  const [showDispatchModal, setShowDispatchModal] = useState<TransferItem | null>(null);
  const [showReceiveModal, setShowReceiveModal] = useState<TransferItem | null>(null);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [stockLedger, setStockLedger] = useState<StockMovement[]>([]);

  // Request form state
  const [sourceLab, setSourceLab] = useState(1);
  const [destLab, setDestLab] = useState(2);
  const [itemType, setItemType] = useState<'asset' | 'bulk'>('bulk');
  const [selectedAssetId, setSelectedAssetId] = useState<number | ''>('');
  const [selectedBulkId, setSelectedBulkId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState(1);
  const [priority, setPriority] = useState('Normal');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [requiresPrincipalApproval, setRequiresPrincipalApproval] = useState(true);
  const [isDraft, setIsDraft] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Approval state
  const [approvalDecision, setApprovalDecision] = useState<'Approved' | 'Rejected' | 'More Info Requested'>('Approved');
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [approvalRejectionReason, setApprovalRejectionReason] = useState('');
  const [approvalError, setApprovalError] = useState<string | null>(null);

  // Dispatch state
  const [dispatchNotes, setDispatchNotes] = useState('');

  // Receive state
  const [receiveCondition, setReceiveCondition] = useState<'Good' | 'Damaged' | 'Discrepancy'>('Good');
  const [discrepancyNotes, setDiscrepancyNotes] = useState('');

  const isHOD = user?.role === 'HOD';
  const isPrincipal = user?.role === 'PRINCIPAL';
  const isAdmin = user?.role === 'ADMIN';
  const isApprover = isHOD || isPrincipal || isAdmin;

  useEffect(() => {
    loadLabs();
    loadTransfers();
    // Fast background sync so approval notifications and status updates reflect within seconds
    const interval = setInterval(() => {
      loadTransfers(true);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (showRequestModal && sourceLab) {
      loadSourceInventory(sourceLab);
    }
  }, [showRequestModal, sourceLab]);

  const loadLabs = async () => {
    try {
      const data = await apiRequest<Laboratory[]>('/labs');
      setLabs(data);
      if (data.length >= 2) {
        setSourceLab(data[0].id);
        setDestLab(data[1].id);
      }
    } catch (err) {
      console.warn('Could not load labs:', err);
    }
  };

  const loadTransfers = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiRequest<TransferItem[]>('/transfers');
      setTransfers(data);
    } catch (err) {
      if (!silent) console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadSourceInventory = async (labId: number) => {
    try {
      const assetsData = await apiRequest<{ items: AssetOption[] }>(`/inventory/assets?lab_id=${labId}&page_size=100`);
      setSourceAssets(assetsData.items || []);

      const bulkData = await apiRequest<BulkOption[]>(`/inventory/bulk?lab_id=${labId}`);
      setSourceBulkItems(bulkData || []);

      if (bulkData && bulkData.length > 0) {
        setSelectedBulkId(bulkData[0].id);
      }
    } catch (err) {
      console.warn('Could not load source lab inventory:', err);
    }
  };

  const loadStockLedger = async () => {
    try {
      const data = await apiRequest<StockMovement[]>('/transfers/stock-movements');
      setStockLedger(data);
      setShowLedgerModal(true);
    } catch (err: any) {
      alert(`Could not load stock ledger: ${err.message}`);
    }
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (sourceLab === destLab) {
      setFormError('Source and destination laboratories cannot be identical.');
      return;
    }

    if (itemType === 'asset' && !selectedAssetId) {
      setFormError('Please select a serialized asset to transfer.');
      return;
    }

    if (itemType === 'bulk' && !selectedBulkId) {
      setFormError('Please select a bulk stock item to transfer.');
      return;
    }

    try {
      await apiRequest('/transfers', {
        method: 'POST',
        body: JSON.stringify({
          source_lab_id: Number(sourceLab),
          destination_lab_id: Number(destLab),
          asset_id: itemType === 'asset' ? Number(selectedAssetId) : undefined,
          bulk_id: itemType === 'bulk' ? Number(selectedBulkId) : undefined,
          quantity: itemType === 'asset' ? 1 : Number(quantity),
          reason: reason.trim(),
          priority,
          notes: notes.trim() || undefined,
          requires_principal_approval: requiresPrincipalApproval,
          is_draft: isDraft
        })
      });

      setShowRequestModal(false);
      setReason('');
      setNotes('');
      setRequiresPrincipalApproval(true);
      setIsDraft(false);
      loadTransfers();
    } catch (err: any) {
      setFormError(err.message || 'Transfer request failed.');
    }
  };

  const handleApprovalSubmit = async () => {
    if (!showApprovalModal) return;
    setApprovalError(null);

    // Anti-self-approval check on client
    if (user?.id === showApprovalModal.requested_by_id && !isAdmin) {
      setApprovalError('Conflict of Interest: You cannot approve your own transfer request.');
      return;
    }

    if (approvalDecision === 'Rejected' && (!approvalRejectionReason || approvalRejectionReason.trim().length < 5)) {
      setApprovalError('A detailed rejection reason (minimum 5 characters) is required.');
      return;
    }

    try {
      await apiRequest(`/transfers/${showApprovalModal.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          decision: approvalDecision,
          comments: approvalRemarks.trim() || undefined,
          rejection_reason: approvalDecision === 'Rejected' ? approvalRejectionReason.trim() : undefined
        })
      });

      setShowApprovalModal(null);
      setApprovalRemarks('');
      setApprovalRejectionReason('');
      loadTransfers();
    } catch (err: any) {
      setApprovalError(err.message || 'Approval submission failed.');
    }
  };

  const handleDispatchSubmit = async () => {
    if (!showDispatchModal) return;
    try {
      await apiRequest(`/transfers/${showDispatchModal.id}/dispatch`, {
        method: 'POST',
        body: JSON.stringify({
          dispatch_notes: dispatchNotes.trim() || undefined
        })
      });
      setShowDispatchModal(null);
      setDispatchNotes('');
      loadTransfers();
    } catch (err: any) {
      alert(`Dispatch failed: ${err.message}`);
    }
  };

  const handleReceiveSubmit = async () => {
    if (!showReceiveModal) return;
    try {
      await apiRequest(`/transfers/${showReceiveModal.id}/receive`, {
        method: 'POST',
        body: JSON.stringify({
          condition: receiveCondition,
          discrepancy_notes: discrepancyNotes.trim() || undefined
        })
      });
      setShowReceiveModal(null);
      setDiscrepancyNotes('');
      loadTransfers();
    } catch (err: any) {
      alert(`Receipt confirmation failed: ${err.message}`);
    }
  };

  const handleCancelTransfer = async (transferId: number) => {
    const cancelReason = prompt('Provide a reason for cancelling this transfer:');
    if (!cancelReason || cancelReason.trim().length < 3) return;

    try {
      await apiRequest(`/transfers/${transferId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ cancellation_reason: cancelReason.trim() })
      });
      loadTransfers();
    } catch (err: any) {
      alert(`Cancellation failed: ${err.message}`);
    }
  };

  const handleExportCSV = async () => {
    try {
      const blob = await apiRequest('/transfers/export-csv');
      const url = window.URL.createObjectURL(blob as any);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SMVITM_Transfer_Report_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  // Filter transfers
  const filteredTransfers = transfers.filter(t => {
    if (statusFilter && t.status !== statusFilter) return false;
    if (labFilter) {
      const lId = Number(labFilter);
      if (t.source_lab_id !== lId && t.destination_lab_id !== lId) return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchNum = t.request_number.toLowerCase().includes(q);
      const matchReason = t.reason.toLowerCase().includes(q);
      const matchAsset = (t.asset_custom_id || '').toLowerCase().includes(q);
      const matchBulk = (t.bulk_item_name || '').toLowerCase().includes(q);
      const matchReq = (t.requested_by_name || '').toLowerCase().includes(q);
      if (!matchNum && !matchReason && !matchAsset && !matchBulk && !matchReq) return false;
    }
    return true;
  });

  // KPI Calculations
  const totalTransfers = transfers.length;
  const awaitingApproval = transfers.filter(t => t.status === 'Pending Approval' || t.status === 'Awaiting Approval').length;
  const inTransit = transfers.filter(t => t.status === 'Dispatched').length;
  const completedCount = transfers.filter(t => t.status === 'Completed').length;

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'Pending Approval':
      case 'Awaiting Approval':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200"><Clock className="h-3 w-3 mr-1" /> Awaiting Approval</span>;
      case 'Approved':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800 border border-blue-200"><CheckCircle className="h-3 w-3 mr-1" /> Approved</span>;
      case 'Dispatched':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 animate-pulse"><Truck className="h-3 w-3 mr-1" /> Dispatched</span>;
      case 'Completed':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200"><PackageCheck className="h-3 w-3 mr-1" /> Completed</span>;
      case 'Rejected':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200"><XCircle className="h-3 w-3 mr-1" /> Rejected</span>;
      case 'Cancelled':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">Cancelled</span>;
      case 'Disputed':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white shadow-xs"><AlertOctagon className="h-3 w-3 mr-1" /> Disputed / Damaged</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">{s}</span>;
    }
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-navy-50 rounded-xl text-navy-900 border border-navy-100">
              <ArrowLeftRight className="h-5 w-5 text-navy-800" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-navy-900 tracking-tight">
                Inter-Laboratory Equipment Transfers
              </h1>
              <p className="text-xs text-slate-500">
                Controlled Multi-Stage Stock & Asset Movement &bull; SMVITM AI & Data Science
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={loadStockLedger}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition"
          >
            <Activity className="h-3.5 w-3.5" />
            <span>Stock Ledger</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => {
              setShowRequestModal(true);
              setFormError(null);
            }}
            className="flex items-center space-x-1.5 bg-navy-900 hover:bg-navy-800 text-white px-4 py-2 rounded-xl text-xs font-semibold transition shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Request Transfer</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 block">Total Transfers</span>
            <span className="text-2xl font-bold text-navy-900">{totalTransfers}</span>
          </div>
          <div className="p-2.5 bg-slate-50 text-navy-800 rounded-xl">
            <Layers className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 block">Awaiting Approval</span>
            <span className="text-2xl font-bold text-amber-700">{awaitingApproval}</span>
          </div>
          <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 block">Dispatched (In Transit)</span>
            <span className="text-2xl font-bold text-indigo-700">{inTransit}</span>
          </div>
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
            <Truck className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 block">Completed Relocations</span>
            <span className="text-2xl font-bold text-emerald-700">{completedCount}</span>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
            <PackageCheck className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="relative sm:col-span-1">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by request #, asset tag, or reason..."
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600 font-medium"
            >
              <option value="">All Transfer Statuses</option>
              {TRANSFER_STATUSES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={labFilter}
              onChange={(e) => setLabFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600 font-medium"
            >
              <option value="">All Laboratories</option>
              {labs.map(l => (
                <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Transfers List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-400" />
            Loading transfer records...
          </div>
        ) : filteredTransfers.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <ArrowLeftRight className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700 text-sm">No Transfer Requests Found</p>
            <p className="text-slate-400 mt-0.5">Use "Request Transfer" to initiate equipment relocation.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">Request # & Date</th>
                  <th className="py-3 px-4">Source & Destination</th>
                  <th className="py-3 px-4">Item & Quantity</th>
                  <th className="py-3 px-4">Reason & Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Workflow Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransfers.map((item) => {
                  const isOfficiallyApproved = item.status === 'Approved' && item.principal_approval_status === 'Approved';
                  return (
                  <tr 
                    key={item.id} 
                    className={`transition duration-150 border-b border-cyan-500/10 ${
                      isOfficiallyApproved 
                        ? 'bg-emerald-950/40 hover:bg-emerald-900/50 border-l-4 border-l-emerald-400 shadow-[inset_0_0_20px_rgba(16,185,129,0.16)]' 
                        : 'hover:bg-cyan-950/40 hover:shadow-[inset_0_0_15px_rgba(0,240,255,0.08)]'
                    }`}
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-white tracking-wide">
                      {item.request_number}
                      <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                        {new Date(item.created_at).toLocaleDateString()} &bull; By {item.requested_by_name || `User #${item.requested_by_id}`}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-1.5 font-medium text-slate-200">
                        <span className="px-2 py-0.5 bg-slate-800/80 border border-slate-700/60 rounded text-[10px] font-semibold text-cyan-300">
                          {item.source_lab_name || `Lab ${item.source_lab_id}`}
                        </span>
                        <span className="text-cyan-400 font-bold">&rarr;</span>
                        <span className="px-2 py-0.5 bg-blue-950/70 border border-blue-500/40 rounded text-[10px] font-semibold text-blue-300">
                          {item.destination_lab_name || `Lab ${item.destination_lab_id}`}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {item.asset_custom_id ? (
                        <div>
                          <span className="font-mono font-bold text-cyan-200 block drop-shadow-xs">{item.asset_custom_id}</span>
                          <span className="text-slate-300 text-[11px] block">{item.asset_name} (1 Unit)</span>
                        </div>
                      ) : (
                        <div>
                          <span className="font-semibold text-white block">{item.bulk_item_name || 'Bulk Item'}</span>
                          <span className="text-slate-400 text-[11px]">Qty: {item.quantity} Units</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="text-slate-200 font-normal truncate">{item.reason}</div>
                      <div className="mt-0.5">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                          item.priority === 'Critical' ? 'bg-rose-950/60 text-rose-300 border-rose-500/40' :
                          item.priority === 'High' ? 'bg-amber-950/60 text-amber-300 border-amber-500/40' : 'bg-slate-800/60 text-slate-300 border-slate-700/60'
                        }`}>
                          {item.priority}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div>{getStatusBadge(item.status)}</div>
                      <div className="flex flex-col gap-1 mt-1.5">
                        <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          item.hod_approval_status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          item.hod_approval_status === 'Rejected' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          HOD: {item.hod_approval_status}
                        </span>
                        {item.requires_principal_approval && (
                          <span className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            item.principal_approval_status === 'Approved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-[0_0_6px_rgba(16,185,129,0.3)]' :
                            item.principal_approval_status === 'Rejected' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                            'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}>
                            Principal: {item.principal_approval_status}
                          </span>
                        )}
                      </div>
                      {item.receipt_condition && (
                        <div className="text-[10px] text-slate-500 mt-1">
                          Condition: <strong>{item.receipt_condition}</strong>
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                      {/* Details Button */}
                      <button
                        onClick={async () => {
                          try {
                            const full = await apiRequest<TransferItem>(`/transfers/${item.id}`);
                            setSelectedDetail(full);
                          } catch {
                            setSelectedDetail(item);
                          }
                        }}
                        className="px-2.5 py-1 bg-slate-800/80 hover:bg-cyan-950/70 text-slate-200 hover:text-cyan-300 border border-slate-700/60 hover:border-cyan-400/40 rounded-lg text-[11px] font-medium transition shadow-xs"
                      >
                        <Eye className="h-3 w-3 inline mr-1" />
                        Details
                      </button>

                      {/* Approver Action */}
                      {isApprover && (item.status === 'Pending Approval' || item.status === 'Awaiting Approval') && (
                        <button
                          onClick={() => {
                            setShowApprovalModal(item);
                            setApprovalDecision('Approved');
                            setApprovalRemarks('');
                            setApprovalRejectionReason('');
                            setApprovalError(null);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition shadow-xs ${
                            isPrincipal 
                              ? 'bg-gradient-to-r from-purple-700 to-indigo-700 text-white hover:from-purple-800 hover:to-indigo-800 ring-1 ring-purple-400/40' 
                              : isHOD
                              ? 'bg-blue-600 hover:bg-blue-700 text-white'
                              : 'bg-slate-700 hover:bg-slate-800 text-white'
                          }`}
                        >
                          <ShieldCheck className="h-3 w-3 inline mr-1" />
                          {isPrincipal ? 'Executive Review' : 'HOD Review'}
                        </button>
                      )}

                      {/* Dispatch Action (Source Lab Instructor) */}
                      {item.status === 'Approved' && (
                        <button
                          onClick={() => {
                            setShowDispatchModal(item);
                            setDispatchNotes('');
                          }}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-lg text-[11px] font-semibold transition"
                        >
                          <Truck className="h-3 w-3 inline mr-1" />
                          Dispatch
                        </button>
                      )}

                      {/* Receive Action (Destination Lab Instructor) */}
                      {item.status === 'Dispatched' && (
                        <button
                          onClick={() => {
                            setShowReceiveModal(item);
                            setReceiveCondition('Good');
                            setDiscrepancyNotes('');
                          }}
                          className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold transition shadow-xs"
                        >
                          <PackageCheck className="h-3 w-3 inline mr-1" />
                          Receive
                        </button>
                      )}

                      {/* Cancel Action */}
                      {(item.status === 'Pending Approval' || item.status === 'Draft') && (item.requested_by_id === user?.id || isAdmin) && (
                        <button
                          onClick={() => handleCancelTransfer(item.id)}
                          className="px-2 py-1 text-slate-400 hover:text-rose-600 text-[11px] transition"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: REQUEST INTER-LAB TRANSFER                     */}
      {/* ======================================================== */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="bg-navy-900 text-white p-4 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <ArrowLeftRight className="h-5 w-5 text-cyan-400" />
                <h3 className="font-semibold text-sm">Request Equipment Transfer</h3>
              </div>
              <button onClick={() => setShowRequestModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTransfer} className="p-6 space-y-3.5 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl">
                  {formError}
                </div>
              )}

              {/* Source & Destination Labs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Source Laboratory *</label>
                  <select
                    value={sourceLab}
                    onChange={(e) => setSourceLab(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600 font-medium"
                  >
                    {labs.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Destination Laboratory *</label>
                  <select
                    value={destLab}
                    onChange={(e) => setDestLab(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600 font-medium"
                  >
                    {labs.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Item Type Toggle */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Equipment Tracking Type</label>
                <div className="flex space-x-4">
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="itemType"
                      checked={itemType === 'bulk'}
                      onChange={() => setItemType('bulk')}
                      className="text-navy-900 focus:ring-navy-600"
                    />
                    <span className="font-medium text-slate-800">Bulk Stock (Quantity Tracked)</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="itemType"
                      checked={itemType === 'asset'}
                      onChange={() => setItemType('asset')}
                      className="text-navy-900 focus:ring-navy-600"
                    />
                    <span className="font-medium text-slate-800">Serialized Asset (Individual)</span>
                  </label>
                </div>
              </div>

              {/* Item Picker */}
              {itemType === 'asset' ? (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Select Asset in Source Lab *</label>
                  <select
                    value={selectedAssetId}
                    onChange={(e) => setSelectedAssetId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-[11px]"
                  >
                    <option value="">-- Choose active serialized asset --</option>
                    {sourceAssets.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.asset_id} &bull; {a.name} ({a.status})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">Select Bulk Inventory Item *</label>
                    <select
                      value={selectedBulkId}
                      onChange={(e) => setSelectedBulkId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium"
                    >
                      <option value="">-- Choose bulk stock --</option>
                      {sourceBulkItems.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name} (Available: {b.working_quantity} units)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Transfer Qty *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-center font-bold"
                    />
                  </div>
                </div>
              )}

              {/* Priority & Reason */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  >
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Transfer Justification / Reason *</label>
                  <input
                    type="text"
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Practical examination setup in Lab 2"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Optional Logistics Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Special handling instructions, temporary loan period, etc."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="bg-cyan-50/80 border border-cyan-200 rounded-xl p-3 flex items-start space-x-2.5">
                <ShieldCheck className="h-4 w-4 text-cyan-700 flex-shrink-0 mt-0.5" />
                <label className="flex items-center space-x-2 cursor-pointer text-slate-800 text-xs">
                  <input
                    type="checkbox"
                    checked={requiresPrincipalApproval}
                    onChange={(e) => setRequiresPrincipalApproval(e.target.checked)}
                    className="rounded text-cyan-600 focus:ring-cyan-500 h-4 w-4"
                  />
                  <span>
                    <strong>Requires Principal Executive Sanction</strong> (Multi-tier: HOD Tejaswini H endorsement &rarr; Principal Dr. Nagaraj Bhat approval with real-time email dispatch)
                  </span>
                </label>
              </div>

              <div className="pt-2 flex justify-between items-center border-t border-slate-200">
                <label className="flex items-center space-x-1.5 cursor-pointer text-slate-600">
                  <input
                    type="checkbox"
                    checked={isDraft}
                    onChange={(e) => setIsDraft(e.target.checked)}
                    className="rounded text-navy-900"
                  />
                  <span>Save as Draft</span>
                </label>

                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowRequestModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-xl font-semibold shadow-xs"
                  >
                    {isDraft ? 'Save Draft' : 'Submit Transfer'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: TRANSFER DETAILS & TIMELINE AUDIT               */}
      {/* ======================================================== */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
            <div className="bg-navy-900 text-white p-4 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-sm">Transfer Audit Record: {selectedDetail.request_number}</h3>
                <p className="text-[10px] text-slate-400">Inter-Lab Relocation Lifecycle Log</p>
              </div>
              <button onClick={() => setSelectedDetail(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              {/* Quick Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px]">Status:</span>
                  <div className="mt-0.5">{getStatusBadge(selectedDetail.status)}</div>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Source Lab:</span>
                  <span className="font-semibold text-slate-800 block mt-0.5">{selectedDetail.source_lab_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Destination Lab:</span>
                  <span className="font-semibold text-slate-800 block mt-0.5">{selectedDetail.destination_lab_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Item Description:</span>
                  <span className="font-bold text-slate-900 block mt-0.5">
                    {selectedDetail.asset_custom_id ? `${selectedDetail.asset_custom_id} (${selectedDetail.asset_name})` : `${selectedDetail.bulk_item_name} (${selectedDetail.quantity} Units)`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Requester:</span>
                  <span className="font-medium text-slate-800 block mt-0.5">{selectedDetail.requested_by_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Priority:</span>
                  <span className="font-semibold text-slate-800 block mt-0.5">{selectedDetail.priority}</span>
                </div>
              </div>

              {/* Reason */}
              <div>
                <span className="font-semibold text-slate-700 block mb-1">Transfer Justification</span>
                <p className="p-3 bg-white border border-slate-200 rounded-xl text-slate-800 leading-relaxed">
                  {selectedDetail.reason}
                </p>
              </div>

              {/* Dispatch & Receipt Details */}
              {(selectedDetail.dispatched_at || selectedDetail.received_at) && (
                <div className="grid grid-cols-2 gap-3 bg-indigo-50/40 p-3.5 rounded-xl border border-indigo-100 text-[11px]">
                  <div>
                    <span className="font-bold text-indigo-950 block">Dispatch Confirmation</span>
                    <span className="text-slate-600 block mt-0.5">
                      By: <strong>{selectedDetail.dispatched_by_name || 'Staff'}</strong>
                    </span>
                    <span className="text-slate-500 text-[10px] block">
                      {selectedDetail.dispatched_at ? new Date(selectedDetail.dispatched_at).toLocaleString() : 'Pending'}
                    </span>
                    {selectedDetail.dispatch_notes && (
                      <p className="text-slate-700 italic mt-1 bg-white p-1 rounded border border-indigo-100">
                        "{selectedDetail.dispatch_notes}"
                      </p>
                    )}
                  </div>

                  <div>
                    <span className="font-bold text-indigo-950 block">Receipt Confirmation</span>
                    <span className="text-slate-600 block mt-0.5">
                      By: <strong>{selectedDetail.received_by_name || 'Staff'}</strong>
                    </span>
                    <span className="text-slate-500 text-[10px] block">
                      {selectedDetail.received_at ? new Date(selectedDetail.received_at).toLocaleString() : 'Pending'}
                    </span>
                    {selectedDetail.receipt_condition && (
                      <span className="inline-block mt-1 font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[10px]">
                        Condition: {selectedDetail.receipt_condition}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Approval Decisions */}
              {selectedDetail.approval_decisions && selectedDetail.approval_decisions.length > 0 && (
                <div className="border-t border-slate-200 pt-3">
                  <h4 className="font-bold text-slate-900 text-sm mb-2 flex items-center space-x-1.5">
                    <ShieldCheck className="h-4 w-4 text-navy-800" />
                    <span>Formal Approval Decisions</span>
                  </h4>
                  <div className="space-y-2">
                    {selectedDetail.approval_decisions.map(d => (
                      <div key={d.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-[11px]">
                        <div>
                          <span className="font-bold text-slate-900">{d.stage}: {d.decision}</span>
                          <span className="text-slate-600 block">By {d.approver_name} ({d.role_at_approval})</span>
                          {d.comments && <p className="text-slate-500 italic mt-0.5">"{d.comments}"</p>}
                        </div>
                        <span className="text-[10px] text-slate-400">{new Date(d.created_at).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status History Timeline */}
              <div className="border-t border-slate-200 pt-3">
                <h4 className="font-bold text-slate-900 text-sm mb-2 flex items-center space-x-1.5">
                  <Clock className="h-4 w-4 text-navy-800" />
                  <span>Transfer Lifecycle History</span>
                </h4>
                {selectedDetail.status_history && selectedDetail.status_history.length > 0 ? (
                  <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {selectedDetail.status_history.map(hist => (
                      <div key={hist.id} className="relative">
                        <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-navy-600 border-2 border-white shadow-xs" />
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-900">{hist.action}</span>
                            <span className="text-[10px] text-slate-400">{new Date(hist.created_at).toLocaleString()}</span>
                          </div>
                          <div className="text-[11px] text-slate-600 mt-0.5">
                            By <strong>{hist.user_name || 'System'}</strong>
                          </div>
                          {hist.reason && (
                            <p className="text-[11px] text-slate-700 italic mt-1 bg-white p-1.5 rounded border border-slate-100">
                              "{hist.reason}"
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic">No historical transitions recorded yet.</p>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setSelectedDetail(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: APPROVE / REJECT TRANSFER (HOD/Principal)       */}
      {/* ======================================================== */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className={`p-4 flex justify-between items-center text-white ${
              isPrincipal ? 'bg-gradient-to-r from-[#170C3A] via-[#241457] to-[#120B30] border-b border-purple-500/30' : 'bg-navy-900'
            }`}>
              <div>
                <h3 className="font-bold text-sm flex items-center space-x-1.5">
                  <ShieldCheck className={`h-4 w-4 ${isPrincipal ? 'text-purple-400' : 'text-cyan-400'}`} />
                  <span>
                    {isPrincipal ? 'Principal Executive Sanction Desk' : 'Departmental HOD Review Desk'}
                  </span>
                </h3>
                <p className="text-[10px] text-slate-300 font-mono mt-0.5">
                  Transfer Request: {showApprovalModal.request_number}
                </p>
              </div>
              <button onClick={() => setShowApprovalModal(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              {approvalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-medium">
                  {approvalError}
                </div>
              )}

              {/* Anti-self-approval notice */}
              {user?.id === showApprovalModal.requested_by_id && !isAdmin && (
                <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl">
                  <strong>Conflict of Interest Guard:</strong> You created this transfer request and cannot approve it yourself. An independent administrator must review.
                </div>
              )}

              {/* Transfer Details Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5 text-slate-700">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Equipment:</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {showApprovalModal.asset_custom_id ? `${showApprovalModal.asset_name} (${showApprovalModal.asset_custom_id})` : `${showApprovalModal.bulk_item_name} (Qty: ${showApprovalModal.quantity})`}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Route:</span>
                  <span className="font-semibold text-slate-800">
                    {showApprovalModal.source_lab_name} &rarr; {showApprovalModal.destination_lab_name}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Requester:</span>
                  <span className="font-medium text-slate-800">
                    {showApprovalModal.requested_by_name || `User #${showApprovalModal.requested_by_id}`} (Lab Instructor)
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Justification:</span>
                  <span className="text-slate-800 italic">"{showApprovalModal.reason}"</span>
                </div>
              </div>

              {/* Two-Tier Institutional Status Banner */}
              {showApprovalModal.requires_principal_approval && (
                <div className="bg-gradient-to-br from-slate-50 to-indigo-50/40 border border-indigo-200/80 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-[11px]">Multi-Tier Institutional Workflow:</span>
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 font-semibold px-2 py-0.5 rounded-full">
                      {showApprovalModal.hod_approval_status === 'Approved' ? 'Stage 2 of 2: Executive Approval' : 'Stage 1 of 2: HOD Endorsement'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className={`p-2 rounded-lg border ${
                      showApprovalModal.hod_approval_status === 'Approved' 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-medium' 
                        : showApprovalModal.hod_approval_status === 'Rejected'
                        ? 'bg-rose-50 text-rose-800 border-rose-300'
                        : 'bg-amber-50 text-amber-800 border-amber-300'
                    }`}>
                      <div className="font-bold">1. HOD Endorsement</div>
                      <div className="text-[10px] mt-0.5">{showApprovalModal.hod_approval_status}</div>
                      {showApprovalModal.hod_remarks && (
                        <div className="text-[10px] text-emerald-700 italic mt-0.5 truncate">
                          "{showApprovalModal.hod_remarks}"
                        </div>
                      )}
                    </div>

                    <div className={`p-2 rounded-lg border ${
                      showApprovalModal.principal_approval_status === 'Approved'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-medium'
                        : showApprovalModal.principal_approval_status === 'Rejected'
                        ? 'bg-rose-50 text-rose-800 border-rose-300'
                        : 'bg-purple-50 text-purple-800 border-purple-300'
                    }`}>
                      <div className="font-bold">2. Principal Sanction</div>
                      <div className="text-[10px] mt-0.5">{showApprovalModal.principal_approval_status}</div>
                    </div>
                  </div>

                  {isPrincipal && showApprovalModal.requires_hod_approval && showApprovalModal.hod_approval_status !== 'Approved' && (
                    <div className="text-[11px] text-amber-800 bg-amber-100/70 p-2 rounded-lg border border-amber-300">
                      ⚠️ <strong>Security Notice:</strong> Department HOD endorsement is required before Principal executive sanction can be granted.
                    </div>
                  )}

                  {isPrincipal && showApprovalModal.hod_approval_status === 'Approved' && (
                    <div className="text-[11px] text-emerald-800 bg-emerald-100/70 p-2 rounded-lg border border-emerald-300 flex items-center space-x-1.5">
                      <CheckCircle className="h-4 w-4 text-emerald-700 flex-shrink-0" />
                      <span>Endorsed by HOD Tejaswini H. Ready for Principal Dr. Nagaraj Bhat official sanction.</span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-2">Review Decision</label>
                <div className="flex space-x-4">
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="appDecision"
                      checked={approvalDecision === 'Approved'}
                      onChange={() => setApprovalDecision('Approved')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="font-semibold text-emerald-800">
                      {isPrincipal ? 'Grant Executive Sanction' : 'Approve Transfer'}
                    </span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="appDecision"
                      checked={approvalDecision === 'Rejected'}
                      onChange={() => setApprovalDecision('Rejected')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span className="font-semibold text-rose-700">Reject Request</span>
                  </label>
                </div>
              </div>

              {approvalDecision === 'Approved' ? (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Approval Comments (Optional)</label>
                  <textarea
                    rows={2}
                    value={approvalRemarks}
                    onChange={(e) => setApprovalRemarks(e.target.value)}
                    placeholder={isPrincipal ? "e.g. Sanctioned by Principal Dr. Nagaraj Bhat for AI & DS academic laboratory..." : "e.g. Endorsed by HOD Tejaswini H..."}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    {isPrincipal 
                      ? '⚡ Approving will immediately dispatch an institutional email and celebratory alert popup to Lab Instructor Chitrakala.' 
                      : '⚡ Approving will dispatch an official notification and email to Principal Dr. Nagaraj Bhat for executive sanction.'}
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-rose-700 mb-1">Mandatory Rejection Reason *</label>
                  <textarea
                    rows={2}
                    required
                    value={approvalRejectionReason}
                    onChange={(e) => setApprovalRejectionReason(e.target.value)}
                    placeholder="Specify why transfer is disallowed..."
                    className="w-full px-3 py-2 border border-rose-300 rounded-xl text-rose-900"
                  />
                </div>
              )}

              <div className="pt-2 flex justify-end space-x-2 border-t border-slate-200">
                <button
                  onClick={() => setShowApprovalModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApprovalSubmit}
                  disabled={user?.id === showApprovalModal.requested_by_id && !isAdmin}
                  className={`px-4 py-2 text-white rounded-xl font-semibold transition ${
                    approvalDecision === 'Approved'
                      ? isPrincipal
                        ? 'bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 shadow-[0_0_12px_rgba(147,51,234,0.3)]'
                        : 'bg-emerald-700 hover:bg-emerald-800'
                      : 'bg-rose-600 hover:bg-rose-700'
                  } disabled:opacity-50`}
                >
                  {approvalDecision === 'Approved'
                    ? isPrincipal
                      ? 'Grant Official Sanction'
                      : 'Endorse & Forward'
                    : 'Submit Rejection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: DISPATCH CONFIRMATION                           */}
      {/* ======================================================== */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-navy-900 text-white p-4 flex justify-between items-center">
              <h3 className="font-semibold text-sm">Dispatch Equipment: {showDispatchModal.request_number}</h3>
              <button onClick={() => setShowDispatchModal(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-600">
                Confirm that the equipment has been packed and handed over for transit from <strong>{showDispatchModal.source_lab_name}</strong> to <strong>{showDispatchModal.destination_lab_name}</strong>.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Dispatch Remarks / Courier Notes</label>
                <textarea
                  rows={2}
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  placeholder="e.g. Handed to lab attendant Mr. Mahesh for room 205 delivery..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  onClick={() => setShowDispatchModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDispatchSubmit}
                  className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl font-semibold"
                >
                  Confirm Dispatch
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: RECEIVE & CONFIRM RECEIPT                       */}
      {/* ======================================================== */}
      {showReceiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-navy-900 text-white p-4 flex justify-between items-center">
              <h3 className="font-semibold text-sm">Confirm Receipt: {showReceiveModal.request_number}</h3>
              <button onClick={() => setShowReceiveModal(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-600">
                Please physically inspect the received items in <strong>{showReceiveModal.destination_lab_name}</strong>. Confirming receipt will permanently update the inventory ledger.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-2">Physical Condition Upon Arrival</label>
                <div className="grid grid-cols-3 gap-2">
                  <label className="flex items-center space-x-1.5 p-2 rounded-lg border border-slate-200 cursor-pointer bg-slate-50">
                    <input
                      type="radio"
                      name="recCondition"
                      checked={receiveCondition === 'Good'}
                      onChange={() => setReceiveCondition('Good')}
                      className="text-emerald-600"
                    />
                    <span className="font-semibold text-emerald-800">Good</span>
                  </label>
                  <label className="flex items-center space-x-1.5 p-2 rounded-lg border border-slate-200 cursor-pointer bg-slate-50">
                    <input
                      type="radio"
                      name="recCondition"
                      checked={receiveCondition === 'Damaged'}
                      onChange={() => setReceiveCondition('Damaged')}
                      className="text-rose-600"
                    />
                    <span className="font-semibold text-rose-800">Damaged</span>
                  </label>
                  <label className="flex items-center space-x-1.5 p-2 rounded-lg border border-slate-200 cursor-pointer bg-slate-50">
                    <input
                      type="radio"
                      name="recCondition"
                      checked={receiveCondition === 'Discrepancy'}
                      onChange={() => setReceiveCondition('Discrepancy')}
                      className="text-amber-600"
                    />
                    <span className="font-semibold text-amber-800">Discrepancy</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Receipt Remarks / Discrepancy Notes</label>
                <textarea
                  rows={2}
                  value={discrepancyNotes}
                  onChange={(e) => setDiscrepancyNotes(e.target.value)}
                  placeholder="e.g. Received 2 working keyboards intact at instructor desk..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  onClick={() => setShowReceiveModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReceiveSubmit}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-semibold"
                >
                  Confirm & Relocate Stock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 6: STOCK MOVEMENT LEDGER                           */}
      {/* ======================================================== */}
      {showLedgerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200">
            <div className="bg-navy-900 text-white p-4 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-cyan-400" />
                <h3 className="font-semibold text-sm">SMVITM Stock Movement Audit Ledger</h3>
              </div>
              <button onClick={() => setShowLedgerModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              <p className="text-slate-500">
                Immutable chronological log of all stock and serialized asset relocations across college laboratories.
              </p>

              {stockLedger.length === 0 ? (
                <p className="text-slate-400 italic text-center py-6">No stock movements logged yet.</p>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Date & Time</th>
                        <th className="py-2.5 px-3">Item & Type</th>
                        <th className="py-2.5 px-3">Movement</th>
                        <th className="py-2.5 px-3">Qty</th>
                        <th className="py-2.5 px-3">Ref / Reason</th>
                        <th className="py-2.5 px-3">Authorized By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stockLedger.map(m => (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">
                            {new Date(m.timestamp).toLocaleDateString()} {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-bold text-slate-900 block">{m.item_name}</span>
                            <span className="text-[10px] text-slate-400">{m.item_type}</span>
                          </td>
                          <td className="py-2 px-3">
                            <span className="text-slate-600">
                              {m.from_lab_name || 'Procured / External'} &rarr; {m.to_lab_name || 'Retired'}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-bold text-slate-800">{m.quantity}</td>
                          <td className="py-2 px-3 text-slate-600">
                            <span className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded">{m.reference_id || m.reference_type}</span>
                            {m.notes && <span className="block text-[10px] text-slate-500 mt-0.5">{m.notes}</span>}
                          </td>
                          <td className="py-2 px-3 font-medium text-slate-700">{m.user_name || 'Staff'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setShowLedgerModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
