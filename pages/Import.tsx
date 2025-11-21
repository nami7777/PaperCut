import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bulkSaveQuestions } from '../services/db';
import { ArrowLeft, Upload, CheckCircle } from 'lucide-react';

const Import: React.FC = () => {
  const navigate = useNavigate();
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const handleDrop = async (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if(e.dataTransfer.files && e.dataTransfer.files[0]) {
          processFile(e.dataTransfer.files[0]);
      }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          processFile(e.target.files[0]);
      }
  };

  const processFile = (file: File) => {
      if (file.type !== "application/json") {
          alert("Please upload a valid JSON file");
          return;
      }
      
      setProcessing(true);
      const reader = new FileReader();
      reader.onload = async (ev) => {
          try {
              const json = JSON.parse(ev.target?.result as string);
              if (Array.isArray(json)) {
                  await bulkSaveQuestions(json);
                  setSuccessCount(json.length);
              } else {
                  alert("Invalid format: Expected an array of questions");
              }
          } catch (e) {
              alert("Failed to parse JSON");
          } finally {
              setProcessing(false);
          }
      };
      reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white flex items-center justify-center p-4">
        <div className="max-w-xl w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-700 text-center">
            <button onClick={() => navigate('/')} className="mb-6 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-2 mx-auto">
                <ArrowLeft size={18}/> Back to Dashboard
            </button>

            <h1 className="text-3xl font-bold mb-2">Import Repository</h1>
            <p className="text-slate-500 mb-8">Upload a previously exported PaperCut JSON file.</p>

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
                    <Upload size={48} className="mx-auto text-slate-400 mb-4" />
                    <p className="font-medium mb-2">{processing ? "Processing..." : "Drag & Drop JSON file here"}</p>
                    <p className="text-sm text-slate-400 mb-6">or</p>
                    <label className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg cursor-pointer">
                        Browse Files
                        <input type="file" accept="application/json" className="hidden" onChange={handleFile} disabled={processing}/>
                    </label>
                </div>
            )}
        </div>
    </div>
  );
};

export default Import;