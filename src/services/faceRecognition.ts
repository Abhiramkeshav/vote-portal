// Face recognition service for voter verification
// Handles both duplicate detection and voter identity verification

export class FaceRecognitionService {
  private storedFaces: { descriptor: Float32Array; voterId: string }[] = [];

  constructor() {
    this.loadStoredFaces();
  }

  private loadStoredFaces() {
    try {
      const storedFaces = localStorage.getItem("storedFaces");
      if (storedFaces) {
        // Parse stored faces and convert them back to Float32Array
        const parsedData = JSON.parse(storedFaces);

        this.storedFaces = parsedData
          .map((face: any) => {
            // Convert the descriptor object/array back to Float32Array
            let descriptorArray: number[];

            if (Array.isArray(face.descriptor)) {
              descriptorArray = face.descriptor;
            } else if (typeof face.descriptor === "object") {
              // Handle case where Float32Array was serialized as object with numeric keys
              descriptorArray = Object.values(face.descriptor);
            } else {
              console.error("Invalid descriptor format:", face.descriptor);
              return null;
            }

            return {
              descriptor: new Float32Array(descriptorArray),
              voterId: face.voterId,
            };
          })
          .filter((face: any) => face !== null);

        console.log(
          `Loaded ${this.storedFaces.length} stored faces from localStorage`
        );
      }
    } catch (error) {
      console.error("Error loading stored faces:", error);
      this.storedFaces = [];
    }
  }

  private saveStoredFaces() {
    try {
      // Convert Float32Array to regular array for storage
      const serializable = this.storedFaces.map((face) => ({
        descriptor: Array.from(face.descriptor),
        voterId: face.voterId,
      }));

      localStorage.setItem("storedFaces", JSON.stringify(serializable));
      console.log(`Saved ${serializable.length} faces to localStorage`);
    } catch (error) {
      console.error("Error saving stored faces:", error);
    }
  }

  /**
   * Calculate distance between two face descriptors (lower is more similar)
   */
  private calculateDistance(
    descriptor1: Float32Array,
    descriptor2: Float32Array
  ): number {
    if (!descriptor1 || !descriptor2) {
      console.error("Invalid descriptors:", { descriptor1, descriptor2 });
      return Infinity;
    }

    if (descriptor1.length !== descriptor2.length) {
      console.error("Descriptor length mismatch:", {
        length1: descriptor1.length,
        length2: descriptor2.length,
      });
      return Infinity;
    }

    let sum = 0;
    for (let i = 0; i < descriptor1.length; i++) {
      sum += Math.pow(descriptor1[i] - descriptor2[i], 2);
    }
    const distance = Math.sqrt(sum);

    console.log(`Calculated distance: ${distance.toFixed(4)}`);
    return distance;
  }

  /**
   * Store a new face descriptor linked to a voter ID
   */
  public storeFace(descriptor: Float32Array, voterId: string): void {
    console.log(
      `Storing face for voter: ${voterId}, descriptor length: ${descriptor.length}`
    );
    this.storedFaces.push({ descriptor, voterId });
    this.saveStoredFaces();
  }

  /**
   * Check if a face has been seen before, returns voterId if match found
   */
  public recognizeFace(
    descriptor: Float32Array,
    threshold: number = 0.6
  ): string | null {
    console.log(
      `Recognizing face against ${this.storedFaces.length} stored faces`
    );
    console.log(`Input descriptor length: ${descriptor.length}`);

    if (this.storedFaces.length === 0) {
      console.log("No stored faces to compare against");
      return null;
    }

    // Find the closest match
    let closestMatch: { distance: number; voterId: string } = {
      distance: Infinity,
      voterId: "",
    };

    for (const face of this.storedFaces) {
      console.log(
        `Comparing with stored face for voter: ${face.voterId}, stored descriptor length: ${face.descriptor.length}`
      );
      const distance = this.calculateDistance(descriptor, face.descriptor);

      if (distance < closestMatch.distance) {
        closestMatch = {
          distance,
          voterId: face.voterId,
        };
      }
    }

    console.log(
      `Closest match: ${
        closestMatch.voterId
      } with distance ${closestMatch.distance.toFixed(
        4
      )} (threshold: ${threshold})`
    );

    // Return the match if it's below the threshold
    if (closestMatch.distance < threshold) {
      console.log(
        `✅ Match found! Voter ${closestMatch.voterId} has already voted`
      );
      return closestMatch.voterId;
    } else {
      console.log(
        `❌ No match found. Distance ${closestMatch.distance.toFixed(
          4
        )} > threshold ${threshold}`
      );
      return null;
    }
  }

  /**
   * Verify that the live face matches the registered face for a specific voter
   * @param liveDescriptor - Face descriptor from live camera capture
   * @param registeredEmbedding - Stored face embedding from voter registration
   * @param threshold - Similarity threshold (lower = stricter, default 0.6)
   * @returns Object with match status and similarity distance
   */
  public verifyVoterIdentity(
    liveDescriptor: Float32Array,
    registeredEmbedding: number[],
    threshold: number = 0.6
  ): { isMatch: boolean; distance: number } {
    if (!liveDescriptor || !registeredEmbedding) {
      console.error("Invalid descriptors for verification");
      return { isMatch: false, distance: Infinity };
    }

    const registeredDescriptor = new Float32Array(registeredEmbedding);
    const distance = this.calculateDistance(liveDescriptor, registeredDescriptor);

    console.log(
      `Voter identity verification: distance ${distance.toFixed(4)} (threshold: ${threshold})`
    );

    const isMatch = distance < threshold;

    if (isMatch) {
      console.log("✅ Voter identity verified successfully");
    } else {
      console.log(
        `❌ Voter identity verification failed. Distance ${distance.toFixed(
          4
        )} > threshold ${threshold}`
      );
    }

    return { isMatch, distance };
  }

  /**
   * Clear all stored faces
   */
  public clearAllFaces(): void {
    this.storedFaces = [];
    this.saveStoredFaces();
    console.log("All stored faces cleared");
  }
}

// Create a singleton instance
export const faceRecognition = new FaceRecognitionService();
