import React, { useState, useEffect } from 'react';
import GeminiService from '../services/GeminiService';
import ApiKeyInput from './ApiKeyInput';
import ModelSelector from './ModelSelector';
import TemperatureSpinner from './TemperatureSpinner';
import LoadingSpinner from './LoadingSpinner';

interface TextureBatchInterfaceProps {
  onImageSelected: (imageData: string) => void;
  initialPrompt?: string;
  onAddReferenceImageRef?: React.MutableRefObject<((imageDataUrl: string) => void) | null>;
}

const TextureBatchInterface: React.FC<TextureBatchInterfaceProps> = ({ 
  onImageSelected, 
  initialPrompt = '',
  onAddReferenceImageRef
}) => {
  const [keyword, setKeyword] = useState<string>('stone');
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean>(GeminiService.hasApiKey());
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [concurrencyLimit, setConcurrencyLimit] = useState<number>(4);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash-image-preview');
  const [temperature, setTemperature] = useState<number>(1.0);
  const [useReferenceTexture, setUseReferenceTexture] = useState<boolean>(true);

  useEffect(() => {
    // Register a listener for API key changes
    const unsubscribe = GeminiService.addApiKeyListener(setHasApiKey);
    
    // Cleanup on unmount
    return () => unsubscribe();
  }, []);

  // Register the addReferenceImageFromExternal function with the parent component
  useEffect(() => {
    if (onAddReferenceImageRef) {
      onAddReferenceImageRef.current = null; // Texture mode doesn't use reference images
    }
  }, []);

  const handleApiKeySubmit = (apiKey: string) => {
    GeminiService.setApiKey(apiKey);
  };

  // Load reference image as data URL
  const loadReferenceImage = async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Failed to load reference image'));
      img.src = '/texture_reference.png';
    });
  };

  // Generate 4 texture images with Gemini
  const generateTextureBatch = async () => {
    setGenerating(true);
    setError(null);
    setGeneratedImages([]);
    setSelectedImageIndex(null);
    
    try {
      // Build the texture prompt
      const texturePrompt = `Generate a pixel art texture of a ${keyword}, 64x64 pixels, visible pixels, 3x scale. IMPORTANT! We need 3 repetitions of the same texture in the X and Y planes, so you just render the same texture 3x3 times. Make sure the pixels are VISIBLE, with sharp pixelation.`;
      
      // Conditionally load the reference texture image
      let referenceImages: string[] = [];
      if (useReferenceTexture) {
        const referenceImageDataUrl = await loadReferenceImage();
        referenceImages = [referenceImageDataUrl];
      }
      
      const response = await GeminiService.generatePixelArtBatch(
        referenceImages, // Use reference if checkbox is checked, empty array otherwise
        texturePrompt,
        4, // Only generate 4 images
        concurrencyLimit,
        selectedModel,
        temperature
      );
      
      if (response.images && response.images.length > 0) {
        console.log(`TextureBatchInterface: Generated ${response.images.length} texture images successfully`);
        setGeneratedImages(response.images);
      } else if (response.textResponse) {
        setError(`The API returned a text response instead of images: "${response.textResponse.substring(0, 100)}..."`);
      } else {
        setError("Failed to generate texture batch. No images were returned.");
      }
    } catch (error) {
      console.error("Error generating texture batch with Gemini:", error);
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
            To generate pixel art textures, you need to provide a Gemini API key.
          </p>
          <ApiKeyInput onApiKeySubmit={handleApiKeySubmit} />
        </div>
      )}
      
      <ModelSelector
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        disabled={generating}
      />
      
      <TemperatureSpinner
        temperature={temperature}
        onTemperatureChange={setTemperature}
        disabled={generating}
      />
      
      <div className="mb-4">
        <label className="block mb-2 font-medium">
          Texture Keyword (will generate 4 texture variations):
          <input 
            type="text" 
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="stone"
            className="mt-1 block w-full p-2 border border-gray-300 rounded"
          />
        </label>
        <p className="text-sm text-gray-600 mt-1">
          Enter a material or texture type (e.g., stone, wood, metal, grass, water, etc.)
        </p>
      </div>
      
      <div className="mb-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={useReferenceTexture}
            onChange={(e) => setUseReferenceTexture(e.target.checked)}
            className="mr-2"
          />
          <span className="text-sm font-medium">Use reference texture for style guidance</span>
        </label>
        <p className="text-sm text-gray-600 mt-1 ml-6">
          When enabled, uses a 3x3 tiled texture extracted from Angband tileset as style reference
        </p>
      </div>

      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
        <p className="text-sm text-blue-800">
          <strong>Generated prompt:</strong> "Generate a pixel art texture of a {keyword}, 64x64 pixels, visible pixels, 3x scale. IMPORTANT! We need 3 repetitions of the same texture in the X and Y planes, so you just render the same texture 3x3 times. Make sure the pixels are VISIBLE, with sharp pixelation."
        </p>
        {useReferenceTexture && (
          <p className="text-sm text-blue-600 mt-2">
            <strong>Reference image:</strong> Using Angband tileset texture as style guide.
          </p>
        )}
        {!useReferenceTexture && (
          <p className="text-sm text-orange-600 mt-2">
            <strong>No reference:</strong> Generating without style reference (may be less consistent).
          </p>
        )}
      </div>
      
      <div className="mb-4">
        <label className="block mb-2 font-medium">
          Concurrency Limit (requests in parallel):
          <input 
            type="number" 
            min="1"
            max="4"
            value={concurrencyLimit}
            onChange={(e) => setConcurrencyLimit(Math.min(4, Math.max(1, parseInt(e.target.value) || 1)))}
            className="mt-1 block w-32 p-2 border border-gray-300 rounded"
          />
        </label>
        <p className="text-sm text-gray-600 mt-1">
          Number of requests to send in parallel (1-4)
        </p>
      </div>
      
      {generating ? (
        <LoadingSpinner 
          message="Generating 4 texture images with Gemini..." 
          size="medium"
          className="my-4"
        />
      ) : (
        <button 
          onClick={generateTextureBatch} 
          disabled={!hasApiKey || !keyword.trim()}
          className={`px-4 py-2 rounded ${
            !hasApiKey || !keyword.trim()
              ? 'bg-gray-300 cursor-not-allowed' 
              : 'bg-indigo-500 text-white hover:bg-indigo-600'
          }`}
        >
          {!hasApiKey 
            ? 'API Key Required' 
            : !keyword.trim()
            ? 'Enter Keyword'
            : 'Generate 4 Texture Images'
          }
        </button>
      )}
      
      {error && (
        <div className="mt-2 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {generatedImages.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">Generated Texture Images (Click to Analyze):</h3>
          <div className="grid grid-cols-2 gap-4">
            {generatedImages.map((imageData, index) => (
              <div 
                key={index}
                className={`cursor-pointer border-2 p-2 rounded ${
                  selectedImageIndex === index 
                    ? 'border-indigo-500 bg-indigo-50' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onClick={() => handleImageSelect(index)}
              >
                <img 
                  src={imageData} 
                  alt={`Generated texture ${index + 1}`}
                  className="w-full h-auto object-contain"
                  style={{ imageRendering: 'pixelated' }}
                />
                <p className="text-center text-sm mt-1">Texture {index + 1}</p>
              </div>
            ))}
          </div>
          {selectedImageIndex !== null && (
            <p className="mt-2 text-sm text-green-600">
              Texture {selectedImageIndex + 1} selected for analysis
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default TextureBatchInterface;