import React from 'react';

interface AnalysisControlsProps {
  imageData: ImageData | null;
  processing: boolean;
  performFFT: (imgData?: ImageData) => void;
  dominantFrequency: number | null;
  imageHeight: number;
  combinedFFT: number[];
}

const AnalysisControls: React.FC<AnalysisControlsProps> = ({
  imageData,
  processing,
  performFFT,
  dominantFrequency,
  imageHeight,
  combinedFFT
}) => {
  return (
    <div className="flex flex-wrap gap-2 mt-4">
      <button 
        onClick={() => imageData && performFFT(imageData)} 
        disabled={!imageData || processing}
        className={`px-4 py-2 rounded ${!imageData || processing ? 'bg-gray-300' : 'bg-blue-500 text-white'}`}
      >
        {processing ? 'Processing...' : 'Analyze with FFT'}
      </button>
      
      {combinedFFT.length > 0 && (
        <div className="text-sm flex items-center">
          <span className="mr-2">Found peak at frequency:</span>
          <span className="font-bold text-green-700">{dominantFrequency}</span>
          <span className="mx-2">→</span>
          <span className="font-bold text-green-700">
            {dominantFrequency ? (imageHeight / dominantFrequency).toFixed(1) : 0} pixels
          </span>
        </div>
      )}
    </div>
  );
};

export default AnalysisControls;
