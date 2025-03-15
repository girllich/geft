import React from 'react';
import { ColorCount } from './hooks/usePixelArtGeneration';

interface PixelArtDisplayProps {
  pixelArtDataURL: string | null;
  transparentPixelArtDataURL: string | null;
  generatedPixelArt: ImageData | null;
  colorHistogram: ColorCount[];
  histogramCanvasRef: React.RefObject<HTMLCanvasElement>;
  pixelArtCanvasRef: React.RefObject<HTMLCanvasElement>;
  transparentPixelArtCanvasRef: React.RefObject<HTMLCanvasElement>;
}

const PixelArtDisplay: React.FC<PixelArtDisplayProps> = ({
  pixelArtDataURL,
  transparentPixelArtDataURL,
  generatedPixelArt,
  colorHistogram,
  histogramCanvasRef,
  pixelArtCanvasRef,
  transparentPixelArtCanvasRef
}) => {
  if (!pixelArtDataURL) return null;

  return (
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
              {/* Hidden canvas for internal use */}
              <canvas 
                ref={pixelArtCanvasRef}
                className="hidden"
                style={{ 
                  display: 'none'
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
                {/* Hidden canvas for internal use */}
                <canvas 
                  ref={transparentPixelArtCanvasRef}
                  className="hidden"
                  style={{ 
                    display: 'none'
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
  );
};

export default PixelArtDisplay;
