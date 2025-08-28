import React, { useState, useEffect } from 'react';
import { SavedPixelArt, PixelArtStorage } from '../../services/PixelArtStorage';

interface SavedPixelArtSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  refreshTrigger?: number;
}

const SavedPixelArtSidebar: React.FC<SavedPixelArtSidebarProps> = ({
  isOpen,
  onToggle,
  refreshTrigger
}) => {
  const [savedPixelArts, setSavedPixelArts] = useState<SavedPixelArt[]>([]);

  useEffect(() => {
    const loadSavedPixelArts = () => {
      setSavedPixelArts(PixelArtStorage.getAllSavedPixelArt());
    };

    loadSavedPixelArts();
    
    // Listen for storage changes from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'geft_saved_pixel_art') {
        loadSavedPixelArts();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refreshTrigger]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    PixelArtStorage.deletePixelArt(id);
    setSavedPixelArts(PixelArtStorage.getAllSavedPixelArt());
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to delete all saved pixel art?')) {
      PixelArtStorage.clearAll();
      setSavedPixelArts([]);
    }
  };

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className={`fixed top-1/2 transform -translate-y-1/2 z-40 bg-blue-500 text-white p-2 rounded-r-md shadow-lg transition-all duration-300 ${
          isOpen ? 'left-80' : 'left-0'
        }`}
        title="Toggle saved pixel art"
      >
        {isOpen ? '◀' : '▶'}
      </button>

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full bg-gray-50 border-r border-gray-200 z-30 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ width: '320px' }}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Saved Pixel Art</h3>
            <p className="text-sm text-gray-500">{savedPixelArts.length} saved</p>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {savedPixelArts.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                <p>No saved pixel art yet</p>
                <p className="text-xs mt-2">Create some pixel art and save it!</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {savedPixelArts.map((pixelArt) => (
                  <div
                    key={pixelArt.id}
                    className="relative group bg-white border border-gray-200 rounded-lg p-2"
                  >
                    {/* Image */}
                    <div className="aspect-square bg-gray-100 rounded mb-2 overflow-hidden">
                      <img
                        src={pixelArt.dataURL}
                        alt={pixelArt.name}
                        className="w-full h-full object-contain"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    </div>

                    {/* Info */}
                    <div className="text-xs">
                      <p className="font-medium text-gray-900 truncate" title={pixelArt.name}>
                        {pixelArt.name}
                      </p>
                      <p className="text-gray-500">
                        {pixelArt.width}×{pixelArt.height}
                      </p>
                      <p className="text-gray-500">
                        {new Date(pixelArt.timestamp).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={(e) => handleDelete(pixelArt.id, e)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {savedPixelArts.length > 0 && (
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={handleClearAll}
                className="w-full px-3 py-2 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
              >
                Clear All
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Overlay when sidebar is open */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-25 z-20"
          onClick={onToggle}
        />
      )}
    </>
  );
};

export default SavedPixelArtSidebar;