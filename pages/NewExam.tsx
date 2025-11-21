
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ExamMetadata, Month, PaperType } from '../types';
import { Upload, ArrowRight, FileCheck, Lock, ArrowLeft } from 'lucide-react';
import { getAllQuestions } from '../services/db';

const NewExam: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const preSelectedSubject = location.state?.subject;

  const [existingSubjects, setExistingSubjects] = useState<string[]>([]);
  const [formData, setFormData] = useState<Partial<ExamMetadata>>({
    year: new Date().getFullYear(),
    month: Month.MAY,
    paperType: PaperType.PAPER_1,
    subject: preSelectedSubject || ""
  });

  const [qFile, setQFile] = useState<File | null>(null);
  const [aFile, setAFile] = useState<File | null>(null);
  const [dragActiveQ, setDragActiveQ] = useState(false);
  const [dragActiveA, setDragActiveA] = useState(false);

  useEffect(() => {
      // Load existing subjects for dropdown
      getAllQuestions().then(qs => {
          const subs = Array.from(new Set(qs.map(q => q.subject))).sort();
          setExistingSubjects(subs);
      });
  }, []);

  // Drag handlers
  const handleDrag = (e: React.DragEvent, type: 'Q' | 'A', status: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'Q') setDragActiveQ(status);
    else setDragActiveA(status);
  };

  const handleDrop = (e: React.DragEvent, type: 'Q' | 'A') => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'Q') setDragActiveQ(false);
    else setDragActiveA(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type !== 'application/pdf') {
        alert("Only PDF files are allowed.");
        return;
      }
      if (type === 'Q') setQFile(file);
      else setAFile(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qFile || !aFile || !formData.subject) {
      alert("Please provide all required fields and files.");
      return;
    }

    const metadata: ExamMetadata = {
      id: Date.now().toString(),
      subject: formData.subject!,
      year: formData.year!,
      month: formData.month!,
      paperType: formData.paperType!,
      timezone: formData.timezone,
      questionPdf: qFile,
      answerPdf: aFile
    };

    navigate('/workspace', { state: metadata });
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-slate-800 rounded-xl shadow-2xl border border-slate-700 p-8">
        
        <button onClick={() => navigate(-1)} className="mb-6 text-slate-400 hover:text-white flex items-center gap-2 transition-colors group">
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" /> Back
        </button>

        <h1 className="text-3xl font-bold text-white mb-2">Start Extraction Session</h1>
        <p className="text-slate-400 mb-8">Configure the exam details and upload documents.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Subject */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-2">Subject</label>
              <div className="relative">
                  <input 
                    type="text"
                    required 
                    placeholder="e.g. Chemistry HL"
                    value={formData.subject}
                    onChange={e => setFormData({...formData, subject: e.target.value})}
                    readOnly={!!preSelectedSubject}
                    list="subject-list"
                    className={`w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none ${preSelectedSubject ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                  {preSelectedSubject && (
                      <Lock size={16} className="absolute right-3 top-3 text-slate-500" />
                  )}
                  <datalist id="subject-list">
                      {existingSubjects.map(s => <option key={s} value={s} />)}
                  </datalist>
              </div>
              {preSelectedSubject && <p className="text-xs text-slate-500 mt-1">Locked to current subject repository.</p>}
            </div>

            {/* Year */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Year</label>
              <input 
                type="number"
                required 
                value={formData.year}
                onChange={e => setFormData({...formData, year: parseInt(e.target.value)})}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Month */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Month</label>
              <select 
                value={formData.month}
                onChange={e => setFormData({...formData, month: e.target.value as Month})}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value={Month.MAY}>May</option>
                <option value={Month.NOVEMBER}>November</option>
              </select>
            </div>

            {/* Paper Type */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Paper Type</label>
              <select 
                value={formData.paperType}
                onChange={e => setFormData({...formData, paperType: e.target.value as PaperType})}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value={PaperType.PAPER_1}>Paper 1 (MCQ)</option>
                <option value={PaperType.PAPER_2}>Paper 2 / Written</option>
              </select>
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Timezone (Optional)</label>
              <input 
                type="text" 
                placeholder="e.g. TZ1"
                value={formData.timezone || ''}
                onChange={e => setFormData({...formData, timezone: e.target.value})}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            {/* Question PDF Upload */}
            <div 
              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all duration-200 cursor-pointer
                ${dragActiveQ ? 'border-blue-400 bg-blue-500/20 scale-[1.02]' : qFile ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-600 hover:border-blue-500 hover:bg-slate-800'}
              `}
              onDragEnter={(e) => handleDrag(e, 'Q', true)}
              onDragLeave={(e) => handleDrag(e, 'Q', false)}
              onDragOver={(e) => handleDrag(e, 'Q', true)}
              onDrop={(e) => handleDrop(e, 'Q')}
            >
               {qFile ? <FileCheck size={32} className="text-emerald-400" /> : <Upload size={32} className="text-slate-500" />}
               <label className="mt-4 cursor-pointer w-full h-full">
                 <span className="block font-medium text-white">{qFile ? qFile.name : "Question Paper"}</span>
                 <span className="text-sm text-slate-400">{qFile ? "Ready to upload" : "Drag & Drop PDF here"}</span>
                 <input type="file" accept="application/pdf" className="hidden" onChange={e => setQFile(e.target.files?.[0] || null)} />
               </label>
            </div>

             {/* Answer PDF Upload */}
             <div 
              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all duration-200 cursor-pointer
                ${dragActiveA ? 'border-purple-400 bg-purple-500/20 scale-[1.02]' : aFile ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-600 hover:border-purple-500 hover:bg-slate-800'}
              `}
              onDragEnter={(e) => handleDrag(e, 'A', true)}
              onDragLeave={(e) => handleDrag(e, 'A', false)}
              onDragOver={(e) => handleDrag(e, 'A', true)}
              onDrop={(e) => handleDrop(e, 'A')}
             >
               {aFile ? <FileCheck size={32} className="text-emerald-400" /> : <Upload size={32} className="text-slate-500" />}
               <label className="mt-4 cursor-pointer w-full h-full">
                 <span className="block font-medium text-white">{aFile ? aFile.name : "Answer Key"}</span>
                 <span className="text-sm text-slate-400">{aFile ? "Ready to upload" : "Drag & Drop PDF here"}</span>
                 <input type="file" accept="application/pdf" className="hidden" onChange={e => setAFile(e.target.files?.[0] || null)} />
               </label>
            </div>
          </div>

          <div className="pt-6">
            <button type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-900/50 transition-all active:scale-[0.98]">
              Start Extraction <ArrowRight />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewExam;
