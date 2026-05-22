import { useState, useRef } from "react";
import { X, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { useTranslation } from "@/react-app/i18n";

interface CommissionAddressModalProps {
  onClose: () => void;
  onComplete: () => void;
  required?: boolean;
}

interface AddressData {
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

export function CommissionAddressModal({ onClose, onComplete, required = false }: CommissionAddressModalProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [attempted, setAttempted] = useState(false);
  
  // Track if mousedown started on backdrop to prevent closing when dragging text selection outside modal
  const mouseDownOnBackdrop = useRef(false);
  
  const [cepDisplay, setCepDisplay] = useState("");
  const [addressData, setAddressData] = useState<AddressData>({
    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
  });

  const formatCEP = (value: string): string => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 5) return numbers;
    return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`;
  };

  const handleCEPChange = async (value: string) => {
    const numbers = value.replace(/\D/g, "");
    setCepDisplay(formatCEP(value));
    setAddressData({ ...addressData, cep: numbers });

    // Auto-fetch address when CEP is complete
    if (numbers.length === 8) {
      setIsFetchingCep(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${numbers}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setAddressData({
            ...addressData,
            cep: numbers,
            street: data.logradouro || "",
            neighborhood: data.bairro || "",
            city: data.localidade || "",
            state: data.uf || "",
          });
        }
      } catch (err) {
        console.error("Error fetching CEP:", err);
      } finally {
        setIsFetchingCep(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    setError(null);

    // Validate required fields
    if (!addressData.cep || !addressData.street || !addressData.number || 
        !addressData.neighborhood || !addressData.city || !addressData.state) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/profile/commission-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(addressData),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || t("commissionAddress.error"));
      }

      setShowSuccess(true);
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setIsLoading(false);
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
                {t("commissionAddress.success")}
              </h2>

              <p className="text-neutral-600 mb-8 leading-relaxed">
                {t("commissionAddress.subtitle")}
              </p>

              <button
                onClick={onComplete}
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
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[300] backdrop-blur-sm"
      onMouseDown={(e) => {
        mouseDownOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        // Only close if both mousedown AND mouseup happened on backdrop
        if (!required && e.target === e.currentTarget && mouseDownOnBackdrop.current) {
          onClose();
        }
        mouseDownOnBackdrop.current = false;
      }}
    >
      <div className="bg-white rounded-3xl shadow-strong w-full max-w-lg max-h-[90vh] overflow-y-auto modal-scroll">
        <div className="sticky top-0 bg-white border-b border-neutral-100 p-6 rounded-t-3xl z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-neutral-900 tracking-tight">
                {t("commissionAddress.title")}
              </h2>
            </div>
            {!required && (
              <button
                onClick={onClose}
                className="text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                <X className="w-6 h-6" strokeWidth={2} />
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          {/* Info Alert */}
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" strokeWidth={2} />
            <div>
              <p className="text-sm text-amber-800 font-medium mb-1">
                {t("commissionAddress.title")}
              </p>
              <p className="text-xs text-amber-700">
                {t("commissionAddress.subtitle")}
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                {t("commissionAddress.cep")}
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={cepDisplay}
                  onChange={(e) => handleCEPChange(e.target.value)}
                  maxLength={9}
                  placeholder="00000-000"
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
                {isFetchingCep && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
                  </div>
                )}
              </div>
              {attempted && !addressData.cep && (
                <p className="text-xs text-red-600 mt-1">{t("errors.requiredField")}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                {t("commissionAddress.street")}
              </label>
              <input
                type="text"
                value={addressData.street}
                onChange={(e) => setAddressData({ ...addressData, street: e.target.value })}
                maxLength={200}
                placeholder="Nome da rua"
                className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
              {attempted && !addressData.street && (
                <p className="text-xs text-red-600 mt-1">{t("errors.requiredField")}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  {t("commissionAddress.number")}
                </label>
                <input
                  type="text"
                  value={addressData.number}
                  onChange={(e) => setAddressData({ ...addressData, number: e.target.value })}
                  maxLength={20}
                  placeholder="123"
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
                {attempted && !addressData.number && (
                  <p className="text-xs text-red-600 mt-1">{t("errors.requiredField")}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  {t("commissionAddress.complement")}
                </label>
                <input
                  type="text"
                  value={addressData.complement}
                  onChange={(e) => setAddressData({ ...addressData, complement: e.target.value })}
                  maxLength={100}
                  placeholder="Apto, bloco..."
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                {t("commissionAddress.neighborhood")}
              </label>
              <input
                type="text"
                value={addressData.neighborhood}
                onChange={(e) => setAddressData({ ...addressData, neighborhood: e.target.value })}
                maxLength={100}
                placeholder="Nome do bairro"
                className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
              {attempted && !addressData.neighborhood && (
                <p className="text-xs text-red-600 mt-1">{t("errors.requiredField")}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  {t("commissionAddress.city")}
                </label>
                <input
                  type="text"
                  value={addressData.city}
                  onChange={(e) => setAddressData({ ...addressData, city: e.target.value })}
                  maxLength={100}
                  placeholder="Cidade"
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
                {attempted && !addressData.city && (
                  <p className="text-xs text-red-600 mt-1">{t("errors.requiredField")}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  {t("commissionAddress.state")}
                </label>
                <select
                  value={addressData.state}
                  onChange={(e) => setAddressData({ ...addressData, state: e.target.value })}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all appearance-none bg-white"
                >
                  <option value="">{t("common.select")}</option>
                  <option value="AC">AC</option>
                  <option value="AL">AL</option>
                  <option value="AP">AP</option>
                  <option value="AM">AM</option>
                  <option value="BA">BA</option>
                  <option value="CE">CE</option>
                  <option value="DF">DF</option>
                  <option value="ES">ES</option>
                  <option value="GO">GO</option>
                  <option value="MA">MA</option>
                  <option value="MT">MT</option>
                  <option value="MS">MS</option>
                  <option value="MG">MG</option>
                  <option value="PA">PA</option>
                  <option value="PB">PB</option>
                  <option value="PR">PR</option>
                  <option value="PE">PE</option>
                  <option value="PI">PI</option>
                  <option value="RJ">RJ</option>
                  <option value="RN">RN</option>
                  <option value="RS">RS</option>
                  <option value="RO">RO</option>
                  <option value="RR">RR</option>
                  <option value="SC">SC</option>
                  <option value="SP">SP</option>
                  <option value="SE">SE</option>
                  <option value="TO">TO</option>
                </select>
                {attempted && !addressData.state && (
                  <p className="text-xs text-red-600 mt-1">{t("errors.requiredField")}</p>
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
                  {t("commissionAddress.saving")}
                </>
              ) : (
                t("commissionAddress.save")
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
