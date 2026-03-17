import React from 'react';
import { auth, db } from '../firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Box, ShieldCheck, UserCheck, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

export default function Login() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user exists in Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        // Create new user record
        // Default admin if email matches
        const isAdmin = user.email === 'sannythda23@gmail.com';
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          role: isAdmin ? 'admin' : 'user',
          createdAt: new Date().toISOString()
        });
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-sm border border-black/5 p-10 text-center"
        >
          <div className="w-16 h-16 bg-stone-900 rounded-2xl flex items-center justify-center text-white mx-auto mb-8 shadow-md">
            <Box size={32} />
          </div>
          
          <h1 className="text-3xl font-bold text-stone-900 mb-2">Inventory Pro</h1>
          <p className="text-stone-500 mb-10">Manage your stock with precision and ease.</p>

          <div className="space-y-4 mb-10 text-left">
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-stone-50 border border-black/5">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-stone-900 shrink-0 shadow-sm">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-stone-900 text-sm">Secure Access</h3>
                <p className="text-xs text-stone-500">Enterprise-grade security for your inventory data.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-stone-50 border border-black/5">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-stone-900 shrink-0 shadow-sm">
                <UserCheck size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-stone-900 text-sm">Role-based Controls</h3>
                <p className="text-xs text-stone-500">Distinct permissions for admins and staff members.</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 text-sm rounded-2xl border border-red-100">
              {error}
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full h-14 bg-stone-900 text-white rounded-2xl font-semibold flex items-center justify-center gap-3 hover:bg-stone-800 transition-all disabled:opacity-50 shadow-sm active:scale-95 group"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Continue with Google</span>
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
          
          <p className="mt-8 text-xs text-stone-400">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
