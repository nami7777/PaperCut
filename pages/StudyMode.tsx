
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QuestionEntry, Folder } from '../types';
import { getQuestionsBySubject, updateQuestionStatus, getFoldersBySubject } from '../services/db';
import { ArrowLeft, Eye, EyeOff, ThumbsUp, ThumbsDown, Clock } from 'lucide-react';
import ImageViewer from '../components/ImageViewer';

const StudyMode: React.FC = () => {
  const { folderId } = useParams<{folderId: string}>();
  const navigate = useNavigate();
  
  const [questions, setQuestions] = useState<QuestionEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [folderName, setFolderName] = useState("");
  
  // State to track revealed answers for the *current* question
  // For Paper 1: simple boolean. For Paper 2: array of booleans or set of indices.
  const [revealedParts, setRevealedParts] = useState<Set<number>>(new Set());

  // Zoom Viewer State
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      if (!folderId) return;
      const db = await new Promise<IDBDatabase>((resolve) => {
          const r = indexedDB.open('PaperCutDB', 2);
          r.onsuccess = (e: any) => resolve(e.target.result);
      });
      
      const tx = db.transaction(['folders'], 'readonly');
      const store = tx.objectStore('folders');
      const req = store.getAll();
      
      req.onsuccess = async () => {
          const folders = req.result as Folder[];
          const folder = folders.find(f => f.id === folderId);
          
          if (folder) {
              setFolderName(folder.name);
              const qs = await getQuestionsBySubject(folder.subject);
              const filtered = qs.filter(q => {
                const matchesKeyword = folder.filterKeywords.length === 0 || folder.filterKeywords.some(k => q.keywords.includes(k));
                const matchesTopic = folder.filterTopics.length === 0 || folder.filterTopics.some(t => q.topics.includes(t));
                return matchesKeyword && matchesTopic;
              });
              setQuestions(filtered);
          }
          setLoading(false);
      };
    };
    init();
  }, [folderId]);

  const handleTag = async (status: 'Easy' | 'Hard' | 'Review') => {
     if (!questions[currentIndex]) return;
     const q = questions[currentIndex];
     await updateQuestionStatus(q.id, status);
     const newQs = [...questions];
     newQs[currentIndex].userStatus = status;
     setQuestions(newQs);
     
     if (currentIndex < questions.length - 1) {
         setRevealedParts(new Set());
         setCurrentIndex(currentIndex + 1);
     } else {
         alert("Folder complete!");
         navigate(-1);
     }
  };

  const toggleReveal = (idx: number) => {
      const newSet = new Set(revealedParts);
      if (newSet.has(idx)) newSet.delete(idx);
      else newSet.add(idx);
      setRevealedParts(newSet);
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-900 text-white">Loading...</div>;

  if (questions.length === 0) return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-4">
          <p>No questions in this folder.</p>
          <button onClick={() => navigate(-1)} className="text-blue-400 underline">Go Back</button>
      </div>
  );

  const currentQ = questions[currentIndex];
  const allRevealed = currentQ.parts.every((_, i) => revealedParts.has(i));

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
       {zoomedImage && <ImageViewer src={zoomedImage} onClose={() => setZoomedImage(null)} />}

       {/* Header */}
       <div className="p-4 bg-slate-800 flex justify-between items-center shrink-0 shadow-md z-10">
          <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white"><ArrowLeft /></button>
          <div className="text-center">
              <h1 className="font-bold text-lg">{folderName}</h1>
              <p className="text-xs text-slate-400">Question {currentIndex + 1} / {questions.length}</p>
          </div>
          <div className="w-8"></div>
       </div>

       {/* Scrollable Content */}
       <div className="flex-1 overflow-y-auto p-4 flex justify-center">
          <div className="max-w-3xl w-full space-y-8 pb-20">
             
             {/* Metadata Card */}
             <div className="bg-slate-800 rounded-xl p-4 flex justify-between items-center border border-slate-700">
                <span className="text-sm text-slate-300">{currentQ.year} {currentQ.month} • {currentQ.paperType}</span>
                <span className={`text-sm font-bold ${currentQ.userStatus === 'Easy' ? 'text-emerald-400' : currentQ.userStatus === 'Hard' ? 'text-red-400' : 'text-slate-500'}`}>
                    {currentQ.userStatus || 'Untagged'}
                </span>
             </div>

             {/* Parts Loop */}
             {currentQ.parts.map((part, idx) => (
                 <div key={part.id} className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg">
                     <div className="mb-4 border-b border-slate-700 pb-2 flex justify-between items-center">
                         <h3 className="font-bold text-blue-400 text-lg">
                             {currentQ.parts.length > 1 ? `Part (${part.label})` : 'Question'}
                         </h3>
                     </div>
                     
                     {/* Question Images */}
                     <div className="space-y-4 mb-6">
                         {/* Handle Legacy singular 'questionImage' */}
                         {part.questionImage && (
                             <img 
                               src={part.questionImage} 
                               onClick={() => setZoomedImage(part.questionImage!)}
                               className="max-w-full rounded bg-white p-1 cursor-zoom-in hover:opacity-90 transition-opacity" 
                             />
                         )}
                         {/* Handle New Array 'questionImages' */}
                         {part.questionImages?.map((img, i) => (
                             <img 
                               key={i} 
                               src={img} 
                               onClick={() => setZoomedImage(img)}
                               className="max-w-full rounded bg-white p-1 cursor-zoom-in hover:opacity-90 transition-opacity" 
                             />
                         ))}
                     </div>

                     {/* Answer Section (Toggleable) */}
                     <div className="mt-4">
                         {!revealedParts.has(idx) ? (
                             <button 
                               onClick={() => toggleReveal(idx)}
                               className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 font-medium flex items-center justify-center gap-2 transition-colors"
                             >
                                <Eye size={18} /> Reveal Answer {currentQ.parts.length > 1 ? `(${part.label})` : ''}
                             </button>
                         ) : (
                             <div className="bg-slate-900/50 rounded-lg p-4 animate-slide-up border border-slate-700">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-emerald-500 uppercase">Answer</span>
                                    <button onClick={() => toggleReveal(idx)} className="text-xs text-slate-500 hover:text-white"><EyeOff size={14}/></button>
                                </div>
                                
                                {part.answerText && (
                                    <div className="text-2xl font-bold text-white mb-2 p-2">{part.answerText}</div>
                                )}

                                <div className="space-y-4">
                                    {/* Legacy singular */}
                                    {part.answerImage && (
                                        <img src={part.answerImage} onClick={() => setZoomedImage(part.answerImage!)} className="max-w-full rounded bg-white p-1 cursor-zoom-in" />
                                    )}
                                    {/* New Array */}
                                    {part.answerImages?.map((img, i) => (
                                        <img key={i} src={img} onClick={() => setZoomedImage(img)} className="max-w-full rounded bg-white p-1 cursor-zoom-in" />
                                    ))}
                                </div>
                             </div>
                         )}
                     </div>
                 </div>
             ))}

             {/* Tagging Controls (Only show when all parts revealed or user decides to skip) */}
             <div className="sticky bottom-4 pt-4">
                 <div className="bg-slate-800/90 backdrop-blur border border-slate-600 p-4 rounded-2xl shadow-2xl grid grid-cols-3 gap-4">
                     <button onClick={() => handleTag('Easy')} className="py-3 bg-emerald-900/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-400 rounded-xl flex flex-col items-center gap-1 font-medium transition-colors">
                         <ThumbsUp size={20} /> Easy
                     </button>
                     <button onClick={() => handleTag('Review')} className="py-3 bg-amber-900/40 hover:bg-amber-900/60 border border-amber-500/30 text-amber-400 rounded-xl flex flex-col items-center gap-1 font-medium transition-colors">
                         <Clock size={20} /> Review
                     </button>
                     <button onClick={() => handleTag('Hard')} className="py-3 bg-red-900/40 hover:bg-red-900/60 border border-red-500/30 text-red-400 rounded-xl flex flex-col items-center gap-1 font-medium transition-colors">
                         <ThumbsDown size={20} /> Hard
                     </button>
                 </div>
             </div>
          </div>
       </div>
    </div>
  );
};

export default StudyMode;
