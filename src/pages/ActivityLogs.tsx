import React from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { 
  History, 
  Search, 
  Calendar, 
  User, 
  Package, 
  Activity, 
  ChevronRight,
  Filter,
  ArrowRight
} from 'lucide-react';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function ActivityLogs() {
  const [logs, setLogs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');

  React.useEffect(() => {
    const q = query(collection(db, 'activityLogs'), orderBy('timestamp', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(logData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'activityLogs');
    });

    return () => unsubscribe();
  }, []);

  const filteredLogs = logs.filter(log => 
    log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.action.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Activity Logs</h1>
        <p className="text-stone-500">Audit trail of all inventory changes and user actions.</p>
      </header>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
          <input
            type="text"
            placeholder="Search by user, product, or action..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-black/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all shadow-sm"
          />
        </div>
        <button className="px-6 py-3 bg-white border border-black/5 rounded-2xl font-semibold text-stone-600 flex items-center gap-2 hover:border-stone-300 transition-all shadow-sm">
          <Filter size={20} />
          <span>Filter</span>
        </button>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-3xl border border-black/5 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-20 text-center">
            <div className="w-8 h-8 border-4 border-stone-200 border-t-stone-900 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-stone-500 font-medium">Loading logs...</p>
          </div>
        ) : filteredLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-black/5">
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-stone-400 font-bold">Timestamp</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-stone-400 font-bold">User</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-stone-400 font-bold">Action</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-stone-400 font-bold">Product</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-stone-400 font-bold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {filteredLogs.map((log) => (
                  <motion.tr 
                    layout
                    key={log.id} 
                    className="hover:bg-stone-50 transition-colors group"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-stone-500">
                        <Calendar size={14} />
                        <span className="text-sm font-medium">
                          {log.timestamp?.toDate().toLocaleDateString()}
                        </span>
                        <span className="text-[10px] font-bold text-stone-300">
                          {log.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 font-bold text-xs">
                          {log.userName?.[0]?.toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-stone-900">{log.userName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        log.action.includes('Add') ? "bg-emerald-50 text-emerald-600" :
                        log.action.includes('Delete') ? "bg-red-50 text-red-600" :
                        log.action.includes('Stock In') ? "bg-blue-50 text-blue-600" :
                        log.action.includes('Stock Out') ? "bg-amber-50 text-amber-600" :
                        "bg-stone-100 text-stone-600"
                      )}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-stone-600">
                        <Package size={14} className="text-stone-300" />
                        <span className="text-sm font-medium">{log.productName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 text-stone-300 hover:text-stone-900 transition-colors">
                        <ArrowRight size={16} />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-20 text-center">
            <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center text-stone-300 mx-auto mb-4">
              <History size={32} />
            </div>
            <h3 className="text-lg font-semibold text-stone-900">No logs found</h3>
            <p className="text-stone-500">Try adjusting your search or filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
