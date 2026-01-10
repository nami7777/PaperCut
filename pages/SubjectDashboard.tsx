
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Folder, QuestionEntry, Lesson } from '../types';
import { 
  getQuestionsBySubject, 
  getFoldersBySubject, 
  saveFolder, 
  deleteQuestion, 
  deleteFolder, 
  getAllUniqueKeywords, 
  getAllUniqueTopics, 
  getLessonsBySubject,
  saveLesson,
  deleteLesson,
  reprocessSubjectMapping
} from '../services/db';
import { extractTriggersLocally, simulateNlpProcessing, MagicAnalysisResult } from '../services/nlp';
import { 
  ArrowLeft, Plus, Folder as FolderIcon, Database, Search, 
  Trash2, Play, Download, Edit2, 
  Check, X, Zap, Info,
  Cpu, BarChart3, Binary, Filter, Target, ScanText, AlertCircle, RefreshCw, Eye,
  ChevronUp, ChevronDown, FileQuestion
} from 'lucide-react';

const SubjectDashboard: React.FC = () => {
  const { subjectId } = useParams<{subjectId: string}>();
  const subject = decodeURIComponent(subjectId || '');
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'repo' | 'lessons' | 'folders'>('repo');
  const [questions, setQuestions] = useState<QuestionEntry[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [viewingFolder, setViewingFolder] = useState<Folder | null>(null);
  
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);

  const [folderName, setFolderName] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [filterUncategorized, setFilterUncategorized] = useState(false);
  
  const [lessonName, setLessonName] = useState("");
  const [lessonKeywords, setLessonKeywords] = useState<string[]>([]);
  const [lessonOcrPhrases, setLessonOcrPhrases] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [phraseInput, setPhraseInput] = useState("");
  const [lessonTranscript, setLessonTranscript] = useState("");

  const [showMagicModal, setShowMagicModal] = useState(false);
  const [isMagicRunning, setIsMagicRunning] = useState(false);
  const [magicStep, setMagicStep] = useState(0);
  const [magicLessonId, setMagicLessonId] = useState("");
  const [magicResult, setMagicResult] = useState<MagicAnalysisResult | null>(null);

  const [availableKeywords, setAvailableKeywords] = useState<string[]>([]);
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  useEffect(() => {
    if (!subject) { navigate('/'); return; }
    loadData();
    loadMetadata();
  }, [subject]);

  const loadData = async () => {
    const [qs, fs, ls] = await Promise.all([
      getQuestionsBySubject(subject),
      getFoldersBySubject(subject),
      getLessonsBySubject(subject)
    ]);
    setQuestions(qs);
    setFolders(fs);
    setLessons(ls);
  };

  const loadMetadata = async () => {
    const kw = await getAllUniqueKeywords(subject);
    const tp = await getAllUniqueTopics(subject);
    setAvailableKeywords(kw);
    setAvailableTopics(tp);
  };

  const handleSyncAll = async () => {
      setIsSyncing(true);
      try {
          await reprocessSubjectMapping(subject);
          await loadData();
          await loadMetadata();
          alert("Tags refreshed. Old lesson-based tags have been pruned and rules re-applied.");
      } catch (e) {
          console.error(e);
      } finally {
          setIsSyncing(false);
      }
  };

  const openNewLesson = () => {
    setEditingLessonId(null);
    setLessonName("");
    setLessonKeywords([]);
    setLessonOcrPhrases([]);
    setLessonTranscript("");
    setShowLessonModal(true);
  };

  const openEditLesson = (l: Lesson) => {
    setEditingLessonId(l.id);
    setLessonName(l.name);
    setLessonKeywords(l.triggerKeywords || []);
    setLessonOcrPhrases(l.triggerOcrPhrases || []);
    setLessonTranscript(l.referenceText || "");
    setShowLessonModal(true);
  };

  const handleSaveLesson = async () => {
    if (!lessonName.trim()) return;
    const lesson: Lesson = {
      id: editingLessonId || Date.now().toString(),
      name: lessonName,
      subject: subject,
      triggerKeywords: lessonKeywords,
      triggerOcrPhrases: lessonOcrPhrases,
      referenceText: lessonTranscript
    };
    await saveLesson(lesson);
    await reprocessSubjectMapping(subject); 
    setShowLessonModal(false);
    await loadData();
    await loadMetadata();
  };

  const openNewFolder = () => {
    setEditingFolderId(null);
    setFolderName("");
    setSelectedTopics([]);
    setFilterUncategorized(false);
    setShowFolderModal(true);
  };

  const openEditFolder = (f: Folder) => {
    setEditingFolderId(f.id);
    setFolderName(f.name);
    setSelectedTopics(f.filterTopics || []);
    setFilterUncategorized(!!f.filterUncategorized);
    setShowFolderModal(true);
  };

  const handleSaveFolder = async () => {
    if (!folderName.trim()) return;
    const folder: Folder = {
      id: editingFolderId || Date.now().toString(),
      name: folderName,
      subject: subject,
      filterKeywords: [],
      filterTopics: selectedTopics,
      filterUncategorized: filterUncategorized
    };
    await saveFolder(folder);
    setShowFolderModal(false);
    loadData();
  };

  const handleMagicAnalyze = async () => {
    const lesson = lessons.find(l => l.id === magicLessonId);
    if (!lesson || !lesson.referenceText) {
        alert("Select a lesson with a transcript saved.");
        return;
    }
    setIsMagicRunning(true);
    setMagicStep(1);
    await simulateNlpProcessing(800);
    setMagicStep(2);
    await simulateNlpProcessing(1000);
    setMagicStep(3);
    const result = extractTriggersLocally(lesson.referenceText);
    await simulateNlpProcessing(600);
    setMagicResult(result);
    setIsMagicRunning(false);
  };

  const applyMagicResult = async () => {
    if (!magicResult || !magicLessonId) return;
    const lesson = lessons.find(l => l.id === magicLessonId);
    if (!lesson) return;
    const updatedLesson: Lesson = {
        ...lesson,
        triggerKeywords: Array.from(new Set([...lesson.triggerKeywords, ...magicResult.triggerKeywords])),
        triggerOcrPhrases: Array.from(new Set([...lesson.triggerOcrPhrases, ...magicResult.triggerOcrPhrases]))
    };
    await saveLesson(updatedLesson);
    await reprocessSubjectMapping(subject);
    setShowMagicModal(false);
    setMagicResult(null);
    setMagicLessonId("");
    alert("Advanced rules applied. Repository has been re-synced.");
    loadData();
    loadMetadata();
  };

  const allPossibleTopics = useMemo(() => {
    const lessonNames = lessons.map(l => l.name);
    const uniqueTags = availableTopics;
    return Array.from(new Set([...lessonNames, ...uniqueTags])).sort();
  }, [lessons, availableTopics]);

  const getFilteredQuestions = (folder?: Folder) => {
    let qs = questions;
    if (folder) {
      if (folder.filterUncategorized) {
          qs = qs.filter(q => q.topics.length === 0);
      } else {
          qs = qs.filter(q => {
            const matchesTopic = folder.filterTopics.length === 0 || folder.filterTopics.some(t => (q.topics || []).includes(t));
            return matchesTopic;
          });
      }
    }
    if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        qs = qs.filter(q => 
            q.subject.toLowerCase().includes(term) ||
            q.keywords.some(k => k.toLowerCase().includes(term)) ||
            q.topics.some(t => t.toLowerCase().includes(term)) ||
            (q.ocrText && q.ocrText.toLowerCase().includes(term))
        );
    }
    return qs;
  };

  const getLessonCount = (lessonName: string) => {
    return questions.filter(q => q.topics.includes(lessonName)).length;
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"><ArrowLeft size={20} /></button>
            <div>
               <h1 className="text-2xl font-bold">{subject}</h1>
               <p className="text-xs text-slate-500 dark:text-slate-400">{questions.length} Questions Repository</p>
            </div>
          </div>
          <div className="flex gap-2">
             <button onClick={() => setShowMagicModal(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all shadow-lg border border-indigo-400"><Zap size={16} /> Magic Rules</button>
             <button onClick={() => navigate('/export', { state: { subject } })} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"><Download size={16} /> Export</button>
             <button onClick={() => navigate('/new', { state: { subject } })} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-md"><Plus size={16} /> Log Exam</button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
         {/* Navigation Tabs */}
         <div className="flex mb-8 bg-slate-200 dark:bg-slate-800 p-1 rounded-2xl inline-flex shadow-inner border border-slate-300 dark:border-slate-700">
           {['repo', 'lessons', 'folders'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-8 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === tab ? 'bg-white dark:bg-slate-700 shadow-xl text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
              >
                {tab === 'repo' && <Database size={16} />}
                {tab === 'lessons' && <Target size={16} />}
                {tab === 'folders' && <FolderIcon size={16} />}
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
           ))}
         </div>

         {activeTab === 'lessons' && (
           <div className="animate-fade-in space-y-6">
              <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 p-4 rounded-xl">
                 <div className="flex items-start gap-4">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg"><Info size={20}/></div>
                    <div>
                        <h4 className="font-bold text-blue-800 dark:text-blue-300">Rule Engine Management</h4>
                        <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">Updates to topic triggers require a refresh to apply to existing questions.</p>
                    </div>
                 </div>
                 <button 
                    onClick={handleSyncAll}
                    disabled={isSyncing}
                    className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-all disabled:opacity-50 shadow-md"
                 >
                    {isSyncing ? <RefreshCw className="animate-spin" size={18}/> : <RefreshCw size={18}/>}
                    Refresh Lesson Tags
                 </button>
              </div>

              <button 
                onClick={openNewLesson}
                className="w-full py-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-slate-500 hover:border-indigo-500 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all flex flex-col items-center justify-center gap-3"
              >
                 <Plus size={32} />
                 <div className="text-center">
                    <span className="font-bold text-lg block">Create Rule-Based Topic</span>
                    <span className="text-xs opacity-60">Automatic classification based on text matching</span>
                 </div>
              </button>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {lessons.map(lesson => (
                    <div key={lesson.id} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:border-indigo-500 transition-colors group">
                       <div className="flex justify-between items-start mb-6">
                          <div className="flex items-center gap-3">
                             <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl"><Target size={24} /></div>
                             <div className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-xs font-black">
                                {getLessonCount(lesson.name)} Questions
                             </div>
                          </div>
                          <div className="flex gap-1">
                             <button onClick={() => openEditLesson(lesson)} className="text-slate-300 hover:text-indigo-500 p-2 transition-colors"><Edit2 size={18}/></button>
                             <button onClick={() => deleteLesson(lesson.id).then(loadData)} className="text-slate-300 hover:text-red-500 p-2 transition-colors"><Trash2 size={18}/></button>
                          </div>
                       </div>
                       <h3 className="font-bold text-xl mb-6">{lesson.name}</h3>
                    </div>
                 ))}
              </div>
           </div>
         )}

         {activeTab === 'repo' && (
            <div className="animate-fade-in space-y-4">
               <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="text" 
                  placeholder="Deep search rules, topics, or question text..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-lg transition-all"
                />
              </div>

              {getFilteredQuestions().map(q => {
                 const isExpanded = expandedQuestionId === q.id;
                 return (
                   <div key={q.id} onClick={() => setExpandedQuestionId(isExpanded ? null : q.id)} className={`bg-white dark:bg-slate-800 rounded-2xl border transition-all cursor-pointer overflow-hidden ${isExpanded ? 'border-blue-500 shadow-2xl ring-1 ring-blue-500 scale-[1.01]' : 'border-slate-200 dark:border-slate-700 hover:border-blue-400'}`}>
                      <div className="p-5 flex gap-5">
                        <div className="w-24 h-24 bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-700">
                            <img src={q.parts[0]?.questionImages?.[0] || q.parts[0]?.questionImage} className="max-w-full max-h-full object-contain" />
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-lg">{q.year} {q.month} - Q{q.questionNumber}</h3>
                                <div className="flex gap-2">
                                   <button onClick={(e) => { e.stopPropagation(); if(confirm("Delete question?")) deleteQuestion(q.id).then(loadData); }} className="text-slate-300 hover:text-red-500 p-2"><Trash2 size={18}/></button>
                                   {isExpanded ? <ChevronUp size={20} className="text-blue-500" /> : <ChevronDown size={20} className="text-slate-300" />}
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                               {q.topics.map(t => <span key={t} className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] rounded-full border border-blue-200 dark:border-blue-800 font-black uppercase tracking-wider flex items-center gap-1"><Check size={10}/> {t}</span>)}
                               {q.keywords.map(k => <span key={k} className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] rounded-full font-bold">{k}</span>)}
                            </div>
                        </div>
                      </div>
                      
                      {isExpanded && (
                         <div className="p-8 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 space-y-8 animate-fade-in">
                            {q.parts.map(p => (
                               <div key={p.id} className="space-y-4">
                                  <div className="flex items-center gap-2">
                                      <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs uppercase">{p.label}</span>
                                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Question Fragment</span>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     <div className="space-y-2">
                                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter flex items-center gap-1"><FileQuestion size={10}/> Question View</p>
                                         {(p.questionImages || (p.questionImage ? [p.questionImage] : [])).map((img, i) => <img key={i} src={img} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-2" />)}
                                     </div>
                                     <div className="space-y-2">
                                         <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-tighter flex items-center gap-1"><Check size={10}/> Solution / Markscheme</p>
                                         {p.answerText && <div className="text-2xl font-black p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-800 mb-2 inline-block">{p.answerText}</div>}
                                         {(p.answerImages || (p.answerImage ? [p.answerImage] : [])).map((img, i) => <img key={i} src={img} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-2" />)}
                                     </div>
                                  </div>
                               </div>
                            ))}
                         </div>
                      )}
                   </div>
                 );
              })}
            </div>
         )}

         {activeTab === 'folders' && (
           <div className="animate-fade-in grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <button 
                onClick={openNewFolder}
                className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-slate-500 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all flex flex-col items-center justify-center gap-4"
              >
                 <Plus size={32} />
                 <span className="font-bold">New Smart Folder</span>
              </button>
              {folders.map(folder => (
                <div key={folder.id} className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative group hover:shadow-xl transition-all">
                    <div className="flex justify-between items-start mb-6">
                        <div className={`p-4 rounded-2xl ${folder.filterUncategorized ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                            {folder.filterUncategorized ? <AlertCircle size={28} /> : <FolderIcon size={28} />}
                        </div>
                        <div className="flex gap-1">
                           <button onClick={() => setViewingFolder(folder)} className="text-slate-300 hover:text-blue-500 p-2 transition-colors" title="View Contents"><Info size={18}/></button>
                           <button onClick={() => openEditFolder(folder)} className="text-slate-300 hover:text-indigo-500 p-2 transition-colors" title="Edit Settings"><Edit2 size={18}/></button>
                           <button onClick={() => deleteFolder(folder.id).then(loadData)} className="text-slate-300 hover:text-red-500 p-2 transition-colors" title="Delete Folder"><Trash2 size={18}/></button>
                        </div>
                    </div>
                    <h3 className="font-bold text-2xl mb-2">{folder.name}</h3>
                    <p className="text-slate-500 text-sm mb-6">{getFilteredQuestions(folder).length} Questions Matched</p>
                    <button onClick={() => navigate(`/study/${folder.id}`)} className="w-full py-3 bg-slate-900 dark:bg-slate-700 hover:bg-blue-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-3">
                        <Play size={20} fill="currentColor" /> Study Now
                    </button>
                </div>
              ))}
           </div>
         )}
      </div>

      {/* Folder Modal */}
      {showFolderModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl shadow-2xl p-8 animate-slide-up border border-slate-200 dark:border-slate-700">
              <h2 className="text-2xl font-bold mb-6">{editingFolderId ? 'Edit Smart Folder' : 'Create Smart Folder'}</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Folder Display Name</label>
                  <input type="text" value={folderName} onChange={e => setFolderName(e.target.value)} className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 outline-none font-bold" placeholder="e.g. Exam Prep - Unit 1" />
                </div>
                
                <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <input 
                        type="checkbox" 
                        id="uncategorized" 
                        checked={filterUncategorized} 
                        onChange={e => setFilterUncategorized(e.target.checked)}
                        className="w-5 h-5 rounded bg-blue-600"
                    />
                    <label htmlFor="uncategorized" className="text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                        Include only uncategorized questions
                    </label>
                </div>

                {!filterUncategorized && (
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-3">Filter by Topics</label>
                        <div className="flex flex-wrap gap-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700 max-h-40 overflow-y-auto shadow-inner">
                            {allPossibleTopics.map(t => (
                                <button key={t} onClick={() => { if(selectedTopics.includes(t)) setSelectedTopics(selectedTopics.filter(st => st !== t)); else setSelectedTopics([...selectedTopics, t]); }} className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${selectedTopics.includes(t) ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600'}`}>
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
              </div>
              <div className="flex gap-4 mt-10">
                 <button onClick={() => setShowFolderModal(false)} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl transition-colors">Cancel</button>
                 <button onClick={handleSaveFolder} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-600/20">Save Folder</button>
              </div>
           </div>
        </div>
      )}

      {/* Viewing Folder Content Preview Modal */}
      {viewingFolder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-white dark:bg-slate-800 w-full max-w-3xl rounded-3xl shadow-2xl p-8 animate-slide-up border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2"><FolderIcon className="text-blue-500"/> {viewingFolder.name}</h2>
                        <p className="text-sm text-slate-500">Matching questions preview.</p>
                    </div>
                    <button onClick={() => setViewingFolder(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"><X size={24}/></button>
                </div>

                <div className="space-y-4">
                    {getFilteredQuestions(viewingFolder).length === 0 ? (
                        <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                            <Filter size={48} className="mx-auto text-slate-300 mb-4" />
                            <p className="text-slate-500">No questions currently match these rules.</p>
                        </div>
                    ) : (
                        getFilteredQuestions(viewingFolder).map(q => (
                            <div key={q.id} className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-4 hover:border-blue-500 transition-colors">
                                <div className="w-16 h-16 bg-white rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                                    <img src={q.parts[0]?.questionImages?.[0] || q.parts[0]?.questionImage} className="max-w-full max-h-full object-contain" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-sm truncate">{q.year} {q.month} - Q{q.questionNumber}</h4>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {q.topics.map(t => <span key={t} className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[9px] font-black rounded uppercase tracking-tighter">{t}</span>)}
                                    </div>
                                </div>
                                <button onClick={() => navigate(`/study/${viewingFolder.id}`)} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors">
                                    <Play size={16} fill="currentColor" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
      )}

      {/* Lesson builder modal logic */}
      {showLessonModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
               <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-3xl p-8 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700">
                    <h2 className="text-2xl font-bold mb-6">Edit Topic Rules</h2>
                    <div className="space-y-6">
                        <input value={lessonName} onChange={e => setLessonName(e.target.value)} className="w-full bg-slate-100 dark:bg-slate-900 p-4 rounded-xl border outline-none font-bold" placeholder="Topic Name" />
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 mb-2 block">Keyword Triggers</label>
                                <input value={keywordInput} onChange={e => setKeywordInput(e.target.value)} onKeyDown={e => {if(e.key === 'Enter'){setLessonKeywords([...lessonKeywords, keywordInput]); setKeywordInput("");}}} className="w-full bg-slate-100 dark:bg-slate-900 p-2 rounded-lg border outline-none" placeholder="Enter to add..." />
                                <div className="flex flex-wrap gap-1 mt-2">{lessonKeywords.map(k => <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-[10px]">{k}</span>)}</div>
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 mb-2 block">OCR Triggers</label>
                                <input value={phraseInput} onChange={e => setPhraseInput(e.target.value)} onKeyDown={e => {if(e.key === 'Enter'){setLessonOcrPhrases([...lessonOcrPhrases, phraseInput]); setPhraseInput("");}}} className="w-full bg-slate-100 dark:bg-slate-900 p-2 rounded-lg border outline-none" placeholder="Enter to add..." />
                                <div className="flex flex-wrap gap-1 mt-2">{lessonOcrPhrases.map(p => <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-[10px]">{p}</span>)}</div>
                            </div>
                        </div>
                        <textarea value={lessonTranscript} onChange={e => setLessonTranscript(e.target.value)} className="w-full h-32 bg-slate-100 dark:bg-slate-900 p-4 rounded-xl border outline-none" placeholder="Lesson context..." />
                    </div>
                    <div className="flex gap-4 mt-8">
                        <button onClick={() => setShowLessonModal(false)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-700 rounded-xl font-bold">Cancel</button>
                        <button onClick={handleSaveLesson} className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20">Save & Reprocess</button>
                    </div>
               </div>
          </div>
      )}

      {/* Magic Analysis Modal */}
      {showMagicModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl p-8 animate-slide-up border border-indigo-200 dark:border-indigo-800">
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Zap className="text-indigo-500"/> AI Magic Rules</h2>
                    <select value={magicLessonId} onChange={e => setMagicLessonId(e.target.value)} className="w-full p-4 rounded-xl bg-slate-100 dark:bg-slate-900 border mb-6 outline-none">
                        <option value="">Select Topic...</option>
                        {lessons.filter(l => l.referenceText).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                    {isMagicRunning ? (
                        <div className="text-center py-10">
                            <RefreshCw className="animate-spin mx-auto text-indigo-500 mb-4" size={48} />
                            <p className="text-indigo-500 font-bold">Analyzing context...</p>
                        </div>
                    ) : (
                        <div className="flex gap-4">
                            <button onClick={() => setShowMagicModal(false)} className="flex-1 py-4 rounded-xl bg-slate-100 dark:bg-slate-700 font-bold">Close</button>
                            <button onClick={handleMagicAnalyze} disabled={!magicLessonId} className="flex-1 py-4 rounded-xl bg-indigo-600 text-white font-bold disabled:opacity-50 shadow-lg shadow-indigo-600/20">Generate Rules</button>
                        </div>
                    )}
                </div>
          </div>
      )}
    </div>
  );
};

export default SubjectDashboard;
