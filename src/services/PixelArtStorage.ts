export interface SavedPixelArt {
  id: string;
  name: string;
  dataURL: string;
  transparentDataURL?: string;
  width: number;
  height: number;
  timestamp: number;
  colorCount: number;
}

const STORAGE_KEY = 'geft_saved_pixel_art';

export class PixelArtStorage {
  static savePixelArt(
    name: string,
    dataURL: string,
    transparentDataURL?: string,
    width?: number,
    height?: number,
    colorCount?: number
  ): SavedPixelArt {
    const savedArt: SavedPixelArt = {
      id: Date.now().toString(),
      name: name || `Pixel Art ${new Date().toLocaleString()}`,
      dataURL,
      transparentDataURL,
      width: width || 32,
      height: height || 32,
      timestamp: Date.now(),
      colorCount: colorCount || 0
    };

    const existing = this.getAllSavedPixelArt();
    const updated = [savedArt, ...existing].slice(0, 50); // Keep max 50 items
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save pixel art to localStorage:', error);
      // If storage is full, try removing old items
      if (existing.length > 0) {
        const trimmed = [savedArt, ...existing.slice(0, 20)];
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
        } catch (retryError) {
          console.error('Failed to save even after trimming:', retryError);
          throw retryError;
        }
      } else {
        throw error;
      }
    }

    return savedArt;
  }

  static getAllSavedPixelArt(): SavedPixelArt[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load saved pixel art:', error);
      return [];
    }
  }

  static deletePixelArt(id: string): void {
    const existing = this.getAllSavedPixelArt();
    const filtered = existing.filter(art => art.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  }

  static clearAll(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}