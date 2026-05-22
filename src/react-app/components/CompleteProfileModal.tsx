import { useState } from "react";
import { useApi } from "@/react-app/hooks/useApi";
import { useTranslation } from "@/react-app/i18n";
import { X, Loader2, CheckCircle, ArrowLeft, Package, Truck, Home, ArrowRight } from "lucide-react";
import type { CompleteProfileInput } from "@/shared/types";
import { validateCPF, validateBirthDate } from "@/shared/validators";

// Google Ads conversion tracking
declare global {
  interface Window {
    gtag_report_conversion?: (url?: string) => boolean;
  }
}

// Local form state type that allows empty main_interest for placeholder
type ProfileFormState = Omit<CompleteProfileInput, 'main_interest'> & {
  main_interest: "" | "consumer" | "receiver" | "delivery";
};

// Helper functions for masking
const formatCPF = (value: string): string => {
  const numbers = value.replace(/\D/g, "");
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
  if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
  return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
};

const formatPhone = (value: string): string => {
  const numbers = value.replace(/\D/g, "");
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  if (numbers.length <= 10) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
};

const formatBirthDate = (value: string): string => {
  const numbers = value.replace(/\D/g, "");
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 4) return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
  return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
};

const getProfileOptions = (t: (key: string) => string) => [
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

interface CompleteProfileModalProps {
  onClose: () => void;
  onComplete: () => void;
}

export function CompleteProfileModal({ onClose, onComplete }: CompleteProfileModalProps) {
  const { completeProfile, isLoading, error, checkCpfAvailability } = useApi();
  const { t } = useTranslation();
  const profileOptions = getProfileOptions(t);
  const [step, setStep] = useState<1 | 2>(1);
  const [profileAttempted, setProfileAttempted] = useState(false);
  const [step2Attempted, setStep2Attempted] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [cpfChecking, setCpfChecking] = useState(false);
  const [cpfAvailable, setCpfAvailable] = useState<boolean | null>(null);
  
  const [profileData, setProfileData] = useState<ProfileFormState>({
    full_name: "",
    cpf: "",
    birth_date: "",
    phone: "",
    main_interest: "",
  });

  const [cpfDisplay, setCpfDisplay] = useState("");
  const [phoneDisplay, setPhoneDisplay] = useState("");
  const [birthDateDisplay, setBirthDateDisplay] = useState("");

  const validateStep1 = (): boolean => {
    if (!profileData.full_name || !profileData.cpf || !profileData.birth_date || !profileData.phone) {
      return false;
    }
    if (!validateCPF(profileData.cpf)) {
      return false;
    }
    if (cpfAvailable === false) {
      return false;
    }
    const birthValidation = validateBirthDate(birthDateDisplay);
    if (!birthValidation.isValid) {
      return false;
    }
    return true;
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileAttempted(true);
    
    if (validateStep1()) {
      setStep(2);
      setProfileAttempted(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep2Attempted(true);
    
    if (!profileData.main_interest) {
      return;
    }
    
    const fullPhone = "+55" + profileData.phone;
    const result = await completeProfile({ 
      ...profileData, 
      phone: fullPhone,
      main_interest: profileData.main_interest as "consumer" | "receiver" | "delivery"
    });
    if (result) {
      // Track Google Ads conversion
      if (window.gtag_report_conversion) {
        window.gtag_report_conversion();
      }
      setShowSuccess(true);
      setTimeout(() => {
        onComplete();
      }, 2000);
    }
  };

  const handleSuccessConfirm = () => {
    onComplete();
  };

  const handleCPFChange = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    setCpfDisplay(formatCPF(value));
    setProfileData({ ...profileData, cpf: numbers });
    
    // Reset availability check when CPF changes
    setCpfAvailable(null);
    
    // Check availability when CPF is complete
    if (numbers.length === 11 && validateCPF(numbers)) {
      setCpfChecking(true);
      checkCpfAvailability(numbers).then((available) => {
        setCpfAvailable(available);
        setCpfChecking(false);
      });
    }
  };

  const handlePhoneChange = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    setPhoneDisplay(formatPhone(value));
    setProfileData({ ...profileData, phone: numbers });
  };

  const handleBirthDateChange = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    setBirthDateDisplay(formatBirthDate(value));
    
    // Convert DD/MM/YYYY to YYYY-MM-DD for storage
    if (numbers.length === 8) {
      const day = numbers.slice(0, 2);
      const month = numbers.slice(2, 4);
      const year = numbers.slice(4, 8);
      setProfileData({ ...profileData, birth_date: `${year}-${month}-${day}` });
    } else {
      setProfileData({ ...profileData, birth_date: "" });
    }
  };

  if (showSuccess) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[300] backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-strong w-full max-w-md">
          <div className="p-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6 border-2 bg-green-50 border-green-200">
                <CheckCircle className="w-12 h-12 text-green-600" strokeWidth={2} />
              </div>

              <h2 className="text-2xl font-bold text-neutral-900 mb-4 tracking-tight">
                {t("profile.registrationComplete")}
              </h2>

              <p className="text-neutral-600 mb-8 leading-relaxed">
                {t("profile.registrationCompleteMsg")}
              </p>

              <button
                onClick={handleSuccessConfirm}
                className="w-full bg-action-600 hover:bg-action-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 shadow-sm active:scale-95"
              >
                {t("common.continue")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[300] backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-strong w-full max-w-lg max-h-[90vh] overflow-y-auto modal-scroll">
        <div className="sticky top-0 bg-white border-b border-neutral-100 p-6 flex items-center justify-between rounded-t-3xl z-10">
          <div className="flex items-center gap-3">
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" strokeWidth={2} />
              </button>
            )}
            <div>
              <h2 className="text-xl font-bold text-neutral-900 tracking-tight">
                {step === 1 ? t("profile.personalData") : t("profile.chooseProfile")}
              </h2>
              <p className="text-sm text-neutral-500">
                {t("common.stepOf", { current: step, total: 2 })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <X className="w-6 h-6" strokeWidth={2} />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleNextStep} noValidate className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  {t("profile.fullName")}
                </label>
                <input
                  type="text"
                  value={profileData.full_name}
                  onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value.toUpperCase() })}
                  maxLength={100}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
                {profileAttempted && !profileData.full_name && (
                  <p className="text-xs text-red-600 mt-1">{t("errors.requiredField")}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  {t("profile.cpf")}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cpfDisplay}
                  onChange={(e) => handleCPFChange(e.target.value)}
                  maxLength={14}
                  placeholder="000.000.000-00"
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
                {profileAttempted && !profileData.cpf && (
                  <p className="text-xs text-red-600 mt-1">{t("errors.requiredField")}</p>
                )}
                {profileAttempted && profileData.cpf && !validateCPF(profileData.cpf) && (
                  <p className="text-xs text-red-600 mt-1">* {t("errors.invalidCpf")}</p>
                )}
                {cpfChecking && (
                  <p className="text-xs text-neutral-500 mt-1 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {t("profile.checkingAvailability")}
                  </p>
                )}
                {!cpfChecking && cpfAvailable === false && (
                  <p className="text-xs text-red-600 mt-1">* {t("profile.cpfAlreadyRegistered")}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  {t("profile.birthDate")}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={birthDateDisplay}
                  onChange={(e) => handleBirthDateChange(e.target.value)}
                  maxLength={10}
                  placeholder="DD/MM/AAAA"
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
                {profileAttempted && !profileData.birth_date && (
                  <p className="text-xs text-red-600 mt-1">{t("errors.requiredField")}</p>
                )}
                {profileAttempted && profileData.birth_date && !validateBirthDate(birthDateDisplay).isValid && (
                  <p className="text-xs text-red-600 mt-1">* {validateBirthDate(birthDateDisplay).error}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2 flex items-center gap-2">
                  <svg viewBox="0 0 175.216 175.552" className="w-6 h-6">
                    <defs>
                      <linearGradient id="whatsapp-gradient" x1="85.915" x2="86.535" y1="32.567" y2="137.092" gradientUnits="userSpaceOnUse">
                        <stop offset="0" stopColor="#57d163"/>
                        <stop offset="1" stopColor="#23b33a"/>
                      </linearGradient>
                    </defs>
                    <path fill="url(#whatsapp-gradient)" d="M87.184 25.227c-33.733 0-61.166 27.423-61.178 61.13a60.98 60.98 0 0 0 9.349 32.535l1.455 2.312-6.179 22.559 23.146-6.069 2.235 1.324c9.387 5.571 20.15 8.518 31.126 8.524h.023c33.707 0 61.14-27.426 61.153-61.135a60.75 60.75 0 0 0-17.895-43.251 60.75 60.75 0 0 0-43.235-17.929z"/>
                    <path fill="#fff" d="M68.772 55.603c-1.378-3.061-2.828-3.123-4.137-3.176l-3.524-.043c-1.226 0-3.218.46-4.902 2.3s-6.435 6.287-6.435 15.332 6.588 17.785 7.506 19.013 12.718 20.381 31.405 27.75c15.529 6.124 18.689 4.906 22.061 4.6s10.877-4.447 12.408-8.74 1.532-7.971 1.073-8.74-1.685-1.226-3.525-2.146-10.877-5.367-12.562-5.981-2.91-.919-4.137.921-4.746 5.979-5.819 7.206-2.144 1.381-3.984.462-7.76-2.861-14.784-9.124c-5.465-4.873-9.154-10.891-10.228-12.73s-.114-2.835.808-3.751c.825-.824 1.838-2.147 2.759-3.22s1.224-1.84 1.836-3.065.307-2.301-.153-3.22-4.032-10.011-5.666-13.647"/>
                  </svg>
                  {t("profile.whatsappNumber")}
                </label>
                <div className="flex gap-2">
                  <div className="w-20 px-3 py-3 border border-neutral-300 rounded-xl bg-neutral-50 flex items-center justify-center text-sm font-medium text-neutral-700">
                    +55
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phoneDisplay}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                    className="flex-1 px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  />
                </div>
                {profileAttempted && !profileData.phone && (
                  <p className="text-xs text-red-600 mt-1">{t("errors.requiredField")}</p>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-action-600 hover:bg-action-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-sm active:scale-95"
              >
                {t("common.next")}
                <ArrowRight className="w-5 h-5" strokeWidth={2} />
              </button>
            </form>
          ) : (
            <form onSubmit={handleProfileSubmit} noValidate className="flex flex-col">
              <p className="text-neutral-600 text-sm mb-4">
                {t("profile.profileHelpText")}
              </p>

              <div className="space-y-3 max-h-[45vh] overflow-y-auto modal-scroll pr-1">
                {profileOptions.map((option) => {
                  const Icon = option.icon;
                  const isSelected = profileData.main_interest === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setProfileData({ ...profileData, main_interest: option.value })}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                        isSelected 
                          ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500" 
                          : "border-neutral-200 hover:border-neutral-300 bg-white"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2.5 rounded-xl transition-colors ${
                          isSelected ? "bg-blue-500 text-white" : "bg-neutral-100 text-neutral-500"
                        }`}>
                          <Icon className="w-5 h-5" strokeWidth={2} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-neutral-900">
                            {option.label}
                            <span className="font-normal text-neutral-500 ml-2">— {option.subtitle}</span>
                          </h3>
                          <p className="text-sm text-neutral-600 mb-2 mt-1">
                            {option.description}
                          </p>
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

              {step2Attempted && !profileData.main_interest && (
                <p className="text-xs text-red-600 mt-3">* {t("profile.selectProfileToContinue")}</p>
              )}

              <button
                type="submit"
                disabled={isLoading || !profileData.main_interest}
                className="w-full bg-action-600 hover:bg-action-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm active:scale-95 mt-4 flex-shrink-0"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
                    {t("common.saving")}
                  </>
                ) : (
                  t("profile.finishRegistration")
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
