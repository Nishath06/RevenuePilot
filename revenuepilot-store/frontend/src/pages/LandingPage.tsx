import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Zap, Truck, CreditCard, Sparkles } from 'lucide-react';
import { productService } from '../services/product.service';
import { ProductCard } from '../components/ProductCard';
import { Product } from '../types';

export const LandingPage: React.FC = () => {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    productService
      .getProducts()
      .then((data) => setProducts(data.products.slice(0, 6)))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-16 pb-12">
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-slate-900 text-white pt-20 pb-24 rounded-3xl mx-4 sm:mx-6 lg:mx-8 shadow-2xl mt-4">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-600/30 via-indigo-600/20 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row items-center justify-between gap-12">
          
          <div className="space-y-6 max-w-2xl text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider backdrop-blur-sm">
              <Sparkles className="w-4 h-4" />
              Day 1 Production Foundation
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
              Premium Electronics. <br />
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
                Powered by RevenuePilot.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
              Explore high-performance gear engineered for professionals. Integrated with Razorpay Test Mode checkout and instant order tracking.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              <Link
                to="/products"
                className="w-full sm:w-auto px-8 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 active:scale-95 text-base"
              >
                Shop Electronics
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/merchant"
                className="w-full sm:w-auto px-8 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold rounded-2xl transition-all flex items-center justify-center text-base"
              >
                Merchant Dashboard
              </Link>
            </div>
          </div>

          <div className="relative w-full max-w-md lg:max-w-none lg:w-1/2">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-700 bg-slate-800/80 backdrop-blur-md p-6 space-y-4">
              <img
                src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80"
                alt="Headphones Hero"
                className="w-full h-64 object-cover rounded-xl shadow-md"
              />
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">AeroSound Pro Wireless</h3>
                  <p className="text-xs text-slate-400">Active Noise Cancellation • 40h Battery</p>
                </div>
                <span className="text-xl font-extrabold text-emerald-400">₹14,999</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Feature Badges */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Express Shipping</h4>
              <p className="text-xs text-slate-500">Free delivery nationwide</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Razorpay Checkout</h4>
              <p className="text-xs text-slate-500">Secure test mode payments</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-teal-50 rounded-xl text-teal-600">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Instant Webhooks</h4>
              <p className="text-xs text-slate-500">Real-time status updates</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-slate-100 rounded-xl text-slate-700">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Merchant APIs</h4>
              <p className="text-xs text-slate-500">RevenuePilot AI Ready</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Featured Gear</h2>
            <p className="text-sm text-slate-500">Top-rated electronics seeded straight from MongoDB.</p>
          </div>
          <Link to="/products" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-80 animate-pulse border border-slate-200" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <ProductCard key={product.product_id} product={product} />
            ))}
          </div>
        )}
      </section>

    </div>
  );
};
