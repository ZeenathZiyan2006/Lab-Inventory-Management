import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { apiRequest } from '../services/api';
import {
  X,
  QrCode,
  CheckCircle,
  AlertTriangle,
  Search,
  Wrench,
  Camera,
  CameraOff,
  RefreshCw,
  Clock,
  ShieldAlert,
  FileText
} from 'lucide-react';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssetFound?: (assetId: number) => void;
  onReportFault?: (assetId: number) => void;
  initialToken?: string;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onAssetFound,
  onReportFault,
  initialToken,
}) => {
  const [manualToken, setManualToken] = useState(initialToken || '');
  const [scanResult, setScanResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cameraPermissionError, setCameraPermissionError] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const initCameraScanner = () => {
    setCameraPermissionError(null);
    try {
      if (scannerRef.current) {
        try {
          scannerRef.current.clear();
        } catch (e) {}
      }

      const scanner = new Html5QrcodeScanner(
        'qr-reader-container',
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          rememberLastUsedCamera: true,
          supportedScanTypes: [0], // CAMERA
        },
        /* verbose= */ false
      );

      scanner.render(
        (decodedText) => {
          handleTokenResolution(decodedText);
          try {
            scanner.clear();
          } catch (e) {}
        },
        (errorMessage) => {
          // If error message indicates camera permission issues
          if (
            errorMessage.includes('NotAllowedError') ||
            errorMessage.includes('Permission denied') ||
            errorMessage.includes('permission')
          ) {
            setCameraPermissionError(
              'Camera access was denied. Please allow camera permissions in your browser or use the manual search below.'
            );
          } else if (
            errorMessage.includes('NotFoundError') ||
            errorMessage.includes('Requested device not found')
          ) {
            setCameraPermissionError(
              'No active camera device was detected. Please connect a webcam or use the manual search below.'
            );
          }
        }
      );
      scannerRef.current = scanner;
    } catch (e: any) {
      console.warn('Camera scanner initialization error:', e);
      setCameraPermissionError(
        'Camera could not be accessed. You can still look up any asset using the manual search below.'
      );
    }
  };

  useEffect(() => {
    if (isOpen) {
      setScanResult(null);
      setError(null);
      setManualToken(initialToken || '');
      setCameraPermissionError(null);

      if (initialToken && initialToken.trim()) {
        handleTokenResolution(initialToken.trim());
      }

      const timer = setTimeout(() => {
        initCameraScanner();
      }, 300);

      return () => {
        clearTimeout(timer);
        if (scannerRef.current) {
          try {
            scannerRef.current.clear();
          } catch (e) {}
        }
      };
    }
  }, [isOpen, initialToken]);

  // Global Escape key listener to close scanner modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleTokenResolution = async (token: string) => {
    let clean = token.trim();
    if (!clean) return;

    // Handle full web URLs scanned by camera or pasted
    try {
      if (clean.includes('://') || clean.includes('?')) {
        const url = new URL(clean.startsWith('http') ? clean : `http://localhost/${clean}`);
        const qp = url.searchParams.get('scan') || url.searchParams.get('asset') || url.searchParams.get('token') || url.searchParams.get('tag');
        if (qp) {
          clean = qp;
        }
      }
    } catch (e) {
      // Fallback simple parsing
      if (clean.includes('scan=')) {
        clean = clean.split('scan=')[1].split('&')[0];
      } else if (clean.includes('asset=')) {
        clean = clean.split('asset=')[1].split('&')[0];
      }
    }

    setLoading(true);
    setError(null);
    setScanResult(null);

    try {
      const data = await apiRequest('/qr/lookup', {
        method: 'POST',
        body: JSON.stringify({ identifier: clean.trim() }),
      });
      setScanResult(data);
    } catch (err: any) {
      if (err.message && err.message.includes('403')) {
        setError('Access Restricted: You are not authorized to view inventory in this laboratory.');
      } else if (err.message && err.message.includes('404')) {
        setError(`Asset Not Found: No equipment or lab found matching '${token.trim()}'. Please verify the asset tag or serial number.`);
      } else {
        setError(err.message || 'Failed to resolve QR token. Please verify the code or try manual search.');
      }
      setScanResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSelect = (sampleToken: string) => {
    setManualToken(sampleToken);
    handleTokenResolution(sampleToken);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* High-Contrast Floating Close Badge */}
      <button
        onClick={onClose}
        className="fixed top-3 right-3 sm:top-4 sm:right-4 z-[80] px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-full text-xs font-bold shadow-2xl transition flex items-center space-x-1.5 border border-white/20 active:scale-95"
        title="Close Scanner (Esc)"
      >
        <X className="h-4 w-4" />
        <span>Close (Esc)</span>
      </button>

      <div className="bg-[#081026] text-slate-100 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] max-w-lg w-full max-h-[92vh] flex flex-col my-auto overflow-hidden border border-cyan-500/40 animate-in fade-in zoom-in duration-150 relative">
        
        {/* Sticky Header */}
        <div className="bg-[#0B1736] text-white p-4 sm:p-5 flex justify-between items-center border-b border-cyan-500/25 shrink-0 sticky top-0 z-20">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-cyan-950/80 rounded-xl border border-cyan-400/40 shadow-[0_0_10px_rgba(0,240,255,0.25)]">
              <QrCode className="h-5 w-5 text-cyan-400 drop-shadow-[0_0_4px_#00F0FF]" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base leading-tight text-white drop-shadow-[0_0_8px_rgba(0,240,255,0.3)]">SMVITM QR Asset Scanner</h3>
              <p className="text-[10px] sm:text-[11px] text-cyan-300/80">Scan QR Sticker or Lookup Asset Tag / Serial Number</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-900/60 text-slate-300 hover:text-white border border-slate-700/60 hover:border-rose-500/50 transition flex items-center space-x-1"
            title="Close (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body - Fully Scrollable */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
          
          {/* Camera Permission Alert (If active) */}
          {cameraPermissionError && (
            <div className="p-3.5 bg-amber-950/50 border border-amber-500/40 rounded-2xl text-xs text-amber-200 flex items-start space-x-3 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
              <CameraOff className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-bold text-amber-300">Camera Unavailable or Denied</div>
                <div className="text-amber-200/90 text-[11px] mt-0.5">{cameraPermissionError}</div>
                <button
                  onClick={initCameraScanner}
                  className="mt-2 text-[11px] font-semibold text-cyan-300 hover:text-cyan-200 underline flex items-center space-x-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Retry Camera Access</span>
                </button>
              </div>
            </div>
          )}

          {/* Interactive Camera Scanning Viewport */}
          <div className="rounded-2xl overflow-hidden border border-cyan-500/30 bg-[#050C1A] text-white shadow-inner">
            <div id="qr-reader-container" className="w-full min-h-[180px]"></div>
          </div>

          {/* Manual Asset Tag / Serial Number Fallback Entry */}
          <div className="bg-[#050C1A]/90 p-4 rounded-2xl border border-cyan-500/25 space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-cyan-300">
                Manual Asset Tag / Serial Number Lookup:
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Camera Fallback</span>
            </div>

            <div className="flex space-x-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-cyan-400/70" />
                <input
                  type="text"
                  placeholder="e.g. SMVITM-AI-PC-001 or Serial Number"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleTokenResolution(manualToken);
                    }
                  }}
                  className="w-full bg-[#081026] border border-cyan-500/30 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_10px_rgba(0,240,255,0.3)] transition"
                />
              </div>
              <button
                onClick={() => handleTokenResolution(manualToken)}
                disabled={loading || !manualToken.trim()}
                className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-[0_0_10px_rgba(0,240,255,0.3)] flex items-center space-x-1"
              >
                {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
                <span>{loading ? 'Searching...' : 'Lookup'}</span>
              </button>
            </div>

            {/* Demonstration Quick-Search Pills */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px] text-slate-400">
              <span className="font-semibold text-slate-300 text-[10px]">Demo Tags:</span>
              <button
                type="button"
                onClick={() => handleQuickSelect('SMVITM-AI-PC-001')}
                className="px-2 py-0.5 bg-[#081026] border border-cyan-500/30 rounded-lg text-cyan-300 hover:bg-cyan-950 font-mono text-[10px] transition"
              >
                SMVITM-AI-PC-001
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect('SMVITM-AIDS-LAB1-WS-01')}
                className="px-2 py-0.5 bg-[#081026] border border-cyan-500/30 rounded-lg text-cyan-300 hover:bg-cyan-950 font-mono text-[10px] transition"
              >
                SMVITM-AIDS-LAB1-WS-01
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect('SMVITM-AIDS-LAB2-PC-01')}
                className="px-2 py-0.5 bg-[#081026] border border-cyan-500/30 rounded-lg text-cyan-300 hover:bg-cyan-950 font-mono text-[10px] transition"
              >
                SMVITM-AIDS-LAB2-PC-01
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect('LAB-AIDS-LAB-01')}
                className="px-2 py-0.5 bg-[#081026] border border-cyan-500/30 rounded-lg text-cyan-300 hover:bg-cyan-950 font-mono text-[10px] transition"
              >
                Lab 1 Door
              </button>
            </div>
          </div>

          {/* Loading Indicator */}
          {loading && (
            <div className="p-4 bg-cyan-950/30 border border-cyan-500/30 rounded-2xl flex items-center justify-center space-x-2 text-xs text-cyan-200 animate-pulse">
              <RefreshCw className="h-4 w-4 animate-spin text-cyan-400" />
              <span>Verifying asset record in institutional database...</span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 bg-rose-950/40 border border-rose-500/40 text-rose-200 rounded-2xl text-xs flex items-start space-x-2.5 animate-in fade-in shadow-[0_0_12px_rgba(244,63,94,0.2)]">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <div className="font-bold text-rose-300">Lookup Error</div>
                <div className="text-[11px] mt-0.5">{error}</div>
              </div>
            </div>
          )}

          {/* Verified Result Display Card */}
          {scanResult && (
            <div className="bg-[#091530] border border-cyan-500/40 rounded-2xl p-4.5 space-y-3.5 text-xs animate-in fade-in shadow-[0_0_20px_rgba(0,240,255,0.2)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-cyan-300 font-bold text-sm">
                  <CheckCircle className="h-4.5 w-4.5 text-emerald-400 drop-shadow-[0_0_4px_#10B981]" />
                  <span>Verified Institutional {scanResult.type}</span>
                </div>
                {scanResult.status && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${
                      scanResult.status === 'Working'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-400/50 shadow-[0_0_6px_rgba(16,185,129,0.3)]'
                        : scanResult.status === 'Faulty'
                        ? 'bg-rose-950 text-rose-300 border-rose-400/50 shadow-[0_0_6px_rgba(244,63,94,0.3)]'
                        : 'bg-amber-950 text-amber-300 border-amber-400/50 shadow-[0_0_6px_rgba(245,158,11,0.3)]'
                    }`}
                  >
                    {scanResult.status}
                  </span>
                )}
              </div>

              {scanResult.type === 'ASSET' && (
                <div className="space-y-3 text-slate-300">
                  <div className="grid grid-cols-2 gap-2 bg-[#050C1A] p-3.5 rounded-xl border border-cyan-500/25">
                    <div>
                      <span className="text-slate-400 block text-[10px] font-medium">Asset ID / Tag:</span>
                      <span className="font-mono font-bold text-cyan-300 text-xs">{scanResult.asset_id}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-medium">Equipment Name:</span>
                      <span className="font-semibold text-white text-xs">{scanResult.name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-medium">Laboratory:</span>
                      <span className="font-medium text-slate-200">{scanResult.lab_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-medium">Bench Location:</span>
                      <span className="font-medium text-slate-200">{scanResult.location_in_lab || 'Workstation'}</span>
                    </div>
                    {scanResult.serial_number && (
                      <div className="col-span-2 pt-1 border-t border-slate-800 font-mono text-[10px]">
                        <span className="text-slate-400">Serial Number: </span>
                        <span className="font-semibold text-cyan-200">{scanResult.serial_number}</span>
                      </div>
                    )}
                  </div>

                  {/* Maintenance & Lifecycle History */}
                  {scanResult.recent_history && scanResult.recent_history.length > 0 && (
                    <div className="bg-[#050C1A] p-3 rounded-xl border border-cyan-500/25 space-y-1.5">
                      <div className="flex items-center space-x-1.5 font-bold text-cyan-300 text-[11px]">
                        <Clock className="h-3.5 w-3.5 text-cyan-400" />
                        <span>Maintenance & Lifecycle History</span>
                      </div>
                      <ul className="space-y-1.5 mt-1">
                        {scanResult.recent_history.map((h: any, i: number) => (
                          <li
                            key={i}
                            className="text-[10px] text-slate-300 bg-[#081026] p-2 rounded-lg border border-cyan-500/20 leading-snug"
                          >
                            <div className="font-semibold text-slate-100 flex justify-between">
                              <span>{h.action} &bull; {h.status}</span>
                              <span className="text-slate-400">{h.date}</span>
                            </div>
                            <div className="text-slate-400 mt-0.5">{h.reason}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Contextual Action Buttons */}
                  <div className="flex gap-2 pt-1">
                    {onAssetFound && (
                      <button
                        onClick={() => {
                          onAssetFound(scanResult.id);
                          onClose();
                        }}
                        className="flex-1 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition shadow-[0_0_10px_rgba(0,240,255,0.3)]"
                      >
                        Open in Inventory
                      </button>
                    )}
                    {onReportFault && scanResult.can_report_fault && (
                      <button
                        onClick={() => {
                          onReportFault(scanResult.id);
                          onClose();
                        }}
                        className="py-2 px-3.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition shadow-[0_0_10px_rgba(244,63,94,0.3)]"
                      >
                        <Wrench className="h-3.5 w-3.5" />
                        <span>Report Fault</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {scanResult.type === 'LABORATORY' && (
                <div className="bg-[#050C1A] p-3.5 rounded-xl border border-cyan-500/25 space-y-2 text-slate-300">
                  <div className="font-bold text-white text-xs">{scanResult.name} ({scanResult.code})</div>
                  <div className="text-[11px] text-slate-400">Room: {scanResult.room_number || 'Main Lab'}</div>
                  <div className="text-[11px] text-cyan-300">Total Tracked Equipment: <strong>{scanResult.total_assets}</strong></div>
                </div>
              )}

              {scanResult.type === 'BULK' && (
                <div className="bg-[#050C1A] p-3.5 rounded-xl border border-cyan-500/25 space-y-1.5 text-slate-300">
                  <div className="font-bold text-white text-xs">{scanResult.name} ({scanResult.category})</div>
                  <div className="text-[11px] text-slate-400">Laboratory: {scanResult.lab_name}</div>
                  <div className="text-[11px] text-cyan-300">Available Stock: <strong>{scanResult.working_quantity}</strong> / {scanResult.total_quantity}</div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Sticky Footer */}
        <div className="bg-[#050C1A] px-4 sm:px-6 py-3 border-t border-cyan-500/20 flex items-center justify-between shrink-0 sticky bottom-0 z-20">
          <span className="text-[10px] sm:text-[11px] text-slate-400">Click outside or press Esc to close</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition border border-slate-700 flex items-center space-x-1.5 shadow-xs"
          >
            <X className="h-3.5 w-3.5" />
            <span>Close Scanner</span>
          </button>
        </div>

      </div>
    </div>
  );
};
