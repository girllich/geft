import { useState, useEffect, useRef } from 'react';
import * as math from 'mathjs';

export interface FFTResult {
  x: number;
  fft: math.Complex[];
  magnitudes: number[];
}

export interface PixelSample {
  x: number;
  y: number;
  color: [number, number, number, number]; // RGBA
}

export const useImageAnalysis = () => {
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [fftResults, setFftResults] = useState<FFTResult[]>([]);
  const [combinedFFT, setCombinedFFT] = useState<number[]>([]);
  const [smoothedFFT, setSmoothedFFT] = useState<number[]>([]);
  const [selectedLines, setSelectedLines] = useState<number[]>([]);
  const [processing, setProcessing] = useState<boolean>(false);
  const [imageWidth, setImageWidth] = useState<number>(0);
  const [imageHeight, setImageHeight] = useState<number>(0);
  const [dominantFrequency, setDominantFrequency] = useState<number | null>(null);
  const [pixelSamples, setPixelSamples] = useState<PixelSample[]>([]);
  const [pendingCallback, setPendingCallback] = useState<(() => void) | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resultCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Run the callback when imageData changes
  useEffect(() => {
    console.log("ImageFFTAnalyzer: useEffect for pendingCallback triggered", {
      hasImageData: !!imageData,
      hasPendingCallback: !!pendingCallback,
      timestamp: new Date().toISOString()
    });
    
    if (imageData && pendingCallback) {
      console.log("ImageFFTAnalyzer: Executing pendingCallback");
      pendingCallback();
      setPendingCallback(null);
    }
  }, [imageData, pendingCallback]);

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement> | null, 
    loadedImage?: HTMLImageElement,
    callback?: () => void
  ) => {
    if (loadedImage) {
      // Handle case where image is provided directly (e.g., from Gemini)
      setOriginalImage(loadedImage);
      setImageWidth(loadedImage.width);
      setImageHeight(loadedImage.height);
      
      // Draw image on canvas to get pixel data
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      canvas.width = loadedImage.width;
      canvas.height = loadedImage.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.drawImage(loadedImage, 0, 0);
      
      const imgData = ctx.getImageData(0, 0, loadedImage.width, loadedImage.height);
      
      // Reset results when new image is loaded
      console.log("ImageFFTAnalyzer: Resetting state for new Gemini image");
      setFftResults([]);
      setSelectedLines([]);
      setCombinedFFT([]);
      setSmoothedFFT([]);
      setPixelSamples([]);
      setDominantFrequency(null);
      
      // Set image data
      console.log("ImageFFTAnalyzer: Setting imageData for Gemini image", {
        width: imgData.width,
        height: imgData.height
      });
      setImageData(imgData);
      
      // Store the callback to be executed after imageData is set
      if (callback) {
        setPendingCallback(() => callback);
      }
      
      return;
    }

    // Handle case where image is uploaded via file input
    const file = e?.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event: ProgressEvent<FileReader>) => {
      const img = new Image();
      img.onload = () => {
        setOriginalImage(img);
        setImageWidth(img.width);
        setImageHeight(img.height);
        
        // Draw image on canvas to get pixel data
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.drawImage(img, 0, 0);
        
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        setImageData(imgData);
        
        // Reset results when new image is loaded
        setFftResults([]);
        setSelectedLines([]);
        setCombinedFFT([]);
        setSmoothedFFT([]);
        setPixelSamples([]);
        setDominantFrequency(null);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const performFFT = (imgDataParam?: ImageData) => {
    console.log("ImageFFTAnalyzer: performFFT called");
    
    // Use the provided image data or fall back to the state
    const imgDataToProcess = imgDataParam || imageData;
    
    if (!imgDataToProcess) {
      console.error("ImageFFTAnalyzer: Cannot perform FFT, image data is null");
      return;
    }
    
    console.log("ImageFFTAnalyzer: Starting FFT processing", {
      imageWidth,
      imageHeight,
      imageDataWidth: imgDataToProcess.width,
      imageDataHeight: imgDataToProcess.height
    });
    
    setProcessing(true);
    
    // Generate 30 random vertical line positions
    const lines: number[] = [];
    const usedPositions = new Set<number>();
    const imgWidth = imgDataToProcess.width;
    
    while (lines.length < 30 && lines.length < imgWidth) {
      const x = Math.floor(Math.random() * imgWidth);
      if (!usedPositions.has(x)) {
        usedPositions.add(x);
        lines.push(x);
      }
    }
    
    setSelectedLines(lines);
    
    // Extract the pixel data for each line, calculate derivatives, and perform FFT
    const results: FFTResult[] = [];
    
    for (const x of lines) {
      // Extract the vertical line (all y values for this x)
      const lineData: number[] = [];
      
      for (let y = 0; y < imgDataToProcess.height; y++) {
        const index = (y * imgDataToProcess.width + x) * 4;
        // Use grayscale value (average of RGB)
        const gray = (imgDataToProcess.data[index] + imgDataToProcess.data[index + 1] + imgDataToProcess.data[index + 2]) / 3;
        lineData.push(gray);
      }
      
      // Calculate the derivative manually (since mathjs doesn't have a diff function)
      const derivatives: number[] = [];
      for (let i = 1; i < lineData.length; i++) {
        derivatives.push(Math.abs(lineData[i] - lineData[i - 1]));
      }
      
      // Perform FFT on the derivatives
      // Use type assertion to handle the conversion
      const fft = math.fft(derivatives as unknown as math.Complex[]);
      
      // Calculate magnitudes more efficiently
      const magnitudes: number[] = [];
      for (let i = 0; i < fft.length; i++) {
        // Get the magnitude of the complex number (sqrt of real^2 + imag^2)
        const complex = fft[i];
        const magnitude = Math.sqrt(
          Math.pow(complex.re, 2) + Math.pow(complex.im, 2)
        );
        magnitudes.push(magnitude);
      }
      
      results.push({
        x,
        fft,
        magnitudes
      });
    }
    
    // Sum the FFT magnitudes across all lines using mathjs
    const allMagnitudes = results.map(result => result.magnitudes);
    
    // Check if we have any results
    if (allMagnitudes.length === 0) {
      console.error("ImageFFTAnalyzer: No FFT results to process");
      setProcessing(false);
      return;
    }
    
    // Use math.js matrix operations to handle potentially varying lengths
    const magnitudeLengths = allMagnitudes.map(m => m.length);
    if (magnitudeLengths.length === 0 || Math.max(...magnitudeLengths) === 0) {
      console.error("ImageFFTAnalyzer: Invalid magnitude lengths", magnitudeLengths);
      setProcessing(false);
      return;
    }
    
    const maxLength = Math.max(...magnitudeLengths);
    
    // Make sure we have a valid height value
    const imgHeight = imgDataToProcess.height;
    console.log("ImageFFTAnalyzer: Image height for FFT", imgHeight);
    
    // Calculate maxFreq with a safety check
    const maxFreq = Math.max(1, Math.min(maxLength, Math.floor(imgHeight / 2)));
    
    // Ensure maxFreq is a valid array length (positive integer within safe limits)
    const safeMaxFreq = Math.min(maxFreq, 10000); // Limit to a reasonable size
    console.log("ImageFFTAnalyzer: maxLength and maxFreq", { maxLength, maxFreq, safeMaxFreq });
    
    // Build a combined array summing across all FFT results
    const combinedMagnitudes: number[] = Array(safeMaxFreq).fill(0);
    for (let i = 0; i < safeMaxFreq; i++) {
      for (const magnitudes of allMagnitudes) {
        if (i < magnitudes.length) {
          combinedMagnitudes[i] += magnitudes[i];
        }
      }
    }
    
    // Apply Gaussian smoothing to the combined FFT
    const smoothedMagnitudes = applyGaussianSmoothing(combinedMagnitudes, 2, 7);
    
    // Find the dominant frequency (skip the first few frequencies which are often DC/low components)
    // Start from index 5 to avoid very low frequencies
    const startIndex = 5;
    let maxMagnitude = 0;
    let peakFrequency = 0;
    
    for (let i = startIndex; i < smoothedMagnitudes.length; i++) {
      if (smoothedMagnitudes[i] > maxMagnitude) {
        maxMagnitude = smoothedMagnitudes[i];
        peakFrequency = i;
      }
    }
    
    console.log("ImageFFTAnalyzer: Setting dominant frequency to", peakFrequency);
    setDominantFrequency(peakFrequency);
    setFftResults(results);
    setCombinedFFT(combinedMagnitudes);
    setSmoothedFFT(smoothedMagnitudes);
    setProcessing(false);
    
    // Draw the lines on the canvas
    visualizeResults();
    
    // Generate pixel samples based on the detected grid
    if (peakFrequency > 0) {
      console.log("ImageFFTAnalyzer: Peak frequency > 0, calling generatePixelSamples with", peakFrequency);
      generatePixelSamples(peakFrequency, imgDataToProcess);
    } else {
      console.log("ImageFFTAnalyzer: Peak frequency <= 0, NOT calling generatePixelSamples", { peakFrequency });
    }
  };
  
  // Apply Gaussian smoothing to the FFT data
  const applyGaussianSmoothing = (data: number[], sigma: number, kernelSize: number): number[] => {
    // Ensure kernel size is odd
    const size = kernelSize % 2 === 0 ? kernelSize + 1 : kernelSize;
    const radius = Math.floor(size / 2);
    
    // Create Gaussian kernel
    const kernel: number[] = [];
    let sum = 0;
    
    for (let i = -radius; i <= radius; i++) {
      const value = Math.exp(-(i * i) / (2 * sigma * sigma));
      kernel.push(value);
      sum += value;
    }
    
    // Normalize kernel
    for (let i = 0; i < kernel.length; i++) {
      kernel[i] /= sum;
    }
    
    // Apply convolution
    const result: number[] = [];
    
    for (let i = 0; i < data.length; i++) {
      let value = 0;
      
      for (let j = -radius; j <= radius; j++) {
        const index = i + j;
        
        if (index >= 0 && index < data.length) {
          value += data[index] * kernel[j + radius];
        }
      }
      
      result.push(value);
    }
    
    return result;
  };
  
  // Generate pixel samples based on the detected grid
  const generatePixelSamples = (frequency: number, imgDataParam?: ImageData) => {
    console.log("ImageFFTAnalyzer: generatePixelSamples called with frequency", frequency);
    
    // Use the provided image data or fall back to the state
    const imgDataToProcess = imgDataParam || imageData;
    
    if (!imgDataToProcess || frequency <= 0) {
      console.log("ImageFFTAnalyzer: generatePixelSamples early return", {
        hasImageData: !!imgDataToProcess,
        frequency
      });
      return;
    }
    
    const imgWidth = imgDataToProcess.width;
    const imgHeight = imgDataToProcess.height;
    
    const pixelSpacing = imgHeight / frequency;
    const estimatedWidth = Math.round(imgWidth / pixelSpacing);
    const estimatedHeight = Math.round(imgHeight / pixelSpacing);
    
    console.log("ImageFFTAnalyzer: generatePixelSamples calculations", {
      imgWidth,
      imgHeight,
      pixelSpacing,
      estimatedWidth,
      estimatedHeight
    });
    
    // Create samples array to store the sampled pixels
    const samples: PixelSample[] = [];
    
    // Sample one pixel per detected grid cell
    for (let gridY = 0; gridY < estimatedHeight; gridY++) {
      for (let gridX = 0; gridX < estimatedWidth; gridX++) {
        // Calculate the center of each grid cell in the original image
        const centerX = Math.floor((gridX + 0.5) * pixelSpacing);
        const centerY = Math.floor((gridY + 0.5) * pixelSpacing);
        
        // Ensure we're within bounds
        if (centerX < imgWidth && centerY < imgHeight) {
          // Get the pixel color at this position
          const index = (centerY * imgWidth + centerX) * 4;
          const color: [number, number, number, number] = [
            imgDataToProcess.data[index],
            imgDataToProcess.data[index + 1],
            imgDataToProcess.data[index + 2],
            imgDataToProcess.data[index + 3]
          ];
          
          // Store the sample
          samples.push({
            x: centerX,
            y: centerY,
            color
          });
        }
      }
    }
    
    // Store the samples for visualization
    console.log("ImageFFTAnalyzer: Setting pixelSamples with", samples.length, "samples", {
      timestamp: new Date().toISOString(),
      source: "generatePixelSamples"
    });
    setPixelSamples(samples);
  };

  const visualizeResults = () => {
    if (!originalImage || selectedLines.length === 0) return;
    
    // Draw original image with highlighted lines
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(originalImage, 0, 0);
    
    // Highlight the selected vertical lines
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    
    for (const x of selectedLines) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, imageHeight);
      ctx.stroke();
    }
    
    // Draw dots at each sampling location if we have samples
    if (pixelSamples.length > 0) {
      ctx.fillStyle = 'rgba(0, 0, 255, 0.7)';
      
      for (const sample of pixelSamples) {
        ctx.beginPath();
        ctx.arc(sample.x, sample.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Draw horizontal pattern lines at the dominant frequency if available
    if (dominantFrequency && dominantFrequency > 0) {
      const lineSpacing = imageHeight / dominantFrequency;
      
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)'; // Semi-transparent green
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]); // Dashed line pattern
      
      for (let y = 0; y < imageHeight; y += lineSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(imageWidth, y);
        ctx.stroke();
      }
      
      ctx.setLineDash([]); // Reset line dash
    }
    
    // Draw FFT results as a single line diagram
    if (combinedFFT.length > 0 && smoothedFFT.length > 0) {
      const resultCanvas = resultCanvasRef.current;
      if (!resultCanvas) return;
      
      resultCanvas.width = 800;
      resultCanvas.height = 400;
      
      const rctx = resultCanvas.getContext('2d');
      if (!rctx) return;
      
      rctx.fillStyle = 'white';
      rctx.fillRect(0, 0, resultCanvas.width, resultCanvas.height);
      
      const padding = 30;
      const graphWidth = resultCanvas.width - (2 * padding);
      const graphHeight = resultCanvas.height - (2 * padding);
      
      // Find max magnitude for scaling using mathjs
      const maxMagnitude = math.max([...combinedFFT, ...smoothedFFT]);
      
      // Draw the axes
      rctx.strokeStyle = 'black';
      rctx.lineWidth = 1;
      
      // Draw horizontal axis (frequency)
      rctx.beginPath();
      rctx.moveTo(padding, resultCanvas.height - padding);
      rctx.lineTo(resultCanvas.width - padding, resultCanvas.height - padding);
      rctx.stroke();
      
      // Draw vertical axis (magnitude)
      rctx.beginPath();
      rctx.moveTo(padding, padding);
      rctx.lineTo(padding, resultCanvas.height - padding);
      rctx.stroke();
      
      // Draw axis labels
      rctx.fillStyle = 'black';
      rctx.font = '12px Arial';
      rctx.textAlign = 'center';
      rctx.fillText('Frequency', resultCanvas.width / 2, resultCanvas.height - 5);
      
      rctx.save();
      rctx.translate(10, resultCanvas.height / 2);
      rctx.rotate(-Math.PI / 2);
      rctx.fillText('Magnitude', 0, 0);
      rctx.restore();
      
      // Skip the DC component (first value) for better scaling
      const startFreq = 1;
      const numFrequencies = Math.min(combinedFFT.length - startFreq, 200);
      
      // Draw vertical lines for each frequency in the combined FFT
      for (let i = 0; i < numFrequencies; i++) {
        const freq = i + startFreq;
        const x = padding + (i / numFrequencies) * graphWidth;
        const magnitude = combinedFFT[freq] / maxMagnitude;
        const height = magnitude * graphHeight;
        
        // Draw a thin vertical line for each frequency
        rctx.fillStyle = `rgba(0, 0, 255, ${magnitude * 0.8 + 0.2})`;
        rctx.fillRect(
          x,
          resultCanvas.height - padding - height,
          1,
          height
        );
      }
      
      // Draw the smoothed FFT as a line on top
      if (smoothedFFT && smoothedFFT.length > 0) {
        rctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        rctx.lineWidth = 2;
        rctx.beginPath();
        
        for (let i = 0; i < numFrequencies; i++) {
          const freq = i + startFreq;
          const x = padding + (i / numFrequencies) * graphWidth;
          const magnitude = smoothedFFT[freq] / maxMagnitude;
          const y = resultCanvas.height - padding - (magnitude * graphHeight);
          
          if (i === 0) {
            rctx.moveTo(x, y);
          } else {
            rctx.lineTo(x, y);
          }
        }
        
        rctx.stroke();
        
        // Add a label for the smoothed line
        rctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
        rctx.font = '12px Arial';
        rctx.textAlign = 'left';
        rctx.fillText('Gaussian Smoothed (σ=2, kernel size=7)', padding + 10, padding + 20);
      }
      
      // Draw frequency markers
      const numMarkers = 10;
      rctx.fillStyle = 'black';
      for (let i = 0; i <= numMarkers; i++) {
        const x = padding + (i / numMarkers) * graphWidth;
        const freq = Math.round(startFreq + (i / numMarkers) * numFrequencies);
        
        rctx.beginPath();
        rctx.moveTo(x, resultCanvas.height - padding);
        rctx.lineTo(x, resultCanvas.height - padding + 5);
        rctx.stroke();
        
        rctx.fillText(freq.toString(), x, resultCanvas.height - padding + 15);
      }
      
      // Highlight the dominant frequency
      if (dominantFrequency) {
        const dominantX = padding + ((dominantFrequency - startFreq) / numFrequencies) * graphWidth;
        
        // Draw a vertical line at the dominant frequency
        rctx.strokeStyle = 'green';
        rctx.lineWidth = 2;
        rctx.setLineDash([5, 5]);
        rctx.beginPath();
        rctx.moveTo(dominantX, padding);
        rctx.lineTo(dominantX, resultCanvas.height - padding);
        rctx.stroke();
        rctx.setLineDash([]);
        
        // Add a label for the dominant frequency
        rctx.fillStyle = 'green';
        rctx.font = 'bold 14px Arial';
        rctx.fillText(`Peak: ${dominantFrequency}`, dominantX, padding - 10);
        rctx.font = '12px Arial';
        
        // Calculate what this frequency means in pixels
        const pixelSpacing = imageHeight / dominantFrequency;
        rctx.fillText(`(${pixelSpacing.toFixed(1)} pixels)`, dominantX, padding + 10);
      }
      
      // Draw magnitude markers
      const numMagMarkers = 5;
      for (let i = 0; i <= numMagMarkers; i++) {
        const y = resultCanvas.height - padding - (i / numMagMarkers) * graphHeight;
        const mag = (i / numMagMarkers) * maxMagnitude;
        
        rctx.beginPath();
        rctx.moveTo(padding - 5, y);
        rctx.lineTo(padding, y);
        rctx.stroke();
        
        rctx.textAlign = 'right';
        rctx.fillText(mag.toFixed(0), padding - 8, y + 4);
      }
    }
  };

  useEffect(() => {
    if (fftResults.length > 0) {
      visualizeResults();
    }
  }, [fftResults]);

  return {
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
  };
};
