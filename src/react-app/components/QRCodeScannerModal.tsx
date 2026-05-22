import { useState } from "react";
import { X, Camera, AlertCircle } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { Portal } from "./Portal";
import { useTranslation } from "@/react-app/i18n";

interface QRCodeScannerModalProps {
  onClose: () => void;
  onScan: (data: string) => void;
  title: string;
}

export function QRCodeScannerModal({ onClose, onScan, title }: QRCodeScannerModalProps) {
  const { t } = useTranslation();
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);

  const startScanning = async () => {
    setError(null);
    setIsScanning(true);

    try {
      const html5QrCode = new Html5Qrcode("qr-reader");
      setScanner(html5QrCode);

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          // Success callback
          html5QrCode.stop().then(() => {
            setIsScanning(false);
            onScan(decodedText);
          });
        },
        () => {
          // Error callback - ignore individual frame errors
        }
      );
    } catch (err) {
      console.error("Error starting scanner:", err);
      setError(t("qrScanner.cameraError"));
      setIsScanning(false);
    }
  };

  const stopScanning = async () => {
    if (scanner) {
      try {
        await scanner.stop();
        setIsScanning(false);
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
    }
  };

  const handleClose = () => {
    stopScanning();
    onClose();
  };

  return (
    <Portal>
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[300] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-xl font-bold text-neutral-900">{title}</h3>
          <button
            onClick={handleClose}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <X className="w-6 h-6" strokeWidth={2} />
          </button>
        </div>

        <div className="space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" strokeWidth={2} />
                <p className="text-sm text-red-900">{error}</p>
              </div>
            </div>
          )}

          <div className="relative">
            <div
              id="qr-reader"
              className="w-full rounded-xl overflow-hidden bg-neutral-900"
              style={{ minHeight: isScanning ? "300px" : "0" }}
            />
            {!isScanning && (
              <div className="bg-neutral-100 rounded-xl p-12 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-200 rounded-2xl mb-4">
                  <Camera className="w-8 h-8 text-neutral-500" strokeWidth={2} />
                </div>
                <p className="text-neutral-600 mb-6">
                  {t("qrScanner.clickToStart")}
                </p>
                <button
                  onClick={startScanning}
                  className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-8 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
                >
                  {t("qrScanner.startScanner")}
                </button>
              </div>
            )}
          </div>

          {isScanning && (
            <div className="flex justify-center">
              <button
                onClick={stopScanning}
                className="bg-neutral-600 hover:bg-neutral-700 text-white font-semibold py-3 px-8 rounded-xl transition-all duration-200"
              >
                {t("qrScanner.stopScanner")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    </Portal>
  );
}
