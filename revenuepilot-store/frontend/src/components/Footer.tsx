import React from 'react';
import { Store, ShieldCheck, Zap, CreditCard } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Col */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white">
                <Store className="w-4 h-4" />
              </div>
              <span className="text-xl font-bold text-white">RevenuePilot Store</span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Customer-facing e-commerce foundation powered by FastAPI, MongoDB, React, and Razorpay Test Mode.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Storefront</h4>
            <ul className="space-y-2.5 text-sm">
              <li><a href="/products" className="hover:text-emerald-400 transition-colors">All Electronics</a></li>
              <li><a href="/cart" className="hover:text-emerald-400 transition-colors">Cart</a></li>
              <li><a href="/orders" className="hover:text-emerald-400 transition-colors">Track Orders</a></li>
            </ul>
          </div>

          {/* Integration */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Merchant & AI APIs</h4>
            <ul className="space-y-2.5 text-sm">
              <li><a href="/merchant" className="hover:text-emerald-400 transition-colors">Merchant Dashboard</a></li>
              <li><span className="text-slate-500">APIs for RevenuePilot AI</span></li>
              <li><span className="text-emerald-400 text-xs px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800">Production Ready</span></li>
            </ul>
          </div>

          {/* Features */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Trust & Security</h4>
            <div className="space-y-3 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <span>Razorpay Test Mode Secured</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-indigo-400" />
                <span>Async Motor & Beanie Engine</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-400" />
                <span>JWT Auth & Webhook Idempotency</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© 2026 RevenuePilot Store. Built for Day 1 Production Foundation.</p>
          <div className="flex items-center gap-4">
            <span>FastAPI</span>
            <span>•</span>
            <span>React 18</span>
            <span>•</span>
            <span>MongoDB</span>
            <span>•</span>
            <span>Razorpay</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
