
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
  updateQuestionMetadata, 
  getLessonsBySubject,
  saveLesson,
  deleteLesson,
  reprocessSubjectMapping
} from '../services/db';
import { extractTriggersLocally, simulateNlpProcessing, MagicAnalysisResult } from '../services/nlp';
import { 
  ArrowLeft, Plus, Folder as FolderIcon, Database, Search, 
  Trash2, Play, Download, ChevronDown, ChevronUp, Edit2, 
  Check, X, Wand2, Sparkles, BookOpen, Settings2, Loader2, Info,
  Cpu, Zap, BarChart3, Binary, Filter, Target, ScanText, AlertCircle
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
  
  // Modal Visibility State
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showLessonModal, setShowLessonModal] = useState(false);
  
  // Editing State
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);

  // Folder Form State
  const [folderName, setFolderName] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  
  // Lesson Form State
  const [lessonName, setLessonName] = useState("");
  const [lessonKeywords, setLessonKeywords] = useState<string[]>([]);
  const [lessonOcrPhrases, setLessonOcrPhrases] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [phraseInput, setPhraseInput] = useState("");
  const [lessonTranscript, setLessonTranscript] = useState("");

  // Magic Tag State
  const [showMagicModal, setShowMagicModal] = useState(false);
  const [isMagicRunning, setIsMagicRunning] = useState(false);
  const [magicStep, setMagicStep] = useState(0);
  const [magicLessonId, setMagicLessonId] = useState("");
  const [magicResult, setMagicResult] = useState<MagicAnalysisResult | null>(null);

  // Metadata
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

  // --- Lesson Handlers ---

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

  const handleDeleteLesson = async (id: string) => {
    if (confirm("Delete this Topic definition? Questions already tagged will keep their tags, but no new questions will be auto-tagged.")) {
      await deleteLesson(id);
      loadData();
    }
  };

  // --- Folder Handlers ---

  const openNewFolder = () => {
    setEditingFolderId(null);
    setFolderName("");
    setSelectedTags([]);
    setSelectedTopics([]);
    setShowFolderModal(true);
  };

  const openEditFolder = (f: Folder) => {
    setEditingFolderId(f.id);
    setFolderName(f.name);
    setSelectedTags(f.filterKeywords || []);
    setSelectedTopics(f.filterTopics || []);
    setShowFolderModal(true);
  };

  const handleSaveFolder = async () => {
    if (!folderName.trim()) return;
    const folder: Folder = {
      id: editingFolderId || Date.now().toString(),
      name: folderName,
      subject: subject,
      filterKeywords: selectedTags,
      filterTopics: selectedTopics
    };
    await saveFolder(folder);
    setShowFolderModal(false);
    loadData();
  };

  // --- Magic Analysis ---

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

  // Combine topics already on questions with defined lesson names to ensure nothing is missed
  const allPossibleTopics = useMemo(() => {
    const lessonNames = lessons.map(l => l.name);
    const uniqueTags = availableTopics;
    return Array.from(new Set([...lessonNames, ...uniqueTags])).sort();
  }, [lessons, availableTopics]);

  const getFilteredQuestions = (folder?: Folder) => {
    let qs = questions;
    if (folder) {
      qs = qs.filter(q => {
        const matchesKeyword = folder.filterKeywords.length === 0 || folder.filterKeywords.some(k => (q.keywords || []).includes(k));
        const matchesTopic = folder.filterTopics.length === 0 || folder.filterTopics.some(t => (q.topics || []).includes(t));
        return matchesKeyword && matchesTopic;
      });
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
              <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 p-4 rounded-xl flex items-start gap-4 mb-4">
                 <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg"><Info size={20}/></div>
                 <div>
                    <h4 className="font-bold text-blue-800 dark:text-blue-300">How Rule-Based Tagging Works</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">When you define a Topic (e.g., "A.1"), you set rules. If a new question matches your keywords OR your OCR phrases, it will automatically be tagged with that Topic.</p>
                 </div>
              </div>

              <button 
                onClick={openNewLesson}
                className="w-full py-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-slate-500 hover:border-indigo-500 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all flex flex-col items-center justify-center gap-3"
              >
                 <Plus size={32} />
                 <div className="text-center">
                    <span className="font-bold text-lg block">Create Rule-Based Topic</span>
                    <span className="text-xs opacity-60">Define automatic classification logic for your questions</span>
                 </div>
              </button>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {lessons.map(lesson => (
                    <div key={lesson.id} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:border-indigo-500 transition-colors relative overflow-hidden group">
                       <div className="flex justify-between items-start mb-6">
                          <div className="flex items-center gap-3">
                             <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl"><Target size={24} /></div>
                             <div className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-xs font-black">
                                {getLessonCount(lesson.name)} Questions
                             </div>
                          </div>
                          <div className="flex gap-1">
                             <button onClick={() => openEditLesson(lesson)} className="text-slate-300 hover:text-indigo-500 p-2 transition-colors"><Edit2 size={18}/></button>
                             <button onClick={() => handleDeleteLesson(lesson.id)} className="text-slate-300 hover:text-red-500 p-2 transition-colors"><Trash2 size={18}/></button>
                          </div>
                       </div>
                       
                       <h3 className="font-bold text-xl mb-6">{lesson.name}</h3>
                       
                       <div className="space-y-4">
                          <div>
                             <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest block mb-2 flex items-center gap-1"><Zap size={10}/> Keyword Triggers</span>
                             <div className="flex flex-wrap gap-1.5 min-h-[30px]">
                                {lesson.triggerKeywords?.map(k => <span key={k} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] rounded-lg border border-slate-200 dark:border-slate-600">{k}</span>)}
                                {(!lesson.triggerKeywords || lesson.triggerKeywords.length === 0) && <span className="text-xs text-slate-400 italic">None defined</span>}
                             </div>
                          </div>
                          <div>
                             <span className="text-[10px] font-bold text-purple-500 uppercase tracking-widest block mb-2 flex items-center gap-1"><ScanText size={10}/> OCR Phrase Triggers</span>
                             <div className="flex flex-wrap gap-1.5 min-h-[30px]">
                                {lesson.triggerOcrPhrases?.map(p => <span key={p} className="px-2 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 text-[10px] rounded-lg border border-purple-100 dark:border-purple-800 italic">"{p}"</span>)}
                                {(!lesson.triggerOcrPhrases || lesson.triggerOcrPhrases.length === 0) && <span className="text-xs text-slate-400 italic">None defined</span>}
                             </div>
                          </div>
                       </div>
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
                        <div className="w-24 h-24 bg-slate-100 dark:bg-slate-900 rounded-xl flex-shrink-0 overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                            <img src={q.parts[0]?.questionImages?.[0] || q.parts[0]?.questionImage} className="max-w-full max-h-full object-contain" />
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-lg">{q.year} {q.month} - Q{q.questionNumber}</h3>
                                <button onClick={(e) => { e.stopPropagation(); if(confirm("Delete question?")) deleteQuestion(q.id).then(loadData); }} className="text-slate-300 hover:text-red-500 transition-colors p-2"><Trash2 size={18}/></button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                               {q.topics.map(t => <span key={t} className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] rounded-full border border-blue-200 dark:border-blue-800 font-black uppercase tracking-wider flex items-center gap-1"><Check size={10}/> {t}</span>)}
                               {q.keywords.map(k => <span key={k} className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] rounded-full font-bold">{k}</span>)}
                            </div>
                        </div>
                      </div>
                      {isExpanded && (
                         <div className="p-8 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 space-y-6 animate-fade-in">
                            {q.parts.map(p => (
                               <div key={p.id} className="space-y-3">
                                  <div className="flex items-center gap-2 mb-2">
                                      <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs uppercase">{p.label}</span>
                                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Question Segment</span>
                                  </div>
                                  {(p.questionImages || [p.questionImage]).filter(Boolean).map((img, i) => <img key={i} src={img} className="max-w-full rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm" />)}
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
                        <div className="p-4 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl"><FolderIcon size={28} /></div>
                        <div className="flex gap-1">
                           <button onClick={() => openEditFolder(folder)} className="text-slate-300 hover:text-blue-500 p-2"><Edit2 size={18}/></button>
                           <button onClick={() => deleteFolder(folder.id).then(loadData)} className="text-slate-300 hover:text-red-500 p-2"><Trash2 size={18}/></button>
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

      {/* Lesson Builder Modal */}
      {showLessonModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-md">
           <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl p-8 animate-slide-up border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-4 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl"><Target size={28} /></div>
                <div>
                   <h2 className="text-3xl font-bold">{editingLessonId ? 'Edit Smart Topic' : 'New Smart Topic'}</h2>
                   <p className="text-sm text-slate-500">Define the logic for automatic categorization.</p>
                </div>
              </div>
              
              <div className="space-y-8">
                <div>
                  <label className="block text-[10px] font-bold mb-2 text-slate-400 uppercase tracking-[0.2em]">Topic Name (e.g. A.1 Structure)</label>
                  <input type="text" value={lessonName} onChange={e => setLessonName(e.target.value)} className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-lg font-medium focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" placeholder="Enter topic code or name..." />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Keyword Rules */}
                    <div>
                        <label className="block text-[10px] font-bold mb-2 text-indigo-500 uppercase tracking-widest flex items-center gap-2"><Zap size={14}/> Trigger Keywords</label>
                        <p className="text-xs text-slate-500 mb-3 leading-relaxed">Questions with these manual tags will be auto-linked.</p>
                        <div className="flex gap-2 mb-3">
                            <input 
                              type="text" 
                              value={keywordInput}
                              onChange={e => setKeywordInput(e.target.value)}
                              onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); if(keywordInput.trim()) setLessonKeywords([...lessonKeywords, keywordInput.trim()]); setKeywordInput(""); } }}
                              className="flex-1 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                              placeholder="Add keyword..." 
                            />
                        </div>
                        <div className="flex flex-wrap gap-2 min-h-[40px]">
                            {lessonKeywords.map(k => <span key={k} className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-lg border border-indigo-100 dark:border-indigo-800 flex items-center gap-1">{k} <button onClick={() => setLessonKeywords(lessonKeywords.filter(tk => tk !== k))}><X size={12}/></button></span>)}
                        </div>
                    </div>

                    {/* OCR Phrase Rules */}
                    <div>
                        <label className="block text-[10px] font-bold mb-2 text-purple-500 uppercase tracking-widest flex items-center gap-2"><ScanText size={14}/> OCR Triggers</label>
                        <p className="text-xs text-slate-500 mb-3 leading-relaxed">Automatic detection if these phrases appear in the question text.</p>
                        <div className="flex gap-2 mb-3">
                            <input 
                              type="text" 
                              value={phraseInput}
                              onChange={e => setPhraseInput(e.target.value)}
                              onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); if(phraseInput.trim()) setLessonOcrPhrases([...lessonOcrPhrases, phraseInput.trim()]); setPhraseInput(""); } }}
                              className="flex-1 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none" 
                              placeholder="Add specific phrase..." 
                            />
                        </div>
                        <div className="flex flex-wrap gap-2 min-h-[40px]">
                            {lessonOcrPhrases.map(p => <span key={p} className="px-3 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 text-xs font-bold italic rounded-lg border border-purple-100 dark:border-purple-800 flex items-center gap-1">"{p}" <button onClick={() => setLessonOcrPhrases(lessonOcrPhrases.filter(tp => tp !== p))}><X size={12}/></button></span>)}
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                  <label className="block text-[10px] font-bold mb-2 text-slate-400 uppercase tracking-widest flex items-center gap-2"><BookOpen size={14}/> Context for AI Analysis (Optional)</label>
                  <textarea value={lessonTranscript} onChange={e => setLessonTranscript(e.target.value)} className="w-full h-32 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all" placeholder="Paste lesson notes here. Use 'Magic Rules' later to discover triggers from this text..." />
                </div>
              </div>

              <div className="flex gap-4 mt-12">
                 <button onClick={() => setShowLessonModal(false)} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl transition-colors">Cancel</button>
                 <button onClick={handleSaveLesson} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-500 font-bold shadow-2xl shadow-indigo-600/20 border border-indigo-400">Save & Apply Rules</button>
              </div>
           </div>
        </div>
      )}

      {/* Smart Folder Modal */}
      {showFolderModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl shadow-2xl p-8 animate-slide-up border border-slate-200 dark:border-slate-700">
              <h2 className="text-2xl font-bold mb-6">{editingFolderId ? 'Edit Smart Folder' : 'Create Smart Folder'}</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Folder Display Name</label>
                  <input type="text" value={folderName} onChange={e => setFolderName(e.target.value)} className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 outline-none font-bold" placeholder="e.g. Exam Prep - Unit 1" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-3">Filter by Topics</label>
                  <div className="flex flex-wrap gap-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700 max-h-40 overflow-y-auto shadow-inner">
                    {allPossibleTopics.map(t => (
                        <button key={t} onClick={() => { if(selectedTopics.includes(t)) setSelectedTopics(selectedTopics.filter(st => st !== t)); else setSelectedTopics([...selectedTopics, t]); }} className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${selectedTopics.includes(t) ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600'}`}>
                            {t}
                        </button>
                    ))}
                    {allPossibleTopics.length === 0 && <p className="text-xs text-slate-400 p-2 text-center w-full">No topics defined yet. Create a Rule-Based Topic first!</p>}
                  </div>
                </div>
              </div>
              <div className="flex gap-4 mt-10">
                 <button onClick={() => setShowFolderModal(false)} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl transition-colors">Cancel</button>
                 <button onClick={handleSaveFolder} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-600/20 border border-blue-500">Save Folder</button>
              </div>
           </div>
        </div>
      )}

      {/* Magic Rules Analyzer Modal */}
      {showMagicModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-md">
              <div className="bg-white dark:bg-slate-800 w-full max-w-xl rounded-3xl shadow-2xl p-8 animate-slide-up border border-indigo-200 dark:indigo-800 overflow-hidden">
                  <div className="flex items-center gap-4 mb-8">
                      <div className="p-4 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl shadow-inner"><Cpu size={28} /></div>
                      <div>
                          <h2 className="text-2xl font-bold">AI Rule Generator</h2>
                          <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black">Local Lexical Engine v3.0</p>
                      </div>
                  </div>
                  
                  {!magicResult ? (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-[10px] font-bold mb-3 text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Select Target Topic</label>
                            <select 
                                value={magicLessonId} 
                                onChange={e => setMagicLessonId(e.target.value)} 
                                className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                            >
                                <option value="">Select a Topic to optimize...</option>
                                {lessons.filter(l => l.referenceText).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                            {lessons.filter(l => l.referenceText).length === 0 && (
                                <p className="text-xs text-red-500 mt-3 font-bold flex items-center gap-2 bg-red-50 dark:bg-red-900/10 p-3 rounded-lg"><AlertCircle size={14}/> No topics have notes/transcripts to analyze.</p>
                            )}
                        </div>

                        {isMagicRunning ? (
                            <div className="p-10 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-indigo-100 dark:border-indigo-900 flex flex-col items-center justify-center gap-6">
                                <div className="flex gap-4">
                                    <BarChart3 className={`text-indigo-500 ${magicStep >= 1 ? 'animate-bounce' : 'opacity-20'}`} size={32} />
                                    <Binary className={`text-indigo-500 ${magicStep >= 2 ? 'animate-pulse' : 'opacity-20'}`} size={32} />
                                    <Cpu className={`text-indigo-500 ${magicStep >= 3 ? 'animate-spin' : 'opacity-20'}`} size={32} />
                                </div>
                                <div className="text-center">
                                    <p className="font-mono text-xs font-black text-indigo-400 tracking-[0.3em]">
                                        {magicStep === 1 && "SCANNING LEXICAL NODES"}
                                        {magicStep === 2 && "PROBABILISTIC CLUSTERING"}
                                        {magicStep === 3 && "SYNTACTIC TRIGGER MAPPING"}
                                    </p>
                                    <div className="w-64 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mt-5 overflow-hidden">
                                        <div className="h-full bg-indigo-500 transition-all duration-700" style={{ width: `${(magicStep/3)*100}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <p className="text-sm text-slate-500 leading-relaxed italic">
                                    The AI Rules engine will scan your transcript to propose the best trigger keywords and OCR phrases. Applying these will automatically update your Topic logic and re-tag your entire repository.
                                </p>
                            </div>
                        )}

                        <div className="flex gap-4 mt-8">
                            <button onClick={() => setShowMagicModal(false)} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl transition-colors">Close</button>
                            <button onClick={handleMagicAnalyze} disabled={isMagicRunning || !magicLessonId} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-500 font-bold shadow-2xl shadow-indigo-600/30 disabled:opacity-30 flex items-center justify-center gap-2">
                                {isMagicRunning ? "Analyzing..." : "Analyze Transcript"}
                            </button>
                        </div>
                    </div>
                  ) : (
                    <div className="space-y-8 animate-fade-in">
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-500/30 rounded-2xl flex justify-between items-center">
                            <div>
                                <h3 className="text-emerald-700 dark:text-emerald-400 font-black text-xs uppercase tracking-widest">Proposed Logic Vectors</h3>
                                <p className="text-[10px] text-emerald-600/70 font-mono">Confidence Coefficient: {(magicResult.confidence * 100).toFixed(1)}%</p>
                            </div>
                            <Check className="text-emerald-500" size={24}/>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-3">Proposed Keywords</label>
                            <div className="flex flex-wrap gap-2">
                                {magicResult.triggerKeywords.map(k => <span key={k} className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs rounded-lg font-bold">{k}</span>)}
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-purple-500 uppercase tracking-widest mb-3">Proposed OCR Triggers</label>
                            <div className="flex flex-wrap gap-2">
                                {magicResult.triggerOcrPhrases.map(p => <span key={p} className="px-3 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 text-xs rounded-lg font-bold italic">"{p}"</span>)}
                            </div>
                        </div>

                        <div className="flex gap-4 mt-8">
                            <button onClick={() => setMagicResult(null)} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl transition-colors">Re-run</button>
                            <button onClick={applyMagicResult} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-500 font-bold shadow-2xl shadow-indigo-600/40">Apply & Re-Sync Repo</button>
                        </div>
                    </div>
                  )}
              </div>
          </div>
      )}

      <datalist id="all-keywords">
          {availableKeywords.map(k => <option key={k} value={k} />)}
      </datalist>
      <datalist id="all-topics">
          {availableTopics.map(t => <option key={t} value={t} />)}
      </datalist>
    </div>
  );
};

export default SubjectDashboard;
