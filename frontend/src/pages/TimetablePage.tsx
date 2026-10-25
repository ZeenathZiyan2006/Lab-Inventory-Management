import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

  // Handle Escape key to dismiss booking modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showBookModal) {
        setShowBookModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showBookModal]);

  const canBook = user?.role === 'LAB_INSTRUCTOR' || user?.role === 'ADMIN';

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#050C1F]/90 p-5 rounded-2xl border border-cyan-500/30 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight drop-shadow-[0_0_10px_rgba(0,240,255,0.4)]">
            Laboratory Timetable & Utilization
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            Weekly academic scheduling, collision prevention, and scheduled preventive maintenance slots.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          {/* Lab Selector Toggle */}
          <div className="flex bg-[#030816] p-1 rounded-xl text-xs font-semibold border border-cyan-500/30">
            <button
              onClick={() => setSelectedLab(1)}
              className={`px-3.5 py-1.5 rounded-lg transition ${
                selectedLab === 1
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold shadow-[0_0_10px_rgba(0,240,255,0.4)]'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Lab 1 (AI & DL)
            </button>
            <button
              onClick={() => setSelectedLab(2)}
              className={`px-3.5 py-1.5 rounded-lg transition ${
                selectedLab === 2
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold shadow-[0_0_10px_rgba(0,240,255,0.4)]'
                  : 'text-slate-300 hover:text-white'
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
              className="flex items-center space-x-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-[0_0_15px_rgba(0,240,255,0.35)] active:scale-95"
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
            <div key={d} className="bg-[#050C1F]/90 rounded-2xl border border-cyan-500/25 shadow-[0_4px_24px_rgba(0,0,0,0.5)] p-4 space-y-3">
              <div className="flex justify-between items-center pb-2.5 border-b border-cyan-500/20">
                <span className="font-extrabold text-sm text-white tracking-wide">{d}</span>
                <span className="text-[11px] text-cyan-300 bg-cyan-950/70 border border-cyan-500/30 px-2.5 py-0.5 rounded-full font-bold">
                  {daySlots.length} session(s)
                </span>
              </div>

              <div className="space-y-2.5">
                {daySlots.length === 0 ? (
                  <div className="py-7 text-center text-slate-400 text-xs italic bg-[#030816]/70 border border-slate-800/80 rounded-xl">
                    Laboratory Free / Unreserved
                  </div>
                ) : (
                  daySlots.map((s) => (
                    <div
                      key={s.id}
                      className={`p-3.5 rounded-xl border text-xs space-y-2 transition ${
                        s.is_maintenance
                          ? 'border-amber-500/60 bg-[#251503]/90 text-amber-100 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                          : 'border-cyan-500/30 bg-[#06142E]/80 text-white hover:border-cyan-400/60 shadow-sm'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className={`font-bold text-xs leading-snug ${s.is_maintenance ? 'text-amber-200' : 'text-white'}`}>
                          {s.subject}
                        </span>
                        {s.is_maintenance && (
                          <span className="bg-amber-500/25 text-amber-300 border border-amber-400/50 text-[10px] px-2 py-0.5 rounded-md font-bold flex items-center shrink-0 ml-2">
                            <Wrench className="h-3 w-3 mr-1 inline" /> Maintenance
                          </span>
                        )}
                      </div>
                      
                      <div className={`flex items-center space-x-1.5 text-[11px] font-semibold ${s.is_maintenance ? 'text-amber-300' : 'text-cyan-300'}`}>
                        <Clock className={`h-3.5 w-3.5 ${s.is_maintenance ? 'text-amber-400' : 'text-cyan-400'}`} />
                        <span>{s.start_time} - {s.end_time}</span>
                      </div>

                      <div className={`text-[11px] flex justify-between items-center pt-1 border-t ${
                        s.is_maintenance ? 'text-amber-200/90 border-amber-500/25' : 'text-slate-300 border-cyan-500/15'
                      }`}>
                        <span className={s.is_maintenance ? 'text-amber-300/80' : 'text-slate-400'}>{s.batch_or_class}</span>
                        <span className={`font-semibold ${s.is_maintenance ? 'text-amber-100' : 'text-cyan-200'}`}>{s.instructor_name}</span>
                      </div>

                      {s.notes && (
                        <div className={`text-[10px] italic pt-1 border-t ${
                          s.is_maintenance ? 'text-amber-200/80 border-amber-500/20' : 'text-slate-400 border-cyan-500/10'
                        }`}>
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

      {/* Modal: Book Slot (rendered via Portal to avoid clipping) */}
      {showBookModal && createPortal(
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in duration-150"
          onClick={() => setShowBookModal(false)}
        >
          <div 
            className="bg-[#071026] text-slate-100 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] max-w-md w-full overflow-hidden border border-cyan-500/40 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#0A1633] text-white p-4.5 px-6 flex justify-between items-center border-b border-cyan-500/20">
              <h3 className="font-bold text-sm tracking-wide text-white">Schedule Laboratory Session</h3>
              <button 
                onClick={() => setShowBookModal(false)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
                title="Close (Esc)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleBookSlot} className="p-6 space-y-4 text-xs overflow-y-auto">
              
              {errorMsg && (
                <div className="p-3 bg-rose-950/70 border border-rose-500/50 text-rose-200 rounded-xl text-xs flex items-start space-x-2 shadow-[0_0_12px_rgba(244,63,94,0.3)]">
                  <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-200 mb-1.5">Subject / Activity Name</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Natural Language Processing Lab (BAI601L)"
                  className="w-full px-3.5 py-2.5 bg-[#030816] border border-cyan-500/35 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_12px_rgba(0,240,255,0.35)] transition text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-200 mb-1.5">Day of Week</label>
                  <select
                    value={day}
                    onChange={(e) => setDay(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#030816] border border-cyan-500/35 rounded-xl text-white focus:outline-none focus:border-cyan-400 text-xs"
                  >
                    {days.map(d => (
                      <option key={d} value={d} className="bg-[#050C1F] text-white">{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-200 mb-1.5">Class / Batch</label>
                  <input
                    type="text"
                    required
                    value={batch}
                    onChange={(e) => setBatch(e.target.value)}
                    placeholder="AIDS 5th Sem - Batch A"
                    className="w-full px-3.5 py-2.5 bg-[#030816] border border-cyan-500/35 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-200 mb-1.5">Start Time (24h)</label>
                  <input
                    type="text"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    placeholder="09:00"
                    className="w-full px-3.5 py-2.5 bg-[#030816] border border-cyan-500/35 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-200 mb-1.5">End Time (24h)</label>
                  <input
                    type="text"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    placeholder="11:00"
                    className="w-full px-3.5 py-2.5 bg-[#030816] border border-cyan-500/35 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-200 mb-1.5">Instructor in Charge</label>
                <input
                  type="text"
                  required
                  value={instructor}
                  onChange={(e) => setInstructor(e.target.value)}
                  placeholder="Enter instructor in charge"
                  className="w-full px-3.5 py-2.5 bg-[#030816] border border-cyan-500/35 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 text-xs"
                />
              </div>

              <div className="flex items-center space-x-2.5 pt-1 bg-[#050C1F] p-3 rounded-xl border border-cyan-500/20">
                <input
                  type="checkbox"
                  id="isMaint"
                  checked={isMaintenance}
                  onChange={(e) => setIsMaintenance(e.target.checked)}
                  className="h-4 w-4 rounded text-cyan-500 focus:ring-cyan-500 bg-[#030816] border-cyan-500/40"
                />
                <label htmlFor="isMaint" className="font-semibold text-slate-200 cursor-pointer text-xs">
                  Reserve as Maintenance / System OS Update Window
                </label>
              </div>

              <div className="pt-3 border-t border-cyan-500/15 flex justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setShowBookModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold transition border border-slate-700 active:scale-95 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl font-bold transition shadow-[0_0_15px_rgba(0,240,255,0.35)] active:scale-95 text-xs"
                >
                  Verify & Book Slot
                </button>
              </div>

            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
