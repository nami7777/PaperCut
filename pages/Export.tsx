
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getQuestionsBySubject, getAllQuestions, getFoldersBySubject } from '../services/db';
import { ArrowLeft, FileText, FileJson, Download, Loader2, CheckSquare, Layout, Tag, FileType, RefreshCw } from 'lucide-react';
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

  const handleExportPDF = async () => {
    if (!window.jspdf) return;
    setLoading(true);
    setStatusMessage("Generating PDF structure...");
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
            // Paper Type Heading (Heading 1)
            if (y > 20) { doc.addPage(); y = 20; }
            doc.setFontSize(22);
            doc.setTextColor(30, 41, 59);
            doc.text(paperType, margin, y);
            y += 15;

            for (const dateKey of Object.keys(grouped[paperType])) {
                // Year/Month Subheading (Heading 2)
                if (y > 260) { doc.addPage(); y = 20; }
                doc.setFontSize(16);
                doc.setTextColor(71, 85, 105);
                doc.text(dateKey, margin, y);
                y += 10;

                for (const q of grouped[paperType][dateKey]) {
                    // Question Info
                    if (y > 270) { doc.addPage(); y = 20; }
                    doc.setFontSize(12);
                    doc.setTextColor(0, 0, 0);
                    const topicStr = q.topics.length > 0 ? ` [Topics: ${q.topics.join(', ')}]` : '';
                    doc.text(`Question ${q.questionNumber}${topicStr}`, margin, y);
                    y += 8;

                    for (const p of q.parts) {
                        // Question Images
                        const qImgs = p.questionImages || (p.questionImage ? [p.questionImage] : []);
                        for (const img of qImgs) {
                            const dims = await getImageDims(img);
                            const h = (dims.h * maxW) / dims.w;
                            if (y + h > 280) { doc.addPage(); y = 20; }
                            doc.addImage(img, 'PNG', margin, y, maxW, h);
                            y += h + 5;
                        }

                        // Answer Logic
                        doc.setFontSize(10);
                        doc.setTextColor(16, 185, 129); // Emerald
                        if (paperType === PaperType.PAPER_1 && p.answerText) {
                            if (y > 280) { doc.addPage(); y = 20; }
                            doc.text(`Answer: ${p.answerText}`, margin, y);
                            y += 10;
                        } else {
                            if (y > 280) { doc.addPage(); y = 20; }
                            doc.text("ANSWER:", margin, y);
                            y += 5;
                            const aImgs = p.answerImages || (p.answerImage ? [p.answerImage] : []);
                            for (const img of aImgs) {
                                const dims = await getImageDims(img);
                                const h = (dims.h * maxW) / dims.w;
                                if (y + h > 280) { doc.addPage(); y = 20; }
                                doc.addImage(img, 'PNG', margin, y, maxW, h);
                                y += h + 5;
                            }
                        }
                        y += 5;
                    }
                    y += 10;
                    doc.setDrawColor(226, 232, 240);
                    doc.line(margin, y, pageWidth - margin, y);
                    y += 15;
                }
            }
        }
        doc.save(`${preSelectedSubject || 'PaperCut'}_Questions.pdf`);
    } catch (e) {
        console.error(e);
        alert("PDF Generation failed.");
    } finally { setLoading(false); }
  };

  const handleExportWord = async () => {
    if (!window.docx) return;
    setLoading(true);
    setStatusMessage("Building Word Document...");
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
                            try {
                                const base64 = img.split(',')[1];
                                const dims = await getImageDims(img);
                                children.push(new Paragraph({
                                    children: [new ImageRun({ data: Uint8Array.from(atob(base64), c => c.charCodeAt(0)), transformation: { width: 500, height: (500 * dims.h) / dims.w } })],
                                    alignment: AlignmentType.CENTER
                                }));
                            } catch (err) {}
                        }

                        if (paperType === PaperType.PAPER_1 && p.answerText) {
                            children.push(new Paragraph({
                                children: [new TextRun({ text: `Answer: ${p.answerText}`, bold: true, color: "10B981" })],
                                spacing: { before: 100 }
                            }));
                        } else {
                            children.push(new Paragraph({ 
                                children: [new TextRun({ text: "ANSWER:", bold: true })], 
                                spacing: { before: 100 } 
                            }));
                            const aImgs = p.answerImages || (p.answerImage ? [p.answerImage] : []);
                            for (const img of aImgs) {
                                try {
                                    const base64 = img.split(',')[1];
                                    const dims = await getImageDims(img);
                                    children.push(new Paragraph({
                                        children: [new ImageRun({ data: Uint8Array.from(atob(base64), c => c.charCodeAt(0)), transformation: { width: 500, height: (500 * dims.h) / dims.w } })],
                                        alignment: AlignmentType.CENTER
                                    }));
                                } catch (err) {}
                            }
                        }
                    }
                }
            }
            sections.push({ children });
        }

        const doc = new Document({ sections });
        const blob = await Packer.toBlob(doc);
        downloadBlob(blob, `${preSelectedSubject || 'PaperCut'}_Export.docx`);
    } catch (e) {
        console.error(e);
        alert("Word Export failed.");
    } finally { setLoading(false); }
  };

  const handleExportHTML = async () => {
      setLoading(true);
      setStatusMessage("Generating Interactive HTML App...");
      const questions = await getQuestions();
      
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
        body { background-color: #0f172a; color: white; font-family: sans-serif; }
        .tab-active { background-color: #1e293b; color: #60a5fa; border-bottom: 2px solid #3b82f6; }
        .hidden { display: none; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade { animation: fadeIn 0.3s ease-out; }
    </style>
</head>
<body class="antialiased">
    <div id="app" class="h-screen flex flex-col">
        <nav class="bg-slate-800 border-b border-slate-700 flex justify-center shrink-0">
            <button onclick="switchTab('practice')" id="tab-practice" class="px-8 py-4 text-sm font-bold tab-active">Practice Mode</button>
            <button onclick="switchTab('repository')" id="tab-repository" class="px-8 py-4 text-sm font-bold text-slate-400">Browser & Actions</button>
        </nav>
        <main id="content" class="flex-1 overflow-y-auto p-4 md:p-8"></main>
    </div>

    <script id="questions-data" type="application/json">${JSON.stringify(questions)}</script>

    <script>
        const questions = JSON.parse(document.getElementById('questions-data').textContent);
        let currentTab = 'practice';
        let currentPracticeIndex = 0;
        const revealedSets = new Set();
        const selectedForPdf = new Set();

        function switchTab(tab) {
            currentTab = tab;
            document.querySelectorAll('nav button').forEach(b => b.classList.remove('tab-active', 'text-slate-400'));
            document.getElementById('tab-' + tab).classList.add('tab-active');
            render();
        }

        function render() {
            const main = document.getElementById('content');
            if (currentTab === 'practice') renderPractice(main);
            else renderRepository(main);
        }

        function renderPractice(container) {
            const q = questions[currentPracticeIndex];
            if (!q) { container.innerHTML = '<div class="text-center py-20">No questions in this selection.</div>'; return; }
            
            container.innerHTML = \`
                <div class="max-w-3xl mx-auto space-y-8 pb-32 animate-fade">
                    <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700 flex justify-between">
                        <div>
                            <div class="text-blue-400 font-bold">\${q.year} \${q.month} • \${q.paperType}</div>
                            <div class="flex gap-1 mt-2">\${q.topics.map(t => \`<span class="text-[9px] bg-indigo-500/20 text-indigo-400 px-2 rounded-full border border-indigo-500/30 uppercase font-black">\${t}</span>\`).join('')}</div>
                        </div>
                        <div class="text-right"><span class="text-xs text-slate-500 font-bold">\${currentPracticeIndex + 1} / \${questions.length}</span></div>
                    </div>
                    \${q.parts.map((p, idx) => \`
                        <div class="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-xl">
                            <h3 class="font-bold text-xl mb-4 text-slate-300">Question \${p.label}</h3>
                            \${(p.questionImages || (p.questionImage ? [p.questionImage] : [])).map(img => \`<img src="\${img}" class="max-w-full rounded-xl bg-white p-2 mb-4" />\`).join('')}
                            <div class="mt-4">\${!revealedSets.has(currentPracticeIndex + '_' + idx) ? 
                                \`<button onclick="togglePart('\${currentPracticeIndex + '_' + idx}')" class="w-full py-4 bg-slate-700 rounded-xl font-bold border border-slate-600 hover:bg-slate-600">👁️ Reveal Solution</button>\` :
                                \`<div class="bg-slate-900 p-6 rounded-xl border border-emerald-500/30 animate-fade">
                                    <div class="flex justify-between items-center mb-4"><span class="text-xs text-emerald-500 font-bold uppercase tracking-widest">Answer Key</span><button onclick="togglePart('\${currentPracticeIndex + '_' + idx}')" class="text-slate-500 text-xs">Hide</button></div>
                                    \${p.answerText ? \`<div class="text-4xl font-black mb-4 text-emerald-400">\${p.answerText}</div>\` : ''}
                                    \${(p.answerImages || (p.answerImage ? [p.answerImage] : [])).map(img => \`<img src="\${img}" class="max-w-full rounded-xl bg-white p-2 mb-4" />\`).join('')}
                                </div>\`
                            }</div>
                        </div>
                    \`).join('')}
                    <div class="fixed bottom-0 left-0 right-0 p-6 bg-slate-900/90 backdrop-blur-xl border-t border-slate-700 flex justify-center gap-4">
                        <button onclick="move(-1)" class="px-8 py-4 bg-slate-800 rounded-xl font-bold">Previous</button>
                        <button onclick="move(1)" class="px-8 py-4 bg-blue-600 rounded-xl font-bold">Next Question</button>
                    </div>
                </div>\`;
        }

        function renderRepository(container) {
            container.innerHTML = \`
                <div class="max-w-6xl mx-auto animate-fade">
                    <div class="flex justify-between items-center mb-8 bg-slate-800 p-6 rounded-2xl border border-slate-700">
                        <div>
                            <h2 class="text-3xl font-bold">Browser & Repository</h2>
                            <p class="text-slate-400 text-sm mt-1">Select questions to generate a custom PDF pack.</p>
                        </div>
                        <button onclick="exportPdf()" class="px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold shadow-2xl shadow-blue-500/20 transition-all">Export Selection to PDF (\${selectedForPdf.size})</button>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        \${questions.map((q, i) => \`
                        <div class="bg-slate-800 p-6 rounded-2xl border \${selectedForPdf.has(i) ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-slate-700'} cursor-pointer hover:border-blue-400 transition-all" onclick="toggleSelect(\${i})">
                            <div class="flex justify-between items-start mb-4">
                                <div><h4 class="font-bold text-lg text-slate-200">\${q.year} \${q.month}</h4><span class="text-xs text-slate-500 font-bold uppercase tracking-widest">Q\${q.questionNumber} • \${q.paperType}</span></div>
                                <div class="w-8 h-8 border-2 rounded-xl flex items-center justify-center transition-all \${selectedForPdf.has(i) ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-600 text-transparent'}">✓</div>
                            </div>
                            <div class="h-40 bg-white rounded-xl mb-4 overflow-hidden flex items-center justify-center p-2"><img src="\${q.parts[0]?.questionImages?.[0] || q.parts[0]?.questionImage}" class="max-w-full max-h-full object-contain" /></div>
                            <div class="flex flex-wrap gap-1 mb-6">\${q.topics.map(t => \`<span class="text-[9px] bg-slate-900 px-2 py-1 rounded-full border border-slate-700 uppercase font-black tracking-tight text-slate-400">\${t}</span>\`).join('')}</div>
                            <div class="flex justify-between items-center pt-4 border-t border-slate-700">
                                <span class="text-[10px] text-slate-500 uppercase font-bold tracking-widest">\${localStorage.getItem('status_' + q.id) || 'Not Attempted'}</span>
                                <button onclick="event.stopPropagation(); currentPracticeIndex=\${i}; switchTab('practice')" class="text-xs text-blue-400 font-bold hover:underline">Launch Practice →</button>
                            </div>
                        </div>\`).join('')}
                    </div>
                </div>\`;
        }

        function togglePart(id) { if(revealedSets.has(id)) revealedSets.delete(id); else revealedSets.add(id); render(); }
        function move(d) { currentPracticeIndex = Math.max(0, Math.min(questions.length - 1, currentPracticeIndex + d)); revealedSets.clear(); render(); }
        function toggleSelect(i) { if(selectedForPdf.has(i)) selectedForPdf.delete(i); else selectedForPdf.add(i); render(); }

        async function exportPdf() {
            if(selectedForPdf.size === 0) { alert('Select at least one question from the browser.'); return; }
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            let y = 20;
            const margin = 20;
            const selected = Array.from(selectedForPdf).map(i => questions[i]);
            
            doc.setFontSize(22);
            doc.text('Custom Question Selection', margin, y);
            y += 20;

            for(const q of selected) {
                if(y > 250) { doc.addPage(); y = 20; }
                doc.setFontSize(14);
                doc.setTextColor(50, 50, 50);
                doc.text(\`\${q.year} \${q.month} - Q\${q.questionNumber} (\${q.topics.join(', ')})\`, margin, y);
                y += 10;
                for(const p of q.parts) {
                    const imgs = p.questionImages || [p.questionImage];
                    for(const img of imgs) {
                        try {
                            const dims = await getImageDims(img);
                            const h = (dims.h * 170) / dims.w;
                            if(y + h > 280) { doc.addPage(); y = 20; }
                            doc.addImage(img, 'PNG', margin, y, 170, h);
                            y += h + 10;
                        } catch(e) {}
                    }
                }
                y += 10;
            }
            doc.save('Custom_Question_Pack.pdf');
        }

        function getImageDims(src) { return new Promise(res => { const img = new Image(); img.onload = () => res({w: img.width, h: img.height}); img.src = src; }); }
        render();
    </script>
</body>
</html>`;

      const blob = new Blob([htmlTemplate], { type: "text/html" });
      downloadBlob(blob, `PaperCut_Interactive_Session_${Date.now()}.html`);
      setLoading(false);
      setStatusMessage("");
  };

  const handleExportJSON = async () => {
      setLoading(true);
      const questions = await getQuestions();
      const blob = new Blob([JSON.stringify(questions, null, 2)], { type: "application/json" });
      downloadBlob(blob, `PaperCut_Backup_${Date.now()}.json`);
      setLoading(false);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 p-8 flex items-center justify-center">
      <div className="max-w-2xl w-full bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 border border-slate-200 dark:border-slate-700">
          <button onClick={() => navigate(-1)} className="mb-6 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-2">
              <ArrowLeft size={18}/> Back
          </button>
          <h1 className="text-3xl font-bold mb-2">Export Session</h1>
          <p className="text-slate-500 mb-8">Export with hierarchical Paper & Date subheadings.</p>

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

          <div className="space-y-3">
              <button onClick={handleExportHTML} disabled={loading} className="w-full p-5 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-all flex items-center gap-4 group">
                  <div className="p-3 bg-indigo-600 text-white rounded-xl group-hover:scale-110 transition-transform"><Layout size={24} /></div>
                  <div className="text-left"><div className="font-bold text-indigo-900 dark:text-indigo-200">Interactive HTML Pack</div><div className="text-[10px] text-indigo-600/60 uppercase font-black tracking-widest">Standalone Browser + PDF Export</div></div>
              </button>
              <div className="grid grid-cols-2 gap-3">
                  <button onClick={handleExportPDF} disabled={loading} className="p-5 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center gap-4 hover:bg-slate-200 transition-all">
                      <FileText size={28} className="text-red-500 shrink-0" />
                      <div className="text-left"><div className="font-bold">PDF Doc</div><div className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Paper Hierachy</div></div>
                  </button>
                  <button onClick={handleExportWord} disabled={loading} className="p-5 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center gap-4 hover:bg-slate-200 transition-all">
                      <FileType size={28} className="text-blue-500 shrink-0" />
                      <div className="text-left"><div className="font-bold">Word .docx</div><div className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Full Restore</div></div>
                  </button>
              </div>
              <button onClick={handleExportJSON} disabled={loading} className="w-full p-4 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center gap-4 opacity-60 grayscale hover:grayscale-0 transition-all">
                  <Download size={20} className="text-amber-500" />
                  <div className="text-left"><div className="text-sm font-bold">JSON Backup</div></div>
              </button>
          </div>
          {loading && <div className="mt-8 text-center text-blue-500 font-bold flex items-center justify-center gap-3 animate-pulse"><RefreshCw className="animate-spin" /> {statusMessage || 'Preparing Export...'}</div>}
      </div>
    </div>
  );
};

export default Export;
