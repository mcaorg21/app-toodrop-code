import { useState } from "react";
import { X, User, CreditCard, Briefcase, Loader2, CheckCircle, ChevronDown, Globe } from "lucide-react";
import { useApi } from "@/react-app/hooks/useApi";
import { useTranslation, useLanguage } from "@/react-app/i18n";
import type { User as UserType } from "@/shared/types";
import { Portal } from "./Portal";

interface ProfileMenuModalProps {
  profile: UserType | null;
  onClose: () => void;
  onProfileUpdate?: (profile: UserType) => void;
  activeTab?: "consumer" | "receiver" | "delivery";
}

export function ProfileMenuModal({ profile, onClose, onProfileUpdate, activeTab }: ProfileMenuModalProps) {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const { updateMainInterest, isLoading } = useApi();
  
  const PROFILE_OPTIONS = [
    { value: "consumer", label: t("profiles.dropperOne") },
    { value: "receiver", label: t("profiles.tooDropper") },
    { value: "delivery", label: t("profiles.dropper") },
  ];

  const getOptionLabel = (option: typeof PROFILE_OPTIONS[0], currentInterest: string | null | undefined) => {
    const effectiveInterest = currentInterest || "consumer";
    return option.value === effectiveInterest ? `${option.label} (${t("common.current")})` : option.label;
  };

  const [currentSavedInterest, setCurrentSavedInterest] = useState<string | null | undefined>(
    profile?.main_interest
  );
  const [selectedInterest, setSelectedInterest] = useState<"consumer" | "receiver" | "delivery">(
    activeTab || (profile?.main_interest as "consumer" | "receiver" | "delivery") || "consumer"
  );
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPersonalData, setShowPersonalData] = useState(false);
  const [showPixData, setShowPixData] = useState(false);

  const handleInterestChange = async (value: string) => {
    const newValue = value as "consumer" | "receiver" | "delivery";
    const effectiveCurrentInterest = currentSavedInterest || "consumer";
    
    // Só salva se o valor for diferente do atual
    if (newValue === effectiveCurrentInterest) {
      return;
    }
    
    setSelectedInterest(newValue);
    
    // Salva automaticamente ao selecionar
    const updatedProfile = await updateMainInterest(newValue);
    if (updatedProfile) {
      setCurrentSavedInterest(newValue);
      setShowSuccess(true);
      if (onProfileUpdate) {
        onProfileUpdate(updatedProfile);
      }
      setTimeout(() => {
        setShowSuccess(false);
      }, 2000);
    }
  };

  return (
    <Portal>
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto modal-scroll"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white px-6 py-5 flex items-center justify-between border-b border-neutral-200 rounded-t-2xl">
          <h2 className="text-xl font-bold text-neutral-900">{t("profileMenu.title")}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-neutral-600" strokeWidth={2} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Perfil Padrão */}
          <div className="bg-neutral-50 rounded-xl p-5 border border-neutral-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-primary-50 p-2.5 rounded-lg">
                <Briefcase className="w-5 h-5 text-primary-600" strokeWidth={2.5} />
              </div>
              <h3 className="text-lg font-bold text-neutral-900">{t("profileMenu.defaultProfile")}</h3>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
                  {t("profileMenu.mainInterest")}
                </p>
                <select
                  value={selectedInterest}
                  onChange={(e) => handleInterestChange(e.target.value)}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-action-600 focus:border-transparent transition-all appearance-none bg-white text-neutral-900 text-sm font-medium"
                >
                  {PROFILE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {getOptionLabel(option, currentSavedInterest)}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-neutral-500 mt-2">
                  {t("profileMenu.defaultProfileHint")}
                </p>
              </div>

              {isLoading && (
                <div className="flex items-center justify-center gap-2 text-action-600 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                  <span className="text-sm font-medium">{t("common.saving")}</span>
                </div>
              )}

              {showSuccess && (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                  <CheckCircle className="w-5 h-5" strokeWidth={2} />
                  <span className="text-sm font-medium">{t("profileMenu.defaultProfileUpdated")}</span>
                </div>
              )}
            </div>
          </div>

          {/* Dados Pessoais */}
          <div className="bg-neutral-50 rounded-xl border border-neutral-200 overflow-hidden">
            <button
              onClick={() => setShowPersonalData(!showPersonalData)}
              className="w-full p-5 flex items-center justify-between hover:bg-neutral-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="bg-primary-50 p-2.5 rounded-lg">
                  <User className="w-5 h-5 text-primary-600" strokeWidth={2.5} />
                </div>
                <h3 className="text-lg font-bold text-neutral-900">{t("profileMenu.personalData")}</h3>
              </div>
              <ChevronDown 
                className={`w-5 h-5 text-neutral-500 transition-transform duration-200 ${showPersonalData ? 'rotate-180' : ''}`} 
                strokeWidth={2} 
              />
            </button>

            <div className={`transition-all duration-200 ease-in-out ${showPersonalData ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
              <div className="px-5 pb-5 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">
                    {t("profileMenu.fullName")}
                  </p>
                  <p className="text-sm font-medium text-neutral-900">
                    {profile?.full_name || t("common.notProvided")}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">
                    {t("profileMenu.cpf")}
                  </p>
                  <p className="text-sm font-medium text-neutral-900">
                    {profile?.cpf || t("common.notProvided")}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">
                    {t("profileMenu.birthDate")}
                  </p>
                  <p className="text-sm font-medium text-neutral-900">
                    {profile?.birth_date 
                      ? new Date(profile.birth_date).toLocaleDateString("pt-BR")
                      : t("common.notProvided")}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">
                    {t("profileMenu.phone")}
                  </p>
                  <p className="text-sm font-medium text-neutral-900">
                    {profile?.phone || t("common.notProvided")}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">
                    {t("profileMenu.email")}
                  </p>
                  <p className="text-sm font-medium text-neutral-900">
                    {(profile as any)?.email || t("common.notProvided")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Dados de PIX */}
          <div className="bg-neutral-50 rounded-xl border border-neutral-200 overflow-hidden">
            <button
              onClick={() => setShowPixData(!showPixData)}
              className="w-full p-5 flex items-center justify-between hover:bg-neutral-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="bg-primary-50 p-2.5 rounded-lg">
                  <CreditCard className="w-5 h-5 text-primary-600" strokeWidth={2.5} />
                </div>
                <h3 className="text-lg font-bold text-neutral-900">{t("profileMenu.pixData")}</h3>
              </div>
              <ChevronDown 
                className={`w-5 h-5 text-neutral-500 transition-transform duration-200 ${showPixData ? 'rotate-180' : ''}`} 
                strokeWidth={2} 
              />
            </button>

            <div className={`transition-all duration-200 ease-in-out ${showPixData ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
              <div className="px-5 pb-5 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">
                    {t("profileMenu.pixKey")}
                  </p>
                  <p className="text-sm font-medium text-neutral-900">
                    {profile?.cpf || t("common.notProvided")}
                  </p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800 leading-relaxed">
                    <span className="font-semibold">🔒 {t("profileMenu.security")}:</span> {t("profileMenu.pixSecurityNote")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Idioma / Language */}
          <div className="bg-neutral-50 rounded-xl p-5 border border-neutral-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-primary-50 p-2.5 rounded-lg">
                <Globe className="w-5 h-5 text-primary-600" strokeWidth={2.5} />
              </div>
              <h3 className="text-lg font-bold text-neutral-900">{t("profileMenu.language")}</h3>
            </div>

            <div>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'pt-BR' | 'en-US')}
                className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-action-600 focus:border-transparent transition-all appearance-none bg-white text-neutral-900 text-sm font-medium"
              >
                <option value="pt-BR">🇧🇷 Português (Brasil)</option>
                <option value="en-US">🇺🇸 English (US)</option>
              </select>
              <p className="text-xs text-neutral-500 mt-2">
                {t("profileMenu.languageHint")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
    </Portal>
  );
}
