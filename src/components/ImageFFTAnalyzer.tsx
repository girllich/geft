import React, { useState, useEffect, useRef } from 'react';
import * as math from 'mathjs';
import GeminiInterface from './GeminiInterface';

interface FFTResult {
  x: number;
  fft: math.Complex[];
  magnitudes: number[];
}

interface PixelSample {
  x: number;
  y: number;
  color: [number, number, number, number]; // RGBA
}

interface ColorCount {
  color: string; // Hex color
  count: number;
  rgba: [number, number, number, number]; // RGBA values
}

type Mode = 'analyze' | 'generate';

const ImageFFTAnalyzer: React.FC = () => {
  const [mode, setMode] = useState<Mode>('analyze');
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
  const [generatedPixelArt, setGeneratedPixelArt] = useState<ImageData | null>(null);
  const [pixelArtDataURL, setPixelArtDataURL] = useState<string | null>(null);
  const [transparentPixelArtDataURL, setTransparentPixelArtDataURL] = useState<string | null>(null);
  const [colorHistogram, setColorHistogram] = useState<ColorCount[]>([]);
  const [prompt, setPrompt] = useState<string>('');
  const [generatingWithGemini, setGeneratingWithGemini] = useState<boolean>(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resultCanvasRef = useRef<HTMLCanvasElement>(null);
  const pixelArtCanvasRef = useRef<HTMLCanvasElement>(null);
  const transparentPixelArtCanvasRef = useRef<HTMLCanvasElement>(null);
  const histogramCanvasRef = useRef<HTMLCanvasElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
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
        setPixelArtDataURL(null);
        setTransparentPixelArtDataURL(null);
        setColorHistogram([]);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const performFFT = (imgDataToProcess = imageData) => {
    console.log("ImageFFTAnalyzer: performFFT called");
    
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
    
    // Use math.js matrix operations to handle potentially varying lengths
    const maxLength = Math.max(...allMagnitudes.map(m => m.length));
    
    // Make sure we have a valid height value
    const imgHeight = imgDataToProcess.height;
    console.log("ImageFFTAnalyzer: Image height for FFT", imgHeight);
    
    // Calculate maxFreq with a safety check
    const maxFreq = Math.max(1, Math.min(maxLength, Math.floor(imgHeight / 2)));
    console.log("ImageFFTAnalyzer: maxLength and maxFreq", { maxLength, maxFreq });
    
    // Build a combined array summing across all FFT results
    const combinedMagnitudes: number[] = Array(maxFreq).fill(0);
    for (let i = 0; i < maxFreq; i++) {
      for (const magnitudes of allMagnitudes) {
        if (i < magnitudes.length) {
          combinedMagnitudes[i] += magnitudes[i];
        }
      }
    }
    
    // Find the dominant frequency (skip the first few frequencies which are often DC/low components)
    // Start from index 5 to avoid very low frequencies
    const startIndex = 5;
    let maxMagnitude = 0;
    let peakFrequency = 0;
    
    for (let i = startIndex; i < combinedMagnitudes.length; i++) {
      if (combinedMagnitudes[i] > maxMagnitude) {
        maxMagnitude = combinedMagnitudes[i];
        peakFrequency = i;
      }
    }
    
    setDominantFrequency(peakFrequency);
    
    setFftResults(results);
    setCombinedFFT(combinedMagnitudes);
    setProcessing(false);
    
    // Draw the lines on the canvas
    visualizeResults();
    
    // Generate pixel art from the detected grid
    if (peakFrequency > 0) {
      generatePixelArt(peakFrequency, imgDataToProcess);
    }
  };
  
  const generatePixelArt = (frequency: number, imgDataToProcess = imageData) => {
    console.log("ImageFFTAnalyzer: generatePixelArt called", { frequency, hasImageData: !!imgDataToProcess, hasOriginalImage: !!originalImage });
    
    if (!imgDataToProcess || !originalImage || frequency <= 0) return;
    
    const imgWidth = imgDataToProcess.width;
    const imgHeight = imgDataToProcess.height;
    console.log("ImageFFTAnalyzer: Image dimensions for pixel art", { imgWidth, imgHeight });
    
    const pixelSpacing = imgHeight / frequency;
    const estimatedWidth = Math.round(imgWidth / pixelSpacing);
    const estimatedHeight = Math.round(imgHeight / pixelSpacing);
    
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
    setPixelSamples(samples);
    
    // Create a canvas to generate the pixel art
    const canvas = document.createElement('canvas');
    canvas.width = estimatedWidth;
    canvas.height = estimatedHeight;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw each sampled pixel as a 1x1 pixel in the new canvas
    for (let gridY = 0; gridY < estimatedHeight; gridY++) {
      for (let gridX = 0; gridX < estimatedWidth; gridX++) {
        const sampleIndex = gridY * estimatedWidth + gridX;
        
        if (sampleIndex < samples.length) {
          const sample = samples[sampleIndex];
          const [r, g, b, a] = sample.color;
          
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
          ctx.fillRect(gridX, gridY, 1, 1);
        }
      }
    }
    
    // Get the generated pixel art image data
    const generatedData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setGeneratedPixelArt(generatedData);
    
    // Convert canvas to data URL for display and download
    const dataURL = canvas.toDataURL('image/png');
    setPixelArtDataURL(dataURL);
    
    // Draw the generated pixel art on the canvas
    const pixelArtCanvas = pixelArtCanvasRef.current;
    console.log("ImageFFTAnalyzer: pixelArtCanvas reference", { 
      exists: !!pixelArtCanvas, 
      width: pixelArtCanvas?.width, 
      height: pixelArtCanvas?.height 
    });
    
    if (pixelArtCanvas) {
      pixelArtCanvas.width = estimatedWidth * 4; // Scale up for better visibility
      pixelArtCanvas.height = estimatedHeight * 4;
      
      const pixelArtCtx = pixelArtCanvas.getContext('2d');
      if (pixelArtCtx) {
        console.log("ImageFFTAnalyzer: Drawing to pixelArtCanvas", { 
          canvasWidth: canvas.width, 
          canvasHeight: canvas.height,
          targetWidth: pixelArtCanvas.width,
          targetHeight: pixelArtCanvas.height
        });
        
        // Use nearest-neighbor scaling for crisp pixels
        pixelArtCtx.imageSmoothingEnabled = false;
        
        // Draw the generated pixel art scaled up
        pixelArtCtx.drawImage(
          canvas, 
          0, 0, canvas.width, canvas.height,
          0, 0, pixelArtCanvas.width, pixelArtCanvas.height
        );
        
        console.log("ImageFFTAnalyzer: Finished drawing to pixelArtCanvas");
      } else {
        console.error("ImageFFTAnalyzer: Failed to get pixelArtCanvas context");
      }
    } else {
      console.error("ImageFFTAnalyzer: pixelArtCanvas ref is null");
    }
    
    // Generate color histogram and create transparent version
    generateColorHistogram(generatedData, estimatedWidth, estimatedHeight, canvas);
  };
  
  // Generate color histogram from the pixel art data
  const generateColorHistogram = (pixelArtData: ImageData, width: number, height: number, pixelArtCanvas: HTMLCanvasElement) => {
    const data = pixelArtData.data;
    const colorCounts: Record<string, ColorCount> = {};
    
    // Count occurrences of each color
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      
      // Skip fully transparent pixels
      if (a === 0) continue;
      
      // Create a hex color key for the map
      const colorKey = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      
      if (colorCounts[colorKey]) {
        colorCounts[colorKey].count++;
      } else {
        colorCounts[colorKey] = {
          color: colorKey,
          count: 1,
          rgba: [r, g, b, a]
        };
      }
    }
    
    // Convert to array and sort by count (descending)
    const sortedColors = Object.values(colorCounts).sort((a, b) => b.count - a.count);
    setColorHistogram(sortedColors);
    
    // Draw the histogram
    drawColorHistogram(sortedColors);
    
    // Create transparent version
    if (sortedColors.length > 0) {
      createTransparentVersion(sortedColors[0].rgba, pixelArtData, width, height, pixelArtCanvas);
    }
  };
  
  // Draw the color histogram on canvas
  const drawColorHistogram = (colors: ColorCount[]) => {
    const canvas = histogramCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas dimensions
    canvas.width = 800;
    canvas.height = 300;
    
    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw title
    ctx.fillStyle = 'black';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Color Histogram', canvas.width / 2, 20);
    
    // Only show top 20 colors for clarity
    const topColors = colors.slice(0, Math.min(20, colors.length));
    
    if (topColors.length === 0) return;
    
    // Find the maximum count for scaling
    const maxCount = Math.max(...topColors.map(c => c.count));
    
    // Calculate bar width based on number of colors
    const barWidth = Math.min(30, (canvas.width - 40) / topColors.length);
    const padding = 40;
    const graphHeight = canvas.height - 60;
    
    // Draw bars
    for (let i = 0; i < topColors.length; i++) {
      const color = topColors[i];
      const x = padding + i * (barWidth + 5);
      const barHeight = (color.count / maxCount) * graphHeight;
      const y = canvas.height - 30 - barHeight;
      
      // Draw the bar with the actual color
      ctx.fillStyle = color.color;
      ctx.fillRect(x, y, barWidth, barHeight);
      
      // Draw border around the bar
      ctx.strokeStyle = 'black';
      ctx.strokeRect(x, y, barWidth, barHeight);
      
      // Draw count on top of the bar
      ctx.fillStyle = 'black';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(color.count.toString(), x + barWidth / 2, y - 5);
      
      // Draw color hex value below the bar
      ctx.font = '8px Arial';
      ctx.fillText(color.color, x + barWidth / 2, canvas.height - 15);
      
      // Indicate if this is the most common color
      if (i === 0) {
        ctx.fillStyle = 'red';
        ctx.font = 'bold 10px Arial';
        ctx.fillText('Most Common', x + barWidth / 2, canvas.height - 5);
      }
    }
  };
  
  // Create a version of the pixel art with the most common color made transparent where it touches the edges
  const createTransparentVersion = (
    targetColor: [number, number, number, number], 
    pixelArtData: ImageData, 
    width: number, 
    height: number,
    originalCanvas: HTMLCanvasElement
  ) => {
    // Create a new canvas for the transparent version
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    // Create a new ImageData object
    const newImgData = new ImageData(
      new Uint8ClampedArray(pixelArtData.data),
      width,
      height
    );
    const data = newImgData.data;
    
    // Create a visited array for flood fill
    const visited = new Array(width * height).fill(false);
    
    // Queue for flood fill
    const queue: [number, number][] = [];
    
    // Helper function to check if a pixel matches the target color
    const isTargetColor = (x: number, y: number): boolean => {
      const index = (y * width + x) * 4;
      const [tr, tg, tb] = targetColor;
      
      // Allow some tolerance for color matching
      const tolerance = 5;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      
      return (
        Math.abs(r - tr) <= tolerance &&
        Math.abs(g - tg) <= tolerance &&
        Math.abs(b - tb) <= tolerance
      );
    };
    
    // Add edge pixels that match the target color to the queue
    // Top and bottom edges
    for (let x = 0; x < width; x++) {
      if (isTargetColor(x, 0)) {
        queue.push([x, 0]);
        visited[0 * width + x] = true;
      }
      if (isTargetColor(x, height - 1)) {
        queue.push([x, height - 1]);
        visited[(height - 1) * width + x] = true;
      }
    }
    
    // Left and right edges
    for (let y = 0; y < height; y++) {
      if (isTargetColor(0, y)) {
        queue.push([0, y]);
        visited[y * width + 0] = true;
      }
      if (isTargetColor(width - 1, y)) {
        queue.push([width - 1, y]);
        visited[y * width + (width - 1)] = true;
      }
    }
    
    // Perform flood fill
    while (queue.length > 0) {
      const [x, y] = queue.shift()!;
      const index = (y * width + x) * 4;
      
      // Make this pixel transparent
      data[index + 3] = 0;
      
      // Check the 4 adjacent pixels
      const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      
      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        
        // Check if the new position is within bounds
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const newIndex = ny * width + nx;
          
          // If not visited and matches the target color, add to queue
          if (!visited[newIndex] && isTargetColor(nx, ny)) {
            queue.push([nx, ny]);
            visited[newIndex] = true;
          }
        }
      }
    }
    
    // Put the modified image data back
    ctx.putImageData(newImgData, 0, 0);
    
    // Convert to data URL
    const dataURL = canvas.toDataURL('image/png');
    setTransparentPixelArtDataURL(dataURL);
    
    // Draw on the transparent canvas
    const transparentCanvas = transparentPixelArtCanvasRef.current;
    console.log("ImageFFTAnalyzer: transparentCanvas reference", { 
      exists: !!transparentCanvas, 
      width: transparentCanvas?.width, 
      height: transparentCanvas?.height 
    });
    
    if (transparentCanvas) {
      transparentCanvas.width = width * 4; // Scale up for better visibility
      transparentCanvas.height = height * 4;
      
      const tctx = transparentCanvas.getContext('2d');
      if (tctx) {
        console.log("ImageFFTAnalyzer: Drawing to transparentCanvas", { 
          canvasWidth: canvas.width, 
          canvasHeight: canvas.height,
          targetWidth: transparentCanvas.width,
          targetHeight: transparentCanvas.height
        });
        
        // Use nearest-neighbor scaling for crisp pixels
        tctx.imageSmoothingEnabled = false;
        
        // Draw the transparent version scaled up
        tctx.drawImage(
          canvas, 
          0, 0, canvas.width, canvas.height,
          0, 0, transparentCanvas.width, transparentCanvas.height
        );
        
        console.log("ImageFFTAnalyzer: Finished drawing to transparentCanvas");
      } else {
        console.error("ImageFFTAnalyzer: Failed to get transparentCanvas context");
      }
    } else {
      console.error("ImageFFTAnalyzer: transparentCanvas ref is null");
    }
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
    if (combinedFFT.length > 0) {
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

  // Handle image generated from GeminiInterface
  const handleGeminiImageGenerated = (imageData: string) => {
    console.log("ImageFFTAnalyzer: handleGeminiImageGenerated called with image data");
    
    // Load the generated image
    const img = new Image();
    img.onload = () => {
      console.log("ImageFFTAnalyzer: Image loaded successfully", { width: img.width, height: img.height });
      
      setOriginalImage(img);
      setImageWidth(img.width);
      setImageHeight(img.height);
      
      // Draw image on canvas to get pixel data
      const canvas = canvasRef.current;
      if (!canvas) {
        console.error("ImageFFTAnalyzer: Canvas ref is null");
        return;
      }
      
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error("ImageFFTAnalyzer: Failed to get canvas context");
        return;
      }
      
      ctx.drawImage(img, 0, 0);
      
      const imgData = ctx.getImageData(0, 0, img.width, img.height);
      console.log("ImageFFTAnalyzer: Image data extracted from canvas", { 
        width: imgData.width, 
        height: imgData.height 
      });
      
      // Set the image data state
      setImageData(imgData);
      
      // Reset results when new image is loaded
      setFftResults([]);
      setSelectedLines([]);
      setCombinedFFT([]);
      setPixelArtDataURL(null);
      setTransparentPixelArtDataURL(null);
      setColorHistogram([]);
      
      // Automatically perform FFT analysis on the generated image
      console.log("ImageFFTAnalyzer: About to call performFFT() with the image data");
      performFFT(imgData);
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
            <label className="block mb-2 font-medium">
              Upload an image:
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageUpload} 
                className="mt-1 block w-full p-2 border border-gray-300 rounded"
              />
            </label>
            
            <div className="flex flex-wrap gap-2 mt-4">
              <button 
                onClick={() => performFFT()} 
                disabled={!imageData || processing}
                className={`px-4 py-2 rounded ${!imageData || processing ? 'bg-gray-300' : 'bg-blue-500 text-white'}`}
              >
                {processing ? 'Processing...' : 'Analyze with FFT'}
              </button>
              
              {combinedFFT.length > 0 && (
                <div className="text-sm flex items-center">
                  <span className="mr-2">Found peak at frequency:</span>
                  <span className="font-bold text-green-700">{dominantFrequency}</span>
                  <span className="mx-2">→</span>
                  <span className="font-bold text-green-700">{dominantFrequency ? (imageHeight / dominantFrequency).toFixed(1) : 0} pixels</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <GeminiInterface 
            onImageGenerated={handleGeminiImageGenerated}
            initialPrompt={prompt}
          />
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 className="text-lg font-medium mb-2">Original Image with Selected Lines</h3>
          <div className="border border-gray-300 overflow-auto">
            <canvas ref={canvasRef} className="max-w-full" />
          </div>
          {selectedLines.length > 0 && (
            <div className="mt-2 text-sm">
              Selected {selectedLines.length} vertical lines at x positions: 
              <span className="text-xs font-mono">{selectedLines.slice(0, 10).join(', ')}{selectedLines.length > 10 ? '...' : ''}</span>
              
              {dominantFrequency && (
                <p className="mt-1 font-medium text-green-700">
                  Detected pattern frequency: {dominantFrequency} 
                  (spacing: {(imageHeight / dominantFrequency!).toFixed(1)} pixels)
                </p>
              )}
            </div>
          )}
        </div>
        
        <div>
          <h3 className="text-lg font-medium mb-2">Combined FFT Results</h3>
          <div className="border border-gray-300">
            <canvas ref={resultCanvasRef} className="max-w-full" />
          </div>
          {combinedFFT.length > 0 && (
            <div className="mt-2 text-sm">
              <p>The graph shows the summed magnitude of frequency components across all sampled lines.</p>
              <p>Each vertical line represents a frequency, with taller lines indicating stronger presence in the image.</p>
              <p>Peaks can indicate regular patterns like pixel grids in upscaled pixel art.</p>
            </div>
          )}
        </div>
      </div>
      
      {pixelArtDataURL && (
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-2">Generated Pixel Art</h3>
          
          {colorHistogram.length > 0 && (
            <div className="mb-4">
              <h4 className="text-md font-medium mb-2">Color Histogram</h4>
              <div className="border border-gray-300 overflow-auto">
                <canvas ref={histogramCanvasRef} className="max-w-full" />
              </div>
              <div className="mt-2 text-sm">
                <p>• Showing top {Math.min(20, colorHistogram.length)} most frequent colors in the pixel art</p>
                {colorHistogram[0] && (
                  <p>• Most common color: {colorHistogram[0].color} (used {colorHistogram[0].count} times)</p>
                )}
                <p>• This color has been made transparent where it touches the edges</p>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-md font-medium mb-2">Original Pixel Art</h4>
              <div className="border border-gray-300 overflow-auto bg-gray-100 p-2">
                <div className="flex flex-col items-center">
                  <img 
                    src={pixelArtDataURL} 
                    alt="Generated Pixel Art" 
                    className="pixelated"
                    style={{ 
                      imageRendering: 'pixelated',
                      width: `${generatedPixelArt?.width ? generatedPixelArt.width * 4 : 0}px`,
                      height: `${generatedPixelArt?.height ? generatedPixelArt.height * 4 : 0}px`
                    }}
                  />
                </div>
              </div>
              <div className="mt-2 text-sm">
                <p>• Generated from sampling one pixel per detected grid cell</p>
                <p>• Blue dots on the original image show sampling locations</p>
                <p>• Resolution: {generatedPixelArt?.width} x {generatedPixelArt?.height} pixels</p>
                <p>• <a href={pixelArtDataURL} download="pixel_art.png" className="text-blue-500 hover:underline">Download PNG</a></p>
              </div>
            </div>
            
            {transparentPixelArtDataURL && (
              <div>
                <h4 className="text-md font-medium mb-2">With Transparency</h4>
                <div className="border border-gray-300 overflow-auto p-2" style={{ 
                  backgroundImage: `
                    linear-gradient(45deg, #ccc 25%, transparent 25%), 
                    linear-gradient(-45deg, #ccc 25%, transparent 25%),
                    linear-gradient(45deg, transparent 75%, #ccc 75%),
                    linear-gradient(-45deg, transparent 75%, #ccc 75%)
                  `,
                  backgroundSize: '20px 20px',
                  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                  backgroundColor: 'white'
                }}>
                  <div className="flex flex-col items-center">
                    <img 
                      src={transparentPixelArtDataURL} 
                      alt="Transparent Pixel Art" 
                      className="pixelated"
                      style={{ 
                        imageRendering: 'pixelated',
                        width: `${generatedPixelArt?.width ? generatedPixelArt.width * 4 : 0}px`,
                        height: `${generatedPixelArt?.height ? generatedPixelArt.height * 4 : 0}px`
                      }}
                    />
                  </div>
                </div>
                <div className="mt-2 text-sm">
                  <p>• Most common color has been made transparent where it touches the edges</p>
                  <p>• This helps isolate the main subject from the background</p>
                  <p>• <a href={transparentPixelArtDataURL} download="transparent_pixel_art.png" className="text-blue-500 hover:underline">Download PNG</a></p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {fftResults.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-2">Analysis Summary</h3>
          <div className="text-sm">
            <p>• Applied derivative transform and FFT to {fftResults.length} vertical lines</p>
            <p>• Image dimensions: {imageWidth} x {imageHeight} pixels</p>
            
            {dominantFrequency ? (
              <>
                <p className="font-bold mt-2 text-green-700">Dominant Pattern Found:</p>
                <p>• Frequency: {dominantFrequency}</p>
                <p>• Pixel spacing: {(imageHeight / dominantFrequency).toFixed(1)} pixels</p>
                <p>• Green horizontal lines on the image show the detected pattern</p>
                <p>• Detection based on Gaussian smoothing (σ=2, kernel size=7) of FFT data</p>
                <p className="mt-2">If this image is rescaled pixel art, the original resolution was likely around 
                  {Math.round(imageWidth / (imageHeight / dominantFrequency))} x {dominantFrequency} pixels.</p>
                <p>• The generated pixel art above shows an approximation of the original pixel art</p>
              </>
            ) : (
              <>
                <p>• For pixel art, peaks in the frequency spectrum may indicate the original pixel grid size</p>
                <p>• Stronger peaks at specific frequencies suggest regular patterns in the image</p>
                <p>• Look for prominent peaks in the frequency diagram to identify potential original resolution</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageFFTAnalyzer;
