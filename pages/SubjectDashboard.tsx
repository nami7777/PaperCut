
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Folder, QuestionEntry } from '../types';
import { getQuestionsBySubject, getFoldersBySubject, saveFolder, deleteQuestion, deleteFolder, getAllUniqueKeywords, getAllUniqueTopics } from '../services/db';
import { ArrowLeft, Plus, Folder as FolderIcon, Database, Search, Tag, Trash2, Play, Download, ChevronDown, ChevronUp, Eye } from 'lucide-react';

const SubjectDashboard: React.FC = () => {
  const { subjectId } = useParams<{subjectId: string}>();
  const subject = decodeURIComponent(subjectId || '');
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'repo' | 'folders'>('repo');
  const [questions, setQuestions] = useState<QuestionEntry[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  // New Folder State
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  
  // Autocomplete data
  const [availableKeywords, setAvailableKeywords] = useState<string[]>([]);
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);

  // Expandable Question Card State
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  useEffect(() => {
    if (!subject) {
        navigate('/');
        return;
    }
    loadData();
    loadMetadata();
  }, [subject]);

  const loadData = async () => {
    const qs = await getQuestionsBySubject(subject);
    setQuestions(qs);
    const fs = await getFoldersBySubject(subject);
    setFolders(fs);
  };

  const loadMetadata = async () => {
    const kw = await getAllUniqueKeywords(subject);
    const tp = await getAllUniqueTopics(subject);
    setAvailableKeywords(kw);
    setAvailableTopics(tp);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    
    const folder: Folder = {
      id: Date.now().toString(),
      name: newFolderName,
      subject: subject,
      filterKeywords: selectedTags,
      filterTopics: selectedTopics
    };

    await saveFolder(folder);
    setShowNewFolderModal(false);
    setNewFolderName("");
    setSelectedTags([]);
    setSelectedTopics([]);
    loadData();
  };

  const toggleSelection = (item: string, list: string[], setList: (l: string[]) => void) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  // Strong Search Logic
  const getFilteredQuestions = (folder?: Folder) => {
    let qs = questions;
    if (folder) {
      qs = qs.filter(q => {
        const matchesKeyword = folder.filterKeywords.length === 0 || folder.filterKeywords.some(k => q.keywords.includes(k));
        const matchesTopic = folder.filterTopics.length === 0 || folder.filterTopics.some(t => q.topics.includes(t));
        return matchesKeyword && matchesTopic;
      });
    }
    
    // Enhanced Search bar filter (OCR enabled)
    if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        qs = qs.filter(q => 
            q.subject.toLowerCase().includes(term) ||
            q.keywords.some(k => k.toLowerCase().includes(term)) ||
            q.topics.some(t => t.toLowerCase().includes(term)) ||
            q.year.toString().includes(term) ||
            q.month.toLowerCase().includes(term) ||
            (q.ocrText && q.ocrText.toLowerCase().includes(term)) // Check OCR text
        );
    }
    return qs;
  };

  const handleDeleteQ = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if(confirm("Delete question?")) {
          await deleteQuestion(id);
          loadData();
      }
  };

  const handleDeleteFolder = async (id: string) => {
    if(confirm("Delete folder?")) {
        await deleteFolder(id);
        loadData();
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
               <h1 className="text-2xl font-bold">{subject}</h1>
               <p className="text-xs text-slate-500 dark:text-slate-400">{questions.length} Questions • {folders.length} Folders</p>
            </div>
          </div>
          
          <div className="flex gap-2">
             <button onClick={() => navigate('/export', { state: { subject } })} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors">
                <Download size={16} /> Export
             </button>
             <button onClick={() => navigate('/new', { state: { subject } })} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-md shadow-blue-500/20">
                <Plus size={16} /> Log Exam
             </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
         {/* Tabs */}
         <div className="flex mb-6 bg-slate-200 dark:bg-slate-800 p-1 rounded-lg inline-flex">
           <button 
             onClick={() => setActiveTab('repo')}
             className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'repo' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
           >
             <Database size={16} className="inline mr-2" /> Repository
           </button>
           <button 
             onClick={() => setActiveTab('folders')}
             className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'folders' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
           >
             <FolderIcon size={16} className="inline mr-2" /> Folders
           </button>
         </div>

         {/* Filter Bar for Repository */}
         {activeTab === 'repo' && (
           <div className="mb-6 relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
             <input 
               type="text" 
               placeholder="Search text in images, topics, year..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
             />
           </div>
         )}

         {/* Content */}
         {activeTab === 'repo' ? (
           <div className="grid grid-cols-1 gap-4">
             {getFilteredQuestions().map(q => {
               const isExpanded = expandedQuestionId === q.id;
               
               return (
               <div 
                key={q.id} 
                onClick={() => setExpandedQuestionId(isExpanded ? null : q.id)}
                className={`bg-white dark:bg-slate-800 rounded-xl border transition-all cursor-pointer overflow-hidden
                    ${isExpanded ? 'border-blue-500 shadow-lg ring-1 ring-blue-500' : 'border-slate-200 dark:border-slate-700 hover:border-blue-400'}
                `}
               >
                 {/* Header Summary */}
                 <div className="p-4 flex gap-4">
                    <div className="w-24 h-24 bg-slate-100 dark:bg-slate-900 rounded-lg flex-shrink-0 overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                        <img src={q.parts[0]?.questionImages?.[0] || q.parts[0]?.questionImage} className="max-w-full max-h-full object-contain" alt="preview"/>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-lg truncate">{q.year} {q.month} - {q.paperType}</h3>
                                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                                    <span>Q{q.questionNumber}</span>
                                </div>
                            </div>
                            <button onClick={(e) => handleDeleteQ(e, q.id)} className="text-slate-400 hover:text-red-500 p-2"><Trash2 size={18}/></button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                            {q.keywords.map(k => <span key={k} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-xs rounded text-slate-600 dark:text-slate-300">{k}</span>)}
                            {q.topics.map(t => <span key={t} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-xs rounded text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-blue-800">{t}</span>)}
                        </div>
                    </div>
                    <div className="flex items-center px-2 text-slate-400">
                        {isExpanded ? <ChevronUp /> : <ChevronDown />}
                    </div>
                 </div>

                 {/* Expanded Content */}
                 {isExpanded && (
                     <div className="bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 p-6 animate-fade-in cursor-default" onClick={e => e.stopPropagation()}>
                         <div className="space-y-8">
                             {q.parts.map((part, idx) => (
                                 <div key={part.id} className="space-y-4">
                                     <h4 className="font-bold text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wider">Part {part.label}</h4>
                                     
                                     <div className="space-y-2">
                                        <p className="text-xs font-semibold text-blue-500">Question</p>
                                        {/* Images */}
                                        {part.questionImage && <img src={part.questionImage} className="max-w-full rounded border border-slate-200 dark:border-slate-700" />}
                                        {part.questionImages?.map((img, i) => (
                                            <img key={i} src={img} className="max-w-full rounded border border-slate-200 dark:border-slate-700" />
                                        ))}
                                     </div>

                                     <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                                         <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-500 mb-2">Answer</p>
                                         {part.answerText && <div className="font-bold text-xl text-slate-800 dark:text-slate-200 mb-2">{part.answerText}</div>}
                                         {part.answerImage && <img src={part.answerImage} className="max-w-full rounded mix-blend-multiply dark:mix-blend-normal" />}
                                         {part.answerImages?.map((img, i) => (
                                            <img key={i} src={img} className="max-w-full rounded mix-blend-multiply dark:mix-blend-normal" />
                                         ))}
                                     </div>
                                 </div>
                             ))}
                         </div>
                     </div>
                 )}
               </div>
               );
             })}
             {getFilteredQuestions().length === 0 && (
               <div className="text-center py-12 text-slate-500">
                   <p>No questions found matching your criteria.</p>
                   {searchTerm && <p className="text-xs mt-2 opacity-70">Searched for: "{searchTerm}"</p>}
               </div>
             )}
           </div>
         ) : (
           <div>
              <button 
                onClick={() => setShowNewFolderModal(true)}
                className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-500 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2 mb-6"
              >
                 <Plus size={20} /> Create New Smart Folder
              </button>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {folders.map(folder => {
                   const count = getFilteredQuestions(folder).length;
                   return (
                     <div key={folder.id} className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow relative group">
                        <div className="flex justify-between items-start mb-4">
                           <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                             <FolderIcon size={24} />
                           </div>
                           <button onClick={() => handleDeleteFolder(folder.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={18}/></button>
                        </div>
                        <h3 className="font-bold text-xl mb-1">{folder.name}</h3>
                        <p className="text-slate-500 text-sm mb-4">{count} Questions</p>
                        
                        <div className="flex flex-wrap gap-1 mb-6 h-12 overflow-hidden">
                          {folder.filterKeywords.map(k => <span key={k} className="text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{k}</span>)}
                          {folder.filterTopics.map(t => <span key={t} className="text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-500 px-1.5 py-0.5 rounded">{t}</span>)}
                        </div>

                        <button 
                          onClick={() => navigate(`/study/${folder.id}`)}
                          className="w-full py-2 bg-slate-900 dark:bg-slate-700 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                           <Play size={16} /> Study Mode
                        </button>
                     </div>
                   );
                 })}
              </div>
           </div>
         )}
      </div>

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
           <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl shadow-2xl p-6 animate-slide-up">
              <h2 className="text-xl font-bold mb-4">Create Smart Folder</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Folder Name</label>
                  <input 
                    type="text" 
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-2"
                    placeholder="e.g. Stoichiometry Review"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Include Topics</label>
                  <div className="flex flex-wrap gap-2 p-2 bg-slate-100 dark:bg-slate-900 rounded max-h-32 overflow-y-auto">
                     {availableTopics.map(t => (
                       <button 
                         key={t} 
                         onClick={() => toggleSelection(t, selectedTopics, setSelectedTopics)}
                         className={`px-2 py-1 text-xs rounded border ${selectedTopics.includes(t) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'}`}
                       >
                         {t}
                       </button>
                     ))}
                     {availableTopics.length === 0 && <span className="text-xs text-slate-500">No topics available.</span>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Include Keywords</label>
                  <div className="flex flex-wrap gap-2 p-2 bg-slate-100 dark:bg-slate-900 rounded max-h-32 overflow-y-auto">
                     {availableKeywords.map(k => (
                       <button 
                         key={k} 
                         onClick={() => toggleSelection(k, selectedTags, setSelectedTags)}
                         className={`px-2 py-1 text-xs rounded border ${selectedTags.includes(k) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'}`}
                       >
                         {k}
                       </button>
                     ))}
                     {availableKeywords.length === 0 && <span className="text-xs text-slate-500">No keywords available.</span>}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                 <button onClick={() => setShowNewFolderModal(false)} className="flex-1 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">Cancel</button>
                 <button onClick={handleCreateFolder} className="flex-1 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 font-bold">Create Folder</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default SubjectDashboard;
