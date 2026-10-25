import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import {
  Calendar,
  Clock,
  Plus,
  AlertCircle,
  Wrench,
  CheckCircle,
  X
} from 'lucide-react';

interface TimetableSlot {
  id: number;
  lab_id: number;
  day_of_week: string;
  start_time: string;
  end_time: string;
  subject: string;
  batch_or_class: string;
  instructor_name: string;
  is_maintenance: boolean;
  notes?: string;
}

export const TimetablePage: React.FC = () => {
  const { user } = useAuth();
  const [selectedLab, setSelectedLab] = useState<number>(1);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal
  const [showBookModal, setShowBookModal] = useState(false);
  const [day, setDay] = useState('Monday');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('11:00');
  const [subject, setSubject] = useState('');
  const [batch, setBatch] = useState('AIDS 5th Sem - Batch A');
  const [instructor, setInstructor] = useState(user?.full_name || '');
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    loadSlots();
  }, [selectedLab]);

  const loadSlots = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<TimetableSlot[]>(`/timetable?lab_id=${selectedLab}`);
      setSlots(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBookSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await apiRequest('/timetable', {
        method: 'POST',
        body: JSON.stringify({
          lab_id: selectedLab,
          day_of_week: day,
          start_time: startTime,
          end_time: endTime,
          subject: subject.trim(),
          batch_or_class: batch.trim(),
          instructor_name: instructor.trim(),
          is_maintenance: isMaintenance,
          notes: notes.trim() || undefined
        })
      });
      setShowBookModal(false);
      setSubject('');
      loadSlots();
    } catch (err: any) {
      setErrorMsg(err.message || 'Collision detected. Slot unavailable.');
    }
  };

  const canBook = user?.role === 'LAB_INSTRUCTOR' || user?.role === 'ADMIN';

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-navy-900 tracking-tight">
            Laboratory Timetable & Utilization
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Weekly academic scheduling, collision prevention, and scheduled preventive maintenance slots.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          {/* Lab Selector Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setSelectedLab(1)}
              className={`px-3 py-1.5 rounded-lg transition ${
                selectedLab === 1 ? 'bg-navy-900 text-white shadow' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Lab 1 (AI & DL)
            </button>
            <button
              onClick={() => setSelectedLab(2)}
              className={`px-3 py-1.5 rounded-lg transition ${
                selectedLab === 2 ? 'bg-navy-900 text-white shadow' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Lab 2 (Data Science)
            </button>
          </div>

          {canBook && (
            <button
              onClick={() => {
                setShowBookModal(true);
                setErrorMsg(null);
              }}
              className="flex items-center space-x-1.5 bg-navy-900 hover:bg-navy-800 text-white px-4 py-2 rounded-xl text-xs font-semibold transition shadow-md shadow-navy-900/10"
            >
              <Plus className="h-4 w-4" />
              <span>Book Slot</span>
            </button>
          )}
        </div>
      </div>

      {/* Weekly Schedule Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {days.map((d) => {
          const daySlots = slots.filter(s => s.day_of_week.toLowerCase() === d.toLowerCase());
          return (
            <div key={d} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="font-bold text-sm text-navy-900">{d}</span>
                <span className="text-[10px] text-slate-400 font-medium">
                  {daySlots.length} session(s)
                </span>
              </div>

              <div className="space-y-2.5">
                {daySlots.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs italic bg-slate-50/50 rounded-xl">
                    Laboratory Free / Unreserved
                  </div>
                ) : (
                  daySlots.map((s) => (
                    <div
                      key={s.id}
                      className={`p-3 rounded-xl border text-xs space-y-1.5 transition ${
                        s.is_maintenance
                          ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                          : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-xs">{s.subject}</span>
                        {s.is_maintenance && (
                          <span className="bg-amber-200 text-amber-900 text-[9px] px-1.5 py-0.5 rounded font-bold flex items-center">
                            <Wrench className="h-2.5 w-2.5 mr-0.5 inline" /> Maintenance
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-1 text-[11px] text-slate-600 font-medium">
                        <Clock className="h-3 w-3 text-slate-400" />
                        <span>{s.start_time} - {s.end_time}</span>
                      </div>

                      <div className="text-[10px] text-slate-500 flex justify-between">
                        <span>{s.batch_or_class}</span>
                        <span className="font-semibold text-slate-700">{s.instructor_name}</span>
                      </div>

                      {s.notes && (
                        <div className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-200/60">
                          {s.notes}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Book Slot */}
      {showBookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-navy-900 text-white p-4 flex justify-between items-center">
              <h3 className="font-semibold text-sm">Schedule Laboratory Session</h3>
              <button onClick={() => setShowBookModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleBookSlot} className="p-6 space-y-3.5 text-xs">
              
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Subject / Activity Name</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Natural Language Processing Lab (BAI601L)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Day of Week</label>
                  <select
                    value={day}
                    onChange={(e) => setDay(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600"
                  >
                    {days.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Class / Student Batch</label>
                  <input
                    type="text"
                    required
                    value={batch}
                    onChange={(e) => setBatch(e.target.value)}
                    placeholder="AIDS 5th Sem - Batch A"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Start Time (24h)</label>
                  <input
                    type="text"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    placeholder="09:00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">End Time (24h)</label>
                  <input
                    type="text"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    placeholder="11:00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Instructor in Charge</label>
                <input
                  type="text"
                  required
                  value={instructor}
                  onChange={(e) => setInstructor(e.target.value)}
                  placeholder="Enter instructor in charge"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="isMaint"
                  checked={isMaintenance}
                  onChange={(e) => setIsMaintenance(e.target.checked)}
                  className="rounded text-navy-900 focus:ring-navy-600"
                />
                <label htmlFor="isMaint" className="font-semibold text-slate-700 cursor-pointer">
                  Reserve as Maintenance / System OS Update Window
                </label>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowBookModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-xl font-semibold transition"
                >
                  Verify & Book Slot
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
