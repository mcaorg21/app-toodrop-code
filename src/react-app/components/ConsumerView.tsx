import { useState, useEffect } from "react";
import { useApi } from "@/react-app/hooks/useApi";
import { useTranslation } from "@/react-app/i18n";
import type { User, Address, DropTag } from "@/shared/types";
import { Plus, MapPin, Package, Loader2, Edit2, Trash2, ChevronDown, ChevronUp, Tag, Sparkles, ArrowRight, X, RefreshCw, Gift } from "lucide-react";
import { AddressModal } from "./AddressModal";
import { CreateDropTagModal } from "./CreateDropTagModal";
import { DropTagCard } from "./DropTagCard";
import { AlertModal } from "./AlertModal";
import { TourModal, useTour, getConsumerTourSteps } from "./TourModal";
import { Portal } from "./Portal";
import { ReferralModal } from "./ReferralModal";

interface ConsumerViewProps {
  profile: User | null;
  onProfileUpdate: () => void;
  isActiveTab?: boolean;
  onShowProfileSwitch?: () => void;
}

export function ConsumerView({ profile, onProfileUpdate, isActiveTab = true, onShowProfileSwitch }: ConsumerViewProps) {
  const { fetchAddresses, fetchDropTags, deleteAddress, deleteDropTag, isLoading } = useApi();
  const { t } = useTranslation();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [dropTags, setDropTags] = useState<DropTag[]>([]);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showDropTagModal, setShowDropTagModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [editingDropTag, setEditingDropTag] = useState<DropTag | null>(null);
  const [deletingAddressId, setDeletingAddressId] = useState<number | null>(null);
  const [deletingDropTagId, setDeletingDropTagId] = useState<number | null>(null);

  const [showTrackingCodeAlert, setShowTrackingCodeAlert] = useState(false);
  const [showLinkedDropTagsAlert, setShowLinkedDropTagsAlert] = useState(false);
  const [linkedDropTagsCount, setLinkedDropTagsCount] = useState(0);
  const [isAddressesSectionExpanded, setIsAddressesSectionExpanded] = useState(false);
  const [isDropTagsSectionExpanded, setIsDropTagsSectionExpanded] = useState(false);
  const [scanResultMessage, setScanResultMessage] = useState<{ success: boolean; message: string } | null>(null);
  // Only show tour if user's main interest is consumer
  const shouldShowTour = profile?.main_interest === "consumer";
  const [showTour, closeTour] = useTour("consumer", profile);
  const [dropTagStatusFilter, setDropTagStatusFilter] = useState<"all" | "awaiting_pickup" | "created" | "completed">("all");
  const [isNewDropTagSectionExpanded, setIsNewDropTagSectionExpanded] = useState(false);
  
  const [isWhatIsDropTagExpanded, setIsWhatIsDropTagExpanded] = useState(false);

  // Fullscreen view states
  type FullScreenView = "addresses" | "create-droptag" | "droptags";
  const [fullScreenView, setFullScreenView] = useState<FullScreenView | null>(null);
  const [isViewAnimating, setIsViewAnimating] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [addressesData, dropTagsData] = await Promise.all([
      fetchAddresses(),
      fetchDropTags(),
    ]);
    setAddresses(addressesData.filter(a => a.address_type === "consumer"));
    setDropTags(dropTagsData);
  };

  const handleAddressAdded = () => {
    setShowAddressModal(false);
    setEditingAddress(null);
    loadData();
    onProfileUpdate();
  };

  const handleEditAddress = (address: Address) => {
    // Check if there are any droptags linked to this address
    const linkedDropTags = dropTags.filter(dt => dt.address_id === address.id);
    
    if (linkedDropTags.length > 0) {
      setLinkedDropTagsCount(linkedDropTags.length);
      setShowLinkedDropTagsAlert(true);
      return;
    }
    
    setEditingAddress(address);
    setShowAddressModal(true);
  };

  const handleDropTagCreated = () => {
    setShowDropTagModal(false);
    setEditingDropTag(null);
    loadData();
    // Navigate to droptags list view
    setTimeout(() => {
      setFullScreenView("droptags");
      setTimeout(() => setIsViewAnimating(true), 10);
    }, 300);
  };

  const handleEditDropTag = (dropTag: DropTag) => {
    setEditingDropTag(dropTag);
    setShowDropTagModal(true);
  };

  const handleDeleteDropTag = async () => {
    if (!deletingDropTagId) return;
    const success = await deleteDropTag(deletingDropTagId);
    if (success) {
      setDeletingDropTagId(null);
      loadData();
    }
  };

  const handleDeleteAddress = async () => {
    if (!deletingAddressId) return;
    const success = await deleteAddress(deletingAddressId);
    if (success) {
      setDeletingAddressId(null);
      loadData();
      onProfileUpdate();
    }
  };

  const consumerAddresses = addresses.filter(a => a.address_type === "consumer");
  const canAddAddress = consumerAddresses.length < 10;

  const handleQRCodeScan = async (qrData: string) => {
    try {
      // Parse QR code data
      const data = JSON.parse(qrData);
      const { receiver_key, droptag_id, driver_user_id } = data;
      
      // Call backend to process the delivery
      const response = await fetch('/api/receiver/scan-delivery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          receiver_key,
          droptag_id,
          driver_user_id,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Build success message
        let message = 'Entrega registrada com sucesso! O pacote foi adicionado às suas entregas.';
        
        if (result.secret_word) {
          message = `Entrega registrada com sucesso!\n\nPalavra Secreta: ${result.secret_word}\n\nO pacote foi adicionado às suas entregas.`;
        }
        
        // Show success message
        setScanResultMessage({
          success: true,
          message: message,
        });
        
        // Reload droptags
        loadData();
      } else {
        const error = await response.json();
        setScanResultMessage({
          success: false,
          message: error.error || 'Erro ao processar QR Code',
        });
      }
    } catch (error) {
      console.error('Error scanning QR code:', error);
      setScanResultMessage({
        success: false,
        message: 'QR Code inválido ou erro ao processar',
      });
    }
  };

  const hasAddress = consumerAddresses.length > 0;
  const hasAwaitingPickup = dropTags.some(dt => dt.status === 'awaiting_pickup');

  const iconGridItems: Array<{
    id: FullScreenView | "profile-switch" | "referral";
    icon: any;
    label: string;
    sublabel: string;
    enabled: boolean;
    badge?: boolean;
    badgeColor?: 'green' | 'red' | 'yellow';
    isProfileSwitch?: boolean;
    isReferral?: boolean;
  }> = [
    {
      id: "addresses" as const,
      icon: MapPin,
      label: t("consumer.addresses"),
      sublabel: `${consumerAddresses.length} ${consumerAddresses.length === 1 ? t("consumer.registered") : t("consumer.registeredPlural")}`,
      enabled: true,
      badge: !hasAddress,
      badgeColor: 'red' as const,
    },
    {
      id: "create-droptag" as const,
      icon: Tag,
      label: t("consumer.newDroptag"),
      sublabel: t("consumer.createLabel"),
      enabled: true,
    },
    {
      id: "droptags" as const,
      icon: Package,
      label: t("consumer.droptags"),
      sublabel: `${dropTags.length} ${dropTags.length === 1 ? t("consumer.created") : t("consumer.createdPlural")}`,
      enabled: true,
      badge: hasAwaitingPickup,
      badgeColor: 'yellow' as const,
    },
    {
      id: "referral",
      icon: Gift,
      label: t("consumer.referral"),
      sublabel: t("consumer.referralAmount"),
      enabled: true,
      isReferral: true,
    },
    {
      id: "profile-switch",
      icon: RefreshCw,
      label: t("consumer.changeProfile"),
      sublabel: t("consumer.currentProfile"),
      enabled: true,
      isProfileSwitch: true,
    },
  ];

  const closeFullScreenView = () => {
    setIsViewAnimating(false);
    setTimeout(() => setFullScreenView(null), 300);
  };

  return (
    <div className="space-y-4">
      {/* Icon Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
        {iconGridItems.map((item) => {
          const Icon = item.icon;
          const isDisabled = !item.enabled;
          
          return (
            <button
              key={item.id}
              onClick={() => {
                if (isDisabled) return;
                if (item.isProfileSwitch) {
                  onShowProfileSwitch?.();
                  return;
                }
                if ((item as any).isReferral) {
                  setShowReferralModal(true);
                  return;
                }
                // Reload data when opening droptags view
                if (item.id === "droptags") {
                  loadData();
                }
                setFullScreenView(item.id as FullScreenView);
                setTimeout(() => setIsViewAnimating(true), 10);
              }}
              disabled={isDisabled}
              className={`relative group ${
                isDisabled 
                  ? 'opacity-40 cursor-not-allowed' 
                  : 'cursor-pointer'
              }`}
            >
              <div className={`bg-white rounded-2xl shadow-soft p-6 transition-all duration-200 ${
                !isDisabled && 'hover:shadow-lg hover:scale-105 active:scale-100'
              }`}>
                <div className="relative mb-4">
                  <Icon className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 text-neutral-600 mx-auto" strokeWidth={2} />
                  
                  {item.badge && (
                    <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white animate-pulse ${
                      item.badgeColor === 'green' ? 'bg-green-500' : 
                      item.badgeColor === 'yellow' ? 'bg-amber-500' : 
                      'bg-red-500'
                    }`} />
                  )}
                </div>
                
                <div className="text-center">
                  <div className="font-semibold text-neutral-900 mb-1">{item.label}</div>
                  <div className="text-xs text-neutral-500">{item.sublabel}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Fullscreen Views */}
      {fullScreenView && (
        <Portal>
          <div className={`fixed inset-0 bg-black/50 z-[100] transition-opacity duration-300 ${
            isViewAnimating ? 'opacity-100' : 'opacity-0'
          }`} onClick={closeFullScreenView} />
          
          <div className={`fixed inset-0 bg-white z-[150] transition-transform duration-300 ${
            isViewAnimating ? 'translate-y-0' : 'translate-y-full'
          }`}>
            <div className={`h-full flex flex-col transition-transform duration-300 ${isViewAnimating ? 'translate-y-0' : 'translate-y-8'}`}>
              {/* Fixed Header */}
              <div className="sticky top-0 bg-white border-b border-neutral-200 z-10 shadow-sm">
                <div className="max-w-4xl mx-auto flex items-center justify-between p-4">
                  <h2 className="text-xl font-bold text-neutral-900">
                    {fullScreenView === "addresses" && t("consumer.addresses")}
                    {fullScreenView === "create-droptag" && t("consumer.newDroptag")}
                    {fullScreenView === "droptags" && t("consumer.myDroptags")}
                  </h2>
                  <button
                    onClick={closeFullScreenView}
                    className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6 text-neutral-600" strokeWidth={2} />
                  </button>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto">
              {fullScreenView === "addresses" && (
                <div className="max-w-4xl mx-auto p-6 space-y-4">
                  {isLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="w-6 h-6 text-primary-600 animate-spin" strokeWidth={2} />
                    </div>
                  ) : consumerAddresses.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-100 rounded-2xl mb-4">
                        <MapPin className="w-8 h-8 text-neutral-400" strokeWidth={2} />
                      </div>
                      <p className="text-neutral-600 mb-6">{t("consumer.noAddresses")}</p>
                      <button
                        onClick={() => setShowAddressModal(true)}
                        className="bg-action-600 hover:bg-action-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 active:scale-95"
                      >
                        {t("consumer.addAddress")}
                      </button>
                    </div>
                  ) : (
                    <>
                      {canAddAddress && (
                        <button
                          onClick={() => setShowAddressModal(true)}
                          className="w-full bg-action-600 hover:bg-action-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 active:scale-95 mb-4 flex items-center justify-center gap-2"
                        >
                          <Plus className="w-5 h-5" strokeWidth={2} />
                          {t("consumer.addAddress")}
                        </button>
                      )}
                      <div className="space-y-3">
                        {consumerAddresses.map((address) => (
                          <div
                            key={address.id}
                            className="bg-neutral-50 border border-neutral-200 rounded-xl p-5 hover:bg-neutral-100 transition-all duration-200"
                          >
                          <div className="flex items-start justify-between mb-2">
                            <div className="font-semibold text-neutral-900">{address.nickname}</div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEditAddress(address)}
                                className="text-primary-600 hover:text-primary-700 transition-colors p-1"
                                title="Editar endereço"
                              >
                                <Edit2 className="w-4 h-4" strokeWidth={2} />
                              </button>
                              <button
                                onClick={() => {
                                  const linkedDropTags = dropTags.filter(dt => dt.address_id === address.id);
                                  if (linkedDropTags.length > 0) {
                                    setLinkedDropTagsCount(linkedDropTags.length);
                                    setShowLinkedDropTagsAlert(true);
                                    return;
                                  }
                                  setDeletingAddressId(address.id);
                                }}
                                className="text-red-600 hover:text-red-700 transition-colors p-1"
                                title="Deletar endereço"
                              >
                                <Trash2 className="w-4 h-4" strokeWidth={2} />
                              </button>
                            </div>
                          </div>
                          <div className="text-sm text-neutral-600 leading-relaxed">
                            {address.street}, {address.number}
                            {address.complement && ` - ${address.complement}`}
                          </div>
                          <div className="text-sm text-neutral-600">
                            {address.neighborhood}, {address.city} - {address.state}
                          </div>
                          <div className="text-sm text-neutral-500 mt-2">CEP {address.cep}</div>
                        </div>
                      ))}
                      </div>
                    </>
                  )}

                  {!canAddAddress && (
                    <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                      <p className="text-sm text-amber-800 font-medium">
                        {t("consumer.addressLimit")}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {fullScreenView === "create-droptag" && (
                <div className="max-w-4xl mx-auto p-6 space-y-6">
                  {consumerAddresses.length === 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                      <p className="text-sm text-amber-800 font-medium mb-3">
                        {t("consumer.needAddressFirst")}
                      </p>
                      <button
                        onClick={() => {
                          closeFullScreenView();
                          setTimeout(() => {
                            setFullScreenView("addresses");
                            setTimeout(() => setIsViewAnimating(true), 10);
                          }, 300);
                        }}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 px-5 rounded-xl text-sm transition-all duration-200 active:scale-95"
                      >
                        {t("consumer.registerAddress")}
                      </button>
                    </div>
                  )}

                  {/* O que é uma DropTag */}
                  <div className="bg-white rounded-xl border border-neutral-200 p-5">
                    <button
                      onClick={() => setIsWhatIsDropTagExpanded(!isWhatIsDropTagExpanded)}
                      className="w-full"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Sparkles className="w-5 h-5 text-neutral-600" strokeWidth={2} />
                        </div>
                        <div className="text-left flex-1">
                          <h2 className="text-lg font-bold text-neutral-800">{t("consumer.whatIsDroptag")}</h2>
                          <p className="text-neutral-500 text-sm">{t("consumer.virtualLabel")}</p>
                        </div>
                        {isWhatIsDropTagExpanded ? 
                          <ChevronUp className="w-5 h-5 text-neutral-400 flex-shrink-0" strokeWidth={2} /> : 
                          <ChevronDown className="w-5 h-5 text-neutral-400 flex-shrink-0" strokeWidth={2} />
                        }
                      </div>
                    </button>
                    
                    <div 
                      className="grid transition-all duration-300 ease-in-out"
                      style={{ gridTemplateRows: isWhatIsDropTagExpanded ? '1fr' : '0fr' }}
                    >
                      <div className="overflow-hidden">
                        <div className="pt-5 space-y-5">
                          <p className="text-neutral-700 leading-relaxed text-sm">
                            {t("consumer.droptagExplanation")}
                          </p>
                          
                          <div className="space-y-3">
                            <div className="font-semibold text-neutral-900 flex items-center gap-2 text-sm">
                              <ArrowRight className="w-4 h-4 text-action-600" strokeWidth={2} />
                              {t("consumer.howItWorks")}
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-start gap-3 p-2.5 bg-neutral-50 rounded-xl">
                                <div className="w-5 h-5 bg-action-100 text-action-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</div>
                                <p className="text-sm text-neutral-700">{t("consumer.step1")}</p>
                              </div>
                              <div className="flex items-start gap-3 p-2.5 bg-neutral-50 rounded-xl">
                                <div className="w-5 h-5 bg-action-100 text-action-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</div>
                                <p className="text-sm text-neutral-700">{t("consumer.step2")}</p>
                              </div>
                              <div className="flex items-start gap-3 p-2.5 bg-neutral-50 rounded-xl">
                                <div className="w-5 h-5 bg-action-100 text-action-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</div>
                                <p className="text-sm text-neutral-700">{t("consumer.step3")}</p>
                              </div>
                              <div className="flex items-start gap-3 p-2.5 bg-neutral-50 rounded-xl">
                                <div className="w-5 h-5 bg-action-100 text-action-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">4</div>
                                <p className="text-sm text-neutral-700">{t("consumer.step4")}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Botão Criar Nova DropTag */}
                  {consumerAddresses.length > 0 && (
                    <div className="flex justify-center">
                      <button
                        onClick={() => setShowDropTagModal(true)}
                        className="bg-action-600 hover:bg-action-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 active:scale-95 flex items-center gap-2"
                      >
                        <Plus className="w-5 h-5" strokeWidth={2} />
                        {t("consumer.createDroptag")}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {fullScreenView === "droptags" && (
                <div className="max-w-4xl mx-auto p-6 space-y-4">
                  {dropTags.length > 0 && (
                    <div className="space-y-3">
                      <select
                        value={dropTagStatusFilter}
                        onChange={(e) => setDropTagStatusFilter(e.target.value as typeof dropTagStatusFilter)}
                        className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-sm font-medium text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23666%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:20px] bg-[right_12px_center] bg-no-repeat pr-10"
                      >
                        <option value="all">{t("consumer.all")} ({dropTags.length})</option>
                        <option value="awaiting_pickup">{t("consumer.awaitingPickup")} ({dropTags.filter(d => d.status === "awaiting_pickup" || d.status === "at_receiver").length})</option>
                        <option value="created">{t("delivery.status.created")} ({dropTags.filter(d => d.status === "created").length})</option>
                        <option value="completed">{t("consumer.delivered")} ({dropTags.filter(d => d.status === "completed").length})</option>
                      </select>
                    </div>
                  )}
                  
                  {isLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="w-6 h-6 text-primary-600 animate-spin" strokeWidth={2} />
                    </div>
                  ) : dropTags.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-100 rounded-2xl mb-4">
                        <Package className="w-8 h-8 text-neutral-400" strokeWidth={2} />
                      </div>
                      <p className="text-neutral-600 mb-4">{t("consumer.noDroptags")}</p>
                      <button
                        onClick={() => {
                          closeFullScreenView();
                          setTimeout(() => {
                            setFullScreenView("create-droptag");
                            setTimeout(() => setIsViewAnimating(true), 10);
                          }, 300);
                        }}
                        className="bg-action-600 hover:bg-action-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 active:scale-95"
                      >
                        {t("consumer.createDroptag")}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {[...dropTags]
                        .filter(d => {
                          if (dropTagStatusFilter === "all") return true;
                          if (dropTagStatusFilter === "awaiting_pickup") return d.status === "awaiting_pickup" || d.status === "at_receiver";
                          return d.status === dropTagStatusFilter;
                        })
                        .sort((a, b) => {
                          const statusOrder: Record<string, number> = {
                            'awaiting_pickup': 0,
                            'created': 1,
                            'in_transit': 2,
                            'at_receiver': 3,
                            'completed': 4
                          };
                          return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
                        }).map((dropTag) => (
                        <DropTagCard 
                          key={dropTag.id} 
                          dropTag={dropTag}
                          onEdit={handleEditDropTag}
                          onDelete={(id) => setDeletingDropTagId(id)}
                          onQRCodeScan={handleQRCodeScan}
                          consumerName={profile?.full_name || undefined}
                          onPaymentConfirmed={loadData}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Old sections - keep hidden for legacy compatibility */}
      <div className="hidden">
      {/* Seção Endereços */}
      <div className="bg-white rounded-2xl shadow-soft">
        <div className="p-6 border-b border-neutral-100">
          <button
            onClick={() => consumerAddresses.length > 0 && setIsAddressesSectionExpanded(!isAddressesSectionExpanded)}
            className="flex items-center gap-2 text-lg font-semibold text-neutral-900 hover:text-neutral-700 transition-colors w-full"
          >
            <MapPin className="w-5 h-5 text-neutral-700" strokeWidth={2} />
            Endereços {consumerAddresses.length > 0 && `(${consumerAddresses.length})`}
            {consumerAddresses.length > 0 && (
              isAddressesSectionExpanded ? 
                <ChevronUp className="w-5 h-5 text-neutral-400 ml-auto" strokeWidth={2} /> : 
                <ChevronDown className="w-5 h-5 text-neutral-400 ml-auto" strokeWidth={2} />
            )}
          </button>
        </div>

        {(isAddressesSectionExpanded || consumerAddresses.length === 0) && (
          <div className="p-6 section-expand">
            {canAddAddress && consumerAddresses.length > 0 && (
              <button
                onClick={() => setShowAddressModal(true)}
                className="w-full bg-action-600 hover:bg-action-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 active:scale-95 mb-6 flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" strokeWidth={2} />
                Adicionar Endereço
              </button>
            )}
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 text-primary-600 animate-spin" strokeWidth={2} />
              </div>
            ) : consumerAddresses.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-100 rounded-2xl mb-4">
                  <MapPin className="w-8 h-8 text-neutral-400" strokeWidth={2} />
                </div>
                <p className="text-neutral-600 mb-6">Nenhum endereço cadastrado</p>
                <button
                  onClick={() => setShowAddressModal(true)}
                  className="bg-action-600 hover:bg-action-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 active:scale-95"
                >
                  Adicionar endereço
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {consumerAddresses.map((address) => (
                  <div
                    key={address.id}
                    className="bg-neutral-50 border border-neutral-200 rounded-xl p-5 hover:border-neutral-300 hover:shadow-soft transition-all duration-200"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-semibold text-neutral-900">{address.nickname}</div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditAddress(address)}
                          className="text-primary-600 hover:text-primary-700 transition-colors p-1"
                          title="Editar endereço"
                        >
                          <Edit2 className="w-4 h-4" strokeWidth={2} />
                        </button>
                        <button
                          onClick={() => {
                            // Check if there are any droptags linked to this address
                            const linkedDropTags = dropTags.filter(dt => dt.address_id === address.id);
                            
                            if (linkedDropTags.length > 0) {
                              setLinkedDropTagsCount(linkedDropTags.length);
                              setShowLinkedDropTagsAlert(true);
                              return;
                            }
                            
                            setDeletingAddressId(address.id);
                          }}
                          className="text-red-600 hover:text-red-700 transition-colors p-1"
                          title="Deletar endereço"
                        >
                          <Trash2 className="w-4 h-4" strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                    <div className="text-sm text-neutral-600 leading-relaxed">
                      {address.street}, {address.number}
                      {address.complement && ` - ${address.complement}`}
                    </div>
                    <div className="text-sm text-neutral-600">
                      {address.neighborhood}, {address.city} - {address.state}
                    </div>
                    <div className="text-sm text-neutral-500 mt-2">CEP {address.cep}</div>
                  </div>
                ))}
              </div>
            )}

          {!canAddAddress && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm text-amber-800 font-medium">
                  Limite de 10 endereços atingido
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Seção +Nova DropTag */}
      <div className="bg-white rounded-2xl shadow-soft">
        <div className="p-6 border-b border-neutral-100">
          <button
            onClick={() => setIsNewDropTagSectionExpanded(!isNewDropTagSectionExpanded)}
            className="flex items-center gap-2 text-lg font-semibold text-neutral-900 hover:text-neutral-700 transition-colors w-full"
          >
            <Tag className="w-5 h-5 text-neutral-700 flex-shrink-0" strokeWidth={2} />
            <span>+Nova DropTag</span>
            {isNewDropTagSectionExpanded ? 
              <ChevronUp className="w-5 h-5 text-neutral-400 ml-auto" strokeWidth={2} /> : 
              <ChevronDown className="w-5 h-5 text-neutral-400 ml-auto" strokeWidth={2} />
            }
          </button>
        </div>

        {isNewDropTagSectionExpanded && (
          <div className="section-expand">
            {/* Botão principal */}
            <div className="p-6 pb-4">
              {consumerAddresses.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm text-amber-800 font-medium mb-3">
                    Você precisa cadastrar um endereço antes de criar uma DropTag.
                  </p>
                  <button
                    onClick={() => {
                      setIsNewDropTagSectionExpanded(false);
                      setIsAddressesSectionExpanded(true);
                      setTimeout(() => setShowAddressModal(true), 300);
                    }}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 px-5 rounded-xl text-sm transition-all duration-200 active:scale-95"
                  >
                    Cadastrar Endereço
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDropTagModal(true)}
                  className="w-full bg-action-600 hover:bg-action-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" strokeWidth={2} />
                  Criar Nova DropTag
                </button>
              )}
            </div>

            {/* Header informativo - toggle */}
            <button
              onClick={() => setIsWhatIsDropTagExpanded(!isWhatIsDropTagExpanded)}
              className={`bg-neutral-100 p-5 mx-6 rounded-xl border border-neutral-200 w-[calc(100%-3rem)] hover:bg-neutral-50 transition-colors ${!isWhatIsDropTagExpanded ? 'mb-6' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-neutral-200 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-neutral-600" strokeWidth={2} />
                </div>
                <div className="text-left flex-1">
                  <h2 className="text-lg font-bold text-neutral-800">O que é uma DropTag?</h2>
                  <p className="text-neutral-500 text-sm">Sua etiqueta virtual de entrega</p>
                </div>
                {isWhatIsDropTagExpanded ? 
                  <ChevronUp className="w-5 h-5 text-neutral-400 flex-shrink-0" strokeWidth={2} /> : 
                  <ChevronDown className="w-5 h-5 text-neutral-400 flex-shrink-0" strokeWidth={2} />
                }
              </div>
            </button>
            
            {/* Conteúdo expandido */}
            <div 
              className="grid transition-all duration-300 ease-in-out"
              style={{ gridTemplateRows: isWhatIsDropTagExpanded ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                <div className="p-6 space-y-5">
                  <p className="text-neutral-700 leading-relaxed text-sm">
                    DropTag é a sua <span className="font-semibold text-neutral-900">etiqueta virtual de entrega</span>. 
                    Cada compra que você fizer, crie uma DropTag para que possamos cruzar os dados dela com as 
                    informações do entregador e permitir que seu pacote chegue ao vizinho recebedor autorizado!
                  </p>
                  
                  <div className="space-y-3">
                    <div className="font-semibold text-neutral-900 flex items-center gap-2 text-sm">
                      <ArrowRight className="w-4 h-4 text-action-600" strokeWidth={2} />
                      Como funciona
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-start gap-3 p-2.5 bg-neutral-50 rounded-xl">
                        <div className="w-5 h-5 bg-action-100 text-action-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</div>
                        <p className="text-sm text-neutral-700">Após uma compra online entre na Toodrop e crie uma DropTag</p>
                      </div>
                      <div className="flex items-start gap-3 p-2.5 bg-neutral-50 rounded-xl">
                        <div className="w-5 h-5 bg-action-100 text-action-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</div>
                        <p className="text-sm text-neutral-700">Informe alguns dados sobre sua compra online e autorize vizinhos próximos a receber</p>
                      </div>
                      <div className="flex items-start gap-3 p-2.5 bg-neutral-50 rounded-xl">
                        <div className="w-5 h-5 bg-action-100 text-action-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</div>
                        <p className="text-sm text-neutral-700">Com todas as informações o entregador vai escanear a etiqueta e nós conectaremos com sua DropTag automaticamente</p>
                      </div>
                      <div className="flex items-start gap-3 p-2.5 bg-neutral-50 rounded-xl">
                        <div className="w-5 h-5 bg-action-100 text-action-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">4</div>
                        <p className="text-sm text-neutral-700">Seu pacote é deixado com um vizinho Toodroper de confiança próximo a você!</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Seção DropTags */}
      <div className="bg-white rounded-2xl shadow-soft">
        <div className="p-6 border-b border-neutral-100">
          <button
            onClick={() => dropTags.length > 0 && setIsDropTagsSectionExpanded(!isDropTagsSectionExpanded)}
            className="flex items-center gap-2 text-lg font-semibold text-neutral-900 hover:text-neutral-700 transition-colors w-full"
          >
            <Package className="w-5 h-5 text-neutral-700" strokeWidth={2} />
            Minhas DropTags {dropTags.length > 0 && `(${dropTags.length})`}
            {dropTags.length > 0 && (
              isDropTagsSectionExpanded ? 
                <ChevronUp className="w-5 h-5 text-neutral-400 ml-auto" strokeWidth={2} /> : 
                <ChevronDown className="w-5 h-5 text-neutral-400 ml-auto" strokeWidth={2} />
            )}
          </button>
        </div>

        {(isDropTagsSectionExpanded || dropTags.length === 0) && (
          <div className="p-6 section-expand">
            {dropTags.length > 0 && (
              <div className="mb-6">
                <select
                  value={dropTagStatusFilter}
                  onChange={(e) => setDropTagStatusFilter(e.target.value as typeof dropTagStatusFilter)}
                  className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-sm font-medium text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23666%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:20px] bg-[right_12px_center] bg-no-repeat pr-10"
                >
                  <option value="all">Todas ({dropTags.length})</option>
                  <option value="awaiting_pickup">Aguardando retirada ({dropTags.filter(d => d.status === "awaiting_pickup" || d.status === "at_receiver").length})</option>
                  <option value="created">Criadas ({dropTags.filter(d => d.status === "created").length})</option>
                  <option value="completed">Entregues ({dropTags.filter(d => d.status === "completed").length})</option>
                </select>
              </div>
            )}
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 text-primary-600 animate-spin" strokeWidth={2} />
              </div>
            ) : dropTags.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-100 rounded-2xl mb-4">
                  <Package className="w-8 h-8 text-neutral-400" strokeWidth={2} />
                </div>
                <p className="text-neutral-600 mb-4">Nenhuma DropTag criada</p>
                <button
                  onClick={() => setIsNewDropTagSectionExpanded(true)}
                  className="bg-action-600 hover:bg-action-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 active:scale-95"
                >
                  Criar DropTag
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {[...dropTags]
                  .filter(d => {
                    if (dropTagStatusFilter === "all") return true;
                    if (dropTagStatusFilter === "awaiting_pickup") return d.status === "awaiting_pickup" || d.status === "at_receiver";
                    return d.status === dropTagStatusFilter;
                  })
                  .sort((a, b) => {
                    const statusOrder: Record<string, number> = {
                      'awaiting_pickup': 0,
                      'created': 1,
                      'in_transit': 2,
                      'at_receiver': 3,
                      'completed': 4
                    };
                    return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
                  }).map((dropTag) => (
                  <DropTagCard 
                    key={dropTag.id} 
                    dropTag={dropTag}
                    onEdit={handleEditDropTag}
                    onDelete={(id) => setDeletingDropTagId(id)}
                    onQRCodeScan={handleQRCodeScan}
                    consumerName={profile?.full_name || undefined}
                    onPaymentConfirmed={loadData}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showAddressModal && (
        <AddressModal
          type="consumer"
          onClose={() => {
            setShowAddressModal(false);
            setEditingAddress(null);
          }}
          onSuccess={handleAddressAdded}
          existingAddress={editingAddress}
        />
      )}

      {showDropTagModal && (
        <CreateDropTagModal
          onClose={() => {
            setShowDropTagModal(false);
            setEditingDropTag(null);
          }}
          onSuccess={handleDropTagCreated}
          existingDropTag={editingDropTag}
          allDropTags={dropTags}
        />
      )}

      <AlertModal
        isOpen={!!deletingAddressId}
        onClose={() => setDeletingAddressId(null)}
        onConfirm={handleDeleteAddress}
        title="Confirmar exclusão"
        message="Tem certeza que deseja deletar este endereço? Esta ação não pode ser desfeita."
        type="warning"
        confirmText="Deletar"
        cancelText="Cancelar"
      />



      <AlertModal
        isOpen={showTrackingCodeAlert}
        onClose={() => setShowTrackingCodeAlert(false)}
        title="Código de rastreio necessário"
        message="Você possui DropTags criadas sem código de rastreio. Para evitar confusão na entrega, adicione o código de rastreio nas DropTags existentes antes de criar uma nova."
        type="warning"
        confirmText="Entendi"
      />

      <AlertModal
        isOpen={showLinkedDropTagsAlert}
        onClose={() => setShowLinkedDropTagsAlert(false)}
        title="Não é possível editar ou excluir"
        message={`Este endereço não pode ser editado ou excluído porque existem ${linkedDropTagsCount} ${linkedDropTagsCount === 1 ? 'pacote vinculado' : 'pacotes vinculados'} a ele.`}
        type="warning"
        confirmText="Entendi"
      />

      <AlertModal
        isOpen={!!deletingDropTagId}
        onClose={() => setDeletingDropTagId(null)}
        onConfirm={handleDeleteDropTag}
        title="Confirmar exclusão"
        message="Tem certeza que deseja deletar esta DropTag? Esta ação não pode ser desfeita."
        type="warning"
        confirmText="Deletar"
        cancelText="Cancelar"
      />

      {scanResultMessage && (
        <AlertModal
          isOpen={!!scanResultMessage}
          onClose={() => setScanResultMessage(null)}
          title={scanResultMessage.success ? "Sucesso" : "Erro"}
          message={scanResultMessage.message}
          type={scanResultMessage.success ? "success" : "error"}
          confirmText="Entendi"
        />
      )}



      {shouldShowTour && showTour && isActiveTab && (
        <TourModal
          tourKey="consumer"
          title="Bem-vindo à área Dropper One (Consumidor)"
          steps={getConsumerTourSteps(t)}
          onClose={closeTour}
        />
      )}
      </div>

      {showReferralModal && profile && (
        <ReferralModal
          userName={profile.full_name || ""}
          onClose={() => setShowReferralModal(false)}
        />
      )}
    </div>
  );
}
