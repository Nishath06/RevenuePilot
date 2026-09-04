import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KPICard } from '../components/cards/KPICard';
import {
  ShoppingBag, Zap, Copy, Check, Send, AlertTriangle, XCircle,
  RotateCcw, MessageSquare, Mail, Search, Filter, Download,
  CheckSquare, Square, Eye, Clock, CheckCircle2, User, Phone,
  Percent, Award, ShieldAlert, Sparkles, X, Save, FileText,
  CalendarCheck
} from 'lucide-react';
import { aiAPI } from '../services/api';
import toast from 'react-hot-toast';

export const RecoveryPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'failed' | 'cancelled' | 'abandoned'>('all');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [segmentFilter, setSegmentFilter] = useState('all');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Multi-select for Bulk Actions
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());

  // Modal State
  const [selectedCard, setSelectedCard] = useState<any | null>(null);
  const [modalHistory, setModalHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editEmail, setEditEmail] = useState('');
  const [editSMS, setEditSMS] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);
  const [showTimeline, setShowTimeline] = useState(true);

  // Analysis State
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);

  // Scheduled Recovery Modal & Lambda Execution State
  const [showScheduledModal, setShowScheduledModal] = useState(false);
  const [scheduledCandidates, setScheduledCandidates] = useState<any[]>([]);
  const [scheduledCount, setScheduledCount] = useState<number>(0);
  const [loadingScheduled, setLoadingScheduled] = useState(false);
  const [runningLambda, setRunningLambda] = useState(false);
  const [scheduledSearch, setScheduledSearch] = useState('');

  const fetchScheduledCandidates = async () => {
    setLoadingScheduled(true);
    try {
      const res = await aiAPI.getScheduledCandidates();
      const list = res.data?.candidates || [];
      setScheduledCandidates(list);
      setScheduledCount(list.length);
    } catch (err) {
      console.error('Failed to fetch scheduled candidates', err);
      toast.error('Failed to load scheduled recovery candidates');
    } finally {
      setLoadingScheduled(false);
    }
  };

  const openScheduledModal = () => {
    setShowScheduledModal(true);
    fetchScheduledCandidates();
  };

  const handleRunRecoveryLambda = async () => {
    setRunningLambda(true);
    const toastId = toast.loading('Invoking AWS RecoveryLambda for scheduled candidates...');
    try {
      const res = await aiAPI.runRecoveryLambda();
      const output = res.data?.result?.output || res.data;
      const count = output?.candidates_processed ?? (scheduledCandidates.length || 1);
      const emails = output?.emails_sent ?? 0;
      toast.success(
        `RecoveryLambda executed successfully! Processed ${count} candidate(s), sent ${emails} email(s).`,
        { id: toastId, duration: 6000 }
      );
      fetchScheduledCandidates();
      fetchData();
    } catch (err: any) {
      console.error('RecoveryLambda error:', err);
      toast.error('Failed to run RecoveryLambda: ' + (err.response?.data?.detail || err.message || 'Execution error'), { id: toastId });
    } finally {
      setRunningLambda(false);
    }
  };

  const handleAnalyzeCustomers = async () => {
    setAnalyzing(true);
    const toastId = toast.loading('Running Recovery Intelligence Agent (Gemini)...');
    try {
      const res = await aiAPI.analyzeRecovery({ period: selectedPeriod });
      setAnalysisResult(res.data);
      toast.success('Customer analysis complete! Candidates scheduled.', { id: toastId });
      fetchData();
      fetchScheduledCandidates();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to run customer analysis', { id: toastId });
    } finally {
      setAnalyzing(false);
    }
  };

  const fetchData = () => {
    setLoading(true);
    aiAPI.recovery(selectedPeriod)
      .then((r) => setData(r.data))
      .catch((err) => {
        console.error(err);
        toast.error('Failed to load recovery data');
      })
      .finally(() => setLoading(false));

    aiAPI.getScheduledCandidates()
      .then((r) => setScheduledCount(r.data?.count ?? (r.data?.candidates?.length || 0)))
      .catch(() => {});
  };

  useEffect(() => {
    fetchData();
  }, [selectedPeriod]);

  const filteredScheduled = scheduledCandidates.filter((cand: any) => {
    if (!scheduledSearch.trim()) return true;
    const q = scheduledSearch.toLowerCase();
    const matchName = cand.customer_name?.toLowerCase().includes(q);
    const matchEmail = cand.customer_email?.toLowerCase().includes(q);
    const matchId = (cand.candidate_id || cand.order_id || '')?.toLowerCase().includes(q);
    return matchName || matchEmail || matchId;
  });

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const failedItems = data?.failed_payments ?? [];
  const cancelledItems = data?.cancelled_orders ?? [];
  const abandonedCarts = data?.abandoned_carts ?? [];
  const total = data?.total_recoverable_amount ?? 0;

  const allRecoveryCards = [
    ...failedItems.map((item: any) => ({ ...item, category: 'failed' })),
    ...cancelledItems.map((item: any) => ({ ...item, category: 'cancelled' })),
    ...abandonedCarts.map((item: any) => ({ ...item, category: 'abandoned', amount: item.subtotal || item.amount })),
  ];

  // Apply Tab, Search, and Filters
  const filteredCards = allRecoveryCards.filter((card: any) => {
    if (activeTab !== 'all' && card.category !== activeTab) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = card.customer_name?.toLowerCase().includes(q);
      const matchEmail = card.customer_email?.toLowerCase().includes(q);
      const matchOrder = card.order_id?.toLowerCase().includes(q) || card.candidate_id?.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchOrder) return false;
    }

    // Priority filter
    if (priorityFilter !== 'all' && card.priority?.toUpperCase() !== priorityFilter.toUpperCase()) return false;

    // Segment filter
    if (segmentFilter !== 'all' && card.segment?.toUpperCase() !== segmentFilter.toUpperCase()) return false;

    // Failure reason filter
    if (reasonFilter !== 'all' && !card.failure_reason?.toLowerCase().includes(reasonFilter.toLowerCase())) return false;

    // Status filter
    if (statusFilter !== 'all') {
      const st = (card.recovery_status || 'PENDING').toUpperCase();
      if (statusFilter === 'PENDING' && st !== 'PENDING') return false;
      if (statusFilter === 'SENT' && !st.includes('SENT')) return false;
      if (statusFilter === 'RECOVERED' && st !== 'RECOVERED') return false;
      if (statusFilter === 'SKIPPED' && st !== 'SKIPPED') return false;
    }

    return true;
  });

  // Action Handlers with Optimistic Updates
  const handleSingleAction = async (
    candidateId: string,
    actionType: 'email' | 'sms' | 'both' | 'skip'
  ) => {
    setActionLoading((prev) => ({ ...prev, [candidateId]: true }));
    try {
      let res: any;
      if (actionType === 'email') {
        res = await aiAPI.sendEmail(candidateId);
        toast.success('Personalized recovery email sent!');
      } else if (actionType === 'sms') {
        res = await aiAPI.sendSMS(candidateId);
        toast.success('Recovery SMS sent!');
      } else if (actionType === 'both') {
        res = await aiAPI.sendBoth(candidateId);
        toast.success('Multi-channel recovery (Email & SMS) dispatched!');
      } else if (actionType === 'skip') {
        res = await aiAPI.skip(candidateId);
        toast.success('Candidate skipped');
      }

      // Optimistically update card status in state
      if (res?.data) {
        const updatedCandidate = res.data;
        setData((prevData: any) => {
          if (!prevData) return prevData;
          const updateList = (list: any[]) =>
            list.map((item) =>
              (item.candidate_id === candidateId || item.order_id === candidateId)
                ? { ...item, ...updatedCandidate }
                : item
            );
          return {
            ...prevData,
            failed_payments: updateList(prevData.failed_payments || []),
            cancelled_orders: updateList(prevData.cancelled_orders || []),
            abandoned_carts: updateList(prevData.abandoned_carts || []),
          };
        });

        if (selectedCard && (selectedCard.candidate_id === candidateId || selectedCard.order_id === candidateId)) {
          setSelectedCard((prev: any) => ({ ...prev, ...updatedCandidate }));
          fetchModalHistory(candidateId);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error(`Action failed for candidate`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [candidateId]: false }));
    }
  };

  // Bulk Actions
  const handleBulkAction = async (actionType: 'email' | 'sms' | 'both' | 'skip') => {
    if (selectedCandidates.size === 0) return;
    const candidates = Array.from(selectedCandidates);
    toast.loading(`Processing bulk ${actionType} for ${candidates.length} candidates...`, { id: 'bulk-toast' });

    for (const id of candidates) {
      try {
        if (actionType === 'email') await aiAPI.sendEmail(id);
        else if (actionType === 'sms') await aiAPI.sendSMS(id);
        else if (actionType === 'both') await aiAPI.sendBoth(id);
        else if (actionType === 'skip') await aiAPI.skip(id);
      } catch (err) {
        console.error(`Bulk error for ${id}:`, err);
      }
    }

    toast.success(`Bulk ${actionType} completed!`, { id: 'bulk-toast' });
    setSelectedCandidates(new Set());
    fetchData();
  };

  const handleExportCSV = () => {
    const selectedList = allRecoveryCards.filter((card) =>
      selectedCandidates.has(card.candidate_id || card.order_id)
    );
    if (selectedList.length === 0) {
      toast.error('Select candidates to export CSV');
      return;
    }

    const headers = ['Candidate ID', 'Customer Name', 'Email', 'Phone', 'Amount', 'Type', 'Priority', 'Segment', 'Status', 'Failure Reason'];
    const rows = selectedList.map((c: any) => [
      c.candidate_id || c.order_id,
      `"${c.customer_name || ''}"`,
      c.customer_email || '',
      c.customer_phone || '',
      c.amount || 0,
      c.category,
      c.priority || 'MEDIUM',
      c.segment || 'NEW',
      c.recovery_status || 'PENDING',
      `"${c.failure_reason || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `recovery_candidates_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV Exported!');
  };

  // Modal Details & History
  const openDetailsModal = (card: any) => {
    const cid = card.candidate_id || card.order_id;
    setSelectedCard(card);
    setEditEmail(card.email_message || '');
    setEditSMS(card.whatsapp_message || '');
    setEditNotes(card.notes || '');
    fetchModalHistory(cid);
  };

  const fetchModalHistory = (cid: string) => {
    setHistoryLoading(true);
    aiAPI
      .getHistory(cid)
      .then((r) => setModalHistory(r.data?.history || []))
      .catch((err) => console.error(err))
      .finally(() => setHistoryLoading(false));
  };

  const handleSaveDraft = async () => {
    if (!selectedCard) return;
    const cid = selectedCard.candidate_id || selectedCard.order_id;
    setSavingDraft(true);
    try {
      const res = await aiAPI.updateMessage(cid, {
        email_message: editEmail,
        whatsapp_message: editSMS,
        notes: editNotes,
      });
      toast.success('Draft templates saved to MongoDB!');
      if (res?.data) {
        setSelectedCard((prev: any) => ({ ...prev, ...res.data }));
        fetchModalHistory(cid);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to save draft');
    } finally {
      setSavingDraft(false);
    }
  };

  // Status Badge Helper Component
  const renderStatusBadge = (status: string) => {
    const st = (status || 'PENDING').toUpperCase();
    let style = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    let label = 'PENDING';

    if (st === 'EMAIL_SENT') {
      style = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      label = 'EMAIL SENT';
    } else if (st === 'SMS_SENT') {
      style = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      label = 'SMS SENT';
    } else if (st === 'EMAIL+SMS_SENT') {
      style = 'bg-teal-500/20 text-teal-300 border-teal-500/30';
      label = 'EMAIL + SMS SENT';
    } else if (st === 'RECOVERED') {
      style = 'bg-emerald-600 text-white font-black border-emerald-500';
      label = 'RECOVERED';
    } else if (st === 'SKIPPED') {
      style = 'bg-slate-700/50 text-slate-400 border-slate-600/30';
      label = 'SKIPPED';
    } else if (st === 'FAILED') {
      style = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      label = 'FAILED';
    }

    return (
      <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${style} uppercase tracking-wider`}>
        {label}
      </span>
    );
  };

  return (
    <div className="space-y-8 max-w-screen-xl mx-auto pb-12">
      {/* Header Banner & Time Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-emerald-400" />
            AI Merchant Recovery Operations
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manual recovery workspace: analyze unrecovered checkouts, preview AI messages, and dispatch campaigns.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
          {/* Manual Trigger — Analyze Customers */}
          <button
            onClick={handleAnalyzeCustomers}
            disabled={analyzing}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-extrabold rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Sparkles className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
            {analyzing ? 'Analyzing Customers...' : 'Analyze Customers'}
          </button>

          {/* Scheduled Recoveries Queue & Lambda Button */}
          <button
            onClick={openScheduledModal}
            className="px-4 py-2.5 bg-[#162032] hover:bg-[#1E293B] text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/60 text-sm font-extrabold rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
          >
            <CalendarCheck className="w-4 h-4 text-emerald-400" />
            Scheduled Recoveries
            {scheduledCount > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-300 font-mono font-black rounded-full border border-emerald-500/30">
                {scheduledCount}
              </span>
            )}
          </button>

          {/* Feature 1 — Time Period Filter */}
          <div className="flex items-center gap-2 bg-[#111827] p-1.5 rounded-xl border border-[#1E293B]">
            <Clock className="w-4 h-4 text-slate-400 ml-2" />
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-transparent text-sm font-bold text-white focus:outline-none pr-2 cursor-pointer"
            >
              <option value="today" className="bg-slate-900 text-white">Today</option>
              <option value="week" className="bg-slate-900 text-white">This Week</option>
              <option value="month" className="bg-slate-900 text-white">This Month</option>
              <option value="all" className="bg-slate-900 text-white">All Time</option>
            </select>
          </div>

          {total > 0 && (
            <div className="px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-sm font-extrabold text-rose-400 flex items-center gap-2">
              <Zap className="w-4 h-4 text-rose-400" />
              ₹{total.toLocaleString('en-IN')} Recoverable Opportunity
            </div>
          )}
        </div>
      </div>

      {/* Feature 3 — 5 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard label="Failed Payments" value={data?.failed_count ?? failedItems.length} icon={XCircle} color="rose" loading={loading} index={0} />
        <KPICard label="Cancelled Payments" value={data?.cancelled_count ?? cancelledItems.length} icon={AlertTriangle} color="amber" loading={loading} index={1} />
        <KPICard label="Abandoned Carts" value={data?.abandoned_count ?? abandonedCarts.length} icon={ShoppingBag} color="indigo" loading={loading} index={2} />
        <KPICard label="Total Recoverable" value={`₹${total.toLocaleString('en-IN')}`} icon={Zap} color="emerald" loading={loading} index={3} />

        {/* Feature 3 — Recovery Success Rate Card */}
        <div className="bg-[#111827] p-5 rounded-2xl border border-[#1E293B] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Success Rate</span>
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-white">{data?.success_rate_percentage ?? 0}%</span>
              <span className="text-xs text-slate-400 font-bold">
                {data?.recovered_count ?? 0} / {data?.total_candidates_count ?? 0}
              </span>
            </div>
            <p className="text-[11px] text-teal-400 mt-1 font-medium">Recovered in period</p>
          </div>
        </div>
      </div>

      {/* Feature 8 — Recovery Filters & Search Toolbar */}
      <div className="bg-[#111827] p-4 rounded-2xl border border-[#1E293B] space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search customer, email, order..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#161F30] border border-[#1E293B] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Priority */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-[#161F30] border border-[#1E293B] text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Priority</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
            </select>

            {/* Segment */}
            <select
              value={segmentFilter}
              onChange={(e) => setSegmentFilter(e.target.value)}
              className="bg-[#161F30] border border-[#1E293B] text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Segments</option>
              <option value="VIP">VIP</option>
              <option value="LOYAL">Loyal</option>
              <option value="HIGH_VALUE">High Value</option>
              <option value="AT_RISK">At Risk</option>
              <option value="NEW">New</option>
            </select>

            {/* Failure Reason */}
            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              className="bg-[#161F30] border border-[#1E293B] text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Reasons</option>
              <option value="otp">OTP Expired</option>
              <option value="upi">UPI PIN Incorrect</option>
              <option value="timeout">Gateway Timeout</option>
              <option value="declined">Bank Declined</option>
              <option value="cancelled">Cancelled</option>
            </select>

            {/* Recovery Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#161F30] border border-[#1E293B] text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="SENT">Sent</option>
              <option value="RECOVERED">Recovered</option>
              <option value="SKIPPED">Skipped</option>
            </select>
          </div>
        </div>

        {/* Feature 7 — Bulk Actions Toolbar */}
        <div className="flex flex-wrap items-center justify-between pt-3 border-t border-[#1E293B] text-xs gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (selectedCandidates.size === filteredCards.length) {
                  setSelectedCandidates(new Set());
                } else {
                  const allIds = filteredCards.map((c) => c.candidate_id || c.order_id);
                  setSelectedCandidates(new Set(allIds));
                }
              }}
              className="flex items-center gap-1.5 font-bold text-slate-300 hover:text-white transition-colors"
            >
              {selectedCandidates.size > 0 && selectedCandidates.size === filteredCards.length ? (
                <CheckSquare className="w-4 h-4 text-emerald-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-500" />
              )}
              Select All ({filteredCards.length})
            </button>

            {selectedCandidates.size > 0 && (
              <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 font-extrabold rounded-md border border-indigo-500/30">
                {selectedCandidates.size} Selected
              </span>
            )}
          </div>

          {selectedCandidates.size > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleBulkAction('email')}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5" /> Send Email to Selected
              </button>
              <button
                onClick={() => handleBulkAction('sms')}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5" /> Send SMS to Selected
              </button>
              <button
                onClick={() => handleBulkAction('both')}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" /> Send Both
              </button>
              <button
                onClick={() => handleBulkAction('skip')}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-lg transition-colors"
              >
                Skip Selected
              </button>
              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-bold rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Export Selected CSV
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#1E293B] pb-3">
        {[
          { key: 'all', label: `All Items (${allRecoveryCards.length})` },
          { key: 'failed', label: `Failed Payments (${failedItems.length})` },
          { key: 'cancelled', label: `Cancelled Payments (${cancelledItems.length})` },
          { key: 'abandoned', label: `Abandoned Carts (${abandonedCarts.length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === tab.key
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Recovery Action Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-96 bg-[#111827] rounded-2xl border border-[#1E293B]" />
          ))}
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="text-center py-20 text-slate-500 bg-[#111827] rounded-2xl border border-[#1E293B]">
          <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30 text-emerald-400" />
          <p className="font-semibold text-slate-300">No unrecovered items match current filters.</p>
          <p className="text-xs text-slate-500 mt-1">Try clearing filters or selecting another time period.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCards.map((card: any, i: number) => {
            const cardId = card.candidate_id || card.order_id || card.user_id || `item-${i}`;
            const isSelected = selectedCandidates.has(cardId);
            const isFailed = card.category === 'failed';
            const isCancelled = card.category === 'cancelled';
            const isLoadingAction = actionLoading[cardId];

            return (
              <motion.div
                key={cardId}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`bg-[#111827] rounded-2xl border transition-all overflow-hidden flex flex-col justify-between ${
                  isSelected ? 'border-emerald-500/50 shadow-lg shadow-emerald-950/20' : 'border-[#1E293B]'
                }`}
              >
                {/* Top Category Strip */}
                <div
                  className={`h-1.5 ${
                    isFailed ? 'bg-rose-500' : isCancelled ? 'bg-amber-400' : 'bg-indigo-500'
                  }`}
                />

                <div className="p-5 space-y-4 flex-1">
                  {/* Title Bar, Checkbox, Priority & Status Badges */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-start gap-2.5">
                      <button
                        onClick={() => {
                          const next = new Set(selectedCandidates);
                          if (next.has(cardId)) next.delete(cardId);
                          else next.add(cardId);
                          setSelectedCandidates(next);
                        }}
                        className="mt-1"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />
                        )}
                      </button>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-extrabold text-white">{card.customer_name}</h3>
                          {card.priority && (
                            <span
                              className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase ${
                                card.priority === 'CRITICAL'
                                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                  : card.priority === 'HIGH'
                                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                            >
                              {card.priority}
                            </span>
                          )}
                        </div>
                        {card.customer_email && (
                          <p className="text-xs text-slate-400 truncate max-w-[190px]">{card.customer_email}</p>
                        )}
                      </div>
                    </div>

                    {/* Feature 5 — Status Badge */}
                    <div className="flex flex-col items-end gap-1">
                      {renderStatusBadge(card.recovery_status)}
                      {card.segment && (
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                          {card.segment}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* AI Score & Coupon Bar */}
                  <div className="flex items-center justify-between text-xs bg-[#161F30] px-3 py-1.5 rounded-xl border border-[#1E293B]">
                    <span className="font-extrabold text-emerald-400 flex items-center gap-1">
                      <Percent className="w-3.5 h-3.5" />
                      Score: {card.recovery_score || 80}%
                    </span>
                    {card.coupon_code && (
                      <span className="font-mono text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        {card.coupon_code} ({card.recommended_discount || 15}% OFF)
                      </span>
                    )}
                  </div>

                  {/* Target Amount & Failure Reason */}
                  <div className="bg-[#1E293B]/60 p-3 rounded-xl border border-[#1E293B] space-y-1">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-slate-400">Target Amount</span>
                      <span className="text-lg font-extrabold text-white">
                        ₹{(card.amount || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    {card.failure_reason && (
                      <p className="text-xs text-rose-400 font-medium flex items-center gap-1.5 pt-1 border-t border-[#1E293B]">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{card.failure_reason}</span>
                      </p>
                    )}
                  </div>

                  {/* Previews */}
                  <div className="space-y-2 text-xs">
                    {/* SMS */}
                    {card.whatsapp_message && (
                      <div className="bg-[#1E293B]/40 p-2.5 rounded-xl border border-[#1E293B] flex items-start gap-2">
                        <MessageSquare className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 text-[11px] text-slate-300 line-clamp-2">
                          {card.whatsapp_message}
                        </div>
                        <button
                          onClick={() => copy(card.whatsapp_message, `sms-${cardId}`)}
                          className="p-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors flex-shrink-0"
                          title="Copy SMS"
                        >
                          {copied === `sms-${cardId}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}

                    {/* Email */}
                    {card.email_message && (
                      <div className="bg-[#1E293B]/40 p-2.5 rounded-xl border border-[#1E293B] flex items-start gap-2">
                        <Mail className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 text-[11px] text-slate-300 line-clamp-2">
                          {card.email_message}
                        </div>
                        <button
                          onClick={() => copy(card.email_message, `email-${cardId}`)}
                          className="p-1.5 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded-lg transition-colors flex-shrink-0"
                          title="Copy Email"
                        >
                          {copied === `email-${cardId}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Feature 4 — Action Buttons Footer */}
                <div className="p-3.5 bg-[#161F30] border-t border-[#1E293B] flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    {/* Send Email (Green) */}
                    <button
                      onClick={() => handleSingleAction(cardId, 'email')}
                      disabled={isLoadingAction}
                      className="py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-950/20"
                    >
                      <Mail className="w-3.5 h-3.5" /> Email
                    </button>

                    {/* Send SMS (Blue) */}
                    <button
                      onClick={() => handleSingleAction(cardId, 'sms')}
                      disabled={isLoadingAction}
                      className="py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-blue-950/20"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> SMS
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {/* Send Both (Primary) */}
                    <button
                      onClick={() => handleSingleAction(cardId, 'both')}
                      disabled={isLoadingAction}
                      className="col-span-2 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-indigo-950/20"
                    >
                      {isLoadingAction ? (
                        <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      Send Both
                    </button>

                    {/* Skip (Grey Outline) */}
                    <button
                      onClick={() => handleSingleAction(cardId, 'skip')}
                      disabled={isLoadingAction}
                      className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 rounded-xl text-xs font-bold transition-all"
                    >
                      Skip
                    </button>
                  </div>

                  {/* View Details Modal Trigger */}
                  <button
                    onClick={() => openDetailsModal(card)}
                    className="w-full py-1.5 bg-[#111827] hover:bg-slate-800 text-slate-300 border border-[#1E293B] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all mt-1"
                  >
                    <Eye className="w-3.5 h-3.5 text-indigo-400" /> View Details & Workspace
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Feature 6 & 9 — Recovery Details & Timeline Modal */}
      <AnimatePresence>
        {selectedCard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#111827] border border-[#1E293B] rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col justify-between"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-[#1E293B] flex items-center justify-between sticky top-0 bg-[#111827] z-10">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-black text-white">{selectedCard.customer_name}</h2>
                    {renderStatusBadge(selectedCard.recovery_status)}
                    <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-mono font-bold border border-indigo-500/30">
                      ID: {selectedCard.candidate_id || selectedCard.order_id}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Complete Recovery Workspace • Priority: <strong className="text-amber-400">{selectedCard.priority || 'MEDIUM'}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedCard(null)}
                  className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6 flex-1">
                {/* Customer Identity Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#161F30] p-4 rounded-2xl border border-[#1E293B] text-xs">
                  <div>
                    <span className="text-slate-500 block font-semibold">Email</span>
                    <span className="text-slate-200 font-bold truncate block">{selectedCard.customer_email || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-semibold">Phone</span>
                    <span className="text-slate-200 font-bold block">{selectedCard.customer_phone || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-semibold">Customer Segment</span>
                    <span className="text-emerald-400 font-black block">{selectedCard.segment || 'NEW'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-semibold">Recovery Score</span>
                    <span className="text-amber-400 font-black block">{selectedCard.recovery_score || 80}% ({selectedCard.confidence || 0.85} Conf.)</span>
                  </div>

                  <div>
                    <span className="text-slate-500 block font-semibold">Coupon Code</span>
                    <span className="text-amber-300 font-mono font-bold block">{selectedCard.coupon_code || 'RECOVER15'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-semibold">Recoverable Revenue</span>
                    <span className="text-white font-extrabold text-sm block">₹{(selectedCard.amount || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-semibold">Customer LTV</span>
                    <span className="text-white font-extrabold block">₹{(selectedCard.ltv || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-semibold">Previous Orders</span>
                    <span className="text-slate-200 font-bold block">{selectedCard.previous_orders || 0} Paid</span>
                  </div>
                </div>

                {/* AI Reasoning */}
                <div className="bg-indigo-950/20 border border-indigo-500/20 p-4 rounded-2xl space-y-1 text-xs">
                  <h4 className="font-extrabold text-indigo-400 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> AI Gemini Recommendation & Insights
                  </h4>
                  <p className="text-slate-300 font-medium leading-relaxed">
                    {selectedCard.reasoning || 'Recovery AI evaluated this checkout as high conversion probability. Recommended automated discount applied.'}
                  </p>
                </div>

                {/* Template Editing Area */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Email Template Textarea */}
                  <div className="space-y-2">
                    <label className="text-xs font-extrabold text-slate-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Mail className="w-4 h-4 text-indigo-400" /> Email Template Preview (Editable)
                      </span>
                    </label>
                    <textarea
                      rows={5}
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full bg-[#161F30] border border-[#1E293B] rounded-2xl p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors font-sans"
                    />
                  </div>

                  {/* SMS Template Textarea */}
                  <div className="space-y-2">
                    <label className="text-xs font-extrabold text-slate-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-emerald-400" /> SMS / WhatsApp Preview (Editable)
                      </span>
                    </label>
                    <textarea
                      rows={5}
                      value={editSMS}
                      onChange={(e) => setEditSMS(e.target.value)}
                      className="w-full bg-[#161F30] border border-[#1E293B] rounded-2xl p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors font-sans"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-400">Internal Admin Notes</label>
                  <input
                    type="text"
                    placeholder="Add manual notes regarding this recovery candidate..."
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full bg-[#161F30] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Feature 9 — Recovery Timeline Section */}
                <div className="border border-[#1E293B] rounded-2xl overflow-hidden bg-[#161F30]/50">
                  <button
                    onClick={() => setShowTimeline(!showTimeline)}
                    className="w-full p-4 flex items-center justify-between font-bold text-xs text-slate-300 hover:bg-[#1E293B]/40 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-400" /> Candidate Recovery Timeline & History
                    </span>
                    <span>{showTimeline ? 'Hide Timeline' : 'Show Timeline'}</span>
                  </button>

                  {showTimeline && (
                    <div className="p-4 border-t border-[#1E293B] space-y-3 text-xs">
                      {historyLoading ? (
                        <p className="text-slate-500">Loading timeline history...</p>
                      ) : modalHistory.length === 0 ? (
                        <p className="text-slate-500">No events logged yet for this candidate.</p>
                      ) : (
                        modalHistory.map((item: any, idx: number) => (
                          <div key={idx} className="flex items-start gap-3 border-l-2 border-emerald-500/40 pl-3 py-1">
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-extrabold text-white">{item.action}</span>
                                <span className="text-[10px] text-slate-500">
                                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400">{item.details}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="p-6 border-t border-[#1E293B] bg-[#161F30] flex flex-wrap items-center justify-between gap-3 sticky bottom-0">
                <button
                  onClick={handleSaveDraft}
                  disabled={savingDraft}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {savingDraft ? 'Saving Draft...' : 'Save Draft'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const cid = selectedCard.candidate_id || selectedCard.order_id;
                      handleSingleAction(cid, 'email');
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Mail className="w-4 h-4" /> Send Email
                  </button>

                  <button
                    onClick={() => {
                      const cid = selectedCard.candidate_id || selectedCard.order_id;
                      handleSingleAction(cid, 'sms');
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" /> Send SMS
                  </button>

                  <button
                    onClick={() => {
                      const cid = selectedCard.candidate_id || selectedCard.order_id;
                      handleSingleAction(cid, 'both');
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Send className="w-4 h-4" /> Send Both
                  </button>

                  <button
                    onClick={() => setSelectedCard(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Analysis Result Popup Modal */}
        {analysisResult && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0F172A] border border-emerald-500/30 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">AI Analysis Complete</h3>
                    <p className="text-xs text-slate-400">Recovery Intelligence Agent Summary</p>
                  </div>
                </div>
                <button
                  onClick={() => setAnalysisResult(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#161F30] p-4 rounded-xl border border-slate-800">
                  <p className="text-xs font-bold text-slate-400 uppercase">Customers Analyzed</p>
                  <p className="text-2xl font-black text-white mt-1">{analysisResult.customers_analyzed}</p>
                </div>
                <div className="bg-[#161F30] p-4 rounded-xl border border-slate-800">
                  <p className="text-xs font-bold text-emerald-400 uppercase">Candidates Scheduled</p>
                  <p className="text-2xl font-black text-emerald-400 mt-1">{analysisResult.candidates_created}</p>
                </div>
                <div className="bg-[#161F30] p-4 rounded-xl border border-slate-800">
                  <p className="text-xs font-bold text-slate-400 uppercase">Failed Payments</p>
                  <p className="text-lg font-extrabold text-slate-200 mt-1">{analysisResult.failed_payments}</p>
                </div>
                <div className="bg-[#161F30] p-4 rounded-xl border border-slate-800">
                  <p className="text-xs font-bold text-slate-400 uppercase">Cancelled / Carts</p>
                  <p className="text-lg font-extrabold text-slate-200 mt-1">
                    {(analysisResult.cancelled_payments || 0) + (analysisResult.abandoned_carts || 0)}
                  </p>
                </div>
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl space-y-1">
                <div className="flex justify-between items-center text-xs text-emerald-300 font-extrabold uppercase">
                  <span>Recoverable Revenue</span>
                  <span>Dispatch Schedule</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xl font-black text-white">
                    ₹{(analysisResult.recoverable_revenue || 0).toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs font-bold px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30">
                    {analysisResult.scheduled_campaign_time || 'Today 6:00 PM IST'}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => {
                    setAnalysisResult(null);
                    openScheduledModal();
                  }}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl transition-colors shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CalendarCheck className="w-5 h-5" />
                  View Scheduled Candidates Queue
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Scheduled Candidates & RecoveryLambda Dispatch Modal */}
        {showScheduledModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-[#0F172A] border border-[#1E293B] rounded-3xl max-w-5xl w-full max-h-[92vh] overflow-hidden shadow-2xl flex flex-col justify-between text-white"
            >
              {/* Modal Header */}
              <div className="p-6 bg-[#162032] border-b border-[#1E293B] flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-20">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      <CalendarCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                        Agent Scheduled Recovery Queue
                        <span className="text-xs bg-emerald-500/20 text-emerald-300 font-mono font-black px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                          {scheduledCandidates.length} Candidates
                        </span>
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Customers scheduled by Recovery Intelligence Agent in MongoDB ready for SES + SNS dispatch.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* RUN RECOVERY LAMBDA BUTTON */}
                  <button
                    onClick={handleRunRecoveryLambda}
                    disabled={runningLambda || loadingScheduled || scheduledCandidates.length === 0}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all cursor-pointer"
                  >
                    {runningLambda ? (
                      <RotateCcw className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Zap className="w-4 h-4 fill-white text-white" />
                    )}
                    {runningLambda ? 'Running Lambda...' : 'Run RecoveryLambda Now'}
                  </button>

                  <button
                    onClick={() => setShowScheduledModal(false)}
                    className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Toolbar & Stats */}
              <div className="px-6 py-4 bg-[#111827] border-b border-[#1E293B] flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search scheduled customer name, email or ID..."
                    value={scheduledSearch}
                    onChange={(e) => setScheduledSearch(e.target.value)}
                    className="w-full bg-[#1A2436] border border-[#1E293B] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <div className="px-3 py-1.5 bg-[#162032] border border-[#1E293B] rounded-xl text-slate-300">
                    Total Recoverable:{' '}
                    <strong className="text-emerald-400 font-extrabold">
                      ₹
                      {scheduledCandidates
                        .reduce((acc, c) => acc + (c.recoverable_revenue || c.amount || 0), 0)
                        .toLocaleString('en-IN')}
                    </strong>
                  </div>
                  <button
                    onClick={fetchScheduledCandidates}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${loadingScheduled ? 'animate-spin' : ''}`} />
                    Refresh Queue
                  </button>
                </div>
              </div>

              {/* Scheduled Candidates List */}
              <div className="p-6 overflow-y-auto space-y-4 max-h-[60vh]">
                {loadingScheduled ? (
                  <div className="space-y-3 animate-pulse">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="h-28 bg-[#162032] rounded-2xl border border-[#1E293B]" />
                    ))}
                  </div>
                ) : filteredScheduled.length === 0 ? (
                  <div className="text-center py-16 bg-[#162032]/40 rounded-2xl border border-[#1E293B] text-slate-400">
                    <CalendarCheck className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                    <p className="font-bold text-sm text-slate-300">No scheduled recovery candidates found.</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Click <strong className="text-emerald-400">"Analyze Customers"</strong> in the dashboard to generate AI recovery candidates.
                    </p>
                  </div>
                ) : (
                  filteredScheduled.map((cand: any, idx: number) => {
                    const cid = cand.candidate_id || cand.order_id || `cand-${idx}`;
                    const amount = cand.recoverable_revenue || cand.amount || 0;
                    const isCritical = cand.priority === 'CRITICAL';
                    const isHigh = cand.priority === 'HIGH';

                    return (
                      <div
                        key={cid}
                        className="p-5 bg-[#162032] hover:bg-[#1C293F] border border-[#1E293B] rounded-2xl transition-all space-y-3"
                      >
                        {/* Top Info Bar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-black text-sm">
                              {cand.customer_name?.[0]?.toUpperCase() || 'C'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-extrabold text-white text-sm">{cand.customer_name}</h4>
                                <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                                  {cid}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                                <span>{cand.customer_email || 'No Email'}</span>
                                {cand.customer_phone && <span>• {cand.customer_phone}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-start sm:self-auto">
                            <span
                              className={`text-[10px] font-black px-2.5 py-1 rounded-full border uppercase ${
                                isCritical
                                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                  : isHigh
                                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              }`}
                            >
                              {cand.priority || 'MEDIUM'}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-1 bg-slate-800 text-slate-300 rounded-full uppercase border border-slate-700">
                              {cand.segment || 'STANDARD'}
                            </span>
                            <span className="text-[10px] font-black px-2.5 py-1 bg-amber-500/10 text-amber-400 rounded-full uppercase border border-amber-500/20">
                              {cand.status || 'SCHEDULED'}
                            </span>
                          </div>
                        </div>

                        {/* Details & Personalization Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-2 border-t border-[#1E293B]">
                          {/* Financials & Signal */}
                          <div className="p-3 bg-[#0F172A] rounded-xl border border-[#1E293B] space-y-1">
                            <span className="text-slate-400 text-[11px]">Recoverable Amount</span>
                            <div className="text-base font-black text-emerald-400">
                              ₹{amount.toLocaleString('en-IN')}
                            </div>
                            <div className="text-[11px] text-slate-400 pt-1">
                              Signal:{' '}
                              <span className="text-amber-300 font-bold">
                                {cand.trigger_signal || cand.failure_reason || cand.recovery_signal || 'PAYMENT_FAILED'}
                              </span>
                            </div>
                          </div>

                          {/* AI Personalization & Coupon */}
                          <div className="p-3 bg-[#0F172A] rounded-xl border border-[#1E293B] space-y-1">
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-slate-400">AI Recovery Score</span>
                              <span className="text-emerald-400 font-extrabold">
                                {cand.recovery_score || 85}%
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-300 truncate">
                              <strong>Subject:</strong> {cand.email_subject || 'Complete your transaction'}
                            </div>
                            {cand.coupon_code && (
                              <div className="text-[11px] font-mono text-amber-400 font-bold">
                                Coupon: {cand.coupon_code} ({cand.recommended_discount || 15}% OFF)
                              </div>
                            )}
                          </div>

                          {/* Action Channels */}
                          <div className="p-3 bg-[#0F172A] rounded-xl border border-[#1E293B] flex flex-col justify-between">
                            <div className="text-[11px] text-slate-400">
                              Dispatch Channel:{' '}
                              <strong className="text-teal-300">
                                {cand.recommended_channel || cand.channel || 'EMAIL+SMS'}
                              </strong>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1">
                              Scheduled:{' '}
                              {cand.created_at
                                ? new Date(cand.created_at).toLocaleString('en-IN')
                                : 'Now'}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-5 bg-[#162032] border-t border-[#1E293B] flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-0 z-20">
                <div className="text-xs text-slate-400">
                  Showing <strong className="text-white">{filteredScheduled.length}</strong> of{' '}
                  <strong className="text-white">{scheduledCandidates.length}</strong> scheduled candidates.
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => setShowScheduledModal(false)}
                    className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleRunRecoveryLambda}
                    disabled={runningLambda || loadingScheduled || scheduledCandidates.length === 0}
                    className="w-full sm:w-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Zap className="w-4 h-4" />
                    Dispatch RecoveryLambda
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
