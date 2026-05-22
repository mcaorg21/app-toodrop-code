import { useState, useEffect, useRef } from "react";
import { useApi } from "@/react-app/hooks/useApi";
import { useTranslation } from "@/react-app/i18n";
import type { User, Address, ReceiverDocs } from "@/shared/types";
import { MapPin, FileText, Loader2, AlertCircle, Trash2, Copy, Check, Power, Package, QrCode, Key, Lock, X, Receipt, RefreshCw, Gift } from "lucide-react";
import { AddressModal } from "./AddressModal";
import { ReceiverDocsModal } from "./ReceiverDocsModal";
import { AlertModal } from "./AlertModal";
import { MyDeliveriesView } from "./MyDeliveriesView";
import { QRCodeScannerModal } from "./QRCodeScannerModal";
import { Portal } from "./Portal";
import { toProperCase } from "@/react-app/lib/utils";

import ExtractView from "@/react-app/pages/ExtractView";
import { ReferralModal } from "./ReferralModal";

interface ReceiverViewProps {
  profile: User | null;
  onProfileUpdate: () => void;
  onShowProfileSwitch?: () => void;
}

type FullScreenView = "receive" | "deliveries" | "status" | "address" | "docs" | "extract" | null;

export function ReceiverView({ profile, onProfileUpdate, onShowProfileSwitch }: ReceiverViewProps) {
  const { fetchAddresses, fetchReceiverDocuments, deleteAddress, fetchPointStatus, updateHubActiveStatus, isLoading } = useApi();
  const { t } = useTranslation();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [docs, setDocs] = useState<ReceiverDocs | null>(null);
  const [pointStatus, setPointStatus] = useState<{ receiver_key: string; is_active: number; active_hub: number; last_ping?: string; service_price?: number; receiver_commission_percent?: number; driver_commission_percent?: number; platform_commission_percent?: number } | null>(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [deletingAddressId, setDeletingAddressId] = useState<number | null>(null);
  const [showBlockedDeleteAlert, setShowBlockedDeleteAlert] = useState(false);
  const [showBlockedEditAlert, setShowBlockedEditAlert] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [isUpdatingHubStatus, setIsUpdatingHubStatus] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [scanResultMessage, setScanResultMessage] = useState<{ success: boolean; message: string; title?: string; type?: "success" | "error" | "warning" } | null>(null);
  const [deliveriesKey, setDeliveriesKey] = useState(0);
  const [fullScreenView, setFullScreenView] = useState<FullScreenView>(null);
  const [isViewAnimating, setIsViewAnimating] = useState(false);
  const [showDocInfoModal, setShowDocInfoModal] = useState(false);
  const [pendingBalance, setPendingBalance] = useState(0);
  const [showReferralModal, setShowReferralModal] = useState(false);
  
  // Secret word validation state
  // Secret word display for receiver (receiver sees the word to speak to driver)
  const [secretWordDisplay, setSecretWordDisplay] = useState<{
    droptag_id: number;
    secret_word: string;
  } | null>(null);

  // Pending delivery confirmation state
  const [pendingDeliveryConfirmation, setPendingDeliveryConfirmation] = useState<{
    receiver_key: string;
    droptag_id: number;
    driver_user_id: number;
    title: string;
    tracking_code: string;
    driver_name: string;
    consumer_name: string;
    commission_amount: number;
    has_secret_word: boolean;
  } | null>(null);
  const [responsibilityAccepted, setResponsibilityAccepted] = useState(false);
  const [isConfirmingDelivery, setIsConfirmingDelivery] = useState(false);
  const confirmButtonRef = useRef<HTMLDivElement>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
    loadPendingBalance();
  }, []);

  const loadPendingBalance = async () => {
    try {
      const response = await fetch('/api/profile/balance', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        console.log('[ReceiverView] Balance API response:', data);
        console.log('[ReceiverView] Setting pendingBalance to:', data.pending_balance || 0);
        setPendingBalance(data.pending_balance || 0);
      }
    } catch (error) {
      console.error('Error loading pending balance:', error);
    }
  };

  // Auto-scroll to confirm button when responsibility is accepted
  useEffect(() => {
    if (responsibilityAccepted && modalContentRef.current) {
      setTimeout(() => {
        if (modalContentRef.current) {
          modalContentRef.current.scrollTo({
            top: modalContentRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 100);
    }
  }, [responsibilityAccepted]);

  const loadData = async () => {
    const [addressesData, docsData] = await Promise.all([
      fetchAddresses(),
      fetchReceiverDocuments(),
    ]);
    setAddresses(addressesData.filter(a => a.address_type === "receiver"));
    setDocs(docsData);
    
    // Load point status if receiver is active
    if (profile?.is_receiver_active === 1) {
      const statusData = await fetchPointStatus();
      setPointStatus(statusData);
    }
  };

  const handleAddressAdded = () => {
    setShowAddressModal(false);
    setEditingAddress(null);
    loadData();
    // Show document info modal after adding address
    if (!editingAddress) {
      setShowDocInfoModal(true);
    }
  };

  const handleEditAddress = (address: Address) => {
    // Allow editing if pending action (has review_notes but not validated), but block if in analysis, awaiting approval (validated), rejected, or approved
    const isInAnalysis = docs?.status === "pending" && !docs?.all_docs_validated && (!docs?.review_notes || docs?.review_notes === "");
    const isAwaitingApproval = docs?.status === "pending" && docs?.all_docs_validated;
    
    if (isInAnalysis || isAwaitingApproval || docs?.status === "rejected" || isActive) {
      setShowBlockedEditAlert(true);
      return;
    }
    setEditingAddress(address);
    setShowAddressModal(true);
  };

  const handleDocsSubmitted = () => {
    setShowDocsModal(false);
    loadData();
    onProfileUpdate();
  };

  const handleDeleteAddressClick = (addressId: number) => {
    // Allow deletion if pending action (has review_notes but not validated), but block if in analysis, awaiting approval (validated), rejected, or approved
    const isInAnalysis = docs?.status === "pending" && !docs?.all_docs_validated && (!docs?.review_notes || docs?.review_notes === "");
    const isAwaitingApproval = docs?.status === "pending" && docs?.all_docs_validated;
    
    if (isInAnalysis || isAwaitingApproval || docs?.status === "rejected" || isActive) {
      setShowBlockedDeleteAlert(true);
      return;
    }
    setDeletingAddressId(addressId);
  };

  const handleConfirmDelete = async () => {
    if (!deletingAddressId) return;
    await deleteAddress(deletingAddressId);
    setDeletingAddressId(null);
    loadData();
  };

  const handleCopyKey = () => {
    if (pointStatus?.receiver_key) {
      navigator.clipboard.writeText(pointStatus.receiver_key);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleToggleHubStatus = async () => {
    setIsUpdatingHubStatus(true);
    const newStatus = pointStatus?.active_hub === 1 ? 0 : 1;
    await updateHubActiveStatus(newStatus);
    await loadData();
    setIsUpdatingHubStatus(false);
  };

  const hasAddress = addresses.length > 0;
  const receiverAddress = addresses[0];
  const isActive = profile?.is_receiver_active === 1;

  const handleQRScan = async (qrData: string) => {
    try {
      // Parse QR data - it contains receiver_key, droptag_id, and driver_user_id
      let parsedQRData;
      try {
        parsedQRData = JSON.parse(qrData);
      } catch (e) {
        throw new Error('QR Code inválido');
      }

      const { receiver_key, droptag_id, driver_user_id } = parsedQRData;
      
      if (!receiver_key || !droptag_id || !driver_user_id) {
        throw new Error('QR Code com dados incompletos');
      }

      // If this QR code is for a different receiver, call the API to notify the backend
      // so it can update wrong_receiver_scan_at and alert the driver
      if (pointStatus?.receiver_key && receiver_key !== pointStatus.receiver_key) {
        // Call scan-delivery API to register the wrong scan attempt
        await fetch('/api/receiver/scan-delivery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ receiver_key, droptag_id, driver_user_id }),
        });
        throw new Error('Este QR Code é para outro ponto de recebimento');
      }

      // Fetch delivery preview to show confirmation screen
      const previewResponse = await fetch(`/api/receiver/delivery-preview/${droptag_id}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!previewResponse.ok) {
        const errorData = await previewResponse.json();
        throw new Error(errorData.error || 'Erro ao carregar dados do pacote');
      }

      const previewData = await previewResponse.json();
      
      setShowQRScanner(false);
      setPendingDeliveryConfirmation({
        receiver_key,
        droptag_id,
        driver_user_id,
        title: previewData.title,
        tracking_code: previewData.tracking_code,
        driver_name: previewData.driver_name,
        consumer_name: previewData.consumer_name,
        commission_amount: previewData.commission_amount,
        has_secret_word: previewData.has_secret_word,
      });
      setResponsibilityAccepted(false);
    } catch (error) {
      console.error('Error scanning QR code:', error);
      setShowQRScanner(false);
      setScanResultMessage({
        success: false,
        message: error instanceof Error ? error.message : 'QR Code inválido ou erro ao processar',
      });
    }
  };

  const handleConfirmDelivery = async () => {
    if (!pendingDeliveryConfirmation || !responsibilityAccepted) return;
    
    setIsConfirmingDelivery(true);
    
    try {
      const { receiver_key, droptag_id, driver_user_id } = pendingDeliveryConfirmation;
      
      const response = await fetch('/api/receiver/scan-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ receiver_key, droptag_id, driver_user_id }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Check if secret word is required
        if (data.requires_secret_word) {
          setPendingDeliveryConfirmation(null);
          setSecretWordDisplay({
            droptag_id: data.droptag_id,
            secret_word: data.secret_word,
          });
          setScanResultMessage(null);
        } else {
          setPendingDeliveryConfirmation(null);
          setScanResultMessage({
            success: true,
            message: data.message || 'Entrega recebida com sucesso!',
          });
        }
      } else {
        const errorData = await response.json();
        
        setPendingDeliveryConfirmation(null);
        // Check if it's a wrong receiver error
        if (errorData.wrong_receiver) {
          console.log('[WRONG_RECEIVER DEBUG]', errorData.debug);
          setScanResultMessage({
            success: false,
            message: errorData.message || 'Este pacote foi designado para outro ponto de entrega.',
            title: 'Ponto Incorreto',
            type: 'warning',
          });
        } else {
          setScanResultMessage({
            success: false,
            message: errorData.error || 'Erro ao processar QR Code',
          });
        }
      }
    } catch (error) {
      console.error('Error confirming delivery:', error);
      setPendingDeliveryConfirmation(null);
      setScanResultMessage({
        success: false,
        message: 'Erro ao confirmar recebimento',
      });
    } finally {
      setIsConfirmingDelivery(false);
    }
  };

  const handleCloseSecretWordDisplay = () => {
    setSecretWordDisplay(null);
  };

  // Determine document status for display
  const isInAnalysis = docs?.status === "pending" && (!docs?.review_notes || docs?.review_notes === "");
  const isPendingAction = docs?.status === "pending" && docs?.review_notes && docs?.review_notes !== "";
  const isRejected = docs?.status === "rejected";

  // Icon grid items
  const iconGridItems: Array<{
    id: FullScreenView;
    icon: any;
    label: string;
    sublabel: string;
    enabled: boolean;
    badge?: boolean;
    badgeColor?: 'green' | 'red' | 'yellow';
    hidden?: boolean;
    isProfileSwitch?: boolean;
    isReferral?: boolean;
  }> = [
    {
      id: "receive" as const,
      icon: QrCode,
      label: t("receiver.receive"),
      sublabel: t("receiver.scanQRCode"),
      enabled: isActive,
    },
    {
      id: "deliveries" as const,
      icon: Package,
      label: t("receiver.myDeliveries"),
      sublabel: t("delivery.viewHistory"),
      enabled: isActive,
      badge: pendingBalance > 0,
      badgeColor: 'yellow' as const,
    },
    {
      id: "status" as const,
      icon: Power,
      label: t("receiver.status"),
      sublabel: t("receiver.hubStatus"),
      enabled: isActive,
      badge: isActive,
      badgeColor: (pointStatus?.active_hub === 1 ? 'green' : 'red') as 'green' | 'red',
    },
    {
      id: "address" as const,
      icon: MapPin,
      label: t("receiver.address"),
      sublabel: t("receiver.hubAddress"),
      enabled: true,
      badge: !hasAddress,
      badgeColor: 'red' as const,
    },
    {
      id: "docs" as const,
      icon: FileText,
      label: t("receiver.documents"),
      sublabel: t("receiver.sendDocuments"),
      enabled: !isActive && !isRejected,
      badge: (hasAddress && !docs) || isPendingAction || isRejected || isInAnalysis,
      badgeColor: (isInAnalysis ? 'yellow' : 'red') as 'yellow' | 'red',
      hidden: isActive, // Hide when point is approved
    },
    {
      id: "extract" as const,
      icon: Receipt,
      label: t("receiver.extract"),
      sublabel: t("receiver.viewBalance"),
      enabled: true,
    },
    {
      id: null,
      icon: Gift,
      label: t("receiver.referral"),
      sublabel: t("receiver.referralAmount"),
      enabled: true,
      isReferral: true,
    },
    {
      id: null,
      icon: RefreshCw,
      label: t("receiver.changeProfile"),
      sublabel: t("receiver.currentProfile"),
      enabled: true,
      isProfileSwitch: true,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Alerts */}
      {isInAnalysis && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0" strokeWidth={2} />
            <div>
              <h3 className="font-semibold text-amber-900 mb-1">
                {t("receiver.alerts.documentsInAnalysis")}
              </h3>
              <p className="text-sm text-amber-800 leading-relaxed">
                {t("receiver.alerts.documentsInAnalysisDesc")}
              </p>
            </div>
          </div>
        </div>
      )}

      {isPendingAction && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0" strokeWidth={2} />
            <div>
              <h3 className="font-semibold text-amber-900 mb-1">
                {t("receiver.alerts.actionRequired")}
              </h3>
              <p className="text-sm text-amber-800 leading-relaxed">
                {t("receiver.alerts.actionRequiredDesc")}
              </p>
            </div>
          </div>
        </div>
      )}

      {isRejected && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" strokeWidth={2} />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">
                {t("receiver.alerts.pointRejected")}
              </h3>
              <p className="text-sm text-red-800 leading-relaxed">
                {t("receiver.alerts.pointRejectedDesc")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Icon Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
        {iconGridItems.map((item) => {
          const Icon = item.icon;
          const isDisabled = !item.enabled;
          
          // Skip rendering if hidden
          if (item.hidden) return null;
          
          return (
            <button
              key={item.id || (item.isReferral ? 'referral' : 'profile-switch')}
              onClick={() => {
                if (isDisabled) return;
                if (item.isProfileSwitch) {
                  onShowProfileSwitch?.();
                } else if (item.isReferral) {
                  setShowReferralModal(true);
                } else if (item.id === "receive") {
                  setShowQRScanner(true);
                } else {
                  // Reload data when opening deliveries view
                  if (item.id === "deliveries") {
                    loadData();
                  }
                  setFullScreenView(item.id);
                  setTimeout(() => setIsViewAnimating(true), 10);
                }
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
                  <div className="font-semibold text-neutral-900 text-sm mb-0.5">{item.label}</div>
                  <div className="text-xs text-neutral-500">{item.sublabel}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Full Screen Views */}
      {fullScreenView && (
        <Portal>
          <div className={`fixed inset-0 bg-white z-[100] overflow-y-auto transition-opacity duration-300 ${
            isViewAnimating ? 'opacity-100' : 'opacity-0'
          }`}>
            {/* Header */}
            <div className={`sticky top-0 bg-white border-b border-neutral-200 z-10 transition-transform duration-300 ${
              isViewAnimating ? 'translate-y-0' : '-translate-y-4'
            }`}>
              <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-neutral-900">
                  {iconGridItems.find(i => i.id === fullScreenView)?.label}
                </h2>
                <button
                  onClick={() => {
                    setIsViewAnimating(false);
                    setTimeout(() => setFullScreenView(null), 200);
                  }}
                  className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-neutral-600" strokeWidth={2} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className={`max-w-4xl mx-auto px-4 py-6 transition-all duration-300 ${
              isViewAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              {fullScreenView === "deliveries" && (
                <MyDeliveriesView key={deliveriesKey} profile={profile} />
              )}

              {fullScreenView === "status" && (
                <div className="space-y-4">
                  <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-5 space-y-4">
                    <div>
                      <div className="text-sm font-medium text-neutral-700 mb-2">{t("receiver.statusView.pointNickname")}</div>
                      <div className="text-base font-semibold text-neutral-900">{receiverAddress?.nickname || '-'}</div>
                    </div>
                    
                    <div className="border-t border-neutral-200 pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium text-neutral-700">{t("receiver.statusView.pointKey")}</div>
                        {pointStatus?.receiver_key && (
                          <button
                            onClick={handleCopyKey}
                            className="flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors"
                            title={t("receiver.statusView.copy")}
                          >
                            {copiedKey ? (
                              <>
                                <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                                {t("receiver.statusView.copied")}
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" strokeWidth={2} />
                                {t("receiver.statusView.copy")}
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      <div className="font-mono text-sm font-semibold text-neutral-900 break-all">{pointStatus?.receiver_key || '-'}</div>
                    </div>
                    
                    <div className="border-t border-neutral-200 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-medium text-neutral-700">{t("receiver.statusView.togglePoint")}</div>
                      </div>
                      {pointStatus === null ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 text-neutral-400 animate-spin" strokeWidth={2} />
                          <span className="text-base text-neutral-600">{t("receiver.statusView.loadingData")}</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between bg-white border border-neutral-200 rounded-xl p-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${pointStatus?.active_hub ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            <span className={`text-base font-semibold ${pointStatus?.active_hub ? 'text-green-700' : 'text-red-700'}`}>
                              {pointStatus?.active_hub ? t("receiver.active") : t("receiver.inactive")}
                            </span>
                          </div>
                          <button
                            onClick={handleToggleHubStatus}
                            disabled={isUpdatingHubStatus}
                            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                              pointStatus?.active_hub ? 'bg-green-500' : 'bg-neutral-300'
                            }`}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                pointStatus?.active_hub ? 'translate-x-8' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <div className="border-t border-neutral-200 pt-6 mt-2">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-neutral-700">{t("receiver.statusView.servicePrice")}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-neutral-400">
                          <Lock className="w-3 h-3" strokeWidth={2} />
                          <span>{t("receiver.statusView.soonCanChange")}</span>
                        </div>
                      </div>
                      <div className="relative">
                        <div className="flex items-center justify-between bg-neutral-100 border border-neutral-200 rounded-xl px-4 py-3 cursor-not-allowed">
                          <div className="flex items-center">
                            <span className="text-neutral-400 mr-1">* R$</span>
                            <span className="text-lg font-semibold text-neutral-500">
                              {(pointStatus?.service_price ?? 10).toFixed(2).replace('.', ',')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-neutral-400">{t("receiver.statusView.youReceive")}</span>
                            <span className="text-lg font-semibold text-emerald-600">
                              ** R$ {(((pointStatus?.service_price ?? 10) * (pointStatus?.receiver_commission_percent ?? 60)) / 100).toFixed(2).replace('.', ',')}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-neutral-400 mt-2">
                          {t("receiver.statusView.servicePriceNote")}
                        </p>
                        <p className="text-xs text-neutral-400 mt-1">
                          {t("receiver.statusView.feesNote")}
                        </p>
                        <div className="mt-3 bg-neutral-50 border border-neutral-200 rounded-lg p-3">
                          <div className="text-xs font-medium text-neutral-600 mb-2">{t("receiver.statusView.configuredSplit")}</div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-white rounded-md p-2 border border-neutral-100">
                              <div className="text-sm font-semibold text-emerald-600">{pointStatus?.receiver_commission_percent ?? 60}%</div>
                              <div className="text-[10px] text-neutral-500">{t("receiver.statusView.toodroperYou")}</div>
                            </div>
                            <div className="bg-white rounded-md p-2 border border-neutral-100">
                              <div className="text-sm font-semibold text-blue-600">{pointStatus?.driver_commission_percent ?? 20}%</div>
                              <div className="text-[10px] text-neutral-500">{t("receiver.statusView.dropperDriver")}</div>
                            </div>
                            <div className="bg-white rounded-md p-2 border border-neutral-100">
                              <div className="text-sm font-semibold text-purple-600">{pointStatus?.platform_commission_percent ?? 20}%</div>
                              <div className="text-[10px] text-neutral-500">{t("receiver.statusView.platform")}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {pointStatus?.last_ping && (
                      <div className="border-t border-neutral-200 pt-4">
                        <div className="text-sm font-medium text-neutral-700 mb-2">{t("receiver.statusView.lastUpdate")}</div>
                        <div className="text-sm text-neutral-600">
                          {new Date(pointStatus.last_ping).toLocaleString("pt-BR")}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {fullScreenView === "address" && (
                <div className="space-y-4">
                  {isLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="w-6 h-6 text-primary-600 animate-spin" strokeWidth={2} />
                    </div>
                  ) : !receiverAddress ? (
                    <div className="text-center py-12">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-100 rounded-2xl mb-4">
                        <MapPin className="w-8 h-8 text-neutral-400" strokeWidth={2} />
                      </div>
                      <p className="text-neutral-600 mb-6 text-balance">
                        {t("receiver.addressView.registerPointDesc")}
                      </p>
                      <button
                        onClick={() => setShowAddressModal(true)}
                        className="bg-action-600 hover:bg-action-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 active:scale-95"
                      >
                        {t("receiver.addressView.addPoint")}
                      </button>
                    </div>
                  ) : (
                    <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-5">
                      {isActive && (
                        <div className="mb-4">
                          <span className="inline-flex px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full border border-green-200">
                            {t("receiver.approved")}
                          </span>
                        </div>
                      )}
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-semibold text-neutral-900">{receiverAddress.nickname}</div>
                        {!isActive && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditAddress(receiverAddress)}
                              className="text-primary-600 hover:text-primary-700 transition-colors text-sm font-semibold"
                            >
                              {t("common.edit")}
                            </button>
                            <button
                              onClick={() => handleDeleteAddressClick(receiverAddress.id)}
                              className="text-red-600 hover:text-red-700 transition-colors p-1"
                              title={t("common.delete")}
                            >
                              <Trash2 className="w-4 h-4" strokeWidth={2} />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-neutral-600 leading-relaxed">
                        {receiverAddress.street}, {receiverAddress.number}
                        {receiverAddress.complement && ` - ${receiverAddress.complement}`}
                      </div>
                      <div className="text-sm text-neutral-600">
                        {receiverAddress.neighborhood}, {receiverAddress.city} - {receiverAddress.state}
                      </div>
                      <div className="text-sm text-neutral-500 mt-2">{t("address.cep")} {receiverAddress.cep}</div>
                    </div>
                  )}
                </div>
              )}

              {fullScreenView === "docs" && (
                <div className="space-y-4">
                  {!hasAddress ? (
                    <div className="text-center py-12">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-100 rounded-2xl mb-4">
                        <FileText className="w-8 h-8 text-neutral-400" strokeWidth={2} />
                      </div>
                      <p className="text-sm text-neutral-600 text-balance">
                        {t("receiver.docsView.addPointFirst")}
                      </p>
                    </div>
                  ) : !docs ? (
                    <div className="text-center py-12">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-100 rounded-2xl mb-4">
                        <FileText className="w-8 h-8 text-neutral-400" strokeWidth={2} />
                      </div>
                      <p className="text-neutral-600 mb-4">
                        {t("receiver.docsView.submitDocsDesc")}
                      </p>
                      <ul className="text-sm text-neutral-600 text-left max-w-xs mx-auto mb-6 space-y-2">
                        <li className="flex items-start gap-2">
                          <span className="text-primary-600 font-bold">·</span>
                          <span>{t("receiver.docsView.officialDoc")}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary-600 font-bold">·</span>
                          <span>{t("receiver.docsView.selfie")}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary-600 font-bold">·</span>
                          <span>{t("receiver.docsView.proofAddress")}</span>
                        </li>
                      </ul>
                      <button
                        onClick={() => setShowDocsModal(true)}
                        className="bg-action-600 hover:bg-action-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 active:scale-95"
                      >
                        {t("receiver.docsView.submitDocs")}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl border border-neutral-100">
                        <span className="text-sm font-medium text-neutral-700">{t("receiver.docsView.statusLabel")}</span>
                        <span className={`text-sm font-semibold ${
                          docs.status === "approved" ? "text-green-600" :
                          docs.status === "rejected" ? "text-red-600" :
                          docs.status === "pending" && docs.all_docs_validated ? "text-blue-600" :
                          docs.status === "pending" && docs.review_notes ? "text-amber-600" :
                          "text-amber-600"
                        }`}>
                          {docs.status === "approved" ? t("receiver.approved") :
                           docs.status === "rejected" ? t("receiver.rejected") :
                           docs.status === "pending" && docs.all_docs_validated ? t("receiver.docsView.awaitingApproval") :
                           docs.status === "pending" && docs.review_notes ? t("receiver.docsView.awaitingAction") :
                           t("receiver.docsView.inAnalysis")}
                        </span>
                      </div>
                      
                      {docs.review_notes && !docs.all_docs_validated && (
                        <div className={`p-4 rounded-xl border ${
                          docs.status === "rejected" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
                        }`}>
                          <div className={`text-xs font-semibold mb-2 ${
                            docs.status === "rejected" ? "text-red-700" : "text-amber-700"
                          }`}>
                            {docs.status === "rejected" ? t("receiver.docsView.rejectionReason") : t("receiver.docsView.observations")}
                          </div>
                          <p className={`text-sm ${
                            docs.status === "rejected" ? "text-red-900" : "text-amber-900"
                          }`}>
                            {docs.review_notes}
                          </p>
                        </div>
                      )}

                      {docs.status === "pending" && docs.all_docs_validated && (
                        <div className="p-4 rounded-xl border bg-blue-50 border-blue-200">
                          <p className="text-sm text-blue-900">
                            {t("receiver.docsView.autoValidatedMsg")}
                          </p>
                        </div>
                      )}

                      {docs.status === "pending" && docs.review_notes && !docs.all_docs_validated ? (
                        <button
                          onClick={() => setShowDocsModal(true)}
                          className="w-full bg-action-600 hover:bg-action-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 active:scale-95"
                        >
                          {t("receiver.docsView.updateDocs")}
                        </button>
                      ) : null}
                      
                      <div className="text-xs text-neutral-500">
                        {t("receiver.docsView.sentOn")} {new Date(docs.created_at).toLocaleDateString("pt-BR")}
                        {docs.reviewed_at && (
                          <> • {t("receiver.docsView.reviewedOn")} {new Date(docs.reviewed_at).toLocaleDateString("pt-BR")}</>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {fullScreenView === "extract" && (
                <ExtractView onBack={() => {
                  setIsViewAnimating(false);
                  setTimeout(() => setFullScreenView(null), 200);
                }} />
              )}
            </div>
          </div>
        </Portal>
      )}

      {/* Modals */}
      {showAddressModal && (
        <AddressModal
          type="receiver"
          onClose={() => {
            setShowAddressModal(false);
            setEditingAddress(null);
          }}
          onSuccess={handleAddressAdded}
          existingAddress={editingAddress}
          profile={profile}
        />
      )}

      {showDocsModal && (
        <Portal>
          <ReceiverDocsModal
            onClose={() => setShowDocsModal(false)}
            onSuccess={handleDocsSubmitted}
          />
        </Portal>
      )}

      {deletingAddressId && (
        <AlertModal
          isOpen={true}
          onClose={() => setDeletingAddressId(null)}
          title={t("receiver.modals.deletePoint")}
          message={t("receiver.modals.deletePointConfirm")}
          type="warning"
          confirmText={t("common.delete")}
          cancelText={t("common.cancel")}
          onConfirm={handleConfirmDelete}
        />
      )}

      {showBlockedDeleteAlert && (
        <AlertModal
          isOpen={true}
          onClose={() => setShowBlockedDeleteAlert(false)}
          title={t("receiver.modals.actionBlocked")}
          message={t("receiver.modals.cannotDeleteMsg")}
          type="warning"
          confirmText={t("receiver.modals.understood")}
          onConfirm={() => setShowBlockedDeleteAlert(false)}
        />
      )}

      {showBlockedEditAlert && (
        <AlertModal
          isOpen={true}
          onClose={() => setShowBlockedEditAlert(false)}
          title={t("receiver.modals.actionBlocked")}
          message={t("receiver.modals.cannotEditMsg")}
          type="warning"
          confirmText={t("receiver.modals.understood")}
          onConfirm={() => setShowBlockedEditAlert(false)}
        />
      )}

      {showQRScanner && (
        <QRCodeScannerModal
          onClose={() => {
            setShowQRScanner(false);
          }}
          onScan={handleQRScan}
          title={t("receiver.modals.scanDriverQR")}
        />
      )}

      {/* Delivery Confirmation Modal with Responsibility Checkbox */}
      {pendingDeliveryConfirmation && (
        <Portal>
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[300] p-4"
            onClick={() => {
              setPendingDeliveryConfirmation(null);
              setResponsibilityAccepted(false);
            }}
          >
            <div 
              ref={modalContentRef}
              className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-2xl mb-4">
                  <Package className="w-8 h-8 text-primary-600" strokeWidth={2} />
                </div>
                <h3 className="text-xl font-bold text-neutral-900 mb-2">
                  {t("receiver.modals.confirmReceipt")}
                </h3>
                <p className="text-sm text-neutral-600">
                  {t("receiver.modals.verifyPackage")}
                </p>
              </div>

              {/* Package Details */}
              <div className="space-y-3 mb-6">
                <div className="bg-neutral-50 rounded-xl p-4">
                  <div className="text-xs text-neutral-500 mb-1">{t("receiver.modals.package")}</div>
                  <div className="text-sm text-neutral-600 mb-2">
                    {t("receiver.modals.for")} {toProperCase(pendingDeliveryConfirmation.consumer_name)}
                  </div>
                  <div className="font-semibold text-neutral-900">
                    {pendingDeliveryConfirmation.title || pendingDeliveryConfirmation.tracking_code}
                  </div>
                  {pendingDeliveryConfirmation.tracking_code && pendingDeliveryConfirmation.title && (
                    <div className="text-sm text-neutral-600 mt-1">
                      {t("receiver.modals.tracking")} {pendingDeliveryConfirmation.tracking_code}
                    </div>
                  )}
                </div>
                
                <div className="flex gap-3">
                  <div className="flex-1 bg-neutral-50 rounded-xl p-4">
                    <div className="text-xs text-neutral-500 mb-1">{t("receiver.modals.driver")}</div>
                    <div className="font-semibold text-neutral-900 text-sm">
                      {pendingDeliveryConfirmation.driver_name}
                    </div>
                  </div>
                  <div className="flex-1 bg-emerald-50 rounded-xl p-4">
                    <div className="text-xs text-emerald-600 mb-1">{t("receiver.modals.yourCommission")}</div>
                    <div className="font-bold text-emerald-700">
                      R$ {pendingDeliveryConfirmation.commission_amount.toFixed(2).replace('.', ',')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Responsibility Checkbox */}
              {/* Secret Word Notice - shown when delivery has secret word */}
              {pendingDeliveryConfirmation.has_secret_word && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <Key className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      <p className="font-bold mb-1">{t("receiver.modals.secretWordNotice")}</p>
                      <p className="leading-relaxed">
                        {t("receiver.modals.secretWordNoticeDesc")}
                        <span className="font-bold"> {t("receiver.modals.tellDriver")}</span> {t("receiver.modals.toFinalize")}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={responsibilityAccepted}
                    onChange={(e) => setResponsibilityAccepted(e.target.checked)}
                    className="mt-1 w-5 h-5 rounded border-blue-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                  />
                  <div>
                    <span className="font-bold text-blue-900 text-sm">
                      {t("receiver.modals.declarationTitle")}
                    </span>
                  </div>
                </label>
                <div className="mt-3 ml-8 text-sm text-blue-800 leading-relaxed">
                  <p className="mb-2" dangerouslySetInnerHTML={{ __html: t("receiver.modals.declarationIntro") }}></p>
                  <ul className="list-disc list-outside ml-4 space-y-2">
                    <li dangerouslySetInnerHTML={{ __html: t("receiver.modals.declarationReceipt") }}></li>
                    <li dangerouslySetInnerHTML={{ __html: t("receiver.modals.declarationCheck") }}></li>
                    <li dangerouslySetInnerHTML={{ __html: t("receiver.modals.declarationCommission") }}></li>
                  </ul>
                </div>
              </div>

              {/* Actions */}
              <div ref={confirmButtonRef} className="flex gap-3">
                <button
                  onClick={() => {
                    setPendingDeliveryConfirmation(null);
                    setResponsibilityAccepted(false);
                  }}
                  disabled={isConfirmingDelivery}
                  className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold py-3 px-6 rounded-xl transition-all duration-200 disabled:opacity-50"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={handleConfirmDelivery}
                  disabled={!responsibilityAccepted || isConfirmingDelivery}
                  className="flex-1 bg-action-600 hover:bg-action-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isConfirmingDelivery ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{t("receiver.modals.confirming")}</span>
                    </>
                  ) : (
                    <span>{t("receiver.modals.confirmReceipt")}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {scanResultMessage && !showQRScanner && (
        <AlertModal
          isOpen={true}
          onClose={() => setScanResultMessage(null)}
          title={scanResultMessage.title || (scanResultMessage.success ? t("common.success") : t("common.error"))}
          message={scanResultMessage.message}
          type={scanResultMessage.type || (scanResultMessage.success ? "success" : "error")}
          confirmText="OK"
          onConfirm={() => {
            setScanResultMessage(null);
            if (scanResultMessage.success) {
              setDeliveriesKey(prev => prev + 1);
            }
          }}
        />
      )}

      {secretWordDisplay && (
        <Portal>
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[300] p-4"
            onClick={handleCloseSecretWordDisplay}
          >
            <div 
              className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full animate-in fade-in zoom-in duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-2xl mb-4">
                  <Key className="w-8 h-8 text-amber-600" strokeWidth={2} />
                </div>
                <h3 className="text-xl font-bold text-neutral-900 mb-2">
                  {t("receiver.modals.secretWordTitle")}
                </h3>
                <p className="text-sm text-neutral-600 mb-6">
                  {t("receiver.modals.secretWordDesc")}
                </p>
                <div className="bg-neutral-100 rounded-xl p-6 mb-6">
                  <div className="text-3xl font-bold text-neutral-900 tracking-wider">
                    {secretWordDisplay.secret_word}
                  </div>
                </div>
                <button
                  onClick={handleCloseSecretWordDisplay}
                  className="w-full bg-action-600 hover:bg-action-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 active:scale-95"
                >
                  {t("receiver.modals.understood")}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {showDocInfoModal && (
        <Portal>
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[300] p-4"
          >
            <div 
              className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full animate-in fade-in zoom-in duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-4">
                  <FileText className="w-8 h-8 text-blue-600" strokeWidth={2} />
                </div>
                <h3 className="text-xl font-bold text-neutral-900 mb-2">
                  {t("receiver.modals.pointRegistered")}
                </h3>
                <p className="text-sm text-neutral-600 mb-6">
                  {t("receiver.modals.sendDocsToActivate")}
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setShowDocInfoModal(false);
                      setShowDocsModal(true);
                    }}
                    className="w-full bg-action-600 hover:bg-action-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 active:scale-95"
                  >
                    {t("receiver.modals.sendDocsNow")}
                  </button>
                  <button
                    onClick={() => setShowDocInfoModal(false)}
                    className="w-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold py-3 px-6 rounded-xl transition-all duration-200 active:scale-95"
                  >
                    {t("receiver.modals.sendLater")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Referral Modal */}
      {showReferralModal && (
        <ReferralModal 
          userName={toProperCase(profile?.full_name || '')}
          onClose={() => setShowReferralModal(false)} 
        />
      )}
    </div>
  );
}
