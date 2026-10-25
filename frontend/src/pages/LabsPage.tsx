import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import {
  Building2,
  Plus,
  Edit3,
  QrCode,
  Users,
  Monitor,
  AlertTriangle,
  Layers,
  MapPin,
  CheckCircle,
  X,
  Printer
} from 'lucide-react';

interface Laboratory {
  id: number;
  name: string;
  code: string;
  department_id: number;
  department_name?: string;
  room_number: string;
  description?: string;
  qr_code?: string;
  is_active: boolean;
  created_at: string;
  assigned_instructor_names?: string[];
  assigned_instructor_ids?: number[];
  active_equipment_count?: number;
  open_fault_count?: number;
  bulk_items_count?: number;
}

interface UserSummary {
  id: number;
  full_name: string;
  email: string;
  role: string;
}

interface DoorPlacardData {
  institution: string;
  department: string;
  lab_name: string;
  room_number: string;
  code: string;
  qr_code_token: string;
  qr_image_base64: string;
  instructors: string[];
}

export const LabsPage: React.FC = () => {
  const { user } = useAuth();
  const [labs, setLabs] = useState<Laboratory[]>([]);
  const [instructors, setInstructors] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(false);

  // Placard modal
  const [placardData, setPlacardData] = useState<DoorPlacardData | null>(null);

  // Edit / Create Lab modal
  const [showModal, setShowModal] = useState(false);
  const [editingLab, setEditingLab] = useState<Laboratory | null>(null);
  const [labName, setLabName] = useState('');
  const [labCode, setLabCode] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [description, setDescription] = useState('');
  const [selectedInstructors, setSelectedInstructors] = useState<number[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    loadLabs();
    if (isAdmin) {
      loadInstructors();
    }
  }, []);

  const loadLabs = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<Laboratory[]>('/labs');
      setLabs(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadInstructors = async () => {
    try {
      const data = await apiRequest<UserSummary[]>('/users');
      // Filter users who can be lab instructors
      setInstructors(data.filter(u => u.role === 'LAB_INSTRUCTOR' || u.role === 'ADMIN'));
    } catch (err) {
      console.error('Could not load instructors list:', err);
    }
  };

  const openCreateModal = () => {
    setEditingLab(null);
    setLabName('');
    setLabCode('');
    setRoomNumber('');
    setDescription('');
    setSelectedInstructors([]);
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (lab: Laboratory) => {
    setEditingLab(lab);
    setLabName(lab.name);
    setLabCode(lab.code);
    setRoomNumber(lab.room_number);
    setDescription(lab.description || '');
    setSelectedInstructors(lab.assigned_instructor_ids || []);
    setFormError(null);
    setShowModal(true);
  };

  const handleSaveLab = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);

    try {
      if (editingLab) {
        await apiRequest(`/labs/${editingLab.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: labName.trim(),
            code: labCode.trim().toUpperCase(),
            room_number: roomNumber.trim(),
            description: description.trim() || undefined,
            assigned_instructor_ids: selectedInstructors
          })
        });
      } else {
        await apiRequest('/labs', {
          method: 'POST',
          body: JSON.stringify({
            name: labName.trim(),
            code: labCode.trim().toUpperCase(),
            room_number: roomNumber.trim(),
            description: description.trim() || undefined,
            assigned_instructor_ids: selectedInstructors,
            department_id: 1
          })
        });
      }
      setShowModal(false);
      loadLabs();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save laboratory');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenPlacard = async (labId: number) => {
    try {
      const data = await apiRequest<DoorPlacardData>(`/labs/${labId}/label`);
      setPlacardData(data);
    } catch (err: any) {
      alert(`Could not fetch door placard: ${err.message}`);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-cyan-800 text-sm font-semibold tracking-wide uppercase">
            <Building2 className="h-4 w-4" />
            <span>Academic Facilities</span>
          </div>
          <h1 className="text-2xl font-bold text-navy-900 mt-1">
            Laboratory Management
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Department of Artificial Intelligence and Data Science — SMVITM, Bantakal
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={openCreateModal}
            className="flex items-center space-x-2 bg-navy-900 hover:bg-navy-800 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition shadow-sm hover:shadow"
          >
            <Plus className="h-4 w-4 text-cyan-400" />
            <span>Register New Laboratory</span>
          </button>
        )}
      </div>

      {/* Laboratories Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-400">Loading academic facilities...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {labs.map((lab) => (
            <div
              key={lab.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition overflow-hidden flex flex-col justify-between"
            >
              <div className="p-6 space-y-4">
                {/* Lab Card Header */}
                <div className="flex justify-between items-start">
                  <div>
                    <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-50 text-cyan-800 border border-cyan-200 mb-2">
                      <span>{lab.code}</span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">{lab.name}</h2>
                    <div className="flex items-center text-xs text-slate-500 mt-1 space-x-2">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <span>{lab.room_number}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenPlacard(lab.id)}
                    className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-navy-900 rounded-xl border border-slate-200 transition"
                    title="Print Door Placard"
                  >
                    <QrCode className="h-5 w-5 text-cyan-700" />
                  </button>
                </div>

                {lab.description && (
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                    {lab.description}
                  </p>
                )}

                {/* Live Statistics Counter Pills */}
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center space-x-1.5 text-slate-500 text-[11px] font-medium">
                      <Monitor className="h-3.5 w-3.5 text-cyan-600" />
                      <span>Equipment</span>
                    </div>
                    <div className="text-lg font-bold text-slate-900 mt-1">
                      {lab.active_equipment_count ?? 0}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center space-x-1.5 text-slate-500 text-[11px] font-medium">
                      <Layers className="h-3.5 w-3.5 text-indigo-600" />
                      <span>Bulk Items</span>
                    </div>
                    <div className="text-lg font-bold text-slate-900 mt-1">
                      {lab.bulk_items_count ?? 0}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center space-x-1.5 text-slate-500 text-[11px] font-medium">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      <span>Open Faults</span>
                    </div>
                    <div className={`text-lg font-bold mt-1 ${(lab.open_fault_count || 0) > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                      {lab.open_fault_count ?? 0}
                    </div>
                  </div>
                </div>

                {/* Assigned Instructors */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 mb-2">
                    <Users className="h-3.5 w-3.5 text-cyan-600" />
                    <span>In-Charge Instructors:</span>
                  </div>
                  {lab.assigned_instructor_names && lab.assigned_instructor_names.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {lab.assigned_instructor_names.map((name, i) => (
                        <span
                          key={i}
                          className="bg-white border border-slate-200 text-slate-800 text-xs px-2.5 py-1 rounded-lg font-medium shadow-2xs"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic">No instructors currently assigned.</span>
                  )}
                </div>
              </div>

              {/* Action Footer */}
              <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex justify-between items-center text-xs">
                <span className="text-slate-400">QR Token: {lab.qr_code}</span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleOpenPlacard(lab.id)}
                    className="flex items-center space-x-1 text-slate-700 hover:text-navy-900 font-medium px-2.5 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
                  >
                    <Printer className="h-3.5 w-3.5 text-slate-500" />
                    <span>Placard</span>
                  </button>

                  {isAdmin && (
                    <button
                      onClick={() => openEditModal(lab)}
                      className="flex items-center space-x-1 text-cyan-800 hover:text-cyan-900 font-medium px-2.5 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
                    >
                      <Edit3 className="h-3.5 w-3.5 text-cyan-600" />
                      <span>Edit Lab</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Laboratory Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="bg-navy-900 text-white p-5 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Building2 className="h-5 w-5 text-cyan-400" />
                <h3 className="font-semibold text-base">
                  {editingLab ? `Edit ${editingLab.name}` : 'Register New Laboratory'}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLab} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Laboratory Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AI & High-Performance Computing Lab"
                  value={labName}
                  onChange={(e) => setLabName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Laboratory Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AIDS-LAB-01"
                    value={labCode}
                    onChange={(e) => setLabCode(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Room Number / Location *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Academic Block A, Room 301"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description & Facilities
                </label>
                <textarea
                  rows={2}
                  placeholder="Focus areas, seating capacity, special GPU clusters, etc."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assign Instructors / Lab Staff
                </label>
                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1 bg-slate-50">
                  {instructors.map((inst) => (
                    <label
                      key={inst.id}
                      className="flex items-center space-x-2 text-xs p-1.5 hover:bg-white rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedInstructors.includes(inst.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedInstructors([...selectedInstructors, inst.id]);
                          } else {
                            setSelectedInstructors(selectedInstructors.filter(id => id !== inst.id));
                          }
                        }}
                        className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 h-4 w-4"
                      />
                      <span className="font-medium text-slate-800">{inst.full_name}</span>
                      <span className="text-slate-400">({inst.email})</span>
                    </label>
                  ))}
                  {instructors.length === 0 && (
                    <div className="text-xs text-slate-400 p-1">No instructors available</div>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-lg text-xs font-semibold transition"
                >
                  {saving ? 'Saving...' : editingLab ? 'Save Changes' : 'Create Laboratory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Door Placard Modal */}
      {placardData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-navy-900 text-white p-4 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <QrCode className="h-5 w-5 text-cyan-400" />
                <h3 className="font-semibold text-sm">Laboratory Door Placard</h3>
              </div>
              <button
                onClick={() => setPlacardData(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Placard Card (Printable Sheet) */}
            <div id="door-placard-sheet" className="p-6 bg-white space-y-4 text-center">
              {/* College Header */}
              <div className="flex flex-col items-center border-b pb-3 border-slate-200">
                <img
                  src="/images/smvitm-logo.jfif"
                  alt="SMVITM Logo"
                  className="h-16 w-auto object-contain mb-2"
                  onError={(e) => {
                    // Fallback if logo not loaded
                    (e.target as any).style.display = 'none';
                  }}
                />
                <h2 className="text-sm font-bold text-navy-900 leading-tight uppercase">
                  {placardData.institution}
                </h2>
                <p className="text-xs font-semibold text-cyan-800 mt-0.5">
                  {placardData.department}
                </p>
              </div>

              {/* Lab Title */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <h3 className="text-lg font-extrabold text-navy-900">{placardData.lab_name}</h3>
                <div className="text-xs font-bold text-slate-600 mt-1">
                  Room: {placardData.room_number} &bull; Code: {placardData.code}
                </div>
              </div>

              {/* QR Image */}
              <div className="flex flex-col items-center py-2">
                <div className="p-3 bg-white border-2 border-dashed border-slate-300 rounded-xl shadow-xs">
                  <img
                    src={placardData.qr_image_base64}
                    alt="Lab Door QR"
                    className="w-44 h-44 object-contain"
                  />
                </div>
                <div className="font-mono text-[10px] text-slate-400 mt-2 font-bold tracking-wider">
                  {placardData.qr_code_token}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Scan upon room entry for digital laboratory register, asset audit and fault reporting.
                </p>
              </div>

              {/* Instructors */}
              {placardData.instructors && placardData.instructors.length > 0 && (
                <div className="text-xs text-slate-700 border-t pt-3 border-slate-100">
                  <span className="font-bold block text-slate-900 mb-0.5">In-Charge Faculty / Staff:</span>
                  <span>{placardData.instructors.join(', ')}</span>
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center">
              <button
                onClick={() => setPlacardData(null)}
                className="px-4 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 transition"
              >
                Close
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center space-x-1.5 px-4 py-1.5 bg-navy-900 hover:bg-navy-800 text-white rounded-lg text-xs font-semibold transition"
              >
                <Printer className="h-4 w-4 text-cyan-400" />
                <span>Print Placard</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
