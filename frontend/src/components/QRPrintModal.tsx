import React from 'react';
import { X, Printer, Download, FileImage, ShieldCheck } from 'lucide-react';

interface QRPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  labelData: {
    institution: string;
    department: string;
    asset_id: string;
    name: string;
    category: string;
    lab: string;
    location?: string;
    serial_number?: string;
    status?: string;
    qr_image_base64: string;
    qr_svg?: string;
  } | null;
}

export const QRPrintModal: React.FC<QRPrintModalProps> = ({
  isOpen,
  onClose,
  labelData,
}) => {
  // ESC key listener to safely close modal from keyboard
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !labelData) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPNG = () => {
    if (!labelData.qr_image_base64) return;
    const link = document.createElement('a');
    link.href = labelData.qr_image_base64;
    link.download = `SMVITM-QR-${labelData.asset_id.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSVG = () => {
    if (!labelData.qr_svg) {
      // Fallback: convert base64 image into SVG wrapper if raw SVG missing
      const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><image href="${labelData.qr_image_base64}" width="300" height="300"/></svg>`;
      const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `SMVITM-QR-${labelData.asset_id.replace(/\s+/g, '_')}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return;
    }

    const blob = new Blob([labelData.qr_svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SMVITM-QR-${labelData.asset_id.replace(/\s+/g, '_')}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
        title="Close (Esc)"
      >
        <X className="h-4 w-4" />
        <span>Close (Esc)</span>
      </button>

      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col my-auto overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150 relative">
        
        {/* Header - Sticky */}
        <div className="bg-navy-900 text-white p-4 sm:p-4.5 px-6 flex justify-between items-center shrink-0 sticky top-0 z-20">
          <div className="flex items-center space-x-2.5">
            <ShieldCheck className="h-5 w-5 text-cyan-400" />
            <div>
              <h3 className="font-semibold text-sm">SMVITM Institutional Asset QR Code</h3>
              <p className="text-[11px] text-slate-300">View, Download (PNG/SVG), or Print Asset Sticker</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Printable Label Area - Scrollable */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
          <div
            id="printable-sticker"
            className="border-2 border-dashed border-navy-800 rounded-2xl p-5 bg-slate-50 text-center space-y-3 shadow-inner"
          >
            {/* Header with College Logo & Title */}
            <div className="flex items-center justify-center space-x-3">
              <img
                src="/images/smvitm-logo.jfif"
                alt="SMVITM Logo"
                className="h-11 w-11 object-contain rounded-lg bg-white p-0.5 border border-slate-200 shadow-xs"
              />
              <div className="text-left">
                <div className="text-xs font-bold text-navy-900 leading-tight">
                  SHRI MADHWA VADIRAJA INST OF TECH & MGMT
                </div>
                <div className="text-[10px] font-semibold text-navy-700">
                  Dept of Artificial Intelligence & Data Science
                </div>
                <div className="text-[9px] text-slate-500">
                  Bantakal, Udupi, Karnataka, India
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-200 w-full" />

            {/* QR Code Graphic */}
            <div className="flex justify-center my-3">
              <img
                src={labelData.qr_image_base64}
                alt={`QR Code for ${labelData.asset_id}`}
                className="h-44 w-44 object-contain bg-white p-2.5 rounded-xl border border-slate-300 shadow-md"
              />
            </div>

            {/* Serialized Asset Metadata */}
            <div className="space-y-1">
              <div className="text-base font-extrabold text-navy-900 tracking-wider font-mono">
                {labelData.asset_id}
              </div>
              <div className="text-xs font-bold text-slate-800">
                {labelData.name}
              </div>
              <div className="text-[11px] text-slate-600 font-medium">
                {labelData.lab} • {labelData.category}
              </div>
              {labelData.serial_number && (
                <div className="text-[10px] text-slate-500 font-mono">
                  SN: <span className="font-semibold text-slate-700">{labelData.serial_number}</span>
                  {labelData.location && ` • Loc: ${labelData.location}`}
                </div>
              )}
            </div>

            {/* Verification Footer on Sticker */}
            <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest pt-2 border-t border-slate-200 flex items-center justify-center space-x-1">
              <span>Official Laboratory Equipment • Scan to Verify</span>
            </div>
          </div>

          {/* Quick Specifications Bar */}
          <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-600">
            <div>
              <span className="text-slate-400 block text-[10px]">Assigned Lab:</span>
              <span className="font-semibold text-slate-800">{labelData.lab}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Verification Status:</span>
              <span className="inline-block px-1.5 py-0.5 rounded font-bold text-[10px] bg-emerald-100 text-emerald-800">
                {labelData.status || 'Verified Active'}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Action Footer with PNG, SVG, and Print controls - Sticky */}
        <div className="bg-slate-100 px-6 py-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0 sticky bottom-0 z-20">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-medium transition"
          >
            Close
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownloadPNG}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition shadow-xs"
              title="Download raster PNG image"
            >
              <FileImage className="h-3.5 w-3.5 text-blue-600" />
              <span>PNG</span>
            </button>

            <button
              onClick={handleDownloadSVG}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition shadow-xs"
              title="Download vector SVG format"
            >
              <Download className="h-3.5 w-3.5 text-emerald-600" />
              <span>SVG</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-1.5 bg-navy-900 hover:bg-navy-800 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition shadow"
              title="Print physical sticker"
            >
              <Printer className="h-4 w-4" />
              <span>Print Sticker</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
