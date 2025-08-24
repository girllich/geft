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
  const [scaledReferenceImage, setScaledReferenceImage] = useState<string | null>(null);
  const [scale, setScale] = useState<number>(1);
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

  // Pixel-perfect scaling function
  const scaleImagePixelPerfect = (imageDataUrl: string, scaleFactor: number): Promise<string> => {
    return new Promise((resolve) => {
      if (scaleFactor === 1) {
        resolve(imageDataUrl);
        return;
      }

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageDataUrl);
          return;
        }

        canvas.width = img.width * scaleFactor;
        canvas.height = img.height * scaleFactor;

        // Disable image smoothing for pixel-perfect scaling
        ctx.imageSmoothingEnabled = false;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = imageDataUrl;
    });
  };

  // Handle reference image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event: ProgressEvent<FileReader>) => {
      const originalImage = event.target?.result as string;
      setReferenceImage(originalImage);
      
      // Scale the image and store the scaled version
      const scaled = await scaleImagePixelPerfect(originalImage, scale);
      setScaledReferenceImage(scaled);
    };
    reader.readAsDataURL(file);
  };

  // Handle scale change
  const handleScaleChange = async (newScale: number) => {
    setScale(newScale);
    
    if (referenceImage) {
      const scaled = await scaleImagePixelPerfect(referenceImage, newScale);
      setScaledReferenceImage(scaled);
    }
  };

  // Generate image with Gemini
  const generateImage = async () => {
    // No validation needed as we have default values for both prompt and reference image

    setGenerating(true);
    setError(null);
    
    try {
      const response = await GeminiService.generatePixelArt(
        scaledReferenceImage || referenceImage || '',
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
            <div className="mb-2">
              <label className="block text-sm font-medium mb-1">
                Scale Factor:
                <select 
                  value={scale} 
                  onChange={(e) => handleScaleChange(Number(e.target.value))}
                  className="ml-2 p-1 border border-gray-300 rounded"
                >
                  <option value={1}>1x (Original)</option>
                  <option value={2}>2x</option>
                  <option value={3}>3x</option>
                  <option value={4}>4x</option>
                  <option value={5}>5x</option>
                </select>
              </label>
            </div>
            
            <p className="text-sm font-medium">Reference Image Preview:</p>
            <div className="mt-1 p-2 border border-gray-300 bg-gray-50">
              <img 
                src={scaledReferenceImage || referenceImage} 
                alt="Reference" 
                className="max-w-xs max-h-40 object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
            {scale > 1 && (
              <p className="text-xs text-gray-600 mt-1">
                Scaled {scale}x for pixel-perfect enlargement (Original: {scale > 1 ? 'smaller' : 'same size'})
              </p>
            )}
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
