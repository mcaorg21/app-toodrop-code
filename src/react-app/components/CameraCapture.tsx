import { useRef, useState, useEffect } from "react";
import { Camera, X, RotateCcw } from "lucide-react";

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
  mode: "document" | "selfie" | "fullscreen";
}

export function CameraCapture({ onCapture, onClose, mode }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">(
    mode === "selfie" ? "user" : "environment"
  );

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [facingMode]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);
    } catch (err) {
      console.error("Erro ao acessar câmera:", err);
      setError("Não foi possível acessar a câmera. Verifique as permissões.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  const switchCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        
        const file = new File([blob], `capture-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        
        stopCamera();
        onCapture(file);
      },
      "image/jpeg",
      0.9
    );
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <div className="relative w-full h-full flex flex-col">
      {error ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <Camera className="w-16 h-16 text-red-500 mx-auto mb-4" strokeWidth={2} />
            <p className="text-white text-lg mb-6">{error}</p>
            <button
              onClick={handleClose}
              className="px-6 py-3 bg-white text-black rounded-xl font-semibold"
            >
              Fechar
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative flex-1 flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            
            {/* Visual Guide Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {mode === "fullscreen" ? (
                <div className="relative w-full h-full px-4 py-8">
                  <div className="absolute inset-4 border-4 border-white rounded-2xl shadow-2xl">
                    {/* Corner markers */}
                    <div className="absolute -top-1 -left-1 w-12 h-12 border-t-4 border-l-4 border-green-400 rounded-tl-2xl" />
                    <div className="absolute -top-1 -right-1 w-12 h-12 border-t-4 border-r-4 border-green-400 rounded-tr-2xl" />
                    <div className="absolute -bottom-1 -left-1 w-12 h-12 border-b-4 border-l-4 border-green-400 rounded-bl-2xl" />
                    <div className="absolute -bottom-1 -right-1 w-12 h-12 border-b-4 border-r-4 border-green-400 rounded-br-2xl" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 text-center pb-20">
                    <p className="text-white text-sm font-semibold bg-black/50 px-4 py-2 rounded-full inline-block">
                      Alinhe o comprovante dentro da moldura
                    </p>
                  </div>
                </div>
              ) : mode === "document" ? (
                <div className="relative w-[85%] max-w-md aspect-[3/2]">
                  <div className="absolute inset-0 border-4 border-white rounded-2xl shadow-2xl">
                    {/* Corner markers */}
                    <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-green-400 rounded-tl-2xl" />
                    <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-green-400 rounded-tr-2xl" />
                    <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-green-400 rounded-bl-2xl" />
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-green-400 rounded-br-2xl" />
                  </div>
                  <div className="absolute -bottom-12 left-0 right-0 text-center">
                    <p className="text-white text-sm font-semibold bg-black/50 px-4 py-2 rounded-full inline-block">
                      Alinhe o documento dentro da moldura
                    </p>
                  </div>
                </div>
              ) : (
                <div className="relative w-72 h-72">
                  <div className="absolute inset-0 rounded-full border-4 border-white shadow-2xl">
                    <div className="absolute inset-0 rounded-full border-4 border-green-400" />
                  </div>
                  <div className="absolute -bottom-16 left-0 right-0 text-center">
                    <p className="text-white text-sm font-semibold bg-black/50 px-4 py-2 rounded-full inline-block">
                      Posicione seu rosto no centro
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Dark overlay outside guide */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 bg-black/40" />
            </div>
          </div>

          {/* Controls */}
          <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-10">
            <button
              onClick={handleClose}
              className="w-12 h-12 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center backdrop-blur-sm transition-all"
            >
              <X className="w-6 h-6 text-white" strokeWidth={2} />
            </button>
            
            {mode === "document" && (
              <button
                onClick={switchCamera}
                className="w-12 h-12 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center backdrop-blur-sm transition-all"
              >
                <RotateCcw className="w-6 h-6 text-white" strokeWidth={2} />
              </button>
            )}
          </div>

          <div className="absolute bottom-8 left-0 right-0 flex justify-center z-10">
            <button
              onClick={capturePhoto}
              className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-transform border-4 border-black/20"
            >
              <div className="w-16 h-16 bg-white rounded-full border-4 border-black" />
            </button>
          </div>
        </>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
