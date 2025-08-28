import { useState, useRef, useEffect } from 'react';
import { PixelSample } from './useImageAnalysis';

export interface ColorCount {
  color: string; // Hex color
  count: number;
  rgba: [number, number, number, number]; // RGBA values
}

export const usePixelArtGeneration = (
  imageData: ImageData | null,
  imageWidth: number,
  imageHeight: number,
  dominantFrequency: number | null,
  pixelSamples: PixelSample[],
  stride: number
) => {
  const [generatedPixelArt, setGeneratedPixelArt] = useState<ImageData | null>(null);
  const [pixelArtDataURL, setPixelArtDataURL] = useState<string | null>(null);
  const [transparentPixelArtDataURL, setTransparentPixelArtDataURL] = useState<string | null>(null);
  const [colorHistogram, setColorHistogram] = useState<ColorCount[]>([]);
  
  const pixelArtCanvasRef = useRef<HTMLCanvasElement>(null);
  const transparentPixelArtCanvasRef = useRef<HTMLCanvasElement>(null);
  const histogramCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    console.log("usePixelArtGeneration: useEffect triggered with", {
      dominantFrequency,
      pixelSamplesLength: pixelSamples.length,
      hasImageData: !!imageData,
      imageDataDimensions: imageData ? `${imageData.width}x${imageData.height}` : 'none',
      imageWidth,
      imageHeight,
      effectTriggered: new Date().toISOString()
    });
    
    if (dominantFrequency && dominantFrequency > 0 && pixelSamples.length > 0 && imageData) {
      console.log("usePixelArtGeneration: Conditions met, calling generatePixelArt()");
      generatePixelArt();
    } else {
      console.log("usePixelArtGeneration: Conditions NOT met for generatePixelArt:", {
        hasDominantFrequency: !!dominantFrequency,
        dominantFrequencyPositive: dominantFrequency ? dominantFrequency > 0 : false,
        hasPixelSamples: pixelSamples.length > 0,
        hasImageData: !!imageData
      });
    }
  }, [dominantFrequency, pixelSamples, imageData, stride]);

  const generatePixelArt = () => {
    if (!imageData || !dominantFrequency || dominantFrequency <= 0 || pixelSamples.length === 0) {
      return;
    }

    console.log("usePixelArtGeneration: generatePixelArt called", { 
      dominantFrequency, 
      samplesCount: pixelSamples.length 
    });
    
    const pixelSpacing = stride;
    const estimatedWidth = Math.round(imageWidth / pixelSpacing);
    const estimatedHeight = Math.round(imageHeight / pixelSpacing);
    
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
        
        if (sampleIndex < pixelSamples.length) {
          const sample = pixelSamples[sampleIndex];
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
    
    // No need to draw to canvas as we're using data URLs directly
    
    // Generate color histogram and create transparent version
    generateColorHistogram(generatedData, estimatedWidth, estimatedHeight, canvas);
  };
  
  
  // Generate color histogram from the pixel art data
  const generateColorHistogram = (
    pixelArtData: ImageData, 
    width: number, 
    height: number, 
    pixelArtCanvas: HTMLCanvasElement
  ) => {
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
    
    // Drawing to the transparent canvas is no longer needed as we're using data URLs directly
    console.log("usePixelArtGeneration: Skipping draw to transparentCanvas (using data URLs instead)");
  };

  return {
    generatedPixelArt,
    pixelArtDataURL,
    transparentPixelArtDataURL,
    colorHistogram,
    pixelArtCanvasRef,
    transparentPixelArtCanvasRef,
    histogramCanvasRef
  };
};
