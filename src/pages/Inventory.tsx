import React from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Package, 
  TrendingUp, 
  TrendingDown,
  X,
  Check,
  ChevronRight,
  AlertCircle,
  Download,
  Upload,
  FileText,
  FileSpreadsheet,
  FileCode
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Papa from 'papaparse';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  quantity: number;
  sku: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

interface InventoryProps {
  isAdmin: boolean;
}

export default function Inventory({ isAdmin }: InventoryProps) {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState('All');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isQuantityModalOpen, setIsQuantityModalOpen] = React.useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(null);
  const [quantityChange, setQuantityChange] = React.useState(0);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = React.useState(false);
  const [importResults, setImportResults] = React.useState<{ success: number; errors: string[] } | null>(null);

  // Form State
  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    category: '',
    price: 0,
    quantity: 0,
    sku: ''
  });

  React.useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(prods);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });

    return () => unsubscribe();
  }, []);

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category))).filter(Boolean)];

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const exportToCSV = () => {
    const data = filteredProducts.map(p => ({
      Name: p.name,
      SKU: p.sku,
      Category: p.category,
      Price: p.price,
      Quantity: p.quantity,
      Description: p.description,
      CreatedAt: p.createdAt?.toDate().toISOString(),
      UpdatedAt: p.updatedAt?.toDate().toISOString(),
    }));
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `inventory_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExportMenuOpen(false);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('Inventory Report', 14, 15);
    const tableData = filteredProducts.map(p => [
      p.name,
      p.sku,
      p.category,
      `$${p.price.toFixed(2)}`,
      p.quantity.toString()
    ]);
    autoTable(doc, {
      head: [['Name', 'SKU', 'Category', 'Price', 'Quantity']],
      body: tableData,
      startY: 20,
    });
    doc.save(`inventory_export_${new Date().toISOString().split('T')[0]}.pdf`);
    setIsExportMenuOpen(false);
  };

  const exportToExcel = () => {
    const data = filteredProducts.map(p => ({
      Name: p.name,
      SKU: p.sku,
      Category: p.category,
      Price: p.price,
      Quantity: p.quantity,
      Description: p.description,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, `inventory_export_${new Date().toISOString().split('T')[0]}.xlsx`);
    setIsExportMenuOpen(false);
  };

  const handleAddOrEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setIsSubmitting(true);

    try {
      if (editingProduct) {
        const docRef = doc(db, 'products', editingProduct.id);
        await updateDoc(docRef, {
          ...formData,
          updatedAt: serverTimestamp()
        });
        await logActivity('Updated Product', editingProduct.id, formData.name);
      } else {
        const docRef = await addDoc(collection(db, 'products'), {
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: auth.currentUser?.uid
        });
        await logActivity('Added Product', docRef.id, formData.name);
      }
      setIsModalOpen(false);
      setEditingProduct(null);
      setFormData({ name: '', description: '', category: '', price: 0, quantity: 0, sku: '' });
    } catch (error) {
      handleFirestoreError(error, editingProduct ? OperationType.UPDATE : OperationType.CREATE, 'products');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateQuantity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setIsSubmitting(true);

    try {
      const newQuantity = selectedProduct.quantity + quantityChange;
      if (newQuantity < 0) throw new Error('Quantity cannot be negative');

      const docRef = doc(db, 'products', selectedProduct.id);
      await updateDoc(docRef, {
        quantity: newQuantity,
        updatedAt: serverTimestamp()
      });

      await logActivity(
        quantityChange > 0 ? `Stock In (+${quantityChange})` : `Stock Out (${quantityChange})`,
        selectedProduct.id,
        selectedProduct.name
      );

      setIsQuantityModalOpen(false);
      setSelectedProduct(null);
      setQuantityChange(0);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'products');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!isAdmin || !confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      await deleteDoc(doc(db, 'products', id));
      await logActivity('Deleted Product', id, name);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'products');
    }
  };

  const logActivity = async (action: string, productId: string, productName: string) => {
    try {
      await addDoc(collection(db, 'activityLogs'), {
        userId: auth.currentUser?.uid,
        userName: auth.currentUser?.displayName || auth.currentUser?.email,
        action,
        productId,
        productName,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSubmitting(true);
    setImportResults(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const data = evt.target?.result;
      let productsToImport: any[] = [];

      try {
        if (file.name.endsWith('.csv')) {
          const text = data as string;
          const result = Papa.parse(text, { header: true, skipEmptyLines: true });
          productsToImport = result.data;
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          productsToImport = XLSX.utils.sheet_to_json(worksheet);
        } else {
          throw new Error('Unsupported file format. Please use CSV or Excel.');
        }

        const validatedProducts: any[] = [];
        const errors: string[] = [];

        productsToImport.forEach((row: any, index: number) => {
          const rowNum = index + 2; // +1 for 0-index, +1 for header row
          const name = row.Name || row.name || row.Product || row.product;
          const sku = row.SKU || row.sku;
          const price = parseFloat(row.Price || row.price || 0);
          const quantity = parseInt(row.Quantity || row.quantity || 0);
          const category = row.Category || row.category || 'Uncategorized';
          const description = row.Description || row.description || '';

          if (!name) errors.push(`Row ${rowNum}: Name is required`);
          if (!sku) errors.push(`Row ${rowNum}: SKU is required`);
          if (isNaN(price) || price < 0) errors.push(`Row ${rowNum}: Price must be a positive number`);
          if (isNaN(quantity) || quantity < 0) errors.push(`Row ${rowNum}: Quantity must be a positive integer`);

          if (!errors.some(err => err.startsWith(`Row ${rowNum}:`))) {
            validatedProducts.push({
              name,
              sku,
              price,
              quantity,
              category,
              description,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              createdBy: auth.currentUser?.uid
            });
          }
        });

        if (validatedProducts.length > 0) {
          const batchSize = 500;
          let successCount = 0;

          for (let i = 0; i < validatedProducts.length; i += batchSize) {
            const chunk = validatedProducts.slice(i, i + batchSize);
            await Promise.all(chunk.map(async (p) => {
              await addDoc(collection(db, 'products'), p);
              successCount++;
            }));
          }

          await logActivity(`Imported ${successCount} products`, 'multiple', 'Bulk Import');
          setImportResults({ success: successCount, errors });
        } else {
          setImportResults({ success: 0, errors });
        }

      } catch (error: any) {
        console.error('Import error:', error);
        setImportResults({ success: 0, errors: [error.message || 'An unknown error occurred during import'] });
      } finally {
        setIsSubmitting(false);
        e.target.value = '';
      }
    };

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      category: product.category || '',
      price: product.price,
      quantity: product.quantity,
      sku: product.sku
    });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Inventory</h1>
          <p className="text-stone-500">Manage your product catalog and stock levels.</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <div className="relative">
              <button
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className="flex items-center gap-2 px-6 py-3 bg-white border border-black/5 text-stone-600 rounded-2xl font-semibold hover:border-stone-300 transition-all shadow-sm active:scale-95"
              >
                <Download size={20} />
                <span>Export</span>
              </button>
              
              <AnimatePresence>
                {isExportMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-[60]" 
                      onClick={() => setIsExportMenuOpen(false)} 
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-black/5 z-[70] overflow-hidden"
                    >
                      <button
                        onClick={exportToCSV}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
                      >
                        <FileCode size={18} className="text-stone-400" />
                        <span>Export as CSV</span>
                      </button>
                      <button
                        onClick={exportToExcel}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-stone-600 hover:bg-stone-50 transition-colors border-t border-black/5"
                      >
                        <FileSpreadsheet size={18} className="text-stone-400" />
                        <span>Export as Excel</span>
                      </button>
                      <button
                        onClick={exportToPDF}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-stone-600 hover:bg-stone-50 transition-colors border-t border-black/5"
                      >
                        <FileText size={18} className="text-stone-400" />
                        <span>Export as PDF</span>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}
          {isAdmin && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setImportResults(null);
                  setIsImportModalOpen(true);
                }}
                className="flex items-center gap-2 px-6 py-3 bg-white text-stone-900 border border-black/5 rounded-2xl font-semibold hover:bg-stone-50 transition-all shadow-sm active:scale-95"
              >
                <Upload size={20} />
                <span>Import</span>
              </button>
              <button
                onClick={() => {
                  setEditingProduct(null);
                  setFormData({ name: '', description: '', category: '', price: 0, quantity: 0, sku: '' });
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-2 px-6 py-3 bg-stone-900 text-white rounded-2xl font-semibold hover:bg-stone-800 transition-all shadow-sm active:scale-95"
              >
                <Plus size={20} />
                <span>Add Product</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
          <input
            type="text"
            placeholder="Search by name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-black/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-5 py-3 rounded-2xl font-medium whitespace-nowrap transition-all border",
                selectedCategory === cat 
                  ? "bg-stone-900 text-white border-stone-900 shadow-sm" 
                  : "bg-white text-stone-600 border-black/5 hover:border-stone-300"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-64 bg-stone-100 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <motion.div
              layout
              key={product.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl border border-black/5 p-6 hover:shadow-md transition-all group relative overflow-hidden"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-stone-50 rounded-2xl flex items-center justify-center text-stone-400 group-hover:text-stone-900 transition-colors">
                  <Package size={24} />
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => {
                      setSelectedProduct(product);
                      setQuantityChange(0);
                      setIsQuantityModalOpen(true);
                    }}
                    className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-50 rounded-xl transition-all"
                    title="Update Quantity"
                  >
                    <TrendingUp size={18} />
                  </button>
                  {isAdmin && (
                    <>
                      <button 
                        onClick={() => openEditModal(product)}
                        className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-50 rounded-xl transition-all"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(product.id, product.name)}
                        className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="mb-4">
                <h3 className="text-lg font-bold text-stone-900 mb-1">{product.name}</h3>
                <p className="text-xs font-mono text-stone-400 uppercase tracking-widest">{product.sku}</p>
              </div>

              <p className="text-sm text-stone-500 line-clamp-2 mb-6 h-10">
                {product.description || 'No description provided.'}
              </p>

              <div className="flex items-center justify-between pt-6 border-t border-black/5">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-stone-400 font-bold mb-1">Stock Level</p>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-xl font-bold",
                      product.quantity <= 5 ? "text-red-600" : "text-stone-900"
                    )}>
                      {product.quantity}
                    </span>
                    {product.quantity <= 5 && (
                      <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[10px] font-bold rounded-full uppercase">Low Stock</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-stone-400 font-bold mb-1">Unit Price</p>
                  <p className="text-xl font-bold text-stone-900">${product.price.toFixed(2)}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-stone-200">
          <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center text-stone-300 mx-auto mb-4">
            <Search size={32} />
          </div>
          <h3 className="text-lg font-semibold text-stone-900">No products found</h3>
          <p className="text-stone-500">Try adjusting your search or filters.</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-stone-900/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl font-bold text-stone-900">
                    {editingProduct ? 'Edit Product' : 'Add New Product'}
                  </h2>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 text-stone-400 hover:text-stone-900 transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleAddOrEdit} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Product Name</label>
                      <input
                        required
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-3 bg-stone-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Description</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-4 py-3 bg-stone-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10 h-24 resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Category</label>
                      <input
                        type="text"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-4 py-3 bg-stone-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">SKU</label>
                      <input
                        required
                        type="text"
                        value={formData.sku}
                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                        className="w-full px-4 py-3 bg-stone-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Price ($)</label>
                      <input
                        required
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                        className="w-full px-4 py-3 bg-stone-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Initial Quantity</label>
                      <input
                        required
                        type="number"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                        className="w-full px-4 py-3 bg-stone-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 px-6 py-4 bg-stone-100 text-stone-600 rounded-2xl font-semibold hover:bg-stone-200 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 px-6 py-4 bg-stone-900 text-white rounded-2xl font-semibold hover:bg-stone-800 transition-all disabled:opacity-50"
                    >
                      {isSubmitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Create Product'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quantity Update Modal */}
      <AnimatePresence>
        {isQuantityModalOpen && selectedProduct && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsQuantityModalOpen(false)}
              className="absolute inset-0 bg-stone-900/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-stone-900">Update Stock</h2>
                    <p className="text-stone-500 text-sm">{selectedProduct.name}</p>
                  </div>
                  <button onClick={() => setIsQuantityModalOpen(false)} className="p-2 text-stone-400 hover:text-stone-900 transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <div className="bg-stone-50 rounded-2xl p-6 mb-8 flex justify-between items-center border border-black/5">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-stone-400 font-bold mb-1">Current Stock</p>
                    <p className="text-3xl font-bold text-stone-900">{selectedProduct.quantity}</p>
                  </div>
                  <ChevronRight className="text-stone-300" />
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-stone-400 font-bold mb-1">New Stock</p>
                    <p className={cn(
                      "text-3xl font-bold",
                      selectedProduct.quantity + quantityChange < 0 ? "text-red-600" : "text-stone-900"
                    )}>
                      {selectedProduct.quantity + quantityChange}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleUpdateQuantity} className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-4 text-center">Adjustment Amount</label>
                    <div className="flex items-center justify-center gap-6">
                      <button
                        type="button"
                        onClick={() => setQuantityChange(prev => prev - 1)}
                        className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-900 hover:bg-stone-200 transition-all active:scale-90"
                      >
                        <TrendingDown size={24} />
                      </button>
                      <input
                        type="number"
                        value={quantityChange}
                        onChange={(e) => setQuantityChange(parseInt(e.target.value) || 0)}
                        className="w-24 text-center text-3xl font-bold bg-transparent focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setQuantityChange(prev => prev + 1)}
                        className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-900 hover:bg-stone-200 transition-all active:scale-90"
                      >
                        <TrendingUp size={24} />
                      </button>
                    </div>
                    <div className="flex justify-center gap-2 mt-4">
                      {[-10, -5, 5, 10].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setQuantityChange(prev => prev + val)}
                          className="px-3 py-1 bg-stone-50 text-stone-500 text-xs font-bold rounded-lg border border-black/5 hover:border-stone-300 transition-all"
                        >
                          {val > 0 ? `+${val}` : val}
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedProduct.quantity + quantityChange < 0 && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100">
                      <AlertCircle size={16} />
                      <span>Stock cannot be negative.</span>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsQuantityModalOpen(false)}
                      className="flex-1 px-6 py-4 bg-stone-100 text-stone-600 rounded-2xl font-semibold hover:bg-stone-200 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || selectedProduct.quantity + quantityChange < 0}
                      className="flex-1 px-6 py-4 bg-stone-900 text-white rounded-2xl font-semibold hover:bg-stone-800 transition-all disabled:opacity-50 shadow-sm"
                    >
                      {isSubmitting ? 'Updating...' : 'Confirm Update'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Import Modal */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setIsImportModalOpen(false)}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-stone-900">Import Products</h2>
                    <p className="text-sm text-stone-500">Upload CSV or Excel file</p>
                  </div>
                  <button 
                    onClick={() => !isSubmitting && setIsImportModalOpen(false)}
                    className="p-2 hover:bg-stone-100 rounded-xl transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                {!importResults ? (
                  <div className="space-y-6">
                    <div className="p-8 border-2 border-dashed border-stone-200 rounded-3xl bg-stone-50 flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-stone-400 mb-4">
                        <Upload size={32} />
                      </div>
                      <h3 className="font-bold text-stone-900 mb-2">Click to upload or drag and drop</h3>
                      <p className="text-xs text-stone-500 mb-6">Supported formats: .csv, .xlsx, .xls</p>
                      
                      <label className="relative cursor-pointer">
                        <span className="px-6 py-3 bg-stone-900 text-white rounded-2xl font-semibold hover:bg-stone-800 transition-all shadow-sm inline-block">
                          Select File
                        </span>
                        <input 
                          type="file" 
                          className="hidden" 
                          accept=".csv,.xlsx,.xls"
                          onChange={handleImportFile}
                          disabled={isSubmitting}
                        />
                      </label>
                    </div>

                    <div className="bg-stone-50 p-6 rounded-2xl border border-black/5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3">Expected Columns</h4>
                      <div className="flex flex-wrap gap-2">
                        {['Name', 'SKU', 'Category', 'Price', 'Quantity', 'Description'].map(col => (
                          <span key={col} className="px-3 py-1 bg-white border border-black/5 rounded-lg text-xs font-medium text-stone-600">
                            {col}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className={cn(
                      "p-6 rounded-2xl border flex items-start gap-4",
                      importResults.success > 0 ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"
                    )}>
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                        importResults.success > 0 ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
                      )}>
                        {importResults.success > 0 ? <Check size={20} /> : <AlertCircle size={20} />}
                      </div>
                      <div>
                        <h3 className={cn(
                          "font-bold",
                          importResults.success > 0 ? "text-emerald-900" : "text-red-900"
                        )}>
                          {importResults.success > 0 ? 'Import Complete' : 'Import Failed'}
                        </h3>
                        <p className={cn(
                          "text-sm",
                          importResults.success > 0 ? "text-emerald-700" : "text-red-700"
                        )}>
                          Successfully imported {importResults.success} products.
                        </p>
                      </div>
                    </div>

                    {importResults.errors.length > 0 && (
                      <div className="bg-red-50 p-6 rounded-2xl border border-red-100 max-h-60 overflow-y-auto">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-red-400 mb-3">Errors Found ({importResults.errors.length})</h4>
                        <ul className="space-y-2">
                          {importResults.errors.map((err, i) => (
                            <li key={i} className="text-xs text-red-600 flex items-start gap-2">
                              <span className="w-1.5 h-1.5 bg-red-400 rounded-full mt-1.5 flex-shrink-0" />
                              {err}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <button
                      onClick={() => setIsImportModalOpen(false)}
                      className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-sm"
                    >
                      Close
                    </button>
                  </div>
                )}

                {isSubmitting && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                    <div className="w-12 h-12 border-4 border-stone-900 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="font-bold text-stone-900">Processing Import...</p>
                    <p className="text-sm text-stone-500">Please wait while we validate and save your data.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
