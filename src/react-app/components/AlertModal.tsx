import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react";
import { Portal } from "./Portal";

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: "success" | "error" | "warning" | "info";
  confirmText?: string;
  onConfirm?: () => void;
  cancelText?: string;
}

export function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  type = "info",
  confirmText = "OK",
  onConfirm,
  cancelText,
}: AlertModalProps) {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-12 h-12 text-green-600" strokeWidth={2} />;
      case "error":
        return <AlertCircle className="w-12 h-12 text-red-600" strokeWidth={2} />;
      case "warning":
        return <AlertTriangle className="w-12 h-12 text-amber-600" strokeWidth={2} />;
      default:
        return <Info className="w-12 h-12 text-blue-600" strokeWidth={2} />;
    }
  };

  const getColorClasses = () => {
    switch (type) {
      case "success":
        return "bg-green-50 border-green-200";
      case "error":
        return "bg-red-50 border-red-200";
      case "warning":
        return "bg-amber-50 border-amber-200";
      default:
        return "bg-blue-50 border-blue-200";
    }
  };

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  return (
    <Portal>
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[300] backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-strong w-full max-w-md">
        <div className="p-8">
          <div className="flex justify-end mb-4">
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              <X className="w-6 h-6" strokeWidth={2} />
            </button>
          </div>

          <div className="text-center">
            <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6 border-2 ${getColorClasses()}`}>
              {getIcon()}
            </div>

            <h2 className="text-2xl font-bold text-neutral-900 mb-4 tracking-tight">
              {title}
            </h2>

            <p className="text-neutral-600 mb-8 leading-relaxed whitespace-pre-line">
              {message}
            </p>

            <div className="flex gap-3">
              {cancelText && (
                <button
                  onClick={onClose}
                  className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 active:scale-95"
                >
                  {cancelText}
                </button>
              )}
              <button
                onClick={handleConfirm}
                className={`${cancelText ? 'flex-1' : 'w-full'} bg-action-600 hover:bg-action-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 shadow-sm active:scale-95`}
              >
                {confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </Portal>
  );
}
