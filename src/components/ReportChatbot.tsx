import React from 'react';
import { 
  MessageSquare, 
  X, 
  Send, 
  Bot, 
  User, 
  Loader2,
  FileText,
  TrendingUp,
  AlertTriangle,
  Minus,
  Maximize2,
  BarChart3,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Message {
  role: 'user' | 'model';
  content: string;
}

export default function ReportChatbot() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isMinimized, setIsMinimized] = React.useState(false);
  const [messages, setMessages] = React.useState<Message[]>([
    { role: 'model', content: 'Hello! I am your Inventory Assistant. I can help you generate reports, analyze stock levels, or summarize recent activities. What would you like to know?' }
  ]);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const getContext = async () => {
    try {
      // Fetch products
      const productsSnap = await getDocs(collection(db, 'products'));
      const products = productsSnap.docs.map(doc => doc.data());

      // Fetch recent logs
      const logsQuery = query(collection(db, 'activityLogs'), orderBy('timestamp', 'desc'), limit(20));
      const logsSnap = await getDocs(logsQuery);
      const logs = logsSnap.docs.map(doc => doc.data());

      return {
        inventorySummary: {
          totalProducts: products.length,
          totalValue: products.reduce((acc, p) => acc + (p.price * p.quantity), 0),
          lowStockItems: products.filter(p => p.quantity < 10).map(p => ({ name: p.name, quantity: p.quantity })),
          categories: Array.from(new Set(products.map(p => p.category)))
        },
        recentActivity: logs.map(l => ({
          action: l.action,
          product: l.productName,
          details: l.details,
          time: l.timestamp
        })),
        fullInventory: products.map(p => ({
          name: p.name,
          sku: p.sku,
          quantity: p.quantity,
          price: p.price,
          category: p.category
        }))
      };
    } catch (error) {
      console.error('Error fetching context:', error);
      return null;
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const context = await getContext();
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const systemInstruction = `
        You are an expert Inventory Management Assistant for "Inventory Pro".
        Your goal is to help users generate reports and analyze their inventory data.
        
        Current Inventory Context:
        ${JSON.stringify(context, null, 2)}
        
        Guidelines:
        1. Be professional, concise, and data-driven.
        2. If the user asks for a visualization, chart, or comparison, include a JSON block in your response with the following format:
           \`\`\`chart
           {
             "type": "bar" | "pie" | "line",
             "title": "Chart Title",
             "data": [{"name": "Label", "value": 123}, ...]
           }
           \`\`\`
        3. Use Markdown to format reports (tables, bold text, lists).
        4. If asked for a report, provide a structured summary with key metrics.
        5. Highlight critical issues like low stock or unusual activity.
        6. If the user asks something unrelated to inventory, politely redirect them.
        7. Use the provided context to answer specific questions about products, stock levels, or recent changes.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: messages.concat({ role: 'user', content: userMessage }).map(m => ({
          role: m.role,
          parts: [{ text: m.content }]
        })),
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      const aiResponse = response.text || "I'm sorry, I couldn't process that request.";
      setMessages(prev => [...prev, { role: 'model', content: aiResponse }]);
    } catch (error) {
      console.error('Chatbot error:', error);
      setMessages(prev => [...prev, { role: 'model', content: "I encountered an error while generating your report. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderChart = (chartData: any) => {
    const COLORS = ['#1c1917', '#44403c', '#78716c', '#a8a29e', '#d6d3d1'];

    return (
      <div className="mt-4 p-4 bg-stone-50 rounded-2xl border border-black/5">
        <h4 className="text-sm font-bold text-stone-900 mb-4">{chartData.title}</h4>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartData.type === 'pie' ? (
              <PieChart>
                <Pie
                  data={chartData.data}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.data.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            ) : chartData.type === 'line' ? (
              <LineChart data={chartData.data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#1c1917" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            ) : (
              <BarChart data={chartData.data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                <Bar dataKey="value" fill="#1c1917" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const exportReport = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text('Inventory Analysis Report', 20, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, 30);
    
    let yPos = 40;

    messages.forEach((msg) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(12);
      doc.setTextColor(msg.role === 'user' ? 0 : 50);
      doc.setFont('helvetica', 'bold');
      doc.text(msg.role === 'user' ? 'User:' : 'Assistant:', 20, yPos);
      yPos += 7;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(0);
      
      const splitText = doc.splitTextToSize(msg.content.replace(/```chart[\s\S]*?```/g, '[Chart Data Included]'), 170);
      doc.text(splitText, 20, yPos);
      yPos += (splitText.length * 5) + 10;
    });

    doc.save(`Inventory_Report_${new Date().getTime()}.pdf`);
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => {
          if (isOpen && isMinimized) {
            setIsMinimized(false);
          } else {
            setIsOpen(true);
          }
        }}
        className="fixed bottom-8 right-8 w-16 h-16 bg-stone-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform z-50 group"
      >
        <MessageSquare size={28} />
        <span className="absolute right-20 bg-white text-stone-900 px-4 py-2 rounded-xl text-sm font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-black/5">
          Generate Reports
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
              height: isMinimized ? 'auto' : '650px'
            }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            className="fixed bottom-8 right-8 w-[450px] bg-white rounded-[32px] shadow-2xl border border-black/5 flex flex-col z-[60] overflow-hidden"
          >
            {/* Header */}
            <div 
              onClick={() => isMinimized && setIsMinimized(false)}
              className={`p-6 bg-stone-900 text-white flex items-center justify-between ${isMinimized ? 'cursor-pointer' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
                  <Bot size={24} />
                </div>
                <div>
                  <h3 className="font-bold">Inventory Assistant</h3>
                  <p className="text-xs text-stone-400">Powered by Gemini AI</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={exportReport}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                  title="Export Report"
                >
                  <Download size={20} />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMinimized(!isMinimized);
                  }}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                  title={isMinimized ? "Restore" : "Minimize"}
                >
                  {isMinimized ? <Maximize2 size={20} /> : <Minus size={20} />}
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    setIsMinimized(false);
                  }}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                  title="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-6 bg-stone-50/50"
            >
              {messages.map((m, i) => (
                <div 
                  key={i}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      m.role === 'user' ? 'bg-stone-200 text-stone-600' : 'bg-stone-900 text-white'
                    }`}>
                      {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                    </div>
                    <div className={`p-4 rounded-2xl text-sm ${
                      m.role === 'user' 
                        ? 'bg-stone-900 text-white rounded-tr-none' 
                        : 'bg-white border border-black/5 text-stone-800 rounded-tl-none shadow-sm'
                    }`}>
                      <div className="prose prose-sm max-w-none prose-stone dark:prose-invert">
                        <ReactMarkdown>
                          {m.content.replace(/```chart[\s\S]*?```/g, '')}
                        </ReactMarkdown>
                      </div>
                      
                      {m.role === 'model' && m.content.includes('```chart') && (
                        (() => {
                          try {
                            const chartMatch = m.content.match(/```chart\n([\s\S]*?)\n```/);
                            if (chartMatch) {
                              const chartData = JSON.parse(chartMatch[1]);
                              return renderChart(chartData);
                            }
                          } catch (e) {
                            console.error('Failed to parse chart data', e);
                          }
                          return null;
                        })()
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex gap-3 items-center text-stone-400 text-sm">
                    <div className="w-8 h-8 rounded-xl bg-stone-900 text-white flex items-center justify-center">
                      <Bot size={16} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      <span>Analyzing inventory data...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="px-6 py-3 bg-white border-t border-black/5 flex gap-2 overflow-x-auto no-scrollbar">
              <button 
                onClick={() => setInput('Generate a stock summary report')}
                className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl text-xs font-semibold transition-colors"
              >
                <FileText size={14} />
                Stock Summary
              </button>
              <button 
                onClick={() => setInput('Which items are low on stock?')}
                className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl text-xs font-semibold transition-colors"
              >
                <AlertTriangle size={14} />
                Low Stock
              </button>
              <button 
                onClick={() => setInput('Summarize recent activity')}
                className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl text-xs font-semibold transition-colors"
              >
                <TrendingUp size={14} />
                Recent Activity
              </button>
            </div>

            {/* Input */}
            <div className="p-6 bg-white border-t border-black/5">
              <div className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask for a report or analysis..."
                  className="w-full pl-4 pr-12 py-4 bg-stone-100 border-none rounded-2xl focus:ring-2 focus:ring-stone-900/10 transition-all text-sm"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-colors disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
            </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
