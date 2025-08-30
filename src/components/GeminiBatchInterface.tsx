import React, { useState, useEffect } from 'react';
import GeminiService from '../services/GeminiService';
import ApiKeyInput from './ApiKeyInput';
import ModelSelector from './ModelSelector';
import TemperatureSpinner from './TemperatureSpinner';
import LoadingSpinner from './LoadingSpinner';

interface GeminiBatchInterfaceProps {
  onImageSelected: (imageData: string) => void;
  initialPrompt?: string;
  onAddReferenceImageRef?: React.MutableRefObject<((imageDataUrl: string) => void) | null>;
}

const GeminiBatchInterface: React.FC<GeminiBatchInterfaceProps> = ({ 
  onImageSelected, 
  initialPrompt = '',
  onAddReferenceImageRef
}) => {
  const [referenceImages, setReferenceImages] = useState<{ original: string; scaled: string; scale: number; id: string; width: number; height: number }[]>([]);
  const [nextImageId, setNextImageId] = useState<number>(1);
  const [prompt, setPrompt] = useState<string>(initialPrompt);
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean>(GeminiService.hasApiKey());
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [concurrencyLimit, setConcurrencyLimit] = useState<number>(4);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash-image-preview');
  const [temperature, setTemperature] = useState<number>(1.0);

  useEffect(() => {
    // Register a listener for API key changes
    const unsubscribe = GeminiService.addApiKeyListener(setHasApiKey);
    
    // Cleanup on unmount
    return () => unsubscribe();
  }, []);

  // Register the addReferenceImageFromExternal function with the parent component
  useEffect(() => {
    if (onAddReferenceImageRef) {
      onAddReferenceImageRef.current = addReferenceImageFromExternal;
    }
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

  // Add new reference image
  const addReferenceImage = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event: ProgressEvent<FileReader>) => {
        const originalImage = event.target?.result as string;
        const scaleFactor = 1;
        const scaled = await scaleImagePixelPerfect(originalImage, scaleFactor);
        const imageId = `img_${nextImageId}`;
        
        // Get image dimensions
        const img = new Image();
        img.onload = () => {
          setReferenceImages(prev => [...prev, {
            original: originalImage,
            scaled: scaled,
            scale: scaleFactor,
            id: imageId,
            width: img.width,
            height: img.height
          }]);
          setNextImageId(prev => prev + 1);
        };
        img.src = originalImage;
      };
      reader.readAsDataURL(file);
    };
    fileInput.click();
  };

  // Remove reference image
  const removeReferenceImage = (imageId: string) => {
    setReferenceImages(prev => prev.filter(img => img.id !== imageId));
  };

  // Add reference image from external source (like saved pixel art)
  const addReferenceImageFromExternal = async (imageDataUrl: string) => {
    const scaleFactor = 3; // Default to 3x scale as requested
    const scaled = await scaleImagePixelPerfect(imageDataUrl, scaleFactor);
    const imageId = `img_${nextImageId}`;
    
    // Get image dimensions
    const img = new Image();
    img.onload = () => {
      setReferenceImages(prev => [...prev, {
        original: imageDataUrl,
        scaled: scaled,
        scale: scaleFactor,
        id: imageId,
        width: img.width,
        height: img.height
      }]);
      setNextImageId(prev => prev + 1);
    };
    img.src = imageDataUrl;
  };

  // Update scale for specific image
  const updateImageScale = async (imageId: string, newScale: number) => {
    setReferenceImages(prev => prev.map(async (img) => {
      if (img.id === imageId) {
        const scaled = await scaleImagePixelPerfect(img.original, newScale);
        return { ...img, scale: newScale, scaled };
      }
      return img;
    }));
    
    // Wait for all async operations to complete
    const updatedImages = await Promise.all(
      referenceImages.map(async (img) => {
        if (img.id === imageId) {
          const scaled = await scaleImagePixelPerfect(img.original, newScale);
          return { ...img, scale: newScale, scaled };
        }
        return img;
      })
    );
    setReferenceImages(updatedImages);
  };


  // Generate 16 images with Gemini in a single call
  const generateBatch = async () => {
    setGenerating(true);
    setError(null);
    setGeneratedImages([]);
    setSelectedImageIndex(null);
    
    try {
      // Use all reference images if available, otherwise empty array
      const allReferenceImages = referenceImages.map(img => img.scaled);
      
      const response = await GeminiService.generatePixelArtBatch(
        allReferenceImages,
        prompt || 'Please generate pixel art of a medieval peasant girl in the style of the reference image, 32x32 pixels',
        16,
        concurrencyLimit,
        selectedModel,
        temperature
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
        <div className="flex items-center justify-between mb-2">
          <label className="block font-medium">
            Reference Images (Optional - gervais.gif will be used by default):
          </label>
          <button
            type="button"
            onClick={addReferenceImage}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          >
            + Add Image
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-3">
          Upload reference images to guide the style of the generated pixel art, or leave empty to use gervais.gif as the default reference
        </p>
        
        {referenceImages.length > 0 && (
          <div className="space-y-4">
            {referenceImages.map((img, index) => (
              <div key={img.id} className="border border-gray-300 rounded p-3 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Reference Image {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeReferenceImage(img.id)}
                    className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                  >
                    - Remove
                  </button>
                </div>
                
                <div className="mb-2">
                  <label className="block text-sm font-medium mb-1">
                    Scale Factor:
                    <select 
                      value={img.scale} 
                      onChange={(e) => updateImageScale(img.id, Number(e.target.value))}
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
                
                <div className="mt-1 p-2 border border-gray-300 bg-white">
                  <img 
                    src={img.scaled} 
                    alt={`Reference ${index + 1}`} 
                    style={{ 
                      imageRendering: 'pixelated',
                      width: `${img.width * img.scale}px`,
                      height: `${img.height * img.scale}px`,
                      objectFit: 'contain',
                      maxWidth: '300px',
                      maxHeight: '200px'
                    }}
                  />
                </div>
                {img.scale > 1 && (
                  <p className="text-xs text-gray-600 mt-1">
                    Scaled {img.scale}x for pixel-perfect enlargement
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {generating ? (
        <LoadingSpinner 
          message="Generating 16 images with Gemini..." 
          size="medium"
          className="my-4"
        />
      ) : (
        <button 
          onClick={generateBatch} 
          disabled={!hasApiKey}
          className={`px-4 py-2 rounded ${
            !hasApiKey 
              ? 'bg-gray-300 cursor-not-allowed' 
              : 'bg-purple-500 text-white hover:bg-purple-600'
          }`}
        >
          {!hasApiKey 
            ? 'API Key Required' 
            : 'Generate 16 Images with Gemini'
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