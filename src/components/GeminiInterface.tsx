import React, { useState, useEffect } from 'react';
import GeminiService from '../services/GeminiService';
import ApiKeyInput from './ApiKeyInput';
import ModelSelector from './ModelSelector';
import TemperatureSpinner from './TemperatureSpinner';
import LoadingSpinner from './LoadingSpinner';

interface GeminiInterfaceProps {
  onImageGenerated: (imageData: string) => void;
  initialPrompt?: string;
  onAddReferenceImageRef?: React.MutableRefObject<((imageDataUrl: string) => void) | null>;
}

// Function to get default prompt based on model
const getDefaultPrompt = (model: string): string => {
  if (model === 'gemini-2.0-flash-preview-image-generation') {
    return 'Please generate pixel art of a medieval peasant girl in the style of the reference image, 32x32 pixels';
  } else if (model === 'gemini-2.5-flash-image-preview') {
    return 'Generate high quality low resolution pixel art of a single character in the style of one of the sprites in the reference image, white background, 32x32 pixels, visible pixels, 3x pixel perfect scale- IMPORTANT- show pixels at 3:1 scale with correct aspect ratio, and make the BACKGROUND WHITE';
  }
  return 'Please generate pixel art of a medieval peasant girl in the style of the reference image, 32x32 pixels';
};

const GeminiInterface: React.FC<GeminiInterfaceProps> = ({ 
  onImageGenerated, 
  initialPrompt = '',
  onAddReferenceImageRef
}) => {
  const [referenceImages, setReferenceImages] = useState<{ original: string; scaled: string; scale: number; id: string; width: number; height: number }[]>([]);
  const [nextImageId, setNextImageId] = useState<number>(1);
  const [prompt, setPrompt] = useState<string>(initialPrompt || getDefaultPrompt('gemini-2.5-flash-image-preview'));
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean>(GeminiService.hasApiKey());
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash-image-preview');
  const [temperature, setTemperature] = useState<number>(1.0);

  useEffect(() => {
    // Register a listener for API key changes
    const unsubscribe = GeminiService.addApiKeyListener(setHasApiKey);
    
    // Cleanup on unmount
    return () => unsubscribe();
  }, []);

  // Update prompt when model changes (only if using default prompt)
  useEffect(() => {
    const defaultPrompt = getDefaultPrompt(selectedModel);
    // Only update if the current prompt matches any of the default prompts
    const defaultPrompts = [
      getDefaultPrompt('gemini-2.0-flash-preview-image-generation'),
      getDefaultPrompt('gemini-2.5-flash-image-preview')
    ];
    
    console.log('Model changed to:', selectedModel, 'Current prompt:', prompt, 'New default:', defaultPrompt);
    
    if (defaultPrompts.includes(prompt) || prompt === '' || prompt === initialPrompt) {
      console.log('Updating prompt to:', defaultPrompt);
      setPrompt(defaultPrompt);
    }
  }, [selectedModel]);

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

  // Expose the function via ref
  useEffect(() => {
    if (onAddReferenceImageRef) {
      onAddReferenceImageRef.current = addReferenceImageFromExternal;
    }
  }, [onAddReferenceImageRef]);

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


  // Generate image with Gemini
  const generateImage = async () => {
    // No validation needed as we have default values for both prompt and reference image

    setGenerating(true);
    setError(null);
    
    try {
      // Use all reference images if available, otherwise empty array
      const allReferenceImages = referenceImages.map(img => img.scaled);
      
      const response = await GeminiService.generatePixelArt(
        allReferenceImages,
        prompt || getDefaultPrompt(selectedModel),
        selectedModel,
        temperature
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
          Prompt for Gemini:
          <input 
            type="text" 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={getDefaultPrompt(selectedModel)}
            key={selectedModel}
            className="mt-1 block w-full p-2 border border-gray-300 rounded"
          />
        </label>
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
          message="Generating with Gemini..." 
          size="medium"
          className="my-4"
        />
      ) : (
        <button 
          onClick={generateImage} 
          disabled={!hasApiKey}
          className={`px-4 py-2 rounded ${
            !hasApiKey 
              ? 'bg-gray-300 cursor-not-allowed' 
              : 'bg-green-500 text-white hover:bg-green-600'
          }`}
        >
          {!hasApiKey 
            ? 'API Key Required' 
            : 'Generate with Gemini'
          }
        </button>
      )}
      
      {error && (
        <div className="mt-2 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
    </div>
  );
};

export default GeminiInterface;
