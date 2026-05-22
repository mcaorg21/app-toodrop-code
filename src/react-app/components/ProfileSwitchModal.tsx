import { useState, useEffect } from "react";
import { X, Package, Truck, Home, CheckCircle, Loader2 } from "lucide-react";
import { Portal } from "./Portal";
import { useTranslation } from "@/react-app/i18n";
import type { User } from "@/shared/types";

interface ProfileSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (tab: "consumer" | "receiver" | "delivery") => void;
  currentTab: "consumer" | "receiver" | "delivery";
  profile: User | null;
  isLoading?: boolean;
}

export function ProfileSwitchModal({ isOpen, onClose, onSelect, currentTab, profile, isLoading }: ProfileSwitchModalProps) {
  const { t } = useTranslation();
  const [selectedProfile, setSelectedProfile] = useState<"consumer" | "receiver" | "delivery">(currentTab);
  const hasCommissionAddress = !!(profile as any)?.commission_cep && !!(profile as any)?.commission_street;

  const PROFILE_OPTIONS = [
    {
      value: "consumer" as const,
      label: t("profiles.consumer.name"),
      subtitle: t("profiles.consumer.subtitle"),
      icon: Package,
      description: t("profiles.consumer.description"),
      benefits: [t("profiles.consumer.benefit1"), t("profiles.consumer.benefit2"), t("profiles.consumer.benefit3")]
    },
    {
      value: "receiver" as const,
      label: t("profiles.receiver.name"),
      subtitle: t("profiles.receiver.subtitle"),
      icon: Home,
      description: t("profiles.receiver.description"),
      benefits: [t("profiles.receiver.benefit1"), t("profiles.receiver.benefit2"), t("profiles.receiver.benefit3")]
    },
    {
      value: "delivery" as const,
      label: t("profiles.driver.name"),
      subtitle: t("profiles.driver.subtitle"),
      icon: Truck,
      description: t("profiles.driver.description"),
      benefits: [t("profiles.driver.benefit1"), t("profiles.driver.benefit2"), t("profiles.driver.benefit3")]
    },
  ];

  // Update selectedProfile when modal opens or currentTab changes
  useEffect(() => {
    if (isOpen) {
      setSelectedProfile(currentTab);
    }
  }, [isOpen, currentTab]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (selectedProfile !== currentTab) {
      onSelect(selectedProfile);
    } else {
      onClose();
    }
  };

  const needsCommissionAddress = () => {
    return !hasCommissionAddress;
  };

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[300]">
        <div className="bg-white rounded-3xl shadow-strong w-full max-w-lg max-h-[90vh] overflow-y-auto modal-scroll">
          <div className="sticky top-0 bg-white border-b border-neutral-100 p-6 flex items-center justify-between rounded-t-3xl z-10">
            <div>
              <h2 className="text-xl font-bold text-neutral-900 tracking-tight">
                {t("profileSwitch.title")}
              </h2>
              <p className="text-sm text-neutral-500">
                {t("profileSwitch.selectProfile")}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              <X className="w-6 h-6" strokeWidth={2} />
            </button>
          </div>

          <div className="p-6">
            <div className="space-y-3">
              {PROFILE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = selectedProfile === option.value;
                const isCurrent = currentTab === option.value;
                const showCommissionWarning = (option.value === "receiver" || option.value === "delivery") && needsCommissionAddress();

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSelectedProfile(option.value)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      isSelected 
                        ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500" 
                        : "border-neutral-200 hover:border-neutral-300 bg-white"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2.5 rounded-xl transition-colors ${
                        isSelected 
                          ? "bg-blue-500 text-white" 
                          : "bg-neutral-100 text-neutral-500"
                      }`}>
                        <Icon className="w-5 h-5" strokeWidth={2} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-neutral-900">
                            {option.label}
                            <span className="font-normal text-neutral-500 ml-2">— {option.subtitle}</span>
                          </h3>
                          {isCurrent && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                              {t("profileSwitch.current")}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-neutral-600 mb-2 mt-1">
                          {option.description}
                        </p>
                        {showCommissionWarning && (
                          <p className="text-xs text-amber-600 mt-1 mb-2">
                            {t("profileSwitch.commissionAddressRequired")}
                          </p>
                        )}
                        {isSelected && (
                          <ul className="space-y-1">
                            {option.benefits.map((benefit, idx) => (
                              <li key={idx} className="text-xs text-neutral-500 flex items-center gap-1.5">
                                <CheckCircle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                {benefit}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className="w-full bg-action-600 hover:bg-action-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-sm active:scale-95 mt-6"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
                  {t("common.loading")}
                </>
              ) : selectedProfile === currentTab ? (
                t("common.close")
              ) : (
                t("common.confirm")
              )}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
