
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getQuestionsBySubject, getAllQuestions, getFoldersBySubject } from '../services/db';
import { ArrowLeft, FileText, FileJson, Download, Loader2, Folder as FolderIcon, CheckSquare, Square, Globe, Layout } from 'lucide-react';
import { QuestionEntry, Folder } from '../types';

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
  
  // Selection State
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
      // 1. Get Base Questions
      let allQuestions = preSelectedSubject 
        ? await getQuestionsBySubject(preSelectedSubject)
        : await getAllQuestions();

      // 2. Filter if scope is 'folders'
      if (exportScope === 'folders' && selectedFolderIds.size > 0) {
          const activeFolders = availableFolders.filter(f => selectedFolderIds.has(f.id));
          const matchingQuestions = new Map<string, QuestionEntry>();
          
          activeFolders.forEach(folder => {
              const matches = allQuestions.filter(q => {
                  const matchesKeyword = folder.filterKeywords.length === 0 || folder.filterKeywords.some(k => q.keywords.includes(k));
                  const matchesTopic = folder.filterTopics.length === 0 || folder.filterTopics.some(t => q.topics.includes(t));
                  return matchesKeyword && matchesTopic;
              });
              matches.forEach(q => matchingQuestions.set(q.id, q));
          });
          
          return Array.from(matchingQuestions.values());
      }

      return allQuestions;
  };

  const handleExportJSON = async () => {
      setLoading(true);
      setStatusMessage("Generating JSON...");
      const questions = await getQuestions();
      const jsonString = JSON.stringify(questions, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      downloadBlob(blob, `PaperCut_Export_${Date.now()}.json`);
      setLoading(false);
      setStatusMessage("");
  };

  const handleExportHTML = async () => {
      setLoading(true);
      setStatusMessage("Generating Interactive Practice Webpage...");
      const questions = await getQuestions();
      
      const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Practice: ${preSelectedSubject || 'PaperCut Export'}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background-color: #0f172a; color: white; font-family: sans-serif; }
        .revealed { display: block !important; }
        .hidden { display: none; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }
        @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up { animation: slideUp 0.3s ease-out; }
    </style>
</head>
<body class="antialiased overflow-x-hidden">
    <div id="app" class="min-h-screen flex flex-col">
        <!-- Header -->
        <div class="sticky top-0 z-50 bg-slate-800 border-b border-slate-700 p-4 shadow-xl">
            <div class="max-w-4xl mx-auto flex justify-between items-center">
                <div>
                    <h1 class="font-bold text-lg text-blue-400">${preSelectedSubject || 'PaperCut'} Practice</h1>
                    <p id="progress-text" class="text-xs text-slate-400">Loading...</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="prevQ()" class="p-2 hover:bg-slate-700 rounded-lg transition-colors">←</button>
                    <button onclick="nextQ()" class="p-2 hover:bg-slate-700 rounded-lg transition-colors">→</button>
                </div>
            </div>
        </div>

        <!-- Main Content -->
        <main class="flex-1 p-4 md:p-8 flex justify-center overflow-y-auto">
            <div id="question-container" class="max-w-3xl w-full space-y-8 pb-32">
                <!-- Content Injected Here -->
            </div>
        </main>

        <!-- Fixed Tagging Footer -->
        <footer class="fixed bottom-0 left-0 right-0 p-4 bg-slate-900/80 backdrop-blur-lg border-t border-slate-800 z-50">
            <div class="max-w-3xl mx-auto grid grid-cols-3 gap-4">
                <button onclick="tag('Easy')" class="py-3 bg-emerald-900/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-400 rounded-xl flex flex-col items-center gap-1 font-medium transition-colors">
                    <span class="text-lg">👍</span> Easy
                </button>
                <button onclick="tag('Review')" class="py-3 bg-amber-900/40 hover:bg-amber-900/60 border border-amber-500/30 text-amber-400 rounded-xl flex flex-col items-center gap-1 font-medium transition-colors">
                    <span class="text-lg">⏰</span> Review
                </button>
                <button onclick="tag('Hard')" class="py-3 bg-red-900/40 hover:bg-red-900/60 border border-red-500/30 text-red-400 rounded-xl flex flex-col items-center gap-1 font-medium transition-colors">
                    <span class="text-lg">👎</span> Hard
                </button>
            </div>
        </footer>
    </div>

    <script id="questions-data" type="application/json">
        ${JSON.stringify(questions)}
    </script>

    <script>
        const questions = JSON.parse(document.getElementById('questions-data').textContent);
        let currentIndex = 0;
        const revealedSets = new Set(); // indices of revealed question parts

        function updateUI() {
            const container = document.getElementById('question-container');
            const q = questions[currentIndex];
            const savedStatus = localStorage.getItem('status_' + q.id) || 'Untagged';

            document.getElementById('progress-text').textContent = \`Question \${currentIndex + 1} / \${questions.length}\`;

            let html = \`
                <div class="bg-slate-800 rounded-xl p-4 flex justify-between items-center border border-slate-700">
                    <span class="text-sm text-slate-300">\${q.year} \${q.month} • \${q.paperType}</span>
                    <span class="text-sm font-bold \${savedStatus === 'Easy' ? 'text-emerald-400' : savedStatus === 'Hard' ? 'text-red-400' : 'text-slate-500'}">
                        \${savedStatus}
                    </span>
                </div>
            \`;

            q.parts.forEach((part, idx) => {
                const partId = \`\${currentIndex}_\${idx}\`;
                const isRevealed = revealedSets.has(partId);
                
                html += \`
                    <div class="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg animate-slide-up">
                        <div class="mb-4 border-b border-slate-700 pb-2 flex justify-between items-center">
                            <h3 class="font-bold text-blue-400 text-lg">
                                \${q.parts.length > 1 ? 'Part (' + part.label + ')' : 'Question'}
                            </h3>
                        </div>
                        
                        <div class="space-y-4 mb-6">
                            \${(part.questionImages || (part.questionImage ? [part.questionImage] : [])).map(img => 
                                \`<img src="\${img}" class="max-w-full rounded bg-white p-1" />\`
                            ).join('')}
                        </div>

                        <div class="mt-4">
                            \${!isRevealed ? 
                                \`<button onclick="reveal('\${partId}')" class="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 font-medium flex items-center justify-center gap-2 transition-colors">
                                    👁️ Reveal Answer
                                </button>\` : 
                                \`<div class="bg-slate-900/50 rounded-lg p-4 animate-slide-up border border-slate-700">
                                    <div class="flex justify-between items-center mb-2">
                                        <span class="text-xs font-bold text-emerald-500 uppercase">Answer</span>
                                        <button onclick="hide('\${partId}')" class="text-xs text-slate-500 hover:text-white">Hide</button>
                                    </div>
                                    \${part.answerText ? \`<div class="text-2xl font-bold text-white mb-2 p-2">\${part.answerText}</div>\` : ''}
                                    <div class="space-y-4">
                                        \${(part.answerImages || (part.answerImage ? [part.answerImage] : [])).map(img => 
                                            \`<img src="\${img}" class="max-w-full rounded bg-white p-1" />\`
                                        ).join('')}
                                    </div>
                                </div>\`
                            }
                        </div>
                    </div>
                \`;
            });

            container.innerHTML = html;
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function reveal(id) { revealedSets.add(id); updateUI(); }
        function hide(id) { revealedSets.delete(id); updateUI(); }
        function nextQ() { if(currentIndex < questions.length - 1) { currentIndex++; updateUI(); } }
        function prevQ() { if(currentIndex > 0) { currentIndex--; updateUI(); } }
        
        function tag(status) {
            const q = questions[currentIndex];
            localStorage.setItem('status_' + q.id, status);
            updateUI();
            setTimeout(nextQ, 300);
        }

        updateUI();
    </script>
</body>
</html>
      `;

      const blob = new Blob([htmlTemplate], { type: "text/html" });
      downloadBlob(blob, `PaperCut_Practice_${preSelectedSubject || 'Export'}_${Date.now()}.html`);
      setLoading(false);
      setStatusMessage("");
  };

  const base64ToBuffer = (base64: string): Uint8Array => {
    const binaryString = window.atob(base64.split(',')[1]);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const getImageDimensions = (base64: string): Promise<{width: number, height: number}> => {
      return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve({width: img.width, height: img.height});
          img.onerror = () => resolve({width: 0, height: 0});
          img.src = base64;
      });
  }

  const handleExportWord = async () => {
    if (!window.docx) {
        alert("DOCX library not loaded. Please check internet connection.");
        return;
    }
    setLoading(true);
    setStatusMessage("Generating .docx File...");
    
    try {
        const questions = await getQuestions();
        const grouped = groupQuestions(questions);
        const { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType } = window.docx;
        const children = [];

        children.push(
            new Paragraph({
                text: `PaperCut Export: ${preSelectedSubject || 'All Subjects'}`,
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
                spacing: { after: 300 }
            })
        );

        for (const paperType of Object.keys(grouped)) {
            children.push(
                new Paragraph({
                    text: paperType,
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 400, after: 200 }
                })
            );

            for (const dateKey of Object.keys(grouped[paperType])) {
                children.push(
                    new Paragraph({
                        text: dateKey,
                        heading: HeadingLevel.HEADING_3,
                        spacing: { before: 200, after: 200 },
                        color: "7F8C8D"
                    })
                );

                for (const q of grouped[paperType][dateKey]) {
                    children.push(
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: `Q${q.questionNumber}`,
                                    bold: true,
                                    color: "2C3E50"
                                })
                            ],
                            spacing: { before: 400, after: 100 },
                            border: { top: { color: "EEEEEE", space: 5, value: "single", size: 6 } }
                        })
                    );

                    for (const p of q.parts) {
                        if (q.parts.length > 1) {
                            children.push(
                                new Paragraph({
                                    text: `Part (${p.label})`,
                                    bold: true,
                                    spacing: { before: 100, after: 100 }
                                })
                            );
                        }

                        const qImgs = [];
                        if (p.questionImage) qImgs.push(p.questionImage);
                        if (p.questionImages) qImgs.push(...p.questionImages);

                        for (const img of qImgs) {
                            const dims = await getImageDimensions(img);
                            if (dims.width === 0) continue;
                            const maxWidth = 550;
                            let finalWidth = dims.width;
                            let finalHeight = dims.height;
                            if (dims.width > maxWidth) {
                                const scale = maxWidth / dims.width;
                                finalWidth = maxWidth;
                                finalHeight = dims.height * scale;
                            }
                            children.push(
                                new Paragraph({
                                    children: [
                                        new ImageRun({
                                            data: base64ToBuffer(img),
                                            transformation: { width: finalWidth, height: finalHeight },
                                            type: "png"
                                        })
                                    ],
                                    spacing: { after: 100 }
                                })
                            );
                        }
                    }

                    children.push(
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: "Answer:",
                                    bold: true,
                                    color: "27AE60"
                                })
                            ],
                            spacing: { before: 200, after: 100 }
                        })
                    );

                    for (const p of q.parts) {
                        if (p.answerText) {
                            children.push(
                                new Paragraph({
                                    children: [
                                        new TextRun({
                                            text: q.parts.length > 1 ? `(${p.label}) ${p.answerText}` : p.answerText,
                                            bold: true
                                        })
                                    ],
                                    spacing: { after: 100 }
                                })
                            );
                        }
                        const aImgs = [];
                        if (p.answerImage) aImgs.push(p.answerImage);
                        if (p.answerImages) aImgs.push(...p.answerImages);
                        for (const img of aImgs) {
                            const dims = await getImageDimensions(img);
                            if (dims.width === 0) continue;
                            const maxWidth = 550;
                            let finalWidth = dims.width;
                            let finalHeight = dims.height;
                            if (dims.width > maxWidth) {
                                const scale = maxWidth / dims.width;
                                finalWidth = maxWidth;
                                finalHeight = dims.height * scale;
                            }
                            children.push(
                                new Paragraph({
                                    children: [
                                        new ImageRun({
                                            data: base64ToBuffer(img),
                                            transformation: { width: finalWidth, height: finalHeight },
                                            type: "png"
                                        })
                                    ],
                                    spacing: { after: 100 }
                                })
                            );
                        }
                    }
                }
            }
        }

        const doc = new Document({
            sections: [{
                properties: {},
                children: children,
            }],
        });

        const blob = await Packer.toBlob(doc);
        downloadBlob(blob, `PaperCut_Export_${Date.now()}.docx`);
    } catch (e) {
        console.error(e);
        alert("Failed to generate Word document.");
    } finally {
        setLoading(false);
        setStatusMessage("");
    }
  };

  const optimizeImageForPdf = (base64: string): Promise<{ data: string, width: number, height: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
        }
        resolve({
            data: canvas.toDataURL('image/jpeg', 0.9),
            width: img.width,
            height: img.height
        });
      };
      img.onerror = () => resolve({ data: '', width: 0, height: 0 });
    });
  };

  const handleExportPDF = async () => {
    if (!window.jspdf) {
        alert("PDF library not loaded properly.");
        return;
    }
    setLoading(true);
    setStatusMessage("Preparing images...");
    try {
        const questions = await getQuestions();
        const grouped = groupQuestions(questions);
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        let y = 20;
        const pageHeight = doc.internal.pageSize.height;
        const pageWidth = doc.internal.pageSize.width;
        const margin = 15;
        const maxContentWidth = pageWidth - (margin * 2);
        
        const checkPageBreak = (height: number) => {
            if (y + height >= pageHeight - margin) {
                doc.addPage();
                y = 20;
                return true;
            }
            return false;
        };

        doc.setFontSize(22);
        doc.setTextColor(41, 128, 185);
        doc.text(`PaperCut Export: ${preSelectedSubject || 'All Subjects'}`, margin, y);
        y += 15;

        for (const paperType of Object.keys(grouped)) {
            checkPageBreak(20);
            doc.setFontSize(18);
            doc.setTextColor(44, 62, 80);
            doc.text(paperType, margin, y);
            y += 10;
            for (const dateKey of Object.keys(grouped[paperType])) {
                checkPageBreak(15);
                doc.setFontSize(14);
                doc.setTextColor(127, 140, 141);
                doc.text(dateKey, margin, y);
                y += 10;
                for (const q of grouped[paperType][dateKey]) {
                    doc.setFontSize(10);
                    doc.setTextColor(0, 0, 0);
                    checkPageBreak(10);
                    doc.text(`Q${q.questionNumber}`, margin, y);
                    y += 5;
                    for (const p of q.parts) {
                        if (q.parts.length > 1) {
                            doc.text(`(${p.label})`, margin, y + 5);
                            y += 5;
                        }
                        const qImgs = [];
                        if (p.questionImage) qImgs.push(p.questionImage);
                        if (p.questionImages) qImgs.push(...p.questionImages);
                        for (const img of qImgs) {
                            const optimized = await optimizeImageForPdf(img);
                            if (!optimized.data) continue;
                            const scaleFactor = maxContentWidth / optimized.width;
                            const finalWidth = maxContentWidth;
                            const finalHeight = optimized.height * scaleFactor;
                            checkPageBreak(finalHeight + 10);
                            try {
                                doc.addImage(optimized.data, 'JPEG', margin, y, finalWidth, finalHeight, undefined, 'FAST');
                                y += finalHeight + 5;
                            } catch(e) {
                                y += 10;
                            }
                        }
                    }
                    checkPageBreak(20);
                    doc.setTextColor(39, 174, 96);
                    doc.text("Answer:", margin, y);
                    y += 5;
                    for (const p of q.parts) {
                        if (p.answerText) {
                             checkPageBreak(10);
                             doc.text(`${p.label ? '(' + p.label + ') ' : ''}${p.answerText}`, margin + 5, y);
                             y += 5;
                        }
                        const aImgs = [];
                        if (p.answerImage) aImgs.push(p.answerImage);
                        if (p.answerImages) aImgs.push(...p.answerImages);
                        for (const img of aImgs) {
                            const optimized = await optimizeImageForPdf(img);
                            if (!optimized.data) continue;
                            const scaleFactor = maxContentWidth / optimized.width;
                            const finalWidth = maxContentWidth;
                            const finalHeight = optimized.height * scaleFactor;
                            checkPageBreak(finalHeight + 5);
                            try {
                                doc.addImage(optimized.data, 'JPEG', margin, y, finalWidth, finalHeight, undefined, 'FAST');
                                y += finalHeight + 5;
                            } catch (e) { y += 10; }
                        }
                    }
                    y += 10;
                }
            }
        }
        doc.save(`PaperCut_Export_${Date.now()}.pdf`);
    } catch (error) {
        alert("Export failed.");
    } finally {
        setLoading(false);
        setStatusMessage("");
    }
  };

  const groupQuestions = (qs: QuestionEntry[]) => {
      const grouped: any = {};
      const sorted = qs.sort((a, b) => {
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

  const downloadBlob = (blob: Blob, filename: string) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white p-8 flex items-center justify-center">
      <div className="max-w-2xl w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-700">
          
          <button onClick={() => navigate(-1)} className="mb-6 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-2">
              <ArrowLeft size={18}/> Back
          </button>

          <h1 className="text-2xl font-bold mb-2">Export Repository</h1>
          <p className="text-slate-500 mb-8">Download your extracted questions in your preferred format.</p>

          <div className="mb-8 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
               <h3 className="font-bold text-sm uppercase text-slate-500 mb-3">Export Scope</h3>
               <div className="flex gap-4 mb-4">
                   <button 
                    onClick={() => setExportScope('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${exportScope === 'all' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                   >
                       Entire Repository
                   </button>
                   <button 
                    onClick={() => setExportScope('folders')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${exportScope === 'folders' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                   >
                       Specific Folders
                   </button>
               </div>

               {exportScope === 'folders' && (
                   <div className="grid grid-cols-2 gap-2 animate-fade-in">
                       {availableFolders.map(f => (
                           <div 
                             key={f.id} 
                             onClick={() => toggleFolder(f.id)}
                             className={`flex items-center gap-2 p-2 rounded cursor-pointer border \${selectedFolderIds.has(f.id) ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 hover:border-blue-400'}`}
                           >
                               {selectedFolderIds.has(f.id) ? <CheckSquare size={18}/> : <Square size={18}/>}
                               <span className="text-sm truncate">{f.name}</span>
                           </div>
                       ))}
                   </div>
               )}
          </div>

          <div className="grid grid-cols-1 gap-4">
              <button 
                onClick={handleExportHTML}
                disabled={loading}
                className="w-full p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 transition-all flex items-center gap-4"
              >
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-full text-indigo-600 shadow-sm">
                      <Layout size={24} />
                  </div>
                  <div className="text-left">
                      <div className="font-bold">Interactive HTML Practice</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Standalone offline practice website with tagging</div>
                  </div>
              </button>

              <button 
                onClick={handleExportPDF}
                disabled={loading}
                className="w-full p-4 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-transparent hover:border-blue-500 transition-all flex items-center gap-4"
              >
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-full text-red-500 shadow-sm">
                      <FileText size={24} />
                  </div>
                  <div className="text-left">
                      <div className="font-bold">PDF Document</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">High Quality • Optimized for printing</div>
                  </div>
              </button>

              <button 
                onClick={handleExportWord}
                disabled={loading}
                className="w-full p-4 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-transparent hover:border-blue-500 transition-all flex items-center gap-4"
              >
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-full text-blue-600 shadow-sm">
                      <FileText size={24} />
                  </div>
                  <div className="text-left">
                      <div className="font-bold">Word Document (.docx)</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Editable document with high-res images</div>
                  </div>
              </button>

              <button 
                onClick={handleExportJSON}
                disabled={loading}
                className="w-full p-4 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-transparent hover:border-blue-500 transition-all flex items-center gap-4"
              >
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-full text-amber-500 shadow-sm">
                      <FileJson size={24} />
                  </div>
                  <div className="text-left">
                      <div className="font-bold">JSON Backup</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">For migrating data to another device</div>
                  </div>
              </button>
          </div>
          
          {loading && (
              <div className="mt-6 flex flex-col items-center justify-center gap-2 text-blue-500">
                  <div className="flex items-center gap-2">
                    <Loader2 className="animate-spin" /> Processing...
                  </div>
                  {statusMessage && <p className="text-xs text-slate-400">{statusMessage}</p>}
              </div>
          )}
      </div>
    </div>
  );
};

export default Export;
