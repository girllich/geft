import React, { useState } from 'react';

interface ApiKeyInputProps {
  onApiKeySubmit: (apiKey: string) => void;
}

const ApiKeyInput: React.FC<ApiKeyInputProps> = ({ onApiKeySubmit }) => {
  const [apiKey, setApiKey] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!apiKey.trim()) {
      setError('Please enter a valid API key');
      return;
    }
    
    // Basic validation - Gemini API keys typically start with "AIza"
    if (!apiKey.startsWith('AIza')) {
      setError('This doesn\'t look like a valid Gemini API key. Keys typically start with "AIza"');
      return;
    }
    
    setError(null);
    onApiKeySubmit(apiKey);
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Gemini API Key Required</h2>
      <p className="mb-4 text-gray-700">
        To use this application, you need to provide a Gemini API key. 
        You can get one from the <a 
          href="https://ai.google.dev/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline"
        >
          Google AI Studio
        </a>.
      </p>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="apiKey" className="block mb-2 font-medium">
            Gemini API Key:
          </label>
          <input 
            type="text" 
            id="apiKey"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your Gemini API key (starts with AIza...)"
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>
        
        {error && (
          <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
        
        <button 
          type="submit"
          className="w-full py-2 px-4 bg-blue-500 text-white font-medium rounded hover:bg-blue-600"
        >
          Submit API Key
        </button>
      </form>
      
      <div className="mt-4 text-sm text-gray-600">
        <p>Your API key will be stored in your browser's local storage and will not be sent to any server other than Google's API.</p>
      </div>
    </div>
  );
};

export default ApiKeyInput;
