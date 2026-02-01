
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ExamMetadata, PaperType, QuestionPart, QuestionEntry, PdfPair } from '../types';
import PdfSnipper from '../components/PdfSnipper';
import { Save, Plus, Trash2, ChevronLeft, Layers, FileQuestion, AlertCircle, Loader2, LogOut, Minus, Anchor, X, ScanText, Sparkles, Wand2, Boxes } from 'lucide-react';
import { saveQuestion, getAllUniqueKeywords, getAllUniqueTopics, getFewShotExamples } from '../services/db';
import { generateAiKeywords } from '../services/gemini';

declare global {
    interface Window {
        Tesseract: any;
    }
}

const Workspace: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const metadata = location.state as ExamMetadata;

  const [activeTab, setActiveTab] = useState<'question' | 'answer'>('question');
  const [activePairIndex, setActivePairIndex] = useState(0);
  
  // Draft State
  const [questionNum, setQuestionNum] = useState<string>("1");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [currentKeyword, setCurrentKeyword] = useState("");
  const [topic, setTopic] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  // Sticky State
  const [stickyMetadata, setStickyMetadata] = useState(false);
  
  // Suggestions
  const [allKeywords, setAllKeywords] = useState<string[]>([]);
  const [allTopics, setAllTopics] = useState<string[]>([]);
  const [showKeywordSuggestions, setShowKeywordSuggestions] = useState(false);
  const [showTopicSuggestions, setShowTopicSuggestions] = useState(false);
  
  // Smart Suggestions from AI
  const [smartSuggestions, setSmartSuggestions] = useState<string[]>([]);
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // --- Image Staging (Multiple Snaps) ---
  const [stagedQImages, setStagedQImages] = useState<string[]>([]);
  const [stagedAImages, setStagedAImages] = useState<string[]>([]);
  
  // OCR State
  const [extractedText, setExtractedText] = useState<string>("");
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  
  // Paper 1 Answer (MCQ)
  const [p1Answer, setP1Answer] = useState<string | null>(null);

  // Paper 2 Specific
  const [consolidatedMode, setConsolidatedMode] = useState(false); // If true, treats Q as one big part
  const [p2Parts, setP2Parts] = useState<QuestionPart[]>([]);
  const [currentPartLabel, setCurrentPartLabel] = useState("a");
  const [p2TempAnswerText, setP2TempAnswerText] = useState("");

  useEffect(() => {
    if (!metadata) {
      navigate('/');
    } else {
        // Load suggestions
        getAllUniqueKeywords(metadata.subject).then(setAllKeywords);
        getAllUniqueTopics(metadata.subject).then(setAllTopics);
    }
  }, [metadata, navigate]);

  if (!metadata) return null;

  const isPaper1 = metadata.paperType === PaperType.PAPER_1;
  const currentPair: PdfPair | null = metadata.pdfPairs ? metadata.pdfPairs[activePairIndex] : (metadata.questionPdf && metadata.answerPdf ? {
      id: 'legacy',
      questionPdf: metadata.questionPdf,
      answerPdf: metadata.answerPdf
  } : null);

  // OCR Helper
  const runOcr = async (imageSrc: string) => {
      if (!window.Tesseract) return;
      setIsOcrRunning(true);
      try {
          const { data: { text } } = await window.Tesseract.recognize(imageSrc, 'eng', {
              // logger: m => console.log(m) 
          });
          // Clean up text
          const clean = text.replace(/\s+/g, ' ').trim();
          const newText = extractedText + " " + clean;
          setExtractedText(newText);
          
          // Automatically trigger AI generation if we have enough text
          if (newText.length > 20 && !isAiGenerating) {
             triggerAiGeneration(newText);
          }
      } catch (e) {
          console.error("OCR Failed", e);
      } finally {
          setIsOcrRunning(false);
      }
  };

  const triggerAiGeneration = async (text: string) => {
      if (!text.trim()) return;
      setIsAiGenerating(true);
      try {
          // Get examples from DB for few-shot learning
          const examples = await getFewShotExamples(metadata.subject, 5);
          const suggestions = await generateAiKeywords(text, metadata.subject, examples);
          
          // Filter out already selected keywords
          setSmartSuggestions(suggestions.filter(s => !keywords.includes(s)));
      } catch (e) {
          console.error("AI Generation failed", e);
      } finally {
          setIsAiGenerating(false);
      }
  };

  // Handlers
  const handleKeywordKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault();
      if (currentKeyword.trim()) {
        if (!keywords.includes(currentKeyword.trim())) {
            setKeywords([...keywords, currentKeyword.trim()]);
        }
        setCurrentKeyword("");
        setShowKeywordSuggestions(false);
      }
    }
  };

  const addKeyword = (k: string) => {
      if (!keywords.includes(k)) {
        setKeywords([...keywords, k]);
      }
      // Remove from smart suggestions if added
      setSmartSuggestions(prev => prev.filter(s => s !== k));
      setCurrentKeyword("");
      setShowKeywordSuggestions(false);
  };

  const removeKeyword = (index: number) => {
    setKeywords(keywords.filter((_, i) => i !== index));
  };

  const handleSnip = (dataUrl: string) => {
    if (activeTab === 'question') {
        setStagedQImages(prev => [...prev, dataUrl]);
        // Trigger OCR automatically
        runOcr(dataUrl);

        // Switch only if we don't have any images yet, otherwise user might want to snip more
        if (stagedQImages.length === 0) {
            setActiveTab('answer');
        }
    } else {
        setStagedAImages(prev => [...prev, dataUrl]);
    }
  };

  const removeStagedImage = (type: 'Q' | 'A', index: number) => {
      if (type === 'Q') {
          setStagedQImages(prev => prev.filter((_, i) => i !== index));
      }
      else setStagedAImages(prev => prev.filter((_, i) => i !== index));
  };

  // -- Paper 2 Part Logic --
  const addPaper2Part = () => {
    if (stagedQImages.length === 0) {
        alert("Please snip at least one question image.");
        return false;
    }

    const newPart: QuestionPart = {
      id: Date.now().toString(),
      label: consolidatedMode ? 'Q' : currentPartLabel,
      questionImages: [...stagedQImages],
      answerImages: [...stagedAImages],
      answerText: p2TempAnswerText
    };

    setP2Parts([...p2Parts, newPart]);
    
    // Reset Staging
    setStagedQImages([]);
    setStagedAImages([]);
    setP2TempAnswerText("");
    
    // Auto-increment label
    if (!consolidatedMode) {
        const nextChar = String.fromCharCode(currentPartLabel.charCodeAt(0) + 1);
        setCurrentPartLabel(nextChar);
    }
    
    setActiveTab('question');
    return true;
  };

  const changeQuestionNum = (delta: number) => {
      const current = parseInt(questionNum);
      if (!isNaN(current)) {
          setQuestionNum(Math.max(1, current + delta).toString());
      }
  };

  const handleSaveQuestion = async () => {
    if (!questionNum) {
      alert("Please enter a question number.");
      return;
    }

    setIsSaving(true);
    let parts: QuestionPart[] = [];

    if (isPaper1) {
      if (stagedQImages.length === 0 || !p1Answer) {
        alert("Missing question images or answer selection.");
        setIsSaving(false);
        return;
      }
      parts = [{
        id: Date.now().toString(),
        label: 'i',
        questionImages: [...stagedQImages],
        answerImages: stagedAImages.length > 0 ? [...stagedAImages] : undefined,
        answerText: p1Answer
      }];
    } else {
      // Paper 2
      let currentParts = [...p2Parts];
      
      // Check if there is a pending draft in staging
      if (stagedQImages.length > 0) {
         // If consolidated mode, or if user forgot to click Add Part, add it now
         const newPart: QuestionPart = {
            id: Date.now().toString(),
            label: consolidatedMode ? 'Q' : currentPartLabel,
            questionImages: [...stagedQImages],
            answerImages: [...stagedAImages],
            answerText: p2TempAnswerText
        };
        currentParts.push(newPart);
      }

      if (currentParts.length === 0) {
        alert("Please add at least one part to this question.");
        setIsSaving(false);
        return;
      }
      parts = currentParts;
    }

    const entry: QuestionEntry = {
      id: Date.now().toString(),
      createdAt: Date.now(),
      keywords,
      topics: topic ? [topic] : [],
      year: metadata.year,
      month: metadata.month,
      subject: metadata.subject,
      timezone: metadata.timezone,
      paperType: metadata.paperType,
      questionNumber: questionNum,
      parts,
      userStatus: 'None',
      ocrText: extractedText.trim()
    };

    try {
      await saveQuestion(entry);
      
      // Reset Form
      setQuestionNum(prev => {
        const num = parseInt(prev);
        return isNaN(num) ? "" : String(num + 1);
      });
      
      if (!stickyMetadata) {
          setKeywords([]);
          setTopic("");
      }

      // Reset Images & OCR
      setStagedQImages([]);
      setStagedAImages([]);
      setExtractedText("");
      setSmartSuggestions([]);
      setP1Answer(null);
      setP2Parts([]);
      setP2TempAnswerText("");
      if (!consolidatedMode) setCurrentPartLabel("a");

      setActiveTab('question');

      // Refresh suggestions
      getAllUniqueKeywords(metadata.subject).then(setAllKeywords);
      getAllUniqueTopics(metadata.subject).then(setAllTopics);

    } catch (e) {
      console.error(e);
      alert("Failed to save question.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden text-slate-100">
      {/* Sidebar */}
      <div className="w-96 bg-slate-900 border-r border-slate-700 flex flex-col z-20 shadow-xl flex-shrink-0">
        <div className="p-4 border-b border-slate-700 flex flex-col gap-2">
          <div className="flex items-center justify-between">
             <button onClick={() => navigate(`/subject/${encodeURIComponent(metadata.subject)}`)} className="flex items-center text-slate-400 hover:text-white transition-colors">
                <ChevronLeft size={16} /> <span className="text-sm font-medium">Dashboard</span>
             </button>
             <button onClick={() => navigate(`/subject/${encodeURIComponent(metadata.subject)}`)} className="flex items-center gap-1 text-xs bg-red-900/30 text-red-400 hover:bg-red-900/50 px-2 py-1 rounded border border-red-900/50">
               <LogOut size={12} /> Finish
             </button>
          </div>
          
          <div>
            <h2 className="text-lg font-bold text-white truncate">{metadata.subject}</h2>
            <p className="text-xs text-slate-400">
                {metadata.year} {metadata.month} • {metadata.paperType}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          
          {/* Metadata Controls */}
          <div className="space-y-4">
               {/* Sticky */}
               <div className="flex items-center gap-2">
                    <input 
                        type="checkbox" 
                        id="sticky" 
                        checked={stickyMetadata} 
                        onChange={e => setStickyMetadata(e.target.checked)}
                        className="w-4 h-4 rounded bg-slate-700 border-slate-500 text-blue-600"
                    />
                    <label htmlFor="sticky" className="text-sm text-slate-300 select-none cursor-pointer flex items-center gap-1">
                        <Anchor size={14} /> Sticky Metadata
                    </label>
                </div>

                {/* Number Control */}
                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Question Number</label>
                    <div className="flex items-center gap-1">
                        <button onClick={() => changeQuestionNum(-1)} className="p-2 bg-slate-800 border border-slate-600 rounded hover:bg-slate-700"><Minus size={14} /></button>
                        <input 
                        type="text" 
                        value={questionNum}
                        onChange={(e) => setQuestionNum(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-center font-mono"
                        />
                        <button onClick={() => changeQuestionNum(1)} className="p-2 bg-slate-800 border border-slate-600 rounded hover:bg-slate-700"><Plus size={14} /></button>
                    </div>
                </div>
          </div>

          {/* --- Staging Area (Thumbnails) --- */}
          <div className="bg-slate-800/50 rounded border border-slate-700 p-3 space-y-3 relative">
             {isOcrRunning && (
                 <div className="absolute top-2 right-2 flex items-center gap-1 text-xs text-emerald-400 animate-pulse bg-slate-900/80 px-2 py-1 rounded z-10">
                     <ScanText size={12} /> Scanning...
                 </div>
             )}
             <div className="flex items-center justify-between">
                 <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">Question Snips</span>
                 <span className="text-xs text-slate-400">{stagedQImages.length} items</span>
             </div>
             <div className="flex flex-wrap gap-2 min-h-[40px]">
                 {stagedQImages.map((img, i) => (
                     <div key={i} className="relative group w-12 h-12">
                         <img src={img} className="w-full h-full object-cover rounded border border-slate-600" />
                         <button onClick={() => removeStagedImage('Q', i)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X size={10}/></button>
                     </div>
                 ))}
                 {stagedQImages.length === 0 && <span className="text-xs text-slate-500 italic">Snip question to add...</span>}
             </div>

             <div className="h-px bg-slate-700 my-2"></div>

             <div className="flex items-center justify-between">
                 <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">Answer Snips</span>
                 <span className="text-xs text-slate-400">{stagedAImages.length} items</span>
             </div>
             <div className="flex flex-wrap gap-2 min-h-[40px]">
                 {stagedAImages.map((img, i) => (
                     <div key={i} className="relative group w-12 h-12">
                         <img src={img} className="w-full h-full object-cover rounded border border-slate-600" />
                         <button onClick={() => removeStagedImage('A', i)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X size={10}/></button>
                     </div>
                 ))}
                 {stagedAImages.length === 0 && <span className="text-xs text-slate-500 italic">Snip answer (optional)...</span>}
             </div>
          </div>

          {/* Paper 1 Logic */}
          {isPaper1 && (
             <div className="bg-slate-800/50 p-3 rounded border border-slate-700">
               <span className="text-sm text-slate-300 mb-2 block">Select Correct MCQ Answer:</span>
               <div className="grid grid-cols-4 gap-2">
                 {['A', 'B', 'C', 'D'].map(opt => (
                   <button
                     key={opt}
                     onClick={() => setP1Answer(opt)}
                     className={`p-2 text-sm rounded border transition-colors ${p1Answer === opt ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}
                   >
                     {opt}
                   </button>
                 ))}
               </div>
             </div>
          )}

          {/* Paper 2 Logic */}
          {!isPaper1 && (
            <div className="space-y-4">
               <div className="flex items-center gap-2 mb-2">
                   <input 
                       type="checkbox" 
                       id="consolidated" 
                       checked={consolidatedMode} 
                       onChange={e => { setConsolidatedMode(e.target.checked); setP2Parts([]); }}
                       className="w-4 h-4 rounded bg-slate-700 border-slate-500" 
                   />
                   <label htmlFor="consolidated" className="text-xs text-slate-300 cursor-pointer">Consolidated (Single Part Question)</label>
               </div>

               {!consolidatedMode && (
                 <div className="bg-slate-800 p-3 rounded border border-slate-700">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-sm font-semibold text-slate-200">Part <span className="text-blue-400 text-lg ml-1">{currentPartLabel}</span></h4>
                    </div>
                    <button 
                    onClick={addPaper2Part}
                    className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded flex items-center justify-center gap-1 transition-colors"
                    >
                    <Plus size={14} /> Add Part {currentPartLabel}
                    </button>
                 </div>
               )}

               {/* Parts List */}
               <div className="space-y-2">
                    {p2Parts.map((part) => (
                    <div key={part.id} className="flex items-center justify-between bg-slate-800 p-2 rounded border border-slate-600">
                        <span className="text-sm font-bold text-slate-300 w-6">{part.label}</span>
                        <div className="flex gap-1">
                           <span className="text-xs bg-slate-700 px-1 rounded">{part.questionImages.length} Q-Img</span>
                           <span className="text-xs bg-slate-700 px-1 rounded">{part.answerImages?.length || 0} A-Img</span>
                        </div>
                        <button 
                        onClick={() => setP2Parts(p2Parts.filter(p => p.id !== part.id))}
                        className="text-red-400 hover:text-red-300 p-1"
                        >
                        <Trash2 size={14} />
                        </button>
                    </div>
                    ))}
               </div>
            </div>
          )}

          {/* Metadata Inputs */}
          <div className="relative">
            <label className="block text-xs font-medium text-slate-400 mb-1">Topic</label>
            <input 
              type="text" 
              value={topic}
              onChange={(e) => { setTopic(e.target.value); setShowTopicSuggestions(true); }}
              className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm"
            />
            {showTopicSuggestions && allTopics.length > 0 && (
                <div className="absolute z-50 w-full bg-slate-800 border border-slate-600 mt-1 rounded shadow-lg max-h-32 overflow-y-auto">
                    {allTopics.filter(t => t.toLowerCase().includes(topic.toLowerCase())).map(t => (
                        <div key={t} className="px-3 py-2 text-sm hover:bg-slate-700 cursor-pointer" onClick={() => { setTopic(t); setShowTopicSuggestions(false); }}>
                            {t}
                        </div>
                    ))}
                </div>
            )}
          </div>

          <div className="relative">
            <div className="flex justify-between items-end mb-1">
                <label className="block text-xs font-medium text-slate-400">Keywords</label>
                <button 
                  onClick={() => triggerAiGeneration(extractedText)}
                  disabled={isAiGenerating || !extractedText}
                  className="text-[10px] flex items-center gap-1 text-blue-400 hover:text-blue-300 disabled:text-slate-600"
                >
                   {isAiGenerating ? <Loader2 size={12} className="animate-spin"/> : <Wand2 size={12} />}
                   Regenerate AI
                </button>
            </div>
            <input 
              type="text" 
              value={currentKeyword}
              onChange={(e) => { setCurrentKeyword(e.target.value); setShowKeywordSuggestions(true); }}
              onKeyDown={handleKeywordKeyDown}
              placeholder="Type & Press Enter"
              className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm"
            />
             {showKeywordSuggestions && allKeywords.length > 0 && (
                <div className="absolute z-50 w-full bg-slate-800 border border-slate-600 mt-1 rounded shadow-lg max-h-32 overflow-y-auto">
                    {allKeywords.filter(k => k.toLowerCase().includes(currentKeyword.toLowerCase()) && !keywords.includes(k)).map(k => (
                        <div key={k} className="px-3 py-2 text-sm hover:bg-slate-700 cursor-pointer" onClick={() => addKeyword(k)}>
                            {k}
                        </div>
                    ))}
                </div>
            )}

            <div className="flex flex-wrap gap-1 mt-2">
              {keywords.map((k, i) => (
                <span key={i} className="bg-slate-700 text-slate-200 text-xs px-2 py-1 rounded flex items-center gap-1">
                  {k}
                  <button onClick={() => removeKeyword(i)} className="hover:text-red-400">×</button>
                </span>
              ))}
            </div>

            {smartSuggestions.length > 0 && (
                <div className="mt-3 animate-fade-in bg-slate-800/50 p-2 rounded border border-slate-700/50">
                    <p className="text-[10px] uppercase font-bold text-slate-500 mb-2 flex items-center gap-1">
                        <Sparkles size={10} className="text-purple-500 fill-purple-500"/> Gemini AI Suggestions
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {smartSuggestions.map(s => (
                            <button
                            key={s}
                            onClick={() => addKeyword(s)}
                            className="px-2 py-0.5 rounded-full bg-purple-900/20 border border-purple-500/30 text-xs text-purple-300 hover:bg-purple-500 hover:text-white transition-all"
                            >
                            + {s}
                            </button>
                        ))}
                    </div>
                </div>
            )}
             {isAiGenerating && (
                <div className="mt-2 flex items-center gap-2 text-xs text-purple-400 animate-pulse">
                    <Sparkles size={12} /> Gemini is analyzing text...
                </div>
             )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-700">
          <button 
            onClick={handleSaveQuestion}
            disabled={isSaving || isOcrRunning}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-wait text-white font-bold rounded flex items-center justify-center gap-2 shadow-lg transition-all"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {isOcrRunning ? 'Scanning Text...' : isSaving ? 'Saving...' : 'Save Question'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Batch Switcher */}
        {metadata.pdfPairs && metadata.pdfPairs.length > 1 && (
            <div className="bg-slate-800 border-b border-slate-700 p-2 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-hide">
                <div className="flex items-center gap-2 px-3 text-slate-500">
                    <Boxes size={16} /> <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Batches</span>
                </div>
                {metadata.pdfPairs.map((p, idx) => (
                    <button
                        key={p.id}
                        onClick={() => setActivePairIndex(idx)}
                        className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border whitespace-nowrap ${activePairIndex === idx ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'}`}
                    >
                        Batch {idx + 1}
                    </button>
                ))}
            </div>
        )}

        <div className="flex bg-slate-800 border-b border-slate-700 shrink-0">
          <button 
            onClick={() => setActiveTab('question')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'question' ? 'bg-slate-700 text-blue-400 border-b-2 border-blue-500' : 'text-slate-400 hover:bg-slate-800/50'}`}
          >
            <FileQuestion size={16} /> Question Paper
          </button>
          <button 
            onClick={() => setActiveTab('answer')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'answer' ? 'bg-slate-700 text-purple-400 border-b-2 border-purple-500' : 'text-slate-400 hover:bg-slate-800/50'}`}
          >
            <Layers size={16} /> Answer Key
          </button>
        </div>

        <div className="flex-1 relative overflow-hidden bg-slate-900">
           <div className={`absolute inset-0 ${activeTab === 'question' ? 'z-10' : 'z-0 invisible'}`}>
              {currentPair && (
                <PdfSnipper key={`q-${currentPair.id}`} file={currentPair.questionPdf} onSnip={handleSnip} label={`Batch ${activePairIndex + 1} - Question`} />
              )}
           </div>
           <div className={`absolute inset-0 ${activeTab === 'answer' ? 'z-10' : 'z-0 invisible'}`}>
              {currentPair && (
                <PdfSnipper key={`a-${currentPair.id}`} file={currentPair.answerPdf} onSnip={handleSnip} label={`Batch ${activePairIndex + 1} - Answer`} />
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default Workspace;
