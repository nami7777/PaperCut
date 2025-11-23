
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bulkSaveQuestions } from '../services/db';
import { ArrowLeft, Upload, CheckCircle, FolderArchive } from 'lucide-react';

declare global {
  interface Window {
    JSZip: any;
  }
}

const Import: React.FC = () => {
  const navigate = useNavigate();
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const handleDrop = async (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if(e.dataTransfer.files && e.dataTransfer.files[0]) {
          await processFile(e.dataTransfer.files[0]);
      }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          await processFile(e.target.files[0]);
      }
  };

  const processFile = async (file: File) => {
      setProcessing(true);
      try {
          // Check for JSON
          if (file.name.toLowerCase().endsWith('.json') || file.type === "application/json") {
              const text = await file.text();
              const json = JSON.parse(text);
              if (Array.isArray(json)) {
                  await bulkSaveQuestions(json);
                  setSuccessCount(json.length);
              } else {
                  alert("Invalid format: Expected an array of questions");
              }
          }
          // Check for ZIP
          else if (file.name.toLowerCase().endsWith('.zip') || file.type.includes('zip') || file.type === 'application/x-zip-compressed') {
              if (!window.JSZip) {
                  throw new Error("ZIP processing library not loaded. Please check your internet connection and refresh.");
              }

              const zip = new window.JSZip();
              const loadedZip = await zip.loadAsync(file);
              
              let extractedQuestions: any[] = [];
              const parsePromises: Promise<void>[] = [];

              loadedZip.forEach((relativePath: string, zipEntry: any) => {
                  if (!zipEntry.dir && zipEntry.name.toLowerCase().endsWith('.json')) {
                      const p = zipEntry.async('string').then((content: string) => {
                          try {
                              const json = JSON.parse(content);
                              if (Array.isArray(json)) {
                                  extractedQuestions.push(...json);
                              }
                          } catch (e) {
                              console.warn("Failed to parse JSON inside zip:", zipEntry.name);
                          }
                      });
                      parsePromises.push(p);
                  }
              });

              await Promise.all(parsePromises);

              if (extractedQuestions.length > 0) {
                  await bulkSaveQuestions(extractedQuestions);
                  setSuccessCount(extractedQuestions.length);
              } else {
                  alert("No valid JSON files containing question arrays found in this ZIP archive.");
              }
          } 
          else {
              alert("Please upload a valid .json file or a .zip archive.");
          }
      } catch (e) {
          console.error(e);
          alert("Failed to process file: " + (e as Error).message);
      } finally {
          setProcessing(false);
      }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white flex items-center justify-center p-4">
        <div className="max-w-xl w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-700 text-center">
            <button onClick={() => navigate('/')} className="mb-6 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-2 mx-auto">
                <ArrowLeft size={18}/> Back to Dashboard
            </button>

            <h1 className="text-3xl font-bold mb-2">Import Repository</h1>
            <p className="text-slate-500 mb-8">Upload a JSON backup or a ZIP archive containing multiple JSON files.</p>

            {successCount !== null ? (
                <div className="py-10 animate-in zoom-in">
                    <CheckCircle size={64} className="text-emerald-500 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-emerald-500">Success!</h3>
                    <p className="text-slate-400">Imported {successCount} questions successfully.</p>
                    <button onClick={() => navigate('/')} className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg">Go Home</button>
                </div>
            ) : (
                <div 
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-12 transition-all ${dragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-300 dark:border-slate-600'}`}
                >
                    <div className="flex justify-center gap-2 mb-4">
                         <Upload size={48} className="text-slate-400" />
                         <FolderArchive size={48} className="text-slate-400 opacity-50" />
                    </div>
                    <p className="font-medium mb-2">{processing ? "Processing..." : "Drag & Drop JSON or ZIP"}</p>
                    <p className="text-sm text-slate-400 mb-6">Backup files or Bulk Archives</p>
                    <label className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg cursor-pointer">
                        Browse Files
                        <input type="file" accept=".json,.zip,application/json,application/zip,application/x-zip-compressed" className="hidden" onChange={handleFile} disabled={processing}/>
                    </label>
                </div>
            )}
        </div>
    </div>
  );
};

export default Import;
