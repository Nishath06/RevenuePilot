import React, { useEffect, useState } from 'react';
import { User as UserIcon, Mail, Phone, Calendar, Package, LogOut } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/auth.service';
import { User } from '../types';
import { Link, useNavigate } from 'react-router-dom';

export const ProfilePage: React.FC = () => {
  const { user: storedUser, logout } = useAuthStore();
  const [profile, setProfile] = useState<User | null>(storedUser);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    authService
      .getMe()
      .then((data) => setProfile(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (loading && !profile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 flex justify-center">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl p-8 space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 border-b border-slate-100 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-tr from-emerald-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl font-extrabold shadow-md">
              {profile?.name ? profile.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">{profile?.name}</h1>
              <p className="text-xs text-slate-500 font-mono">Customer Account ID: {profile?.id}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/orders"
              className="px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold text-xs rounded-xl border border-emerald-200 transition-colors flex items-center gap-1.5"
            >
              <Package className="w-4 h-4" /> My Orders
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 font-semibold text-xs rounded-xl border border-rose-200 transition-colors flex items-center gap-1.5"
            >
              <LogOut className="w-4 h-4" /> Log Out
            </button>
          </div>
        </div>

        {/* User Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <Mail className="w-4 h-4 text-emerald-600" /> Email Address
            </div>
            <p className="text-sm font-bold text-slate-900 truncate">{profile?.email}</p>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <Phone className="w-4 h-4 text-indigo-600" /> Phone Number
            </div>
            <p className="text-sm font-bold text-slate-900">{profile?.phone}</p>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <Calendar className="w-4 h-4 text-teal-600" /> Joined Date
            </div>
            <p className="text-sm font-bold text-slate-900">
              {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Active User'}
            </p>
          </div>
        </div>

      </div>

    </div>
  );
};
