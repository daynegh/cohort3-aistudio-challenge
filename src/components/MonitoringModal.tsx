import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  KeyRound,
  Layers,
  Terminal,
  Clock,
  Zap,
  Trash2,
  X,
  Radio,
} from 'lucide-react';

interface MonitoringModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MonitoringData {
  server: {
    uptimeSeconds: number;
    uptimeFormatted: string;
    startTime: string;
    nodeEnv: string;
    port: number;
  };
  keys: {
    gemini: {
      isConfigured: boolean;
      maskedKey: string;
      activeInRuntime: boolean;
    };
    googleMaps: {
      isConfigured: boolean;
      maskedKey: string;
    };
    rotationHistory: Array<{
      timestamp: string;
      keyType: 'gemini' | 'maps';
      action: string;
      maskedPreview: string;
      status: 'valid' | 'invalid' | 'rotated';
    }>;
  };
  performance: {
    totalRequests: number;
    successfulRequests: number;
    clientErrors: number;
    serverErrors: number;
    successRatePercentage: number;
    endpointStats: Record<string, { count: number; totalDurationMs: number; errors: number }>;
  };
  modelLadder: {
    models: string[];
    usage: Record<string, { attempts: number; successes: number; failures: number }>;
  };
  recentLogs: Array<{
    id: string;
    timestamp: string;
    level: 'info' | 'warn' | 'error';
    category: 'http' | 'gemini' | 'maps' | 'security' | 'rotation';
    method?: string;
    path?: string;
    statusCode?: number;
    durationMs?: number;
    message: string;
    details?: Record<string, any>;
  }>;
}

