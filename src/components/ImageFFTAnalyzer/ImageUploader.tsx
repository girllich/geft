import React from 'react';

interface ImageUploaderProps {
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>, loadedImage?: HTMLImageElement, callback?: () => void) => void;
  imageData: ImageData | null;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ handleImageUpload, imageData }) => {
  return (
    <label className="block mb-2 font-medium">
      Upload an image:
      <input 
        type="file" 
        accept="image/*" 
        onChange={handleImageUpload} 
        className="mt-1 block w-full p-2 border border-gray-300 rounded"
      />
    </label>
  );
};

export default ImageUploader;
