
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ExamMetadata, Month, PaperType, PdfPair } from '../types';
import { Upload, ArrowRight, FileCheck, Lock, ArrowLeft, Plus, Trash2, FileText } from 'lucide-react';
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

  const [pairs, setPairs] = useState<PdfPair[]>([]);
  
  // Temp state for new pair
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

  const addPair = () => {
    if (!qFile || !aFile) {
        alert("Please select both a Question and an Answer PDF for this pair.");
        return;
    }
    const newPair: PdfPair = {
        id: Date.now().toString(),
        questionPdf: qFile,
        answerPdf: aFile
    };
    setPairs([...pairs, newPair]);
    setQFile(null);
    setAFile(null);
  };

  const removePair = (id: string) => {
      setPairs(pairs.filter(p => p.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if we have at least one valid pair (either in list or in temp)
    let finalPairs = [...pairs];
    if (qFile && aFile) {
        finalPairs.push({
            id: Date.now().toString(),
            questionPdf: qFile,
            answerPdf: aFile
        });
    }

    if (finalPairs.length === 0) {
      alert("Please provide at least one pair of Question and Answer PDFs.");
      return;
    }

    if (!formData.subject) {
        alert("Please enter a subject name.");
        return;
    }

    const metadata: ExamMetadata = {
      id: Date.now().toString(),
      subject: formData.subject!,
      year: formData.year!,
      month: formData.month!,
      paperType: formData.paperType!,
      timezone: formData.timezone,
      pdfPairs: finalPairs,
      // Keep single refs if only one pair for backward compatibility logic
      questionPdf: finalPairs[0].questionPdf,
      answerPdf: finalPairs[0].answerPdf
    };

    navigate('/workspace', { state: metadata });
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-8">
        
        <button onClick={() => navigate(-1)} className="mb-6 text-slate-400 hover:text-white flex items-center gap-2 transition-colors group">
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" /> Back
        </button>

        <h1 className="text-3xl font-bold text-white mb-2">Start Extraction Session</h1>
        <p className="text-slate-400 mb-8">Configure the exam details and upload multiple Question/Answer PDF batches.</p>

        <form onSubmit={handleSubmit} className="space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Subject */}
            <div className="col-span-full">
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
              <label className="block text-sm font-medium text-slate-300 mb-2">Timezone</label>
              <input 
                type="text" 
                placeholder="e.g. TZ1"
                value={formData.timezone || ''}
                onChange={e => setFormData({...formData, timezone: e.target.value})}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="space-y-6">
             <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <FileText size={20} className="text-blue-500" /> PDF Pairs
                </h3>
                <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">{pairs.length} Batches Added</span>
             </div>

             {/* Existing Pairs List */}
             {pairs.length > 0 && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {pairs.map((p, idx) => (
                         <div key={p.id} className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 flex items-center justify-between group">
                             <div className="flex-1 min-w-0">
                                 <div className="text-[10px] text-blue-500 font-bold uppercase tracking-widest mb-1">Batch {idx + 1}</div>
                                 <div className="text-sm font-medium text-slate-200 truncate flex items-center gap-2">
                                     <span className="text-xs px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded">Q</span> {p.questionPdf.name}
                                 </div>
                                 <div className="text-sm font-medium text-slate-200 truncate flex items-center gap-2 mt-1">
                                     <span className="text-xs px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded">A</span> {p.answerPdf.name}
                                 </div>
                             </div>
                             <button type="button" onClick={() => removePair(p.id)} className="p-2 text-slate-500 hover:text-red-500 transition-colors">
                                 <Trash2 size={18} />
                             </button>
                         </div>
                     ))}
                 </div>
             )}

             {/* Add New Pair Form */}
             <div className="bg-slate-900/30 p-6 rounded-2xl border border-dashed border-slate-700 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Q Upload */}
                    <div 
                    className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all duration-200 cursor-pointer
                        ${dragActiveQ ? 'border-blue-400 bg-blue-500/20' : qFile ? 'border-blue-500 bg-blue-500/10' : 'border-slate-600 hover:border-blue-500 hover:bg-slate-800'}
                    `}
                    onDragEnter={(e) => handleDrag(e, 'Q', true)}
                    onDragLeave={(e) => handleDrag(e, 'Q', false)}
                    onDragOver={(e) => handleDrag(e, 'Q', true)}
                    onDrop={(e) => handleDrop(e, 'Q')}
                    >
                    {qFile ? <FileCheck size={24} className="text-blue-400" /> : <Upload size={24} className="text-slate-500" />}
                    <label className="mt-2 cursor-pointer w-full">
                        <span className="block text-xs font-bold text-white truncate">{qFile ? qFile.name : "Question Paper"}</span>
                        <input type="file" accept="application/pdf" className="hidden" onChange={e => setQFile(e.target.files?.[0] || null)} />
                    </label>
                    </div>

                    {/* A Upload */}
                    <div 
                    className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all duration-200 cursor-pointer
                        ${dragActiveA ? 'border-emerald-400 bg-emerald-500/20' : aFile ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-600 hover:border-emerald-500 hover:bg-slate-800'}
                    `}
                    onDragEnter={(e) => handleDrag(e, 'A', true)}
                    onDragLeave={(e) => handleDrag(e, 'A', false)}
                    onDragOver={(e) => handleDrag(e, 'A', true)}
                    onDrop={(e) => handleDrop(e, 'A')}
                    >
                    {aFile ? <FileCheck size={24} className="text-emerald-400" /> : <Upload size={24} className="text-slate-500" />}
                    <label className="mt-2 cursor-pointer w-full">
                        <span className="block text-xs font-bold text-white truncate">{aFile ? aFile.name : "Answer Key"}</span>
                        <input type="file" accept="application/pdf" className="hidden" onChange={e => setAFile(e.target.files?.[0] || null)} />
                    </label>
                    </div>
                </div>
                <button 
                    type="button" 
                    onClick={addPair}
                    disabled={!qFile || !aFile}
                    className="w-full py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                    <Plus size={16} /> Add Pair to Session
                </button>
             </div>
          </div>

          <div className="pt-6 border-t border-slate-700">
            <button type="submit" className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-lg flex items-center justify-center gap-2 shadow-2xl shadow-blue-900/50 transition-all active:scale-[0.98] uppercase tracking-tighter">
              Launch Workspace <ArrowRight />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewExam;
