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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
        
        {/* Header */}
        <div className="bg-navy-900 text-white p-5 flex justify-between items-center">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-navy-800 rounded-xl border border-navy-700">
              <QrCode className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">SMVITM QR Asset Scanner</h3>
              <p className="text-[11px] text-slate-300">Scan QR Sticker or Lookup Asset Tag / Serial Number</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-navy-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          
          {/* Camera Permission Alert (If active) */}
          {cameraPermissionError && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start space-x-3">
              <CameraOff className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-bold">Camera Unavailable or Denied</div>
                <div className="text-amber-800 text-[11px] mt-0.5">{cameraPermissionError}</div>
                <button
                  onClick={initCameraScanner}
                  className="mt-2 text-[11px] font-semibold text-amber-900 hover:text-amber-700 underline flex items-center space-x-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Retry Camera Access</span>
                </button>
              </div>
            </div>
          )}

          {/* Interactive Camera Scanning Viewport */}
          <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 text-white shadow-inner">
            <div id="qr-reader-container" className="w-full min-h-[180px]"></div>
          </div>

          {/* Manual Asset Tag / Serial Number Fallback Entry */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700">
                Manual Asset Tag / Serial Number Lookup:
              </label>
              <span className="text-[10px] text-slate-500 font-medium">Camera Fallback</span>
            </div>

            <div className="flex space-x-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
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
                  className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy-600 focus:border-transparent transition"
                />
              </div>
              <button
                onClick={() => handleTokenResolution(manualToken)}
                disabled={loading || !manualToken.trim()}
                className="bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-semibold transition shadow-sm flex items-center space-x-1"
              >
                {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
                <span>{loading ? 'Searching...' : 'Lookup'}</span>
              </button>
            </div>

            {/* Demonstration Quick-Search Pills */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-600 text-[10px]">Demo Tags:</span>
              <button
                type="button"
                onClick={() => handleQuickSelect('SMVITM-AI-PC-001')}
                className="px-2 py-0.5 bg-white border border-slate-200 rounded-lg text-navy-800 hover:bg-navy-50 font-mono text-[10px] transition"
              >
                SMVITM-AI-PC-001
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect('SMVITM-AIDS-LAB1-WS-01')}
                className="px-2 py-0.5 bg-white border border-slate-200 rounded-lg text-navy-800 hover:bg-navy-50 font-mono text-[10px] transition"
              >
                SMVITM-AIDS-LAB1-WS-01
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect('SMVITM-AIDS-LAB2-PC-01')}
                className="px-2 py-0.5 bg-white border border-slate-200 rounded-lg text-navy-800 hover:bg-navy-50 font-mono text-[10px] transition"
              >
                SMVITM-AIDS-LAB2-PC-01
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect('LAB-AIDS-LAB-01')}
                className="px-2 py-0.5 bg-white border border-slate-200 rounded-lg text-navy-800 hover:bg-navy-50 font-mono text-[10px] transition"
              >
                Lab 1 Door
              </button>
            </div>
          </div>

          {/* Loading Indicator */}
          {loading && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center space-x-2 text-xs text-slate-600 animate-pulse">
              <RefreshCw className="h-4 w-4 animate-spin text-navy-900" />
              <span>Verifying asset record in institutional database...</span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-start space-x-2.5 animate-in fade-in">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <div className="font-bold">Lookup Error</div>
                <div className="text-[11px] mt-0.5">{error}</div>
              </div>
            </div>
          )}

          {/* Verified Result Display Card */}
          {scanResult && (
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4.5 space-y-3.5 text-xs animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-emerald-900 font-bold text-sm">
                  <CheckCircle className="h-4.5 w-4.5 text-emerald-600" />
                  <span>Verified Institutional {scanResult.type}</span>
                </div>
                {scanResult.status && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${
                      scanResult.status === 'Working'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : scanResult.status === 'Faulty'
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : 'bg-amber-100 text-amber-800 border-amber-300'
                    }`}
                  >
                    {scanResult.status}
                  </span>
                )}
              </div>

              {scanResult.type === 'ASSET' && (
                <div className="space-y-3 text-slate-700">
                  <div className="grid grid-cols-2 gap-2 bg-white p-3.5 rounded-xl border border-emerald-100 shadow-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] font-medium">Asset ID / Tag:</span>
                      <span className="font-mono font-bold text-slate-900 text-xs">{scanResult.asset_id}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-medium">Equipment Name:</span>
                      <span className="font-semibold text-slate-800 text-xs">{scanResult.name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-medium">Laboratory:</span>
                      <span className="font-medium text-slate-800">{scanResult.lab_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-medium">Bench Location:</span>
                      <span className="font-medium text-slate-800">{scanResult.location_in_lab || 'Workstation'}</span>
                    </div>
                    {scanResult.serial_number && (
                      <div className="col-span-2 pt-1 border-t border-slate-100 font-mono text-[10px]">
                        <span className="text-slate-400">Serial Number: </span>
                        <span className="font-semibold text-slate-700">{scanResult.serial_number}</span>
                      </div>
                    )}
                  </div>

                  {/* Maintenance & Lifecycle History */}
                  {scanResult.recent_history && scanResult.recent_history.length > 0 && (
                    <div className="bg-white p-3 rounded-xl border border-emerald-100 space-y-1.5">
                      <div className="flex items-center space-x-1.5 font-bold text-slate-800 text-[11px]">
                        <Clock className="h-3.5 w-3.5 text-navy-700" />
                        <span>Maintenance & Lifecycle History</span>
                      </div>
                      <ul className="space-y-1.5 mt-1">
                        {scanResult.recent_history.map((h: any, i: number) => (
                          <li
                            key={i}
                            className="text-[10px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200/60 leading-snug"
                          >
                            <div className="font-semibold text-slate-800 flex justify-between">
                              <span>{h.action} &bull; {h.status}</span>
                              <span className="text-slate-400">{h.date}</span>
                            </div>
                            <div className="text-slate-500 mt-0.5">{h.reason}</div>
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
                        className="flex-1 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-xl text-xs font-semibold transition shadow-sm"
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
                        className="py-2 px-3.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm"
                      >
                        <Wrench className="h-3.5 w-3.5" />
                        <span>Report Fault</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {scanResult.type === 'LABORATORY' && (
                <div className="bg-white p-3.5 rounded-xl border border-emerald-100 space-y-2 text-slate-700">
                  <div className="font-bold text-slate-900 text-xs">{scanResult.name} ({scanResult.code})</div>
                  <div className="text-[11px] text-slate-600">Room: {scanResult.room_number || 'Main Lab'}</div>
                  <div className="text-[11px] text-slate-600">Total Tracked Equipment: <strong>{scanResult.total_assets}</strong></div>
                </div>
              )}

              {scanResult.type === 'BULK' && (
                <div className="bg-white p-3.5 rounded-xl border border-emerald-100 space-y-1.5 text-slate-700">
                  <div className="font-bold text-slate-900 text-xs">{scanResult.name} ({scanResult.category})</div>
                  <div className="text-[11px] text-slate-600">Laboratory: {scanResult.lab_name}</div>
                  <div className="text-[11px] text-slate-600">Available Stock: <strong>{scanResult.working_quantity}</strong> / {scanResult.total_quantity}</div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-medium transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
