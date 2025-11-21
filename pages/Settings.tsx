import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Moon, Sun } from 'lucide-react';

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => {
      return localStorage.getItem('theme') || 'dark';
  });

  useEffect(() => {
      const html = document.querySelector('html');
      if (theme === 'dark') {
          html?.classList.add('dark');
      } else {
          html?.classList.remove('dark');
      }
      localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white p-8">
        <div className="max-w-2xl mx-auto">
            <button onClick={() => navigate('/')} className="mb-6 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-2">
                <ArrowLeft size={18}/> Back
            </button>
            
            <h1 className="text-3xl font-bold mb-8">Settings</h1>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-lg">Appearance</h3>
                        <p className="text-slate-500 text-sm">Toggle between Light and Dark mode</p>
                    </div>
                    <button 
                      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                      className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                        {theme === 'dark' ? <Moon className="text-blue-400" /> : <Sun className="text-amber-500" />}
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};

export default Settings;