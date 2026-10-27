import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import {
  Box,
  Plus,
  Search,
  Download,
  QrCode,
  Edit2,
  AlertTriangle,
  History,
  CheckCircle,
  XCircle,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Wrench,
  Clock,
  Layers,
  Archive,
  Info,
  Trash2
} from 'lucide-react';
import { QRPrintModal } from '../components/QRPrintModal';

interface Asset {
  id: number;
  asset_id: string;
  name: string;
  category: string;
  serial_number?: string;
  manufacturer?: string;
  model?: string;
  lab_id: number;
  lab_name?: string;
  location_in_lab?: string;
  status: string;
  qr_code: string;
  purchase_date?: string;
  purchase_cost?: number;
  warranty_expiry?: string;
  created_at: string;
}

interface BulkItem {
  id: number;
  name: string;
  category: string;
  lab_id: number;
  lab_name?: string;
  total_quantity: number;
  working_quantity: number;
  damaged_quantity: number;
  missing_quantity: number;
  under_repair_quantity: number;
  min_threshold: number;
  is_low_stock?: boolean;
  qr_code?: string;
}

interface Laboratory {
  id: number;
  name: string;
  code: string;
}

interface InventorySummary {
  total_active_assets: number;
  working_assets: number;
  damaged_assets: number;
  missing_assets: number;
  under_repair_assets: number;
  fault_reported_assets: number;
  retired_assets: number;
  low_stock_bulk_items: number;
}

interface AssetHistoryEvent {
  id: number;
  user_name?: string;
  action: string;
  previous_status?: string;
  new_status?: string;
  quantity_changed?: number;
  reason: string;
  timestamp: string;
}

interface AssetDetail extends Asset {
  laboratory_name?: string;
  department_name?: string;
  history: AssetHistoryEvent[];
}

// Validated transitions mapping for UI
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  'Working': ['Fault reported', 'Damaged', 'Missing', 'Retired'],
  'Fault reported': ['Under repair', 'Working', 'Damaged', 'Replacement requested', 'Retired'],
  'Under repair': ['Working', 'Damaged', 'Replacement requested', 'Retired'],
  'Damaged': ['Under repair', 'Replacement requested', 'Working', 'Retired'],
  'Missing': ['Working', 'Retired'],
  'Replacement requested': ['Working', 'Retired'],
  'Retired': []
};

