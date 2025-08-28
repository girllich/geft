import React, { useState, useEffect } from 'react';
import GeminiService from '../services/GeminiService';
import ApiKeyInput from './ApiKeyInput';
import ModelSelector from './ModelSelector';
import TemperatureSpinner from './TemperatureSpinner';

interface SeasonsBatchInterfaceProps {
  onImageSelected: (imageData: string) => void;
  initialPrompt?: string;
}

const SeasonsBatchInterface: React.FC<SeasonsBatchInterfaceProps> = ({ 
  onImageSelected, 
  initialPrompt = '' 
}) => {
  const [referenceImages, setReferenceImages] = useState<{ original: string; scaled: string; scale: number; id: string }[]>([]);
  const [nextImageId, setNextImageId] = useState<number>(1);
  const [promptTemplate, setPromptTemplate] = useState<string>(
    initialPrompt || 'Generate realistic pixel art of the reference image in {season}, pixel art, white background, 32x32 pixels, visible pixels, 3x pixel perfect scale- IMPORTANT- show pixels at 3:1 scale with correct aspect ratio, and make the BACKGROUND WHITE'
  );
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean>(GeminiService.hasApiKey());
  const [generatedImages, setGeneratedImages] = useState<Array<{images: string[], season: string, seasonName: string}>>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<{setIndex: number, imageIndex: number} | null>(null);
  const [concurrencyLimit, setConcurrencyLimit] = useState<number>(4);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash-image-preview');
  const [temperature, setTemperature] = useState<number>(1.0);
  const [seasonsCollapsed, setSeasonsCollapsed] = useState<boolean>(false);

  // Default seasonal descriptions
  const [seasonsData, setSeasonsData] = useState<Array<{seasonName: string, season: string}>>([
    { seasonName: 'Summer', season: 'lush green summer with full foliage, bright green leaves, warm sunny day, vibrant colors' },
    { seasonName: 'Autumn', season: 'autumn with red and orange leaves, fall colors, changing foliage, warm autumn tones' },
    { seasonName: 'Late Fall', season: 'late fall with bare branches, leaves fallen, brown and barren trees, end of autumn' },
    { seasonName: 'Winter', season: 'winter with snow covering everything, snowy landscape, white snow on branches and ground, cold winter scene' },
    { seasonName: 'Spring', season: 'early spring with budding trees, new green shoots, fresh spring growth, blooming flowers, renewal and growth' }
  ]);

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
        
        setReferenceImages(prev => [...prev, {
          original: originalImage,
          scaled: scaled,
          scale: scaleFactor,
          id: imageId
        }]);
        setNextImageId(prev => prev + 1);
      };
      reader.readAsDataURL(file);
    };
    fileInput.click();
  };

  // Remove reference image
  const removeReferenceImage = (imageId: string) => {
    setReferenceImages(prev => prev.filter(img => img.id !== imageId));
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

  // Update seasonal description
  const updateSeason = (index: number, value: string) => {
    setSeasonsData(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], season: value };
      return updated;
    });
  };

  // Template the prompt with season
  const templatePrompt = (season: string): string => {
    return promptTemplate.replace('{season}', season);
  };

  // Generate seasonal batch (5 sets of 2 images each)
  const generateSeasonsBatch = async () => {
    setGenerating(true);
    setError(null);
    setGeneratedImages([]);
    setSelectedImageIndex(null);
    
    try {
      // Use all reference images if available, otherwise empty array
      const allReferenceImages = referenceImages.map(img => img.scaled);
      
      const results: Array<{images: string[], season: string, seasonName: string}> = [];
      
      // Generate 2 images for each season
      for (let i = 0; i < seasonsData.length; i++) {
        const { seasonName, season } = seasonsData[i];
        const templatedPrompt = templatePrompt(season);
        
        console.log(`Generating ${seasonName} set for season: "${season}"`);
        
        const response = await GeminiService.generatePixelArtBatch(
          allReferenceImages,
          templatedPrompt,
          2, // 2 images per season
          Math.min(concurrencyLimit, 2),
          selectedModel,
          temperature
        );
        
        if (response.images && response.images.length > 0) {
          results.push({
            images: response.images,
            season: season,
            seasonName: seasonName
          });
          console.log(`Generated ${response.images.length} images for "${seasonName}"`);
        } else {
          console.warn(`No images generated for season: "${seasonName}"`);
        }
        
        // Small delay between sets to avoid rate limiting
        if (i < seasonsData.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      if (results.length > 0) {
        console.log(`SeasonsBatchInterface: Generated ${results.length} sets successfully`);
        setGeneratedImages(results);
      } else {
        setError("Failed to generate any seasonal images.");
      }
    } catch (error) {
      console.error("Error generating seasonal batch with Gemini:", error);
      setError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setGenerating(false);
    }
  };

  // Handle image selection
  const handleImageSelect = (setIndex: number, imageIndex: number) => {
    setSelectedImageIndex({setIndex, imageIndex});
    onImageSelected(generatedImages[setIndex].images[imageIndex]);
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
          Prompt Template (use {'{season}'} placeholder):
          <input 
            type="text" 
            value={promptTemplate}
            onChange={(e) => setPromptTemplate(e.target.value)}
            placeholder="Generate realistic pixel art of the reference image in {season}, pixel art, white background, 32x32 pixels"
            className="mt-1 block w-full p-2 border border-gray-300 rounded"
          />
        </label>
        <p className="text-sm text-gray-600 mt-1">
          The {'{season}'} placeholder will be replaced with each seasonal description below
        </p>
      </div>

      {/* Collapsible Seasons Section */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setSeasonsCollapsed(!seasonsCollapsed)}
          className="flex items-center justify-between w-full p-3 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 transition-colors"
        >
          <span className="font-medium">Seasonal Descriptions (5 sets of 2 images each)</span>
          <span className="text-gray-500">
            {seasonsCollapsed ? '▼' : '▲'}
          </span>
        </button>
        
        {!seasonsCollapsed && (
          <div className="mt-2 p-4 border border-gray-300 rounded-b bg-gray-50">
            <div className="grid grid-cols-1 gap-3">
              {seasonsData.map((data, index) => (
                <div key={index}>
                  <label className="block text-sm font-medium mb-1">
                    {data.seasonName}:
                    <textarea
                      value={data.season}
                      onChange={(e) => updateSeason(index, e.target.value)}
                      className="mt-1 block w-full p-2 border border-gray-300 rounded text-sm"
                      placeholder={`${data.seasonName} description`}
                      rows={2}
                    />
                  </label>
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-600 mt-3">
              Each season will generate 2 images, for a total of 10 images
            </p>
          </div>
        )}
      </div>
      
      <div className="mb-4">
        <label className="block mb-2 font-medium">
          Concurrency Limit (requests in parallel):
          <input 
            type="number" 
            min="1"
            max="5"
            value={concurrencyLimit}
            onChange={(e) => setConcurrencyLimit(Math.min(5, Math.max(1, parseInt(e.target.value) || 1)))}
            className="mt-1 block w-32 p-2 border border-gray-300 rounded"
          />
        </label>
        <p className="text-sm text-gray-600 mt-1">
          Number of requests to send in parallel (1-5)
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
                    className="max-w-xs max-h-40 object-contain"
                    style={{ imageRendering: 'pixelated' }}
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
      
      <button 
        onClick={generateSeasonsBatch} 
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
            ? 'Generating Seasonal Sets...' 
            : 'Generate 5 Seasonal Sets (10 Images)'
        }
      </button>
      
      {error && (
        <div className="mt-2 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {generatedImages.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">Generated Seasonal Sets (Click to Analyze):</h3>
          {generatedImages.map((set, setIndex) => (
            <div key={setIndex} className="mb-6">
              <h4 className="font-medium mb-2 text-gray-700">
                {set.seasonName}: "{set.season}"
              </h4>
              <div className="grid grid-cols-2 gap-4 max-w-md">
                {set.images.map((imageData, imageIndex) => (
                  <div 
                    key={imageIndex}
                    className={`cursor-pointer border-2 p-2 rounded ${
                      selectedImageIndex?.setIndex === setIndex && selectedImageIndex?.imageIndex === imageIndex
                        ? 'border-green-500 bg-green-50' 
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    onClick={() => handleImageSelect(setIndex, imageIndex)}
                  >
                    <img 
                      src={imageData} 
                      alt={`${set.seasonName} - ${imageIndex + 1}`}
                      className="w-full h-auto object-contain"
                      style={{ imageRendering: 'pixelated' }}
                    />
                    <p className="text-center text-sm mt-1">{set.seasonName}-{imageIndex + 1}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {selectedImageIndex !== null && (
            <p className="mt-2 text-sm text-green-600">
              {generatedImages[selectedImageIndex.setIndex]?.seasonName}-{selectedImageIndex.imageIndex + 1} selected for analysis
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default SeasonsBatchInterface;