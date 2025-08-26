import React from 'react';

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  disabled?: boolean;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ 
  selectedModel, 
  onModelChange, 
  disabled = false 
}) => {
  const models = [
    { value: 'gemini-2.0-flash-preview-image-generation', label: 'Gemini 2.0 Flash (Current)' },
    { value: 'gemini-2.5-flash-image-preview', label: 'Gemini 2.5 Flash Image Preview' }
  ];

  return (
    <div className="mb-4">
      <label className="block mb-2 font-medium">
        AI Model:
        <select
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
          disabled={disabled}
          className="mt-1 block w-full p-2 border border-gray-300 rounded disabled:bg-gray-100"
        >
          {models.map((model) => (
            <option key={model.value} value={model.value}>
              {model.label}
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm text-gray-600 mt-1">
        Select the AI model to use for generating pixel art
      </p>
    </div>
  );
};

export default ModelSelector;