import React from 'react';

interface OffsetStrideSpinnerProps {
  offset: number;
  stride: number;
  onOffsetChange: (offset: number) => void;
  onStrideChange: (stride: number) => void;
  disabled?: boolean;
}

const OffsetStrideSpinner: React.FC<OffsetStrideSpinnerProps> = ({ 
  offset, 
  stride, 
  onOffsetChange, 
  onStrideChange, 
  disabled = false 
}) => {
  const handleOffsetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0 && value <= 1) {
      onOffsetChange(value);
    }
  };

  const handleStrideChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0.1) {
      onStrideChange(value);
    }
  };

  const incrementOffset = () => {
    const newOffset = Math.min(1.0, Math.round((offset + 0.05) * 100) / 100);
    onOffsetChange(newOffset);
  };

  const decrementOffset = () => {
    const newOffset = Math.max(0.0, Math.round((offset - 0.05) * 100) / 100);
    onOffsetChange(newOffset);
  };

  const incrementStride = () => {
    const newStride = Math.round((stride + 0.1) * 10) / 10;
    onStrideChange(newStride);
  };

  const decrementStride = () => {
    const newStride = Math.max(0.1, Math.round((stride - 0.1) * 10) / 10);
    onStrideChange(newStride);
  };

  return (
    <div className="mb-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Offset Control */}
        <div>
          <label className="block mb-2 font-medium">
            Grid Offset:
          </label>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={decrementOffset}
              disabled={disabled || offset <= 0}
              className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              −
            </button>
            <input
              type="number"
              value={offset}
              onChange={handleOffsetChange}
              min="0"
              max="1"
              step="0.05"
              disabled={disabled}
              className="w-20 p-2 border border-gray-300 rounded text-center disabled:bg-gray-100"
            />
            <button
              type="button"
              onClick={incrementOffset}
              disabled={disabled || offset >= 1}
              className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Grid start position (0.0 - 1.0)
          </p>
        </div>

        {/* Stride Control */}
        <div>
          <label className="block mb-2 font-medium">
            Pixel Spacing:
          </label>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={decrementStride}
              disabled={disabled || stride <= 0.1}
              className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              −
            </button>
            <input
              type="number"
              value={stride}
              onChange={handleStrideChange}
              min="0.1"
              step="0.1"
              disabled={disabled}
              className="w-20 p-2 border border-gray-300 rounded text-center disabled:bg-gray-100"
            />
            <button
              type="button"
              onClick={incrementStride}
              disabled={disabled}
              className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Distance between sampled pixels
          </p>
        </div>
      </div>
      
      <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
        <strong>Grid Correction:</strong> Adjust these values if the AI model gets the pixel grid alignment slightly wrong.
        <br />
        <strong>Offset:</strong> Shifts where sampling starts within each grid cell.
        <br />
        <strong>Stride:</strong> Distance in pixels between sampling points.
      </div>
    </div>
  );
};

export default OffsetStrideSpinner;