import React, { useState, useEffect } from 'react';
import GeminiService from '../services/GeminiService';
import ApiKeyInput from './ApiKeyInput';

interface GeminiInterfaceProps {
  onImageGenerated: (imageData: string) => void;
  initialPrompt?: string;
}

const GeminiInterface: React.FC<GeminiInterfaceProps> = ({ 
  onImageGenerated, 
  initialPrompt = '' 
}) => {
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>(initialPrompt);
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean>(GeminiService.hasApiKey());

  useEffect(() => {
    // Register a listener for API key changes
    const unsubscribe = GeminiService.addApiKeyListener(setHasApiKey);
    
    // Cleanup on unmount
    return () => unsubscribe();
  }, []);

  const handleApiKeySubmit = (apiKey: string) => {
    GeminiService.setApiKey(apiKey);
  };

  // Handle reference image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event: ProgressEvent<FileReader>) => {
      setReferenceImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Generate image with Gemini
  const generateImage = async () => {
    // No validation needed as we have default values for both prompt and reference image

    setGenerating(true);
    setError(null);
    
    try {
      const response = await GeminiService.generatePixelArt(
        referenceImage || '',
        prompt || 'Please generate pixel art of a medieval peasant girl in the style of the reference image, 32x32 pixels'
      );
      
      if (response.imageData) {
        console.log("GeminiInterface: Image generated successfully, calling onImageGenerated");
        onImageGenerated(response.imageData);
      } else if (response.textResponse) {
        setError(`The API returned a text response instead of an image: "${response.textResponse.substring(0, 100)}..."`);
      } else {
        setError("Failed to generate pixel art. No image or text was returned.");
      }
    } catch (error) {
      console.error("Error generating with Gemini:", error);
      setError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="mb-6">
      {!hasApiKey && (
        <div className="mb-6 p-4 bg-white rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-2">Gemini API Key Required</h3>
          <p className="mb-4 text-gray-700">
            To generate pixel art, you need to provide a Gemini API key.
          </p>
          <ApiKeyInput onApiKeySubmit={handleApiKeySubmit} />
        </div>
      )}
      
      <div className="mb-4">
        <label className="block mb-2 font-medium">
          Prompt for Gemini:
          <input 
            type="text" 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Please generate pixel art of a medieval peasant girl in the style of the reference image, 32x32 pixels"
            className="mt-1 block w-full p-2 border border-gray-300 rounded"
          />
        </label>
      </div>
      
      <div className="mb-4">
        <label className="block mb-2 font-medium">
          Reference Image (Optional - gervais.gif will be used by default):
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleImageUpload} 
            className="mt-1 block w-full p-2 border border-gray-300 rounded"
          />
        </label>
        <p className="text-sm text-gray-600 mt-1">
          Upload a reference image to guide the style of the generated pixel art, or leave empty to use gervais.gif as the default reference
        </p>
        
        {referenceImage && (
          <div className="mt-2">
            <p className="text-sm font-medium">Reference Image Preview:</p>
            <img 
              src={referenceImage} 
              alt="Reference" 
              className="mt-1 max-w-xs max-h-40 object-contain border border-gray-300"
            />
          </div>
        )}
      </div>
      
      <button 
        onClick={generateImage} 
        disabled={generating || !hasApiKey}
        className={`px-4 py-2 rounded ${
          !hasApiKey 
            ? 'bg-gray-300 cursor-not-allowed' 
            : generating 
              ? 'bg-gray-300' 
              : 'bg-green-500 text-white'
        }`}
      >
        {!hasApiKey 
          ? 'API Key Required' 
          : generating 
            ? 'Generating...' 
            : 'Generate with Gemini'
        }
      </button>
      
      {error && (
        <div className="mt-2 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
    </div>
  );
};

export default GeminiInterface;
