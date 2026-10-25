import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import {
  Wrench,
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus,
  Sparkles,
  UserCheck,
  ShieldAlert,
  X,
  FileText,
  Search,
  Filter,
  Download,
  Eye,
  RefreshCw,
  Trash2,
  Paperclip,
  Calendar,
  AlertOctagon,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Info
} from 'lucide-react';

export const FAULT_CATEGORIES = [
  'Computer or CPU problem',
  'Monitor, keyboard or mouse problem',
  'Network or connectivity problem',
  'Electrical fault',
  'Fan, light or AC problem',
  'Furniture damage',
  'Missing equipment',
  'Other'
];

export const FAULT_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

export const FAULT_STATUSES = [
  'Reported',
  'Reviewed',
  'Assigned',
  'In Progress',
  'Waiting for Parts',
  'Repair Completed — Awaiting Verification',
  'Verified and Closed',
  'Rejected',
  'Unable to Repair',
  'Replacement Recommended',
  'Reopened'
];

interface RepairPartItem {
  id?: number;
  part_name: string;
  part_number?: string;
  quantity: number;
  unit_cost: number;
  total_cost?: number;
}

interface FaultStatusHistory {
  id: number;
  fault_report_id: number;
  action: string;
  previous_status?: string;
  new_status: string;
  changed_by_name?: string;
  changed_by_role?: string;
  reason?: string;
  created_at: string;
}

interface RepairJob {
  id: number;
  fault_report_id: number;
  technician_id: number;
  technician_name?: string;
  status: string;
  assigned_at?: string;
  due_date?: string;
  assignment_notes?: string;
  diagnosis?: string;
  troubleshooting_steps?: string;
  work_performed?: string;
  completion_time?: string;
  repair_cost?: number;
  notes?: string;
  parts_requested?: string;
  is_verified?: boolean;
  verified_by_id?: number;
  verified_by_name?: string;
  verified_at?: string;
  verification_notes?: string;
  rejection_reason?: string;
  unable_to_repair_reason?: string;
  replacement_recommended?: boolean;
  parts_used?: RepairPartItem[];
}

interface FaultReport {
  id: number;
  report_number: string;
  title?: string;
  asset_id?: number;
  asset_custom_id?: string;
  asset_name?: string;
  bulk_id?: number;
  bulk_item_name?: string;
  lab_id: number;
  lab_name?: string;
  reported_by_id: number;
  reported_by_name?: string;
  fault_category: string;
  priority: string;
  description: string;
  status: string;
  is_safety_hazard: boolean;
  safety_warning?: string;
  attachment_url?: string;
  rejection_reason?: string;
  ai_suggested_category?: string;
  ai_suggested_priority?: string;
  ai_confidence?: number;
  created_at: string;
  repair_job?: RepairJob;
  status_history?: FaultStatusHistory[];
}

interface TechnicianSummary {
  id: number;
  full_name: string;
  email: string;
  role: string;
  department_name?: string;
  active_assigned_jobs: number;
  completed_repairs: number;
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

interface FaultsPageProps {
  initialAssetId?: number | null;
  onClearInitialAsset?: () => void;
}

export const FaultsPage: React.FC<FaultsPageProps> = ({
  initialAssetId,
  onClearInitialAsset
}) => {
  const { user } = useAuth();

  // Primary Data
  const [faults, setFaults] = useState<FaultReport[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianSummary[]>([]);
  const [labs, setLabs] = useState<Laboratory[]>([]);
  const [labAssets, setLabAssets] = useState<AssetOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'my-repairs'>('all');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLab, setFilterLab] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterSafetyHazard, setFilterSafetyHazard] = useState<boolean>(false);

