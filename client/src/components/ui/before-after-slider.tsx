import { useState, useRef, useEffect } from "react";

interface BeforeAfterSliderProps {
  beforeImage: string;
  afterImage: string;
  intensity?: number;
  className?: string;
}

export function BeforeAfterSlider({ 
  beforeImage, 
  afterImage, 
  intensity = 100,
  className = "" 
}: BeforeAfterSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    
    setSliderPosition(Math.max(0, Math.min(100, percentage)));
  };

  const handleMouseDown = () => setIsDragging(true);
  
  const handleMouseUp = () => setIsDragging(false);

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging) return;
    handleMove(e.touches[0].clientX);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleTouchMove);
      window.addEventListener("touchend", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div 
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden select-none touch-none ${className}`}
      onMouseDown={(e) => {
        e.preventDefault();
        handleMove(e.clientX);
        handleMouseDown();
      }}
      onTouchStart={(e) => {
        e.preventDefault();
        handleMove(e.touches[0].clientX);
        handleMouseDown();
      }}
      data-testid="before-after-slider"
    >
      {/* Before Image (Original) */}
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        <div className="absolute top-4 left-4 px-3 py-1 bg-black/60 text-white text-xs rounded-full backdrop-blur-md z-10">
          Original
        </div>
        <img 
          src={beforeImage} 
          alt="Original" 
          className="w-full h-full object-contain max-h-[80vh]"
          draggable={false}
          data-testid="image-original"
        />
      </div>

      {/* After Image (Edited) - with clip path */}
      <div 
        className="absolute inset-0 flex items-center justify-center bg-black"
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
      >
        <div className="absolute top-4 right-4 px-3 py-1 bg-primary/90 text-white text-xs rounded-full backdrop-blur-md z-10">
          Edited
        </div>
        <img 
          src={afterImage} 
          alt="Edited" 
          className="w-full h-full object-contain max-h-[80vh]"
          draggable={false}
          data-testid="image-edited"
        />
      </div>

      {/* Slider Handle */}
      <div 
        className="absolute top-0 bottom-0 w-1 bg-white/80 cursor-ew-resize z-20"
        style={{ left: `${sliderPosition}%` }}
        data-testid="slider-handle"
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 3L2 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 3L14 8L10 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </div>
  );
}
