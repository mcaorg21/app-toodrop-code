import { useState } from "react";
import { useApi } from "@/react-app/hooks/useApi";
import { useTranslation } from "@/react-app/i18n";
import { X, Loader2 } from "lucide-react";
import type { AddressInput, Address } from "@/shared/types";
import { Portal } from "./Portal";

// Helper function for CEP masking
const formatCEP = (value: string): string => {
  const numbers = value.replace(/\D/g, "");
  if (numbers.length <= 5) return numbers;
  return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`;
};

interface AddressModalProps {
  type: "consumer" | "receiver";
  onClose: () => void;
  onSuccess: () => void;
  existingAddress?: Address | null;
  profile?: any;
}

export function AddressModal({ type, onClose, onSuccess, existingAddress, profile }: AddressModalProps) {
  const { t } = useTranslation();
  const { createAddress, updateAddress, isLoading, error } = useApi();
  const [fetchingCep, setFetchingCep] = useState(false);
  const [cepDisplay, setCepDisplay] = useState(
    existingAddress ? formatCEP(existingAddress.cep) : ""
  );
  const [attempted, setAttempted] = useState(false);
  const [useCommissionAddress, setUseCommissionAddress] = useState(false);
  
  const [addressData, setAddressData] = useState<AddressInput>({
    nickname: existingAddress?.nickname || "",
    cep: existingAddress?.cep || "",
    street: existingAddress?.street || "",
    number: existingAddress?.number || "",
    complement: existingAddress?.complement || "",
    neighborhood: existingAddress?.neighborhood || "",
    city: existingAddress?.city || "",
    state: existingAddress?.state || "",
    address_type: type,
  });

  const fetchAddressByCep = async (cep: string) => {
    if (cep.length !== 8) return;
    
    setFetchingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        setAddressData(prev => ({
          ...prev,
          street: data.logradouro || "",
          neighborhood: data.bairro || "",
          city: data.localidade || "",
          state: data.uf || "",
        }));
      }
    } catch (err) {
      console.error("Erro ao buscar CEP:", err);
    } finally {
      setFetchingCep(false);
    }
  };

  const handleCepChange = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    setCepDisplay(formatCEP(value));
    setAddressData({ ...addressData, cep: numbers });
    
    if (numbers.length === 8) {
      fetchAddressByCep(numbers);
    }
  };

  const handleUseCommissionAddress = (checked: boolean) => {
    setUseCommissionAddress(checked);
    
    if (checked && profile) {
      const commissionData = {
        nickname: addressData.nickname,
        cep: (profile.commission_cep && profile.commission_cep !== "null") ? profile.commission_cep : "",
        street: (profile.commission_street && profile.commission_street !== "null") ? profile.commission_street : "",
        number: (profile.commission_number && profile.commission_number !== "null") ? profile.commission_number : "",
        complement: (profile.commission_complement && profile.commission_complement !== "null") ? profile.commission_complement : "",
        neighborhood: (profile.commission_neighborhood && profile.commission_neighborhood !== "null") ? profile.commission_neighborhood : "",
        city: (profile.commission_city && profile.commission_city !== "null") ? profile.commission_city : "",
        state: (profile.commission_state && profile.commission_state !== "null") ? profile.commission_state : "",
        address_type: type,
      };
      setAddressData(commissionData);
      setCepDisplay(formatCEP((profile.commission_cep && profile.commission_cep !== "null") ? profile.commission_cep : ""));
    } else if (!checked) {
      // Reset to empty if unchecked
      setAddressData({
        nickname: addressData.nickname,
        cep: "",
        street: "",
        number: "",
        complement: "",
        neighborhood: "",
        city: "",
        state: "",
        address_type: type,
      });
      setCepDisplay("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    
    // Validação manual
    if (!addressData.nickname || !addressData.cep || !addressData.street || 
        !addressData.number || !addressData.complement || !addressData.neighborhood || !addressData.city || !addressData.state) {
      return;
    }
    
    const result = existingAddress 
      ? await updateAddress(existingAddress.id, addressData)
      : await createAddress(addressData);
    
    if (result) {
      onSuccess();
    }
  };

  return (
    <Portal>
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[300] backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-strong w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-neutral-100 p-6 flex items-center justify-between rounded-t-3xl z-10">
          <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">
            {type === "receiver" 
              ? (existingAddress ? t("address.editPoint") : t("address.addPoint"))
              : (existingAddress ? t("address.editAddress") : t("address.addAddress"))
            }
          </h2>
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

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Commission address checkbox - only show for receiver type and if user has commission address */}
            {type === "receiver" && profile?.commission_cep && profile?.commission_cep !== "null" && !existingAddress && (
              <div className="p-4 bg-primary-50 border border-primary-200 rounded-xl">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCommissionAddress}
                    onChange={(e) => handleUseCommissionAddress(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-primary-600 border-primary-300 rounded focus:ring-2 focus:ring-primary-500"
                  />
                  <div>
                    <span className="text-sm font-semibold text-primary-900">
                      {t("address.useCommissionAddress")}
                    </span>
                    <p className="text-xs text-primary-700 mt-1">
                      {t("address.useCommissionAddressDesc")}
                    </p>
                  </div>
                </label>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                {t("address.nickname")}
              </label>
              <input
                type="text"
                value={addressData.nickname}
                onChange={(e) => setAddressData({ ...addressData, nickname: e.target.value })}
                placeholder={t("address.nicknamePlaceholder")}
                className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
              {attempted && !addressData.nickname && (
                <p className="text-xs text-red-600 mt-1">* {t("common.required")}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                {t("address.cep")}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={cepDisplay}
                  onChange={(e) => handleCepChange(e.target.value)}
                  maxLength={9}
                  placeholder="00000-000"
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
                {fetchingCep && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-5 h-5 text-primary-600 animate-spin" strokeWidth={2} />
                  </div>
                )}
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                {t("address.cepHint")}
              </p>
              {attempted && !addressData.cep && (
                <p className="text-xs text-red-600 mt-1">* {t("common.required")}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  {t("address.street")}
                </label>
                <input
                  type="text"
                  value={addressData.street}
                  onChange={(e) => setAddressData({ ...addressData, street: e.target.value })}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
                {attempted && !addressData.street && (
                  <p className="text-xs text-red-600 mt-1">* {t("common.required")}</p>
                )}
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  {t("address.number")}
                </label>
                <input
                  type="text"
                  value={addressData.number}
                  onChange={(e) => setAddressData({ ...addressData, number: e.target.value })}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
                {attempted && !addressData.number && (
                  <p className="text-xs text-red-600 mt-1">* {t("common.required")}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                {t("address.complement")}
              </label>
              <input
                type="text"
                value={addressData.complement}
                onChange={(e) => setAddressData({ ...addressData, complement: e.target.value })}
                placeholder={t("address.complementPlaceholder")}
                className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
              {attempted && !addressData.complement && (
                <p className="text-xs text-red-600 mt-1">* {t("common.required")}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                {t("address.neighborhood")}
              </label>
              <input
                type="text"
                value={addressData.neighborhood}
                onChange={(e) => setAddressData({ ...addressData, neighborhood: e.target.value })}
                className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
              {attempted && !addressData.neighborhood && (
                <p className="text-xs text-red-600 mt-1">* {t("common.required")}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  {t("address.city")}
                </label>
                <input
                  type="text"
                  value={addressData.city}
                  onChange={(e) => setAddressData({ ...addressData, city: e.target.value })}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
                {attempted && !addressData.city && (
                  <p className="text-xs text-red-600 mt-1">* {t("common.required")}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  {t("address.state")}
                </label>
                <input
                  type="text"
                  value={addressData.state}
                  onChange={(e) => setAddressData({ ...addressData, state: e.target.value.toUpperCase() })}
                  maxLength={2}
                  placeholder="SP"
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
                {attempted && !addressData.state && (
                  <p className="text-xs text-red-600 mt-1">* {t("common.required")}</p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-action-600 hover:bg-action-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm active:scale-95"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
                  {existingAddress ? t("address.updating") : t("address.saving")}
                </>
              ) : (
                type === "receiver"
                  ? (existingAddress ? t("address.updatePoint") : t("address.savePoint"))
                  : (existingAddress ? t("address.updateAddress") : t("address.saveAddress"))
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
    </Portal>
  );
}