  // Modals
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedDetailFault, setSelectedDetailFault] = useState<FaultReport | null>(null);
  const [showAssignModal, setShowAssignModal] = useState<FaultReport | null>(null);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState<FaultReport | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState<FaultReport | null>(null);
  const [showRejectModal, setShowRejectModal] = useState<FaultReport | null>(null);
  const [showReopenModal, setShowReopenModal] = useState<FaultReport | null>(null);

  // --- Report Modal State ---
  const [reportTitle, setReportTitle] = useState('');
  const [reportLabId, setReportLabId] = useState<number>(1);
  const [reportTargetType, setReportTargetType] = useState<'asset' | 'infrastructure'>('asset');
  const [reportAssetId, setReportAssetId] = useState<number | ''>('');
  const [reportCategory, setReportCategory] = useState(FAULT_CATEGORIES[0]);
  const [reportPriority, setReportPriority] = useState('Medium');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSafetyHazard, setReportSafetyHazard] = useState(false);
  const [reportSafetyWarning, setReportSafetyWarning] = useState('');
  const [reportAttachment, setReportAttachment] = useState<File | null>(null);
  const [uploadedAttachmentUrl, setUploadedAttachmentUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  // --- Assign Modal State ---
  const [assignTechId, setAssignTechId] = useState<number | ''>('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assignDueDate, setAssignDueDate] = useState('');
  const [assignError, setAssignError] = useState<string | null>(null);

  // --- Technician Workspace State ---
  const [wsDiagnosis, setWsDiagnosis] = useState('');
  const [wsTroubleshooting, setWsTroubleshooting] = useState('');
  const [wsWorkPerformed, setWsWorkPerformed] = useState('');
  const [wsLaborCost, setWsLaborCost] = useState<number>(0);
  const [wsParts, setWsParts] = useState<RepairPartItem[]>([]);
  const [wsNotes, setWsNotes] = useState('');
  const [wsError, setWsError] = useState<string | null>(null);
  const [wsReplacementReason, setWsReplacementReason] = useState('');
  const [wsUnableReason, setWsUnableReason] = useState('');
  const [showUnableDialog, setShowUnableDialog] = useState(false);
  const [showReplacementDialog, setShowReplacementDialog] = useState(false);

  // --- Verify Modal State ---
  const [verifyApproved, setVerifyApproved] = useState(true);
  const [verifyNotes, setVerifyNotes] = useState('');
  const [verifyRejectionReason, setVerifyRejectionReason] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // --- Reject / Reopen State ---
  const [rejectReason, setRejectReason] = useState('');
  const [reopenReason, setReopenReason] = useState('');

  const isInstructorOrAdmin = user?.role === 'LAB_INSTRUCTOR' || user?.role === 'ADMIN';
  const isTechnician = user?.role === 'TECHNICIAN';

  // Initial Data Fetch
  useEffect(() => {
    loadLabs();
    loadTechnicians();
    loadFaults();
  }, []);

  // When initialAssetId is passed via QR or Inventory navigation
  useEffect(() => {
    if (initialAssetId) {
      setReportAssetId(initialAssetId);
      setReportTargetType('asset');
      setShowReportModal(true);
      if (onClearInitialAsset) {
        onClearInitialAsset();
      }
    }
  }, [initialAssetId]);

  // Load assets whenever report lab changes
  useEffect(() => {
    if (showReportModal && reportLabId) {
      loadLabAssets(reportLabId);
    }
  }, [showReportModal, reportLabId]);

  // Automatic safety hazard suggestion when category is Electrical
  useEffect(() => {
    if (reportCategory === 'Electrical fault' || reportPriority === 'Critical') {
      setReportSafetyHazard(true);
      if (!reportSafetyWarning) {
        setReportSafetyWarning('DANGER: Potential electrical / physical hazard. Exercise extreme caution.');
      }
    }
  }, [reportCategory, reportPriority]);

  const loadFaults = async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'my-repairs' ? '/faults/my-repairs' : '/faults';
      const data = await apiRequest<FaultReport[]>(endpoint);
      setFaults(data);
    } catch (err) {
      console.error('Failed to load faults:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTechnicians = async () => {
    try {
      const data = await apiRequest<TechnicianSummary[]>('/faults/technicians');
      setTechnicians(data);
      if (data.length > 0 && !assignTechId) {
        setAssignTechId(data[0].id);
      }
    } catch (err) {
      console.warn('Could not load technician directory:', err);
    }
  };

  const loadLabs = async () => {
    try {
      const data = await apiRequest<Laboratory[]>('/labs');
      setLabs(data);
      if (data.length > 0 && !reportLabId) {
        setReportLabId(data[0].id);
      }
    } catch (err) {
      console.warn('Could not load laboratories:', err);
    }
  };

  const loadLabAssets = async (labId: number) => {
    try {
      const res = await apiRequest<{ items: AssetOption[] }>(`/inventory/assets?lab_id=${labId}&page_size=100`);
      setLabAssets(res.items || []);
    } catch (err) {
      console.warn('Could not load assets for lab:', err);
    }
  };

  // Re-fetch when switching tabs
  const handleTabChange = (tab: 'all' | 'my-repairs') => {
    setActiveTab(tab);
    setLoading(true);
    const endpoint = tab === 'my-repairs' ? '/faults/my-repairs' : '/faults';
    apiRequest<FaultReport[]>(endpoint)
      .then(data => setFaults(data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  // AI Classification Trigger
  const handleAiAutoClassify = async () => {
    if (!reportDescription.trim()) {
      alert('Please describe the fault symptoms first to trigger AI auto-classification.');
      return;
    }
    setIsClassifying(true);
    try {
      const res = await apiRequest<{
        category: string;
        suggested_priority: string;
        confidence: number;
        recommended_technician: string;
        needs_manual_review: boolean;
        safety_disclaimer: string;
      }>('/ai/classify', {
        method: 'POST',
        body: JSON.stringify({ description: reportDescription })
      });

      if (res.needs_manual_review) {
        setAiNotice(
          `AI Classification Flag: Low confidence score (${Math.round(res.confidence * 100)}%) or out-of-distribution input. Manual review required. Please choose category manually.`
        );
      } else {
        // Match closest category from dropdown
        const matchedCat = FAULT_CATEGORIES.find(c =>
          c.toLowerCase().includes(res.category.toLowerCase()) ||
          res.category.toLowerCase().includes(c.toLowerCase())
        ) || res.category;

        setReportCategory(matchedCat);
        setReportPriority(res.suggested_priority);
        setAiNotice(
          `AI Auto-Triage: Classified as "${matchedCat}" with ${Math.round(res.confidence * 100)}% confidence. Recommended technician: ${res.recommended_technician}. (AI recommendation only; instructor must verify).`
        );

        if (matchedCat.includes('Electrical') || res.suggested_priority === 'Critical') {
          setReportSafetyHazard(true);
          setReportSafetyWarning('DANGER: Potential electrical hazard flagged by diagnostic model. Inspect before power-on.');
        }
      }
    } catch (err: any) {
      alert(`AI Auto-Triage failed: ${err.message}`);
    } finally {
      setIsClassifying(false);
    }
  };

  // Handle Attachment Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReportAttachment(file);
    setIsUploading(true);
    setReportError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiRequest<{ attachment_url: string }>('/faults/upload-attachment', {
        method: 'POST',
        body: formData
      });
      setUploadedAttachmentUrl(res.attachment_url);
    } catch (err: any) {
      setReportError(`Attachment upload failed: ${err.message}`);
      setReportAttachment(null);
    } finally {
      setIsUploading(false);
    }
  };

  // Submit New Fault Report
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setReportError(null);

    if (!reportTitle.trim()) {
      setReportError('Please provide a short descriptive title for this fault ticket.');
      return;
    }

    try {
      await apiRequest('/faults', {
        method: 'POST',
        body: JSON.stringify({
          title: reportTitle.trim(),
          lab_id: Number(reportLabId),
          asset_id: reportTargetType === 'asset' && reportAssetId ? Number(reportAssetId) : undefined,
          fault_category: reportCategory,
          priority: reportPriority,
          description: reportDescription.trim(),
          is_safety_hazard: reportSafetyHazard,
          safety_warning: reportSafetyHazard ? reportSafetyWarning.trim() : undefined,
          attachment_url: uploadedAttachmentUrl || undefined
        })
      });

      setShowReportModal(false);
      // Reset form
      setReportTitle('');
      setReportDescription('');
      setReportAssetId('');
      setReportSafetyHazard(false);
      setReportSafetyWarning('');
      setUploadedAttachmentUrl(null);
      setReportAttachment(null);
      setAiNotice(null);
      loadFaults();
    } catch (err: any) {
      setReportError(err.message || 'Failed to submit fault report.');
    }
  };

  // Assign Technician Action
  const handleAssignTechnician = async () => {
    if (!showAssignModal || !assignTechId) return;
    setAssignError(null);

    try {
      await apiRequest(`/faults/${showAssignModal.id}/assign`, {
        method: 'POST',
        body: JSON.stringify({
          technician_id: Number(assignTechId),
          assignment_notes: assignNotes.trim() || undefined,
          due_date: assignDueDate || undefined
        })
      });
      setShowAssignModal(null);
      setAssignNotes('');
      setAssignDueDate('');
      loadFaults();
      loadTechnicians();
    } catch (err: any) {
      setAssignError(err.message || 'Failed to assign technician.');
    }
  };

  // Technician: Open Workspace
  const openTechnicianWorkspace = (fault: FaultReport) => {
    setShowWorkspaceModal(fault);
    const job = fault.repair_job;
    setWsDiagnosis(job?.diagnosis || '');
    setWsTroubleshooting(job?.troubleshooting_steps || '');
    setWsWorkPerformed(job?.work_performed || '');
    setWsNotes(job?.notes || '');
    setWsLaborCost(job?.repair_cost || 0);
    setWsParts(job?.parts_used || []);
    setWsError(null);
    setShowUnableDialog(false);
    setShowReplacementDialog(false);
  };

  // Technician: Start Work
  const handleStartWork = async () => {
    if (!showWorkspaceModal?.repair_job) return;
    try {
      await apiRequest(`/faults/repairs/${showWorkspaceModal.repair_job.id}/start`, {
        method: 'POST'
      });
      loadFaults();
      // Update local state
      const updated = await apiRequest<FaultReport>(`/faults/${showWorkspaceModal.id}`);
      setShowWorkspaceModal(updated);
    } catch (err: any) {
      setWsError(`Could not start work: ${err.message}`);
    }
  };

  // Technician: Add Part Row
  const handleAddPartRow = () => {
    setWsParts(prev => [
      ...prev,
      { part_name: '', part_number: '', quantity: 1, unit_cost: 0 }
    ]);
  };

  // Technician: Remove Part Row
  const handleRemovePartRow = (index: number) => {
    setWsParts(prev => prev.filter((_, i) => i !== index));
  };

  // Technician: Update Part Field
  const handleUpdatePartField = (index: number, field: keyof RepairPartItem, value: any) => {
    setWsParts(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const calculatedPartsTotal = wsParts.reduce((acc, p) => acc + (Number(p.quantity || 0) * Number(p.unit_cost || 0)), 0);
  const totalRepairCost = Number(wsLaborCost || 0) + calculatedPartsTotal;

  // Technician: Save Draft Update
  const handleSaveWorkspaceDraft = async () => {
    if (!showWorkspaceModal?.repair_job) return;
    setWsError(null);
    try {
      await apiRequest(`/faults/repairs/${showWorkspaceModal.repair_job.id}/update`, {
        method: 'PUT',
        body: JSON.stringify({
          diagnosis: wsDiagnosis.trim() || undefined,
          troubleshooting_steps: wsTroubleshooting.trim() || undefined,
          work_performed: wsWorkPerformed.trim() || undefined,
          notes: wsNotes.trim() || undefined,
          repair_cost: totalRepairCost,
          parts_used: wsParts.filter(p => p.part_name.trim().length > 0)
        })
      });
      loadFaults();
      alert('Repair workspace progress saved successfully.');
    } catch (err: any) {
      setWsError(`Save failed: ${err.message}`);
    }
  };

  // Technician: Complete Repair (Submit for Verification)
  const handleSubmitCompletion = async () => {
    if (!showWorkspaceModal?.repair_job) return;
    if (!wsDiagnosis.trim() || !wsWorkPerformed.trim()) {
      setWsError('Please document both the Diagnostic Finding and the Work Performed before submitting for verification.');
      return;
    }
    setWsError(null);
    try {
      // First save current details
      await apiRequest(`/faults/repairs/${showWorkspaceModal.repair_job.id}/update`, {
        method: 'PUT',
        body: JSON.stringify({
          diagnosis: wsDiagnosis.trim(),
          troubleshooting_steps: wsTroubleshooting.trim() || undefined,
          work_performed: wsWorkPerformed.trim(),
          notes: wsNotes.trim() || undefined,
          repair_cost: totalRepairCost,
          parts_used: wsParts.filter(p => p.part_name.trim().length > 0)
        })
      });

      // Submit completion
      await apiRequest(`/faults/repairs/${showWorkspaceModal.repair_job.id}/complete`, {
        method: 'POST'
      });

      setShowWorkspaceModal(null);
      loadFaults();
      alert('Repair submitted for Instructor verification.');
    } catch (err: any) {
      setWsError(`Submission failed: ${err.message}`);
    }
  };

  // Technician: Unable to Repair
  const handleMarkUnableToRepair = async () => {
    if (!showWorkspaceModal?.repair_job || !wsUnableReason.trim()) {
      setWsError('A detailed reason is required explaining why this asset is unrepairable.');
      return;
    }
    try {
      await apiRequest(`/faults/repairs/${showWorkspaceModal.repair_job.id}/unable-to-repair`, {
        method: 'POST',
        body: JSON.stringify({ reason: wsUnableReason.trim() })
      });
      setShowWorkspaceModal(null);
      loadFaults();
    } catch (err: any) {
      setWsError(`Unable to complete action: ${err.message}`);
    }
  };

  // Technician: Recommend Replacement
  const handleRecommendReplacement = async () => {
    if (!showWorkspaceModal?.repair_job || !wsReplacementReason.trim()) {
      setWsError('A detailed justification is required to recommend equipment replacement.');
      return;
    }
    try {
      await apiRequest(`/faults/repairs/${showWorkspaceModal.repair_job.id}/recommend-replacement`, {
        method: 'POST',
        body: JSON.stringify({ reason: wsReplacementReason.trim() })
      });
      setShowWorkspaceModal(null);
      loadFaults();
    } catch (err: any) {
      setWsError(`Unable to recommend replacement: ${err.message}`);
    }
  };

  // Instructor: Verify Repair
  const handleInstructorVerify = async () => {
    if (!showVerifyModal?.repair_job) return;
    setVerifyError(null);

    // Anti-Self-Verification check on client UI
    if (user?.id === showVerifyModal.repair_job.technician_id && user?.role !== 'ADMIN') {
      setVerifyError('Anti-Self-Verification Guard: You cannot verify a repair that you were assigned to perform. An independent Lab Instructor or Administrator must inspect and verify.');
      return;
    }

    if (!verifyApproved && (!verifyRejectionReason || verifyRejectionReason.trim().length < 5)) {
      setVerifyError('A detailed rejection reason (minimum 5 characters) is required when rejecting completion.');
      return;
    }

    try {
      await apiRequest(`/faults/repairs/${showVerifyModal.repair_job.id}/verify`, {
        method: 'POST',
        body: JSON.stringify({
          is_verified: verifyApproved,
          verification_notes: verifyNotes.trim() || undefined,
          rejection_reason: !verifyApproved ? verifyRejectionReason.trim() : undefined
        })
      });
      setShowVerifyModal(null);
      setVerifyNotes('');
      setVerifyRejectionReason('');
      loadFaults();
    } catch (err: any) {
      setVerifyError(err.message || 'Verification failed.');
    }
  };

  // Instructor/Admin: Reject Ticket
  const handleRejectTicket = async () => {
    if (!showRejectModal || !rejectReason.trim()) {
      alert('A valid reason is required to reject this fault report.');
      return;
    }
    try {
      await apiRequest(`/faults/${showRejectModal.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ rejection_reason: rejectReason.trim() })
      });
      setShowRejectModal(null);
      setRejectReason('');
      loadFaults();
    } catch (err: any) {
      alert(`Rejection failed: ${err.message}`);
    }
  };

  // Instructor/Admin: Reopen Ticket
  const handleReopenTicket = async () => {
    if (!showReopenModal || !reopenReason.trim()) {
      alert('A justification is required to reopen this ticket.');
      return;
    }
    try {
      await apiRequest(`/faults/${showReopenModal.id}/reopen`, {
        method: 'POST',
        body: JSON.stringify({ reopen_reason: reopenReason.trim() })
      });
      setShowReopenModal(null);
      setReopenReason('');
      loadFaults();
    } catch (err: any) {
      alert(`Reopening failed: ${err.message}`);
    }
  };

  // Export CSV Action
  const handleExportCSV = async () => {
    try {
      const blob = await apiRequest('/faults/export-csv');
      const url = window.URL.createObjectURL(blob as any);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SMVITM_Fault_Maintenance_Report_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  // Filtered Faults
  const filteredFaults = faults.filter(f => {
    if (filterLab && f.lab_id !== Number(filterLab)) return false;
    if (filterStatus && f.status !== filterStatus) return false;
    if (filterPriority && f.priority !== filterPriority) return false;
    if (filterCategory && f.fault_category !== filterCategory) return false;
    if (filterSafetyHazard && !f.is_safety_hazard) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchReport = f.report_number.toLowerCase().includes(q);
      const matchTitle = (f.title || '').toLowerCase().includes(q);
      const matchAsset = (f.asset_custom_id || '').toLowerCase().includes(q);
      const matchDesc = f.description.toLowerCase().includes(q);
      const matchTech = (f.repair_job?.technician_name || '').toLowerCase().includes(q);
      if (!matchReport && !matchTitle && !matchAsset && !matchDesc && !matchTech) return false;
    }
    return true;
  });

  // KPI Calculations
  const totalOpenFaults = faults.filter(f => f.status !== 'Verified and Closed' && f.status !== 'Rejected').length;
  const inProgressRepairs = faults.filter(f => f.status === 'In Progress' || f.status === 'Waiting for Parts').length;
  const awaitingVerification = faults.filter(f => f.status === 'Repair Completed — Awaiting Verification').length;
  const criticalHazards = faults.filter(f => f.is_safety_hazard || f.priority === 'Critical').length;

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'Critical':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white shadow-xs animate-pulse">
            <ShieldAlert className="h-3 w-3 mr-1 inline" /> CRITICAL
          </span>
        );
      case 'High':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            High
          </span>
        );
      case 'Medium':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            Medium
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
            Low
          </span>
        );
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'Reported':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">Reported</span>;
      case 'Reviewed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-800 border border-sky-200">Reviewed</span>;
      case 'Assigned':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">Assigned</span>;
      case 'In Progress':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">In Progress</span>;
      case 'Waiting for Parts':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">Waiting for Parts</span>;
      case 'Repair Completed — Awaiting Verification':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300 shadow-xs animate-pulse">
            <Clock className="h-3 w-3 mr-1" /> Awaiting Verification
          </span>
        );
      case 'Verified and Closed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle className="h-3 w-3 mr-1 text-emerald-600" /> Verified & Closed
          </span>
        );
      case 'Rejected':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">Rejected</span>;
      case 'Unable to Repair':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-200 text-zinc-800 border border-zinc-300">Unable to Repair</span>;
      case 'Replacement Recommended':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-800 border border-orange-200">Replacement Recommended</span>;
      case 'Reopened':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">Reopened</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">{s}</span>;
    }
  };

  return (
    <div className="space-y-6">

      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-navy-50 rounded-xl text-navy-900 border border-navy-100">
              <Wrench className="h-5 w-5 text-navy-800" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-navy-900 tracking-tight">
                Fault Reporting & Technician Repair Management
              </h1>
              <p className="text-xs text-slate-500">
                SMVITM Laboratory Maintenance Lifecycle &bull; Department of Artificial Intelligence & Data Science
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

          {isInstructorOrAdmin && (
            <button
              onClick={() => {
                setShowReportModal(true);
                setReportAssetId('');
              }}
              className="flex items-center space-x-1.5 bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl text-xs font-semibold transition shadow-sm shadow-rose-600/20"
            >
              <Plus className="h-4 w-4" />
              <span>Report Equipment Fault</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 block">Total Active Faults</span>
            <span className="text-2xl font-bold text-navy-900">{totalOpenFaults}</span>
          </div>
          <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 block">Repairs In Progress</span>
            <span className="text-2xl font-bold text-indigo-700">{inProgressRepairs}</span>
          </div>
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
            <Wrench className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 block">Awaiting Verification</span>
            <span className="text-2xl font-bold text-purple-700">{awaitingVerification}</span>
          </div>
          <div className="p-2.5 bg-purple-50 text-purple-700 rounded-xl">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 block">Safety Hazards / Critical</span>
            <span className="text-2xl font-bold text-rose-600">{criticalHazards}</span>
          </div>
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
            <ShieldAlert className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Tabs & Search Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
          <div className="flex space-x-2">
            <button
              onClick={() => handleTabChange('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'all'
                  ? 'bg-navy-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Fault Tickets ({faults.length})
            </button>
            {isTechnician && (
              <button
                onClick={() => handleTabChange('my-repairs')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === 'my-repairs'
                    ? 'bg-indigo-700 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Wrench className="h-3.5 w-3.5" />
                <span>My Assigned Repairs</span>
              </button>
            )}
          </div>

          {/* Safety Hazard Quick Toggle */}
          <button
            onClick={() => setFilterSafetyHazard(prev => !prev)}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              filterSafetyHazard
                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                : 'bg-slate-50 text-rose-700 border-rose-200 hover:bg-rose-50'
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Safety Hazards Only</span>
          </button>
        </div>

        {/* Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 text-xs">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by ticket #, equipment ID, title, or technician..."
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600"
            />
          </div>

          <div>
            <select
              value={filterLab}
              onChange={(e) => setFilterLab(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600"
            >
              <option value="">All Laboratories</option>
              {labs.map(l => (
                <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600"
            >
              <option value="">All Statuses</option>
              {FAULT_STATUSES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600"
            >
              <option value="">All Priorities</option>
              {FAULT_PRIORITIES.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Fault Ticket Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-400" />
            Synchronizing laboratory fault tickets...
          </div>
        ) : filteredFaults.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="font-semibold text-slate-700 text-sm">No Fault Tickets Found</p>
            <p className="text-slate-400 mt-0.5">All monitored laboratory equipment is operating normally.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">Ticket & Date</th>
                  <th className="py-3 px-4">Equipment & Location</th>
                  <th className="py-3 px-4">Fault Category & Title</th>
                  <th className="py-3 px-4">Priority & Safety</th>
                  <th className="py-3 px-4">Status & Tech</th>
                  <th className="py-3 px-4 text-right">Workflow Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFaults.map((fault) => (
                  <tr
                    key={fault.id}
                    className={`hover:bg-slate-50/80 transition ${
                      fault.is_safety_hazard ? 'bg-rose-50/20' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4 font-mono">
                      <div className="font-bold text-navy-900">{fault.report_number}</div>
                      <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                        {new Date(fault.created_at).toLocaleDateString()} &bull; {new Date(fault.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {fault.asset_custom_id ? (
                        <div>
                          <span className="font-mono font-bold text-slate-900 block">{fault.asset_custom_id}</span>
                          <span className="text-slate-600 text-[11px] block">{fault.asset_name}</span>
                        </div>
                      ) : fault.bulk_item_name ? (
                        <div>
                          <span className="font-semibold text-slate-900 block">{fault.bulk_item_name}</span>
                          <span className="text-[10px] text-slate-400">Bulk Stock Item</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">Lab Facility Infrastructure</span>
                      )}
                      <span className="inline-block mt-1 px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">
                        {fault.lab_name || `Lab ${fault.lab_id}`}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="font-semibold text-slate-900 truncate">
                        {fault.title || fault.description.slice(0, 40)}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {fault.fault_category}
                      </div>
                      {fault.attachment_url && (
                        <a
                          href={`http://localhost:8000${fault.attachment_url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center text-[10px] text-blue-600 hover:underline mt-1"
                        >
                          <Paperclip className="h-3 w-3 mr-0.5" /> Attachment Attached
                        </a>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <div>{getPriorityBadge(fault.priority)}</div>
                        {fault.is_safety_hazard && (
                          <div className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded border border-rose-200 inline-flex items-center">
                            <ShieldAlert className="h-3 w-3 mr-1" /> Safety Hazard
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div>{getStatusBadge(fault.status)}</div>
                      {fault.repair_job?.technician_name ? (
                        <div className="text-[11px] text-slate-600 mt-1 font-medium flex items-center">
                          <UserCheck className="h-3 w-3 mr-1 text-slate-400" />
                          {fault.repair_job.technician_name}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic block mt-1">Unassigned</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                      {/* View Details Modal Trigger */}
                      <button
                        onClick={async () => {
                          try {
                            const full = await apiRequest<FaultReport>(`/faults/${fault.id}`);
                            setSelectedDetailFault(full);
                          } catch {
                            setSelectedDetailFault(fault);
                          }
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-medium transition"
                      >
                        <Eye className="h-3 w-3 inline mr-1" />
                        Details
                      </button>

                      {/* Instructor/Admin: Assign Technician */}
                      {isInstructorOrAdmin && (fault.status === 'Reported' || fault.status === 'Reviewed' || fault.status === 'Reopened') && (
                        <button
                          onClick={() => {
                            setShowAssignModal(fault);
                            setAssignTechId(technicians[0]?.id || '');
                            setAssignError(null);
                          }}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg text-[11px] font-semibold transition"
                        >
                          <UserCheck className="h-3 w-3 inline mr-1" />
                          Assign
                        </button>
                      )}

                      {/* Technician Repair Workspace */}
                      {isTechnician && fault.repair_job && (
                        <button
                          onClick={() => openTechnicianWorkspace(fault)}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-[11px] font-semibold transition"
                        >
                          <Wrench className="h-3 w-3 inline mr-1" />
                          Workspace
                        </button>
                      )}

                      {/* Instructor Verification */}
                      {isInstructorOrAdmin && fault.status === 'Repair Completed — Awaiting Verification' && (
                        <button
                          onClick={() => {
                            setShowVerifyModal(fault);
                            setVerifyApproved(true);
                            setVerifyNotes('');
                            setVerifyRejectionReason('');
                            setVerifyError(null);
                          }}
                          className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-bold transition shadow-xs"
                        >
                          <CheckCircle className="h-3 w-3 inline mr-1" />
                          Verify
                        </button>
                      )}

                      {/* Instructor/Admin Reject Ticket */}
                      {isInstructorOrAdmin && (fault.status === 'Reported' || fault.status === 'Reviewed') && (
                        <button
                          onClick={() => {
                            setShowRejectModal(fault);
                            setRejectReason('');
                          }}
                          className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[11px] font-medium transition"
                        >
                          Reject
                        </button>
                      )}

                      {/* Instructor/Admin Reopen Ticket */}
                      {isInstructorOrAdmin && fault.status === 'Verified and Closed' && (
                        <button
                          onClick={() => {
                            setShowReopenModal(fault);
                            setReopenReason('');
                          }}
                          className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-[11px] font-medium transition"
                        >
                          Reopen
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
      {/* MODAL 1: REPORT EQUIPMENT FAULT                          */}
      {/* ======================================================== */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200">
            <div className="bg-navy-900 text-white p-4 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Wrench className="h-5 w-5 text-rose-400" />
                <h3 className="font-semibold text-sm">Report Laboratory Equipment Fault</h3>
              </div>
              <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReport} className="p-6 space-y-4 text-xs">
              {reportError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl">
                  {reportError}
                </div>
              )}

              {/* Lab Selector */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Laboratory *</label>
                <select
                  value={reportLabId}
                  onChange={(e) => setReportLabId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600 font-medium"
                >
                  {labs.map(l => (
                    <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
                  ))}
                </select>
              </div>

              {/* Target Type & Asset Picker */}
              <div className="space-y-2">
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="targetType"
                      checked={reportTargetType === 'asset'}
                      onChange={() => setReportTargetType('asset')}
                      className="text-navy-900 focus:ring-navy-600"
                    />
                    <span className="font-medium text-slate-800">Individual Equipment Asset</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="targetType"
                      checked={reportTargetType === 'infrastructure'}
                      onChange={() => setReportTargetType('infrastructure')}
                      className="text-navy-900 focus:ring-navy-600"
                    />
                    <span className="font-medium text-slate-800">Lab Infrastructure / Facilities</span>
                  </label>
                </div>

                {reportTargetType === 'asset' && (
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">Select Specific Asset</label>
                    <select
                      value={reportAssetId}
                      onChange={(e) => setReportAssetId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600 font-mono text-[11px]"
                    >
                      <option value="">-- Choose asset from this laboratory --</option>
                      {labAssets.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.asset_id} &bull; {a.name} ({a.status})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Short Title / Subject *</label>
                <input
                  type="text"
                  required
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  placeholder="e.g. Workstation 02 CPU Throttling, Bare Wire near Master DB, or AC Cooling Failure"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600"
                />
              </div>

              {/* Description + AI Button */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-slate-700">Detailed Fault Description *</label>
                  <button
                    type="button"
                    onClick={handleAiAutoClassify}
                    disabled={isClassifying}
                    className="flex items-center space-x-1 text-cyan-700 hover:text-cyan-900 font-bold text-[11px]"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-cyan-600" />
                    <span>{isClassifying ? 'Analyzing...' : 'AI Auto-Suggest Category & Priority'}</span>
                  </button>
                </div>
                <textarea
                  rows={3}
                  required
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Describe failure symptoms, error codes, burning odors, physical damage, or unusual noise..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600"
                />
              </div>

              {aiNotice && (
                <div className="p-3 bg-cyan-50 border border-cyan-200 text-cyan-900 rounded-xl text-xs space-y-1">
                  <div className="flex items-center space-x-1 font-bold">
                    <Sparkles className="h-4 w-4 text-cyan-600" />
                    <span>Scikit-Learn Machine Learning Diagnostic Result</span>
                  </div>
                  <p>{aiNotice}</p>
                </div>
              )}

              {/* Category & Priority Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fault Category *</label>
                  <select
                    value={reportCategory}
                    onChange={(e) => setReportCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600 font-medium"
                  >
                    {FAULT_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority Level *</label>
                  <select
                    value={reportPriority}
                    onChange={(e) => setReportPriority(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600 font-medium"
                  >
                    {FAULT_PRIORITIES.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Safety Concern Flag */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reportSafetyHazard}
                    onChange={(e) => setReportSafetyHazard(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500 h-4 w-4"
                  />
                  <span className="font-bold text-rose-800">
                    Flag as Safety Concern / Electrical Hazard
                  </span>
                </label>

                {reportSafetyHazard && (
                  <div>
                    <label className="block text-[11px] font-semibold text-rose-700 mb-1">
                      Safety Hazard Notice (shown in high-visibility red banner)
                    </label>
                    <input
                      type="text"
                      value={reportSafetyWarning}
                      onChange={(e) => setReportSafetyWarning(e.target.value)}
                      placeholder="e.g. DANGER: Do not switch ON the circuit breaker until inspected."
                      className="w-full px-3 py-1.5 border border-rose-300 rounded-lg text-rose-900 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                    />
                  </div>
                )}
              </div>

              {/* Photo / Attachment Upload */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Photo / Attachment (Optional)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    className="text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                  />
                  {isUploading && <span className="text-slate-400">Uploading...</span>}
                  {uploadedAttachmentUrl && (
                    <span className="text-emerald-600 font-semibold flex items-center">
                      <CheckCircle className="h-3.5 w-3.5 mr-1" /> Uploaded
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-semibold transition shadow-sm shadow-rose-600/20"
                >
                  Submit Fault Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: TICKET DETAILS & LIFECYCLE AUDIT TIMELINE       */}
      {/* ======================================================== */}
      {selectedDetailFault && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
            <div className="bg-navy-900 text-white p-4 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-cyan-400" />
                <div>
                  <h3 className="font-semibold text-sm">Ticket Details: {selectedDetailFault.report_number}</h3>
                  <p className="text-[10px] text-slate-400">{selectedDetailFault.title || selectedDetailFault.description.slice(0, 50)}</p>
                </div>
              </div>
              <button onClick={() => setSelectedDetailFault(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              
              {/* Prominent Safety Hazard Warning Banner */}
              {selectedDetailFault.is_safety_hazard && (
                <div className="p-3.5 bg-rose-50 border-2 border-rose-500 rounded-xl text-rose-900 flex items-start space-x-3 shadow-xs">
                  <ShieldAlert className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm text-rose-800">ELECTRICAL / PHYSICAL SAFETY CONCERN</h4>
                    <p className="text-xs text-rose-700 mt-0.5 font-medium">
                      {selectedDetailFault.safety_warning || 'Active safety warning attached to this equipment. Avoid operation until cleared by technicians.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Key Overview Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px]">Status:</span>
                  <div className="mt-0.5">{getStatusBadge(selectedDetailFault.status)}</div>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Priority:</span>
                  <div className="mt-0.5">{getPriorityBadge(selectedDetailFault.priority)}</div>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Category:</span>
                  <span className="font-semibold text-slate-800 block mt-0.5">{selectedDetailFault.fault_category}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Laboratory:</span>
                  <span className="font-semibold text-slate-800 block mt-0.5">
                    {selectedDetailFault.lab_name || `Lab ${selectedDetailFault.lab_id}`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Target Equipment:</span>
                  <span className="font-mono font-bold text-slate-900 block mt-0.5">
                    {selectedDetailFault.asset_custom_id || selectedDetailFault.bulk_item_name || 'General Lab Facility'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Reported By:</span>
                  <span className="font-medium text-slate-800 block mt-0.5">
                    {selectedDetailFault.reported_by_name || `User #${selectedDetailFault.reported_by_id}`}
                  </span>
                </div>
              </div>

              {/* Detailed Description */}
              <div>
                <span className="font-semibold text-slate-700 block mb-1">Issue Description</span>
                <p className="p-3 bg-white border border-slate-200 rounded-xl text-slate-800 leading-relaxed">
                  {selectedDetailFault.description}
                </p>
              </div>

              {/* Attachment Preview */}
              {selectedDetailFault.attachment_url && (
                <div className="flex items-center space-x-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <Paperclip className="h-4 w-4 text-slate-500" />
                  <span className="font-medium text-slate-700">Supporting File Attachment:</span>
                  <a
                    href={`http://localhost:8000${selectedDetailFault.attachment_url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 font-semibold hover:underline"
                  >
                    View / Download Attachment
                  </a>
                </div>
              )}

              {/* Repair Summary (if assigned/performed) */}
              {selectedDetailFault.repair_job && (
                <div className="space-y-2 border-t border-slate-200 pt-3">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                    <Wrench className="h-4 w-4 text-indigo-600" />
                    <span>Technician Repair Summary</span>
                  </h4>

                  <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3.5 space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-500 block">Assigned Technician:</span>
                        <span className="font-semibold text-indigo-900">{selectedDetailFault.repair_job.technician_name || 'Assigned'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Total Repair Cost:</span>
                        <span className="font-bold text-slate-900">₹{selectedDetailFault.repair_job.repair_cost || 0}</span>
                      </div>
                    </div>

                    {selectedDetailFault.repair_job.diagnosis && (
                      <div>
                        <span className="font-semibold text-slate-700 block">Diagnosis:</span>
                        <p className="text-slate-800">{selectedDetailFault.repair_job.diagnosis}</p>
                      </div>
                    )}

                    {selectedDetailFault.repair_job.work_performed && (
                      <div>
                        <span className="font-semibold text-slate-700 block">Work Performed:</span>
                        <p className="text-slate-800">{selectedDetailFault.repair_job.work_performed}</p>
                      </div>
                    )}

                    {selectedDetailFault.repair_job.parts_used && selectedDetailFault.repair_job.parts_used.length > 0 && (
                      <div>
                        <span className="font-semibold text-slate-700 block mb-1">Parts & Components Used:</span>
                        <table className="w-full text-[11px] bg-white rounded-lg border border-indigo-100 overflow-hidden">
                          <thead className="bg-indigo-50 text-indigo-900 font-semibold">
                            <tr>
                              <th className="py-1 px-2">Part Name</th>
                              <th className="py-1 px-2">Part #</th>
                              <th className="py-1 px-2">Qty</th>
                              <th className="py-1 px-2 text-right">Unit (₹)</th>
                              <th className="py-1 px-2 text-right">Total (₹)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-indigo-50">
                            {selectedDetailFault.repair_job.parts_used.map((p, idx) => (
                              <tr key={idx}>
                                <td className="py-1 px-2 font-medium">{p.part_name}</td>
                                <td className="py-1 px-2 font-mono text-[10px] text-slate-500">{p.part_number || 'N/A'}</td>
                                <td className="py-1 px-2">{p.quantity}</td>
                                <td className="py-1 px-2 text-right">₹{p.unit_cost}</td>
                                <td className="py-1 px-2 text-right font-semibold">₹{p.quantity * p.unit_cost}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {selectedDetailFault.repair_job.verification_notes && (
                      <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 text-emerald-900">
                        <span className="font-bold block">Verified by Lab Instructor:</span>
                        <p>{selectedDetailFault.repair_job.verification_notes}</p>
                        <span className="text-[10px] text-emerald-700">
                          {selectedDetailFault.repair_job.verified_at ? new Date(selectedDetailFault.repair_job.verified_at).toLocaleString() : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Status Audit Lifecycle History Timeline */}
              <div className="border-t border-slate-200 pt-3">
                <h4 className="font-bold text-slate-900 text-sm mb-2 flex items-center space-x-1.5">
                  <Clock className="h-4 w-4 text-navy-800" />
                  <span>Fault Ticket Lifecycle & Audit History</span>
                </h4>

                {selectedDetailFault.status_history && selectedDetailFault.status_history.length > 0 ? (
                  <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {selectedDetailFault.status_history.map((hist) => (
                      <div key={hist.id} className="relative">
                        <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-navy-600 border-2 border-white shadow-xs" />
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-900">{hist.action}</span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(hist.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 mt-0.5">
                            By <strong>{hist.changed_by_name || 'System'}</strong> ({hist.changed_by_role || 'STAFF'})
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
                  <p className="text-slate-400 italic">No transition history logged yet.</p>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setSelectedDetailFault(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: ASSIGN TECHNICIAN MODAL                         */}
      {/* ======================================================== */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-navy-900 text-white p-4 flex justify-between items-center">
              <h3 className="font-semibold text-sm">Assign Technician: {showAssignModal.report_number}</h3>
              <button onClick={() => setShowAssignModal(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              {assignError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl">
                  {assignError}
                </div>
              )}

              <p className="text-slate-600">
                Select an authorized college technician to diagnose and repair this equipment issue. Workload count is indicated beside each technician.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Technician Directory *</label>
                <select
                  value={assignTechId}
                  onChange={(e) => setAssignTechId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600 font-medium"
                >
                  {technicians.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} ({t.active_assigned_jobs} Active Jobs, {t.completed_repairs} Completed)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Expected Due Date (Optional)</label>
                <input
                  type="date"
                  value={assignDueDate}
                  onChange={(e) => setAssignDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assignment Instructions / Notes</label>
                <textarea
                  rows={2}
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  placeholder="e.g. Inspect GPU cooling block and thermal paste application..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  onClick={() => setShowAssignModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignTechnician}
                  className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-xl font-semibold transition"
                >
                  Dispatch Technician
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: TECHNICIAN REPAIR WORKSPACE                     */}
      {/* ======================================================== */}
      {showWorkspaceModal && showWorkspaceModal.repair_job && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
            <div className="bg-navy-900 text-white p-4 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Wrench className="h-5 w-5 text-amber-400" />
                <div>
                  <h3 className="font-semibold text-sm">Technician Repair Workspace</h3>
                  <p className="text-[10px] text-slate-400">
                    Ticket: {showWorkspaceModal.report_number} &bull; {showWorkspaceModal.title}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowWorkspaceModal(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              {wsError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl">
                  {wsError}
                </div>
              )}

              {/* Safety notice banner */}
              {showWorkspaceModal.is_safety_hazard && (
                <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl flex items-center space-x-2">
                  <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0" />
                  <span className="font-bold">
                    SAFETY WARNING: {showWorkspaceModal.safety_warning || 'High priority safety hazard flagged.'}
                  </span>
                </div>
              )}

              {/* Start Work Banner if Assigned */}
              {showWorkspaceModal.status === 'Assigned' && (
                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-blue-900">Job Assigned — Ready to Begin?</h4>
                    <p className="text-slate-600 text-[11px]">Click to officially mark this ticket "In Progress" and log job initiation.</p>
                  </div>
                  <button
                    onClick={handleStartWork}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs transition"
                  >
                    Start Work Now
                  </button>
                </div>
              )}

              {/* Diagnosis */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Root Cause / Diagnosis *</label>
                <textarea
                  rows={2}
                  value={wsDiagnosis}
                  onChange={(e) => setWsDiagnosis(e.target.value)}
                  placeholder="Root cause identified (e.g. Dried thermal paste, blown SMD capacitor, shorted cable)..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600"
                />
              </div>

              {/* Troubleshooting steps */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Troubleshooting Steps</label>
                <textarea
                  rows={2}
                  value={wsTroubleshooting}
                  onChange={(e) => setWsTroubleshooting(e.target.value)}
                  placeholder="Diagnostic procedures followed (e.g. Checked GPU junction temperatures under FurMark stress load)..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600"
                />
              </div>

              {/* Work performed */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Work Performed / Remediation *</label>
                <textarea
                  rows={2}
                  value={wsWorkPerformed}
                  onChange={(e) => setWsWorkPerformed(e.target.value)}
                  placeholder="Maintenance actions taken (e.g. Replaced heat sink thermal compound, cleaned fan assembly with compressed air)..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600"
                />
              </div>

              {/* Dynamic Parts Used Table */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-800">Replacement Parts & Consumables Used</span>
                  <button
                    type="button"
                    onClick={handleAddPartRow}
                    className="flex items-center space-x-1 px-2.5 py-1 bg-navy-900 text-white rounded-lg text-[10px] font-semibold hover:bg-navy-800 transition"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Part</span>
                  </button>
                </div>

                {wsParts.length === 0 ? (
                  <p className="text-slate-400 italic text-[11px]">No external parts or consumables logged for this repair.</p>
                ) : (
                  <div className="space-y-2">
                    {wsParts.map((part, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-lg border border-slate-200">
                        <div className="col-span-4">
                          <input
                            type="text"
                            placeholder="Part Name (e.g. Arctic MX-4)"
                            value={part.part_name}
                            onChange={(e) => handleUpdatePartField(index, 'part_name', e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            type="text"
                            placeholder="Part / SKU #"
                            value={part.part_number || ''}
                            onChange={(e) => handleUpdatePartField(index, 'part_number', e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-mono"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            min="1"
                            placeholder="Qty"
                            value={part.quantity}
                            onChange={(e) => handleUpdatePartField(index, 'quantity', Number(e.target.value))}
                            className="w-full px-2 py-1 border border-slate-200 rounded text-xs text-center"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            min="0"
                            placeholder="₹ Unit"
                            value={part.unit_cost}
                            onChange={(e) => handleUpdatePartField(index, 'unit_cost', Number(e.target.value))}
                            className="w-full px-2 py-1 border border-slate-200 rounded text-xs text-right"
                          />
                        </div>
                        <div className="col-span-1 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemovePartRow(index)}
                            className="text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="text-right font-semibold text-slate-700 text-xs pt-1">
                      Parts Subtotal: ₹{calculatedPartsTotal}
                    </div>
                  </div>
                )}
              </div>

              {/* Labor Cost & Total Cost */}
              <div className="grid grid-cols-2 gap-3 bg-white p-3 border border-slate-200 rounded-xl">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Labor / Service Cost (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={wsLaborCost}
                    onChange={(e) => setWsLaborCost(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Total Job Cost (Parts + Labor)</label>
                  <div className="text-lg font-bold text-navy-900 pt-1">
                    ₹{totalRepairCost}
                  </div>
                </div>
              </div>

              {/* Additional notes */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Technician Notes</label>
                <textarea
                  rows={2}
                  value={wsNotes}
                  onChange={(e) => setWsNotes(e.target.value)}
                  placeholder="Additional observations or post-repair test findings..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600"
                />
              </div>

              {/* Unable to Repair Sub-dialog */}
              {showUnableDialog && (
                <div className="p-3 bg-zinc-100 border border-zinc-300 rounded-xl space-y-2">
                  <label className="block font-bold text-zinc-900">Mandatory Reason for Inability to Repair:</label>
                  <textarea
                    rows={2}
                    value={wsUnableReason}
                    onChange={(e) => setWsUnableReason(e.target.value)}
                    placeholder="Specify why repair cannot be performed (e.g. Obsolete proprietary ASIC chips unavailable)..."
                    className="w-full px-3 py-1.5 border border-zinc-300 rounded-lg text-xs"
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => setShowUnableDialog(false)}
                      className="px-3 py-1 bg-slate-200 rounded text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleMarkUnableToRepair}
                      className="px-3 py-1 bg-zinc-800 text-white rounded font-bold text-xs"
                    >
                      Confirm Unable to Repair
                    </button>
                  </div>
                </div>
              )}

              {/* Recommend Replacement Sub-dialog */}
              {showReplacementDialog && (
                <div className="p-3 bg-orange-50 border border-orange-300 rounded-xl space-y-2">
                  <label className="block font-bold text-orange-900">Justification for Replacement Recommendation:</label>
                  <textarea
                    rows={2}
                    value={wsReplacementReason}
                    onChange={(e) => setWsReplacementReason(e.target.value)}
                    placeholder="Provide technical justification (e.g. Repair cost exceeds 60% of replacement value)..."
                    className="w-full px-3 py-1.5 border border-orange-300 rounded-lg text-xs"
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => setShowReplacementDialog(false)}
                      className="px-3 py-1 bg-slate-200 rounded text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRecommendReplacement}
                      className="px-3 py-1 bg-orange-600 text-white rounded font-bold text-xs"
                    >
                      Confirm Recommend Replacement
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex flex-wrap justify-between items-center gap-2">
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowUnableDialog(true)}
                    className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg font-medium transition"
                  >
                    Unable to Repair
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReplacementDialog(true)}
                    className="px-2.5 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-800 rounded-lg font-medium transition"
                  >
                    Recommend Replacement
                  </button>
                </div>

                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={handleSaveWorkspaceDraft}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition"
                  >
                    Save Progress Draft
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitCompletion}
                    className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold transition shadow-xs"
                  >
                    Submit for Instructor Verification
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: LAB INSTRUCTOR VERIFICATION                      */}
      {/* ======================================================== */}
      {showVerifyModal && showVerifyModal.repair_job && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="bg-navy-900 text-white p-4 flex justify-between items-center">
              <h3 className="font-semibold text-sm">Verify Completed Repair: {showVerifyModal.report_number}</h3>
              <button onClick={() => setShowVerifyModal(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              {verifyError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl">
                  {verifyError}
                </div>
              )}

              {/* Anti-Self-Verification notice */}
              {user?.id === showVerifyModal.repair_job.technician_id && user?.role !== 'ADMIN' ? (
                <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl">
                  <strong>Conflict of Interest Guard:</strong> You performed this repair and cannot verify your own work. Please request another Lab Instructor or Administrator to conduct the verification inspection.
                </div>
              ) : (
                <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl">
                  Please physically inspect and test the repaired equipment in the laboratory before approving final closure.
                </div>
              )}

              {/* Technician report recap */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-[11px]">
                <div>
                  <span className="font-semibold text-slate-700">Diagnosis: </span>
                  <span className="text-slate-900">{showVerifyModal.repair_job.diagnosis || 'None'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Work Done: </span>
                  <span className="text-slate-900">{showVerifyModal.repair_job.work_performed || 'None'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Total Repair Cost: </span>
                  <span className="font-bold text-slate-900">₹{showVerifyModal.repair_job.repair_cost || 0}</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-2">Inspection Outcome</label>
                <div className="flex space-x-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="verifyOutcome"
                      checked={verifyApproved === true}
                      onChange={() => setVerifyApproved(true)}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="font-semibold text-emerald-800">Approve & Restore to "Working"</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="verifyOutcome"
                      checked={verifyApproved === false}
                      onChange={() => setVerifyApproved(false)}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span className="font-semibold text-rose-700">Reject Completion (Return to In Progress)</span>
                  </label>
                </div>
              </div>

              {verifyApproved ? (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Verification Remarks (Optional)</label>
                  <textarea
                    rows={2}
                    value={verifyNotes}
                    onChange={(e) => setVerifyNotes(e.target.value)}
                    placeholder="e.g. Tested equipment during batch practicals; normal operational state confirmed."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600"
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-rose-700 mb-1">Mandatory Rejection Reason *</label>
                  <textarea
                    rows={2}
                    required
                    value={verifyRejectionReason}
                    onChange={(e) => setVerifyRejectionReason(e.target.value)}
                    placeholder="Specify why repair failed verification (e.g. Temperature still exceeds 90°C under load)..."
                    className="w-full px-3 py-2 border border-rose-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              )}

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  onClick={() => setShowVerifyModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInstructorVerify}
                  disabled={user?.id === showVerifyModal.repair_job.technician_id && user?.role !== 'ADMIN'}
                  className={`px-4 py-2 text-white rounded-xl font-semibold transition ${
                    verifyApproved
                      ? 'bg-emerald-700 hover:bg-emerald-800'
                      : 'bg-rose-600 hover:bg-rose-700'
                  } disabled:opacity-50`}
                >
                  {verifyApproved ? 'Verify & Close Ticket' : 'Reject Completion'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 6: REJECT TICKET (For invalid reports)              */}
      {/* ======================================================== */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-navy-900 text-white p-4 flex justify-between items-center">
              <h3 className="font-semibold text-sm">Reject Fault Report: {showRejectModal.report_number}</h3>
              <button onClick={() => setShowRejectModal(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-600">
                Rejecting this ticket will close it with a rejected status. A mandatory explanation is required for the audit record.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Rejection Reason *</label>
                <textarea
                  rows={3}
                  required
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Duplicate report, or cable was merely disconnected by student..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  onClick={() => setShowRejectModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectTicket}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold transition"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 7: REOPEN TICKET                                   */}
      {/* ======================================================== */}
      {showReopenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-navy-900 text-white p-4 flex justify-between items-center">
              <h3 className="font-semibold text-sm">Reopen Ticket: {showReopenModal.report_number}</h3>
              <button onClick={() => setShowReopenModal(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-600">
                Reopening a closed ticket returns it to the active fault queue. Provide technical justification.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Justification for Reopening *</label>
                <textarea
                  rows={3}
                  required
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="e.g. Same thermal shutdown occurred again during next morning lab session..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  onClick={() => setShowReopenModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReopenTicket}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold transition"
                >
                  Reopen Ticket
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
