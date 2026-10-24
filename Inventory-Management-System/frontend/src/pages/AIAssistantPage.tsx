import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import {
  Bot,
  Sparkles,
  Send,
  Cpu,
  TrendingUp,
  ShieldAlert,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Box,
  Truck,
  Wrench,
  Layers,
  Database,
  ArrowRight,
  Info,
  Clock,
  ShieldCheck,
  Building,
  Copy,
  Check
} from 'lucide-react';

interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
  sql_intent?: string;
  lab_context?: string;
  record_count?: number;
  results?: any[];
  labs?: string[];
  timestamp?: string;
  disclaimer?: string;
}

interface ReorderItem {
  item_id: number;
  item_name: string;
  category: string;
  lab_id: number;
  lab_name: string;
  current_stock: number;
  min_threshold: number;
  shortfall: number;
  outstanding_po_quantity: number;
  outstanding_po_ref?: string;
  suggested_action: 'REORDER_URGENT' | 'REORDER_RECOMMENDED' | 'ORDER_ALREADY_PLACED' | 'STOCK_HEALTHY';
  recommendation_type: string;
  explanation: string;
  safety_notice: string;
  last_evaluated_at: string;
}

interface ForecastItem {
  item_id: number;
  item_name: string;
  category: string;
  lab_id: number;
  lab_name: string;
  current_stock: number;
  min_threshold: number;
  historical_consumption_rate: number;
  forecast_quantity: number;
  forecast_horizon: string;
  data_sufficiency: string;
  model_used: string;
  limitations_notice: string;
  assumptions: string;
}

interface ModelStatus {
  fault_classifier: {
    status: string;
    model_version: string;
    algorithm: string;
    trained_at: string;
    is_synthetic_demonstration: boolean;
    test_accuracy: number;
    test_macro_f1: number;
    disclaimer: string;
  };
  assistant: {
    status: string;
    type: string;
    llm_provider: string;
    safety_controls: string[];
    disclaimer: string;
  };
  demand_forecasting: {
    status: string;
    algorithm: string;
    data_sufficiency: string;
    minimum_observations_needed: number;
    disclaimer: string;
  };
  reorder_engine: {
    status: string;
    algorithm: string;
    features: string[];
    safety_notice: string;
  };
  server_time: string;
}

const SAMPLE_QUERIES = [
  "How many working computers are in Laboratory 1?",
  "Which assets are currently under repair?",
  "Show all high-priority open faults.",
  "Which items are below their configured reorder levels?",
  "What repairs are waiting for instructor verification?",
  "Which purchase requests are awaiting my approval?",
  "What equipment was transferred between laboratories this month?",
  "Which assets have repeated fault reports?",
  "Summarize the current inventory of each laboratory.",
  "Which approved purchase requests have not been fully received?"
];