export const InventoryPage: React.FC = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<'assets' | 'bulk'>('assets');
  const [labs, setLabs] = useState<Laboratory[]>([]);
  const [selectedLab, setSelectedLab] = useState<string>('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [includeRetired, setIncludeRetired] = useState(false);

  // Pagination & Sorting
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [assets, setAssets] = useState<Asset[]>([]);
  const [bulkItems, setBulkItems] = useState<BulkItem[]>([]);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [loading, setLoading] = useState(false);

  // Lifecycle History Modal
  const [selectedAssetDetail, setSelectedAssetDetail] = useState<AssetDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Edit Asset Modal
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editSerial, setEditSerial] = useState('');
  const [editMfg, setEditMfg] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editCost, setEditCost] = useState<number | ''>('');
  const [editReason, setEditReason] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // Register Asset Modal
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [newAssetId, setNewAssetId] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Computing');
  const [newSerial, setNewSerial] = useState('');
  const [newMfg, setNewMfg] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newLabId, setNewLabId] = useState<number>(1);
  const [newLocation, setNewLocation] = useState('');
  const [newCost, setNewCost] = useState<number | ''>('');
  const [addError, setAddError] = useState<string | null>(null);

  // Status Modal
  const [showStatusModal, setShowStatusModal] = useState<Asset | null>(null);
  const [newStatus, setNewStatus] = useState('Working');
  const [statusReason, setStatusReason] = useState('');
  const [statusError, setStatusError] = useState<string | null>(null);

  // Adjust Bulk Modal
  const [showAdjustBulk, setShowAdjustBulk] = useState<BulkItem | null>(null);
  const [bulkWorking, setBulkWorking] = useState(0);
  const [bulkDamaged, setBulkDamaged] = useState(0);
  const [bulkMissing, setBulkMissing] = useState(0);
  const [bulkRepair, setBulkRepair] = useState(0);
  const [bulkReason, setBulkReason] = useState('');
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Print Label state
  const [printLabelData, setPrintLabelData] = useState<any>(null);

  // Remove Equipment Modal State
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [permanentDelete, setPermanentDelete] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Remove Bulk Item Modal State
  const [bulkToDelete, setBulkToDelete] = useState<BulkItem | null>(null);
  const [deleteBulkReason, setDeleteBulkReason] = useState('');
  const [deleteBulkLoading, setDeleteBulkLoading] = useState(false);
  const [deleteBulkError, setDeleteBulkError] = useState<string | null>(null);

  const canEdit = user?.role === 'LAB_INSTRUCTOR' || user?.role === 'ADMIN';

  useEffect(() => {
    loadLabs();
  }, []);

  useEffect(() => {
    loadSummary();
    loadInventory();
  }, [selectedLab, statusFilter, categoryFilter, search, tab, page, pageSize, sortBy, sortOrder, includeRetired]);

  // Global Escape key listener to close any active modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedAssetDetail(null);
        setEditingAsset(null);
        setShowStatusModal(null);
        setShowAdjustBulk(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadLabs = async () => {
    try {
      const data = await apiRequest<Laboratory[]>('/labs');
      setLabs(data);
      if (data.length > 0) {
        setNewLabId(prev => (prev && data.some(l => l.id === prev) ? prev : data[0].id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadSummary = async () => {
    try {
      let endpoint = `/inventory/summary`;
      if (selectedLab) endpoint += `?lab_id=${selectedLab}`;
      const data = await apiRequest<InventorySummary>(endpoint);
      setSummary(data);
    } catch (err) {
      console.error('Failed to load inventory summary:', err);
    }
  };

  const loadInventory = async () => {
    setLoading(true);
    try {
      if (tab === 'assets') {
        let endpoint = `/inventory/assets?page=${page}&page_size=${pageSize}&sort_by=${sortBy}&sort_order=${sortOrder}`;
        if (selectedLab) endpoint += `&lab_id=${selectedLab}`;
        if (statusFilter) endpoint += `&status=${encodeURIComponent(statusFilter)}`;
        if (categoryFilter) endpoint += `&category=${encodeURIComponent(categoryFilter)}`;
        if (search) endpoint += `&search=${encodeURIComponent(search)}`;
        if (includeRetired) endpoint += `&include_retired=true`;

        const res = await apiRequest<any>(endpoint);
        if (res && res.items) {
          setAssets(res.items);
          setTotalCount(res.total);
          setTotalPages(res.total_pages);
        } else if (Array.isArray(res)) {
          setAssets(res);
          setTotalCount(res.length);
          setTotalPages(1);
        }
      } else {
        let endpoint = `/inventory/bulk?`;
        if (selectedLab) endpoint += `lab_id=${selectedLab}&`;
        const data = await apiRequest<BulkItem[]>(endpoint);
        setBulkItems(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (assetId: number) => {
    setLoadingDetail(true);
    try {
      const data = await apiRequest<AssetDetail>(`/inventory/assets/${assetId}/details`);
      setSelectedAssetDetail(data);
    } catch (err: any) {
      alert(`Could not load asset details: ${err.message}`);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleOpenEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setEditName(asset.name);
    setEditCategory(asset.category);
    setEditSerial(asset.serial_number || '');
    setEditMfg(asset.manufacturer || '');
    setEditModel(asset.model || '');
    setEditLocation(asset.location_in_lab || '');
    setEditCost(asset.purchase_cost ?? '');
    setEditReason('');
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset) return;
    setEditError(null);

    try {
      await apiRequest(`/inventory/assets/${editingAsset.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editName.trim(),
          category: editCategory.trim(),
          serial_number: editSerial.trim() || undefined,
          manufacturer: editMfg.trim() || undefined,
          model: editModel.trim() || undefined,
          location_in_lab: editLocation.trim() || undefined,
          purchase_cost: editCost !== '' ? Number(editCost) : undefined,
          reason: editReason.trim() || 'Specification metadata update'
        })
      });
      setEditingAsset(null);
      loadInventory();
      loadSummary();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update asset');
    }
  };

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    try {
      await apiRequest('/inventory/assets', {
        method: 'POST',
        body: JSON.stringify({
          asset_id: newAssetId.trim(),
          name: newName.trim(),
          category: newCategory.trim(),
          serial_number: newSerial.trim() || undefined,
          manufacturer: newMfg.trim() || undefined,
          model: newModel.trim() || undefined,
          department_id: 1,
          lab_id: Number(newLabId),
          location_in_lab: newLocation.trim() || undefined,
          purchase_cost: newCost !== '' ? Number(newCost) : undefined,
          status: 'Working'
        })
      });
      setShowAddAsset(false);
      resetAddForm();
      loadInventory();
      loadSummary();
    } catch (err: any) {
      setAddError(err.message || 'Error creating asset');
    }
  };

  const resetAddForm = () => {
    setNewAssetId('');
    setNewName('');
    setNewSerial('');
    setNewMfg('');
    setNewModel('');
    setNewLocation('');
    setNewCost('');
    setAddError(null);
  };

  const handleUpdateStatus = async () => {
    if (!showStatusModal) return;
    if (!statusReason.trim() || statusReason.trim().length < 3) {
      setStatusError('Please provide a descriptive reason (at least 3 characters).');
      return;
    }
    setStatusError(null);

    try {
      await apiRequest(`/inventory/assets/${showStatusModal.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status: newStatus,
          reason: statusReason.trim()
        })
      });
      setShowStatusModal(null);
      setStatusReason('');
      loadInventory();
      loadSummary();
    } catch (err: any) {
      setStatusError(err.message || 'Failed to update status');
    }
  };

  const handleAdjustBulk = async () => {
    if (!showAdjustBulk) return;
    if (!bulkReason.trim() || bulkReason.trim().length < 3) {
      setBulkError('Please provide a reason for bulk adjustment.');
      return;
    }
    setBulkError(null);

    try {
      await apiRequest(`/inventory/bulk/${showAdjustBulk.id}/adjust`, {
        method: 'PUT',
        body: JSON.stringify({
          working_quantity: Number(bulkWorking),
          damaged_quantity: Number(bulkDamaged),
          missing_quantity: Number(bulkMissing),
          under_repair_quantity: Number(bulkRepair),
          reason: bulkReason.trim()
        })
      });
      setShowAdjustBulk(null);
      setBulkReason('');
      loadInventory();
      loadSummary();
    } catch (err: any) {
      setBulkError(err.message || 'Failed to adjust bulk inventory');
    }
  };

  const handlePrintLabel = async (assetId: number) => {
    try {
      const data = await apiRequest(`/qr/label/${assetId}`);
      setPrintLabelData(data);
    } catch (err: any) {
      alert(`Could not fetch label: ${err.message}`);
    }
  };

  const handlePrintBulkLabel = async (bulkId: number) => {
    try {
      const data = await apiRequest(`/qr/bulk-label/${bulkId}`);
      setPrintLabelData(data);
    } catch (err: any) {
      alert(`Could not fetch bulk label: ${err.message}`);
    }
  };

  const handleExportCSV = async () => {
    try {
      let endpoint = `/inventory/export-csv`;
      if (selectedLab) endpoint += `?lab_id=${selectedLab}`;
      const blob = await apiRequest<Blob>(endpoint);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SMVITM_Lab_Inventory_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      alert(`Failed to export CSV: ${err.message}`);
    }
  };

  const handleOpenDelete = (asset: Asset) => {
    setAssetToDelete(asset);
    setDeleteReason('');
    setPermanentDelete(false);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!assetToDelete) return;
    if (!deleteReason.trim() || deleteReason.trim().length < 3) {
      setDeleteError('Please provide a brief reason for removing this equipment (at least 3 characters).');
      return;
    }
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await apiRequest(
        `/inventory/assets/${assetToDelete.id}?reason=${encodeURIComponent(deleteReason.trim())}&permanent=${permanentDelete}`,
        { method: 'DELETE' }
      );
      setAssetToDelete(null);
      loadInventory();
      loadSummary();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to remove equipment');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleOpenDeleteBulk = (item: BulkItem) => {
    setBulkToDelete(item);
    setDeleteBulkReason('');
    setDeleteBulkError(null);
  };

  const handleConfirmDeleteBulk = async () => {
    if (!bulkToDelete) return;
    setDeleteBulkLoading(true);
    setDeleteBulkError(null);
    try {
      await apiRequest(
        `/inventory/bulk/${bulkToDelete.id}?reason=${encodeURIComponent(deleteBulkReason.trim() || 'Removed from laboratory stock')}`,
        { method: 'DELETE' }
      );
      setBulkToDelete(null);
      loadInventory();
      loadSummary();
    } catch (err: any) {
      setDeleteBulkError(err.message || 'Failed to remove bulk stock');
    } finally {
      setDeleteBulkLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('working')) {
      return <span className="bg-emerald-50 text-emerald-900 text-xs px-2.5 py-0.5 rounded-full font-bold border border-emerald-300 shadow-xs">Working</span>;
    } else if (s.includes('fault')) {
      return <span className="bg-amber-50 text-amber-950 text-xs px-2.5 py-0.5 rounded-full font-bold border border-amber-300 shadow-xs">Fault Reported</span>;
    } else if (s.includes('repair')) {
      return <span className="bg-blue-50 text-blue-900 text-xs px-2.5 py-0.5 rounded-full font-bold border border-blue-300 shadow-xs">Under Repair</span>;
    } else if (s.includes('damaged')) {
      return <span className="bg-rose-50 text-rose-900 text-xs px-2.5 py-0.5 rounded-full font-bold border border-rose-300 shadow-xs">Damaged</span>;
    } else if (s.includes('missing')) {
      return <span className="bg-slate-100 text-slate-900 text-xs px-2.5 py-0.5 rounded-full font-bold border border-slate-300 shadow-xs">Missing</span>;
    } else if (s.includes('replacement')) {
      return <span className="bg-purple-50 text-purple-900 text-xs px-2.5 py-0.5 rounded-full font-bold border border-purple-300 shadow-xs">Replacement Requested</span>;
    } else if (s.includes('retired')) {
      return <span className="bg-gray-100 text-gray-700 text-xs px-2.5 py-0.5 rounded-full font-bold border border-gray-300 shadow-xs">Retired (Archived)</span>;
    }
    return <span className="bg-slate-100 text-slate-800 text-xs px-2.5 py-0.5 rounded-full font-bold border border-slate-200">{status}</span>;
  };

  return (
    <div className="space-y-6">
      
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="text-[11px] font-bold text-cyan-800 uppercase tracking-wider mb-1">
            Department of AI & Data Science
          </div>
          <h2 className="text-xl font-bold text-navy-900 tracking-tight">
            Laboratory Inventory Records
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage individual workstations, lab apparatus, and bulk accessory stocks across campus laboratories.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold transition"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>

          {canEdit && tab === 'assets' && (
            <button
              onClick={() => {
                resetAddForm();
                setShowAddAsset(true);
              }}
              className="flex items-center space-x-1.5 bg-navy-900 hover:bg-navy-800 text-white px-4 py-2 rounded-xl text-xs font-semibold transition shadow-sm hover:shadow"
            >
              <Plus className="h-4 w-4 text-cyan-400" />
              <span>Register Asset</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Metric Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500 block">Active Equipment</span>
            <span className="text-xl font-bold text-navy-900 mt-1 block">{summary.total_active_assets}</span>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-2xs">
            <span className="text-[11px] font-medium text-emerald-700 block">Working State</span>
            <span className="text-xl font-bold text-emerald-600 mt-1 block">{summary.working_assets}</span>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-amber-100 shadow-2xs">
            <span className="text-[11px] font-medium text-amber-700 block">Faults Reported</span>
            <span className="text-xl font-bold text-amber-600 mt-1 block">{summary.fault_reported_assets}</span>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-blue-100 shadow-2xs">
            <span className="text-[11px] font-medium text-blue-700 block">Under Repair</span>
            <span className="text-xl font-bold text-blue-600 mt-1 block">{summary.under_repair_assets}</span>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-rose-100 shadow-2xs">
            <span className="text-[11px] font-medium text-rose-700 block">Damaged</span>
            <span className="text-xl font-bold text-rose-600 mt-1 block">{summary.damaged_assets}</span>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-orange-100 shadow-2xs">
            <span className="text-[11px] font-medium text-orange-700 block">Low Stock Bulk</span>
            <span className="text-xl font-bold text-orange-600 mt-1 block">{summary.low_stock_bulk_items}</span>
          </div>
        </div>
      )}

      {/* Tabs and Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        
        {/* Toggle between Tracked Assets and Bulk Items with High-Contrast Aesthetics */}
        <div className="flex border-b border-slate-200 pb-3 justify-between items-center flex-wrap gap-2">
          <div className="flex space-x-2">
            <button
              onClick={() => {
                setTab('assets');
                setPage(1);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition duration-150 ${
                tab === 'assets'
                  ? 'bg-[#800B35] text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              Individually Tracked Assets ({summary?.total_active_assets ?? assets.length})
            </button>
            <button
              onClick={() => {
                setTab('bulk');
                setPage(1);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition duration-150 ${
                tab === 'bulk'
                  ? 'bg-[#800B35] text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              Bulk Equipment Stocks ({bulkItems.length})
            </button>
          </div>

          {/* Laboratory Selector */}
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-500 font-medium">Laboratory:</span>
            <select
              value={selectedLab}
              onChange={(e) => {
                setSelectedLab(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy-600 font-medium"
            >
              <option value="">All Authorized Labs</option>
              {labs.map(l => (
                <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Search & Multi-Filters (for Assets) */}
        {tab === 'assets' && (
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-5 relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by name, Asset ID (e.g. SMVITM-AIDS-LAB1-WS-01), or serial number..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy-600"
              />
            </div>

            <div className="sm:col-span-3">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy-600"
              >
                <option value="">All Statuses</option>
                <option value="Working">Working</option>
                <option value="Fault reported">Fault reported</option>
                <option value="Under repair">Under repair</option>
                <option value="Damaged">Damaged</option>
                <option value="Missing">Missing</option>
                <option value="Replacement requested">Replacement requested</option>
                <option value="Retired">Retired</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy-600"
              >
                <option value="">All Categories</option>
                <option value="Computing">Computing</option>
                <option value="Electrical">Electrical</option>
                <option value="Network">Network</option>
                <option value="Peripherals">Peripherals</option>
                <option value="Furniture">Furniture</option>
              </select>
            </div>

            <div className="sm:col-span-2 flex items-center justify-end">
              <label className="flex items-center space-x-1.5 text-xs text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeRetired}
                  onChange={(e) => {
                    setIncludeRetired(e.target.checked);
                    setPage(1);
                  }}
                  className="rounded border-slate-300 text-navy-900 focus:ring-navy-600 h-3.5 w-3.5"
                />
                <span>Include Retired</span>
              </label>
            </div>
          </div>
        )}

      </div>

      {/* Main Table Content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            Loading laboratory inventory records...
          </div>
        ) : tab === 'assets' ? (
          assets.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              No matching assets found in the selected laboratory.
            </div>
          ) : (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/95 text-slate-800 font-bold border-b-2 border-slate-300 text-xs tracking-wider">
                      <th
                        className="py-3 px-4 cursor-pointer hover:text-navy-900"
                        onClick={() => {
                          if (sortBy === 'asset_id') {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortBy('asset_id');
                            setSortOrder('asc');
                          }
                        }}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Asset ID</span>
                          <ArrowUpDown className="h-3 w-3 opacity-60" />
                        </div>
                      </th>
                      <th
                        className="py-3 px-4 cursor-pointer hover:text-navy-900"
                        onClick={() => {
                          if (sortBy === 'name') {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortBy('name');
                            setSortOrder('asc');
                          }
                        }}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Equipment Name</span>
                          <ArrowUpDown className="h-3 w-3 opacity-60" />
                        </div>
                      </th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Laboratory & Location</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {assets.map((asset) => (
                      <tr key={asset.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-mono font-bold text-navy-900 whitespace-nowrap">
                          {asset.asset_id}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleViewDetails(asset.id)}
                            className="font-semibold text-slate-900 hover:text-cyan-700 text-left block"
                          >
                            {asset.name}
                          </button>
                          <div className="text-[10px] text-slate-400">
                            {asset.manufacturer} {asset.model} {asset.serial_number ? `• S/N: ${asset.serial_number}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {asset.category}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-800">{asset.lab_name || `Lab ${asset.lab_id}`}</div>
                          <div className="text-[10px] text-slate-400">{asset.location_in_lab || 'POD Bench'}</div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {getStatusBadge(asset.status)}
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => handleViewDetails(asset.id)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-medium transition"
                            title="View history & technical details"
                          >
                            <History className="h-3.5 w-3.5 inline mr-1 text-slate-500" />
                            History
                          </button>
                          <button
                            onClick={() => handlePrintLabel(asset.id)}
                            className="px-2.5 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 rounded-lg text-[11px] font-semibold transition"
                            title="View, download & print QR code for this asset"
                          >
                            <QrCode className="h-3.5 w-3.5 inline mr-1 text-cyan-700" />
                            Asset QR
                          </button>
                          {canEdit && (
                            <>
                              <button
                                onClick={() => handleOpenEdit(asset)}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-medium transition"
                                title="Edit asset metadata"
                              >
                                <Edit2 className="h-3.5 w-3.5 inline mr-1 text-slate-500" />
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  setShowStatusModal(asset);
                                  setNewStatus(asset.status);
                                  setStatusReason('');
                                  setStatusError(null);
                                }}
                                className="px-2 py-1 bg-navy-50 hover:bg-navy-100 text-navy-800 rounded-lg text-[11px] font-semibold transition"
                              >
                                Status
                              </button>
                              <button
                                onClick={() => handleOpenDelete(asset)}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-semibold transition inline-flex items-center"
                                title="Remove or decommission this equipment"
                              >
                                <Trash2 className="h-3 w-3 mr-1 text-rose-600" />
                                Remove
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-slate-600">
                <div className="flex items-center space-x-2">
                  <span>Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} assets</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-700"
                  >
                    <option value={10}>10 per page</option>
                    <option value={20}>20 per page</option>
                    <option value={50}>50 per page</option>
                  </select>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-1 rounded bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-100"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-2 font-medium">Page {page} of {totalPages}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-1 rounded bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-100"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        ) : (
          /* Bulk Inventory Table */
          bulkItems.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              No bulk items registered for this laboratory.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/95 text-slate-800 font-bold border-b-2 border-slate-300 text-xs tracking-wider">
                    <th className="py-3 px-4">Item Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-center">Total Qty</th>
                    <th className="py-3 px-4 text-center">Working</th>
                    <th className="py-3 px-4 text-center">Damaged</th>
                    <th className="py-3 px-4 text-center">Missing</th>
                    <th className="py-3 px-4 text-center">Under Repair</th>
                    <th className="py-3 px-4 text-center">Min Threshold</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bulkItems.map((item) => {
                    const isLow = item.working_quantity < item.min_threshold;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {item.name}
                          {isLow && (
                            <span className="ml-2 inline-block px-1.5 py-0.5 bg-rose-100 text-rose-700 text-[10px] rounded font-bold">
                              Low Stock
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{item.category}</td>
                        <td className="py-3 px-4 text-center font-bold text-slate-900">{item.total_quantity}</td>
                        <td className="py-3 px-4 text-center text-emerald-700 font-bold">{item.working_quantity}</td>
                        <td className="py-3 px-4 text-center text-rose-600 font-medium">{item.damaged_quantity}</td>
                        <td className="py-3 px-4 text-center text-slate-500">{item.missing_quantity}</td>
                        <td className="py-3 px-4 text-center text-blue-600">{item.under_repair_quantity}</td>
                        <td className="py-3 px-4 text-center text-slate-400 font-mono">{item.min_threshold}</td>
                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => handlePrintBulkLabel(item.id)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-medium transition"
                            title="Print storage bin label"
                          >
                            <QrCode className="h-3.5 w-3.5 inline mr-1 text-indigo-700" />
                            Bin QR
                          </button>
                          {canEdit && (
                            <>
                              <button
                                onClick={() => {
                                  setShowAdjustBulk(item);
                                  setBulkWorking(item.working_quantity);
                                  setBulkDamaged(item.damaged_quantity);
                                  setBulkMissing(item.missing_quantity);
                                  setBulkRepair(item.under_repair_quantity);
                                  setBulkReason('');
                                  setBulkError(null);
                                }}
                                className="px-2.5 py-1 bg-navy-50 hover:bg-navy-100 text-navy-800 rounded-lg text-[11px] font-semibold transition"
                              >
                                Adjust Stock
                              </button>
                              <button
                                onClick={() => handleOpenDeleteBulk(item)}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-semibold transition inline-flex items-center"
                                title="Remove bulk inventory item"
                              >
                                <Trash2 className="h-3 w-3 mr-1 text-rose-600" />
                                Remove
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Asset Lifecycle Details Modal */}
      {selectedAssetDetail && (
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedAssetDetail(null);
          }}
        >
          {/* Floating Close Badge */}
          <button
            onClick={() => setSelectedAssetDetail(null)}
            className="fixed top-3 right-3 sm:top-4 sm:right-4 z-[80] px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-full text-xs font-bold shadow-2xl transition flex items-center space-x-1.5 border border-white/20 active:scale-95"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
            <span>Close (Esc)</span>
          </button>

          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col my-auto overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150 relative">
            <div className="bg-navy-900 text-white p-4 sm:p-5 flex justify-between items-center shrink-0 sticky top-0 z-10">
              <div>
                <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block">Equipment Lifecycle & History</span>
                <h3 className="font-bold text-base mt-0.5">{selectedAssetDetail.name}</h3>
                <span className="font-mono text-xs text-slate-300">{selectedAssetDetail.asset_id}</span>
              </div>
              <button
                onClick={() => setSelectedAssetDetail(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0 text-xs">
              {/* Specification Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px]">Status:</span>
                  <div className="mt-0.5">{getStatusBadge(selectedAssetDetail.status)}</div>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Laboratory:</span>
                  <span className="font-semibold text-slate-900">{selectedAssetDetail.laboratory_name || `Lab ${selectedAssetDetail.lab_id}`}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Location:</span>
                  <span className="font-semibold text-slate-900">{selectedAssetDetail.location_in_lab || 'Standard Desk'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Serial Number:</span>
                  <span className="font-mono font-semibold text-slate-900">{selectedAssetDetail.serial_number || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Manufacturer & Model:</span>
                  <span className="font-semibold text-slate-900">{selectedAssetDetail.manufacturer || 'Generic'} {selectedAssetDetail.model || ''}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Purchase Cost:</span>
                  <span className="font-semibold text-slate-900">
                    {selectedAssetDetail.purchase_cost != null ? `₹${selectedAssetDetail.purchase_cost.toLocaleString()}` : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Chronological Event History */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center space-x-1.5 font-bold text-slate-800 text-sm">
                  <Clock className="h-4 w-4 text-cyan-600" />
                  <span>Audit & Lifecycle History</span>
                </div>

                {selectedAssetDetail.history && selectedAssetDetail.history.length > 0 ? (
                  <div className="relative border-l-2 border-slate-200 ml-3 pl-4 space-y-3 py-1">
                    {selectedAssetDetail.history.map((h, i) => (
                      <div key={i} className="relative">
                        <div className="absolute -left-[23px] top-1.5 h-3 w-3 rounded-full bg-cyan-600 border-2 border-white shadow-2xs" />
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                          <div className="flex justify-between items-center text-slate-500 text-[10px] mb-1">
                            <span className="font-semibold text-navy-900">{h.action}</span>
                            <span>{new Date(h.timestamp).toLocaleString()}</span>
                          </div>
                          {h.new_status && (
                            <div className="text-slate-700 mb-1">
                              Status changed {h.previous_status ? `from "${h.previous_status}" ` : ''}to <strong className="text-navy-900">"{h.new_status}"</strong>
                            </div>
                          )}
                          <div className="text-slate-600">
                            <strong>Reason:</strong> {h.reason}
                          </div>
                          {h.user_name && (
                            <div className="text-[10px] text-slate-400 mt-1">
                              Recorded by: {h.user_name}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-slate-400 italic bg-slate-50 rounded-lg">
                    No historical modifications recorded for this equipment.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-between items-center shrink-0 sticky bottom-0 z-10">
              <button
                onClick={() => handlePrintLabel(selectedAssetDetail.id)}
                className="flex items-center space-x-1 text-slate-700 hover:text-navy-900 font-semibold text-xs"
              >
                <QrCode className="h-4 w-4 text-cyan-600" />
                <span>Print QR Sticker</span>
              </button>
              <button
                onClick={() => setSelectedAssetDetail(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Asset Metadata Modal */}
      {editingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="bg-navy-900 text-white p-5 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">Metadata Editor</span>
                <h3 className="font-bold text-base">{editingAsset.asset_id}</h3>
              </div>
              <button
                onClick={() => setEditingAsset(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              {editError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                  {editError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Equipment Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
                  <input
                    type="text"
                    required
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Serial Number</label>
                  <input
                    type="text"
                    value={editSerial}
                    onChange={(e) => setEditSerial(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Manufacturer</label>
                  <input
                    type="text"
                    value={editMfg}
                    onChange={(e) => setEditMfg(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Model</label>
                  <input
                    type="text"
                    value={editModel}
                    onChange={(e) => setEditModel(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Location in Lab</label>
                  <input
                    type="text"
                    placeholder="e.g. Row 2, Bench 4"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Cost (INR)</label>
                  <input
                    type="number"
                    value={editCost}
                    onChange={(e) => setEditCost(e.target.value ? Number(e.target.value) : '')}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Change Reason *</label>
                <input
                  type="text"
                  placeholder="Reason for editing equipment details"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingAsset(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-lg text-xs font-semibold transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Validated Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="bg-navy-900 text-white p-4 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-sm">Update Equipment Status</h3>
                <span className="font-mono text-xs text-slate-300">{showStatusModal.asset_id}</span>
              </div>
              <button
                onClick={() => setShowStatusModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {statusError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                  {statusError}
                </div>
              )}

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-700">
                <div className="font-medium text-slate-900">{showStatusModal.name}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Current Status: <strong className="text-navy-900">{showStatusModal.status}</strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Status (Governed by lifecycle transition policy):
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy-600"
                >
                  <option value={showStatusModal.status}>No Change ({showStatusModal.status})</option>
                  {(ALLOWED_TRANSITIONS[showStatusModal.status] || ['Working', 'Fault reported', 'Under repair', 'Damaged', 'Missing', 'Retired']).map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                  {user?.role === 'ADMIN' && (
                    <option value="Working">Working (Admin Override)</option>
                  )}
                </select>
                {newStatus === 'Retired' && (
                  <p className="text-[11px] text-amber-700 mt-1.5 flex items-center space-x-1">
                    <Info className="h-3.5 w-3.5 inline shrink-0" />
                    <span>Retirement will soft-archive this equipment while preserving complete audit history.</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mandatory Status Change Reason *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detail the technical reasoning, fault symptoms, or inspection findings (minimum 3 characters)..."
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy-600"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(null)}
                  className="px-3.5 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateStatus}
                  className="px-4 py-1.5 bg-navy-900 hover:bg-navy-800 text-white rounded-lg text-xs font-semibold transition"
                >
                  Confirm Transition
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Bulk Inventory Modal */}
      {showAdjustBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="bg-navy-900 text-white p-4 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-sm">Bulk Stock Adjustment</h3>
                <span className="text-xs text-slate-300">{showAdjustBulk.name}</span>
              </div>
              <button
                onClick={() => setShowAdjustBulk(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {bulkError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                  {bulkError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Working Units *</label>
                  <input
                    type="number"
                    min="0"
                    value={bulkWorking}
                    onChange={(e) => setBulkWorking(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Damaged Units *</label>
                  <input
                    type="number"
                    min="0"
                    value={bulkDamaged}
                    onChange={(e) => setBulkDamaged(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Missing Units *</label>
                  <input
                    type="number"
                    min="0"
                    value={bulkMissing}
                    onChange={(e) => setBulkMissing(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Under Repair Units *</label>
                  <input
                    type="number"
                    min="0"
                    value={bulkRepair}
                    onChange={(e) => setBulkRepair(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs flex justify-between font-medium">
                <span className="text-slate-500">Calculated Total Quantity:</span>
                <span className="font-mono font-bold text-navy-900">
                  {bulkWorking + bulkDamaged + bulkMissing + bulkRepair} units
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Adjustment Reason *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Physical inventory verification or stock arrival"
                  value={bulkReason}
                  onChange={(e) => setBulkReason(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAdjustBulk(null)}
                  className="px-3.5 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAdjustBulk}
                  className="px-4 py-1.5 bg-navy-900 hover:bg-navy-800 text-white rounded-lg text-xs font-semibold transition"
                >
                  Save Adjustment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Register New Asset Modal */}
      {showAddAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="bg-navy-900 text-white p-5 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">SMVITM AI & DS Department</span>
                <h3 className="font-bold text-base">Register Tracked Equipment</h3>
              </div>
              <button
                onClick={() => setShowAddAsset(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAsset} className="p-6 space-y-4">
              {addError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                  {addError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Unique Asset ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SMVITM-AIDS-LAB1-PC-15"
                    value={newAssetId}
                    onChange={(e) => setNewAssetId(e.target.value.toUpperCase())}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono uppercase focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  >
                    <option value="Computing">Computing (PCs, Workstations, Servers)</option>
                    <option value="Electrical">Electrical (UPS, ACs, Fans, Switches)</option>
                    <option value="Network">Networking (Switches, Routers, APs)</option>
                    <option value="Peripherals">Peripherals (Projectors, Printers)</option>
                    <option value="Furniture">Furniture (Chairs, Tables)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Equipment Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dell Precision 3660 AI Workstation"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Laboratory *</label>
                  {labs.length === 0 ? (
                    <div className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2 font-medium">
                      Loading laboratories or no assigned labs found.
                    </div>
                  ) : (
                    <select
                      value={newLabId}
                      onChange={(e) => setNewLabId(Number(e.target.value))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                    >
                      {labs.map(l => (
                        <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bench / Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Row 3, Bench 2"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Manufacturer</label>
                  <input
                    type="text"
                    placeholder="e.g. Dell, HP, Cisco"
                    value={newMfg}
                    onChange={(e) => setNewMfg(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Model Spec</label>
                  <input
                    type="text"
                    placeholder="e.g. Core i7, 32GB, RTX 3080"
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Hardware Serial Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 8FC9412L8A"
                    value={newSerial}
                    onChange={(e) => setNewSerial(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Cost (INR)</label>
                  <input
                    type="number"
                    placeholder="e.g. 75000"
                    value={newCost}
                    onChange={(e) => setNewCost(e.target.value ? Number(e.target.value) : '')}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddAsset(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-lg text-xs font-semibold transition"
                >
                  Register Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Equipment Confirmation Modal */}
      {assetToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-200 animate-in zoom-in duration-150">
            <div className="flex justify-between items-center pb-3 border-b border-rose-100">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-rose-50 rounded-xl text-rose-600 border border-rose-100">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 leading-tight">Remove Equipment</h3>
                  <p className="text-[11px] text-slate-500">Decommission or archive asset from laboratory</p>
                </div>
              </div>
              <button
                onClick={() => setAssetToDelete(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Asset Tag:</span>
                  <span className="font-mono font-bold text-slate-900">{assetToDelete.asset_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Equipment Name:</span>
                  <span className="font-semibold text-slate-800">{assetToDelete.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Category:</span>
                  <span className="text-slate-700">{assetToDelete.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Laboratory:</span>
                  <span className="font-medium text-slate-800">{assetToDelete.lab_name || labs.find(l => l.id === assetToDelete.lab_id)?.name || `Lab ${assetToDelete.lab_id}`}</span>
                </div>
                {assetToDelete.serial_number && (
                  <div className="flex justify-between font-mono text-[11px] pt-1 border-t border-slate-200/60">
                    <span className="text-slate-500">Serial Number:</span>
                    <span className="text-slate-700 font-semibold">{assetToDelete.serial_number}</span>
                  </div>
                )}
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start space-x-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  Removing this equipment takes it out of active laboratory service and archives its status to <strong>Retired</strong>. All past repair records and audit logs remain permanently preserved for VTU/NAAC compliance.
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason for Removal <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Obsolete hardware, damaged beyond repair, salvage/scrap"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              {user?.role === 'ADMIN' && (
                <label className="flex items-start space-x-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={permanentDelete}
                    onChange={(e) => setPermanentDelete(e.target.checked)}
                    className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-[11px]">
                    <strong>Permanently purge record from database</strong> (Administrator only; allowed if no past repair or transfer history exists).
                  </span>
                </label>
              )}

              {deleteError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                  {deleteError}
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAssetToDelete(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition shadow-sm flex items-center space-x-1.5"
              >
                {deleteLoading ? <Clock className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                <span>{permanentDelete ? 'Permanently Delete' : 'Confirm Removal'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Bulk Item Confirmation Modal */}
      {bulkToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-200 animate-in zoom-in duration-150">
            <div className="flex justify-between items-center pb-3 border-b border-rose-100">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-rose-50 rounded-xl text-rose-600 border border-rose-100">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 leading-tight">Remove Bulk Stock Category</h3>
                  <p className="text-[11px] text-slate-500">Delete consumable supply item from laboratory</p>
                </div>
              </div>
              <button
                onClick={() => setBulkToDelete(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Category Name:</span>
                  <span className="font-bold text-slate-900">{bulkToDelete.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Category Group:</span>
                  <span className="font-medium text-slate-700">{bulkToDelete.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Current Stock Balance:</span>
                  <span className="font-bold text-slate-800">{bulkToDelete.total_quantity} units</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Removal</label>
                <input
                  type="text"
                  placeholder="e.g. Discontinued component, depleted and retired"
                  value={deleteBulkReason}
                  onChange={(e) => setDeleteBulkReason(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              {deleteBulkError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                  {deleteBulkError}
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setBulkToDelete(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteBulkLoading}
                onClick={handleConfirmDeleteBulk}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition shadow-sm flex items-center space-x-1.5"
              >
                {deleteBulkLoading ? <Clock className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                <span>Confirm Removal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable QR Sticker Modal */}
      <QRPrintModal
        isOpen={!!printLabelData}
        onClose={() => setPrintLabelData(null)}
        labelData={printLabelData}
      />

    </div>
  );
};