export const MonitoringModal: React.FC<MonitoringModalProps> = ({ isOpen, onClose }) => {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [testingKeys, setTestingKeys] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchLogTerm, setSearchLogTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'keys' | 'ladder' | 'logs'>('overview');

  const fetchMonitoringData = async () => {
    try {
      const res = await fetch('/api/monitoring/status');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch monitoring metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchMonitoringData();

    let intervalId: any = null;
    if (autoRefresh) {
      intervalId = setInterval(() => {
        fetchMonitoringData();
      }, 4000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isOpen, autoRefresh]);

  const handleTestKeys = async () => {
    setTestingKeys(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/monitoring/test-keys', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        setTestResult(json.results);
        fetchMonitoringData();
      }
    } catch (err: any) {
      setTestResult({ error: err.message || 'Key test failed' });
    } finally {
      setTestingKeys(false);
    }
  };

  const handleClearLogs = async () => {
    try {
      await fetch('/api/monitoring/clear-logs', { method: 'POST' });
      fetchMonitoringData();
    } catch (err) {
      console.error('Failed to clear logs:', err);
    }
  };

  if (!isOpen) return null;

  const filteredLogs = (data?.recentLogs || []).filter((log) => {
    const matchesCategory = selectedCategory === 'all' || log.category === selectedCategory;
    const matchesSearch =
      !searchLogTerm ||
      log.message.toLowerCase().includes(searchLogTerm.toLowerCase()) ||
      (log.path && log.path.toLowerCase().includes(searchLogTerm.toLowerCase())) ||
      (log.id && log.id.toLowerCase().includes(searchLogTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div
      id="monitoring-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="monitoring-modal-container"
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs">
              <Activity className="h-5 w-5 text-emerald-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900">
                  System Health & Live Monitoring
                </h2>
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200">
                  <Radio className="h-2.5 w-2.5 animate-ping text-emerald-500" />
                  Live Stream
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Real-time API key rotation diagnostics, model resilience metrics, and structured logs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-colors cursor-pointer ${
                autoRefresh
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
              title="Toggle Live Auto-Refresh (every 4s)"
            >
              <RefreshCw className={`h-3 w-3 ${autoRefresh ? 'animate-spin' : ''}`} />
              <span>{autoRefresh ? 'Auto 4s' : 'Paused'}</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-6 pt-3">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-1.5 border-b-2 px-3 pb-3 text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>Health & Performance</span>
          </button>
          <button
            onClick={() => setActiveTab('keys')}
            className={`flex items-center gap-1.5 border-b-2 px-3 pb-3 text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'keys'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>Rotated Key Verification</span>
          </button>
          <button
            onClick={() => setActiveTab('ladder')}
            className={`flex items-center gap-1.5 border-b-2 px-3 pb-3 text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'ladder'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Gemini Fallback Ladder</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-1.5 border-b-2 px-3 pb-3 text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'logs'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>Audit Logs ({data?.recentLogs.length || 0})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          {loading && !data ? (
            <div className="flex flex-col items-center justify-center py-16">
              <RefreshCw className="h-8 w-8 animate-spin text-indigo-600 mb-3" />
              <p className="text-xs text-slate-500">Querying live system telemetry and key health...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Metric Top Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                      <div className="flex items-center justify-between text-slate-500 text-xs">
                        <span>Server Uptime</span>
                        <Clock className="h-4 w-4 text-indigo-600" />
                      </div>
                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {data?.server.uptimeFormatted || '0s'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Port 3000 • Express + Vite</p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                      <div className="flex items-center justify-between text-slate-500 text-xs">
                        <span>Success Rate</span>
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      </div>
                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {data?.performance.successRatePercentage || 100}%
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {data?.performance.successfulRequests} / {data?.performance.totalRequests} calls
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                      <div className="flex items-center justify-between text-slate-500 text-xs">
                        <span>Gemini Client</span>
                        <Zap className="h-4 w-4 text-amber-500" />
                      </div>
                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {data?.keys.gemini.isConfigured ? 'Active' : 'Unset'}
                      </p>
                      <p className="text-[10px] text-emerald-600 mt-0.5 font-medium">
                        Dynamic Key Ingestion
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                      <div className="flex items-center justify-between text-slate-500 text-xs">
                        <span>Maps Architecture</span>
                        <Activity className="h-4 w-4 text-indigo-500" />
                      </div>
                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {data?.keys.googleMaps.isConfigured ? 'Google API' : 'OSM Proxy'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Dual-Engine Fallback</p>
                    </div>
                  </div>

                  {/* Endpoints Breakdown */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                      API Proxy & Route Metrics
                    </h3>
                    <div className="divide-y divide-slate-100">
                      {data?.performance.endpointStats && Object.keys(data.performance.endpointStats).length > 0 ? (
                        Object.entries(data.performance.endpointStats).map(([endpoint, rawStats]) => {
                          const stats = rawStats as { count: number; totalDurationMs: number; errors: number };
                          const avgLatency = Math.round(stats.totalDurationMs / (stats.count || 1));
                          return (
                            <div key={endpoint} className="py-2.5 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-slate-800 font-medium">{endpoint}</span>
                                {stats.errors > 0 && (
                                  <span className="rounded bg-rose-50 text-rose-700 px-1.5 py-0.5 text-[10px] font-medium border border-rose-200">
                                    {stats.errors} errors
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-slate-500 font-mono">
                                <span>{stats.count} calls</span>
                                <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">
                                  {avgLatency} ms avg
                                </span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="py-4 text-xs text-slate-400 text-center">
                          No API calls recorded in this container lifecycle yet.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ROTATED KEYS & VERIFICATION */}
              {activeTab === 'keys' && (
                <div className="space-y-6">
                  {/* Action Banner */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-indigo-200 bg-indigo-50/70 p-4">
                    <div>
                      <h3 className="text-sm font-semibold text-indigo-950">
                        Key Rotation Verification Engine
                      </h3>
                      <p className="text-xs text-indigo-700 mt-0.5">
                        Trigger a real-time round-trip ping against rotated API keys without restarting the container.
                      </p>
                    </div>
                    <button
                      id="verify-rotated-keys-btn"
                      onClick={handleTestKeys}
                      disabled={testingKeys}
                      className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 transition-colors cursor-pointer shadow-xs shrink-0 disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${testingKeys ? 'animate-spin' : ''}`} />
                      <span>{testingKeys ? 'Verifying Keys...' : 'Verify Rotated Keys Now'}</span>
                    </button>
                  </div>

                  {/* Test Result Output if any */}
                  {testResult && (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs animate-in fade-in">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                        Live Ping Verification Results
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className={`p-3 rounded-lg border ${testResult.gemini?.success ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                          <div className="flex items-center justify-between font-semibold">
                            <span>Gemini API Key</span>
                            {testResult.gemini?.success ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-rose-600" />}
                          </div>
                          <p className="mt-1 text-[11px]">
                            {testResult.gemini?.success
                              ? `Verified with ${testResult.gemini.modelUsed} in ${testResult.gemini.latencyMs}ms (Response: "${testResult.gemini.response}")`
                              : `Verification Failed: ${testResult.gemini?.error}`}
                          </p>
                        </div>

                        <div className={`p-3 rounded-lg border ${testResult.maps?.success ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                          <div className="flex items-center justify-between font-semibold">
                            <span>Google Maps / Geocoding</span>
                            {testResult.maps?.success ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                          </div>
                          <p className="mt-1 text-[11px]">
                            {testResult.maps?.note || (testResult.maps?.success ? `Status: ${testResult.maps?.status}` : `Error: ${testResult.maps?.error}`)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Key Details Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Gemini Key */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <KeyRound className="h-4 w-4 text-indigo-600" />
                          <h4 className="text-sm font-semibold text-slate-900">GEMINI_API_KEY</h4>
                        </div>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200">
                          Lazy-Loaded & Hot-Reloadable
                        </span>
                      </div>
                      <div className="mt-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <span className="text-[10px] font-medium text-slate-400 block uppercase">Masked Runtime Value</span>
                        <code className="text-xs font-mono text-slate-800 font-semibold">
                          {data?.keys.gemini.maskedKey || 'NOT_CONFIGURED'}
                        </code>
                      </div>
                      <p className="mt-3 text-xs text-slate-500 leading-relaxed">
                        Whenever the key is rotated in Secret Manager or environment variables, the server's cache detects the delta and recreates the GoogleGenAI instance seamlessly.
                      </p>
                    </div>

                    {/* Google Maps Key */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <KeyRound className="h-4 w-4 text-emerald-600" />
                          <h4 className="text-sm font-semibold text-slate-900">GOOGLE_MAPS_API_KEY</h4>
                        </div>
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 border border-indigo-200">
                          Server-Side Proxied
                        </span>
                      </div>
                      <div className="mt-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <span className="text-[10px] font-medium text-slate-400 block uppercase">Masked Runtime Value</span>
                        <code className="text-xs font-mono text-slate-800 font-semibold">
                          {data?.keys.googleMaps.maskedKey || 'NOT_CONFIGURED'}
                        </code>
                      </div>
                      <p className="mt-3 text-xs text-slate-500 leading-relaxed">
                        If absent, the application gracefully activates Leaflet, OpenStreetMap, and Komoot Photon geocoding proxy without runtime breakage.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: GEMINI FALLBACK LADDER */}
              {activeTab === 'ladder' && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                    <h3 className="text-sm font-semibold text-slate-900 mb-1">
                      Automated 4-Tier Model Fallback Protocol
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">
                      When any model experiences rate limits, latency spikes, or temporary unavailability, the system cascades down the ladder automatically.
                    </p>

                    <div className="space-y-3">
                      {data?.modelLadder.models.map((modelName, idx) => {
                        const usage = data.modelLadder.usage[modelName] || { attempts: 0, successes: 0, failures: 0 };
                        const isPrimary = idx === 0;
                        return (
                          <div
                            key={modelName}
                            className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white font-mono">
                                {idx + 1}
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-semibold text-slate-900">{modelName}</span>
                                  {isPrimary && (
                                    <span className="rounded bg-indigo-100 text-indigo-800 px-1.5 py-0.2 text-[9px] font-semibold uppercase">
                                      Primary
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400">
                                  {idx === 0
                                    ? 'Ultra-low latency default'
                                    : idx === 1
                                    ? 'High-availability lightweight backup'
                                    : idx === 2
                                    ? 'Dynamic release alias'
                                    : 'Deep reasoning fallback'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 font-mono text-xs">
                              <span className="text-slate-600">{usage.attempts} attempts</span>
                              <span className="text-emerald-700 font-semibold">{usage.successes} ok</span>
                              {usage.failures > 0 && (
                                <span className="text-rose-600 font-semibold">{usage.failures} fail</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: STRUCTURED LOGS */}
              {activeTab === 'logs' && (
                <div className="space-y-3">
                  {/* Logs toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {['all', 'gemini', 'maps', 'rotation', 'http'].map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-colors cursor-pointer ${
                            selectedCategory === cat
                              ? 'bg-slate-900 text-white'
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={searchLogTerm}
                        onChange={(e) => setSearchLogTerm(e.target.value)}
                        placeholder="Search logs..."
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        onClick={handleClearLogs}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-colors cursor-pointer"
                        title="Clear logs buffer"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Clear</span>
                      </button>
                    </div>
                  </div>

                  {/* Logs stream */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-300 max-h-[380px] overflow-y-auto space-y-2">
                    {filteredLogs.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        No log entries matching criteria.
                      </div>
                    ) : (
                      filteredLogs.map((log) => {
                        const levelColor =
                          log.level === 'error'
                            ? 'text-rose-400 bg-rose-950/60 border-rose-800'
                            : log.level === 'warn'
                            ? 'text-amber-400 bg-amber-950/60 border-amber-800'
                            : 'text-emerald-400 bg-emerald-950/60 border-emerald-800';

                        return (
                          <div
                            key={log.id}
                            className="p-2 rounded bg-slate-900/80 border border-slate-800/80 space-y-1 hover:border-slate-700 transition-colors"
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <div className="flex items-center gap-2">
                                <span className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-bold border ${levelColor}`}>
                                  {log.level}
                                </span>
                                <span className="text-indigo-400 font-semibold">[{log.category}]</span>
                                <span className="text-slate-400">{log.message}</span>
                              </div>
                              <span className="text-[10px] text-slate-500 shrink-0">
                                {new Date(log.timestamp).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </span>
                            </div>

                            {log.details && Object.keys(log.details).length > 0 && (
                              <div className="text-[10px] text-slate-400 bg-slate-950 p-1.5 rounded overflow-x-auto">
                                <pre className="whitespace-pre-wrap">{JSON.stringify(log.details, null, 2)}</pre>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3">
          <span className="text-[11px] text-slate-500">
            Node {data?.server.nodeEnv} • Cryptographic Masking & OWASP A02 Compliant
          </span>
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
