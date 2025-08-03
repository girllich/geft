import React, { useState, useEffect } from 'react';
import GeminiService from '../services/GeminiService';
import ApiKeyInput from './ApiKeyInput';

interface GeminiBatchInterfaceProps {
  onImageSelected: (imageData: string) => void;
  initialPrompt?: string;
}

const GeminiBatchInterface: React.FC<GeminiBatchInterfaceProps> = ({ 
  onImageSelected, 
  initialPrompt = '' 
}) => {
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>(initialPrompt);
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean>(GeminiService.hasApiKey());
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [concurrencyLimit, setConcurrencyLimit] = useState<number>(4);

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

  // Generate 16 images with Gemini in a single call
  const generateBatch = async () => {
    setGenerating(true);
    setError(null);
    setGeneratedImages([]);
    setSelectedImageIndex(null);
    
    try {
      const response = await GeminiService.generatePixelArtBatch(
        referenceImage || '',
        prompt || 'Please generate pixel art of a medieval peasant girl in the style of the reference image, 32x32 pixels',
        16,
        concurrencyLimit
      );
      
      if (response.images && response.images.length > 0) {
        console.log(`GeminiBatchInterface: Generated ${response.images.length} images successfully`);
        setGeneratedImages(response.images);
      } else if (response.textResponse) {
        setError(`The API returned a text response instead of images: "${response.textResponse.substring(0, 100)}..."`);
      } else {
        setError("Failed to generate pixel art batch. No images were returned.");
      }
    } catch (error) {
      console.error("Error generating batch with Gemini:", error);
      setError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setGenerating(false);
    }
  };

  // Handle image selection
  const handleImageSelect = (index: number) => {
    setSelectedImageIndex(index);
    onImageSelected(generatedImages[index]);
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
          Prompt for Gemini (will generate 16 images):
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
          Concurrency Limit (requests in parallel):
          <input 
            type="number" 
            min="1"
            max="16"
            value={concurrencyLimit}
            onChange={(e) => setConcurrencyLimit(Math.min(16, Math.max(1, parseInt(e.target.value) || 1)))}
            className="mt-1 block w-32 p-2 border border-gray-300 rounded"
          />
        </label>
        <p className="text-sm text-gray-600 mt-1">
          Number of requests to send in parallel (1-16)
        </p>
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
        onClick={generateBatch} 
        disabled={generating || !hasApiKey}
        className={`px-4 py-2 rounded ${
          !hasApiKey 
            ? 'bg-gray-300 cursor-not-allowed' 
            : generating 
              ? 'bg-gray-300' 
              : 'bg-purple-500 text-white'
        }`}
      >
        {!hasApiKey 
          ? 'API Key Required' 
          : generating 
            ? 'Generating 16 Images...' 
            : 'Generate 16 Images with Gemini'
        }
      </button>
      
      {error && (
        <div className="mt-2 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {generatedImages.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">Generated Images (Click to Analyze):</h3>
          <div className="grid grid-cols-4 gap-4">
            {generatedImages.map((imageData, index) => (
              <div 
                key={index}
                className={`cursor-pointer border-2 p-2 rounded ${
                  selectedImageIndex === index 
                    ? 'border-purple-500 bg-purple-50' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onClick={() => handleImageSelect(index)}
              >
                <img 
                  src={imageData} 
                  alt={`Generated ${index + 1}`}
                  className="w-full h-auto object-contain"
                  style={{ imageRendering: 'pixelated' }}
                />
                <p className="text-center text-sm mt-1">Image {index + 1}</p>
              </div>
            ))}
          </div>
          {selectedImageIndex !== null && (
            <p className="mt-2 text-sm text-green-600">
              Image {selectedImageIndex + 1} selected for analysis
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default GeminiBatchInterface;