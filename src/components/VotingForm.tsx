import { useState, useEffect, useRef, useCallback } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Shield, Camera, User, Vote, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VoterDetailsForm } from "./voting/VoterDetailsForm";

// Mock API Configuration for demo
const API_BASE_URL = 'http://localhost:8000';

// Types
interface Candidate {
  id: string;
  name: string;
  party: string;
}

interface VotingData {
  candidates: Candidate[];
}

interface WebcamStatus {
  active: boolean;
  faceDetected: boolean;
  warning: string | null;
}

// VotingApiService.ts
class VotingApiService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // ✅ Fetch voting data (candidates, slots, voters, etc.)
  async getVotingData(): Promise<VotingData> {
    const response = await fetch(`${this.baseUrl}/voting-data`);
    if (!response.ok) {
      throw new Error("Failed to fetch voting data");
    }
    return response.json();
  }

  // ✅ Submit vote with image (multipart/form-data)
  async submitVote(voterId: string, candidateId: string, imageBlob: Blob): Promise<any> {
    const formData = new FormData();
    formData.append("voter_id", voterId);
    formData.append("selected_candidate_id", candidateId);
    formData.append("image", imageBlob, "face.jpg");

    const response = await fetch(`${this.baseUrl}/submit-vote`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "Failed to submit vote");
    }

    return response.json();
  }

  // ✅ Health check
  async healthCheck(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) {
      throw new Error("API not healthy");
    }
    return response.json();
  }
}


