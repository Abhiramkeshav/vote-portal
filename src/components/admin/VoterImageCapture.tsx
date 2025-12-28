import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Camera, Upload, X, Check } from "lucide-react";

interface VoterImageCaptureProps {
  onImageCapture: (file: File) => void;
  currentImage: File | null;
  onClearImage: () => void;
}

export const VoterImageCapture = ({ onImageCapture, currentImage, onClearImage }: VoterImageCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("upload");

  useEffect(() => {
    return () => {
      // Cleanup webcam stream on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsWebcamActive(true);
      }
    } catch (err) {
      console.error("Error accessing webcam:", err);
      alert("Failed to access webcam. Please check your camera permissions.");
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsWebcamActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob and then to file
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `voter-photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
        const imageUrl = URL.createObjectURL(blob);
        setCapturedImage(imageUrl);
        onImageCapture(file);
        stopWebcam();
      }
    }, 'image/jpeg', 0.9);
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    onClearImage();
    startWebcam();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      onImageCapture(file);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === "webcam" && !isWebcamActive && !capturedImage) {
      startWebcam();
    } else if (value === "upload") {
      stopWebcam();
      setCapturedImage(null);
    }
  };

  return (
    <div className="space-y-4">
      <Label>Voter Image</Label>
      
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload Image
          </TabsTrigger>
          <TabsTrigger value="webcam" className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Use Webcam
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-2">
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="cursor-pointer"
          />
          {currentImage && activeTab === "upload" && (
            <div className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <p className="text-sm text-green-700">
                  Selected: {currentImage.name}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onClearImage();
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="webcam" className="space-y-4">
          {!capturedImage ? (
            <div className="space-y-4">
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover mirror"
                  style={{ transform: 'scaleX(-1)' }}
                />
                {!isWebcamActive && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
                    <p className="text-white">Camera not started</p>
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />
              
              <div className="flex gap-2">
                {!isWebcamActive ? (
                  <Button
                    type="button"
                    onClick={startWebcam}
                    className="flex-1"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Start Camera
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      onClick={capturePhoto}
                      className="flex-1"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Capture Photo
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={stopWebcam}
                    >
                      Stop
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-lg overflow-hidden border-2 border-green-500">
                <img
                  src={capturedImage}
                  alt="Captured"
                  className="w-full h-auto"
                  style={{ transform: 'scaleX(-1)' }}
                />
                <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded flex items-center gap-1">
                  <Check className="h-4 w-4" />
                  <span className="text-sm">Photo Captured</span>
                </div>
              </div>
              
              <Button
                type="button"
                variant="outline"
                onClick={retakePhoto}
                className="w-full"
              >
                <Camera className="h-4 w-4 mr-2" />
                Retake Photo
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
