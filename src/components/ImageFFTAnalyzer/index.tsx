import React, { useState } from 'react';
import ImageUploader from './ImageUploader';
import AnalysisControls from './AnalysisControls';
import OriginalImageDisplay from './OriginalImageDisplay';
import FFTResultsDisplay from './FFTResultsDisplay';
import PixelArtDisplay from './PixelArtDisplay';
import AnalysisSummary from './AnalysisSummary';
import { useImageAnalysis } from './hooks/useImageAnalysis';
import { usePixelArtGeneration } from './hooks/usePixelArtGeneration';
import GeminiInterface from '../GeminiInterface';

type Mode = 'analyze' | 'generate';

const ImageFFTAnalyzer: React.FC = () => {
  const [mode, setMode] = useState<Mode>('analyze');
  const [prompt, setPrompt] = useState<string>('');

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
    visualizeResults
  } = useImageAnalysis();

  const {
    generatedPixelArt,
    pixelArtDataURL,
    transparentPixelArtDataURL,
    colorHistogram,
    pixelArtCanvasRef,
    transparentPixelArtCanvasRef,
    histogramCanvasRef
  } = usePixelArtGeneration(imageData, imageWidth, imageHeight, dominantFrequency, pixelSamples);

  // Handle image generated from GeminiInterface
  const handleGeminiImageGenerated = (imageData: string) => {
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
        
        // Update the state with the image
        console.log("ImageFFTAnalyzer: Calling handleImageUpload with Gemini image");
        handleImageUpload(null, img);
        
        // Directly perform FFT on the image data
        console.log("ImageFFTAnalyzer: About to call performFFT() with the image data", {
          imgDataWidth: imgData.width,
          imgDataHeight: imgData.height,
          directCall: true
        });
        performFFT(imgData);
        
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
    <div className="w-full max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Pixel Art FFT Analyzer</h2>
      
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
            className={`px-4 py-2 rounded-r ${mode === 'generate' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            Generate with Gemini
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
        ) : (
          <GeminiInterface 
            onImageGenerated={handleGeminiImageGenerated}
            initialPrompt={prompt}
          />
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <OriginalImageDisplay 
          canvasRef={canvasRef}
          selectedLines={selectedLines}
          dominantFrequency={dominantFrequency}
          imageHeight={imageHeight}
        />
        
        <FFTResultsDisplay 
          resultCanvasRef={resultCanvasRef}
          combinedFFT={combinedFFT}
        />
      </div>
      
      {pixelArtDataURL && (
        <PixelArtDisplay 
          pixelArtDataURL={pixelArtDataURL}
          transparentPixelArtDataURL={transparentPixelArtDataURL}
          generatedPixelArt={generatedPixelArt}
          colorHistogram={colorHistogram}
          histogramCanvasRef={histogramCanvasRef}
          pixelArtCanvasRef={pixelArtCanvasRef}
          transparentPixelArtCanvasRef={transparentPixelArtCanvasRef}
        />
      )}
      
      {fftResults.length > 0 && (
        <AnalysisSummary 
          fftResults={fftResults}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
          dominantFrequency={dominantFrequency}
        />
      )}
    </div>
  );
};

export default ImageFFTAnalyzer;
