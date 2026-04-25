"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Camera, X, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  disabled?: boolean;
}

export function CameraCapture({ onCapture, disabled }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setError("Could not access camera. Please check permissions.");
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(null); // reset stale error when camera reopens
      void startCamera();
    }
    return () => stopCamera();
  }, [isOpen, startCamera, stopCamera]);

  function capture() {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedUrl(dataUrl);
    stopCamera();
  }

  function retake() {
    setCapturedUrl(null);
    startCamera();
  }

  function confirm() {
    if (!capturedUrl || !canvasRef.current) return;
    canvasRef.current.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `receipt-${Date.now()}.jpg`, { type: "image/jpeg" });
        onCapture(file);
        setIsOpen(false);
        setCapturedUrl(null);
      },
      "image/jpeg",
      0.9,
    );
  }

  function close() {
    stopCamera();
    setIsOpen(false);
    setCapturedUrl(null);
    setError(null);
  }

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className="gap-2"
      >
        <Camera className="h-4 w-4" />
        Use Camera
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-black">
      <div className="relative">
        {!capturedUrl ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full max-h-72 object-cover"
            />
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <p className="text-sm text-white text-center px-4">{error}</p>
              </div>
            )}
            {/* Guide overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <div className={cn("absolute inset-6 border-2 border-white/40 rounded-lg")} />
            </div>
          </>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={capturedUrl} alt="Captured receipt" className="w-full max-h-72 object-contain" />
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="flex items-center justify-between p-3 bg-card border-t border-border gap-2">
        <Button variant="ghost" size="sm" onClick={close} className="gap-1">
          <X className="h-4 w-4" /> Cancel
        </Button>

        {!capturedUrl ? (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFacingMode((f) => (f === "environment" ? "user" : "environment"))}
              aria-label="Flip camera"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={capture} className="gap-1">
              <Camera className="h-4 w-4" /> Capture
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={retake} className="gap-1">
              <RotateCcw className="h-4 w-4" /> Retake
            </Button>
            <Button size="sm" onClick={confirm} className="gap-1">
              <Check className="h-4 w-4" /> Use Photo
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
