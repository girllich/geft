import React from 'react';

interface FFTResultsDisplayProps {
  resultCanvasRef: React.RefObject<HTMLCanvasElement>;
  combinedFFT: number[];
}

const FFTResultsDisplay: React.FC<FFTResultsDisplayProps> = ({
  resultCanvasRef,
  combinedFFT
}) => {
  return (
    <div>
      <h3 className="text-lg font-medium mb-2">Combined FFT Results</h3>
      <div className="border border-gray-300">
        <canvas ref={resultCanvasRef} className="max-w-full" />
      </div>
      {combinedFFT.length > 0 && (
        <div className="mt-2 text-sm">
          <p>The graph shows the summed magnitude of frequency components across all sampled lines.</p>
          <p>Each vertical line represents a frequency, with taller lines indicating stronger presence in the image.</p>
          <p>Peaks can indicate regular patterns like pixel grids in upscaled pixel art.</p>
        </div>
      )}
    </div>
  );
};

export default FFTResultsDisplay;
