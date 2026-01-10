
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QuestionEntry, Folder } from '../types';
import { getQuestionsBySubject, updateQuestionStatus, getAllFolders } from '../services/db';
import { ArrowLeft, Eye, EyeOff, ThumbsUp, ThumbsDown, Clock, Loader2 } from 'lucide-react';
import ImageViewer from '../components/ImageViewer';

const StudyMode: React.FC = () => {
  const { folderId } = useParams<{folderId: string}>();
  const navigate = useNavigate();
  
  const [questions, setQuestions] = useState<QuestionEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [folderName, setFolderName] = useState("");
  
  // State to track revealed answers for the current question parts
  const [revealedParts, setRevealedParts] = useState<Set<number>>(new Set());

  // Zoom Viewer State
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      if (!folderId) {
        setLoading(false);
        return;
      }
      
      try {
        const folders = await getAllFolders();
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
      } catch (err) {
        console.error("StudyMode init failed:", err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [folderId]);

  const handleTag = async (status: 'Easy' | 'Hard' | 'Review') => {
     if (!questions[currentIndex]) return;
     const q = questions[currentIndex];
     await updateQuestionStatus(q.id, status);
     
     // Update local state
     const newQs = [...questions];
     newQs[currentIndex].userStatus = status as any;
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

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-4">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        <p className="text-slate-400 font-medium">Loading practice session...</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-6 p-4 text-center">
          <div className="p-6 bg-slate-800 rounded-full">
            <EyeOff size={48} className="text-slate-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">Empty Folder</h2>
            <p className="text-slate-400">No questions match this folder's smart filters.</p>
          </div>
          <button 
            onClick={() => navigate(-1)} 
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/40"
          >
            Go Back
          </button>
      </div>
    );
  }

  const currentQ = questions[currentIndex];

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
       {zoomedImage && <ImageViewer src={zoomedImage} onClose={() => setZoomedImage(null)} />}

       {/* Header */}
       <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center shrink-0 shadow-md z-10">
          <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-all">
            <ArrowLeft />
          </button>
          <div className="text-center">
              <h1 className="font-bold text-lg truncate max-w-[200px]">{folderName}</h1>
              <p className="text-xs text-slate-400 font-mono tracking-widest uppercase">Question {currentIndex + 1} / {questions.length}</p>
          </div>
          <div className="w-10 h-10 flex items-center justify-center bg-blue-500/10 text-blue-400 rounded-full text-xs font-bold">
            {Math.round(((currentIndex) / questions.length) * 100)}%
          </div>
       </div>

       {/* Scrollable Content */}
       <div className="flex-1 overflow-y-auto p-4 flex justify-center">
          <div className="max-w-3xl w-full space-y-8 pb-32">
             
             {/* Metadata Card */}
             <div className="bg-slate-800 rounded-2xl p-4 flex justify-between items-center border border-slate-700 shadow-sm">
                <div className="flex flex-col">
                   <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Source Exam</span>
                   <span className="text-sm font-medium text-slate-200">{currentQ.year} {currentQ.month} • {currentQ.paperType}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Status</span>
                  <span className={`text-xs px-2 py-1 rounded-full font-black uppercase tracking-tighter border ${currentQ.userStatus === 'Easy' ? 'bg-emerald-900/30 border-emerald-500/30 text-emerald-400' : currentQ.userStatus === 'Hard' ? 'bg-red-900/30 border-red-500/30 text-red-400' : currentQ.userStatus === 'Review' ? 'bg-amber-900/30 border-amber-500/30 text-amber-400' : 'bg-slate-700 border-slate-600 text-slate-400'}`}>
                      {currentQ.userStatus || 'Untagged'}
                  </span>
                </div>
             </div>

             {/* Parts Loop */}
             {currentQ.parts.map((part, idx) => (
                 <div key={part.id} className="bg-slate-800 rounded-3xl p-6 md:p-8 border border-slate-700 shadow-2xl animate-fade-in">
                     <div className="mb-6 border-b border-slate-700/50 pb-4 flex justify-between items-center">
                         <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-black text-white shadow-lg">
                                {part.label === 'i' || part.label === 'Q' ? (currentIndex + 1) : part.label}
                            </span>
                            <h3 className="font-bold text-slate-200 text-xl">
                                {currentQ.parts.length > 1 ? `Part (${part.label})` : 'Question View'}
                            </h3>
                         </div>
                     </div>
                     
                     {/* Question Images */}
                     <div className="space-y-6 mb-8">
                         {(part.questionImages || (part.questionImage ? [part.questionImage] : [])).map((img, i) => (
                             <div key={i} className="group relative">
                                <img 
                                  src={img} 
                                  onClick={() => setZoomedImage(img)}
                                  className="max-w-full mx-auto rounded-xl bg-white p-2 cursor-zoom-in hover:shadow-2xl transition-all duration-300 border border-slate-600" 
                                />
                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 p-2 rounded-lg backdrop-blur-sm pointer-events-none">
                                   <Eye size={16} />
                                </div>
                             </div>
                         ))}
                     </div>

                     {/* Answer Section (Toggleable) */}
                     <div className="mt-8">
                         {!revealedParts.has(idx) ? (
                             <button 
                               onClick={() => toggleReveal(idx)}
                               className="w-full py-4 bg-slate-700 hover:bg-slate-600 active:scale-[0.98] rounded-2xl text-slate-100 font-bold flex items-center justify-center gap-3 transition-all border border-slate-600 shadow-xl"
                             >
                                <Eye size={20} /> Reveal Markscheme {currentQ.parts.length > 1 ? `(${part.label})` : ''}
                             </button>
                         ) : (
                             <div className="bg-slate-900/80 rounded-2xl p-6 animate-slide-up border-2 border-emerald-500/20 shadow-[0_0_40px_rgba(16,185,129,0.05)]">
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex items-center gap-2">
                                       <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                       <span className="text-xs font-black text-emerald-500 uppercase tracking-[0.2em]">Markscheme Solution</span>
                                    </div>
                                    <button onClick={() => toggleReveal(idx)} className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-all">
                                      <EyeOff size={16}/>
                                    </button>
                                </div>
                                
                                {part.answerText && (
                                    <div className="text-3xl font-black text-white mb-6 p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20 inline-block">
                                      {part.answerText}
                                    </div>
                                )}

                                <div className="space-y-6">
                                    {(part.answerImages || (part.answerImage ? [part.answerImage] : [])).map((img, i) => (
                                        <img 
                                          key={i} 
                                          src={img} 
                                          onClick={() => setZoomedImage(img)} 
                                          className="max-w-full mx-auto rounded-xl bg-white p-2 cursor-zoom-in border border-slate-600 shadow-lg hover:shadow-emerald-500/10 transition-shadow" 
                                        />
                                    ))}
                                    {(!part.answerText && (!part.answerImages || part.answerImages.length === 0) && !part.answerImage) && (
                                      <div className="text-center py-8 text-slate-500 italic text-sm">
                                        No visual answer snip provided for this part.
                                      </div>
                                    )}
                                </div>
                             </div>
                         )}
                     </div>
                 </div>
             ))}

             {/* Tagging Controls */}
             <div className="sticky bottom-6 pt-4 animate-slide-up">
                 <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-600/50 p-4 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] grid grid-cols-3 gap-3 ring-1 ring-white/10">
                     <button 
                        onClick={() => handleTag('Easy')} 
                        className="py-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-2xl flex flex-col items-center gap-1 font-bold transition-all hover:-translate-y-1 active:scale-95"
                     >
                         <ThumbsUp size={20} /> <span className="text-[10px] uppercase tracking-widest mt-1">Easy</span>
                     </button>
                     <button 
                        onClick={() => handleTag('Review')} 
                        className="py-4 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-2xl flex flex-col items-center gap-1 font-bold transition-all hover:-translate-y-1 active:scale-95"
                     >
                         <Clock size={20} /> <span className="text-[10px] uppercase tracking-widest mt-1">Review</span>
                     </button>
                     <button 
                        onClick={() => handleTag('Hard')} 
                        className="py-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-2xl flex flex-col items-center gap-1 font-bold transition-all hover:-translate-y-1 active:scale-95"
                     >
                         <ThumbsDown size={20} /> <span className="text-[10px] uppercase tracking-widest mt-1">Hard</span>
                     </button>
                 </div>
             </div>
          </div>
       </div>
    </div>
  );
};

export default StudyMode;
