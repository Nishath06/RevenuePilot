import re

file_path = r'e:\Cloud projects\Razorpay\revenuepilot-merchant\frontend\src\pages\AutomationCenter.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add to TabType
content = content.replace("  | 'demo_generator';", "  | 'demo_generator'\n  | 'recovery_ai';")

# Add the Tab
tab_str = "{ key: 'operations_console', label: 'Live Operations Console', icon: Server },"
new_tab = tab_str + "\n          { key: 'recovery_ai', label: 'Recovery AI', icon: Sparkles },"
content = content.replace(tab_str, new_tab)

# Define State for Recovery AI
state_insertion = """  // Developer Test Event State"""
new_state = """  // Recovery AI State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [showAnalysisSuccess, setShowAnalysisSuccess] = useState(false);
  const [candidates, setCandidates] = useState<any[]>([]);

  const handleAnalyzeCustomers = async () => {
    setIsAnalyzing(true);
    try {
      const res = await automationAPI.analyzeRecovery();
      setAnalysisResult(res.data);
      setShowAnalysisSuccess(true);
      // Refresh candidates list
      loadRecoveryCandidates();
      loadData(); // refresh dashboard metrics
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const loadRecoveryCandidates = async () => {
    try {
      const res = await automationAPI.getRecoveryCandidates();
      setCandidates(res.data.candidates || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === 'recovery_ai') {
      loadRecoveryCandidates();
    }
  }, [activeTab]);

""" + state_insertion
content = content.replace(state_insertion, new_state)

# Add the Recovery AI UI
ui_insertion = """      {/* ── TAB: LIVE OPERATIONS CONSOLE (Unified Dashboard) ────────────────── */}"""
recovery_ai_ui = """
      {/* ── TAB: RECOVERY AI (V4.1) ────────────────────────────────────────── */}
      {activeTab === 'recovery_ai' && (
        <div className="space-y-6">
          <div className="bg-[#0B1120] border border-[#00F5A0]/30 rounded-3xl p-6 space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#00F5A0]/10 rounded-full blur-3xl" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1E293B] pb-4 relative z-10">
              <div>
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-[#00F5A0]" />
                  Recovery Intelligence Agent
                </h3>
                <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                  AI analyzes failed payments and predicts customers most likely to recover. It automatically generates optimized coupons and schedules personalized recovery campaigns for 18:00 IST.
                </p>
              </div>

              <button
                onClick={handleAnalyzeCustomers}
                disabled={isAnalyzing}
                className="px-6 py-3 bg-[#00F5A0] text-slate-950 font-black text-sm rounded-xl shadow-[0_0_20px_rgba(0,245,160,0.3)] hover:shadow-[0_0_30px_rgba(0,245,160,0.5)] transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Analyzing Customers...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" /> Analyze Customers
                  </>
                )}
              </button>
            </div>

            {/* Analysis Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
              {[
                { label: 'Customers Analyzed', val: analysisResult?.customers_analyzed || '--', icon: Activity },
                { label: 'Candidates Created', val: analysisResult?.candidates_created || '--', icon: Cpu },
                { label: 'Critical Recoveries', val: analysisResult?.critical || '--', icon: AlertCircle },
                { label: 'Recoverable Revenue', val: analysisResult ? `₹${analysisResult.recoverable_revenue.toLocaleString()}` : '--', icon: Database },
              ].map((m, i) => (
                <div key={i} className="bg-[#050816] p-4 rounded-2xl border border-[#1E293B] flex flex-col justify-between">
                  <span className="text-[11px] text-slate-400 uppercase font-mono font-bold flex items-center gap-1.5">
                    <m.icon className="w-3 h-3 text-[#00F5A0]" /> {m.label}
                  </span>
                  <span className="text-xl font-black text-white mt-2">{m.val}</span>
                </div>
              ))}
            </div>

            {/* Candidate Table */}
            <div className="mt-8 relative z-10">
              <h4 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" /> Scheduled Recovery Candidates
              </h4>
              <div className="overflow-x-auto rounded-xl border border-[#1E293B]">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#111827] text-slate-400 border-b border-[#1E293B]">
                    <tr>
                      <th className="p-3 font-bold">Customer</th>
                      <th className="p-3 font-bold">Segment</th>
                      <th className="p-3 font-bold">Score</th>
                      <th className="p-3 font-bold">Coupon</th>
                      <th className="p-3 font-bold">Priority</th>
                      <th className="p-3 font-bold">Scheduled Time</th>
                      <th className="p-3 font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-[#0B1120] divide-y divide-[#1E293B]">
                    {candidates.map((cand: any, i: number) => (
                      <tr key={i} className="hover:bg-white/5 transition-colors">
                        <td className="p-3 text-white font-bold">{cand.customer_name}</td>
                        <td className="p-3">
                          <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded">{cand.segment}</span>
                        </td>
                        <td className="p-3 text-[#00F5A0] font-bold">{cand.recovery_score}%</td>
                        <td className="p-3">{cand.coupon_code}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded ${
                            cand.priority === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400' :
                            cand.priority === 'HIGH' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                          }`}>
                            {cand.priority}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400">
                          {new Date(cand.scheduled_send_time).toLocaleString()}
                        </td>
                        <td className="p-3">
                          <span className="bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/30">
                            {cand.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {candidates.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500 font-sans italic">
                          No candidates scheduled. Click "Analyze Customers" to generate.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Popup Modal */}
      {showAnalysisSuccess && analysisResult && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0B1120] border border-[#00F5A0]/40 rounded-3xl p-8 max-w-md w-full text-center space-y-5 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-[#00F5A0]" />
            <div className="mx-auto w-16 h-16 bg-[#00F5A0]/10 rounded-full flex items-center justify-center mb-2">
              <CheckCircle className="w-8 h-8 text-[#00F5A0]" />
            </div>
            <h3 className="text-2xl font-black text-white">Campaign Scheduled!</h3>
            <p className="text-sm text-slate-400">
              The Recovery AI has successfully analyzed all customers and scheduled a recovery campaign.
            </p>
            
            <div className="bg-[#050816] rounded-xl border border-[#1E293B] p-4 space-y-3 text-left">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-bold">Candidates Selected</span>
                <span className="font-mono text-white font-bold">{analysisResult.candidates_created}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-bold">Recoverable Revenue</span>
                <span className="font-mono text-[#00F5A0] font-bold">₹{analysisResult.recoverable_revenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-xs border-t border-[#1E293B] pt-3">
                <span className="text-slate-400 font-bold">Scheduled Time</span>
                <span className="font-mono text-white text-[11px]">
                  {new Date(analysisResult.scheduled_send_time).toLocaleString()}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowAnalysisSuccess(false)}
              className="w-full py-3 bg-white text-slate-900 font-black rounded-xl hover:bg-slate-200 transition-all"
            >
              View Campaign Candidates
            </button>
          </div>
        </div>
      )}

""" + ui_insertion
content = content.replace(ui_insertion, recovery_ai_ui)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched successfully")
