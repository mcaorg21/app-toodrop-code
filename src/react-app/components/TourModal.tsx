import { useState, useCallback } from "react";
import { X, MapPin, Package, ArrowRight, CheckCircle, Truck } from "lucide-react";
import type { User } from "@/shared/types";
import { Portal } from "./Portal";
import { useTranslation } from "@/react-app/i18n";

interface TourStep {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface TourModalProps {
  tourKey: string;
  title: string;
  steps: TourStep[];
  onClose: () => void;
}

export function TourModal({ tourKey, title, steps, onClose }: TourModalProps) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleClose = async () => {
    if (dontShowAgain) {
      setIsSaving(true);
      try {
        await fetch("/api/profile/tour-seen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ tourKey }),
        });
      } catch (error) {
        console.error("Error saving tour preference:", error);
      }
      setIsSaving(false);
    }
    onClose();
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const isLastStep = currentStep === steps.length - 1;
  const step = steps[currentStep];

  return (
    <Portal>
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[300] backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-strong w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary-600 to-primary-700 p-6 text-white relative">
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" strokeWidth={2} />
          </button>
          
          <h2 className="text-2xl font-bold tracking-tight">
            {title}
          </h2>
          
          {/* Step indicators */}
          <div className="flex gap-2 mt-6">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 rounded-full flex-1 transition-all duration-300 ${
                  index === currentStep
                    ? "bg-white"
                    : index < currentStep
                    ? "bg-white/60"
                    : "bg-white/30"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-20 h-20 rounded-2xl bg-primary-100 flex items-center justify-center mb-5">
              {step.icon}
            </div>
            
            <h3 className="text-xl font-bold text-neutral-900 mb-3">
              {step.title}
            </h3>
            
            <p className="text-neutral-600 leading-relaxed">
              {step.description}
            </p>
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            {currentStep > 0 && (
              <button
                onClick={handlePrevious}
                disabled={isSaving}
                className="flex-1 py-3 px-4 border border-neutral-300 text-neutral-700 font-semibold rounded-xl hover:bg-neutral-50 transition-colors disabled:opacity-50"
              >
                {t("tour.previous")}
              </button>
            )}
            
            <button
              onClick={handleNext}
              disabled={isSaving}
              className="flex-1 py-3 px-4 bg-action-600 hover:bg-action-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLastStep ? (
                <>
                  <CheckCircle className="w-5 h-5" strokeWidth={2} />
                  {t("tour.start")}
                </>
              ) : (
                <>
                  {t("tour.next")}
                  <ArrowRight className="w-5 h-5" strokeWidth={2} />
                </>
              )}
            </button>
          </div>

          {/* Don't show again */}
          <label className="flex items-center justify-center gap-2 mt-5 cursor-pointer">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
            />
            <span className="text-sm text-neutral-500">
              {t("tour.dontShowAgain")}
            </span>
          </label>
        </div>
      </div>
    </div>
    </Portal>
  );
}

// Hook to check if tour should be shown based on user profile
export function useTour(tourKey: string, profile: User | null): [boolean, () => void] {
  const getInitialState = useCallback(() => {
    if (!profile) return false;
    
    const tourField = `has_seen_${tourKey}_tour` as keyof User;
    const hasSeen = profile[tourField];
    
    // Show tour if user hasn't seen it (value is 0, false, null, or undefined)
    return !hasSeen;
  }, [tourKey, profile]);

  const [showTour, setShowTour] = useState(getInitialState);

  const closeTour = () => setShowTour(false);

  return [showTour, closeTour];
}

// Pre-built tour configurations - now a function that receives t
export const getConsumerTourSteps = (t: (key: string) => string) => [
  {
    icon: <Truck className="w-10 h-10 text-primary-600" strokeWidth={1.5} />,
    title: t("tour.consumer.step1.title"),
    description: t("tour.consumer.step1.description"),
  },
  {
    icon: <MapPin className="w-10 h-10 text-primary-600" strokeWidth={1.5} />,
    title: t("tour.consumer.step2.title"),
    description: t("tour.consumer.step2.description"),
  },
  {
    icon: <Package className="w-10 h-10 text-primary-600" strokeWidth={1.5} />,
    title: t("tour.consumer.step3.title"),
    description: t("tour.consumer.step3.description"),
  },
];
