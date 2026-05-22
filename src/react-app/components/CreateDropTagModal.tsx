import { useState, useEffect, useRef } from "react";
import { Portal } from "./Portal";
import { useApi } from "@/react-app/hooks/useApi";
import { useTranslation } from "@/react-app/i18n";
import { X, Loader2, MapPin, Package, ArrowRight, ArrowLeft, Key } from "lucide-react";
import type { CreateDropTagInput, Address, DropTag } from "@/shared/types";
import { toProperCase } from "@/react-app/lib/utils";

interface CreateDropTagModalProps {
  onClose: () => void;
  onSuccess: () => void;
  existingDropTag?: DropTag | null;
  allDropTags?: DropTag[];
}

export function CreateDropTagModal({ onClose, onSuccess, existingDropTag, allDropTags = [] }: CreateDropTagModalProps) {
  const { t } = useTranslation();
  const { createDropTag, updateDropTag, fetchAddresses, fetchNearbyHubs, isLoading, error } = useApi();
  const [attempted, setAttempted] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [nearbyHubs, setNearbyHubs] = useState<any[]>([]);
  const [loadingHubs, setLoadingHubs] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedRadius, setSelectedRadius] = useState(500);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTrackingCode, setShowTrackingCode] = useState(!!existingDropTag?.tracking_code);
  const [showSecretWord, setShowSecretWord] = useState(!!existingDropTag?.secret_word);
  const modalBottomRef = useRef<HTMLDivElement>(null);
  
  const [dropTagData, setDropTagData] = useState<CreateDropTagInput>({
    title: existingDropTag?.title || "",
    tracking_code: existingDropTag?.tracking_code || "",
    address_id: existingDropTag?.address_id || 0,
    secret_word: existingDropTag?.secret_word || "",
    notes: existingDropTag?.notes || "",
    authorized_receivers: [],
  });

  useEffect(() => {
    loadAddresses();
  }, []);

  useEffect(() => {
    if (step === 2 && dropTagData.address_id) {
      loadNearbyHubs();
    }
  }, [step, dropTagData.address_id, selectedRadius]);

  useEffect(() => {
    if (termsAccepted && modalBottomRef.current) {
      modalBottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [termsAccepted]);

  const loadAddresses = async () => {
    setLoadingAddresses(true);
    const data = await fetchAddresses();
    const consumerAddresses = data.filter(a => a.address_type === "consumer");
    setAddresses(consumerAddresses);
    
    // Auto-select first address if only one exists AND it's not blocked
    if (consumerAddresses.length === 1) {
      const addressHasDropTagWithoutTracking = allDropTags.some(
        dt => dt.address_id === consumerAddresses[0].id && 
             dt.status === "created" && 
             (!dt.tracking_code || dt.tracking_code.trim() === "") &&
             (!existingDropTag || dt.id !== existingDropTag.id)
      );
      
      if (!addressHasDropTagWithoutTracking) {
        setDropTagData(prev => ({ ...prev, address_id: consumerAddresses[0].id }));
      }
    }
    
    setLoadingAddresses(false);
  };

  const loadNearbyHubs = async () => {
    if (!dropTagData.address_id) return;
    
    setLoadingHubs(true);
    const hubs = await fetchNearbyHubs(dropTagData.address_id, selectedRadius);
    setNearbyHubs(hubs);
    setLoadingHubs(false);
  };

  const handleNextStep = () => {
    setAttempted(true);
    
    // Validação da etapa 1 - título e endereço são obrigatórios
    if (!dropTagData.title || !dropTagData.address_id) {
      return;
    }
    
    // Validação do código de rastreio se fornecido
    if (dropTagData.tracking_code && dropTagData.tracking_code.trim() !== "") {
      const trackingCodeRegex = /^[A-Z]{2}\d{9}[A-Z]{2}$/;
      if (!trackingCodeRegex.test(dropTagData.tracking_code)) {
        return;
      }
    }
    
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = existingDropTag
      ? await updateDropTag(existingDropTag.id, dropTagData)
      : await createDropTag(dropTagData);
    
    if (result) {
      onSuccess();
    }
  };

  const radiusOptions = [100, 200, 500, 1000];

  return (
    <Portal>
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[300] backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-strong w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-neutral-100 p-6 flex items-center justify-between rounded-t-3xl z-10">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">
              {existingDropTag ? t("droptag.editDropTag") : t("droptag.newDropTag")}
            </h2>
            <p className="text-sm text-neutral-500 mt-1">
              {t("common.stepOf", { current: step, total: 2 })}
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
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          {loadingAddresses ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-primary-600 animate-spin" strokeWidth={2} />
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {step === 1 && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">
                      {t("droptag.productTitle")}
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <Package className="w-5 h-5 text-neutral-400" strokeWidth={2} />
                      </div>
                      <input
                        type="text"
                        value={dropTagData.title}
                        onChange={(e) => setDropTagData({ ...dropTagData, title: e.target.value })}
                        placeholder={t("droptag.productTitlePlaceholder")}
                        maxLength={50}
                        className="w-full pl-11 pr-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      />
                    </div>
                    {attempted && !dropTagData.title && (
                      <p className="text-xs text-red-600 mt-1">* {t("common.required")}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">
                      {t("droptag.deliveryAddress")}
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <MapPin className="w-5 h-5 text-neutral-400" strokeWidth={2} />
                      </div>
                      <select
                        value={dropTagData.address_id || ""}
                        onChange={(e) => setDropTagData({ ...dropTagData, address_id: Number(e.target.value) })}
                        className="w-full pl-11 pr-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all appearance-none bg-white"
                      >
                        <option value="">{t("droptag.selectAddress")}</option>
                        {addresses.map((address) => {
                          // Check if this address has a droptag without tracking code
                          const hasDropTagWithoutTracking = allDropTags.some(
                            dt => dt.address_id === address.id && 
                                 dt.status === "created" && 
                                 (!dt.tracking_code || dt.tracking_code.trim() === "") &&
                                 (!existingDropTag || dt.id !== existingDropTag.id)
                          );
                          
                          return (
                            <option 
                              key={address.id} 
                              value={address.id}
                              disabled={hasDropTagWithoutTracking}
                            >
                              {address.nickname} - {address.street}, {address.number}, {address.city}
                              {hasDropTagWithoutTracking ? ` (${t("droptag.addressBlocked")})` : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    {attempted && !dropTagData.address_id && (
                      <p className="text-xs text-red-600 mt-1">* {t("common.required")}</p>
                    )}
                    {addresses.length > 1 && allDropTags.some(dt => 
                      dt.status === "created" && 
                      (!dt.tracking_code || dt.tracking_code.trim() === "") &&
                      (!existingDropTag || dt.id !== existingDropTag.id)
                    ) && (
                      <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                        <p className="text-xs text-amber-800">
                          {t("droptag.addressBlockedHint")}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className={`p-4 rounded-xl border-2 transition-all ${showTrackingCode ? 'border-blue-300 bg-blue-50' : 'border-neutral-200 bg-neutral-50'}`}>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showTrackingCode}
                        onChange={(e) => {
                          setShowTrackingCode(e.target.checked);
                          if (!e.target.checked) {
                            setDropTagData({ ...dropTagData, tracking_code: "" });
                          }
                        }}
                        className="w-5 h-5 text-blue-600 border-neutral-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-blue-600" />
                        <span className="text-sm font-semibold text-neutral-700">
                          {t("droptag.addTrackingCode")} <span className="text-neutral-500 font-normal">({t("common.optional")})</span>
                        </span>
                      </div>
                    </label>
                    
                    <div className={`grid transition-all duration-300 ease-in-out ${showTrackingCode ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0'}`}>
                      <div className="overflow-hidden">
                        <div>
                          <input
                            type="text"
                            value={dropTagData.tracking_code || ""}
                            onChange={(e) => setDropTagData({ ...dropTagData, tracking_code: e.target.value.toUpperCase() })}
                            placeholder="AA123456789BR"
                            maxLength={13}
                            className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono transition-all bg-white"
                          />
                          {attempted && dropTagData.tracking_code && dropTagData.tracking_code.trim() !== "" && !/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(dropTagData.tracking_code) && (
                            <p className="text-xs text-red-600 mt-1">{t("droptag.invalidTrackingCode")}</p>
                          )}
                          <p className="text-xs text-neutral-500 mt-1">
                            {t("droptag.trackingCodeFormat")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`p-4 rounded-xl border-2 transition-all ${showSecretWord ? 'border-violet-300 bg-violet-50' : 'border-neutral-200 bg-neutral-50'}`}>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showSecretWord}
                        onChange={(e) => {
                          setShowSecretWord(e.target.checked);
                          if (!e.target.checked) {
                            setDropTagData({ ...dropTagData, secret_word: "" });
                          }
                        }}
                        className="w-5 h-5 text-violet-600 border-neutral-300 rounded focus:ring-2 focus:ring-violet-500"
                      />
                      <div className="flex items-center gap-2">
                        <Key className="w-5 h-5 text-violet-600" />
                        <span className="text-sm font-semibold text-neutral-700">
                          {t("droptag.addSecretWord")} <span className="text-neutral-500 font-normal">({t("common.optional")})</span>
                        </span>
                      </div>
                    </label>
                    
                    <div className={`grid transition-all duration-300 ease-in-out ${showSecretWord ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0'}`}>
                      <div className="overflow-hidden">
                        <div>
                          <input
                            type="text"
                            value={dropTagData.secret_word || ""}
                            onChange={(e) => setDropTagData({ ...dropTagData, secret_word: e.target.value.toUpperCase() })}
                            maxLength={20}
                            className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all uppercase bg-white"
                          />
                          <p className="text-xs text-neutral-500 mt-2">
                            {t("droptag.secretWordHint")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">
                      {t("droptag.notes")} <span className="text-neutral-500 font-normal">({t("common.optional")})</span>
                    </label>
                    <textarea
                      value={dropTagData.notes || ""}
                      onChange={(e) => setDropTagData({ ...dropTagData, notes: e.target.value })}
                      placeholder={t("droptag.notesPlaceholder")}
                      rows={3}
                      maxLength={200}
                      className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none transition-all"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="w-full bg-action-600 hover:bg-action-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-sm active:scale-95"
                  >
                    {t("droptag.choosePoints")}
                    <ArrowRight className="w-5 h-5" strokeWidth={2} />
                  </button>
                </>
              )}

              {step === 2 && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-3">
                      {t("droptag.searchRadius")}
                    </label>
                    <select
                      value={selectedRadius}
                      onChange={(e) => setSelectedRadius(Number(e.target.value))}
                      className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all appearance-none bg-white"
                    >
                      {radiusOptions.map((radius) => (
                        <option key={radius} value={radius}>
                          {radius} {t("droptag.meters")}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-semibold text-neutral-700">
                        {t("droptag.availablePoints")}
                      </label>
                      <span className="text-sm font-semibold text-primary-600">
                        {nearbyHubs.length} {t("droptag.found")}
                      </span>
                    </div>

                    {loadingHubs ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 text-primary-600 animate-spin" strokeWidth={2} />
                      </div>
                    ) : nearbyHubs.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-100 rounded-2xl mb-4">
                          <MapPin className="w-8 h-8 text-neutral-400" strokeWidth={2} />
                        </div>
                        <p className="text-neutral-600 mb-2">
                          {t("droptag.noActivePoints")}
                        </p>
                        <p className="text-sm text-neutral-500">
                          {t("droptag.tryIncreaseRadius")}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {nearbyHubs.map((hub) => (
                          <label
                            key={hub.receiver_key}
                            className="flex items-start gap-3 p-4 bg-neutral-50 border border-neutral-200 rounded-xl hover:bg-neutral-100 hover:border-neutral-300 transition-all cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={dropTagData.authorized_receivers?.includes(hub.receiver_key)}
                              onChange={(e) => {
                                const current = dropTagData.authorized_receivers || [];
                                const updated = e.target.checked
                                  ? [...current, hub.receiver_key]
                                  : current.filter(key => key !== hub.receiver_key);
                                setDropTagData({ ...dropTagData, authorized_receivers: updated });
                              }}
                              className="mt-1 w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-2 focus:ring-primary-500"
                            />
                            <div className="flex-1">
                              <div className="flex items-start justify-between mb-1">
                                <div>
                                  <div className="font-semibold text-neutral-900">{toProperCase(hub.name)}</div>
                                  <div className="text-sm text-neutral-600 mt-0.5">{hub.address}</div>
                                  <div className="text-xs text-neutral-500 mt-1">{hub.city} - {hub.state}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                                  <span className="font-normal text-primary-600">{t("droptag.distance")}:</span> {hub.distance}m
                                </span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                  <span className="font-normal text-emerald-600">{t("droptag.price")}:</span> R$ {(hub.service_price ?? 10).toFixed(2).replace('.', ',')}
                                </span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700">
                                  <span className="font-normal text-neutral-500">{t("droptag.deliveries")}:</span> {hub.deliveries}
                                </span>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {nearbyHubs.length === 0 && (
                    <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                      <p className="text-sm text-amber-800 font-medium">
                        {t("droptag.cannotCreateWithoutPoints")}
                      </p>
                    </div>
                  )}

                  {nearbyHubs.length > 0 && (!dropTagData.authorized_receivers || dropTagData.authorized_receivers.length === 0) && (
                    <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                      <p className="text-sm text-amber-800 font-medium">
                        {t("droptag.selectAtLeastOnePoint")}
                      </p>
                    </div>
                  )}

                  {dropTagData.authorized_receivers && dropTagData.authorized_receivers.length > 15 && (
                    <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                      <p className="text-sm text-amber-800 font-medium">
                        {t("droptag.maxPointsExceeded", { count: dropTagData.authorized_receivers.length })}
                      </p>
                    </div>
                  )}

                  {dropTagData.authorized_receivers && dropTagData.authorized_receivers.length > 0 && dropTagData.authorized_receivers.length <= 15 && (
                    <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={termsAccepted}
                          onChange={(e) => setTermsAccepted(e.target.checked)}
                          className="mt-1 w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-2 focus:ring-primary-500"
                        />
                        <div className="flex-1">
                          <p className="text-sm text-blue-900 font-semibold mb-2">
                            {t("droptag.termsTitle")}
                          </p>
                          <p className="text-xs text-blue-800 leading-relaxed">
                            {t("droptag.termsContent")}
                          </p>
                        </div>
                      </label>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 active:scale-95"
                    >
                      <ArrowLeft className="w-5 h-5" strokeWidth={2} />
                      {t("common.back")}
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading || nearbyHubs.length === 0 || !dropTagData.authorized_receivers || dropTagData.authorized_receivers.length === 0 || dropTagData.authorized_receivers.length > 15 || !termsAccepted}
                      className="flex-1 bg-action-600 hover:bg-action-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm active:scale-95"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
                          {existingDropTag ? t("droptag.updating") : t("droptag.creating")}
                        </>
                      ) : (
                        existingDropTag ? t("droptag.updateDropTag") : t("droptag.createDropTag")
                      )}
                    </button>
                  </div>
                  <div ref={modalBottomRef}></div>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
    </Portal>
  );
}