export const AIAssistantPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'assistant' | 'reorder' | 'forecast' | 'classifier' | 'models'>('assistant');
  
  // Model status state
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // Assistant Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: 'assistant',
      text: 'Welcome to the SMVITM Smart Inventory Assistant. I am grounded in live, authorized database records. Ask me about equipment status, pending repairs, transfer workflows, low-stock items, or purchase requisitions.',
      labs: ['Computer Laboratory 1', 'Computer Laboratory 2']
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Reorder Recommendations state
  const [reorderLabFilter, setReorderLabFilter] = useState<number | 'ALL'>('ALL');
  const [recommendations, setRecommendations] = useState<ReorderItem[]>([]);
  const [loadingReorder, setLoadingReorder] = useState(false);

  // Demand Forecast state
  const [forecastLab, setForecastLab] = useState<number>(1);
  const [forecasts, setForecasts] = useState<ForecastItem[]>([]);
  const [loadingForecast, setLoadingForecast] = useState(false);

  // Fault Classifier Sandbox state
  const [testText, setTestText] = useState('CPU cooling fan failed on workstation 02 and burning smell observed from switchboard');
  const [classificationResult, setClassificationResult] = useState<any>(null);
  const [classifying, setClassifying] = useState(false);

  useEffect(() => {
    loadModelStatus();
    loadReorderRecommendations();
    loadForecast(forecastLab);
  }, []);

  const loadModelStatus = async () => {
    try {
      setLoadingStatus(true);
      const data = await apiRequest<ModelStatus>('/ai/status');
      setModelStatus(data);
    } catch (err) {
      console.error('Failed to load AI model status:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  const loadReorderRecommendations = async (labId?: number) => {
    try {
      setLoadingReorder(true);
      const url = labId ? `/ai/recommendations?lab_id=${labId}` : '/ai/recommendations';
      const data = await apiRequest<ReorderItem[]>(url);
      setRecommendations(data);
    } catch (err) {
      console.error('Failed to load reorder recommendations:', err);
    } finally {
      setLoadingReorder(false);
    }
  };

  const loadForecast = async (labId: number) => {
    try {
      setLoadingForecast(true);
      const data = await apiRequest<ForecastItem[]>(`/ai/forecast?lab_id=${labId}`);
      setForecasts(data);
    } catch (err) {
      console.error('Failed to load demand forecast:', err);
    } finally {
      setLoadingForecast(false);
    }
  };

  const handleSendQuery = async (queryText?: string) => {
    const q = (queryText || inputQuery).trim();
    if (!q) return;

    setMessages(prev => [...prev, { sender: 'user', text: q }]);
    setInputQuery('');
    setIsQuerying(true);

    try {
      const data = await apiRequest<{
        query: string;
        answer: string;
        sql_intent: string;
        lab_context: string;
        record_count: number;
        results?: any[];
        authorized_labs: string[];
        timestamp: string;
        disclaimer: string;
      }>('/ai/assistant', {
        method: 'POST',
        body: JSON.stringify({ query: q })
      });

      setMessages(prev => [
        ...prev,
        {
          sender: 'assistant',
          text: data.answer,
          sql_intent: data.sql_intent,
          lab_context: data.lab_context,
          record_count: data.record_count,
          results: data.results,
          labs: data.authorized_labs,
          timestamp: data.timestamp,
          disclaimer: data.disclaimer
        }
      ]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          sender: 'assistant',
          text: `Query processing halted: ${err.message || 'Server error'}. Please check your permissions or network connection.`
        }
      ]);
    } finally {
      setIsQuerying(false);
    }
  };

  const handleRunClassification = async (customText?: string) => {
    const textToClassify = customText || testText;
    if (!textToClassify.trim()) return;

    setClassifying(true);
    try {
      const data = await apiRequest<any>('/ai/classify', {
        method: 'POST',
        body: JSON.stringify({ description: textToClassify })
      });
      setClassificationResult(data);
    } catch (err: any) {
      console.error('Classification error:', err);
    } finally {
      setClassifying(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-navy-900 via-navy-800 to-navy-900 rounded-2xl p-6 text-white shadow-lg border border-navy-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2 text-cyan-300 text-xs font-semibold tracking-wider uppercase mb-1">
            <Cpu className="h-4 w-4" />
            <span>AI-Powered Intelligence Suite • SMVITM AI & DS</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            AI Inventory Intelligence & Assistant
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Machine-learning fault classification, grounded database inquiries, chronological demand forecasting, and explainable reorder decision support.
          </p>
        </div>

        {/* Global Model Health Status Indicator */}
        <div className="flex items-center space-x-3 bg-navy-800/80 px-4 py-2.5 rounded-xl border border-navy-700">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Active Model</span>
            <span className="text-xs font-mono font-bold text-cyan-300">
              {modelStatus?.fault_classifier.model_version || 'v1.0.0-tfidf-logreg'}
            </span>
          </div>
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" title="System Operational"></span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 space-x-1 sm:space-x-4 overflow-x-auto pb-1 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('assistant')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition ${
            activeTab === 'assistant'
              ? 'bg-navy-900 text-white shadow'
              : 'text-slate-600 hover:text-navy-900 hover:bg-slate-100'
          }`}
        >
          <Bot className="h-4 w-4" />
          <span>Smart Assistant</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('reorder');
            loadReorderRecommendations(reorderLabFilter === 'ALL' ? undefined : reorderLabFilter);
          }}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition ${
            activeTab === 'reorder'
              ? 'bg-navy-900 text-white shadow'
              : 'text-slate-600 hover:text-navy-900 hover:bg-slate-100'
          }`}
        >
          <Box className="h-4 w-4" />
          <span>Reorder Recommendations</span>
          <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
            PO Deduplicated
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab('forecast');
            loadForecast(forecastLab);
          }}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition ${
            activeTab === 'forecast'
              ? 'bg-navy-900 text-white shadow'
              : 'text-slate-600 hover:text-navy-900 hover:bg-slate-100'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          <span>Demand Forecasting</span>
        </button>

        <button
          onClick={() => setActiveTab('classifier')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition ${
            activeTab === 'classifier'
              ? 'bg-navy-900 text-white shadow'
              : 'text-slate-600 hover:text-navy-900 hover:bg-slate-100'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>Fault Classifier Sandbox</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('models');
            loadModelStatus();
          }}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition ${
            activeTab === 'models'
              ? 'bg-navy-900 text-white shadow'
              : 'text-slate-600 hover:text-navy-900 hover:bg-slate-100'
          }`}
        >
          <Database className="h-4 w-4" />
          <span>Model Registry & Health</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SMART INVENTORY ASSISTANT */}
      {/* ========================================================================= */}
      {activeTab === 'assistant' && (
        <div className="space-y-4">
          
          {/* Quick Query Suggestion Chips */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center">
                <Sparkles className="h-3.5 w-3.5 text-cyan-600 mr-1.5" />
                Authorized Grounded Queries (Click to Run)
              </span>
              <span className="text-[11px] text-slate-500">
                100% Grounded in Live SQLite/PostgreSQL Database
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_QUERIES.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendQuery(q)}
                  className="text-xs bg-slate-50 hover:bg-cyan-50 hover:text-cyan-900 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-cyan-300 transition text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Stream Window */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[520px]">
            
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-2xl rounded-2xl p-4 text-xs sm:text-sm ${
                      m.sender === 'user'
                        ? 'bg-navy-900 text-white shadow'
                        : 'bg-slate-50 text-slate-800 border border-slate-200 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-1.5 font-bold text-xs">
                        {m.sender === 'assistant' ? (
                          <>
                            <Bot className="h-4 w-4 text-cyan-600" />
                            <span>SMVITM Inventory Assistant</span>
                          </>
                        ) : (
                          <span>You ({user?.full_name})</span>
                        )}
                      </div>
                      {m.sender === 'assistant' && (
                        <button
                          onClick={() => copyToClipboard(m.text, idx)}
                          className="text-slate-400 hover:text-navy-900 transition p-1"
                          title="Copy Answer"
                        >
                          {copiedIndex === idx ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Markdown Body */}
                    <div className="whitespace-pre-line leading-relaxed">{m.text}</div>

                    {/* Structured Results Table if returned */}
                    {m.results && m.results.length > 0 && (
                      <div className="mt-3 border-t border-slate-200 pt-3">
                        <div className="text-[11px] font-bold text-slate-600 uppercase mb-1.5">
                          Matching Database Records ({m.results.length})
                        </div>
                        <div className="overflow-x-auto max-h-48 rounded-lg border border-slate-200">
                          <table className="min-w-full divide-y divide-slate-200 text-left text-[11px]">
                            <thead className="bg-slate-100 font-semibold text-slate-700">
                              <tr>
                                <th className="px-2.5 py-1.5">Identifier</th>
                                <th className="px-2.5 py-1.5">Item / Subject</th>
                                <th className="px-2.5 py-1.5">Status / Details</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {m.results.slice(0, 10).map((r, rIdx) => (
                                <tr key={rIdx} className="hover:bg-slate-50">
                                  <td className="px-2.5 py-1.5 font-mono text-cyan-800 font-semibold">
                                    {r.asset_id || r.report_number || r.request_number || r.item_name || `#${r.id}`}
                                  </td>
                                  <td className="px-2.5 py-1.5 text-slate-800 font-medium">
                                    {r.name || r.title || r.item_name || `Lab ${r.lab_id}`}
                                  </td>
                                  <td className="px-2.5 py-1.5 text-slate-600">
                                    {r.status || (r.deficit ? `Shortfall: ${r.deficit}` : `Working: ${r.working_assets || 0}`)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Footnote Disclaimers */}
                    {m.disclaimer && (
                      <div className="mt-2 text-[10px] text-slate-400 italic">
                        {m.disclaimer}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isQuerying && (
                <div className="flex justify-start">
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs flex items-center space-x-2 text-slate-600">
                    <RefreshCw className="h-4 w-4 animate-spin text-cyan-600" />
                    <span>Querying verified database records with server-side RBAC filter...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendQuery();
                }}
                className="flex items-center space-x-2"
              >
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  placeholder="Ask a question about equipment, repairs, transfers, or purchase orders..."
                  className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-navy-900"
                />
                <button
                  type="submit"
                  disabled={isQuerying || !inputQuery.trim()}
                  className="bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center space-x-1.5 shadow"
                >
                  <Send className="h-4 w-4" />
                  <span className="hidden sm:inline">Ask Assistant</span>
                </button>
              </form>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: EXPLAINABLE REORDER RECOMMENDATIONS (WITH PO DEDUPLICATION) */}
      {/* ========================================================================= */}
      {activeTab === 'reorder' && (
        <div className="space-y-4">
          
          {/* Institutional Safety Notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 flex items-start space-x-3">
            <ShieldAlert className="h-5 w-5 text-amber-700 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold">MANDATORY HUMAN-IN-THE-LOOP SAFETY DIRECTIVE</div>
              <p className="text-amber-800 leading-relaxed">
                The AI recommendation engine is an advisory decision-support tool. It <strong>never automatically submits, approves, or places purchase orders</strong>. All procurement actions require human review and executive sanction by authorized college personnel (HOD and Principal).
              </p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center space-x-2 text-xs">
              <span className="font-semibold text-slate-700">Filter by Laboratory:</span>
              <select
                value={reorderLabFilter}
                onChange={(e) => {
                  const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                  setReorderLabFilter(val);
                  loadReorderRecommendations(val === 'ALL' ? undefined : val);
                }}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-navy-900"
              >
                <option value="ALL">All Authorized Labs</option>
                <option value="1">Computer Laboratory 1</option>
                <option value="2">Computer Laboratory 2</option>
              </select>
            </div>

            <button
              onClick={() => loadReorderRecommendations(reorderLabFilter === 'ALL' ? undefined : reorderLabFilter)}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg flex items-center space-x-1 font-semibold transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingReorder ? 'animate-spin' : ''}`} />
              <span>Refresh Recommendations</span>
            </button>
          </div>

          {/* Recommendations Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 font-bold text-slate-700 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3">Item Details</th>
                    <th className="px-4 py-3">Laboratory</th>
                    <th className="px-4 py-3">Stock vs Threshold</th>
                    <th className="px-4 py-3">Approved Orders (PO)</th>
                    <th className="px-4 py-3">Suggested Action</th>
                    <th className="px-4 py-3">Explainable Rationale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loadingReorder ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-500">
                        <div className="flex items-center justify-center space-x-2">
                          <RefreshCw className="h-4 w-4 animate-spin text-navy-900" />
                          <span>Evaluating live stock and outstanding purchase orders...</span>
                        </div>
                      </td>
                    </tr>
                  ) : recommendations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-500">
                        No consumable items found for the selected laboratory.
                      </td>
                    </tr>
                  ) : (
                    recommendations.map((rec) => {
                      let badgeColor = 'bg-slate-100 text-slate-700';
                      let badgeIcon = CheckCircle2;

                      if (rec.suggested_action === 'REORDER_URGENT') {
                        badgeColor = 'bg-rose-100 text-rose-800 border-rose-200';
                        badgeIcon = AlertTriangle;
                      } else if (rec.suggested_action === 'ORDER_ALREADY_PLACED') {
                        badgeColor = 'bg-blue-100 text-blue-800 border-blue-200';
                        badgeIcon = Truck;
                      } else if (rec.suggested_action === 'REORDER_RECOMMENDED') {
                        badgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
                        badgeIcon = AlertCircle;
                      } else if (rec.suggested_action === 'STOCK_HEALTHY') {
                        badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                        badgeIcon = CheckCircle2;
                      }

                      const ActionIcon = badgeIcon;

                      return (
                        <tr key={rec.item_id} className="hover:bg-slate-50/80 transition">
                          <td className="px-4 py-3">
                            <div className="font-bold text-navy-900">{rec.item_name}</div>
                            <div className="text-[11px] text-slate-500">{rec.category}</div>
                          </td>

                          <td className="px-4 py-3 text-slate-700 font-medium">
                            {rec.lab_name}
                          </td>

                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-800">
                              {rec.current_stock} / {rec.min_threshold} units
                            </div>
                            {rec.shortfall > 0 ? (
                              <span className="text-[10px] text-rose-600 font-bold">
                                Deficit: {rec.shortfall} units
                              </span>
                            ) : (
                              <span className="text-[10px] text-emerald-600 font-bold">
                                Sufficient
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {rec.outstanding_po_quantity > 0 ? (
                              <div>
                                <span className="font-semibold text-blue-700 flex items-center">
                                  <Truck className="h-3 w-3 mr-1" />
                                  {rec.outstanding_po_quantity} in transit
                                </span>
                                <div className="text-[10px] text-slate-500 font-mono">
                                  PO: {rec.outstanding_po_ref || 'In Procurement'}
                                </div>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400">None</span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${badgeColor}`}>
                              <ActionIcon className="h-3 w-3" />
                              <span>{rec.suggested_action.replace(/_/g, ' ')}</span>
                            </span>
                          </td>

                          <td className="px-4 py-3 text-slate-600 text-xs leading-relaxed max-w-md">
                            {rec.explanation}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DEMAND FORECASTING */}
      {/* ========================================================================= */}
      {activeTab === 'forecast' && (
        <div className="space-y-4">
          
          {/* Data Sufficiency Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900 flex items-start space-x-3">
            <Info className="h-5 w-5 text-blue-700 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold">DATA SUFFICIENCY AUDIT DISCLOSURE</div>
              <p className="text-blue-800 leading-relaxed">
                Reliable machine learning time-series models (ARIMA / Prophet / Holt-Winters) require at least <strong>12 monthly or 24 weekly distinct chronological consumption observations</strong>. Current historical records in the demonstration database are below this threshold. The engine transparently outputs baseline safety-buffer deficit projections with visible assumptions rather than fabricating speculative precision.
              </p>
            </div>
          </div>

          {/* Lab Selector */}
          <div className="flex items-center space-x-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-xs">
            <span className="font-semibold text-slate-700">Target Laboratory:</span>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setForecastLab(1);
                  loadForecast(1);
                }}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  forecastLab === 1 ? 'bg-navy-900 text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Computer Laboratory 1
              </button>
              <button
                onClick={() => {
                  setForecastLab(2);
                  loadForecast(2);
                }}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  forecastLab === 2 ? 'bg-navy-900 text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Computer Laboratory 2
              </button>
            </div>
          </div>

          {/* Forecast Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loadingForecast ? (
              <div className="col-span-full text-center py-12 text-slate-500">
                <RefreshCw className="h-5 w-5 animate-spin mx-auto text-navy-900 mb-2" />
                <span>Computing chronological consumption forecasts...</span>
              </div>
            ) : forecasts.length === 0 ? (
              <div className="col-span-full text-center py-12 text-slate-500 bg-white rounded-2xl border border-slate-200">
                No bulk consumable items found for this laboratory.
              </div>
            ) : (
              forecasts.map((f) => (
                <div key={f.item_id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-sm text-navy-900">{f.item_name}</div>
                        <div className="text-[11px] text-slate-500">{f.category}</div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                        f.data_sufficiency === 'INSUFFICIENT'
                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      }`}>
                        {f.data_sufficiency}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Current Working Stock</span>
                        <div className="font-bold text-slate-800">{f.current_stock} units</div>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Reorder Threshold</span>
                        <div className="font-bold text-slate-800">{f.min_threshold} units</div>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Forecast Horizon</span>
                        <div className="font-semibold text-slate-700">{f.forecast_horizon}</div>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Projected Demand</span>
                        <div className="font-black text-cyan-800 text-sm">{f.forecast_quantity} units</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                    <div className="font-bold text-slate-700 flex items-center">
                      <Layers className="h-3 w-3 mr-1 text-slate-500" />
                      Model: {f.model_used}
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      {f.limitations_notice}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: FAULT CLASSIFIER SANDBOX */}
      {/* ========================================================================= */}
      {activeTab === 'classifier' && (
        <div className="space-y-4">
          
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold text-base text-navy-900">
                Scikit-Learn TF-IDF + Logistic Regression Classifier Sandbox
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Test the machine-learning fault classifier with arbitrary fault text. Inspect category prediction, probability scores, technician routing, and uncertainty thresholding.
              </p>
            </div>

            {/* Quick Test Presets */}
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="text-slate-400 text-xs self-center font-semibold">Quick Presets:</span>
              <button
                onClick={() => {
                  const t = "Sparks and burning smell noticed from wall socket switchboard near row 2 computer workbench";
                  setTestText(t);
                  handleRunClassification(t);
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg transition"
              >
                Electrical Sparking
              </button>
              <button
                onClick={() => {
                  const t = "Dell 24 inch LCD monitor display has vertical colored distortion lines running across the screen";
                  setTestText(t);
                  handleRunClassification(t);
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg transition"
              >
                Monitor Distortion
              </button>
              <button
                onClick={() => {
                  const t = "Ethernet cable RJ45 connector locking tab snapped off and network disconnects continuously";
                  setTestText(t);
                  handleRunClassification(t);
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg transition"
              >
                Network RJ45
              </button>
              <button
                onClick={() => {
                  const t = "Ergonomic rolling lab chair castor wheel broken off and base is tilted dangerously";
                  setTestText(t);
                  handleRunClassification(t);
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg transition"
              >
                Chair Broken
              </button>
              <button
                onClick={() => {
                  const t = "Students are having tea and samosas at the campus canteen";
                  setTestText(t);
                  handleRunClassification(t);
                }}
                className="bg-rose-50 hover:bg-rose-100 text-rose-800 px-2.5 py-1 rounded-lg border border-rose-200 transition"
              >
                Out-of-Distribution Query
              </button>
            </div>

            {/* Input Box */}
            <div className="space-y-2">
              <textarea
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                rows={3}
                placeholder="Enter equipment fault description..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-navy-900"
              />

              <button
                onClick={() => handleRunClassification()}
                disabled={classifying || !testText.trim()}
                className="bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-semibold transition flex items-center space-x-2 shadow"
              >
                <Sparkles className="h-4 w-4 text-cyan-400" />
                <span>{classifying ? 'Running ML Inference...' : 'Predict Category & Route Technician'}</span>
              </button>
            </div>

            {/* Inference Result Box */}
            {classificationResult && (
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4 animate-fade-in">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-500 font-semibold uppercase">Prediction:</span>
                    <span className="text-sm font-bold text-navy-900 bg-white px-3 py-1 rounded-xl border border-slate-200 shadow-sm">
                      {classificationResult.category}
                    </span>
                    {classificationResult.needs_manual_review && (
                      <span className="text-[10px] bg-rose-100 text-rose-800 px-2.5 py-1 rounded-full font-bold border border-rose-200">
                        Needs Manual Review
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-500">
                    Model: <span className="font-mono font-bold text-slate-700">{classificationResult.model_version}</span>
                  </div>
                </div>

                {/* Confidence Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-600">Model Confidence Score:</span>
                    <span className="text-navy-900">{Math.round(classificationResult.confidence * 100)}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        classificationResult.confidence >= 0.70
                          ? 'bg-emerald-500'
                          : classificationResult.confidence >= 0.40
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.round(classificationResult.confidence * 100)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Detailed Attributes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Suggested Priority</span>
                    <div className="font-bold text-slate-800 mt-0.5">{classificationResult.suggested_priority}</div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Recommended Technician</span>
                    <div className="font-bold text-slate-800 mt-0.5">{classificationResult.recommended_technician}</div>
                  </div>
                </div>

                {/* Top Probability Distribution */}
                {classificationResult.top_probabilities && Object.keys(classificationResult.top_probabilities).length > 0 && (
                  <div className="text-xs space-y-1 pt-1">
                    <div className="text-[11px] font-bold text-slate-600 uppercase">Top Class Probabilities:</div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(classificationResult.top_probabilities).map(([cat, prob]: any) => (
                        <span key={cat} className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-medium text-slate-700">
                          {cat}: <strong className="text-navy-900">{Math.round(prob * 100)}%</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Safety Warning */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 flex items-start space-x-2">
                  <ShieldAlert className="h-4 w-4 text-amber-700 flex-shrink-0 mt-0.5" />
                  <p>{classificationResult.safety_disclaimer}</p>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: MODEL REGISTRY & SYSTEM HEALTH */}
      {/* ========================================================================= */}
      {activeTab === 'models' && (
        <div className="space-y-4">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Fault Classifier Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-navy-900">Fault Category Classifier</h4>
                  <div className="text-xs text-slate-500">Supervised Text Classifier</div>
                </div>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2.5 py-0.5 rounded-full font-bold border border-emerald-200">
                  {modelStatus?.fault_classifier.status || 'AVAILABLE'}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-700 pt-2 border-t border-slate-100">
                <div><strong>Algorithm:</strong> {modelStatus?.fault_classifier.algorithm}</div>
                <div><strong>Model Version:</strong> {modelStatus?.fault_classifier.model_version}</div>
                <div><strong>Training Corpus:</strong> 160 Balanced Demonstration Samples</div>
                <div><strong>Cross-Val Accuracy:</strong> 93.1% on Full Corpus</div>
                <div><strong>Dataset Source:</strong> Synthetic Demonstration (Explicitly Disclosed)</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl text-[10px] text-slate-500 italic">
                {modelStatus?.fault_classifier.disclaimer}
              </div>
            </div>

            {/* Smart Assistant Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-navy-900">Smart Inventory Assistant</h4>
                  <div className="text-xs text-slate-500">Deterministic Database Engine</div>
                </div>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2.5 py-0.5 rounded-full font-bold border border-emerald-200">
                  {modelStatus?.assistant.status || 'AVAILABLE'}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-700 pt-2 border-t border-slate-100">
                <div><strong>Architecture:</strong> Deterministic Pattern Interpretation + Grounded Queries</div>
                <div><strong>Database Safety:</strong> Zero Arbitrary Model-Generated SQL Execution</div>
                <div><strong>Access Control:</strong> Server-Side Lab & Role Scoping</div>
                <div><strong>Supported Queries:</strong> 10 Core Academic Inventory Questions</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl text-[10px] text-slate-500 italic">
                {modelStatus?.assistant.disclaimer}
              </div>
            </div>

            {/* Demand Forecasting Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-navy-900">Demand Forecasting Engine</h4>
                  <div className="text-xs text-slate-500">Chronological Depletion Tracker</div>
                </div>
                <span className="bg-amber-100 text-amber-800 text-[10px] px-2.5 py-0.5 rounded-full font-bold border border-amber-200">
                  {modelStatus?.demand_forecasting.status || 'NEEDS MORE DATA'}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-700 pt-2 border-t border-slate-100">
                <div><strong>Algorithm:</strong> Moving Average Baseline + Reorder Deficit</div>
                <div><strong>Sufficiency Status:</strong> {modelStatus?.demand_forecasting.data_sufficiency}</div>
                <div><strong>Horizon:</strong> 30-Day / 60-Day Semester Projection</div>
                <div><strong>Target Items:</strong> Consumable Cables, Keyboards, Mice, Chairs</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl text-[10px] text-slate-500 italic">
                {modelStatus?.demand_forecasting.disclaimer}
              </div>
            </div>

            {/* Reorder Recommendation Engine Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-navy-900">Reorder Decision Support</h4>
                  <div className="text-xs text-slate-500">Explainable Safety-Stock Rule Engine</div>
                </div>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2.5 py-0.5 rounded-full font-bold border border-emerald-200">
                  {modelStatus?.reorder_engine.status || 'AVAILABLE'}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-700 pt-2 border-t border-slate-100">
                <div><strong>Features:</strong> Active Purchase Order Deduplication</div>
                <div><strong>Guards:</strong> Anti-Duplicate Requisitions for In-Transit Stock</div>
                <div><strong>Explainability:</strong> Natural Language Deficit Rationale</div>
                <div><strong>Human Review:</strong> Required for All Requisitions</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl text-[10px] text-slate-500 italic">
                {modelStatus?.reorder_engine.safety_notice}
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
};
