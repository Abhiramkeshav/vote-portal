import React, { useRef, useState, useEffect } from 'react';
import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WebcamStatus {
  active: boolean;
  faceDetected: boolean;
  warning: string | null;
}

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

  const startCamera = async () => {
    setIsLoading(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported in this browser');
      }

      console.log('Requesting camera access...');
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });
      
      console.log('Camera stream obtained:', mediaStream);
      setStream(mediaStream);
      
      // Update status immediately when stream is obtained
      onStatusChange({
        active: true,
        faceDetected: true,
        warning: null
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded');
          if (videoRef.current) {
            videoRef.current.play().then(() => {
              console.log('Video playing, dimensions:', {
                videoWidth: videoRef.current?.videoWidth,
                videoHeight: videoRef.current?.videoHeight
              });
              // Status already updated above
            }).catch((playError) => {
              console.error('Error playing video:', playError);
              onStatusChange({
                active: false,
                faceDetected: false,
                warning: 'Error starting video playback'
              });
            });
          }
        };

        videoRef.current.onerror = (error) => {
          console.error('Video element error:', error);
          onStatusChange({
            active: false,
            faceDetected: false,
            warning: 'Video element error occurred'
          });
        };
      }
    } catch (error: any) {
      console.error('Error accessing camera:', error);
      let errorMessage = 'Failed to access camera. ';
      
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Please allow camera permissions and try again.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No camera found on this device.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Camera is already in use by another application.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage += 'Camera constraints could not be satisfied.';
      } else {
        errorMessage += error.message || 'Unknown error occurred.';
      }
      
      onStatusChange({
        active: false,
        faceDetected: false,
        warning: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      console.log('Stopping camera stream');
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('Track stopped:', track.kind);
      });
      setStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    onStatusChange({
      active: false,
      faceDetected: false,
      warning: null
    });
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      
      if (context && video.videoWidth && video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            console.log('Image captured, blob size:', blob.size);
            onCaptureImage(blob);
          }
        }, 'image/jpeg', 0.9);
      } else {
        console.error('Cannot capture image - video not ready');
        onStatusChange({
          ...webcamStatus,
          warning: 'Video not ready for capture. Please wait and try again.'
        });
      }
    }
  };

  useEffect(() => {
    const checkPermissions = async () => {
      try {
        if (navigator.permissions) {
          const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
          console.log('Camera permission status:', result.state);
        }
      } catch (error) {
        console.log('Permission check not supported:', error);
      }
    };
    
    checkPermissions();
    
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Camera className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-medium">Face Verification</h3>
      </div>
      
      <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-4 min-h-[400px] bg-gray-50">
        {stream ? (
          <div className="text-center">
            <div className="relative inline-block">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-auto rounded-lg border-2 border-gray-400 shadow-md bg-black"
                style={{ 
                  minHeight: '240px',
                  maxWidth: '100%',
                  aspectRatio: '4/3'
                }}
              />
              {/* Debug overlay to show if video is playing */}
              <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                LIVE
              </div>
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <div className="mt-4 flex gap-2 justify-center">
              <Button onClick={captureImage} variant="outline" size="sm">
                <Camera className="h-4 w-4 mr-2" />
                Capture Face
              </Button>
              <Button onClick={stopCamera} variant="outline" size="sm">
                Stop Camera
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <Camera className="h-16 w-16 text-gray-400 mb-4" />
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-600 mb-4">Starting camera...</p>
              </>
            ) : (
              <>
                <p className="text-gray-600 mb-4 text-lg">Camera not active</p>
                <Button onClick={startCamera} variant="outline" disabled={isLoading} size="lg">
                  {isLoading ? 'Starting...' : 'Start Camera'}
                </Button>
              </>
            )}
          </div>
        )}
        
        {webcamStatus.warning && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-sm">
            <strong>Warning:</strong> {webcamStatus.warning}
          </div>
        )}
        
        {webcamStatus.active && webcamStatus.faceDetected && !webcamStatus.warning && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-green-800 text-sm">
            ✓ Face detected - Ready to vote
          </div>
        )}
      </div>
      
      {/* Debug info */}
      <div className="text-xs text-gray-500 mt-2">
        Stream active: {stream ? 'Yes' : 'No'} | 
        Webcam status: {webcamStatus.active ? 'Active' : 'Inactive'} |
        Video element: {videoRef.current ? 'Ready' : 'Not ready'}
      </div>
    </div>
  );
};

export default WebcamSection;