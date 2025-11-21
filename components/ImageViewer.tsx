
import React, { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Move } from 'lucide-react';

interface ImageViewerProps {
  src: string;
  onClose: () => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ src, onClose }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(s => Math.min(Math.max(0.5, s + delta), 5));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col animate-fade-in" onClick={onClose}>
       {/* Toolbar */}
       <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-50 pointer-events-none">
          <div className="text-white/70 text-sm font-medium bg-black/50 px-3 py-1 rounded-full pointer-events-auto">
             Mouse Wheel to Zoom • Drag to Pan
          </div>
          <div className="flex gap-2 pointer-events-auto">
            <button onClick={(e) => { e.stopPropagation(); setScale(s => s - 0.5); }} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white"><ZoomOut size={24}/></button>
            <button onClick={(e) => { e.stopPropagation(); setScale(s => s + 0.5); }} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white"><ZoomIn size={24}/></button>
            <button onClick={onClose} className="p-2 bg-white/10 hover:bg-red-500/80 rounded-full text-white transition-colors"><X size={24}/></button>
          </div>
       </div>

       {/* Image Canvas */}
       <div 
         className="flex-1 overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing"
         onMouseDown={handleMouseDown}
         onMouseMove={handleMouseMove}
         onMouseUp={handleMouseUp}
         onMouseLeave={handleMouseUp}
         onWheel={handleWheel}
         onClick={(e) => e.stopPropagation()}
       >
          <img 
            src={src} 
            alt="Zoom view" 
            className="max-w-none transition-transform duration-75 ease-linear select-none"
            style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`
            }}
            draggable={false}
          />
       </div>
    </div>
  );
};

export default ImageViewer;
