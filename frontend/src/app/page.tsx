'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield,
  LayoutDashboard,
  PlusCircle,
  CheckSquare,
  FileCode,
  History,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Server,
  User,
  Clock,
  ChevronRight,
  Send,
  Database,
  Moon,
  Bell,
  Search,
  RefreshCw,
  Sliders,
  AlertCircle
} from 'lucide-react';

// API Server URL
const API_BASE = 'http://localhost:8080/api';

export default function Home() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Data States
  const [resources, setResources] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [healthStatus, setHealthStatus] = useState<any>({
    policy_engine: 'Healthy',
    vault: 'Healthy',
    keycloak: 'Healthy',
    audit_service: 'Healthy',
    ai_service: 'Healthy',
    database: 'Healthy'
  });

  // Access Request Form States
  const [nlPrompt, setNlPrompt] = useState(
    'Give me read-only access to production Elasticsearch logs for 2 hours to investigate checkout latency.'
  );
  const [parsingData, setParsingData] = useState<any>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Approval Form States
  const [denialReasons, setDenialReasons] = useState<{ [key: string]: string }>({});

  // Audit Explorer States
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [chatbotQuery, setChatbotQuery] = useState('');
  const [chatbotResponse, setChatbotResponse] = useState('');
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [tamperBlockId, setTamperBlockId] = useState('');
  const [tamperFieldName, setTamperFieldName] = useState('user');
  const [tamperValue, setTamperValue] = useState('hacker_admin');
  const [tamperSuccessMsg, setTamperSuccessMsg] = useState('');

  // Policy Explain States
  const [customRego, setCustomRego] = useState('');
  const [policyExplanation, setPolicyExplanation] = useState('');
  const [isExplaining, setIsExplaining] = useState(false);

  // Fetch initial data & start periodic polling
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      // 1. Fetch Resources
      const resResources = await fetch(`${API_BASE}/resources`);
      if (resResources.ok) {
        const data = await resResources.json();
        setResources(data);
      }

      // 2. Fetch Access Requests
      const resRequests = await fetch(`${API_BASE}/requests`);
      if (resRequests.ok) {
        const data = await resRequests.json();
        setRequests(data);
      }

      // 3. Fetch Audit Logs
      const resLogs = await fetch(`${API_BASE}/audit/logs`);
      if (resLogs.ok) {
        const data = await resLogs.json();
        setAuditLogs(data);
      }

      // 4. Fetch Health Status
      const resHealth = await fetch(`${API_BASE}/health`);
      if (resHealth.ok) {
        const data = await resHealth.json();
        setHealthStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch api statistics', err);
    }
  };

  // 1. Parse Access Request Prompt
  const handleParsePrompt = async () => {
    if (!nlPrompt.trim()) return;
    setIsParsing(true);
    setParsingData(null);
    try {
      const response = await fetch(`${API_BASE}/request/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: nlPrompt })
      });
      if (response.ok) {
        const data = await response.json();
        setParsingData(data);
        if (data.opa_policy) {
          setCustomRego(data.opa_policy);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsParsing(false);
    }
  };

  // 2. Submit Final Request
  const handleSubmitRequest = async () => {
    if (!parsingData) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/request/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requester: 'saurabh@example.com',
          resource_id: parsingData.parsed.resource,
          permission: parsingData.parsed.permission,
          duration: parsingData.parsed.duration,
          reason: parsingData.parsed.reason
        })
      });
      if (response.ok) {
        fetchData();
        setActiveTab('dashboard');
        // Reset form
        setNlPrompt('');
        setParsingData(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Approve Request
  const handleApprove = async (id: number, action: 'approve' | 'deny', reviewer: string) => {
    try {
      const payload: any = {
        id,
        approved_by: reviewer,
        action
      };
      if (action === 'deny') {
        payload.denied_reason = denialReasons[id] || 'Insufficient justification for access tier.';
      }

      const response = await fetch(`${API_BASE}/requests/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        fetchData();
        // Clear reason text
        setDenialReasons(prev => {
          const updated = { ...prev };
          delete updated[id];
          return updated;
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 4. Verify Cryptographic Integrity
  const handleVerifyIntegrity = async () => {
    setIsVerifying(true);
    setVerificationResult(null);
    try {
      const response = await fetch(`${API_BASE}/audit/verify`, {
        method: 'POST'
      });
      if (response.ok) {
        const data = await response.json();
        setVerificationResult(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  };

  // 5. Tamper with Audit event (Simulate DB hack)
  const handleTamper = async () => {
    if (!tamperBlockId) return;
    setTamperSuccessMsg('');
    try {
      const response = await fetch(`${API_BASE}/audit/tamper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: parseInt(tamperBlockId),
          field_name: tamperFieldName,
          value: tamperValue
        })
      });
      if (response.ok) {
        setTamperSuccessMsg(`Block #${tamperBlockId} corrupted successfully! Run Verification to audit.`);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 6. Security Chatbot Queries
  const handleSecurityChatbot = async () => {
    if (!chatbotQuery.trim()) return;
    setIsInvestigating(true);
    setChatbotResponse('');
    try {
      const response = await fetch(`${API_BASE}/security/investigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: chatbotQuery })
      });
      if (response.ok) {
        const data = await response.json();
        setChatbotResponse(data.answer);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsInvestigating(false);
    }
  };

  // 7. Policy Translation
  const handleExplainPolicy = async () => {
    if (!customRego.trim()) return;
    setIsExplaining(true);
    setPolicyExplanation('');
    try {
      const response = await fetch(`${API_BASE}/policy/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rego_code: customRego })
      });
      if (response.ok) {
        const data = await response.json();
        setPolicyExplanation(data.explanation);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsExplaining(false);
    }
  };

  // Statistics calculation helpers
  const totalRequests = requests.length;
  const activeAccess = requests.filter(r => r.status === 'Active').length;
  const pendingApprovals = requests.filter(r => r.status === 'Pending Approval').length;
  const blockedRequests = requests.filter(r => r.status === 'Denied').length;

  const averageRisk = totalRequests > 0 
    ? Math.round(requests.reduce((acc, curr) => acc + curr.risk_score, 0) / totalRequests)
    : 0;

  const getRiskColor = (score: number) => {
    if (score <= 30) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    if (score <= 70) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Approved</span>;
      case 'Pending Approval':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">Pending Approval</span>;
      case 'Denied':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">Denied</span>;
      case 'Expired':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20">Expired</span>;
      case 'Revoked':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-500/10 text-red-400 border border-red-500/20">Revoked</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-600/15 text-slate-300">{status}</span>;
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-64 bg-sidebar border-r border-border-line flex flex-col justify-between select-none">
        <div>
          {/* Logo */}
          <div className="p-6 border-b border-border-line flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg text-white shadow-lg shadow-blue-600/20">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight tracking-tight text-white">SecureAccess <span className="text-blue-500 text-xs font-semibold ml-1">AI</span></h1>
              <p className="text-[10px] text-slate-500">Policy & Access Platform</p>
            </div>
          </div>

          {/* Links */}
          <nav className="p-4 space-y-6">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500 px-3 mb-2 tracking-wider">Dashboard View</p>
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm transition font-medium ${
                  activeTab === 'dashboard'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/15'
                    : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
                }`}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </button>
            </div>

            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500 px-3 mb-2 tracking-wider">Request Management</p>
              <div className="space-y-1">
                <button
                  onClick={() => setActiveTab('new-request')}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm transition font-medium ${
                    activeTab === 'new-request'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/15'
                      : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
                  }`}
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>New Request</span>
                </button>
                <button
                  onClick={() => setActiveTab('approvals')}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition font-medium ${
                    activeTab === 'approvals'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <CheckSquare className="h-4 w-4" />
                    <span>Approvals</span>
                  </div>
                  {pendingApprovals > 0 && (
                    <span className="bg-amber-500 text-slate-900 text-xs font-bold px-2 py-0.5 rounded-full">
                      {pendingApprovals}
                    </span>
                  )}
                </button>
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500 px-3 mb-2 tracking-wider">Policy Management</p>
              <button
                onClick={() => setActiveTab('policy-explorer')}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm transition font-medium ${
                  activeTab === 'policy-explorer'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/15'
                    : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
                }`}
              >
                <FileCode className="h-4 w-4" />
                <span>Policy Explorer</span>
              </button>
            </div>

            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500 px-3 mb-2 tracking-wider">Auditing</p>
              <button
                onClick={() => setActiveTab('audit-logs')}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm transition font-medium ${
                  activeTab === 'audit-logs'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/15'
                    : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
                }`}
              >
                <History className="h-4 w-4" />
                <span>Audit Logs Ledger</span>
              </button>
            </div>
          </nav>
        </div>

        {/* Profile Footer */}
        <div className="p-4 border-t border-border-line">
          <div className="flex items-center space-x-3 bg-slate-900/40 border border-border-line p-3 rounded-xl">
            <div className="w-9 h-9 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
              SS
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white">Saurabh Singh</h4>
              <p className="text-[10px] text-slate-400">Platform Engineer</p>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <main className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        {/* Top Header */}
        <header className="h-16 border-b border-border-line px-8 flex items-center justify-between select-none">
          <div className="flex items-center space-x-4">
            <span className="text-slate-500 capitalize text-xs tracking-wider">SecureAccess AI</span>
            <ChevronRight className="h-3 w-3 text-slate-600" />
            <span className="font-semibold text-sm capitalize text-white">{activeTab.replace('-', ' ')}</span>
          </div>

          <div className="flex items-center space-x-6">
            {/* Search Bar */}
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search queries..."
                className="w-full bg-slate-900 border border-border-line text-xs rounded-lg py-2 pl-9 pr-4 text-slate-300 placeholder-slate-500 focus:outline-none focus:border-slate-700"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Notification & Utilities */}
            <button onClick={fetchData} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900/60 transition">
              <RefreshCw className="h-4 w-4" />
            </button>
            <button className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900/60 transition relative">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full"></span>
            </button>
            <button className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900/60 transition">
              <Moon className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* PAGE CONTENT SWITCHER */}
        <div className="p-8 flex-1 max-w-7xl w-full mx-auto space-y-8">
          
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Row 1: Metrics */}
              <div className="grid grid-cols-5 gap-6">
                {/* Metric 1 */}
                <div className="bg-panel border border-border-line p-6 rounded-xl relative overflow-hidden group shadow-lg">
                  <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-5 text-blue-500 group-hover:scale-110 transition duration-300">
                    <Shield className="w-24 h-24" />
                  </div>
                  <p className="text-xs font-medium text-slate-400">Total Requests</p>
                  <h3 className="text-3xl font-bold text-white mt-2">{totalRequests}</h3>
                  <p className="text-[10px] text-emerald-400 flex items-center mt-2 font-semibold">
                    <span>↑ 18%</span>
                    <span className="text-slate-500 ml-1 font-normal">vs last 7 days</span>
                  </p>
                </div>
                {/* Metric 2 */}
                <div className="bg-panel border border-border-line p-6 rounded-xl relative overflow-hidden group shadow-lg">
                  <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-5 text-emerald-500 group-hover:scale-110 transition duration-300">
                    <Clock className="w-24 h-24" />
                  </div>
                  <p className="text-xs font-medium text-slate-400">Active Access</p>
                  <h3 className="text-3xl font-bold text-white mt-2">{activeAccess}</h3>
                  <p className="text-[10px] text-emerald-400 flex items-center mt-2 font-semibold">
                    <span>↑ 12%</span>
                    <span className="text-slate-500 ml-1 font-normal">currently active</span>
                  </p>
                </div>
                {/* Metric 3 */}
                <div className="bg-panel border border-border-line p-6 rounded-xl relative overflow-hidden group shadow-lg">
                  <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-5 text-amber-500 group-hover:scale-110 transition duration-300">
                    <AlertTriangle className="w-24 h-24" />
                  </div>
                  <p className="text-xs font-medium text-slate-400">Pending Approvals</p>
                  <h3 className="text-3xl font-bold text-white mt-2">{pendingApprovals}</h3>
                  <p className="text-[10px] text-amber-400 flex items-center mt-2 font-semibold">
                    <span>↓ 5%</span>
                    <span className="text-slate-500 ml-1 font-normal">requires your action</span>
                  </p>
                </div>
                {/* Metric 4 */}
                <div className="bg-panel border border-border-line p-6 rounded-xl relative overflow-hidden group shadow-lg">
                  <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-5 text-rose-500 group-hover:scale-110 transition duration-300">
                    <XCircle className="w-24 h-24" />
                  </div>
                  <p className="text-xs font-medium text-slate-400">Blocked Requests</p>
                  <h3 className="text-3xl font-bold text-white mt-2">{blockedRequests}</h3>
                  <p className="text-[10px] text-rose-400 flex items-center mt-2 font-semibold">
                    <span>↓ 38%</span>
                    <span className="text-slate-500 ml-1 font-normal">vs last 7 days</span>
                  </p>
                </div>
                {/* Metric 5: Gauge */}
                <div className="bg-panel border border-border-line p-6 rounded-xl relative overflow-hidden flex items-center justify-between shadow-lg">
                  <div>
                    <p className="text-xs font-medium text-slate-400">Risk Score (Overall)</p>
                    <h3 className="text-2xl font-bold text-white mt-2">{averageRisk} <span className="text-slate-500 text-xs font-normal">/100</span></h3>
                    <p className={`text-[10px] font-semibold mt-2 ${averageRisk <= 35 ? 'text-emerald-400' : averageRisk <= 70 ? 'text-amber-400' : 'text-rose-400'}`}>
                      {averageRisk <= 35 ? 'Low Risk' : averageRisk <= 70 ? 'Medium Risk' : 'High Risk'}
                    </p>
                  </div>
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    {/* SVG Gauge */}
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="32" cy="32" r="28" stroke="#1e293b" strokeWidth="6" fill="transparent" />
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke={averageRisk <= 35 ? '#10b981' : averageRisk <= 70 ? '#f59e0b' : '#ef4444'}
                        strokeWidth="6"
                        fill="transparent"
                        strokeDasharray={175}
                        strokeDashoffset={175 - (175 * averageRisk) / 100}
                      />
                    </svg>
                    <span className="absolute text-[10px] font-bold text-white">{averageRisk}%</span>
                  </div>
                </div>
              </div>

              {/* Row 2: Graph & Recent Activity Feed */}
              <div className="grid grid-cols-3 gap-6">
                {/* Requests Over Time SVG Chart */}
                <div className="bg-panel border border-border-line p-6 rounded-xl col-span-2 shadow-lg flex flex-col justify-between">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h4 className="text-sm font-semibold text-white">Access Requests Over Time</h4>
                      <p className="text-[10px] text-slate-500">Historical trend mapping of requests and policy approvals</p>
                    </div>
                    <div className="flex space-x-4 text-[10px]">
                      <span className="flex items-center text-slate-300"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 mr-1.5 inline-block"></span>All Requests</span>
                      <span className="flex items-center text-slate-300"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1.5 inline-block"></span>Approved</span>
                      <span className="flex items-center text-slate-300"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 mr-1.5 inline-block"></span>Denied</span>
                    </div>
                  </div>
                  
                  {/* SVG Line Graph */}
                  <div className="h-56 relative w-full px-2">
                    <svg className="w-full h-full" viewBox="0 0 600 200" preserveAspectRatio="none">
                      {/* Grid Lines */}
                      <line x1="0" y1="40" x2="600" y2="40" stroke="#1e2435" strokeWidth="1" strokeDasharray="5,5" />
                      <line x1="0" y1="80" x2="600" y2="80" stroke="#1e2435" strokeWidth="1" strokeDasharray="5,5" />
                      <line x1="0" y1="120" x2="600" y2="120" stroke="#1e2435" strokeWidth="1" strokeDasharray="5,5" />
                      <line x1="0" y1="160" x2="600" y2="160" stroke="#1e2435" strokeWidth="1" strokeDasharray="5,5" />

                      {/* Line Paths (Mock data mimicking screenshot trends) */}
                      {/* All Requests (Blue) */}
                      <polyline
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="3"
                        points="0,110 100,100 200,90 300,70 400,60 500,80 600,75"
                      />
                      {/* Approved (Green) */}
                      <polyline
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2.5"
                        points="0,140 100,130 200,120 300,100 400,90 500,110 600,105"
                      />
                      {/* Denied (Red) */}
                      <polyline
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="2"
                        points="0,180 100,175 200,178 300,165 400,168 500,172 600,170"
                      />

                      {/* Interactive dots */}
                      <circle cx="300" cy="70" r="5" fill="#3b82f6" stroke="#07090e" strokeWidth="2" />
                      <circle cx="300" cy="100" r="4.5" fill="#10b981" stroke="#07090e" strokeWidth="2" />
                      <circle cx="300" cy="165" r="4" fill="#ef4444" stroke="#07090e" strokeWidth="2" />
                    </svg>
                    
                    {/* Graph Labels */}
                    <div className="flex justify-between text-[9px] text-slate-500 mt-2">
                      <span>May 12</span>
                      <span>May 13</span>
                      <span>May 14</span>
                      <span>May 15</span>
                      <span>May 16</span>
                      <span>May 17</span>
                      <span>May 18</span>
                    </div>
                  </div>
                </div>

                {/* Activity Feed */}
                <div className="bg-panel border border-border-line p-6 rounded-xl shadow-lg flex flex-col justify-between">
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-white">Recent Activity</h4>
                    <p className="text-[10px] text-slate-500">Live access grants and ledger event streams</p>
                  </div>
                  
                  <div className="space-y-4 flex-1 overflow-y-auto max-h-56 pr-2">
                    {auditLogs.slice(0, 5).map((logItem, index) => (
                      <div key={index} className="flex space-x-3 text-xs border-b border-slate-900/60 pb-3 last:border-b-0 last:pb-0">
                        <div className="mt-0.5">
                          {logItem.action === 'access_granted' && <CheckCircle className="h-4 w-4 text-emerald-400" />}
                          {logItem.action === 'access_expired' && <Clock className="h-4 w-4 text-slate-400" />}
                          {logItem.action === 'access_denied' && <XCircle className="h-4 w-4 text-rose-400" />}
                          {logItem.action === 'request_created' && <Shield className="h-4 w-4 text-blue-400" />}
                          {logItem.action === 'manager_approved' && <CheckSquare className="h-4 w-4 text-emerald-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white truncate font-medium">
                            {logItem.action.replace('_', ' ')}
                            <span className="text-[10px] text-slate-400 ml-1.5 font-normal">for {logItem.resource_id}</span>
                          </p>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">
                            User: {logItem.user}
                          </p>
                          <p className="text-[9px] text-slate-500 mt-1">
                            {new Date(logItem.timestamp).toLocaleTimeString()} • ID #{logItem.id}
                          </p>
                        </div>
                      </div>
                    ))}
                    {auditLogs.length === 0 && (
                      <p className="text-xs text-slate-500 text-center py-8">No recent events logged.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 3: Charts and Warnings */}
              <div className="grid grid-cols-4 gap-6">
                {/* Donut Chart: Risk Levels */}
                <div className="bg-panel border border-border-line p-6 rounded-xl shadow-lg flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-white">Requests by Risk Level</h4>
                    <p className="text-[10px] text-slate-500">Volume cataloged by risk classification</p>
                  </div>
                  
                  {/* Conic Ring chart */}
                  <div className="flex justify-center my-4 relative">
                    <div className="w-28 h-28 rounded-full border-[10px] border-slate-900 flex items-center justify-center relative" style={{
                      backgroundImage: 'conic-gradient(#10b981 0% 60%, #f59e0b 60% 85%, #ef4444 85% 100%)'
                    }}>
                      <div className="absolute inset-[10px] bg-panel rounded-full flex flex-col items-center justify-center">
                        <span className="text-xl font-bold text-white">{totalRequests}</span>
                        <span className="text-[9px] text-slate-500">Total</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-[10px] text-slate-400">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2"></span>Low (0-30)</span>
                      <span className="font-semibold text-white">62.9%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 mr-2"></span>Medium (31-70)</span>
                      <span className="font-semibold text-white">25.8%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 mr-2"></span>High (71-100)</span>
                      <span className="font-semibold text-white">11.3%</span>
                    </div>
                  </div>
                </div>

                {/* Horizontal Progress Bars: Top Resources */}
                <div className="bg-panel border border-border-line p-6 rounded-xl col-span-2 shadow-lg flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-white">Top Resources Accessed</h4>
                    <p className="text-[10px] text-slate-500">Resource request frequencies across all environments</p>
                  </div>
                  
                  <div className="space-y-4 my-2">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300 font-medium">prod-logs <span className="text-[10px] text-slate-500">(Elasticsearch)</span></span>
                        <span className="font-bold text-white">45</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full rounded-full" style={{ width: '85%' }}></div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300 font-medium">staging-k8s <span className="text-[10px] text-slate-500">(Cluster)</span></span>
                        <span className="font-bold text-white">28</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full rounded-full" style={{ width: '55%' }}></div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300 font-medium">prod-db <span className="text-[10px] text-slate-500">(Database)</span></span>
                        <span className="font-bold text-white">18</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full rounded-full" style={{ width: '35%' }}></div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300 font-medium">s3-bucket-analytics <span className="text-[10px] text-slate-500">(Storage)</span></span>
                        <span className="font-bold text-white">12</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full rounded-full" style={{ width: '22%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Health indicator */}
                <div className="bg-panel border border-border-line p-6 rounded-xl shadow-lg flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-white">System Health</h4>
                    <p className="text-[10px] text-slate-500">Connection state of backing integrations</p>
                  </div>
                  
                  <div className="space-y-2.5 my-3 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-900/60 pb-1.5">
                      <span className="text-slate-400">Policy Engine (OPA)</span>
                      <span className="flex items-center text-emerald-400 font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2"></span>Healthy</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-900/60 pb-1.5">
                      <span className="text-slate-400">Vault (Secrets)</span>
                      <span className="flex items-center text-emerald-400 font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2"></span>Healthy</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-900/60 pb-1.5">
                      <span className="text-slate-400">Audit Ledger Service</span>
                      <span className={`flex items-center font-semibold ${healthStatus.audit_service.includes('Anomalous') ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-2 ${healthStatus.audit_service.includes('Anomalous') ? 'bg-rose-400' : 'bg-emerald-400'}`}></span>
                        {healthStatus.audit_service.includes('Anomalous') ? 'Tampered' : 'Secure'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-900/60 pb-1.5">
                      <span className="text-slate-400">AI Service (Gemini)</span>
                      <span className="flex items-center text-emerald-400 font-semibold truncate max-w-[120px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2 flex-shrink-0"></span>
                        <span className="truncate">Active</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Database Engine</span>
                      <span className="flex items-center text-emerald-400 font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2"></span>Healthy</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 4: Recent Access Requests Table */}
              <div className="bg-panel border border-border-line rounded-xl shadow-lg overflow-hidden">
                <div className="p-6 border-b border-border-line flex justify-between items-center">
                  <div>
                    <h4 className="text-sm font-semibold text-white">Recent Access Requests</h4>
                    <p className="text-[10px] text-slate-500">Comprehensive table showing developer access leases</p>
                  </div>
                  <button onClick={() => setActiveTab('new-request')} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 transition text-white text-xs font-semibold rounded-lg flex items-center">
                    <PlusCircle className="w-3.5 h-3.5 mr-1.5" /> Request Access
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border-line bg-slate-900/40 text-slate-400 uppercase text-[9px] tracking-wider">
                        <th className="p-4 font-bold">Requester</th>
                        <th className="p-4 font-bold">Resource</th>
                        <th className="p-4 font-bold">Permission</th>
                        <th className="p-4 font-bold">Duration</th>
                        <th className="p-4 font-bold text-center">Risk Score</th>
                        <th className="p-4 font-bold">Status</th>
                        <th className="p-4 font-bold">Requested At</th>
                        <th className="p-4 font-bold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/60 text-slate-300">
                      {requests.map((req, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/20 transition">
                          <td className="p-4 font-medium text-white">{req.requester}</td>
                          <td className="p-4">
                            <span className="font-mono bg-slate-900 border border-border-line px-2 py-0.5 rounded text-[10px] text-blue-400">
                              {req.resource_id}
                            </span>
                          </td>
                          <td className="p-4 capitalize">{req.permission}</td>
                          <td className="p-4 font-mono">{req.duration}</td>
                          <td className="p-4 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRiskColor(req.risk_score)}`}>
                              {req.risk_score}/100
                            </span>
                          </td>
                          <td className="p-4">{getStatusBadge(req.status)}</td>
                          <td className="p-4 text-slate-500">{new Date(req.requested_at).toLocaleString()}</td>
                          <td className="p-4">
                            <button
                              onClick={() => {
                                if (req.status === 'Pending Approval') {
                                  setActiveTab('approvals');
                                } else {
                                  setActiveTab('audit-logs');
                                }
                              }}
                              className="text-blue-500 hover:text-blue-400 font-semibold"
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))}
                      {requests.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-500">
                            No access requests registered. Go to "New Request" to create one.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: NEW REQUEST */}
          {activeTab === 'new-request' && (
            <div className="grid grid-cols-5 gap-8">
              {/* Form Input Area */}
              <div className="col-span-3 space-y-6">
                <div className="bg-panel border border-border-line p-6 rounded-xl shadow-lg space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-white">Submit Access Request</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Describe what temporary infrastructure permissions you require in natural language.</p>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-medium">Access Prompt</label>
                    <textarea
                      rows={3}
                      className="w-full bg-slate-900 border border-border-line rounded-lg p-3 text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                      value={nlPrompt}
                      onChange={e => setNlPrompt(e.target.value)}
                      placeholder="e.g., Give me read access to production databases for 4 hours to verify hotfix data sync."
                    />
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-slate-500">Gemini parsing compiles Rego policy automatically.</span>
                    <button
                      onClick={handleParsePrompt}
                      disabled={isParsing}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg flex items-center transition shadow-md shadow-blue-600/10"
                    >
                      {isParsing ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" /> Parsing Prompt...
                        </>
                      ) : (
                        <>
                          <Sliders className="w-3.5 h-3.5 mr-2" /> Interpret with AI
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* AI Interpret Console */}
                {parsingData && (
                  <div className="bg-panel border border-border-line p-6 rounded-xl shadow-lg space-y-6">
                    <div className="border-b border-border-line pb-4">
                      <h4 className="text-sm font-semibold text-white flex items-center">
                        <span className="w-2.5 h-2.5 bg-blue-500 rounded-full mr-2 inline-block animate-ping"></span>
                        AI Extraction Output
                      </h4>
                      <p className="text-[10px] text-slate-500">Dynamic variables matched from prompt</p>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-900">
                        <span className="text-[10px] text-slate-500 uppercase block font-bold">Resource</span>
                        <span className="text-xs font-mono font-bold text-white mt-1 block">{parsingData.parsed.resource}</span>
                      </div>
                      <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-900">
                        <span className="text-[10px] text-slate-500 uppercase block font-bold">Permission</span>
                        <span className="text-xs font-mono font-bold text-white mt-1 block capitalize">{parsingData.parsed.permission}</span>
                      </div>
                      <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-900">
                        <span className="text-[10px] text-slate-500 uppercase block font-bold">Duration</span>
                        <span className="text-xs font-mono font-bold text-white mt-1 block">{parsingData.parsed.duration}</span>
                      </div>
                      <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-900">
                        <span className="text-[10px] text-slate-500 uppercase block font-bold">Risk Level</span>
                        <span className={`text-xs font-bold mt-1 block ${
                          parsingData.risk_level === 'Low' ? 'text-emerald-400' : parsingData.risk_level === 'Medium' ? 'text-amber-400' : 'text-rose-400'
                        }`}>{parsingData.risk_level} ({parsingData.risk_score}/100)</span>
                      </div>
                    </div>

                    <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-900">
                      <span className="text-[10px] text-slate-500 uppercase block font-bold mb-1">Reason Description</span>
                      <p className="text-xs text-slate-300 italic">"{parsingData.parsed.reason}"</p>
                    </div>

                    {parsingData.least_privilege_suggestion && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-xs flex items-start space-x-2">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-bold text-[10px] uppercase">Least Privilege Recommendation</p>
                          <p className="mt-0.5">{parsingData.least_privilege_suggestion}</p>
                        </div>
                      </div>
                    )}

                    <div className="border-t border-border-line pt-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-slate-300">Approval Workflow Routing:</p>
                        <p className="text-[10px] text-slate-500">{parsingData.approval_path}</p>
                      </div>
                      
                      <button
                        onClick={handleSubmitRequest}
                        disabled={isSubmitting}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition shadow-md shadow-emerald-600/10"
                      >
                        {isSubmitting ? 'Evaluating OPA...' : 'Submit Policy & Request'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Policy Preview Code block */}
              <div className="col-span-2 bg-panel border border-border-line rounded-xl shadow-lg p-6 flex flex-col justify-between overflow-hidden">
                <div className="space-y-4 flex-1 flex flex-col min-h-0">
                  <div>
                    <h3 className="text-base font-semibold text-white">OPA Policy Preview</h3>
                    <p className="text-xs text-slate-500">Live Rego policy compiled by AI compiler</p>
                  </div>

                  <div className="flex-1 bg-slate-950 border border-slate-900 rounded-lg p-4 font-mono text-[10px] text-slate-300 overflow-auto max-h-96">
                    {parsingData ? (
                      <pre className="whitespace-pre">{parsingData.opa_policy}</pre>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-600 select-none">
                        Submit a prompt to view generated Rego policy.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: APPROVALS */}
          {activeTab === 'approvals' && (
            <div className="space-y-6">
              <div className="bg-panel border border-border-line p-6 rounded-xl shadow-lg">
                <h3 className="text-base font-semibold text-white">Pending Requests Center</h3>
                <p className="text-xs text-slate-500 mt-0.5">Manager and Security Admin approvals for medium/high risk leases.</p>
              </div>

              <div className="space-y-6">
                {requests.filter(r => r.status === 'Pending Approval').map((req, idx) => (
                  <div key={idx} className="bg-panel border border-border-line rounded-xl overflow-hidden shadow-lg grid grid-cols-3">
                    
                    {/* Access Request Details */}
                    <div className="p-6 border-r border-border-line col-span-2 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">Request ID: <span className="font-semibold text-white">#{req.ID || req.id}</span></span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRiskColor(req.risk_score)}`}>
                          Risk Score: {req.risk_score}/100
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-slate-500 block">Requester Profile</span>
                          <span className="font-semibold text-slate-200">{req.requester}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Duration Requested</span>
                          <span className="font-semibold text-slate-200">{req.duration}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Target Resource</span>
                          <span className="font-mono bg-slate-900 border border-slate-900 px-2 py-0.5 rounded text-blue-400 font-semibold">{req.resource_id}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Permission Access Tier</span>
                          <span className="font-semibold text-slate-200 capitalize">{req.permission}</span>
                        </div>
                      </div>

                      <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-900 text-xs">
                        <span className="text-slate-500 block font-bold">Developer Reason</span>
                        <p className="text-slate-300 italic mt-1">"{req.reason}"</p>
                      </div>
                    </div>

                    {/* Action Block */}
                    <div className="p-6 bg-slate-900/30 flex flex-col justify-between space-y-4">
                      <div className="space-y-3">
                        <span className="text-xs text-slate-400 font-medium block">Approve/Deny Controls</span>
                        <textarea
                          rows={2}
                          className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-800"
                          placeholder="Provide approval comments or denial justification..."
                          value={denialReasons[req.ID || req.id] || ''}
                          onChange={e => setDenialReasons(prev => ({ ...prev, [req.ID || req.id]: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        {/* If Medium risk: Manager Approval sufficient. High risk: Security Admin required */}
                        {req.risk_score <= 70 ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApprove(req.ID || req.id, 'approve', 'Manager_Reviewer')}
                              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 transition text-white text-xs font-semibold rounded-lg shadow-sm shadow-emerald-600/10"
                            >
                              Approve as Manager
                            </button>
                            <button
                              onClick={() => handleApprove(req.ID || req.id, 'deny', 'Manager_Reviewer')}
                              className="px-3 py-2 bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 transition text-xs font-semibold rounded-lg"
                            >
                              Deny
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApprove(req.ID || req.id, 'approve', 'Security_Admin')}
                                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 transition text-white text-xs font-semibold rounded-lg shadow-sm shadow-indigo-600/10"
                              >
                                Approve as Security Admin
                              </button>
                              <button
                                onClick={() => handleApprove(req.ID || req.id, 'deny', 'Security_Admin')}
                                className="px-3 py-2 bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 transition text-xs font-semibold rounded-lg"
                              >
                                Deny
                              </button>
                            </div>
                            <span className="text-[9px] text-rose-400 font-semibold block text-center">
                              ⚠️ Risk Score {req.risk_score} requires Security Admin explicit Override.
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {requests.filter(r => r.status === 'Pending Approval').length === 0 && (
                  <div className="bg-panel border border-border-line p-8 text-center text-slate-500 rounded-xl">
                    All clear! No access requests require approval actions.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: AUDIT LOGS LEDGER */}
          {activeTab === 'audit-logs' && (
            <div className="grid grid-cols-3 gap-8">
              {/* Ledger stream */}
              <div className="col-span-2 space-y-6">
                <div className="bg-panel border border-border-line p-6 rounded-xl shadow-lg flex justify-between items-center">
                  <div>
                    <h3 className="text-base font-semibold text-white">Tamper-Evident Ledger</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Verification hash chains of access grants</p>
                  </div>

                  <button
                    onClick={handleVerifyIntegrity}
                    disabled={isVerifying}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 transition text-white text-xs font-semibold rounded-lg flex items-center shadow-md shadow-blue-600/10"
                  >
                    {isVerifying ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" /> Verifying Chain...
                      </>
                    ) : (
                      <>
                        <Shield className="w-3.5 h-3.5 mr-2" /> Verify Hash Chain Integrity
                      </>
                    )}
                  </button>
                </div>

                {/* Verification Result Banner */}
                {verificationResult && (
                  <div className={`p-4 border rounded-xl flex items-start space-x-3 shadow-lg ${
                    verificationResult.valid
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-400 animate-pulse'
                  }`}>
                    {verificationResult.valid ? (
                      <CheckCircle className="w-5 h-5 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    )}
                    <div className="text-xs">
                      <p className="font-bold uppercase tracking-wide">
                        {verificationResult.valid ? 'Cryptographic Audit Verified' : 'CRITICAL LEDGER TAMPER DETECTED'}
                      </p>
                      <p className="mt-1">
                        {verificationResult.valid
                          ? `Verification succeeded. Reviewed ${verificationResult.total_blocks} ledger transaction blocks. All cryptographically chained signatures (prev_hash -> current_hash) match.`
                          : `Ledger verification failed! Anomalous data tampering detected. ${verificationResult.failure_message}`
                        }
                      </p>
                    </div>
                  </div>
                )}

                {/* Audit Table */}
                <div className="bg-panel border border-border-line rounded-xl overflow-hidden shadow-lg">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border-line bg-slate-900/40 text-slate-400 uppercase text-[9px] tracking-wider">
                          <th className="p-4 font-bold">ID</th>
                          <th className="p-4 font-bold">Timestamp</th>
                          <th className="p-4 font-bold">User</th>
                          <th className="p-4 font-bold">Action</th>
                          <th className="p-4 font-bold">Resource</th>
                          <th className="p-4 font-bold font-mono">Chaining Hash</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900/60 text-slate-300">
                        {auditLogs.map((logItem, idx) => (
                          <tr key={idx} className={`hover:bg-slate-900/10 transition ${
                            logItem.status === 'tampered' ? 'bg-rose-500/5 text-rose-300' : ''
                          }`}>
                            <td className="p-4 font-bold">#{logItem.id}</td>
                            <td className="p-4 text-slate-500">{new Date(logItem.timestamp).toLocaleTimeString()}</td>
                            <td className="p-4 font-medium text-white">{logItem.user}</td>
                            <td className="p-4 capitalize">
                              <span className={`px-2 py-0.5 rounded text-[10px] ${
                                logItem.action.includes('grant') ? 'bg-emerald-500/10 text-emerald-400' :
                                logItem.action.includes('expire') ? 'bg-slate-800 text-slate-400' : 'bg-slate-900 text-slate-300'
                              }`}>
                                {logItem.action.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="p-4 font-mono text-[10px] text-blue-400">{logItem.resource_id}</td>
                            <td className="p-4 font-mono text-[9px] text-slate-500">
                              <span className="hover:text-slate-300 transition cursor-help block max-w-[120px] truncate" title={logItem.hash}>
                                {logItem.hash.substring(0, 16)}...
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Chatbot & Developer Corrupt ledger Panel */}
              <div className="space-y-6">
                {/* AI Security Investigator Chat */}
                <div className="bg-panel border border-border-line rounded-xl shadow-lg p-6 flex flex-col h-[340px] justify-between">
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-white flex items-center">
                      <Shield className="w-4 h-4 mr-2 text-blue-500" />
                      Security Investigator
                    </h4>
                    <p className="text-[10px] text-slate-500">NLP query engine checking audit data histories</p>
                  </div>

                  <div className="flex-1 bg-slate-950/80 border border-slate-900 rounded-lg p-3 my-4 overflow-y-auto text-xs space-y-3">
                    {chatbotResponse ? (
                      <div className="space-y-2">
                        <div className="bg-blue-600/10 border border-blue-500/15 p-2.5 rounded-lg text-blue-300">
                          <span className="font-bold text-[9px] block text-blue-400 uppercase">Audit Query</span>
                          "{chatbotQuery}"
                        </div>
                        <div className="bg-slate-900/60 p-2.5 rounded-lg text-slate-300 border border-slate-900">
                          <span className="font-bold text-[9px] block text-slate-500 uppercase">AI Investigator</span>
                          {chatbotResponse}
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-600 text-center select-none p-4">
                        Ask questions like: "Who accessed staging-k8s?" or "Who has active access?"
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      className="w-full bg-slate-900 border border-border-line text-xs rounded-lg py-2.5 pl-3 pr-10 text-slate-300 placeholder-slate-500 focus:outline-none"
                      placeholder="Investigate access history..."
                      value={chatbotQuery}
                      onChange={e => setChatbotQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSecurityChatbot()}
                    />
                    <button
                      onClick={handleSecurityChatbot}
                      disabled={isInvestigating}
                      className="absolute right-2 top-2 text-slate-400 hover:text-white p-1"
                    >
                      {isInvestigating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Ledger Tampering Simulator */}
                <div className="bg-panel border border-border-line rounded-xl shadow-lg p-6 space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-white flex items-center">
                      <AlertTriangle className="w-4 h-4 mr-2 text-rose-500" />
                      Tamper Simulator
                    </h4>
                    <p className="text-[10px] text-slate-500">Inject database anomalies to verify tamper detection</p>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="flex gap-2">
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] text-slate-500">Block ID</label>
                        <input
                          type="number"
                          placeholder="e.g. 1"
                          className="w-full bg-slate-900 border border-border-line text-xs rounded-lg p-2 text-white focus:outline-none"
                          value={tamperBlockId}
                          onChange={e => setTamperBlockId(e.target.value)}
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] text-slate-500">Field</label>
                        <select
                          className="w-full bg-slate-900 border border-border-line text-xs rounded-lg p-2 text-white focus:outline-none"
                          value={tamperFieldName}
                          onChange={e => setTamperFieldName(e.target.value)}
                        >
                          <option value="user">User Name</option>
                          <option value="details">Details Payload</option>
                          <option value="hash">Hash Value</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500">Injection Value</label>
                      <input
                        type="text"
                        placeholder="attacker_admin"
                        className="w-full bg-slate-900 border border-border-line text-xs rounded-lg p-2 text-white focus:outline-none"
                        value={tamperValue}
                        onChange={e => setTamperValue(e.target.value)}
                      />
                    </div>

                    <button
                      onClick={handleTamper}
                      className="w-full py-2 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/20 hover:border-rose-500/30 text-rose-400 font-semibold transition text-xs rounded-lg"
                    >
                      Corrupt Database Record
                    </button>

                    {tamperSuccessMsg && (
                      <p className="text-[10px] text-rose-400 font-semibold text-center mt-2 animate-pulse">{tamperSuccessMsg}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: POLICY EXPLORER */}
          {activeTab === 'policy-explorer' && (
            <div className="grid grid-cols-5 gap-8">
              {/* Rules List */}
              <div className="col-span-3 space-y-6">
                <div className="bg-panel border border-border-line p-6 rounded-xl shadow-lg">
                  <h3 className="text-base font-semibold text-white">Default Risk Configuration</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Global parameters governing OPA rules and required approvals.</p>
                </div>

                <div className="space-y-4">
                  {resources.map((res, index) => (
                    <div key={index} className="bg-panel border border-border-line p-5 rounded-xl flex items-center justify-between shadow-lg">
                      <div className="flex items-start space-x-3">
                        <div className="mt-1 p-2 bg-slate-900 border border-border-line rounded-lg text-blue-400">
                          <Database className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-white">{res.name}</h4>
                          <p className="text-[10px] text-slate-500">{res.description}</p>
                          <div className="flex space-x-3 mt-1.5 text-[9px] text-slate-400">
                            <span className="bg-slate-900 px-2 py-0.5 rounded border border-border-line uppercase font-mono">{res.type}</span>
                            <span className="bg-slate-900 px-2 py-0.5 rounded border border-border-line capitalize">{res.environment}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`px-2.5 py-1 rounded text-xs font-bold border block text-center ${
                          res.default_risk <= 30 ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' :
                          res.default_risk <= 70 ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' :
                          'text-rose-500 bg-rose-500/10 border-rose-500/20'
                        }`}>
                          Risk: {res.default_risk}%
                        </span>
                        <span className="text-[9px] text-slate-500 mt-1 block">
                          {res.default_risk <= 30 ? 'Auto-Approve' :
                           res.default_risk <= 70 ? 'Requires Manager' :
                           'Requires Security'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Policy Translator AI Assistant */}
              <div className="col-span-2 space-y-6">
                <div className="bg-panel border border-border-line rounded-xl shadow-lg p-6 flex flex-col justify-between min-h-[420px]">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-base font-semibold text-white">Policy Review Assistant</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Input custom Rego rules and get plain English explanations.</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] text-slate-400 font-medium uppercase block">Rego Policy</label>
                      <textarea
                        rows={7}
                        className="w-full bg-slate-900 border border-border-line rounded-lg p-2.5 font-mono text-[10px] text-slate-300 focus:outline-none"
                        value={customRego}
                        onChange={e => setCustomRego(e.target.value)}
                        placeholder="package access..."
                      />
                    </div>

                    {policyExplanation && (
                      <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-900 text-xs">
                        <span className="font-bold text-[9px] block text-blue-400 uppercase mb-1">AI Explanation</span>
                        <p className="text-slate-300 leading-relaxed">{policyExplanation}</p>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleExplainPolicy}
                    disabled={isExplaining || !customRego.trim()}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition"
                  >
                    {isExplaining ? 'Translating Policy...' : 'Explain Rego Policy'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
