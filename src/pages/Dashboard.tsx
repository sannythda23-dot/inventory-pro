import React from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { 
  Package, 
  AlertCircle, 
  TrendingUp, 
  Activity, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock,
  Box,
  ChevronRight
} from 'lucide-react';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Link } from 'react-router-dom';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Dashboard() {
  const [stats, setStats] = React.useState({
    totalProducts: 0,
    lowStock: 0,
    totalValue: 0,
    recentLogs: [] as any[]
  });
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const productsUnsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
      const products = snapshot.docs.map(doc => doc.data());
      const totalProducts = products.length;
      const lowStock = products.filter((p: any) => p.quantity <= 5).length;
      const totalValue = products.reduce((acc: number, p: any) => acc + (p.price * p.quantity), 0);
      
      setStats(prev => ({ ...prev, totalProducts, lowStock, totalValue }));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });

    const logsQuery = query(collection(db, 'activityLogs'), orderBy('timestamp', 'desc'), limit(5));
    const logsUnsubscribe = onSnapshot(logsQuery, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStats(prev => ({ ...prev, recentLogs: logs }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'activityLogs');
    });

    return () => {
      productsUnsubscribe();
      logsUnsubscribe();
    };
  }, []);

  const statCards = [
    { 
      label: 'Total Products', 
      value: stats.totalProducts, 
      icon: Package, 
      color: 'bg-blue-50 text-blue-600',
      trend: '+12% from last month',
      trendUp: true
    },
    { 
      label: 'Low Stock Items', 
      value: stats.lowStock, 
      icon: AlertCircle, 
      color: 'bg-red-50 text-red-600',
      trend: 'Requires attention',
      trendUp: false
    },
    { 
      label: 'Inventory Value', 
      value: `$${stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
      icon: TrendingUp, 
      color: 'bg-emerald-50 text-emerald-600',
      trend: '+5.4% growth',
      trendUp: true
    },
    { 
      label: 'Recent Activities', 
      value: stats.recentLogs.length, 
      icon: Activity, 
      color: 'bg-purple-50 text-purple-600',
      trend: 'Last 24 hours',
      trendUp: true
    },
  ];

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Overview</h1>
        <p className="text-stone-500">Welcome back. Here's what's happening with your inventory today.</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={stat.label}
            className="bg-white rounded-3xl border border-black/5 p-6 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", stat.color)}>
                <stat.icon size={24} />
              </div>
              <div className={cn(
                "flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full",
                stat.trendUp ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
              )}>
                {stat.trendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {stat.trendUp ? 'Up' : 'Down'}
              </div>
            </div>
            <p className="text-stone-500 text-sm font-medium mb-1">{stat.label}</p>
            <h3 className="text-2xl font-bold text-stone-900 mb-4">{loading ? '...' : stat.value}</h3>
            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">{stat.trend}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
              <Clock className="text-stone-400" size={20} />
              Recent Activity
            </h2>
            <Link to="/logs" className="text-sm font-semibold text-stone-500 hover:text-stone-900 flex items-center gap-1 transition-colors">
              View all <ChevronRight size={16} />
            </Link>
          </div>

          <div className="bg-white rounded-3xl border border-black/5 overflow-hidden shadow-sm">
            {stats.recentLogs.length > 0 ? (
              <div className="divide-y divide-black/5">
                {stats.recentLogs.map((log, i) => (
                  <div key={log.id} className="p-6 flex items-start gap-4 hover:bg-stone-50 transition-colors group">
                    <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400 group-hover:text-stone-900 transition-colors shrink-0">
                      <Activity size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-sm font-bold text-stone-900 truncate">{log.action}</p>
                        <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest whitespace-nowrap ml-4">
                          {log.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500">
                        <span className="font-semibold text-stone-700">{log.userName}</span> modified 
                        <span className="font-semibold text-stone-700"> {log.productName}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-20 text-center">
                <p className="text-stone-400 font-medium">No recent activity found.</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions / Info */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <Box className="text-stone-400" size={20} />
            Quick Actions
          </h2>
          <div className="space-y-3">
            <Link 
              to="/inventory" 
              className="w-full flex items-center justify-between p-6 bg-stone-900 text-white rounded-3xl hover:bg-stone-800 transition-all shadow-sm group"
            >
              <div>
                <p className="font-bold mb-1">Manage Inventory</p>
                <p className="text-xs text-white/60">Add, edit, or remove products</p>
              </div>
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center group-hover:translate-x-1 transition-transform">
                <ChevronRight size={20} />
              </div>
            </Link>
            <div className="p-6 bg-white border border-black/5 rounded-3xl shadow-sm">
              <p className="text-sm font-bold text-stone-900 mb-2">System Status</p>
              <div className="flex items-center gap-2 text-xs text-emerald-600 font-bold uppercase tracking-wider">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                All Systems Operational
              </div>
              <p className="mt-4 text-xs text-stone-400 leading-relaxed">
                Database connected and syncing in real-time. Last backup performed 2 hours ago.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
