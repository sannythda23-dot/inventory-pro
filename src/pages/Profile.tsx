import React from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { 
  User, 
  Mail, 
  Shield, 
  Save, 
  CheckCircle2,
  AlertCircle,
  Camera
} from 'lucide-react';
import { motion } from 'motion/react';

export default function Profile() {
  const user = auth.currentUser;
  const [displayName, setDisplayName] = React.useState(user?.displayName || '');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSubmitting(true);
    setSuccess(false);
    setError(null);

    try {
      // Update Firebase Auth
      await updateProfile(user, { displayName });

      // Update Firestore users collection
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        displayName,
        updatedAt: new Date().toISOString()
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to update profile');
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Profile Settings</h1>
        <p className="text-stone-500">Manage your personal information and account preferences.</p>
      </header>

      <div className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden">
        <div className="h-32 bg-stone-900 relative">
          <div className="absolute -bottom-12 left-8">
            <div className="w-24 h-24 rounded-3xl bg-white p-1 shadow-md">
              <div className="w-full h-full rounded-2xl bg-stone-100 flex items-center justify-center text-stone-400 relative group">
                <User size={40} />
                <button className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                  <Camera size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-16 p-8">
          <form onSubmit={handleUpdateProfile} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider">Display Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-stone-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all"
                    placeholder="Enter your name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={18} />
                  <input
                    disabled
                    type="email"
                    value={user?.email || ''}
                    className="w-full pl-12 pr-4 py-3 bg-stone-50 border border-black/5 rounded-xl text-stone-400 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider">Account Role</label>
                <div className="relative">
                  <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={18} />
                  <input
                    disabled
                    type="text"
                    value={user?.email === 'sannythda23@gmail.com' ? 'Administrator' : 'Staff Member'}
                    className="w-full pl-12 pr-4 py-3 bg-stone-50 border border-black/5 rounded-xl text-stone-400 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-4 bg-red-50 text-red-600 text-sm rounded-2xl border border-red-100">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-4 bg-emerald-50 text-emerald-600 text-sm rounded-2xl border border-emerald-100"
              >
                <CheckCircle2 size={18} />
                <span>Profile updated successfully!</span>
              </motion.div>
            )}

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-8 py-3 bg-stone-900 text-white rounded-2xl font-semibold hover:bg-stone-800 transition-all shadow-sm active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Save size={20} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-black/5 p-8 shadow-sm">
        <h3 className="text-lg font-bold text-stone-900 mb-2">Security & Privacy</h3>
        <p className="text-sm text-stone-500 mb-6">Your account is secured with Google Authentication. To change your password or security settings, please visit your Google Account settings.</p>
        <button 
          onClick={() => window.open('https://myaccount.google.com/security', '_blank')}
          className="text-sm font-semibold text-stone-900 hover:underline flex items-center gap-1"
        >
          Manage Google Account security
        </button>
      </div>
    </div>
  );
}
