
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QuestionEntry, Folder, PaperType } from '../types';
import { getQuestionsBySubject, updateQuestionStatus, getAllFolders } from '../services/db';
import { ArrowLeft, Eye, EyeOff, ThumbsUp, ThumbsDown, Clock, Loader2, CheckCircle2, XCircle, Tag } from 'lucide-react';
import ImageViewer from '../components/ImageViewer';

const StudyMode: React.FC = () => {
  const { folderId } = useParams<{folderId: string}>();
  const navigate = useNavigate();
  
  const [questions, setQuestions] = useState<QuestionEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [folderName, setFolderName] = useState("");
  const [revealedParts, setRevealedParts] = useState<Set<number>>(new Set());
  const [userChoices, setUserChoices] = useState<Record<number, string>>({});
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
            if (folder.filterUncategorized) return q.topics.length === 0;
            const matchesTopic = folder.filterTopics.length === 0 || folder.filterTopics.some(t => q.topics.includes(t));
            return matchesTopic;
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
     const newQs = [...questions];
     newQs[currentIndex].userStatus = status as any;
     setQuestions(newQs);
     if (currentIndex < questions.length - 1) {
         setRevealedParts(new Set());
         setUserChoices({});
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

  const handleMcqChoice = (idx: number, choice: string) => {
      setUserChoices(prev => ({ ...prev, [idx]: choice }));
      const newSet = new Set(revealedParts);
      newSet.add(idx);
      setRevealedParts(newSet);
  };

  if (loading) return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-4">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        <p className="text-slate-400 font-medium">Loading practice session...</p>
      </div>
  );

  if (questions.length === 0) return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-6 p-4 text-center">
          <EyeOff size={48} className="text-slate-500" />
          <h2 className="text-2xl font-bold">Empty Folder</h2>
          <button onClick={() => navigate(-1)} className="px-6 py-3 bg-blue-600 rounded-xl font-bold">Go Back</button>
      </div>
  );

  const currentQ = questions[currentIndex];
  const isPaper1 = currentQ.paperType === PaperType.PAPER_1;

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
       {zoomedImage && <ImageViewer src={zoomedImage} onClose={() => setZoomedImage(null)} />}
       <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center shrink-0 shadow-md z-10">
          <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-all"><ArrowLeft /></button>
          <div className="text-center">
              <h1 className="font-bold text-lg truncate max-w-[200px]">{folderName}</h1>
              <p className="text-xs text-slate-400 font-mono tracking-widest uppercase">Question {currentIndex + 1} / {questions.length}</p>
          </div>
          <div className="w-10 h-10 flex items-center justify-center bg-blue-500/10 text-blue-400 rounded-full text-xs font-bold">
            {Math.round(((currentIndex) / questions.length) * 100)}%
          </div>
       </div>

       <div className="flex-1 overflow-y-auto p-4 flex justify-center">
          <div className="max-w-3xl w-full space-y-8 pb-32">
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

             {/* Topic Badges in Study Mode */}
             {currentQ.topics.length > 0 && (
                <div className="flex flex-wrap gap-2 animate-fade-in">
                    {currentQ.topics.map(t => (
                        <div key={t} className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-full flex items-center gap-1.5 shadow-sm">
                            <Tag size={10} className="text-indigo-400" />
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">{t}</span>
                        </div>
                    ))}
                </div>
             )}

             {currentQ.parts.map((part, idx) => {
                 const hasChosenMcq = !!userChoices[idx];
                 const isCorrectMcq = hasChosenMcq && userChoices[idx] === part.answerText;
                 return (
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
                        <div className="space-y-6 mb-8">
                            {(part.questionImages || (part.questionImage ? [part.questionImage] : [])).map((img, i) => (
                                <img key={i} src={img} onClick={() => setZoomedImage(img)} className="max-w-full mx-auto rounded-xl bg-white p-2 cursor-zoom-in border border-slate-600 shadow-xl" />
                            ))}
                        </div>
                        {isPaper1 && part.answerText && (
                            <div className="mb-8">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {['A', 'B', 'C', 'D'].map(opt => {
                                        const isThisCorrect = opt === part.answerText;
                                        const isThisSelected = userChoices[idx] === opt;
                                        let btnClass = "py-5 rounded-2xl font-black text-2xl border-2 transition-all flex items-center justify-center gap-2 ";
                                        if (!hasChosenMcq) btnClass += "bg-slate-700 border-slate-600 hover:border-blue-500 text-slate-200 active:scale-95";
                                        else {
                                            if (isThisCorrect) btnClass += "bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]";
                                            else if (isThisSelected) btnClass += "bg-red-500/20 border-red-500 text-red-400";
                                            else btnClass += "bg-slate-800 border-slate-700 text-slate-600 opacity-40";
                                        }
                                        return (
                                            <button key={opt} disabled={hasChosenMcq} onClick={() => handleMcqChoice(idx, opt)} className={btnClass}>
                                                {opt}
                                                {hasChosenMcq && isThisCorrect && <CheckCircle2 size={18}/>}
                                                {hasChosenMcq && isThisSelected && !isThisCorrect && <XCircle size={18}/>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        <div className="mt-8">
                            {!revealedParts.has(idx) ? (
                                <button onClick={() => toggleReveal(idx)} className="w-full py-4 bg-slate-700 hover:bg-slate-600 rounded-2xl text-slate-100 font-bold flex items-center justify-center gap-3 transition-all border border-slate-600 shadow-xl">
                                    <Eye size={20} /> Reveal Markscheme
                                </button>
                            ) : (
                                <div className="bg-slate-900/80 rounded-2xl p-6 animate-slide-up border-2 border-emerald-500/20 shadow-lg">
                                    {part.answerText && <div className={`text-4xl font-black mb-6 p-4 rounded-xl border inline-block ${isPaper1 ? 'bg-emerald-500 text-white' : 'bg-emerald-500/10 text-white border-emerald-500/20'}`}>{part.answerText}</div>}
                                    <div className="space-y-6">
                                        {(part.answerImages || (part.answerImage ? [part.answerImage] : [])).map((img, i) => (
                                            <img key={i} src={img} onClick={() => setZoomedImage(img)} className="max-w-full mx-auto rounded-xl bg-white p-2 cursor-zoom-in border border-slate-600 shadow-lg" />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                 );
             })}

             <div className="sticky bottom-6 pt-4 animate-slide-up">
                 <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-600/50 p-4 rounded-[2rem] shadow-2xl grid grid-cols-3 gap-3">
                     <button onClick={() => handleTag('Easy')} className="py-4 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-2xl flex flex-col items-center gap-1 font-bold transition-all"><ThumbsUp size={20} /><span className="text-[10px] uppercase mt-1">Easy</span></button>
                     <button onClick={() => handleTag('Review')} className="py-4 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-2xl flex flex-col items-center gap-1 font-bold transition-all"><Clock size={20} /><span className="text-[10px] uppercase mt-1">Review</span></button>
                     <button onClick={() => handleTag('Hard')} className="py-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-2xl flex flex-col items-center gap-1 font-bold transition-all"><ThumbsDown size={20} /><span className="text-[10px] uppercase mt-1">Hard</span></button>
                 </div>
             </div>
          </div>
       </div>
    </div>
  );
};

export default StudyMode;
