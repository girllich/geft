import React from 'react';

interface TemperatureSpinnerProps {
  temperature: number;
  onTemperatureChange: (temperature: number) => void;
  disabled?: boolean;
}

const TemperatureSpinner: React.FC<TemperatureSpinnerProps> = ({ 
  temperature, 
  onTemperatureChange, 
  disabled = false 
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0 && value <= 2) {
      onTemperatureChange(value);
    }
  };

  const incrementTemperature = () => {
    const newTemp = Math.min(2.0, Math.round((temperature + 0.1) * 10) / 10);
    onTemperatureChange(newTemp);
  };

  const decrementTemperature = () => {
    const newTemp = Math.max(0.0, Math.round((temperature - 0.1) * 10) / 10);
    onTemperatureChange(newTemp);
  };

  return (
    <div className="mb-4">
      <label className="block mb-2 font-medium">
        Temperature (Creativity):
      </label>
      <div className="flex items-center space-x-2">
        <button
          type="button"
          onClick={decrementTemperature}
          disabled={disabled || temperature <= 0}
          className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          −
        </button>
        <input
          type="number"
          value={temperature}
          onChange={handleChange}
          min="0"
          max="2"
          step="0.1"
          disabled={disabled}
          className="w-20 p-2 border border-gray-300 rounded text-center disabled:bg-gray-100"
        />
        <button
          type="button"
          onClick={incrementTemperature}
          disabled={disabled || temperature >= 2}
          className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          +
        </button>
      </div>
      <p className="text-sm text-gray-600 mt-1">
        {temperature === 0 ? 'Most deterministic' : 
         temperature < 0.5 ? 'Low creativity' :
         temperature < 1.5 ? 'Moderate creativity' : 
         'High creativity'} • Range: 0.0 - 2.0
      </p>
    </div>
  );
};

export default TemperatureSpinner;