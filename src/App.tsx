/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, FormEvent, ChangeEvent } from 'react';
import { supabase } from './lib/supabase';
import { 
  Plus, 
  Minus, 
  Wallet, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Search, 
  Filter, 
  Calendar, 
  Trash2, 
  LayoutDashboard, 
  History,
  TrendingUp,
  PieChart as PieChartIcon,
  Utensils,
  Car,
  ShoppingBag,
  Film,
  Receipt,
  HeartPulse,
  MoreHorizontal,
  Briefcase,
  Gift,
  PlusCircle,
  X,
  Users,
  LogOut,
  UserPlus,
  FileUp,
  Download,
  FileSpreadsheet,
  AlertCircle,
  FileText
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend,
  LabelList,
  LineChart,
  Line
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { th } from 'date-fns/locale';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { 
  Transaction, 
  TransactionType, 
  Category, 
  DEFAULT_CATEGORIES,
  User,
  UserRole
} from './types';

// Icon mapping helper
const IconMap: Record<string, any> = {
  Utensils, Car, ShoppingBag, Film, Receipt, HeartPulse, MoreHorizontal,
  Wallet, Briefcase, Gift, TrendingUp, PlusCircle
};

export default function App() {
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('users');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'admin', username: 'admin', password: 'password', role: 'admin', name: 'System Admin' }
    ];
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });

  const [isLoggedIn, setIsLoggedIn] = useState(!!currentUser);

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('transactions');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem('categories');
    return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
  });

  const [isSyncing, setIsSyncing] = useState(false);

  // Sync with Supabase if available
  useEffect(() => {
    async function fetchData() {
      if (!supabase) return;
      
      setIsSyncing(true);
      try {
        const { data: trans, error: transError } = await supabase.from('transactions').select('*');
        if (trans && !transError) setTransactions(trans);

        const { data: cats, error: catsError } = await supabase.from('categories').select('*');
        if (cats && !catsError) setCategories(cats);
        
        const { data: usr, error: usrError } = await supabase.from('users').select('*');
        if (usr && !usrError) setUsers(usr);
      } catch (err) {
        console.error('Supabase fetch failed:', err);
      } finally {
        setIsSyncing(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    localStorage.setItem('users', JSON.stringify(users));
    if (supabase) {
      supabase.from('users').upsert(users).then(() => {});
    }
  }, [users]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      localStorage.setItem('isLoggedIn', 'true');
    } else {
      localStorage.removeItem('currentUser');
      localStorage.setItem('isLoggedIn', 'false');
    }
  }, [currentUser]);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'users' | 'import'>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | TransactionType>('all');
  const [dateFilter, setDateFilter] = useState<'day' | 'month' | 'all'>('month');

  useEffect(() => {
    localStorage.setItem('transactions', JSON.stringify(transactions));
    if (supabase) {
      supabase.from('transactions').upsert(transactions).then(() => {});
    }
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('categories', JSON.stringify(categories));
    if (supabase) {
      supabase.from('categories').upsert(categories).then(() => {});
    }
  }, [categories]);

  // Derived Values
  const filteredTransactions = useMemo(() => {
    let list = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    if (filterType !== 'all') {
      list = list.filter(t => t.type === filterType);
    }

    const now = new Date();
    if (dateFilter === 'day') {
      list = list.filter(t => isWithinInterval(parseISO(t.date), {
        start: startOfDay(now),
        end: endOfDay(now)
      }));
    } else if (dateFilter === 'month') {
      list = list.filter(t => isWithinInterval(parseISO(t.date), {
        start: startOfMonth(now),
        end: endOfMonth(now)
      }));
    }
    
    return list;
  }, [transactions, filterType, dateFilter]);

  const stats = useMemo(() => {
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    const balance = income - expense;

    const categoryStats = categories
      .filter(c => c.type === 'expense')
      .map(cat => ({
        name: cat.name,
        value: transactions
          .filter(t => t.categoryId === cat.id)
          .reduce((sum, t) => sum + t.amount, 0),
        color: cat.color
      }))
      .filter(c => c.value > 0)
      .sort((a, b) => b.value - a.value);

    const barData = [
      { name: 'รายรับ', amount: income, color: '#66BB6A' },
      { name: 'รายจ่าย', amount: expense, color: '#EF5350' }
    ];

    // --- Advanced Analytics ---
    const allExpenses = transactions.filter(t => t.type === 'expense');
    const now = new Date();
    
    // Average Monthly
    const uniqueMonths = new Set(transactions.map(t => t.date.substring(0, 7))); // YYYY-MM
    const monthlyAvg = allExpenses.length > 0 ? expense / (uniqueMonths.size || 1) : 0;
    
    // Average Weekly (based on the current month's expenses)
    const currentMonthPrefix = format(now, 'yyyy-MM');
    const currentMonthExpenses = allExpenses.filter(t => t.date.startsWith(currentMonthPrefix));
    const weeklyAvg = currentMonthExpenses.length > 0 ? currentMonthExpenses.reduce((sum, t) => sum + t.amount, 0) / 4 : 0;

    // Fuel Trend
    const fuelCategory = categories.find(c => c.name.includes('น้ำมัน')) || categories.find(c => c.id === 'transport');
    const fuelTransactions = transactions
      .filter(t => t.categoryId === fuelCategory?.id)
      .sort((a, b) => a.date.localeCompare(b.date));

    // Aggregate by date for the line chart
    const fuelTrendMap = fuelTransactions.reduce((acc: any, t) => {
      const dateStr = format(parseISO(t.date), 'dd/MM');
      acc[dateStr] = (acc[dateStr] || 0) + t.amount;
      return acc;
    }, {});

    const fuelTrendData = Object.entries(fuelTrendMap).map(([date, amount]) => ({
      date,
      amount
    })).slice(-15); // Last 15 data points

    return { 
      income, 
      expense, 
      balance, 
      categoryStats, 
      barData,
      monthlyAvg,
      weeklyAvg,
      fuelTrendData,
      fuelCategoryName: fuelCategory?.name || 'น้ำมัน'
    };
  }, [transactions, categories]);

  const addTransaction = (t: Omit<Transaction, 'id' | 'createdAt'>) => {
    const newTransaction = {
      ...t,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString()
    };
    setTransactions(prev => [...prev, newTransaction]);
    setIsModalOpen(false);
  };

  const deleteTransaction = (id: string) => {
    if (confirm('คุณต้องการลบรายการนี้ใช่หรือไม่?')) {
      setTransactions(prev => prev.filter(t => t.id !== id));
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
    // Standard users start on history tab (simplified view)
    if (user.role === 'user') {
      setActiveTab('history');
    }
  };

  if (!isLoggedIn) {
    return <LoginScreen users={users} onLogin={handleLogin} />;
  }

  // If role is User, they only see the history/management screen but restricted
  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-72 bg-white border-r border-slate-100 p-8 sticky top-0 h-screen shrink-0 z-40">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-pastel-blue rounded-xl flex items-center justify-center text-white shadow-soft">
            <Wallet size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Pastel Finance</h1>
        </div>

        <div className="flex-1 space-y-2">
          {isAdmin && (
            <>
              <SidebarButton 
                active={activeTab === 'dashboard'} 
                onClick={() => setActiveTab('dashboard')} 
                icon={<LayoutDashboard size={20} />} 
                label="แดชบอร์ดสรุปผล" 
              />
              <SidebarButton 
                active={activeTab === 'history'} 
                onClick={() => setActiveTab('history')} 
                icon={<History size={20} />} 
                label="ประวัติรายการที่บันทึก" 
              />
              <SidebarButton 
                active={activeTab === 'users'} 
                onClick={() => setActiveTab('users')} 
                icon={<Users size={20} />} 
                label="จัดการผู้ใช้งานระบบ" 
              />
              <SidebarButton 
                active={activeTab === 'import'} 
                onClick={() => setActiveTab('import')} 
                icon={<FileUp size={20} />} 
                label="นำข้อมูลเข้าระบบ" 
              />
            </>
          )}
          {!isAdmin && (
            <SidebarButton 
              active={activeTab === 'history'} 
              onClick={() => setActiveTab('history')} 
              icon={<History size={20} />} 
              label="ประวัติรายการของคุณ" 
            />
          )}
        </div>

        <div className="pt-6 border-t border-slate-50 space-y-4">
          <div className="bg-slate-50 p-4 rounded-2xl flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold ${currentUser?.role === 'admin' ? 'bg-pastel-purple' : 'bg-pastel-orange'}`}>
              {currentUser?.name.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <div className="font-bold text-slate-800 truncate text-sm">{currentUser?.name}</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{currentUser?.role === 'admin' ? 'Administrator' : 'General User'}</div>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-500 transition-all font-medium"
          >
            <LogOut size={20} />
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen relative">
        {/* Mobile Header (Hidden on Desktop) */}
        <header className="bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-slate-100 md:hidden">
          <div className="px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-pastel-blue rounded-lg flex items-center justify-center text-white shadow-soft">
                <Wallet size={20} />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-slate-800 leading-none">Finance</h1>
                <p className="text-[10px] text-slate-400 font-medium">{currentUser?.name} ({currentUser?.role})</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsModalOpen(true)}
                className="p-2 rounded-xl flex items-center gap-2 font-semibold transition-all text-emerald-600 bg-emerald-50"
              >
                <Plus size={24} />
              </motion.button>
              <button 
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </header>

        {/* Global Save Button (Desktop Only) */}
        <div className="hidden md:block fixed bottom-8 right-8 z-50">
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsModalOpen(true)}
            className="bg-pastel-blue hover:bg-sky-400 text-white w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl shadow-pastel-blue/30 transition-all"
          >
            <Plus size={32} />
          </motion.button>
        </div>

        <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 md:px-8 space-y-8">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && isAdmin ? (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight">ภาพรวมระบบ</h2>
                  <div className="bg-white px-4 py-2 rounded-xl text-xs font-bold text-slate-400 border border-slate-100 shadow-sm flex items-center gap-2">
                    <Calendar size={14} />
                    {format(new Date(), 'MMMM yyyy', { locale: th })}
                  </div>
                </div>

                <SummaryGrid stats={stats} />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-black text-blue-400 uppercase tracking-widest mb-1">เฉลี่ยรายเดือน</div>
                      <div className="text-2xl font-black text-blue-900">฿{Math.round(stats.monthlyAvg).toLocaleString()}</div>
                    </div>
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-500 shadow-sm">
                      <Calendar size={24} />
                    </div>
                  </div>
                  <div className="p-6 bg-purple-50/50 rounded-3xl border border-purple-100 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-black text-purple-400 uppercase tracking-widest mb-1">เฉลี่ยรายสัปดาห์ (เดือนนี้)</div>
                      <div className="text-2xl font-black text-purple-900">฿{Math.round(stats.weeklyAvg).toLocaleString()}</div>
                    </div>
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-purple-500 shadow-sm">
                      <History size={24} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Bar Chart - Income vs Expense */}
                  <div className="pastel-card border-none bg-white/50 backdrop-blur-sm overflow-hidden min-h-[350px]">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2 px-2">
                      <TrendingUp size={20} className="text-pastel-green" />
                      แนวโน้ม{stats.fuelCategoryName}
                    </h3>
                    <div className="h-64">
                      {stats.fuelTrendData.length > 1 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={stats.fuelTrendData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                            <XAxis 
                              dataKey="date" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontWeight: 'bold', fill: '#94a3b8', fontSize: 10 }} 
                            />
                            <YAxis hide />
                            <Tooltip 
                              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}
                              formatter={(value: number) => [`฿${value.toLocaleString()}`, 'จำนวนเงิน']}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="amount" 
                              stroke="#60a5fa" 
                              strokeWidth={4} 
                              dot={{ r: 4, fill: '#60a5fa', strokeWidth: 2, stroke: '#fff' }}
                              activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                          <TrendingUp size={48} className="opacity-20" />
                          <span className="text-sm font-medium">ยังไม่มีข้อมูล{stats.fuelCategoryName}เพื่อวิเคราะห์แนวโน้ม</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pastel-card border-none bg-white/50 backdrop-blur-sm overflow-hidden min-h-[350px]">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2 px-2">
                      <TrendingUp size={20} className="text-pastel-green" />
                      เปรียบเทียบรายรับ - รายจ่าย
                    </h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontWeight: 'bold', fill: '#94a3b8' }} 
                          />
                          <YAxis hide />
                          <Tooltip 
                            cursor={{ fill: 'transparent' }}
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}
                            formatter={(value: number) => [`฿${value.toLocaleString()}`, 'จำนวนเงิน']}
                          />
                          <Bar 
                            dataKey="amount" 
                            radius={[12, 12, 12, 12]} 
                            barSize={60}
                          >
                            {stats.barData.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={entry.color} opacity={0.8} />
                            ))}
                            <LabelList 
                              dataKey="amount" 
                              position="top" 
                              formatter={(value: number) => `฿${value.toLocaleString()}`}
                              style={{ fontWeight: 'black', fill: '#64748b', fontSize: '12px' }}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="pastel-card border-none bg-white/50 backdrop-blur-sm overflow-hidden">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2 px-2">
                      <PieChartIcon size={20} className="text-pastel-blue" />
                      สัดส่วนรายจ่าย
                    </h3>
                    <div className="h-64">
                      {stats.categoryStats.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={stats.categoryStats}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {stats.categoryStats.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}
                              itemStyle={{ fontWeight: 'bold' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                          <PieChartIcon size={48} className="opacity-20" />
                          <span className="text-sm font-medium">ไม่มีข้อมูลรายจ่าย</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pastel-card border-none bg-white/50 backdrop-blur-sm lg:col-span-2">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2 px-2">
                      <TrendingUp size={20} className="text-pastel-green" />
                      วิเคราะห์การใช้จ่ายสูงสุด
                    </h3>
                    <div className="space-y-4">
                      {stats.categoryStats.slice(0, 5).map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-2xl hover:bg-white transition-all group">
                          <div className="flex items-center gap-4">
                            <div className="w-4 h-4 rounded-full ring-4 ring-white shadow-sm" style={{ backgroundColor: item.color }} />
                            <span className="font-bold text-slate-600">{item.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-black text-slate-800">
                              ฿{item.value.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                      {stats.categoryStats.length === 0 && (
                        <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                          <TrendingUp size={48} className="opacity-20" />
                          <span className="text-sm font-medium">เพิ่มรายการเพื่อดูการวิเคราะห์</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : activeTab === 'users' && isAdmin ? (
              <motion.div 
                key="users"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <UserManagement users={users} setUsers={setUsers} />
              </motion.div>
            ) : activeTab === 'import' && isAdmin ? (
              <motion.div 
                key="import"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <DataImport 
                  categories={categories} 
                  onImport={(newTransactions) => {
                    setTransactions(prev => [...prev, ...newTransactions]);
                    setActiveTab('dashboard');
                  }} 
                />
              </motion.div>
            ) : (
              <motion.div 
                key="history"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                    {isAdmin ? 'รายการทั้งหมด' : 'รายการของคุณ'}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <FilterChip 
                      active={filterType === 'all'} 
                      onClick={() => setFilterType('all')}
                      label="ทั้งหมด"
                    />
                    <FilterChip 
                      active={filterType === 'income'} 
                      onClick={() => setFilterType('income')}
                      label="รายรับ"
                      color="bg-emerald-100 text-emerald-700"
                    />
                    <FilterChip 
                      active={filterType === 'expense'} 
                      onClick={() => setFilterType('expense')}
                      label="รายจ่าย"
                      color="bg-rose-100 text-rose-700"
                    />
                    <div className="h-8 w-[1px] bg-slate-200 mx-1 hidden sm:block" />
                    <select 
                      value={dateFilter}
                      onChange={(e: any) => setDateFilter(e.target.value)}
                      className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-pastel-blue shadow-sm"
                    >
                      <option value="all">ทุกช่วงเวลา</option>
                      <option value="day">วันนี้</option>
                      <option value="month">เดือนนี้</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <AnimatePresence initial={false} mode="popLayout">
                    {filteredTransactions.map((t) => (
                      <TransactionItem 
                        key={t.id} 
                        transaction={t} 
                        categories={categories} 
                        onDelete={deleteTransaction}
                        isAdmin={isAdmin}
                      />
                    ))}
                  </AnimatePresence>
                  {filteredTransactions.length === 0 && (
                    <div className="text-center py-32 bg-white/50 rounded-3xl border-2 border-dashed border-slate-100">
                      <div className="flex flex-col items-center gap-3 text-slate-400">
                        <Search size={48} className="opacity-20" />
                        <p className="font-bold">ไม่พบรายการที่ต้องการค้นหา</p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-100 md:hidden h-16 flex items-center px-4 justify-around z-30">
          {isAdmin && (
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`flex flex-col items-center gap-1 ${activeTab === 'dashboard' ? 'text-pastel-blue' : 'text-slate-400'}`}
            >
              <LayoutDashboard size={20} />
              <span className="text-[10px] font-medium">ภาพรวม</span>
            </button>
          )}
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-pastel-blue text-white p-3 rounded-full -mt-10 shadow-lg transform active:scale-90 transition-transform"
          >
            <Plus size={24} />
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center gap-1 ${activeTab === 'history' ? 'text-pastel-blue' : 'text-slate-400'}`}
          >
            <History size={20} />
            <span className="text-[10px] font-medium">ประวัติ</span>
          </button>
          {isAdmin && (
            <button 
              onClick={() => setActiveTab('users')}
              className={`flex flex-col items-center gap-1 ${activeTab === 'users' ? 'text-pastel-blue' : 'text-slate-400'}`}
            >
              <Users size={20} />
              <span className="text-[10px] font-medium">จัดการ</span>
            </button>
          )}
        </footer>
      </div>

      {/* Transaction Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <TransactionModal 
            categories={categories} 
            onClose={() => setIsModalOpen(false)} 
            onAdd={addTransaction} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Components

function TabButton({ active, onClick, icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${
        active ? 'bg-pastel-blue text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}

function SidebarButton({ active, onClick, icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all font-semibold ${
        active 
          ? 'bg-pastel-blue text-white shadow-lg shadow-pastel-blue/20 transform scale-[1.02]' 
          : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function SummaryGrid({ stats }: { stats: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <SummaryCard 
        label="คงเหลือสุทธิ" 
        amount={stats.balance} 
        icon={<Wallet size={24} />}
        color="bg-white"
        textColor="text-slate-800"
        accentColor="text-pastel-purple"
        trend="ยอดปัจจุบัน"
      />
      <SummaryCard 
        label="รายรับรวม" 
        amount={stats.income} 
        icon={<ArrowUpCircle size={24} />}
        color="bg-emerald-50"
        textColor="text-emerald-900"
        accentColor="text-emerald-500"
        trend="+14% จากเดือนก่อน"
      />
      <SummaryCard 
        label="รายจ่ายรวม" 
        amount={stats.expense} 
        icon={<ArrowDownCircle size={24} />}
        color="bg-rose-50"
        textColor="text-rose-900"
        accentColor="text-rose-500"
        trend="-5% จากเดือนก่อน"
      />
    </div>
  );
}

function SummaryCard({ label, amount, icon, color, textColor, accentColor, trend }: any) {
  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className={`p-6 rounded-3xl ${color} border border-slate-100 shadow-sm relative overflow-hidden group`}
    >
      <div className="flex justify-between items-start mb-6">
        <div className={`p-3 rounded-2xl bg-white shadow-soft ${accentColor}`}>
          {icon}
        </div>
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white px-2 py-1 rounded-lg shadow-sm">
          {trend}
        </div>
      </div>
      <div>
        <h2 className={`text-3xl font-black mb-1 ${textColor}`}>
          ฿{amount.toLocaleString()}
        </h2>
        <p className={`text-xs font-bold uppercase tracking-wider opacity-60 ${textColor}`}>
          {label}
        </p>
      </div>
      {/* Decorative circle */}
      <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full opacity-5 group-hover:scale-150 transition-transform duration-500 ${accentColor.replace('text-', 'bg-')}`} />
    </motion.div>
  );
}

function DataImport({ categories, onImport }: { categories: Category[], onImport: (data: Transaction[]) => void }) {
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [previewData, setPreviewData] = useState<Transaction[] | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const processData = (rawData: any[]) => {
    try {
      const newTransactions: Transaction[] = rawData.map(row => {
        // Find category by name
        const categoryName = (row.category || row['หมวดหมู่'] || 'อื่นๆ').toString().trim();
        const typeStr = (row.type || row['ประเภท'] || 'expense').toString().toLowerCase();
        const type = typeStr.includes('income') || typeStr.includes('รายรับ') ? 'income' : 'expense';
        
        let targetCategory = categories.find(c => c.name === categoryName && c.type === type);
        if (!targetCategory) {
          targetCategory = categories.find(c => c.type === type); // Fallback to first of type
        }

        const amount = parseFloat(row.amount || row['จำนวน'] || row['บาท'] || 0);
        const dateStr = row.date || row['วันที่'] || new Date().toISOString();
        let dateObj;
        try {
          dateObj = new Date(dateStr);
          if (isNaN(dateObj.getTime())) dateObj = new Date();
        } catch {
          dateObj = new Date();
        }

        return {
          id: Math.random().toString(36).substring(2, 11),
          amount,
          type,
          categoryId: targetCategory?.id || (type === 'income' ? 'other-inc' : 'other-exp'),
          date: format(dateObj, 'yyyy-MM-dd'),
          note: (row.note || row['หมายเหตุ'] || '') as string,
          createdAt: new Date().toISOString()
        };
      });

      if (newTransactions.length === 0) {
        throw new Error('ไม่พบข้อมูลที่ถูกต้องในไฟล์');
      }

      setPreviewData(newTransactions);
      setSuccessCount(null);
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล');
    } finally {
      setImporting(false);
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleFile(file);
  };

  const handleFile = (file: File) => {
    setError('');
    setPreviewData(null);
    setSuccessCount(null);
    setImporting(true);
    const reader = new FileReader();

    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processData(results.data);
        },
        error: (err) => {
          setError('ไม่สามารถอ่านไฟล์ CSV ได้: ' + err.message);
          setImporting(false);
        }
      });
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        if (!bstr) return;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        processData(data);
      };
      reader.readAsBinaryString(file);
    } else {
      setError('รองรับเฉพาะไฟล์ .csv และ .xlsx เท่านั้น');
      setImporting(false);
    }
  };

  const handleConfirmImport = () => {
    if (previewData) {
      onImport(previewData);
      setSuccessCount(previewData.length);
      setPreviewData(null);
    }
  };

  const downloadTemplate = () => {
    const data = [
      ['วันที่', 'ประเภท', 'หมวดหมู่', 'จำนวน', 'หมายเหตุ'],
      [format(new Date(), 'yyyy-MM-dd'), 'รายจ่าย', 'อาหาร', '150', 'พรีวิวรายการอาหาร'],
      [format(new Date(), 'yyyy-MM-dd'), 'รายรับ', 'เงินเดือน', '30000', 'เงินเดือนพฤษภาคม']
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "pastel_finance_template.xlsx");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <FileUp className="text-pastel-blue" />
          นำข้อมูลเข้าระบบ
        </h2>
        <button 
          onClick={downloadTemplate}
          className="text-pastel-blue hover:text-sky-600 text-sm font-bold flex items-center gap-1 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100 transition-all hover:shadow-md"
        >
          <Download size={16} />
          ดาวน์โหลดเทมเพลต
        </button>
      </div>

      {successCount !== null ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-emerald-50 border border-emerald-100 p-8 rounded-[2rem] text-center space-y-4"
        >
          <div className="w-16 h-16 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-sm ring-4 ring-white">
            <PlusCircle size={32} />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-800">นำเข้าข้อมูลสำเร็จ!</h3>
            <p className="text-slate-500 font-bold">นำเข้าทั้งหมด {successCount} รายการ เรียบร้อยแล้ว</p>
          </div>
          <button 
            onClick={() => setSuccessCount(null)}
            className="bg-white text-emerald-600 px-8 py-3 rounded-2xl font-black text-sm border border-emerald-100 shadow-sm hover:bg-emerald-100 transition-all"
          >
            นำเข้าไฟล์อื่นเพิ่ม
          </button>
        </motion.div>
      ) : !previewData ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div 
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
            className={`pastel-card border-2 border-dashed flex flex-col items-center justify-center py-16 transition-all group ${
              dragActive ? 'border-pastel-blue bg-blue-50/50 scale-[1.02]' : 'border-slate-100'
            }`}
          >
            <motion.div 
              animate={dragActive ? { y: -10 } : { y: 0 }}
              className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-6 text-slate-300 ring-4 ring-white shadow-soft"
            >
              <FileSpreadsheet size={40} />
            </motion.div>
            <div className="text-center px-4">
              <h3 className="font-black text-slate-700 text-lg mb-2">นำเข้าไฟล์ Excel หรือ CSV</h3>
              <p className="text-sm text-slate-400 mb-8 max-w-[240px] mx-auto">ช่วยจัดการรายรับ-รายจ่ายของคุณให้รวดเร็วยิ่งขึ้นด้วยการส่งไฟล์</p>
              
              <label 
                id="import-upload-label"
                className="inline-flex items-center gap-2 bg-pastel-blue hover:bg-sky-400 text-white px-8 py-3.5 rounded-2xl font-black text-sm cursor-pointer shadow-xl shadow-pastel-blue/30 transition-all active:scale-95 group-hover:transform group-hover:scale-105"
              >
                <PlusCircle size={18} />
                <span>เลือกไฟล์จากเครื่อง</span>
                <input type="file" className="hidden" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} />
              </label>
            </div>
          </div>

          <div className="pastel-card bg-emerald-50/30 border-none relative overflow-hidden group">
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-emerald-100 rounded-full opacity-20 group-hover:scale-150 transition-transform duration-500" />
            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div className="p-3 bg-white rounded-2xl text-emerald-500 shadow-sm">
                <FileText size={24} />
              </div>
              <h3 className="font-black text-slate-800">แนะนำการเตรียมข้อมูล</h3>
            </div>
            <ul className="space-y-4 relative z-10">
              {[
                { title: 'หัวคอลัมน์:', text: 'วันที่, ประเภท, หมวดหมู่, จำนวน, หมายเหตุ', icon: '📝' },
                { text: 'วันที่: YYYY-MM-DD (เช่น 2024-03-15)', icon: '📅' },
                { text: 'หมวดหมู่: ต้องตรงกับชื่อที่มีในระบบ', icon: '🏷️' },
                { text: 'จำนวน: ใส่เพียงตัวเลขเท่านั้น', icon: '💰' }
              ].map((item: any, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm text-slate-600 font-medium">
                  <span className="text-lg">{item.icon}</span>
                  <span className="pt-0.5">
                    {item.title && <b className="text-slate-800">{item.title} </b>}
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden relative">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="font-black text-slate-800 text-xl tracking-tight">ตรวจสอบข้อมูล ({previewData.length} รายการ)</h3>
                <p className="text-sm text-slate-400 font-bold">พร้อมสำหรับการนำเข้าสู่ระบบ Pastel Finance</p>
              </div>
              <button 
                onClick={() => setPreviewData(null)}
                className="text-slate-400 hover:text-rose-500 font-black text-xs uppercase tracking-widest bg-slate-50 px-4 py-2 rounded-xl transition-all"
              >
                ยกเลิก
              </button>
            </div>

            <div className="max-h-[450px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {previewData.map((t, idx) => {
                const category = categories.find(c => c.id === t.categoryId);
                const Icon = category ? IconMap[category.icon] || MoreHorizontal : MoreHorizontal;
                
                return (
                  <div key={idx} className="flex items-center justify-between p-5 bg-slate-50/50 rounded-3xl border border-slate-100 hover:bg-white transition-all group shadow-sm hover:shadow-md">
                    <div className="flex items-center gap-5">
                      <div 
                        className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform" 
                        style={{ backgroundColor: (category?.color || '#cbd5e1') + '20' }}
                      >
                        <div className="p-2 rounded-xl bg-white shadow-sm" style={{ color: category?.color }}>
                          <Icon size={18} />
                        </div>
                      </div>
                      <div>
                        <div className="font-black text-slate-800 text-base">{category?.name}</div>
                        <div className="text-[10px] text-slate-400 font-black tracking-wider uppercase flex items-center gap-2">
                          <Calendar size={10} />
                          {t.date}
                          {t.note && (
                            <span className="text-slate-300 truncate max-w-[150px]">• {t.note}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={`font-black text-lg tracking-tight ${t.type === 'income' ? 'text-emerald-500' : 'text-rose-400'}`}>
                      {t.type === 'income' ? '+' : '-'} ฿{t.amount.toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-8 mt-4 flex gap-4">
              <button 
                onClick={handleConfirmImport}
                className="flex-1 bg-pastel-blue text-white py-5 rounded-[1.5rem] font-black text-lg shadow-xl shadow-pastel-blue/30 transform active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                <PlusCircle size={24} />
                นำเข้าข้อมูลทั้งหมดทันที
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-rose-50 border border-border-rose-100 p-4 rounded-3xl flex items-center gap-4 text-rose-600 shadow-sm"
        >
          <div className="p-2 bg-white rounded-xl shadow-sm">
            <AlertCircle size={20} />
          </div>
          <p className="text-sm font-black">{error}</p>
        </motion.div>
      )}

      {importing && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-[60] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-pastel-blue border-t-transparent rounded-full animate-spin shadow-soft" />
            <p className="font-black text-slate-800 tracking-tight">กำลังตรวจสอบข้อมูลไฟล์...</p>
          </div>
        </div>
      )}
    </div>
  );
}

function LoginScreen({ users, onLogin }: { users: User[], onLogin: (user: User) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      onLogin(user);
    } else {
      setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-pastel-blue rounded-2xl flex items-center justify-center text-white shadow-lg mx-auto mb-4">
            <Wallet size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">ยินดีต้อนรับ</h1>
          <p className="text-slate-400">กรุณาเข้าสู่ระบบ Pastel Finance</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 space-y-6">
          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }} 
              animate={{ opacity: 1, x: 0 }}
              className="bg-rose-50 text-rose-500 text-sm p-3 rounded-xl border border-rose-100 text-center"
            >
              {error}
            </motion.div>
          )}
          
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block ml-1">Username</label>
            <input
              type="text"
              value={username}
              autoComplete="username"
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-pastel-blue transition-all"
              placeholder="กรอกชื่อผู้ใช้"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block ml-1">Password</label>
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-pastel-blue transition-all"
              placeholder="กรอกรหัสผ่าน"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-pastel-blue text-white py-4 rounded-2xl font-bold shadow-lg shadow-pastel-blue/20 hover:bg-sky-400 transition-all active:scale-95"
          >
            เข้าสู่ระบบ
          </button>
        </form>

        <p className="text-center mt-8 text-xs text-slate-400 font-medium tracking-widest uppercase">
          Powered by Pastel Design
        </p>
      </motion.div>
    </div>
  );
}

function UserManagement({ users, setUsers }: { users: User[], setUsers: any }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('user');

  const handleAddUser = (e: FormEvent) => {
    e.preventDefault();
    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      name: newName,
      username: newUsername,
      password: newPassword,
      role: newRole
    };
    setUsers([...users, newUser]);
    setIsAdding(false);
    setNewName('');
    setNewUsername('');
    setNewPassword('');
  };

  const deleteUser = (id: string) => {
    if (confirm('ยืนยันการลบผู้ใช้งาน?')) {
      setUsers(users.filter(u => u.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Users className="text-pastel-blue" />
          การจัดการผู้ใช้งาน
        </h2>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-pastel-blue text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"
        >
          <UserPlus size={18} />
          เพิ่มผู้ใช้งาน
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {users.map(user => (
          <div key={user.id} className="pastel-card flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-xl ${user.role === 'admin' ? 'bg-pastel-purple' : 'bg-pastel-orange'}`}>
                {user.name.charAt(0)}
              </div>
              <div>
                <div className="font-bold text-slate-800">{user.name}</div>
                <div className="text-xs text-slate-400">@{user.username} • {user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'}</div>
              </div>
            </div>
            {user.username !== 'jin' && (
              <button 
                onClick={() => deleteUser(user.id)}
                className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAdding(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-sm rounded-3xl shadow-2xl relative z-10 p-6">
              <h3 className="text-lg font-bold mb-4">เพิ่มผู้ใช้งานใหม่</h3>
              <form onSubmit={handleAddUser} className="space-y-4">
                <input 
                  autoFocus 
                  required 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)} 
                  placeholder="ชื่อ-นามสกุล" 
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2" 
                />
                <input 
                  required 
                  value={newUsername} 
                  onChange={e => setNewUsername(e.target.value)} 
                  placeholder="Username" 
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2" 
                />
                <input 
                  required 
                  type="password" 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  placeholder="Password" 
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2" 
                />
                <select 
                  value={newRole} 
                  onChange={(e: any) => setNewRole(e.target.value)} 
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2"
                >
                  <option value="user">User (บันทึกข้อมูลอย่างเดียว)</option>
                  <option value="admin">Admin (จัดการได้ทั้งหมด)</option>
                </select>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-2 text-slate-500 font-bold">ยกเลิก</button>
                  <button type="submit" className="flex-1 py-2 bg-pastel-blue text-white rounded-xl font-bold">บันทึก</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TransactionItem({ transaction, categories, onDelete, isAdmin }: any) {
  const t = transaction;
  const category = categories.find((c: any) => c.id === t.categoryId);
  const Icon = category ? IconMap[category.icon] || MoreHorizontal : MoreHorizontal;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white p-5 rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm hover:shadow-md transition-all group overflow-hidden relative"
    >
      <div className="flex items-center gap-5 relative z-10">
        <div 
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-slate-700 shadow-inner shrink-0 transition-transform group-hover:scale-110"
          style={{ backgroundColor: category?.color + '25' }}
        >
          <div className="p-3 rounded-xl bg-white shadow-sm" style={{ color: category?.color }}>
            <Icon size={20} />
          </div>
        </div>
        <div>
          <div className="font-black text-slate-800 text-lg">{category?.name}</div>
          <div className="text-xs text-slate-400 flex items-center gap-2 font-bold uppercase tracking-wider">
            <Calendar size={12} className="text-slate-300" />
            {format(parseISO(t.date), 'dd MMM yyyy', { locale: th })}
            {t.note && (
              <span className="bg-slate-50 px-2 py-0.5 rounded text-[10px] text-slate-500 max-w-[120px] truncate block">
                {t.note}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 relative z-10">
        <div className={`font-black text-xl tracking-tight ${t.type === 'income' ? 'text-emerald-500' : 'text-rose-400'}`}>
          {t.type === 'income' ? '+' : '-'} ฿{t.amount.toLocaleString()}
        </div>
        {isAdmin && (
          <button 
            onClick={() => onDelete(t.id)}
            className="p-3 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all md:opacity-0 md:group-hover:opacity-100 active:scale-90"
          >
            <Trash2 size={20} />
          </button>
        )}
      </div>
      {/* Design accent */}
      <div 
        className="absolute right-0 top-0 w-1 h-full opacity-20" 
        style={{ backgroundColor: t.type === 'income' ? '#10b981' : '#fb7185' }} 
      />
    </motion.div>
  );
}

function FilterChip({ active, onClick, label, color }: any) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`px-5 py-2 rounded-2xl text-sm font-black transition-all ${
        active 
        ? (color || 'bg-pastel-blue text-white shadow-lg shadow-pastel-blue/20') 
        : 'bg-white text-slate-400 border border-slate-100 hover:border-slate-200 hover:text-slate-600 shadow-sm'
      }`}
    >
      {label}
    </motion.button>
  );
}

function TransactionModal({ categories, onClose, onAdd }: { categories: Category[], onClose: () => void, onAdd: (t: any) => void }) {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [note, setNote] = useState('');

  const filteredCategories = categories.filter(c => c.type === type);

  useEffect(() => {
    if (filteredCategories.length > 0) {
      setCategoryId(filteredCategories[0].id);
    }
  }, [type]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!amount || !categoryId) return;
    onAdd({
      type,
      amount: parseFloat(amount),
      categoryId,
      date,
      note
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 100 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 100 }}
        className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl relative z-10 overflow-hidden"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">บันทึกรายการ</h2>
            <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-50 rounded-full">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Type Switcher */}
            <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
              <button
                type="button"
                onClick={() => setType('income')}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                  type === 'income' ? 'bg-pastel-green text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                รายรับ
              </button>
              <button
                type="button"
                onClick={() => setType('expense')}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                  type === 'expense' ? 'bg-pastel-pink text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                รายจ่าย
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">จำนวนเงิน (บาท)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full text-4xl font-black text-slate-800 placeholder:text-slate-200 focus:outline-none py-3 border-b border-slate-100 focus:border-pastel-blue transition-colors bg-transparent"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">หมวดหมู่</label>
                <div className="grid grid-cols-4 gap-2">
                  {filteredCategories.map((cat) => {
                    const Icon = IconMap[cat.icon] || MoreHorizontal;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategoryId(cat.id)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all border ${
                          categoryId === cat.id 
                            ? 'bg-white border-slate-200 shadow-md transform scale-105' 
                            : 'bg-slate-50 border-transparent text-slate-400 grayscale'
                        }`}
                      >
                        <div 
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                          style={{ backgroundColor: cat.color }}
                        >
                          <Icon size={20} />
                        </div>
                        <span className="text-[10px] font-medium truncate w-full text-center">{cat.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">วันที่</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pastel-blue"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">บันทึกช่วยจำ</label>
                  <input
                    type="text"
                    placeholder="ใส่หมายเหตุ..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pastel-blue"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg transition-all active:scale-95 ${
                type === 'income' ? 'bg-pastel-green' : 'bg-pastel-pink'
              }`}
            >
              บันทึกรายการ
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
