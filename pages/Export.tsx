
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getQuestionsBySubject, getAllQuestions, getFoldersBySubject } from '../services/db';
import { ArrowLeft, FileText, FileJson, Download, Loader2, CheckSquare, Layout, FileType, RefreshCw } from 'lucide-react';
import { QuestionEntry, Folder, PaperType } from '../types';

declare global {
    interface Window {
        jspdf: any;
        docx: any;
    }
}

const Export: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const preSelectedSubject = location.state?.subject;

  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [exportScope, setExportScope] = useState<'all' | 'folders'>('all');
  const [availableFolders, setAvailableFolders] = useState<Folder[]>([]);
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());

  useEffect(() => {
      if (preSelectedSubject) {
          getFoldersBySubject(preSelectedSubject).then(setAvailableFolders);
      }
  }, [preSelectedSubject]);

  const toggleFolder = (id: string) => {
      const newSet = new Set(selectedFolderIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedFolderIds(newSet);
  };

  /**
   * Helper to compress raw base64 PNGs into optimized JPEGs to reduce export size.
   * Quality updated to 0.8 per user request for better resolution.
   */
  const compressImage = (src: string, quality = 0.8): Promise<string> => {
    return new Promise((resolve) => {
        if (!src) return resolve("");
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d')!;
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(src);
        img.src = src;
    });
  };

  const getQuestions = async () => {
      let allQuestions = preSelectedSubject 
        ? await getQuestionsBySubject(preSelectedSubject)
        : await getAllQuestions();

      if (exportScope === 'folders' && selectedFolderIds.size > 0) {
          const activeFolders = availableFolders.filter(f => selectedFolderIds.has(f.id));
          const matchingQuestions = new Map<string, QuestionEntry>();
          activeFolders.forEach(folder => {
              const matches = allQuestions.filter(q => {
                  if (folder.filterUncategorized) return q.topics.length === 0;
                  const matchesTopic = folder.filterTopics.length === 0 || folder.filterTopics.some(t => q.topics.includes(t));
                  return matchesTopic;
              });
              matches.forEach(q => matchingQuestions.set(q.id, q));
          });
          return Array.from(matchingQuestions.values());
      }
      return allQuestions;
  };

  const groupQuestionsHierarchically = (qs: QuestionEntry[]) => {
      const grouped: Record<string, Record<string, QuestionEntry[]>> = {};
      const sorted = qs.sort((a, b) => {
          if (a.paperType !== b.paperType) return a.paperType.localeCompare(b.paperType);
          if (b.year !== a.year) return b.year - a.year;
          if (b.month !== a.month) return b.month.localeCompare(a.month);
          return parseInt(a.questionNumber) - parseInt(b.questionNumber);
      });
      sorted.forEach(q => {
          if (!grouped[q.paperType]) grouped[q.paperType] = {};
          const dateKey = `${q.month} ${q.year}`;
          if (!grouped[q.paperType][dateKey]) grouped[q.paperType][dateKey] = [];
          grouped[q.paperType][dateKey].push(q);
      });
      return grouped;
  };

  const getImageDims = (src: string): Promise<{w: number, h: number}> => {
      return new Promise(res => { 
          const img = new Image(); 
          img.onload = () => res({w: img.width, h: img.height}); 
          img.onerror = () => res({w: 100, h: 100});
          img.src = src; 
      });
  };

  const handleExportHTML = async () => {
      setLoading(true);
      setStatusMessage("Compressing images for HTML Pack...");
      
      const rawQuestions = await getQuestions();
      const processedQuestions = [];

      for (const q of rawQuestions) {
          const processedParts = [];
          for (const p of q.parts) {
              const qImgs = [];
              const aImgs = [];
              for (const img of (p.questionImages || (p.questionImage ? [p.questionImage] : []))) {
                  qImgs.push(await compressImage(img, 0.8));
              }
              for (const img of (p.answerImages || (p.answerImage ? [p.answerImage] : []))) {
                  aImgs.push(await compressImage(img, 0.8));
              }
              processedParts.push({ ...p, questionImages: qImgs, answerImages: aImgs });
          }
          processedQuestions.push({ ...q, parts: processedParts });
      }
      
      const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Repository: ${preSelectedSubject || 'PaperCut'}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <style>
        body { background-color: #0f172a; color: white; font-family: sans-serif; scroll-behavior: smooth; }
        .tab-active { background-color: #1e293b; color: #60a5fa; border-bottom: 3px solid #3b82f6; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-up { animation: slideUp 0.4s ease-out; }
    </style>
</head>
<body class="antialiased">
    <div id="app" class="h-screen flex flex-col">
        <nav class="bg-slate-900 border-b border-slate-800 flex justify-center shrink-0 shadow-2xl z-50">
            <button onclick="switchTab('practice')" id="tab-practice" class="px-10 py-5 text-sm font-black tab-active transition-all uppercase tracking-widest">Study Session</button>
            <button onclick="switchTab('repository')" id="tab-repository" class="px-10 py-5 text-sm font-black text-slate-500 hover:text-white transition-all uppercase tracking-widest">Library Browser</button>
        </nav>
        <main id="content" class="flex-1 overflow-y-auto bg-slate-900"></main>
    </div>

    <!-- Zoom Overlay -->
    <div id="zoom-overlay" class="fixed inset-0 bg-black/95 z-[100] hidden flex-col items-center justify-center animate-up cursor-zoom-out" onclick="closeZoom()">
        <button class="absolute top-8 right-8 text-white/50 hover:text-white p-3 bg-white/10 rounded-full transition-all">✕</button>
        <div class="p-4 text-white/30 text-[10px] font-black uppercase tracking-[0.2em] absolute top-8 left-8 bg-black/50 rounded-full border border-white/5">Click outside or press ESC to close</div>
        <img id="zoom-img" class="max-w-[92%] max-h-[92%] object-contain shadow-2xl rounded-2xl border border-white/10" onclick="event.stopPropagation()">
    </div>

    <script id="questions-data" type="application/json">${JSON.stringify(processedQuestions)}</script>

    <script>
        const questions = JSON.parse(document.getElementById('questions-data').textContent);
        let currentTab = 'practice';
        let currentPracticeIndex = 0;
        const revealedSets = new Set();
        const selectedForPdf = new Set();
        const userMcqChoices = {}; // Store { 'practiceIndex_partIndex': 'A' }

        function switchTab(tab) {
            currentTab = tab;
            document.querySelectorAll('nav button').forEach(b => b.classList.remove('tab-active', 'text-slate-500'));
            document.getElementById('tab-' + tab).classList.add('tab-active');
            render();
        }

        function zoomImage(src) {
            const overlay = document.getElementById('zoom-overlay');
            const img = document.getElementById('zoom-img');
            img.src = src;
            overlay.classList.remove('hidden');
            overlay.classList.add('flex');
            document.body.style.overflow = 'hidden';
        }

        function closeZoom() {
            const overlay = document.getElementById('zoom-overlay');
            overlay.classList.add('hidden');
            overlay.classList.remove('flex');
            document.body.style.overflow = 'auto';
        }

        document.addEventListener('keydown', e => { if(e.key === 'Escape') closeZoom(); });

        function handleMcqChoice(qIdx, pIdx, choice) {
            userMcqChoices[qIdx + '_' + pIdx] = choice;
            revealedSets.add(qIdx + '_' + pIdx);
            render();
        }

        function render() {
            const main = document.getElementById('content');
            main.innerHTML = '';
            if (currentTab === 'practice') renderPractice(main);
            else renderRepository(main);
        }

        function renderPractice(container) {
            const q = questions[currentPracticeIndex];
            if (!q) { container.innerHTML = '<div class="flex items-center justify-center h-full text-slate-500 font-bold">No questions matching selection.</div>'; return; }
            
            const isPaper1 = q.paperType.toLowerCase().includes('paper 1');

            const div = document.createElement('div');
            div.className = 'max-w-4xl mx-auto p-6 md:p-10 space-y-10 pb-64 animate-up';
            div.innerHTML = \`
                <div class="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl flex justify-between items-center">
                    <div>
                        <div class="text-blue-400 font-black text-xl mb-1 uppercase tracking-tighter">\${q.year} \${q.month} • \${q.paperType}</div>
                        <div class="flex flex-wrap gap-2 mt-2">\${q.topics.map(t => \`<span class="text-[10px] bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full border border-blue-500/20 font-black uppercase tracking-wider">\${t}</span>\`).join('')}</div>
                    </div>
                    <div class="text-right text-slate-500 font-mono text-sm tracking-widest">Q\${q.questionNumber} • \${currentPracticeIndex + 1}/\${questions.length}</div>
                </div>

                \${q.parts.map((p, pIdx) => {
                    const id = currentPracticeIndex + '_' + pIdx;
                    const isRevealed = revealedSets.has(id);
                    const choice = userMcqChoices[id];

                    return \`
                    <div class="bg-slate-800 p-8 md:p-12 rounded-[2.5rem] border border-slate-700 shadow-2xl space-y-8">
                        <div class="flex items-center gap-4 mb-4">
                            <span class="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-lg">\${p.label === 'i' ? (currentPracticeIndex+1) : p.label}</span>
                            <h3 class="font-bold text-2xl text-slate-200 uppercase tracking-tight">Question Section</h3>
                        </div>
                        
                        <div class="space-y-6">
                            \${p.questionImages.map(img => \`<img src="\${img}" onclick="zoomImage('\${img}')" class="w-full rounded-2xl bg-white p-4 shadow-xl border border-slate-700 cursor-zoom-in hover:brightness-95 transition-all" />\`).join('')}
                        </div>

                        \${isPaper1 && p.answerText ? \`
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                                \${['A', 'B', 'C', 'D'].map(opt => {
                                    const isCorrect = opt === p.answerText;
                                    const isSelected = choice === opt;
                                    let btnClass = "py-6 rounded-2xl font-black text-2xl border-2 transition-all flex items-center justify-center ";
                                    if (!choice) btnClass += "bg-slate-700 border-slate-600 hover:border-blue-500 text-slate-200 active:scale-95";
                                    else if (isCorrect) btnClass += "bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]";
                                    else if (isSelected) btnClass += "bg-red-500/20 border-red-500 text-red-400";
                                    else btnClass += "bg-slate-800 border-slate-700 text-slate-600 opacity-40";

                                    return \`<button onclick="handleMcqChoice(\${currentPracticeIndex}, \${pIdx}, '\${opt}')" \${choice ? 'disabled' : ''} class="\${btnClass}">\${opt}</button>\`;
                                }).join('')}
                            </div>
                        \` : ''}

                        <div class="pt-6">
                            \${!isRevealed ? 
                                \`<button onclick="togglePart('\${id}')" class="w-full py-6 bg-slate-700 hover:bg-blue-600 rounded-2xl font-black text-lg transition-all border border-slate-600 shadow-lg">REVEAL SOLUTION</button>\` :
                                \`<div class="bg-slate-900 p-10 rounded-3xl border-2 border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.1)] animate-up">
                                    <div class="flex justify-between items-center mb-6">
                                        <span class="text-xs text-emerald-500 font-black uppercase tracking-widest">Solution Key</span>
                                        <button onclick="togglePart('\${id}')" class="text-slate-500 text-xs font-bold hover:text-white transition-colors">HIDE</button>
                                    </div>
                                    \${p.answerText ? \`<div class="text-7xl font-black mb-8 text-emerald-400 text-center uppercase tracking-tighter">\${p.answerText}</div>\` : ''}
                                    <div class="space-y-6">
                                        \${p.answerImages.map(img => \`<img src="\${img}" onclick="zoomImage('\${img}')" class="w-full rounded-2xl bg-white p-4 shadow-xl border border-slate-700 cursor-zoom-in hover:brightness-95 transition-all" />\`).join('')}
                                    </div>
                                </div>\`
                            }
                        </div>
                    </div>
                    \`;
                }).join('')}

                <div class="fixed bottom-0 left-0 right-0 p-8 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 flex justify-center items-center gap-6 z-50">
                    <button onclick="move(-1)" class="px-10 py-5 bg-slate-800 hover:bg-slate-700 rounded-2xl font-black transition-all border border-slate-700 flex items-center justify-center">PREV</button>
                    <button onclick="move(1)" class="px-12 py-5 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black shadow-2xl shadow-blue-600/30 transition-all flex items-center justify-center">NEXT QUESTION</button>
                </div>
            \`;
            container.appendChild(div);
        }

        function renderRepository(container) {
            const div = document.createElement('div');
            div.className = 'max-w-7xl mx-auto p-6 md:p-10 space-y-10 pb-40 animate-up';
            div.innerHTML = \`
                <div class="flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-800 p-10 rounded-3xl border border-slate-700 shadow-2xl">
                    <div>
                        <h2 class="text-4xl font-black uppercase tracking-tighter">Repository Browser</h2>
                        <p class="text-slate-400 font-medium mt-2">Select questions to generate a custom practice PDF.</p>
                    </div>
                    <button onclick="exportPdf()" class="px-10 py-5 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black shadow-2xl shadow-blue-600/40 transition-all">GENERATE PDF (\${selectedForPdf.size})</button>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    \${questions.map((q, i) => \`
                    <div class="bg-slate-800 rounded-[2rem] border-2 transition-all overflow-hidden cursor-pointer group \${selectedForPdf.has(i) ? 'border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.2)]' : 'border-slate-700 hover:border-slate-500'}" onclick="toggleSelect(\${i})">
                        <div class="p-8">
                            <div class="flex justify-between items-start mb-6">
                                <div>
                                    <h4 class="font-black text-2xl text-slate-100 tracking-tighter">\${q.year} \${q.month}</h4>
                                    <span class="text-[10px] text-slate-500 font-black uppercase tracking-widest">Q\${q.questionNumber} • \${q.paperType}</span>
                                </div>
                                <div class="w-10 h-10 border-2 rounded-2xl flex items-center justify-center transition-all \${selectedForPdf.has(i) ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-700 text-transparent'}">✓</div>
                            </div>
                            <div class="h-48 bg-white rounded-2xl mb-6 overflow-hidden flex items-center justify-center p-4">
                                <img src="\${q.parts[0]?.questionImages?.[0]}" class="max-w-full max-h-full object-contain" />
                            </div>
                            <div class="flex flex-wrap gap-1.5 mb-8">\${q.topics.slice(0, 3).map(t => \`<span class="text-[9px] bg-slate-900 px-2.5 py-1 rounded-full border border-slate-700 uppercase font-black text-slate-500">\${t}</span>\`).join('')}\${q.topics.length > 3 ? '<span class="text-[9px] text-slate-600 px-1">...</span>' : ''}</div>
                            <div class="flex justify-between items-center pt-6 border-t border-slate-700/50">
                                <span class="text-[10px] text-slate-500 uppercase font-black tracking-widest">LOCAL DATA READY</span>
                                <button onclick="event.stopPropagation(); currentPracticeIndex=\${i}; switchTab('practice')" class="text-xs text-blue-400 font-black hover:underline transition-all">LAUNCH →</button>
                            </div>
                        </div>
                    </div>\`).join('')}
                </div>
            \`;
            container.appendChild(div);
        }

        function togglePart(id) { if(revealedSets.has(id)) revealedSets.delete(id); else revealedSets.add(id); render(); }
        function move(d) { currentPracticeIndex = Math.max(0, Math.min(questions.length - 1, currentPracticeIndex + d)); revealedSets.clear(); render(); }
        function toggleSelect(i) { if(selectedForPdf.has(i)) selectedForPdf.delete(i); else selectedForPdf.add(i); render(); }

        async function exportPdf() {
            if(selectedForPdf.size === 0) { alert('Select questions in the browser first.'); return; }
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            let y = 20;
            const margin = 20;
            const selected = Array.from(selectedForPdf).map(i => questions[i]);
            
            doc.setFontSize(22);
            doc.text('Custom Question Pack', margin, y);
            y += 20;

            for(const q of selected) {
                if(y > 250) { doc.addPage(); y = 20; }
                doc.setFontSize(14);
                doc.setTextColor(50, 50, 50);
                doc.text(\`\${q.year} \${q.month} - Q\${q.questionNumber} (\${q.topics.join(', ')})\`, margin, y);
                y += 10;
                for(const p of q.parts) {
                    for(const img of p.questionImages) {
                        try {
                            const dims = await getImageDims(img);
                            const h = (dims.h * 170) / dims.w;
                            if(y + h > 280) { doc.addPage(); y = 20; }
                            doc.addImage(img, 'JPEG', margin, y, 170, h);
                            y += h + 10;
                        } catch(e) {}
                    }
                }
                y += 10;
                doc.setDrawColor(200);
                doc.line(margin, y, 190, y);
                y += 15;
            }
            doc.save('Portable_Custom_Pack.pdf');
        }

        function getImageDims(src) { return new Promise(res => { const img = new Image(); img.onload = () => res({w: img.width, h: img.height}); img.src = src; }); }
        render();
    </script>
</body>
</html>`;

      const blob = new Blob([htmlTemplate], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `PaperCut_Portable_${preSelectedSubject || 'Export'}_${Date.now()}.html`;
      link.click();
      URL.revokeObjectURL(url);
      setLoading(false);
      setStatusMessage("");
  };

  const handleExportPDF = async () => {
    if (!window.jspdf) return;
    setLoading(true);
    setStatusMessage("Compressing images & formatting PDF...");
    try {
        const questions = await getQuestions();
        const grouped = groupQuestionsHierarchically(questions);
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        let y = 20;
        const margin = 20;
        const pageWidth = doc.internal.pageSize.width;
        const maxW = pageWidth - margin * 2;

        for (const paperType of Object.keys(grouped)) {
            if (y > 20) { doc.addPage(); y = 20; }
            doc.setFontSize(24);
            doc.setTextColor(30, 41, 59);
            doc.text(paperType, margin, y);
            y += 15;

            for (const dateKey of Object.keys(grouped[paperType])) {
                if (y > 260) { doc.addPage(); y = 20; }
                doc.setFontSize(18);
                doc.setTextColor(71, 85, 105);
                doc.text(dateKey, margin, y);
                y += 12;

                for (const q of grouped[paperType][dateKey]) {
                    if (y > 270) { doc.addPage(); y = 20; }
                    doc.setFontSize(12);
                    doc.setTextColor(0, 0, 0);
                    const topicStr = q.topics.length > 0 ? ` [Topics: ${q.topics.join(', ')}]` : '';
                    doc.text(`Question ${q.questionNumber}${topicStr}`, margin, y);
                    y += 10;

                    for (const p of q.parts) {
                        const qImgs = p.questionImages || (p.questionImage ? [p.questionImage] : []);
                        for (const img of qImgs) {
                            const compressed = await compressImage(img, 0.8);
                            const dims = await getImageDims(compressed);
                            const h = (dims.h * maxW) / dims.w;
                            if (y + h > 280) { doc.addPage(); y = 20; }
                            doc.addImage(compressed, 'JPEG', margin, y, maxW, h, undefined, 'FAST');
                            y += h + 8;
                        }

                        doc.setFontSize(10);
                        doc.setTextColor(16, 185, 129);
                        if (paperType === PaperType.PAPER_1 && p.answerText) {
                            if (y > 280) { doc.addPage(); y = 20; }
                            doc.text(`Answer: ${p.answerText}`, margin, y);
                            y += 12;
                        } else {
                            if (y > 280) { doc.addPage(); y = 20; }
                            doc.text("ANSWER:", margin, y);
                            y += 6;
                            const aImgs = p.answerImages || (p.answerImage ? [p.answerImage] : []);
                            for (const img of aImgs) {
                                const compressed = await compressImage(img, 0.8);
                                const dims = await getImageDims(compressed);
                                const h = (dims.h * maxW) / dims.w;
                                if (y + h > 280) { doc.addPage(); y = 20; }
                                doc.addImage(compressed, 'JPEG', margin, y, maxW, h, undefined, 'FAST');
                                y += h + 8;
                            }
                        }
                    }
                    y += 10;
                    doc.setDrawColor(220, 220, 220);
                    doc.line(margin, y, pageWidth - margin, y);
                    y += 15;
                }
            }
        }
        doc.save(`${preSelectedSubject || 'PaperCut'}_Export.pdf`);
    } catch (e) {
        console.error(e);
        alert("PDF Export failed.");
    } finally { setLoading(false); }
  };

  const handleExportWord = async () => {
    if (!window.docx) return;
    setLoading(true);
    setStatusMessage("Building Word Doc (Optimized)...");
    try {
        const questions = await getQuestions();
        const grouped = groupQuestionsHierarchically(questions);
        const { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType } = window.docx;

        const sections = [];
        for (const paperType of Object.keys(grouped)) {
            const children: any[] = [
                new Paragraph({ text: paperType, heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } })
            ];
            for (const dateKey of Object.keys(grouped[paperType])) {
                children.push(new Paragraph({ text: dateKey, heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 200 } }));
                for (const q of grouped[paperType][dateKey]) {
                    const topicStr = q.topics.length > 0 ? ` (Topics: ${q.topics.join(', ')})` : '';
                    children.push(new Paragraph({
                        children: [new TextRun({ text: `Question ${q.questionNumber}${topicStr}`, bold: true, size: 28 })],
                        spacing: { before: 200 }
                    }));
                    for (const p of q.parts) {
                        const qImgs = p.questionImages || (p.questionImage ? [p.questionImage] : []);
                        for (const img of qImgs) {
                            const compressed = await compressImage(img, 0.8);
                            const dims = await getImageDims(compressed);
                            const base64 = compressed.split(',')[1];
                            children.push(new Paragraph({
                                children: [new ImageRun({ data: Uint8Array.from(atob(base64), c => c.charCodeAt(0)), transformation: { width: 500, height: (500 * dims.h) / dims.w } })],
                                alignment: AlignmentType.CENTER
                            }));
                        }
                        if (paperType === PaperType.PAPER_1 && p.answerText) {
                            children.push(new Paragraph({ children: [new TextRun({ text: `Answer: ${p.answerText}`, bold: true, color: "10B981" })] }));
                        } else {
                            children.push(new Paragraph({ children: [new TextRun({ text: "ANSWER:", bold: true })] }));
                            const aImgs = p.answerImages || (p.answerImage ? [p.answerImage] : []);
                            for (const img of aImgs) {
                                const compressed = await compressImage(img, 0.8);
                                const dims = await getImageDims(compressed);
                                const base64 = compressed.split(',')[1];
                                children.push(new Paragraph({
                                    children: [new ImageRun({ data: Uint8Array.from(atob(base64), c => c.charCodeAt(0)), transformation: { width: 500, height: (500 * dims.h) / dims.w } })],
                                    alignment: AlignmentType.CENTER
                                }));
                            }
                        }
                    }
                }
            }
            sections.push({ children });
        }

        const doc = new Document({ sections });
        const blob = await Packer.toBlob(doc);
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${preSelectedSubject || 'PaperCut'}_Export.docx`;
        link.click();
    } catch (e) {
        console.error(e);
        alert("Word Export failed.");
    } finally { setLoading(false); }
  };

  const handleExportJSON = async () => {
      setLoading(true);
      const questions = await getQuestions();
      const blob = new Blob([JSON.stringify(questions, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `PaperCut_Backup_${Date.now()}.json`;
      link.click();
      setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 p-8 flex items-center justify-center">
      <div className="max-w-2xl w-full bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 border border-slate-200 dark:border-slate-700">
          <button onClick={() => navigate(-1)} className="mb-6 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-2">
              <ArrowLeft size={18}/> Back
          </button>
          <h1 className="text-3xl font-bold mb-2">Export Session</h1>
          <p className="text-slate-500 mb-8 font-medium">Export structure: Paper Type, Date, Question, Answer.</p>

          <div className="mb-8 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
               <h3 className="font-bold text-xs uppercase text-slate-500 mb-4 tracking-widest">Select Scope</h3>
               <div className="flex gap-4 mb-6">
                   <button onClick={() => setExportScope('all')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${exportScope === 'all' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white dark:bg-slate-800 border'}`}>Full Subject</button>
                   <button onClick={() => setExportScope('folders')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${exportScope === 'folders' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white dark:bg-slate-800 border'}`}>Smart Folders</button>
               </div>
               {exportScope === 'folders' && (
                   <div className="grid grid-cols-2 gap-2">
                       {availableFolders.map(f => (
                           <div key={f.id} onClick={() => toggleFolder(f.id)} className={`flex items-center gap-2 p-3 rounded-xl cursor-pointer border transition-all ${selectedFolderIds.has(f.id) ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-600' : 'bg-white dark:bg-slate-800'}`}>
                               <CheckSquare size={18} className={selectedFolderIds.has(f.id) ? "text-blue-500" : "text-slate-300"}/> <span className="text-xs font-bold truncate">{f.name}</span>
                           </div>
                       ))}
                   </div>
               )}
          </div>

          <div className="space-y-4">
              <button onClick={handleExportHTML} disabled={loading} className="w-full p-6 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-3xl flex items-center gap-5 hover:scale-[1.02] transition-all group">
                  <div className="p-4 bg-blue-600 text-white rounded-2xl shadow-xl group-hover:rotate-6 transition-transform"><Layout size={32}/></div>
                  <div className="text-left">
                      <div className="font-black text-blue-900 dark:text-blue-200 text-xl tracking-tight">Interactive HTML App</div>
                      <div className="text-[10px] text-blue-600 font-black uppercase tracking-widest">Single Standalone File • Browser Optimized</div>
                  </div>
              </button>
              <div className="grid grid-cols-2 gap-4">
                  <button onClick={handleExportPDF} disabled={loading} className="p-5 bg-slate-100 dark:bg-slate-700 rounded-3xl flex items-center gap-4 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all">
                      <FileText size={28} className="text-red-500 shrink-0" />
                      <div className="text-left"><div className="font-bold">PDF Doc</div><div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Print Ready</div></div>
                  </button>
                  <button onClick={handleExportWord} disabled={loading} className="p-5 bg-slate-100 dark:bg-slate-700 rounded-3xl flex items-center gap-4 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all">
                      <FileType size={28} className="text-blue-500 shrink-0" />
                      <div className="text-left"><div className="font-bold">Word</div><div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Editable</div></div>
                  </button>
              </div>
              <button onClick={handleExportJSON} disabled={loading} className="w-full p-4 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center gap-4 opacity-60 grayscale hover:grayscale-0 transition-all">
                  <Download size={20} className="text-amber-500" />
                  <div className="text-left"><div className="text-sm font-bold">JSON Backup</div></div>
              </button>
          </div>
          {loading && <div className="mt-8 text-center text-blue-500 font-black flex items-center justify-center gap-3 animate-pulse uppercase tracking-widest text-xs"><RefreshCw className="animate-spin" size={16} /> {statusMessage || 'Processing...'}</div>}
      </div>
    </div>
  );
};

export default Export;
