import React from 'react';
import { FFTResult } from './hooks/useImageAnalysis';

interface AnalysisSummaryProps {
  fftResults: FFTResult[];
  imageWidth: number;
  imageHeight: number;
  dominantFrequency: number | null;
}

const AnalysisSummary: React.FC<AnalysisSummaryProps> = ({
  fftResults,
  imageWidth,
  imageHeight,
  dominantFrequency
}) => {
  return (
    <div className="mt-6">
      <h3 className="text-lg font-medium mb-2">Analysis Summary</h3>
      <div className="text-sm">
        <p>• Applied derivative transform and FFT to {fftResults.length} vertical lines</p>
        <p>• Image dimensions: {imageWidth} x {imageHeight} pixels</p>
        
        {dominantFrequency ? (
          <>
            <p className="font-bold mt-2 text-green-700">Dominant Pattern Found:</p>
            <p>• Frequency: {dominantFrequency}</p>
            <p>• Pixel spacing: {(imageHeight / dominantFrequency).toFixed(1)} pixels</p>
            <p>• Green horizontal lines on the image show the detected pattern</p>
            <p>• Detection based on Gaussian smoothing (σ=2, kernel size=7) of FFT data</p>
            <p className="mt-2">If this image is rescaled pixel art, the original resolution was likely around 
              {Math.round(imageWidth / (imageHeight / dominantFrequency))} x {dominantFrequency} pixels.</p>
            <p>• The generated pixel art above shows an approximation of the original pixel art</p>
          </>
        ) : (
          <>
            <p>• For pixel art, peaks in the frequency spectrum may indicate the original pixel grid size</p>
            <p>• Stronger peaks at specific frequencies suggest regular patterns in the image</p>
            <p>• Look for prominent peaks in the frequency diagram to identify potential original resolution</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AnalysisSummary;
