import React from 'react';
import LoadingSpinner from '../LoadingSpinner';

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
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        <button 
          onClick={() => imageData && performFFT(imageData)} 
          disabled={!imageData || processing}
          className={`px-4 py-2 rounded ${!imageData || processing ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
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
      
      {processing && (
        <LoadingSpinner 
          message="Analyzing image with FFT..." 
          size="small"
          className="mt-2"
        />
      )}
    </div>
  );
};

export default AnalysisControls;
