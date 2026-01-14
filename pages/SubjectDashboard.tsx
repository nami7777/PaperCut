
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
  reprocessSubjectMapping,
  updateQuestionMetadata
} from '../services/db';
import { extractTriggersLocally, simulateNlpProcessing, MagicAnalysisResult } from '../services/nlp';
import { 
  ArrowLeft, Plus, Folder as FolderIcon, Database, Search, 
  Trash2, Play, Download, Edit2, 
  Check, X, Zap, Info,
  Filter, Target, AlertCircle, RefreshCw,
  ChevronUp, ChevronDown, FileQuestion, ScanText, Tag
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
  const [selectedTopicsForFolder, setSelectedTopicsForFolder] = useState<string[]>([]);
  const [filterUncategorized, setFilterUncategorized] = useState(false);
  
  const [lessonName, setLessonName] = useState("");
  const [lessonKeywords, setLessonKeywords] = useState<string[]>([]);
  const [lessonOcrPhrases, setLessonOcrPhrases] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [phraseInput, setPhraseInput] = useState("");
  const [lessonTranscript, setLessonTranscript] = useState("");

  const [showMagicModal, setShowMagicModal] = useState(false);
  const [isMagicRunning, setIsMagicRunning] = useState(false);
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

  const allPossibleTopics = useMemo(() => {
    const lessonNames = lessons.map(l => l.name);
    const uniqueTags = availableTopics;
    return Array.from(new Set([...lessonNames, ...uniqueTags])).sort();
  }, [lessons, availableTopics]);

  const handleSyncAll = async () => {
      setIsSyncing(true);
      try {
          await reprocessSubjectMapping(subject);
          await loadData();
          await loadMetadata();
          alert("Tags refreshed. Rules re-applied to all questions.");
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
    if (!lessonName.trim()) { alert("Topic name is required."); return; }
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
    setSelectedTopicsForFolder([]);
    setFilterUncategorized(false);
    setShowFolderModal(true);
  };

  const openEditFolder = (f: Folder) => {
    setEditingFolderId(f.id);
    setFolderName(f.name);
    setSelectedTopicsForFolder(f.filterTopics || []);
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
      filterTopics: selectedTopicsForFolder,
      filterUncategorized: filterUncategorized
    };
    await saveFolder(folder);
    setShowFolderModal(false);
    loadData();
  };

  const handleTagQuestion = async (qId: string, topicName: string) => {
    const q = questions.find(item => item.id === qId);
    if (!q) return;
    
    let newTopics = [...q.topics];
    if (newTopics.includes(topicName)) {
        newTopics = newTopics.filter(t => t !== topicName);
    } else {
        newTopics.push(topicName);
    }
    
    await updateQuestionMetadata(qId, { topics: newTopics });
    loadData(); // Refresh local list
  };

  const handleMagicAnalyze = async () => {
    const lesson = lessons.find(l => l.id === magicLessonId);
    if (!lesson || !lesson.referenceText) {
        alert("Select a topic with a reference transcript.");
        return;
    }
    setIsMagicRunning(true);
    await simulateNlpProcessing(1500);
    const result = extractTriggersLocally(lesson.referenceText);
    setMagicResult(result);
    setIsMagicRunning(false);
  };

  const applyMagicResult = async () => {
    if (!magicResult || !magicLessonId) return;
    const lesson = lessons.find(l => l.id === magicLessonId);
    if (!lesson) return;
    const updated: Lesson = {
        ...lesson,
        triggerKeywords: Array.from(new Set([...lesson.triggerKeywords, ...magicResult.triggerKeywords])),
        triggerOcrPhrases: Array.from(new Set([...lesson.triggerOcrPhrases, ...magicResult.triggerOcrPhrases]))
    };
    await saveLesson(updated);
    await reprocessSubjectMapping(subject);
    setShowMagicModal(false);
    setMagicResult(null);
    loadData();
    alert("AI rules applied to the topic.");
  };

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
              <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 p-5 rounded-2xl">
                 <div className="flex items-start gap-4">
                    <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl"><Info size={24}/></div>
                    <div>
                        <h4 className="font-bold text-blue-800 dark:text-blue-300">Automatic Rule Engine</h4>
                        <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">Changes to triggers will be applied once you refresh the repository.</p>
                    </div>
                 </div>
                 <button 
                    onClick={handleSyncAll}
                    disabled={isSyncing}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black transition-all disabled:opacity-50 shadow-lg shadow-emerald-600/20 uppercase text-xs tracking-widest"
                 >
                    {isSyncing ? <RefreshCw className="animate-spin" size={18}/> : <RefreshCw size={18}/>}
                    {isSyncing ? 'Syncing...' : 'Refresh Lesson Tags'}
                 </button>
              </div>

              <button onClick={openNewLesson} className="w-full py-10 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-[2.5rem] text-slate-500 hover:border-indigo-500 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all flex flex-col items-center justify-center gap-3">
                 <Plus size={40} />
                 <div className="text-center">
                    <span className="font-black text-xl block tracking-tighter uppercase">Create Rule-Based Topic</span>
                    <span className="text-xs opacity-60 font-medium">Auto-classify questions based on keywords & text</span>
                 </div>
              </button>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {lessons.map(lesson => (
                    <div key={lesson.id} className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm hover:border-indigo-500 transition-all group hover:shadow-xl">
                       <div className="flex justify-between items-start mb-6">
                          <div className="flex items-center gap-3">
                             <div className="p-4 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl"><Target size={32} /></div>
                             <div>
                                <div className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-[10px] font-black uppercase tracking-tighter">
                                   {questions.filter(q => q.topics.includes(lesson.name)).length} Questions
                                </div>
                             </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => openEditLesson(lesson)} className="text-slate-400 hover:text-indigo-500 p-2 transition-colors"><Edit2 size={18}/></button>
                             <button onClick={() => { if(confirm("Delete rule?")) deleteLesson(lesson.id).then(loadData); }} className="text-slate-400 hover:text-red-500 p-2 transition-colors"><Trash2 size={18}/></button>
                          </div>
                       </div>
                       <h3 className="font-black text-2xl mb-2 tracking-tighter">{lesson.name}</h3>
                       <div className="flex flex-wrap gap-1 mt-4">
                          {lesson.triggerKeywords.slice(0, 3).map(k => <span key={k} className="text-[9px] bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-500 font-bold">{k}</span>)}
                          {lesson.triggerKeywords.length > 3 && <span className="text-[9px] text-slate-400">+{lesson.triggerKeywords.length - 3} more</span>}
                       </div>
                    </div>
                 ))}
              </div>
           </div>
         )}

         {activeTab === 'repo' && (
            <div className="animate-fade-in space-y-4">
               <div className="relative mb-8">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
                <input 
                  type="text" 
                  placeholder="Deep search topics, keywords, or OCR text..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-14 pr-6 py-5 bg-white dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-[2rem] outline-none shadow-xl text-xl transition-all placeholder:text-slate-400 font-medium"
                />
              </div>

              {getFilteredQuestions().map(q => {
                 const isExpanded = expandedQuestionId === q.id;
                 return (
                   <div key={q.id} className={`bg-white dark:bg-slate-800 rounded-[2rem] border transition-all overflow-hidden mb-6 ${isExpanded ? 'border-blue-500 shadow-2xl ring-1 ring-blue-500 scale-[1.01]' : 'border-slate-200 dark:border-slate-700 hover:border-blue-400'}`}>
                      <div className="p-7 flex gap-7 items-center cursor-pointer" onClick={() => setExpandedQuestionId(isExpanded ? null : q.id)}>
                        <div className="w-32 h-32 bg-slate-100 dark:bg-slate-900 rounded-[1.5rem] overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0 shadow-inner">
                            <img src={q.parts[0]?.questionImages?.[0] || q.parts[0]?.questionImage} className="max-w-full max-h-full object-contain p-2" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-black text-2xl truncate tracking-tighter text-slate-800 dark:text-white">{q.year} {q.month} • Q{q.questionNumber}</h3>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">{q.paperType} • {q.timezone || 'Global'}</p>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                   <button onClick={(e) => { e.stopPropagation(); if(confirm("Delete question?")) deleteQuestion(q.id).then(loadData); }} className="text-slate-300 hover:text-red-500 p-2.5 transition-colors"><Trash2 size={20}/></button>
                                   <div className={`p-2.5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                       <ChevronDown size={24} className={isExpanded ? "text-blue-500" : "text-slate-300"} />
                                   </div>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                               {q.topics.map(t => <span key={t} className="px-3.5 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] rounded-full border border-blue-200 dark:border-blue-800 font-black uppercase tracking-wider flex items-center gap-1"><Check size={10}/> {t}</span>)}
                               {q.keywords.map(k => <span key={k} className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] rounded-full font-bold">{k}</span>)}
                            </div>
                        </div>
                      </div>
                      
                      {isExpanded && (
                         <div className="p-10 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-700 space-y-16 animate-fade-in shadow-inner">
                            {/* Manage Tags Section */}
                            <div className="bg-white dark:bg-slate-800/50 p-8 rounded-3xl border border-blue-200 dark:border-blue-900 shadow-sm">
                                <div className="flex items-center gap-3 mb-6 text-blue-600 dark:text-blue-400 font-black uppercase text-[11px] tracking-widest">
                                    <Tag size={18}/> Manage Tags & Lessons
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {allPossibleTopics.map(topic => {
                                        const isActive = q.topics.includes(topic);
                                        return (
                                            <button 
                                                key={topic} 
                                                onClick={() => handleTagQuestion(q.id, topic)}
                                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 ${isActive ? 'bg-blue-600 text-white border-blue-500 shadow-lg' : 'bg-slate-100 dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-blue-400'}`}
                                            >
                                                {isActive ? <Check size={14}/> : <Plus size={14}/>}
                                                {topic}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {q.ocrText && (
                                <div className="bg-white dark:bg-slate-800/50 p-8 rounded-3xl border border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center gap-3 mb-4 text-slate-400 font-black uppercase text-[11px] tracking-widest">
                                        <ScanText size={18}/> Extracted Intelligence (OCR)
                                    </div>
                                    <p className="text-base text-slate-600 dark:text-slate-300 italic leading-relaxed whitespace-pre-wrap">{q.ocrText}</p>
                                </div>
                            )}

                            {q.parts.map(p => (
                               <div key={p.id} className="space-y-10">
                                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-5">
                                      <div className="flex items-center gap-5">
                                          <span className="w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-xl shadow-xl">{p.label === 'i' ? 'Q' : p.label}</span>
                                          <div>
                                              <h4 className="font-black text-slate-800 dark:text-white uppercase tracking-tighter text-xl">Question Section</h4>
                                              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">Detailed Fragment Breakdown</p>
                                          </div>
                                      </div>
                                  </div>
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                     <div className="space-y-6">
                                         <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-3 px-1"><FileQuestion size={18}/> Question View</p>
                                         <div className="space-y-8 bg-white dark:bg-slate-800/80 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-2xl">
                                            {(p.questionImages || (p.questionImage ? [p.questionImage] : [])).map((img, i) => <img key={i} src={img} className="w-full rounded-2xl bg-white p-2 border border-slate-100 dark:border-slate-700 shadow-sm" />)}
                                         </div>
                                     </div>
                                     <div className="space-y-6">
                                         <p className="text-[11px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-3 px-1"><Check size={18}/> Official Solution Key</p>
                                         <div className="space-y-8 bg-white dark:bg-slate-800/80 p-8 rounded-[2.5rem] border border-emerald-500/10 shadow-2xl">
                                            {p.answerText && (
                                                <div className="flex flex-col items-center justify-center py-10 bg-emerald-500/5 rounded-3xl border-2 border-dashed border-emerald-500/20 mb-8">
                                                    <span className="text-xs font-black text-emerald-500 mb-2 uppercase tracking-widest">Final Key</span>
                                                    <div className="text-7xl font-black text-emerald-600 dark:text-emerald-400 tracking-tighter">{p.answerText}</div>
                                                </div>
                                            )}
                                            {(p.answerImages || (p.answerImage ? [p.answerImage] : [])).map((img, i) => <img key={i} src={img} className="w-full rounded-2xl bg-white p-2 border border-slate-100 dark:border-slate-700 shadow-sm" />)}
                                         </div>
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
           <div className="animate-fade-in grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <button onClick={openNewFolder} className="p-10 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-[2.5rem] text-slate-500 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all flex flex-col items-center justify-center gap-4">
                 <Plus size={48} />
                 <span className="font-black text-lg uppercase tracking-widest">New Smart Folder</span>
              </button>
              {folders.map(folder => (
                <div key={folder.id} className="bg-white dark:bg-slate-800 p-10 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm relative group hover:shadow-2xl transition-all">
                    <div className="flex justify-between items-start mb-8">
                        <div className={`p-5 rounded-3xl ${folder.filterUncategorized ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                            {folder.filterUncategorized ? <AlertCircle size={32} /> : <FolderIcon size={32} />}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => openEditFolder(folder)} className="text-slate-400 hover:text-blue-500 p-2.5 transition-colors"><Edit2 size={20}/></button>
                           <button onClick={() => { if(confirm("Delete folder?")) deleteFolder(folder.id).then(loadData); }} className="text-slate-400 hover:text-red-500 p-2.5 transition-colors"><Trash2 size={20}/></button>
                        </div>
                    </div>
                    <h3 className="font-black text-3xl mb-3 tracking-tighter">{folder.name}</h3>
                    <p className="text-slate-500 font-medium text-sm mb-8">{getFilteredQuestions(folder).length} Questions Indexed</p>
                    <button onClick={() => navigate(`/study/${folder.id}`)} className="w-full py-4 bg-slate-900 dark:bg-slate-700 hover:bg-blue-600 text-white rounded-2xl font-black transition-all flex items-center justify-center gap-3 uppercase text-xs tracking-[0.2em]">
                        <Play size={20} fill="currentColor" /> Study Now
                    </button>
                </div>
              ))}
           </div>
         )}
      </div>

      {/* Lesson Modal */}
      {showLessonModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-md">
           <div className="bg-white dark:bg-slate-800 w-full max-w-3xl rounded-[2.5rem] p-10 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700 shadow-2xl animate-slide-up">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-3xl font-black tracking-tighter uppercase">{editingLessonId ? 'Edit Rule' : 'Rule Builder'}</h2>
                <button onClick={() => setShowLessonModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"><X size={24}/></button>
              </div>
              
              <div className="space-y-10">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Topic Display Name</label>
                  <input value={lessonName} onChange={e => setLessonName(e.target.value)} className="w-full bg-slate-100 dark:bg-slate-900 border-2 border-transparent focus:border-blue-500 p-5 rounded-2xl outline-none font-bold text-lg transition-all" placeholder="e.g. Organic Chemistry" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Keyword Triggers</label>
                        <div className="flex gap-2">
                            <input value={keywordInput} onChange={e => setKeywordInput(e.target.value)} onKeyDown={e => { if(e.key==='Enter') { setLessonKeywords([...lessonKeywords, keywordInput]); setKeywordInput(""); } }} className="flex-1 bg-slate-100 dark:bg-slate-900 p-4 rounded-xl border-none outline-none font-bold text-sm" placeholder="Add word..." />
                            <button onClick={() => { if(keywordInput.trim()){ setLessonKeywords([...lessonKeywords, keywordInput.trim()]); setKeywordInput(""); } }} className="p-4 bg-blue-600 text-white rounded-xl"><Plus size={18}/></button>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2">
                           {lessonKeywords.map((k, i) => <span key={i} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-lg text-xs font-bold flex items-center gap-2">{k} <button onClick={() => setLessonKeywords(lessonKeywords.filter((_, idx) => idx !== i))}><X size={12}/></button></span>)}
                        </div>
                    </div>
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">OCR Phrase Triggers</label>
                        <div className="flex gap-2">
                            <input value={phraseInput} onChange={e => setPhraseInput(e.target.value)} onKeyDown={e => { if(e.key==='Enter') { setLessonOcrPhrases([...lessonOcrPhrases, phraseInput]); setPhraseInput(""); } }} className="flex-1 bg-slate-100 dark:bg-slate-900 p-4 rounded-xl border-none outline-none font-bold text-sm" placeholder="Add phrase..." />
                            <button onClick={() => { if(phraseInput.trim()){ setLessonOcrPhrases([...lessonOcrPhrases, phraseInput.trim()]); setPhraseInput(""); } }} className="p-4 bg-blue-600 text-white rounded-xl"><Plus size={18}/></button>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2">
                           {lessonOcrPhrases.map((p, i) => <span key={i} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-lg text-xs font-bold flex items-center gap-2">{p} <button onClick={() => setLessonOcrPhrases(lessonOcrPhrases.filter((_, idx) => idx !== i))}><X size={12}/></button></span>)}
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">AI Context / Lesson Transcript</label>
                    <textarea value={lessonTranscript} onChange={e => setLessonTranscript(e.target.value)} className="w-full h-40 bg-slate-100 dark:bg-slate-900 p-5 rounded-2xl border-none outline-none font-medium text-sm leading-relaxed" placeholder="Paste your lesson notes or transcript here. AI will use this to generate better triggers..." />
                </div>
              </div>

              <div className="flex gap-4 mt-12">
                 <button onClick={() => setShowLessonModal(false)} className="flex-1 py-5 text-slate-500 font-black uppercase tracking-widest text-xs hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl transition-all">Cancel</button>
                 <button onClick={handleSaveLesson} className="flex-1 py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-600/20 hover:bg-blue-500 transition-all">Save & Sync</button>
              </div>
           </div>
        </div>
      )}

      {/* Magic Rules Modal */}
      {showMagicModal && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-md">
                <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[2.5rem] p-10 animate-slide-up border border-indigo-200 dark:border-indigo-800 shadow-2xl">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="p-3 bg-indigo-600 text-white rounded-2xl"><Zap size={28}/></div>
                        <h2 className="text-3xl font-black tracking-tighter uppercase">Magic Triggers</h2>
                    </div>
                    
                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed">
                        Select a topic that has a transcript attached. AI will analyze the text to find the most relevant academic keywords and phrases.
                    </p>

                    <div className="space-y-8">
                        <select 
                            value={magicLessonId} 
                            onChange={e => setMagicLessonId(e.target.value)} 
                            className="w-full p-5 rounded-2xl bg-slate-100 dark:bg-slate-900 border-2 border-transparent focus:border-indigo-500 outline-none font-bold"
                        >
                            <option value="">Select Topic...</option>
                            {lessons.filter(l => l.referenceText).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>

                        {isMagicRunning ? (
                            <div className="text-center py-10 space-y-4 animate-pulse">
                                <RefreshCw className="animate-spin mx-auto text-indigo-500" size={56} />
                                <p className="text-indigo-500 font-black uppercase text-[10px] tracking-widest">Analyzing Lesson Context...</p>
                            </div>
                        ) : magicResult ? (
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border border-indigo-100 dark:border-indigo-800 space-y-4 animate-fade-in">
                                <h4 className="font-black uppercase text-xs text-indigo-500 tracking-widest">AI Generated Suggestions</h4>
                                <div className="flex flex-wrap gap-2">
                                    {magicResult.triggerKeywords.map(k => <span key={k} className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold rounded-lg border border-indigo-200 dark:border-indigo-800">+{k}</span>)}
                                </div>
                                <button onClick={applyMagicResult} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs tracking-widest mt-4">Apply All Triggers</button>
                            </div>
                        ) : (
                            <div className="flex gap-4">
                                <button onClick={() => setShowMagicModal(false)} className="flex-1 py-5 rounded-2xl bg-slate-100 dark:bg-slate-700 font-black uppercase text-xs tracking-widest text-slate-500 transition-colors">Close</button>
                                <button onClick={handleMagicAnalyze} disabled={!magicLessonId} className="flex-1 py-5 rounded-2xl bg-indigo-600 text-white font-black uppercase text-xs tracking-widest disabled:opacity-50 shadow-xl shadow-indigo-600/20 transition-all">Generate Triggers</button>
                            </div>
                        )}
                    </div>
                </div>
          </div>
      )}

      {/* Smart Folder Modal (NOW WITH TOPIC FILTERING) */}
      {showFolderModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
             <div className="bg-white dark:bg-slate-800 w-full max-w-xl rounded-[2.5rem] p-10 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-y-auto max-h-[90vh]">
                <h2 className="text-2xl font-black mb-10 uppercase tracking-tighter">{editingFolderId ? 'Edit Smart Folder' : 'New Smart Folder'}</h2>
                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Folder Name</label>
                    <input type="text" value={folderName} onChange={e => setFolderName(e.target.value)} className="w-full bg-slate-100 dark:bg-slate-900 border-2 border-transparent focus:border-blue-500 p-5 rounded-2xl outline-none font-bold transition-all" placeholder="e.g. Unit 3 Revision" />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Filter by Topics</label>
                    <div className="flex flex-wrap gap-2 p-4 bg-slate-100 dark:bg-slate-900 rounded-2xl min-h-[100px] border border-slate-200 dark:border-slate-800">
                        {allPossibleTopics.length === 0 ? (
                            <span className="text-xs text-slate-500 italic">No topics created yet. Add rules first.</span>
                        ) : (
                            allPossibleTopics.map(topic => {
                                const isSelected = selectedTopicsForFolder.includes(topic);
                                return (
                                    <button 
                                        key={topic}
                                        onClick={() => {
                                            if(isSelected) setSelectedTopicsForFolder(selectedTopicsForFolder.filter(t => t !== topic));
                                            else setSelectedTopicsForFolder([...selectedTopicsForFolder, topic]);
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${isSelected ? 'bg-blue-600 text-white border-blue-500' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'}`}
                                    >
                                        {topic}
                                    </button>
                                );
                            })
                        )}
                    </div>
                    <p className="text-[9px] text-slate-400 px-1 font-medium italic">If no topics are selected, all questions in the subject will be included.</p>
                  </div>

                  <div className="flex items-center gap-5 p-6 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700 cursor-pointer" onClick={() => setFilterUncategorized(!filterUncategorized)}>
                      <input type="checkbox" checked={filterUncategorized} onChange={e => setFilterUncategorized(e.target.checked)} className="w-6 h-6 rounded accent-blue-600" />
                      <div>
                          <label className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">Uncategorized Filter</label>
                          <p className="text-[10px] text-slate-400 font-bold">Override topics: Only show questions with 0 applied tags</p>
                      </div>
                  </div>
                </div>
                <div className="flex gap-4 mt-12">
                   <button onClick={() => setShowFolderModal(false)} className="flex-1 py-5 text-slate-500 font-black uppercase tracking-widest text-xs hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl transition-all">Cancel</button>
                   <button onClick={handleSaveFolder} className="flex-1 py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-600/20 hover:bg-blue-500 transition-all">Save Folder</button>
                </div>
             </div>
          </div>
      )}
    </div>
  );
};

export default SubjectDashboard;
