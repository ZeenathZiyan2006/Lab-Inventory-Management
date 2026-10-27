import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import {
  ShoppingCart,
  Plus,
  ShieldCheck,
  PackageCheck,
  CheckCircle,
  XCircle,
  Clock,
  X,
  Search,
  Filter,
  Download,
  AlertTriangle,
  Eye,
  RefreshCw,
  FileText,
  DollarSign,
  Truck,
  Paperclip,
  CheckCircle2,
  Trash2,
  AlertOctagon,
  ArrowRight
} from 'lucide-react';

export const PURCHASE_TYPES = ['New Purchase', 'Replenishment', 'Replacement'];

export const PURCHASE_STATUSES = [
  'Pending Approval',
  'Under Review',
  'Approved',
  'Ordered',
  'Partially Received',
  'Received',
  'Closed',
  'Rejected',
  'More Info Requested',
  'Cancelled'
];

interface ApprovalDecision {
  id: number;
  purchase_id: number;
  approver_id: number;
  approver_name?: string;
  role_at_approval: string;
  stage: string;
  decision: string;
  comments?: string;
  created_at: string;
}

interface GoodsReceipt {
  id: number;
  purchase_id: number;
  received_by_id: number;
  received_by_name?: string;
  quantity_received: number;
  condition_received: string;
  notes?: string;
  created_at: string;
}

interface StatusHistory {
  id: number;
  purchase_id: number;
  user_id?: number;
  user_name?: string;
  previous_status?: string;
  new_status: string;
  action?: string;
  reason?: string;
  created_at: string;
}

interface PurchaseItem {
  id: number;
  request_number: string;
  request_type: string;
  item_name: string;
  description?: string;
  category: string;
  lab_id: number;
  lab_name?: string;
  quantity: number;
  unit: string;
  estimated_unit_cost?: number;
  estimated_total_cost?: number;
  estimated_cost?: number;
  justification: string;
  linked_fault_id?: number;
  linked_asset_id?: number;
  linked_asset_custom_id?: string;
  requested_by_id: number;
  requested_by_name?: string;
  supplier_name?: string;
  supplier_contact?: string;
  quotation_ref?: string;
  attachment_url?: string;
  status: string;
  hod_approved_by_id?: number;
  hod_approved_by_name?: string;
  hod_approval_status: string;
  hod_remarks?: string;
  principal_approved_by_id?: number;
  principal_approved_by_name?: string;
  principal_approval_status: string;
  principal_remarks?: string;
  rejection_reason?: string;
  more_info_notes?: string;
  po_number?: string;
  ordered_by_id?: number;
  ordered_by_name?: string;
  ordered_at?: string;
  ordered_cost?: number;
  expected_delivery_date?: string;
  order_notes?: string;
  quantity_received: number;
  quantity_outstanding: number;
  procured_by_id?: number;
  procured_at?: string;
  created_at: string;
  updated_at: string;
  approval_decisions?: ApprovalDecision[];
  goods_receipts?: GoodsReceipt[];
  status_history?: StatusHistory[];
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
  status: string;
}

