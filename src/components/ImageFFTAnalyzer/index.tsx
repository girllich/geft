import React, { useState } from 'react';
import ImageUploader from './ImageUploader';
import AnalysisControls from './AnalysisControls';
import OriginalImageDisplay from './OriginalImageDisplay';
import FFTResultsDisplay from './FFTResultsDisplay';
import PixelArtDisplay from './PixelArtDisplay';
import AnalysisSummary from './AnalysisSummary';
import SavedPixelArtSidebar from './SavedPixelArtSidebar';
import { useImageAnalysis } from './hooks/useImageAnalysis';
import { usePixelArtGeneration } from './hooks/usePixelArtGeneration';
import GeminiInterface from '../GeminiInterface';
import GeminiBatchInterface from '../GeminiBatchInterface';
import OrientationBatchInterface from '../OrientationBatchInterface';
import SeasonsBatchInterface from '../SeasonsBatchInterface';
import OffsetStrideSpinner from '../OffsetStrideSpinner';
import ImageModal from '../ImageModal';
import LoadingSpinner from '../LoadingSpinner';

type Mode = 'analyze' | 'generate' | 'generate-batch' | 'orientation' | 'seasons';

const ImageFFTAnalyzer: React.FC = () => {
  const [mode, setMode] = useState<Mode>('generate');
  const [prompt, setPrompt] = useState<string>('');
  const [offset, setOffset] = useState<number>(0.0);
  const [stride, setStride] = useState<number>(1.0);
  const [isFFTComplete, setIsFFTComplete] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalImageSrc, setModalImageSrc] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState<number>(0);
  const addReferenceImageRef = React.useRef<((imageDataUrl: string) => void) | null>(null);

  const {
    imageData,
    originalImage,
    imageWidth,
    imageHeight,
    fftResults,
    combinedFFT,
    smoothedFFT,
    selectedLines,
    dominantFrequency,
    pixelSamples,
    processing,
    canvasRef,
    resultCanvasRef,
    handleImageUpload,
    performFFT,
    visualizeResults,
    reprocessWithOffsetStride
  } = useImageAnalysis();

  const {
    generatedPixelArt,
    pixelArtDataURL,
    transparentPixelArtDataURL,
    colorHistogram,
    pixelArtCanvasRef,
    transparentPixelArtCanvasRef,
    histogramCanvasRef
  } = usePixelArtGeneration(imageData, imageWidth, imageHeight, dominantFrequency, pixelSamples, stride);

  // Update stride when FFT completes
  React.useEffect(() => {
    if (dominantFrequency && dominantFrequency > 0 && imageHeight > 0) {
      const computedStride = imageHeight / dominantFrequency;
      setStride(computedStride);
      setIsFFTComplete(true);
    }
  }, [dominantFrequency, imageHeight]);

  // Handle spinner changes
  const handleOffsetChange = (newOffset: number) => {
    setOffset(newOffset);
    if (isFFTComplete && imageData) {
      reprocessWithOffsetStride(newOffset, stride);
    }
  };

  const handleStrideChange = (newStride: number) => {
    setStride(newStride);
    if (isFFTComplete && imageData) {
      reprocessWithOffsetStride(offset, newStride);
    }
  };

  // Handle image generated from GeminiInterface
  const handleGeminiImageGenerated = (imageData: string) => {
    setIsFFTComplete(false);
    console.log("ImageFFTAnalyzer: handleGeminiImageGenerated called with image data");
    
    // Load the generated image
    const img = new Image();
    img.onload = () => {
      console.log("ImageFFTAnalyzer: Image loaded successfully", { width: img.width, height: img.height });
      
      // Create a canvas to get the image data
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        
        // Log the current state before updating
        console.log("ImageFFTAnalyzer: Before handleImageUpload", {
          currentImageWidth: imageWidth,
          currentImageHeight: imageHeight,
          currentDominantFrequency: dominantFrequency,
          currentPixelSamplesLength: pixelSamples.length,
          hasCurrentImageData: !!imageData
        });
        
        // Update the state with the image and perform FFT after the image data has been set
        console.log("ImageFFTAnalyzer: Calling handleImageUpload with Gemini image and callback");
        handleImageUpload(null, img, () => {
          // Perform FFT after the image data has been set, passing the image data directly
          console.log("ImageFFTAnalyzer: Callback executing, now calling performFFT() with imgData");
          performFFT(imgData);
        });
        
        // Log the state after FFT processing (this will execute before the async state updates)
        console.log("ImageFFTAnalyzer: After performFFT call - Note: state updates are async and may not be reflected yet", {
          imageWidth,
          imageHeight,
          dominantFrequency,
          pixelSamplesLength: pixelSamples.length
        });
      }
    };
    
    img.onerror = (error) => {
      console.error("ImageFFTAnalyzer: Failed to load image", error);
    };
    
    img.src = imageData;
    console.log("ImageFFTAnalyzer: Set image source, waiting for load");
  };

  return (
    <>
      <SavedPixelArtSidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        refreshTrigger={sidebarRefreshTrigger}
        onSetAsReference={(imageDataUrl: string) => {
          if (addReferenceImageRef.current) {
            addReferenceImageRef.current(imageDataUrl);
          }
        }}
      />
      
      <div className={`w-full max-w-4xl mx-auto p-4 transition-all duration-300 ${
        isSidebarOpen ? 'ml-80' : ''
      }`}>
      <h2 className="text-2xl font-bold mb-4">Pixel Art Generation & Resolution Analysis</h2>
      
      <div className="mb-6">
        <div className="flex mb-4">
          <button 
            onClick={() => setMode('analyze')} 
            className={`px-4 py-2 rounded-l ${mode === 'analyze' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            Analyze Image
          </button>
          <button 
            onClick={() => setMode('generate')} 
            className={`px-4 py-2 ${mode === 'generate' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            Generate with Gemini
          </button>
          <button 
            onClick={() => setMode('generate-batch')} 
            className={`px-4 py-2 ${mode === 'generate-batch' ? 'bg-purple-500 text-white' : 'bg-gray-200'}`}
          >
            Generate 16 Images
          </button>
          <button 
            onClick={() => setMode('orientation')} 
            className={`px-4 py-2 ${mode === 'orientation' ? 'bg-orange-500 text-white' : 'bg-gray-200'}`}
          >
            Orientation
          </button>
          <button 
            onClick={() => setMode('seasons')} 
            className={`px-4 py-2 rounded-r ${mode === 'seasons' ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
          >
            Seasons (doesn't work well)
          </button>
        </div>
        
        {mode === 'analyze' ? (
          <>
            <ImageUploader 
              handleImageUpload={handleImageUpload} 
              imageData={imageData}
            />
            
            <AnalysisControls 
              imageData={imageData}
              processing={processing}
              performFFT={performFFT}
              dominantFrequency={dominantFrequency}
              imageHeight={imageHeight}
              combinedFFT={combinedFFT}
            />
          </>
        ) : mode === 'generate' ? (
          <GeminiInterface 
            onImageGenerated={handleGeminiImageGenerated}
            initialPrompt={prompt}
            onAddReferenceImageRef={addReferenceImageRef}
          />
        ) : mode === 'generate-batch' ? (
          <GeminiBatchInterface 
            onImageSelected={handleGeminiImageGenerated}
            initialPrompt={prompt}
          />
        ) : mode === 'orientation' ? (
          <OrientationBatchInterface 
            onImageSelected={handleGeminiImageGenerated}
            initialPrompt={prompt}
          />
        ) : (
          <SeasonsBatchInterface 
            onImageSelected={handleGeminiImageGenerated}
            initialPrompt={prompt}
          />
        )}
      </div>
      
      {/* Show FFT processing spinner when in generate modes and FFT is running */}
      {(mode === 'generate' || mode === 'generate-batch' || mode === 'orientation' || mode === 'seasons') && processing && (
        <LoadingSpinner 
          message="Analyzing generated image with FFT..." 
          size="medium"
          className="my-6"
        />
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <OriginalImageDisplay 
          canvasRef={canvasRef}
          selectedLines={selectedLines}
          dominantFrequency={dominantFrequency}
          imageHeight={imageHeight}
          onCanvasClick={() => {
            if (canvasRef.current) {
              setModalImageSrc(canvasRef.current.toDataURL());
              setIsModalOpen(true);
            }
          }}
        />
        
        <FFTResultsDisplay 
          resultCanvasRef={resultCanvasRef}
          combinedFFT={combinedFFT}
        />
      </div>
      
      {pixelArtDataURL && (
        <>
          <OffsetStrideSpinner
            offset={offset}
            stride={stride}
            onOffsetChange={handleOffsetChange}
            onStrideChange={handleStrideChange}
            disabled={processing || !isFFTComplete}
          />
          
          <PixelArtDisplay 
            pixelArtDataURL={pixelArtDataURL}
            transparentPixelArtDataURL={transparentPixelArtDataURL}
            generatedPixelArt={generatedPixelArt}
            colorHistogram={colorHistogram}
            histogramCanvasRef={histogramCanvasRef}
            pixelArtCanvasRef={pixelArtCanvasRef}
            transparentPixelArtCanvasRef={transparentPixelArtCanvasRef}
            onSave={() => {
              // Refresh sidebar when pixel art is saved
              setSidebarRefreshTrigger(prev => prev + 1);
            }}
          />
        </>
      )}
      
      {fftResults.length > 0 && (
        <AnalysisSummary 
          fftResults={fftResults}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
          dominantFrequency={dominantFrequency}
        />
      )}
      
      <ImageModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        imageSrc={modalImageSrc}
        alt="Full resolution image with analysis overlays"
      />
      </div>
    </>
  );
};

export default ImageFFTAnalyzer;
