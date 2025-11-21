import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Scissors, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

// Define types for window.pdfjsLib
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

interface PdfSnipperProps {
  file: File;
  onSnip: (dataUrl: string) => void;
  label: string;
  autoTriggerMode?: boolean;
}

const PdfSnipper: React.FC<PdfSnipperProps> = ({ file, onSnip, label }) => {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNum, setPageNum] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.5);
  const [isSnipping, setIsSnipping] = useState<boolean>(false);
  const [viewportDims, setViewportDims] = useState<{w: number, h: number}>({ w: 0, h: 0 });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  
  // Selection logic using Refs for performance
  const selectionDivRef = useRef<HTMLDivElement>(null);
  const [finalSelection, setFinalSelection] = useState<{x: number, y: number, w: number, h: number} | null>(null);
  
  const isDragging = useRef(false);
  const startPos = useRef<{x: number, y: number}>({ x: 0, y: 0 });
  const currentSelection = useRef<{x: number, y: number, w: number, h: number} | null>(null);

  // Load PDF Document
  useEffect(() => {
    const loadPdf = async () => {
      if (!file || !window.pdfjsLib) return;
      try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
        const doc = await loadingTask.promise;
        setPdfDoc(doc);
        setPageNum(1);
      } catch (error) {
        console.error("Error loading PDF", error);
      }
    };
    loadPdf();
  }, [file]);

  // Render Page
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;
    
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      // Explicitly set dimensions to match viewport
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      // Update state to force wrapper to match size
      setViewportDims({ w: viewport.width, h: viewport.height });

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;
    } catch (e) {
      console.error("Error rendering page", e);
    }
  }, [pdfDoc, pageNum, scale]);

  useEffect(() => {
    renderPage();
    setFinalSelection(null);
    if (selectionDivRef.current) {
      selectionDivRef.current.style.display = 'none';
    }
  }, [renderPage]);

  // Mouse Handlers for Selection
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isSnipping) return;
    if (!overlayRef.current) return;
    
    const rect = overlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    isDragging.current = true;
    startPos.current = { x, y };
    currentSelection.current = { x, y, w: 0, h: 0 };
    
    setFinalSelection(null);

    if (selectionDivRef.current) {
      selectionDivRef.current.style.display = 'block';
      selectionDivRef.current.style.left = `${x}px`;
      selectionDivRef.current.style.top = `${y}px`;
      selectionDivRef.current.style.width = '0px';
      selectionDivRef.current.style.height = '0px';
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !isSnipping || !overlayRef.current || !selectionDivRef.current) return;

    const rect = overlayRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const width = currentX - startPos.current.x;
    const height = currentY - startPos.current.y;

    const x = width > 0 ? startPos.current.x : currentX;
    const y = height > 0 ? startPos.current.y : currentY;
    const w = Math.abs(width);
    const h = Math.abs(height);

    currentSelection.current = { x, y, w, h };

    selectionDivRef.current.style.left = `${x}px`;
    selectionDivRef.current.style.top = `${y}px`;
    selectionDivRef.current.style.width = `${w}px`;
    selectionDivRef.current.style.height = `${h}px`;
  };

  const handleMouseUp = () => {
    if (isDragging.current) {
      isDragging.current = false;
      if (currentSelection.current && currentSelection.current.w > 5 && currentSelection.current.h > 5) {
        setFinalSelection(currentSelection.current);
      } else {
        if (selectionDivRef.current) selectionDivRef.current.style.display = 'none';
        setFinalSelection(null);
      }
    }
  };

  const performSnip = () => {
    if (!finalSelection || !canvasRef.current) return;
    
    const sourceCanvas = canvasRef.current;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = finalSelection.w;
    tempCanvas.height = finalSelection.h;
    const ctx = tempCanvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(
        sourceCanvas,
        finalSelection.x, finalSelection.y, finalSelection.w, finalSelection.h,
        0, 0, finalSelection.w, finalSelection.h 
      );
      const dataUrl = tempCanvas.toDataURL('image/png');
      
      if (dataUrl.length < 100) {
          alert("Snip failed or was empty. Please try again.");
          return;
      }

      onSnip(dataUrl);
      
      setFinalSelection(null);
      if (selectionDivRef.current) selectionDivRef.current.style.display = 'none';
      setIsSnipping(false);
    }
  };

  const cancelSnip = () => {
    setFinalSelection(null);
    if (selectionDivRef.current) selectionDivRef.current.style.display = 'none';
    setIsSnipping(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-800 rounded-lg overflow-hidden border border-slate-700 shadow-xl select-none">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 bg-slate-900 border-b border-slate-700 shrink-0">
        <h3 className="font-semibold text-slate-200">{label}</h3>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setPageNum(p => Math.max(1, p - 1))}
            disabled={pageNum <= 1}
            className="p-1 hover:bg-slate-700 rounded disabled:opacity-50 text-slate-300"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm text-slate-400 w-16 text-center">
            {pageNum} / {pdfDoc?.numPages || '-'}
          </span>
          <button 
            onClick={() => setPageNum(p => Math.min(pdfDoc?.numPages || 1, p + 1))}
            disabled={!pdfDoc || pageNum >= pdfDoc.numPages}
            className="p-1 hover:bg-slate-700 rounded disabled:opacity-50 text-slate-300"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setScale(s => Math.max(0.5, s - 0.2))}
            className="p-1 bg-slate-700 rounded hover:bg-slate-600 text-slate-300"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs text-slate-400 w-10 text-center">{Math.round(scale * 100)}%</span>
          <button 
            onClick={() => setScale(s => Math.min(3.0, s + 0.2))}
            className="p-1 bg-slate-700 rounded hover:bg-slate-600 text-slate-300"
          >
            <ZoomIn size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2">
           {isSnipping ? (
             <>
               <button 
                 onClick={performSnip}
                 disabled={!finalSelection}
                 className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 <Scissors size={16} /> Confirm
               </button>
               <button 
                 onClick={cancelSnip}
                 className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
               >
                 <RotateCcw size={18} />
               </button>
             </>
           ) : (
             <button 
               onClick={() => setIsSnipping(true)}
               className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded transition-colors shadow-sm"
             >
               <Scissors size={16} /> Snip
             </button>
           )}
        </div>
      </div>

      {/* Canvas Area */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto relative bg-slate-800/50 flex justify-center p-4"
        style={{ cursor: isSnipping ? 'crosshair' : 'default' }}
      >
        {/* Wrapper with explicit dimensions to ensure overlay covers exactly the page */}
        <div 
          className="relative shadow-2xl"
          style={{ width: viewportDims.w, height: viewportDims.h }}
        >
          <canvas ref={canvasRef} className="block" />
          
          {/* Snip Overlay */}
          {isSnipping && (
            <div 
              ref={overlayRef}
              className="absolute inset-0 z-10"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Dimmed Background */}
              <div className="absolute inset-0 bg-black/30 pointer-events-none" />
              
              {/* Visual Selection Box (Controlled via Ref) */}
              <div 
                ref={selectionDivRef}
                className="absolute border-2 border-blue-400 bg-blue-400/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] pointer-events-none hidden"
              />

              {/* Final Selection Box (React State) - Shows after drag ends */}
              {finalSelection && (
                <div 
                   className="absolute border-2 border-emerald-400 bg-emerald-400/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] pointer-events-none"
                   style={{
                     left: finalSelection.x,
                     top: finalSelection.y,
                     width: finalSelection.w,
                     height: finalSelection.h
                   }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PdfSnipper;