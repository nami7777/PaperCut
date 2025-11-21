
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ArrowRight, Book, Settings, Upload } from 'lucide-react';
import { getAllQuestions } from '../services/db';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSubjects = async () => {
      const allQs = await getAllQuestions();
      const uniqueSubjects = Array.from(new Set(allQs.map(q => q.subject)));
      setSubjects(uniqueSubjects.sort());
      setLoading(false);
    };
    loadSubjects();
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white p-8 font-sans flex flex-col">
      <div className="max-w-4xl mx-auto w-full flex-1">
        
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-500 to-emerald-500 bg-clip-text text-transparent">PaperCut</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Select a subject to begin</p>
          </div>
          <div className="flex gap-2">
             <button onClick={() => navigate('/import')} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors" title="Import">
                <Upload size={20} />
             </button>
             <button onClick={() => navigate('/settings')} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors" title="Settings">
                <Settings size={20} />
             </button>
          </div>
        </div>

        {/* Create Subject / New Flow */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button 
            onClick={() => navigate('/new')}
            className="group p-8 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col items-center justify-center text-center"
          >
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
               <Plus size={32} />
            </div>
            <h3 className="text-2xl font-bold">Log New Exam</h3>
            <p className="text-blue-100 mt-2">Extract questions from a new PDF paper</p>
          </button>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-lg border border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
               <Book size={20} className="text-emerald-500"/> Your Subjects
            </h2>
            
            {loading ? (
              <div className="animate-pulse space-y-2">
                 <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded"></div>
                 <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded"></div>
              </div>
            ) : subjects.length === 0 ? (
              <div className="text-slate-500 dark:text-slate-400 text-sm py-8 text-center">
                No subjects found. Log a new exam to create one.
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                {subjects.map(sub => (
                  <button
                    key={sub}
                    onClick={() => navigate(`/subject/${encodeURIComponent(sub)}`)}
                    className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-blue-50 dark:hover:bg-slate-700 text-left group transition-colors"
                  >
                    <span className="font-semibold text-lg truncate">{sub}</span>
                    <ArrowRight size={18} className="text-slate-400 group-hover:text-blue-500 transform group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
      
      <div className="text-center py-6 mt-12">
        <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-600 opacity-60">
          Made by Nami + Google Studio
        </p>
      </div>
    </div>
  );
};

export default Home;
