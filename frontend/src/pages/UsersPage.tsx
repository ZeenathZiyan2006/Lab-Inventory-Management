import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import { Users, Plus, Shield, CheckCircle, XCircle, X, Edit3 } from 'lucide-react';

interface UserRecord {
  id: number;
  email: string;
  full_name: string;
  role: string;
  phone_number?: string;
  is_active: boolean;
  assigned_labs: number[];
  created_at: string;
}

export const UsersPage: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('LAB_INSTRUCTOR');
  const [phone, setPhone] = useState('');
  const [labIds, setLabIds] = useState<number[]>([1]);
  const [isActive, setIsActive] = useState<boolean>(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<UserRecord[]>('/users');
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          full_name: fullName.trim(),
          password,
          role,
          phone_number: phone.trim() || undefined,
          department_id: 1,
          assigned_lab_ids: labIds
        })
      });
      setShowAddModal(false);
      resetForm();
      loadUsers();
    } catch (err: any) {
      alert(`User creation failed: ${err.message}`);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await apiRequest(`/users/${editingUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          full_name: fullName.trim(),
          role,
          phone_number: phone.trim() || undefined,
          is_active: isActive,
          assigned_lab_ids: labIds
        })
      });
      setEditingUser(null);
      resetForm();
      loadUsers();
    } catch (err: any) {
      alert(`User update failed: ${err.message}`);
    }
  };

  const openEditModal = (u: UserRecord) => {
    setEditingUser(u);
    setFullName(u.full_name);
    setEmail(u.email);
    setRole(u.role);
    setPhone(u.phone_number || '');
    setIsActive(u.is_active);
    setLabIds(u.assigned_labs || [1]);
  };

  const resetForm = () => {
    setEmail('');
    setFullName('');
    setPassword('');
    setPhone('');
    setRole('LAB_INSTRUCTOR');
    setIsActive(true);
    setLabIds([1]);
  };

  const getRoleBadge = (r: string) => {
    switch (r) {
      case 'ADMIN':
        return <span className="bg-purple-100 text-purple-800 text-[10px] px-2.5 py-0.5 rounded-full font-bold">Admin</span>;
      case 'LAB_INSTRUCTOR':
        return <span className="bg-blue-100 text-blue-800 text-[10px] px-2.5 py-0.5 rounded-full font-bold">Lab Instructor</span>;
      case 'TECHNICIAN':
        return <span className="bg-amber-100 text-amber-800 text-[10px] px-2.5 py-0.5 rounded-full font-bold">Technician</span>;
      case 'HOD':
        return <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2.5 py-0.5 rounded-full font-bold">HOD (AI & DS)</span>;
      case 'PRINCIPAL':
        return <span className="bg-rose-100 text-rose-800 text-[10px] px-2.5 py-0.5 rounded-full font-bold">Principal</span>;
      default:
        return <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded-full">{r}</span>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-navy-900 tracking-tight">
            User Accounts & Role-Based Access Control
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage academic staff, laboratory instructors, technicians, and administrative credentials.
          </p>
        </div>

        {user?.role === 'ADMIN' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-1.5 bg-navy-900 hover:bg-navy-800 text-white px-4 py-2 rounded-xl text-xs font-semibold transition shadow-md shadow-navy-900/10"
          >
            <Plus className="h-4 w-4" />
            <span>Create User Account</span>
          </button>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading user credentials...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Institutional Email</th>
                  <th className="py-3 px-4">Assigned Role</th>
                  <th className="py-3 px-4">Lab Scopes</th>
                  <th className="py-3 px-4">Contact Phone</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  {user?.role === 'ADMIN' && (
                    <th className="py-3 px-4 text-center">Action</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-semibold text-slate-900">{u.full_name}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{u.email}</td>
                    <td className="py-3 px-4">{getRoleBadge(u.role)}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {u.assigned_labs.length > 0 ? (
                        <span>Lab {u.assigned_labs.join(', Lab ')}</span>
                      ) : (
                        <span className="text-slate-400">All / Unrestricted</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{u.phone_number || '—'}</td>
                    <td className="py-3 px-4 text-center">
                      {u.is_active ? (
                        <span className="text-emerald-600 font-semibold text-[11px] flex items-center justify-center">
                          <CheckCircle className="h-3.5 w-3.5 mr-1 inline" /> Active
                        </span>
                      ) : (
                        <span className="text-rose-600 font-semibold text-[11px] flex items-center justify-center">
                          <XCircle className="h-3.5 w-3.5 mr-1 inline" /> Disabled
                        </span>
                      )}
                    </td>
                    {user?.role === 'ADMIN' && (
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => openEditModal(u)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition"
                          title="Edit User Profile & Role"
                        >
                          <Edit3 className="h-3 w-3 text-slate-600" />
                          <span>Edit</span>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create User */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-navy-900 text-white p-4 flex justify-between items-center">
              <h3 className="font-semibold text-sm">Provision New User Account</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="p-6 space-y-3.5 text-xs">
              
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Dr. Ramesh Bhat"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ramesh.aids@sode-edu.in"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Initial Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Institutional Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600 font-medium"
                  >
                    <option value="LAB_INSTRUCTOR">Lab Instructor</option>
                    <option value="TECHNICIAN">Technician</option>
                    <option value="HOD">HOD</option>
                    <option value="PRINCIPAL">Principal</option>
                    <option value="ADMIN">Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98450 12345"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-xl font-semibold transition"
                >
                  Create User
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit User (Role, Name, Status, Lab Scopes) */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-navy-900 text-white p-4 flex justify-between items-center">
              <h3 className="font-semibold text-sm">Update Staff Personnel & Role</h3>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateUser} className="p-6 space-y-3.5 text-xs">
              
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Tejaswini H."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Institutional Email (Read Only)</label>
                <input
                  type="email"
                  disabled
                  value={email}
                  className="w-full px-3 py-2 border border-slate-200 bg-slate-100 text-slate-500 rounded-xl cursor-not-allowed font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Institutional Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600 font-medium"
                  >
                    <option value="LAB_INSTRUCTOR">Lab Instructor</option>
                    <option value="TECHNICIAN">Technician</option>
                    <option value="HOD">HOD</option>
                    <option value="PRINCIPAL">Principal</option>
                    <option value="ADMIN">Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Account Status</label>
                  <select
                    value={isActive ? 'active' : 'inactive'}
                    onChange={(e) => setIsActive(e.target.value === 'active')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600 font-medium"
                  >
                    <option value="active">Active (Access Allowed)</option>
                    <option value="inactive">Deactivated (Access Revoked)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98450 12345"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Labs</label>
                  <select
                    value={labIds.join(',')}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) setLabIds([]);
                      else setLabIds(val.split(',').map(Number));
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600 font-medium"
                  >
                    <option value="1">Lab 1 Only</option>
                    <option value="2">Lab 2 Only</option>
                    <option value="1,2">Lab 1 & Lab 2</option>
                    <option value="">Unassigned / All</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-xl font-semibold transition"
                >
                  Save Changes
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
