interface GeminiResponse {
  imageData?: string;
  textResponse?: string;
}

// Key for storing the API key in localStorage
const API_KEY_STORAGE_KEY = 'gemini_api_key';

class GeminiService {
  private defaultReferenceImage: string | null = null;
  private apiKey: string | null = null;
  private apiKeyListeners: ((hasApiKey: boolean) => void)[] = [];
  
  constructor() {
    // Load the default reference image (gervais.gif) when the service is initialized
    this.loadDefaultReferenceImage();
    
    // Try to load API key from environment variable or localStorage
    this.loadApiKey();
  }
  
  /**
   * Loads the API key from environment variables or localStorage
   */
  private loadApiKey(): void {
    // First try to get from environment variables (Vite)
    // @ts-ignore - Vite specific environment variables
    const envApiKey = import.meta.env?.VITE_GEMINI_API_KEY;
    
    if (envApiKey) {
      this.apiKey = envApiKey;
      return;
    }
    
    // Then try localStorage
    const storedApiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (storedApiKey) {
      this.apiKey = storedApiKey;
    }
  }
  
  /**
   * Sets the API key and stores it in localStorage
   */
  public setApiKey(key: string): void {
    this.apiKey = key;
    localStorage.setItem(API_KEY_STORAGE_KEY, key);
    
    // Notify listeners that we now have an API key
    this.notifyApiKeyListeners();
  }
  
  /**
   * Checks if an API key is available
   */
  public hasApiKey(): boolean {
    return !!this.apiKey;
  }
  
  /**
   * Register a listener for API key changes
   */
  public addApiKeyListener(listener: (hasApiKey: boolean) => void): () => void {
    this.apiKeyListeners.push(listener);
    
    // Immediately notify with current state
    listener(this.hasApiKey());
    
    // Return a function to remove the listener
    return () => {
      this.apiKeyListeners = this.apiKeyListeners.filter(l => l !== listener);
    };
  }
  
  /**
   * Notify all listeners about API key changes
   */
  private notifyApiKeyListeners(): void {
    const hasKey = this.hasApiKey();
    this.apiKeyListeners.forEach(listener => listener(hasKey));
  }
  
  /**
   * Loads the gervais.gif as the default reference image
   */
  private async loadDefaultReferenceImage(): Promise<void> {
    try {
      // Use import.meta.env.BASE_URL to get the base URL from Vite
      // This ensures the path works correctly when deployed to a subdirectory
      // @ts-ignore - Vite specific environment variables
      const baseUrl = import.meta.env.BASE_URL || '/';
      const response = await fetch(`${baseUrl}gervais.gif`);
      const blob = await response.blob();
      
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          this.defaultReferenceImage = reader.result as string;
          console.log("Default reference image (gervais.gif) loaded successfully");
          resolve();
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Error loading default reference image:", error);
    }
  }
  
  /**
   * Generate pixel art using Gemini API
   * @param referenceImageData Base64 encoded image data (optional, will use gervais.gif as default if not provided)
   * @param prompt Text prompt for generating pixel art
   * @returns Response with image data or text
   */
  async generatePixelArt(referenceImageData: string, prompt: string): Promise<GeminiResponse> {
    // If no reference image is provided, use the default gervais.gif
    if (!referenceImageData && this.defaultReferenceImage) {
      console.log("Using default reference image (gervais.gif)");
      referenceImageData = this.defaultReferenceImage;
    } else if (!referenceImageData) {
      // If default image is not loaded yet, try to load it now
      console.log("Default reference image not loaded yet, attempting to load it now");
      await this.loadDefaultReferenceImage();
      if (this.defaultReferenceImage) {
        referenceImageData = this.defaultReferenceImage;
      }
    }
    try {
      // Get the model name
      const modelName = "models/gemini-2.0-flash-exp";
      
      // Prepare the parts array for the request
      const parts = [];
      
      // If we have a reference image, include it in the contents
      if (referenceImageData) {
        // Extract the base64 data (remove the data:image/png;base64, prefix)
        const base64Data = referenceImageData.split(',')[1];
        
        // Add the image part
        parts.push({
          inlineData: {
            data: base64Data,
            mimeType: "image/png"
          }
        });
      }
      
      // Add the text prompt
      parts.push({
        text: prompt || "Please generate pixel art of a medieval peasant girl in the style of the reference image, 32x32 pixels"
      });
      
      // Create the request body to match Python API structure
      const requestBody = {
        contents: [
          {
            parts,
            role: "user"
          }
        ],
        generationConfig: {
          responseModalities: ["Text", "Image"]
        }
      };
      
      console.log("Sending request to Gemini API...");
      
      // Check if we have an API key
      if (!this.apiKey) {
        throw new Error("No Gemini API key available. Please provide an API key.");
      }
      
      // Make a direct fetch call to match the Python API call
      const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${this.apiKey}`;
      
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'google-genai-sdk/1.5.0 gl-javascript/node',
        'x-goog-api-client': 'google-genai-sdk/1.5.0 gl-javascript/node'
      };
      
      // Generate content with retry logic
      const maxRetries = 3;
      let attempt = 0;
      let result: any;
      
      while (attempt < maxRetries) {
        attempt++;
        console.log(`Attempt ${attempt}/${maxRetries}: Sending request to Gemini API`);
        
        const response = await fetch(url, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API request failed with status ${response.status}: ${errorText}`);
        }
        
        result = await response.json();
        
        // Check if we got an image response
        if (result.candidates && result.candidates.length > 0) {
          const candidate = result.candidates[0];
          if (candidate.content && candidate.content.parts) {
            // Check if any part contains image data
            const hasImage = candidate.content.parts.some((part: any) => part.inlineData);
            if (hasImage) {
              break; // We got an image, exit the retry loop
            }
          }
        }
        
        if (attempt < maxRetries) {
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Process the final result
      const response: GeminiResponse = {};
      
      // Check if the response contains candidates
      if (result.candidates && result.candidates.length > 0) {
        const candidate = result.candidates[0];
        if (candidate.content && candidate.content.parts) {
          // Process each part
          for (const part of candidate.content.parts) {
            if (part.inlineData) {
              // Found image data
              response.imageData = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            } else if (part.text) {
              // Found text response
              response.textResponse = part.text;
            }
          }
        }
      }
      
      // If no image was found in the response
      if (!response.imageData && !response.textResponse) {
        console.error("No content found in Gemini response after multiple attempts");
      }
      
      return response;
    } catch (error) {
      console.error("Error generating pixel art with Gemini:", error);
      throw error;
    }
  }
}

export default new GeminiService();
