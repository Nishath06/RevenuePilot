import re
with open(r"e:\Cloud projects\Razorpay\revenuepilot-merchant\frontend\src\pages\RecoveryPage.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add selectedPeriod state
content = content.replace("const [activeTab, setActiveTab] = useState", "const [selectedPeriod, setSelectedPeriod] = useState<string>('all');\n  const [activeTab, setActiveTab] = useState")

# Update useEffect to depend on selectedPeriod
old_use_effect = """  useEffect(() => {
    aiAPI.recovery()
      .then(r => setData(r.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);"""

new_use_effect = """  useEffect(() => {
    setLoading(true);
    aiAPI.recovery(selectedPeriod)
      .then(r => setData(r.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [selectedPeriod]);"""

content = content.replace(old_use_effect, new_use_effect)

# Add dropdown UI next to the Zap total
dropdown_ui = """
      <div className="flex items-center gap-4 self-start sm:self-auto">
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
        >
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="all">All Time</option>
        </select>
"""

content = content.replace("<div className=\"px-4 py-2 bg-rose-500/10", dropdown_ui + "        <div className=\"px-4 py-2 bg-rose-500/10")

# Close the new div wrapping the dropdown and zap total
content = content.replace("</span>\n        </div>\n      )}", "</span>\n        </div>\n      </div>\n      )}")

with open(r"e:\Cloud projects\Razorpay\revenuepilot-merchant\frontend\src\pages\RecoveryPage.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Updated RecoveryPage.tsx")

