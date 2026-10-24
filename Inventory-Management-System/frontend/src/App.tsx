import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { Navbar } from './components/Navbar';
import { Sidebar, PageId } from './components/Sidebar';
import { QRScannerModal } from './components/QRScannerModal';

import { DashboardPage } from './pages/DashboardPage';
import { LabsPage } from './pages/LabsPage';
import { InventoryPage } from './pages/InventoryPage';
import { FaultsPage } from './pages/FaultsPage';
import { TransfersPage } from './pages/TransfersPage';
import { RequestsPage } from './pages/RequestsPage';
import { TimetablePage } from './pages/TimetablePage';
import { AIAssistantPage } from './pages/AIAssistantPage';
import { ReportsPage } from './pages/ReportsPage';
import { UsersPage } from './pages/UsersPage';
import { AuditLogsPage } from './pages/AuditLogsPage';

export const App: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [initialScanToken, setInitialScanToken] = useState<string>('');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [initialFaultAssetId, setInitialFaultAssetId] = useState<number | null>(null);

  // Auto-detect direct QR scans via URL query parameter (e.g. ?scan=SMVITM-AI-PC-001 or ?asset=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const scanParam = params.get('scan') || params.get('asset') || params.get('token') || params.get('tag');
    if (scanParam) {
      setInitialScanToken(scanParam);
      setIsQRScannerOpen(true);
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
          <div className="text-sm font-semibold tracking-wide text-slate-300">
            Initializing SMVITM Inventory Management System...
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <DashboardPage
            onNavigate={(page) => setCurrentPage(page)}
            onOpenQRScanner={() => setIsQRScannerOpen(true)}
          />
        );
      case 'labs':
        return <LabsPage />;
      case 'inventory':
        return <InventoryPage />;
      case 'faults':
        return (
          <FaultsPage
            initialAssetId={initialFaultAssetId}
            onClearInitialAsset={() => setInitialFaultAssetId(null)}
          />
        );
      case 'transfers':
        return <TransfersPage />;
      case 'requests':
        return <RequestsPage />;
      case 'timetable':
        return <TimetablePage />;
      case 'ai':
        return <AIAssistantPage />;
      case 'reports':
        return <ReportsPage />;
      case 'users':
        return <UsersPage />;
      case 'audit':
        return <AuditLogsPage />;
      default:
        return (
          <DashboardPage
            onNavigate={(page) => setCurrentPage(page)}
            onOpenQRScanner={() => setIsQRScannerOpen(true)}
          />
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      
      {/* Institutional Top Navbar */}
      <Navbar
        onOpenQRScanner={() => setIsQRScannerOpen(true)}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
      />

      {/* Main Body with Sidebar & Content */}
      <div className="flex flex-1">
        
        {/* Role-Aware Sidebar */}
        <Sidebar
          currentPage={currentPage}
          onSelectPage={(p) => setCurrentPage(p)}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Dynamic Page Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {renderCurrentPage()}
        </main>

      </div>

      {/* Global QR Code Scanner Modal */}
      <QRScannerModal
        isOpen={isQRScannerOpen}
        initialToken={initialScanToken}
        onClose={() => {
          setIsQRScannerOpen(false);
          setInitialScanToken('');
        }}
        onAssetFound={(_assetId) => {
          setCurrentPage('inventory');
        }}
        onReportFault={(assetId) => {
          setInitialFaultAssetId(assetId);
          setCurrentPage('faults');
        }}
      />

    </div>
  );
};

export default App;
