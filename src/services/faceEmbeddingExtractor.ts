import * as faceapi from "face-api.js";

/**
 * Utility service to extract face embeddings from images
 */
export class FaceEmbeddingExtractor {
  private modelsLoaded = false;

  /**
   * Load face-api models if not already loaded
   */
  async ensureModelsLoaded(): Promise<void> {
    if (this.modelsLoaded) return;

    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models')
      ]);
      this.modelsLoaded = true;
      console.log('Face-api models loaded successfully');
    } catch (error) {
      console.error('Error loading face-api models:', error);
      throw new Error('Failed to load face recognition models');
    }
  }

  /**
   * Extract face embedding from an image file
   * @param imageFile - The image file to process
   * @returns Face descriptor as Float32Array or null if no face detected
   */
  async extractEmbeddingFromFile(imageFile: File): Promise<Float32Array | null> {
    await this.ensureModelsLoaded();

    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = async (e) => {
        if (!e.target?.result) {
          reject(new Error('Failed to read image file'));
          return;
        }

        img.onload = async () => {
          try {
            const detection = await faceapi
              .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
              .withFaceLandmarks()
              .withFaceDescriptor();

            if (detection) {
              console.log('Face detected and embedding extracted successfully');
              resolve(detection.descriptor);
            } else {
              console.log('No face detected in the image');
              resolve(null);
            }
          } catch (error) {
            console.error('Error processing image:', error);
            reject(error);
          }
        };

        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };

        img.src = e.target.result as string;
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsDataURL(imageFile);
    });
  }

  /**
   * Convert Float32Array to regular array for storage
   */
  convertToStorageFormat(embedding: Float32Array): number[] {
    return Array.from(embedding);
  }

  /**
   * Convert regular array back to Float32Array
   */
  convertFromStorageFormat(embedding: number[]): Float32Array {
    return new Float32Array(embedding);
  }
}

// Create a singleton instance
export const faceEmbeddingExtractor = new FaceEmbeddingExtractor();