// Fixed Webcam Component
const WebcamSection = ({ 
  webcamStatus, 
  onStatusChange, 
  onCaptureImage 
}: {
  webcamStatus: WebcamStatus;
  onStatusChange: (status: WebcamStatus) => void;
  onCaptureImage: (blob: Blob) => void;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [videoReady, setVideoReady] = useState(false);

  const addDebugInfo = useCallback((message: string) => {
    console.log(message);
    setDebugInfo(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${message}`]);
  }, []);

  const startCamera = useCallback(async () => {
    setIsLoading(true);
    setVideoReady(false);
    addDebugInfo("Starting camera...");

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera access is not supported in this browser");
      }

      const constraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: false,
      };

      addDebugInfo("Requesting camera permission...");
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      addDebugInfo(`Camera stream obtained with ${mediaStream.getVideoTracks().length} video tracks`);

      // Set stream first to trigger video element rendering
      setStream(mediaStream);
      
      // Update status to active immediately
      onStatusChange({
        active: true,
        faceDetected: false, // Will be true once video loads
        warning: null,
      });

      // Use a small delay to ensure the video element is rendered
      setTimeout(() => {
        if (!videoRef.current) {
          addDebugInfo("Video ref not available after timeout");
          return;
        }

        const video = videoRef.current;
        addDebugInfo("Setting up video element...");

        // Clear any existing src
        video.srcObject = null;
        
        // Set up video element properties
        video.srcObject = mediaStream;
        video.playsInline = true;
        video.muted = true;
        video.autoPlay = true;

        // Event handlers
        const handleCanPlay = () => {
          addDebugInfo(`Video can play: ${video.videoWidth}x${video.videoHeight}`);
          video.play().then(() => {
            addDebugInfo("Video playing successfully");
            setVideoReady(true);
            onStatusChange({
              active: true,
              faceDetected: true,
              warning: null,
            });
          }).catch(err => {
            addDebugInfo(`Play error: ${err.message}`);
          });
        };

        const handleLoadedMetadata = () => {
          addDebugInfo(`Video metadata loaded: ${video.videoWidth}x${video.videoHeight}`);
        };

        const handleError = (event: Event) => {
          addDebugInfo(`Video error event: ${event.type}`);
          onStatusChange({
            active: false,
            faceDetected: false,
            warning: "Video playback error",
          });
        };

        // Add event listeners
        video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
        video.addEventListener('canplay', handleCanPlay, { once: true });
        video.addEventListener('error', handleError);

        addDebugInfo("Event listeners added, waiting for video to load...");
      }, 100);

    } catch (error: any) {
      addDebugInfo(`Camera error: ${error.message}`);
      setStream(null);
      onStatusChange({
        active: false,
        faceDetected: false,
        warning: error.message || "Unknown camera error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [addDebugInfo, onStatusChange]);

  const stopCamera = useCallback(() => {
    addDebugInfo('Stopping camera...');
    
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        addDebugInfo(`Stopped ${track.kind} track`);
      });
      setStream(null);
    }
    
    if (videoRef.current) {
      const video = videoRef.current;
      video.srcObject = null;
      
      // Remove event listeners
      video.removeEventListener('loadeddata', () => {});
      video.removeEventListener('error', () => {});
    }
    
    setVideoReady(false);
    onStatusChange({
      active: false,
      faceDetected: false,
      warning: null
    });
    
    addDebugInfo('Camera stopped');
  }, [stream, addDebugInfo, onStatusChange]);

  const captureImage = useCallback(() => {
    addDebugInfo('Attempting to capture image...');
    
    if (!videoRef.current || !canvasRef.current) {
      addDebugInfo('Missing video or canvas reference');
      onStatusChange({
        ...webcamStatus,
        warning: 'Video or canvas not available for capture.'
      });
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');
    
    if (!context) {
      addDebugInfo('No canvas context');
      onStatusChange({
        ...webcamStatus,
        warning: 'Cannot create canvas context for image capture.'
      });
      return;
    }

    if (!video.videoWidth || !video.videoHeight) {
      addDebugInfo(`Video dimensions: ${video.videoWidth}x${video.videoHeight}`);
      onStatusChange({
        ...webcamStatus,
        warning: 'Video not ready for capture. Please wait for camera to fully load.'
      });
      return;
    }

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw the current video frame to canvas
    context.drawImage(video, 0, 0);
    
    // Convert to blob
    canvas.toBlob((blob) => {
      if (blob) {
        addDebugInfo(`Image captured: ${blob.size} bytes`);
        onCaptureImage(blob);
      } else {
        addDebugInfo('Failed to create image blob');
        onStatusChange({
          ...webcamStatus,
          warning: 'Failed to capture image. Please try again.'
        });
      }
    }, 'image/jpeg', 0.9);
  }, [addDebugInfo, onCaptureImage, onStatusChange, webcamStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Camera className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-medium">Face Verification</h3>
      </div>
      
      <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-4 min-h-[400px]">
        {stream ? (
          <div className="text-center">
            <div className="relative w-full max-w-sm mx-auto">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full rounded-lg border bg-black"
                style={{ maxHeight: '300px', minHeight: '200px' }}
              />
              {!videoReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
                  <div className="text-white text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                    <p className="text-sm">Loading video...</p>
                  </div>
                </div>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <div className="mt-4 flex gap-2 justify-center flex-wrap">
              <Button 
                onClick={captureImage} 
                variant="outline" 
                size="sm"
                disabled={!videoReady}
              >
                <Camera className="h-4 w-4 mr-2" />
                {videoReady ? 'Capture Face' : 'Loading...'}
              </Button>
              <Button onClick={stopCamera} variant="outline" size="sm">
                Stop Camera
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Camera className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600 mb-4">Starting camera...</p>
              </>
            ) : (
              <>
                <p className="text-gray-600 mb-4">Camera not active</p>
                <Button onClick={startCamera} variant="outline" disabled={isLoading}>
                  {isLoading ? 'Starting...' : 'Start Camera'}
                </Button>
              </>
            )}
          </div>
        )}
        
        {/* Debug Information */}
        {debugInfo.length > 0 && (
          <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600 max-h-24 overflow-y-auto">
            <div className="flex items-center gap-1 mb-2">
              <AlertCircle className="h-3 w-3" />
              <span className="font-medium">Debug Info:</span>
            </div>
            {debugInfo.map((info, index) => (
              <div key={index} className="font-mono text-xs">{info}</div>
            ))}
          </div>
        )}
        
        {webcamStatus.warning && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-sm">
            <strong>Warning:</strong> {webcamStatus.warning}
          </div>
        )}
        
        {webcamStatus.active && webcamStatus.faceDetected && !webcamStatus.warning && videoReady && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-green-800 text-sm">
            ✓ Face detected - Ready to vote
          </div>
        )}
      </div>
    </div>
  );
};

const VotingForm = () => {
  const [name, setName] = useState("");
  const [voterId, setVoterId] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [capturedImage, setCapturedImage] = useState<Blob | null>(null);
  const [webcamStatus, setWebcamStatus] = useState<WebcamStatus>({
    active: false,
    faceDetected: false,
    warning: null
  });
  const [apiService] = useState(() => new VotingApiService(API_BASE_URL));

  const showToast = (title: string, description: string, variant: "default" | "destructive" = "default") => {
    console.log(`${variant === "destructive" ? "ERROR" : "INFO"}: ${title} - ${description}`);
    // In a real app, you'd use the actual toast hook here
  };

  useEffect(() => {
    loadCandidates();
    checkApiHealth();
  }, []);

  const checkApiHealth = async () => {
    try {
      await apiService.healthCheck();
      console.log('API is healthy');
    } catch (error) {
      showToast(
        "API Connection Error",
        "Using mock data for demo purposes.",
        "destructive"
      );
    }
  };

  const loadCandidates = async () => {
    try {
      const data = await apiService.getVotingData();
      setCandidates(data.candidates);
    } catch (error) {
      console.error('Error loading candidates:', error);
      showToast(
        "Error loading candidates",
        "Using mock candidates for demo.",
        "destructive"
      );
    }
  };

  const handleImageCapture = (blob: Blob) => {
    setCapturedImage(blob);
    showToast(
      "Face captured",
      "Your face has been captured successfully."
    );
  };

  const getSubmitButtonDisabledReason = (): string | null => {
    if (!webcamStatus.faceDetected || !capturedImage) {
      return "Please capture your face for verification.";
    }
    
    if (!name || !voterId || !selectedCandidate) {
      return "Please complete all required fields to submit your vote.";
    }
    
    if (isSubmitting) {
      return "Your vote is being processed...";
    }
    
    return null;
  };

  const handleSubmit = async () => {
    if (!name || !voterId || !selectedCandidate) {
      showToast(
        "Missing information",
        "Please fill in all fields.",
        "destructive"
      );
      return;
    }

    if (!capturedImage) {
      showToast(
        "Face verification required",
        "Please capture your face for verification.",
        "destructive"
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await apiService.submitVote(voterId, selectedCandidate, capturedImage);
      
      showToast(
        "Vote submitted successfully",
        "Your vote has been recorded securely."
      );

      // Reset form
      setName("");
      setVoterId("");
      setSelectedCandidate("");
      setCapturedImage(null);
      setWebcamStatus({
        active: false,
        faceDetected: false,
        warning: null
      });

    } catch (error: any) {
      console.error('Error submitting vote:', error);
      showToast(
        "Vote submission failed",
        error.message || "Unable to submit your vote. Please try again.",
        "destructive"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitButtonDisabledReason = getSubmitButtonDisabledReason();
  const isButtonDisabled = !!submitButtonDisabledReason;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <Card className="w-full max-w-6xl mx-auto shadow-lg">
        <CardHeader className="bg-blue-600 text-white">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6" />
            <CardTitle>Secure Voting Portal</CardTitle>
          </div>
          <CardDescription className="text-blue-100">
            Cast your vote securely with facial verification
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <VoterDetailsForm
            name={name}
            voterId={voterId}
            selectedCandidate={selectedCandidate}
            candidates={candidates}
            onNameChange={setName}
            onVoterIdChange={setVoterId}
            onCandidateChange={setSelectedCandidate}
          />
        

          {/* Voter Details Form */}
          {/* <div className="space-y-4">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-medium">Voter Information</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="voterId">Voter ID</Label>
                <Input
                  id="voterId"
                  type="text"
                  placeholder="Enter your voter ID"
                  value={voterId}
                  onChange={(e) => setVoterId(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="candidate">Select Candidate</Label>
                <Select value={selectedCandidate} onValueChange={setSelectedCandidate}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choose your candidate" />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map((candidate) => (
                      <SelectItem key={candidate.id} value={candidate.id}>
                        {candidate.name} ({candidate.party})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div> */}
          
          {/* Webcam Section */}
          <WebcamSection
            webcamStatus={webcamStatus}
            onStatusChange={setWebcamStatus}
            onCaptureImage={handleImageCapture}
          />
        </CardContent>
        
        <CardFooter className="p-6 bg-gray-50">
          <div className="w-full space-y-3">
            {capturedImage && (
              <div className="text-center text-sm text-green-600">
                ✓ Face captured and ready for verification
              </div>
            )}
            
            <Button
              onClick={handleSubmit}
              disabled={isButtonDisabled}
              className="w-full bg-blue-600 hover:bg-blue-700"
              size="lg"
            >
              <Vote className="h-5 w-5 mr-2" />
              {isSubmitting ? "Submitting Vote..." : "Submit Vote"}
            </Button>
            
            {submitButtonDisabledReason && (
              <p className="text-sm text-gray-600 text-center">
                {submitButtonDisabledReason}
              </p>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};  

export default VotingForm;