export const RequestsPage: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<PurchaseItem[]>([]);
  const [labs, setLabs] = useState<Laboratory[]>([]);
  const [labAssets, setLabAssets] = useState<AssetOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [labFilter, setLabFilter] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<PurchaseItem | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState<PurchaseItem | null>(null);
  const [showPOModal, setShowPOModal] = useState<PurchaseItem | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState<PurchaseItem | null>(null);
  const [showRetireModal, setShowRetireModal] = useState<PurchaseItem | null>(null);

  // --- Create Form State ---
  const [requestType, setRequestType] = useState('New Purchase');
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [category, setCategory] = useState('Computing');
  const [labId, setLabId] = useState(1);
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('Units');
  const [unitCost, setUnitCost] = useState<number | ''>('');
  const [justification, setJustification] = useState('');
  const [linkedFaultId, setLinkedFaultId] = useState<number | ''>('');
  const [linkedAssetId, setLinkedAssetId] = useState<number | ''>('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierContact, setSupplierContact] = useState('');
  const [quotationRef, setQuotationRef] = useState('');
  const [uploadedDocUrl, setUploadedDocUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // --- Approval State ---
  const [approvalDecision, setApprovalDecision] = useState<'Approved' | 'Rejected' | 'More Info Requested'>('Approved');
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [approvalRejectionReason, setApprovalRejectionReason] = useState('');
  const [approvalError, setApprovalError] = useState<string | null>(null);

  // --- Purchase Order State ---
  const [poNumber, setPoNumber] = useState('');
  const [poSupplier, setPoSupplier] = useState('');
  const [poCost, setPoCost] = useState<number | ''>('');
  const [poDeliveryDate, setPoDeliveryDate] = useState('');
  const [poNotes, setPoNotes] = useState('');

  // --- Goods Receipt State ---
  const [receiveQty, setReceiveQty] = useState(1);
  const [receiveCondition, setReceiveCondition] = useState('Satisfactory / Working');
  const [receiveNotes, setReceiveNotes] = useState('');
  const [isSerializedEquipment, setIsSerializedEquipment] = useState(false);
  const [serialNumbersText, setSerialNumbersText] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');

  // --- Retirement State ---
  const [retireReason, setRetireReason] = useState('');

  const isHOD = user?.role === 'HOD';
  const isPrincipal = user?.role === 'PRINCIPAL';
  const isAdmin = user?.role === 'ADMIN';
  const isApprover = isHOD || isPrincipal || isAdmin;

  useEffect(() => {
    loadLabs();
    loadRequests();
  }, []);

  useEffect(() => {
    if (showCreateModal && labId) {
      loadLabAssets(labId);
    }
  }, [showCreateModal, labId]);

  // Global Escape key listener to close active purchase request modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowCreateModal(false);
        setSelectedDetail(null);
        setShowApprovalModal(null);
        setShowPOModal(null);
        setShowReceiptModal(null);
        setShowRetireModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadLabs = async () => {
    try {
      const data = await apiRequest<Laboratory[]>('/labs');
      setLabs(data);
      if (data.length > 0 && !labId) {
        setLabId(data[0].id);
      }
    } catch (err) {
      console.warn('Could not load labs:', err);
    }
  };

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<PurchaseItem[]>('/requests');
      setRequests(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadLabAssets = async (labId: number) => {
    try {
      const res = await apiRequest<{ items: AssetOption[] }>(`/inventory/assets?lab_id=${labId}&page_size=100`);
      setLabAssets(res.items || []);
    } catch (err) {
      console.warn('Could not load lab assets:', err);
    }
  };

  const handleQuotationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiRequest<{ attachment_url: string }>('/requests/upload-quotation', {
        method: 'POST',
        body: formData
      });
      setUploadedDocUrl(res.attachment_url);
    } catch (err: any) {
      alert(`Quotation upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const calculatedTotalEstimate = Number(quantity || 1) * Number(unitCost || 0);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!itemName.trim()) {
      setFormError('Item name is required.');
      return;
    }

    try {
      await apiRequest('/requests', {
        method: 'POST',
        body: JSON.stringify({
          request_type: requestType,
          item_name: itemName.trim(),
          description: itemDescription.trim() || undefined,
          category,
          lab_id: Number(labId),
          quantity: Number(quantity),
          unit,
          estimated_unit_cost: unitCost ? Number(unitCost) : undefined,
          justification: justification.trim(),
          linked_fault_id: linkedFaultId ? Number(linkedFaultId) : undefined,
          linked_asset_id: linkedAssetId ? Number(linkedAssetId) : undefined,
          supplier_name: supplierName.trim() || undefined,
          supplier_contact: supplierContact.trim() || undefined,
          quotation_ref: quotationRef.trim() || undefined,
          attachment_url: uploadedDocUrl || undefined,
          is_draft: isDraft
        })
      });

      setShowCreateModal(false);
      resetCreateForm();
      loadRequests();
    } catch (err: any) {
      setFormError(err.message || 'Request creation failed.');
    }
  };

  const resetCreateForm = () => {
    setItemName('');
    setItemDescription('');
    setQuantity(1);
    setUnitCost('');
    setJustification('');
    setLinkedFaultId('');
    setLinkedAssetId('');
    setSupplierName('');
    setQuotationRef('');
    setUploadedDocUrl(null);
    setIsDraft(false);
  };

  const handleApprovalSubmit = async () => {
    if (!showApprovalModal) return;
    setApprovalError(null);

    // Anti-self-approval guard check
    if (user?.id === showApprovalModal.requested_by_id && !isAdmin) {
      setApprovalError('Conflict of Interest: You cannot approve your own purchase request.');
      return;
    }

    if (approvalDecision === 'Rejected' && (!approvalRejectionReason || approvalRejectionReason.trim().length < 5)) {
      setApprovalError('A detailed rejection reason (minimum 5 characters) is required.');
      return;
    }

    try {
      await apiRequest(`/requests/${showApprovalModal.id}/approve`, {
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
      loadRequests();
    } catch (err: any) {
      setApprovalError(err.message || 'Approval submission failed.');
    }
  };

  const handlePlacePOSubmit = async () => {
    if (!showPOModal) return;
    if (!poNumber.trim() || !poSupplier.trim() || !poCost) {
      alert('Please fill in the PO Number, Supplier Name, and Ordered Cost.');
      return;
    }

    try {
      await apiRequest(`/requests/${showPOModal.id}/order`, {
        method: 'POST',
        body: JSON.stringify({
          po_number: poNumber.trim(),
          supplier_name: poSupplier.trim(),
          ordered_cost: Number(poCost),
          expected_delivery_date: poDeliveryDate || undefined,
          order_notes: poNotes.trim() || undefined
        })
      });

      setShowPOModal(null);
      setPoNumber('');
      setPoSupplier('');
      setPoCost('');
      setPoDeliveryDate('');
      setPoNotes('');
      loadRequests();
    } catch (err: any) {
      alert(`PO placement failed: ${err.message}`);
    }
  };

  const handleGoodsReceiptSubmit = async () => {
    if (!showReceiptModal) return;

    const serials = isSerializedEquipment && serialNumbersText.trim()
      ? serialNumbersText.split(',').map(s => s.trim()).filter(Boolean)
      : undefined;

    try {
      await apiRequest(`/requests/${showReceiptModal.id}/receive`, {
        method: 'POST',
        body: JSON.stringify({
          quantity_received: Number(receiveQty),
          condition_received: receiveCondition,
          notes: receiveNotes.trim() || undefined,
          serial_numbers: serials,
          manufacturer: manufacturer.trim() || undefined,
          model: model.trim() || undefined
        })
      });

      setShowReceiptModal(null);
      setReceiveQty(1);
      setReceiveNotes('');
      setSerialNumbersText('');
      loadRequests();
    } catch (err: any) {
      alert(`Goods receipt failed: ${err.message}`);
    }
  };

  const handleRetireAssetSubmit = async () => {
    if (!showRetireModal || !showRetireModal.linked_asset_id) return;
    if (!retireReason.trim() || retireReason.trim().length < 5) {
      alert('A detailed retirement justification (minimum 5 characters) is required.');
      return;
    }

    try {
      await apiRequest(`/requests/assets/${showRetireModal.linked_asset_id}/retire`, {
        method: 'POST',
        body: JSON.stringify({ retirement_reason: retireReason.trim() })
      });

      setShowRetireModal(null);
      setRetireReason('');
      alert('Asset decommissioned and formally retired from service.');
      loadRequests();
    } catch (err: any) {
      alert(`Asset retirement failed: ${err.message}`);
    }
  };

  const handleExportCSV = async () => {
    try {
      const blob = await apiRequest('/requests/export-csv');
      const url = window.URL.createObjectURL(blob as any);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SMVITM_Purchase_Requests_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  // Filtered requests
  const filteredRequests = requests.filter(r => {
    if (typeFilter && r.request_type !== typeFilter) return false;
    if (statusFilter && r.status !== statusFilter) return false;
    if (labFilter && r.lab_id !== Number(labFilter)) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchNum = r.request_number.toLowerCase().includes(q);
      const matchItem = r.item_name.toLowerCase().includes(q);
      const matchJust = r.justification.toLowerCase().includes(q);
      const matchSup = (r.supplier_name || '').toLowerCase().includes(q);
      const matchPO = (r.po_number || '').toLowerCase().includes(q);
      if (!matchNum && !matchItem && !matchJust && !matchSup && !matchPO) return false;
    }
    return true;
  });

  // KPI Calculations
  const totalRequests = requests.length;
  const pendingApprovals = requests.filter(r => r.status === 'Pending Approval' || r.status === 'Under Review').length;
  const inProcurement = requests.filter(r => r.status === 'Approved' || r.status === 'Ordered' || r.status === 'Partially Received').length;
  const completedReceipts = requests.filter(r => r.status === 'Received' || r.status === 'Closed').length;

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'Pending Approval':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200"><Clock className="h-3 w-3 mr-1" /> Pending HOD</span>;
      case 'Under Review':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 animate-pulse"><ShieldCheck className="h-3 w-3 mr-1" /> Principal Review</span>;
      case 'Approved':
      case 'Awaiting Procurement':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800 border border-blue-200"><CheckCircle className="h-3 w-3 mr-1" /> Approved for PO</span>;
      case 'Ordered':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200"><Truck className="h-3 w-3 mr-1" /> PO Placed</span>;
      case 'Partially Received':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">Partially Received</span>;
      case 'Received':
      case 'Procured':
      case 'Closed':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200"><PackageCheck className="h-3 w-3 mr-1" /> Received & Commissioned</span>;
      case 'Rejected':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200"><XCircle className="h-3 w-3 mr-1" /> Rejected</span>;
      case 'More Info Requested':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-800 border border-sky-200">Info Requested</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">{s}</span>;
    }
  };

  const getTypeBadge = (t: string) => {
    switch (t) {
      case 'Replacement':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200">Replacement</span>;
      case 'Replenishment':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">Replenishment</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">New Purchase</span>;
    }
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-navy-50 rounded-xl text-navy-900 border border-navy-100">
              <ShoppingCart className="h-5 w-5 text-navy-800" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-navy-900 tracking-tight">
                Purchase & Replacement Requests
              </h1>
              <p className="text-xs text-slate-500">
                Institutional Procurement, Multi-Tier Approvals & Commissioning &bull; SMVITM
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => {
              setShowCreateModal(true);
              setFormError(null);
            }}
            className="flex items-center space-x-1.5 bg-navy-900 hover:bg-navy-800 text-white px-4 py-2 rounded-xl text-xs font-semibold transition shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>New Purchase Request</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 block">Total Requests</span>
            <span className="text-2xl font-bold text-navy-900">{totalRequests}</span>
          </div>
          <div className="p-2.5 bg-slate-50 text-navy-800 rounded-xl">
            <ShoppingCart className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 block">Awaiting Sanction</span>
            <span className="text-2xl font-bold text-amber-700">{pendingApprovals}</span>
          </div>
          <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 block">In Procurement / Ordered</span>
            <span className="text-2xl font-bold text-indigo-700">{inProcurement}</span>
          </div>
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
            <Truck className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 block">Received & Commissioned</span>
            <span className="text-2xl font-bold text-emerald-700">{completedReceipts}</span>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
            <PackageCheck className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div className="relative sm:col-span-1">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by request #, item, PO #, or vendor..."
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600"
            />
          </div>

          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
            >
              <option value="">All Request Types</option>
              {PURCHASE_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
            >
              <option value="">All Workflow Statuses</option>
              {PURCHASE_STATUSES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={labFilter}
              onChange={(e) => setLabFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
            >
              <option value="">All Laboratories</option>
              {labs.map(l => (
                <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-400" />
            Loading purchase requests...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <ShoppingCart className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700 text-sm">No Purchase Requests Found</p>
            <p className="text-slate-400 mt-0.5">Click "New Purchase Request" to initiate procurement.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">Request # & Type</th>
                  <th className="py-3 px-4">Item & Target Lab</th>
                  <th className="py-3 px-4">Qty & Cost (INR)</th>
                  <th className="py-3 px-4">PO & Supplier</th>
                  <th className="py-3 px-4">Status & Receipts</th>
                  <th className="py-3 px-4 text-right">Workflow Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-navy-900">
                      {req.request_number}
                      <div className="mt-1">{getTypeBadge(req.request_type)}</div>
                      <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                        {new Date(req.created_at).toLocaleDateString()} &bull; {req.requested_by_name || 'Staff'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 block">{req.item_name}</span>
                      <span className="text-slate-500 text-[11px] block">{req.category}</span>
                      <span className="inline-block mt-1 px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">
                        {req.lab_name || `Lab ${req.lab_id}`}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">
                        {req.quantity} {req.unit}
                      </div>
                      <div className="text-emerald-800 font-semibold text-[11px] mt-0.5">
                        {req.estimated_total_cost ? `₹${req.estimated_total_cost.toLocaleString()}` : (req.estimated_cost ? `₹${req.estimated_cost.toLocaleString()}` : 'Cost pending')}
                      </div>
                      {req.estimated_unit_cost && (
                        <span className="text-[10px] text-slate-400 block">@ ₹{req.estimated_unit_cost.toLocaleString()} each</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {req.po_number ? (
                        <div>
                          <span className="font-mono font-bold text-indigo-900 block">{req.po_number}</span>
                          <span className="text-slate-600 text-[11px] block">{req.supplier_name}</span>
                          {req.ordered_cost && <span className="text-[10px] text-slate-500 font-semibold">PO Total: ₹{req.ordered_cost.toLocaleString()}</span>}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">PO Not Placed</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div>{getStatusBadge(req.status)}</div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        Received: <strong>{req.quantity_received}</strong> / {req.quantity} {req.unit}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                      {/* Details Button */}
                      <button
                        onClick={async () => {
                          try {
                            const full = await apiRequest<PurchaseItem>(`/requests/${req.id}`);
                            setSelectedDetail(full);
                          } catch {
                            setSelectedDetail(req);
                          }
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-medium transition"
                      >
                        <Eye className="h-3 w-3 inline mr-1" />
                        Details
                      </button>

                      {/* Approver Review (HOD / Principal) */}
                      {isApprover && (req.status === 'Pending Approval' || req.status === 'Under Review') && (
                        <button
                          onClick={() => {
                            setShowApprovalModal(req);
                            setApprovalDecision('Approved');
                            setApprovalRemarks('');
                            setApprovalRejectionReason('');
                            setApprovalError(null);
                          }}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg text-[11px] font-semibold transition"
                        >
                          <ShieldCheck className="h-3 w-3 inline mr-1" />
                          Sanction
                        </button>
                      )}

                      {/* Place Purchase Order (PO) */}
                      {(req.status === 'Approved' || req.status === 'Awaiting Procurement') && (
                        <button
                          onClick={() => {
                            setShowPOModal(req);
                            setPoNumber(`PO-SMVITM-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
                            setPoSupplier(req.supplier_name || '');
                            setPoCost(req.estimated_total_cost || req.estimated_cost || '');
                            setPoDeliveryDate('');
                            setPoNotes('');
                          }}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-lg text-[11px] font-semibold transition"
                        >
                          <Truck className="h-3 w-3 inline mr-1" />
                          Place PO
                        </button>
                      )}

                      {/* Goods Receipt (Receive Items) */}
                      {(req.status === 'Ordered' || req.status === 'Partially Received') && (
                        <button
                          onClick={() => {
                            setShowReceiptModal(req);
                            setReceiveQty(req.quantity_outstanding || 1);
                            setReceiveCondition('Satisfactory / Working');
                            setReceiveNotes('');
                            setSerialNumbersText('');
                            setIsSerializedEquipment(req.category === 'Computing' || req.category === 'Networking');
                          }}
                          className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold transition shadow-xs"
                        >
                          <PackageCheck className="h-3 w-3 inline mr-1" />
                          Receive
                        </button>
                      )}

                      {/* Retire Old Asset (If Replacement) */}
                      {req.request_type === 'Replacement' && req.linked_asset_id && (
                        <button
                          onClick={() => {
                            setShowRetireModal(req);
                            setRetireReason('');
                          }}
                          className="px-2 py-1 bg-orange-50 hover:bg-orange-100 text-orange-800 rounded-lg text-[11px] font-semibold transition"
                        >
                          Retire Old
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: NEW PURCHASE / REPLACEMENT REQUEST              */}
      {/* ======================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200">
            <div className="bg-navy-900 text-white p-4 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <ShoppingCart className="h-5 w-5 text-cyan-400" />
                <h3 className="font-semibold text-sm">Create Equipment Purchase / Replacement Request</h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="p-6 space-y-3.5 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl">
                  {formError}
                </div>
              )}

              {/* Request Type Toggle */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Request Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {PURCHASE_TYPES.map(t => (
                    <label key={t} className={`flex items-center justify-center p-2 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                      requestType === t ? 'bg-navy-900 text-white border-navy-900' : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}>
                      <input
                        type="radio"
                        name="reqType"
                        value={t}
                        checked={requestType === t}
                        onChange={() => setRequestType(t)}
                        className="sr-only"
                      />
                      <span>{t}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* If Replacement: Link Asset and Fault */}
              {requestType === 'Replacement' && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl space-y-2">
                  <div className="flex items-center space-x-1.5 font-bold text-orange-950">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <span>Link Existing Asset & Maintenance Failure</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Target Asset to Replace</label>
                      <select
                        value={linkedAssetId}
                        onChange={(e) => setLinkedAssetId(e.target.value ? Number(e.target.value) : '')}
                        className="w-full px-2.5 py-1.5 border border-orange-300 rounded-lg bg-white font-mono text-[11px]"
                      >
                        <option value="">-- Choose asset --</option>
                        {labAssets.map(a => (
                          <option key={a.id} value={a.id}>{a.asset_id} ({a.name})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Linked Fault Ticket # (Optional)</label>
                      <input
                        type="number"
                        placeholder="e.g. 1"
                        value={linkedFaultId}
                        onChange={(e) => setLinkedFaultId(e.target.value ? Number(e.target.value) : '')}
                        className="w-full px-2.5 py-1.5 border border-orange-300 rounded-lg bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Item Name & Target Lab */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Item / Equipment Name *</label>
                  <input
                    type="text"
                    required
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="e.g. NVIDIA Jetson Orin Nano"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Laboratory *</label>
                  <select
                    value={labId}
                    onChange={(e) => setLabId(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium"
                  >
                    {labs.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quantity, Unit & Estimated Cost */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-center"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Unit of Measure</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="Units / Kits / Packs"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Estimated Unit Cost (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value ? Number(e.target.value) : '')}
                    placeholder="e.g. 45000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              {/* Auto calculated total */}
              {unitCost && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex justify-between items-center text-xs text-emerald-950">
                  <span className="font-semibold">Calculated Total Estimate:</span>
                  <span className="font-bold text-base text-emerald-800">₹{calculatedTotalEstimate.toLocaleString()}</span>
                </div>
              )}

              {/* Justification */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Academic & Laboratory Justification *</label>
                <textarea
                  rows={2}
                  required
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Explain why this equipment is needed for academic syllabus or lab capacity..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              {/* Supplier Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Supplier / Vendor Name (Optional)</label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="e.g. Robu.in Embedded Systems"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vendor Quotation Reference</label>
                  <input
                    type="text"
                    value={quotationRef}
                    onChange={(e) => setQuotationRef(e.target.value)}
                    placeholder="e.g. QT-ROBU-2026-90"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-[11px]"
                  />
                </div>
              </div>

              {/* Upload Quotation File */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Upload Vendor Quotation Document (Optional)</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,image/*"
                    onChange={handleQuotationUpload}
                    className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                  />
                  {isUploading && <span className="text-slate-400">Uploading...</span>}
                  {uploadedDocUrl && (
                    <span className="text-emerald-700 font-semibold flex items-center">
                      <CheckCircle className="h-3.5 w-3.5 mr-1" /> Quotation Uploaded
                    </span>
                  )}
                </div>
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
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-xl font-semibold shadow-xs"
                  >
                    {isDraft ? 'Save Draft' : 'Submit Request'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: PURCHASE DETAILS & AUDIT TIMELINE               */}
      {/* ======================================================== */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
            <div className="bg-navy-900 text-white p-4 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-sm">Purchase Request: {selectedDetail.request_number}</h3>
                <p className="text-[10px] text-slate-400">{selectedDetail.item_name} &bull; {selectedDetail.request_type}</p>
              </div>
              <button onClick={() => setSelectedDetail(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              {/* Overview grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px]">Status:</span>
                  <div className="mt-0.5">{getStatusBadge(selectedDetail.status)}</div>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Target Laboratory:</span>
                  <span className="font-semibold text-slate-800 block mt-0.5">{selectedDetail.lab_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Quantity Approved:</span>
                  <span className="font-bold text-slate-900 block mt-0.5">{selectedDetail.quantity} {selectedDetail.unit}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Estimated Total Cost:</span>
                  <span className="font-bold text-emerald-800 block mt-0.5">
                    ₹{(selectedDetail.estimated_total_cost || selectedDetail.estimated_cost || 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Requester:</span>
                  <span className="font-medium text-slate-800 block mt-0.5">{selectedDetail.requested_by_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Receipts Delivered:</span>
                  <span className="font-bold text-slate-800 block mt-0.5">
                    {selectedDetail.quantity_received} / {selectedDetail.quantity}
                  </span>
                </div>
              </div>

              {/* Justification */}
              <div>
                <span className="font-semibold text-slate-700 block mb-1">Justification</span>
                <p className="p-3 bg-white border border-slate-200 rounded-xl text-slate-800 leading-relaxed">
                  {selectedDetail.justification}
                </p>
              </div>

              {/* PO Info if Ordered */}
              {selectedDetail.po_number && (
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3.5 space-y-2">
                  <h4 className="font-bold text-indigo-950 flex items-center space-x-1.5">
                    <Truck className="h-4 w-4 text-indigo-600" />
                    <span>Purchase Order Details</span>
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500 block">PO Number:</span>
                      <span className="font-mono font-bold text-indigo-950">{selectedDetail.po_number}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Supplier:</span>
                      <span className="font-semibold text-slate-800">{selectedDetail.supplier_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">PO Cost Sanctioned:</span>
                      <span className="font-bold text-slate-900">₹{(selectedDetail.ordered_cost || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Goods Receipts Log */}
              {selectedDetail.goods_receipts && selectedDetail.goods_receipts.length > 0 && (
                <div className="border-t border-slate-200 pt-3">
                  <h4 className="font-bold text-slate-900 text-sm mb-2 flex items-center space-x-1.5">
                    <PackageCheck className="h-4 w-4 text-emerald-700" />
                    <span>Goods Receipts Log</span>
                  </h4>
                  <div className="space-y-1.5">
                    {selectedDetail.goods_receipts.map(g => (
                      <div key={g.id} className="p-2.5 bg-emerald-50/50 rounded-xl border border-emerald-100 flex justify-between items-center text-[11px]">
                        <div>
                          <span className="font-bold text-emerald-950">Received {g.quantity_received} units ({g.condition_received})</span>
                          <span className="text-slate-600 block">By {g.received_by_name || 'Staff'}</span>
                          {g.notes && <span className="text-slate-500 italic block mt-0.5">{g.notes}</span>}
                        </div>
                        <span className="text-[10px] text-slate-400">{new Date(g.created_at).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Approval Decisions */}
              {selectedDetail.approval_decisions && selectedDetail.approval_decisions.length > 0 && (
                <div className="border-t border-slate-200 pt-3">
                  <h4 className="font-bold text-slate-900 text-sm mb-2 flex items-center space-x-1.5">
                    <ShieldCheck className="h-4 w-4 text-navy-800" />
                    <span>Approval Records</span>
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
                  <span>Procurement Lifecycle History</span>
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
      {/* MODAL 3: REVIEW / APPROVE (HOD / Principal)              */}
      {/* ======================================================== */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-navy-900 text-white p-4 flex justify-between items-center">
              <h3 className="font-semibold text-sm">Sanction Request: {showApprovalModal.request_number}</h3>
              <button onClick={() => setShowApprovalModal(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              {approvalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl">
                  {approvalError}
                </div>
              )}

              {/* Anti-self-approval notice */}
              {user?.id === showApprovalModal.requested_by_id && !isAdmin && (
                <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl">
                  <strong>Conflict of Interest Guard:</strong> You created this purchase request and cannot approve it yourself.
                </div>
              )}

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 text-[11px]">
                <div><span className="text-slate-500">Item:</span> <strong>{showApprovalModal.item_name}</strong> ({showApprovalModal.quantity} {showApprovalModal.unit})</div>
                <div><span className="text-slate-500">Total Cost:</span> <strong className="text-emerald-800">₹{(showApprovalModal.estimated_total_cost || showApprovalModal.estimated_cost || 0).toLocaleString()}</strong></div>
                <div><span className="text-slate-500">Target Lab:</span> {showApprovalModal.lab_name}</div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-2">Review Decision</label>
                <div className="flex space-x-4">
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="reqDecision"
                      checked={approvalDecision === 'Approved'}
                      onChange={() => setApprovalDecision('Approved')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="font-semibold text-emerald-800">Approve Sanction</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="reqDecision"
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
                    placeholder="e.g. Sanctioned under departmental budget..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-rose-700 mb-1">Mandatory Rejection Reason *</label>
                  <textarea
                    rows={2}
                    required
                    value={approvalRejectionReason}
                    onChange={(e) => setApprovalRejectionReason(e.target.value)}
                    placeholder="Specify why request was rejected..."
                    className="w-full px-3 py-2 border border-rose-300 rounded-xl text-rose-900"
                  />
                </div>
              )}

              <div className="pt-2 flex justify-end space-x-2">
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
                    approvalDecision === 'Approved' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-rose-600 hover:bg-rose-700'
                  } disabled:opacity-50`}
                >
                  Submit Sanction
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: PLACE PURCHASE ORDER (PO)                       */}
      {/* ======================================================== */}
      {showPOModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-navy-900 text-white p-4 flex justify-between items-center">
              <h3 className="font-semibold text-sm">Place Purchase Order: {showPOModal.request_number}</h3>
              <button onClick={() => setShowPOModal(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-3.5 text-xs">
              <p className="text-slate-600">
                Record official college purchase order details before vendor delivery.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Purchase Order (PO) Number *</label>
                <input
                  type="text"
                  required
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Vendor / Supplier Name *</label>
                <input
                  type="text"
                  required
                  value={poSupplier}
                  onChange={(e) => setPoSupplier(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ordered Total Cost (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={poCost}
                    onChange={(e) => setPoCost(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Expected Delivery</label>
                  <input
                    type="date"
                    value={poDeliveryDate}
                    onChange={(e) => setPoDeliveryDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">PO Dispatch Notes</label>
                <textarea
                  rows={2}
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  placeholder="Terms of payment, discount codes, shipping carrier..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  onClick={() => setShowPOModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePlacePOSubmit}
                  className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl font-semibold"
                >
                  Save & Place PO
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: GOODS RECEIPT & COMMISSIONING                   */}
      {/* ======================================================== */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="bg-navy-900 text-white p-4 flex justify-between items-center">
              <h3 className="font-semibold text-sm">Goods Receipt & Commissioning: {showReceiptModal.request_number}</h3>
              <button onClick={() => setShowReceiptModal(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-3.5 text-xs max-h-[80vh] overflow-y-auto">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 flex justify-between items-center">
                <div>
                  <span className="font-bold block">{showReceiptModal.item_name}</span>
                  <span className="text-[11px]">Outstanding Quantity to Receive: {showReceiptModal.quantity_outstanding} {showReceiptModal.unit}</span>
                </div>
                <span className="font-bold text-sm">Lab {showReceiptModal.lab_id}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Delivered Qty *</label>
                  <input
                    type="number"
                    min="1"
                    max={showReceiptModal.quantity_outstanding}
                    required
                    value={receiveQty}
                    onChange={(e) => setReceiveQty(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-center"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Delivered Condition</label>
                  <select
                    value={receiveCondition}
                    onChange={(e) => setReceiveCondition(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium"
                  >
                    <option value="Satisfactory / Working">Satisfactory / Working</option>
                    <option value="Damaged Consignment">Damaged Consignment</option>
                  </select>
                </div>
              </div>

              {/* Serialized Commissioning Checkbox */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={isSerializedEquipment}
                    onChange={(e) => setIsSerializedEquipment(e.target.checked)}
                    className="rounded text-navy-900"
                  />
                  <span>Commission as Serialized Individual Asset(s)</span>
                </label>

                {isSerializedEquipment && (
                  <div className="space-y-2 pt-1 text-[11px]">
                    <p className="text-slate-500">
                      Unique SMVITM Asset tags will be automatically minted and barcode labels assigned for each unit.
                    </p>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Serial Numbers (comma-separated)</label>
                      <input
                        type="text"
                        value={serialNumbersText}
                        onChange={(e) => setSerialNumbersText(e.target.value)}
                        placeholder="e.g. SN-8921-A, SN-8922-B"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Inspection & Commissioning Notes</label>
                <textarea
                  rows={2}
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  placeholder="e.g. Bench tested with standard power load, boots cleanly..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  onClick={() => setShowReceiptModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGoodsReceiptSubmit}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-semibold"
                >
                  Confirm & Add to Inventory
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 6: RETIRE OLD ASSET                                */}
      {/* ======================================================== */}
      {showRetireModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-navy-900 text-white p-4 flex justify-between items-center">
              <h3 className="font-semibold text-sm">Decommission & Retire Replaced Equipment</h3>
              <button onClick={() => setShowRetireModal(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-600">
                You are about to formally retire asset <strong>{showRetireModal.linked_asset_custom_id || `Asset #${showRetireModal.linked_asset_id}`}</strong> following receipt of its replacement.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Decommissioning Justification *</label>
                <textarea
                  rows={3}
                  required
                  value={retireReason}
                  onChange={(e) => setRetireReason(e.target.value)}
                  placeholder="e.g. Permanently unrepairable; safely stripped for spare components..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  onClick={() => setShowRetireModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRetireAssetSubmit}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold"
                >
                  Confirm Retirement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
