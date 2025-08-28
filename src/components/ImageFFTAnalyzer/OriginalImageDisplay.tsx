import React from 'react';

interface OriginalImageDisplayProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  selectedLines: number[];
  dominantFrequency: number | null;
  imageHeight: number;
  onCanvasClick: () => void;
}

const OriginalImageDisplay: React.FC<OriginalImageDisplayProps> = ({
  canvasRef,
  selectedLines,
  dominantFrequency,
  imageHeight,
  onCanvasClick
}) => {
  return (
    <div>
      <h3 className="text-lg font-medium mb-2">Original Image with Selected Lines</h3>
      <div className="border border-gray-300 overflow-auto">
        <canvas 
          ref={canvasRef} 
          className="max-w-full cursor-pointer hover:opacity-90" 
          onClick={onCanvasClick}
        />
      </div>
      {selectedLines.length > 0 && (
        <div className="mt-2 text-sm">
          Selected {selectedLines.length} vertical lines at x positions: 
          <span className="text-xs font-mono">
            {selectedLines.slice(0, 10).join(', ')}{selectedLines.length > 10 ? '...' : ''}
          </span>
          
          {dominantFrequency && (
            <p className="mt-1 font-medium text-green-700">
              Detected pattern frequency: {dominantFrequency} 
              (spacing: {(imageHeight / dominantFrequency).toFixed(1)} pixels)
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default OriginalImageDisplay;
