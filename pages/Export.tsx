
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getQuestionsBySubject, getAllQuestions, getFoldersBySubject } from '../services/db';
import { ArrowLeft, FileText, FileJson, Download, Loader2, Folder as FolderIcon, CheckSquare, Square } from 'lucide-react';
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
          // Filter folders
          const activeFolders = availableFolders.filter(f => selectedFolderIds.has(f.id));
          
          // Get questions that match ANY of the selected folders
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

  // Convert Base64 to Uint8Array for DOCX
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

        // Title
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
                    // Question Metadata
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

                    // Process Parts
                    for (const p of q.parts) {
                        // Part Label if needed
                        if (q.parts.length > 1) {
                            children.push(
                                new Paragraph({
                                    text: `Part (${p.label})`,
                                    bold: true,
                                    spacing: { before: 100, after: 100 }
                                })
                            );
                        }

                        // Question Images
                        const qImgs = [];
                        if (p.questionImage) qImgs.push(p.questionImage);
                        if (p.questionImages) qImgs.push(...p.questionImages);

                        for (const img of qImgs) {
                            const dims = await getImageDimensions(img);
                            if (dims.width === 0) continue;

                            // Scale to fit page width (approx 600px or 16cm usually usable width in Word)
                            // Let's use a max width of 550 for safety margins
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
                                            type: "png" // Assuming PNG from snip
                                        })
                                    ],
                                    spacing: { after: 100 }
                                })
                            );
                        }
                    }

                    // Answer Section
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
                            if (q.parts.length > 1 && !p.answerText) {
                                 children.push(new Paragraph({ text: `(${p.label})`, bold: true }));
                            }

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
        alert("Failed to generate Word document. See console for details.");
    } finally {
        setLoading(false);
        setStatusMessage("");
    }
  };

  // Helper to optimize images for PDF (Convert PNG to JPEG to save size)
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
            // Fill white background for transparent PNGs to avoid black artifacts in JPEG
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
        }
        // Increased quality to 0.9 as requested
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
        alert("PDF library not loaded properly. Check internet connection.");
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

        // Title
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
                    // Question Block
                    doc.setFontSize(10);
                    doc.setTextColor(0, 0, 0);
                    
                    const title = `Q${q.questionNumber}`;
                    checkPageBreak(10);
                    doc.text(title, margin, y);
                    y += 5;

                    // Process Parts (Images)
                    for (const p of q.parts) {
                        if (q.parts.length > 1) {
                            doc.text(`(${p.label})`, margin, y + 5);
                            y += 5;
                        }
                        
                        // Collect all images (legacy + new)
                        const qImgs = [];
                        if (p.questionImage) qImgs.push(p.questionImage);
                        if (p.questionImages) qImgs.push(...p.questionImages);

                        for (const img of qImgs) {
                            const optimized = await optimizeImageForPdf(img);
                            if (!optimized.data) continue;

                            // Scale to fit full width
                            const scaleFactor = maxContentWidth / optimized.width;
                            const finalWidth = maxContentWidth;
                            const finalHeight = optimized.height * scaleFactor;
                            
                            checkPageBreak(finalHeight + 10);
                            try {
                                doc.addImage(optimized.data, 'JPEG', margin, y, finalWidth, finalHeight, undefined, 'FAST');
                                y += finalHeight + 5;
                            } catch(e) {
                                console.error(e);
                                doc.text("[Image Error]", margin, y);
                                y += 10;
                            }
                        }
                    }

                    // Answer
                    checkPageBreak(20);
                    doc.setTextColor(39, 174, 96);
                    doc.text("Answer:", margin, y);
                    y += 5;
                    
                    for (const p of q.parts) {
                        if (p.answerText) {
                             checkPageBreak(10);
                             doc.text(`${p.label ? `(${p.label}) ` : ''}${p.answerText}`, margin + 5, y);
                             y += 5;
                        }
                        
                        const aImgs = [];
                        if (p.answerImage) aImgs.push(p.answerImage);
                        if (p.answerImages) aImgs.push(...p.answerImages);

                        if (aImgs.length > 0) {
                             if (q.parts.length > 1 && !p.answerText) {
                                checkPageBreak(5);
                                doc.text(`(${p.label})`, margin + 5, y);
                                y+=5;
                             }
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
                                } catch (e) {
                                   y += 10; 
                                }
                             }
                        }
                    }

                    y += 10; // Spacing between questions
                }
            }
        }

        doc.save(`PaperCut_Export_${Date.now()}.pdf`);
    } catch (error) {
        console.error(error);
        alert("Export failed. See console.");
    } finally {
        setLoading(false);
        setStatusMessage("");
    }
  };

  // Helpers
  const groupQuestions = (qs: QuestionEntry[]) => {
      const grouped: any = {};
      
      // Sort: Year DESC, Month DESC, Number ASC
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

          {/* Scope Selection */}
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
                             className={`flex items-center gap-2 p-2 rounded cursor-pointer border ${selectedFolderIds.has(f.id) ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 hover:border-blue-400'}`}
                           >
                               {selectedFolderIds.has(f.id) ? <CheckSquare size={18}/> : <Square size={18}/>}
                               <span className="text-sm truncate">{f.name}</span>
                           </div>
                       ))}
                       {availableFolders.length === 0 && <span className="text-sm text-slate-500 italic">No folders found.</span>}
                   </div>
               )}
          </div>

          <div className="space-y-4">
              <button 
                onClick={handleExportJSON}
                disabled={loading}
                className="w-full p-4 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-transparent hover:border-blue-500 transition-all flex items-center gap-4"
              >
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-full text-amber-500 shadow-sm">
                      <FileJson size={24} />
                  </div>
                  <div className="text-left">
                      <div className="font-bold">JSON Format</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">For backups or importing to PaperCut</div>
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
                      <div className="text-xs text-slate-500 dark:text-slate-400">Optimized with high-quality images</div>
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
                      <div className="text-xs text-slate-500 dark:text-slate-400">High Quality (90%) • Fits Page</div>
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
