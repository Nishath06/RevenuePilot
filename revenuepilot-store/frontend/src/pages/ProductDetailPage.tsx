import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShoppingCart, Star, ShieldCheck, Truck, ArrowLeft, Tag, CheckCircle2 } from 'lucide-react';
import { productService } from '../services/product.service';
import { useCartStore } from '../store/cartStore';
import { Product } from '../types';

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const { addItem } = useCartStore();

  useEffect(() => {
    if (id) {
      productService
        .getProductById(id)
        .then((data) => setProduct(data))
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-2xl font-bold text-slate-800">Product Not Found</h2>
        <Link to="/products" className="inline-block px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold">
          Back to Catalog
        </Link>
      </div>
    );
  }

  const handleAddToCart = () => {
    addItem(product, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      <Link to="/products" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-emerald-600 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Products
      </Link>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-2 gap-12 p-8 lg:p-12">
        
        {/* Left Column - Image */}
        <div className="space-y-4">
          <div className="aspect-square bg-slate-100 rounded-2xl overflow-hidden border border-slate-200">
            <img
              src={product.images[0] || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&auto=format&fit=crop&q=80'}
              alt={product.title}
              className="w-full h-full object-cover object-center"
            />
          </div>
        </div>

        {/* Right Column - Details */}
        <div className="flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-semibold text-xs rounded-full border border-emerald-200">
                {product.category}
              </span>
              <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                Brand: {product.brand}
              </span>
            </div>

            <h1 className="text-3xl font-extrabold text-slate-900 leading-tight">
              {product.title}
            </h1>

            <div className="flex items-center gap-3 text-sm text-slate-500">
              <div className="flex items-center gap-1 text-amber-500 font-bold">
                <Star className="w-4 h-4 fill-current" />
                <span>4.9</span>
              </div>
              <span>•</span>
              <span className="text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> In Stock ({product.stock} units)
              </span>
            </div>

            <div className="py-4 border-y border-slate-100">
              <span className="text-3xl font-extrabold text-slate-900">
                ₹{product.price.toLocaleString('en-IN')}
              </span>
              <span className="text-xs text-slate-400 block mt-0.5">Inclusive of all taxes & Razorpay Test Mode</span>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              {product.description}
            </p>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 pt-2">
              {product.tags.map((tag) => (
                <span key={tag} className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg flex items-center gap-1">
                  <Tag className="w-3 h-3 text-slate-400" /> #{tag}
                </span>
              ))}
            </div>

          </div>

          {/* Action Box */}
          <div className="space-y-4 pt-6 border-t border-slate-100">
            <div className="flex items-center gap-4">
              <div className="flex items-center border border-slate-300 rounded-xl bg-slate-50">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-3 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-l-xl"
                >
                  -
                </button>
                <span className="px-4 text-sm font-bold text-slate-900">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-3 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-r-xl"
                >
                  +
                </button>
              </div>

              <button
                onClick={handleAddToCart}
                className={`flex-1 py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
                  added
                    ? 'bg-emerald-700 text-white shadow-emerald-700/30'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 active:scale-98'
                }`}
              >
                <ShoppingCart className="w-5 h-5" />
                {added ? 'Added to Cart!' : 'Add to Cart'}
              </button>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-2 gap-4 pt-2 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-600" />
                <span>Fast express delivery</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <span>Razorpay Test Mode Verified</span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
