import { useState, useEffect } from "react";
import { MapPin, Package, AlertCircle, X, Info, ChevronDown, Search, Calendar, User as UserIcon, ShieldCheck, CheckCircle, CheckCircle2, FileText, Camera, Receipt, Home, RefreshCw, Gift } from "lucide-react";
import type { User } from "@/shared/types";
import { useApi } from "@/react-app/hooks/useApi";
import { toProperCase, formatCurrency } from "@/react-app/lib/utils";
import { useTranslation, useLanguage } from "@/react-app/i18n";
import { Portal } from "./Portal";
import QRCode from "qrcode";
import ExtractView from "@/react-app/pages/ExtractView";
import { ReferralModal } from "./ReferralModal";
import { LoadingScreen } from "./LoadingScreen";

interface DeliveryViewProps {
  profile: User | null;
  onShowProfileSwitch?: () => void;
}

interface DeliveryLocation {
  latitude: number;
  longitude: number;
}

interface NearbyDelivery {
  droptag_id: number;
  title: string;
  tracking_code: string;
  destination: string;
  distance_km: number;
}

type FullScreenView = "scan" | "deliveries" | "track" | "extract" | null;

export function DeliveryView({ profile, onShowProfileSwitch }: DeliveryViewProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { saveDeliveryLocation, findNearbyDeliveries, getMyDeliveries, getNearbyReceivers } = useApi();
  const [location, setLocation] = useState<DeliveryLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [nearbyDeliveries, setNearbyDeliveries] = useState<NearbyDelivery[]>([]);
  const [showDeliveries, setShowDeliveries] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [locationAttempts, setLocationAttempts] = useState(0);
  const [isSearchingDeliveries, setIsSearchingDeliveries] = useState(false);
  const MAX_ATTEMPTS = 3;
  
  // Fullscreen view state
  const [fullScreenView, setFullScreenView] = useState<FullScreenView>(null);
  const [isViewAnimating, setIsViewAnimating] = useState(false);
  
  // My Deliveries section state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"delivered" | "commission_pending" | "commission_paid">("delivered");
  const [isSendingPhoto, setIsSendingPhoto] = useState(false);
  const [sendingPhotoMessage, setSendingPhotoMessage] = useState("");
  const [scanResultModal, setScanResultModal] = useState<{
    show: boolean;
    success: boolean;
    title: string;
    message: string;
    packageData?: any;
  }>({
    show: false,
    success: false,
    title: '',
    message: '',
  });
  const [driverDeliveries, setDriverDeliveries] = useState<any[]>([]);
  
  // Receiver selection state
  const [showReceiverSelection, setShowReceiverSelection] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [nearbyReceiversData, setNearbyReceiversData] = useState<{ droptag: any; receivers: any[] } | null>(null);
  const [_selectedReceiver, setSelectedReceiver] = useState<any>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [deliveryConfirmed, setDeliveryConfirmed] = useState(false);
  
  // Secret word input modal state (for driver)
  const [secretWordModal, setSecretWordModal] = useState<{
    droptag_id: number;
    driver_user_id: number;
    receiver_id: number;
    receiver_key: string;
    receiver_nickname: string;
    package_title: string;
  } | null>(null);
  const [secretWordInput, setSecretWordInput] = useState("");
  const [secretWordError, setSecretWordError] = useState<string | null>(null);
  const [secretWordAttempts, setSecretWordAttempts] = useState<number | null>(null);
  const [secretWordBlocked, setSecretWordBlocked] = useState<{ blocked_until: string; remaining_minutes: number } | null>(null);
  const [isValidatingSecretWord, setIsValidatingSecretWord] = useState(false);
  const [deliverySuccessMessage, setDeliverySuccessMessage] = useState<string | null>(null);
  const [wrongReceiverAlert, setWrongReceiverAlert] = useState(false);
  const [expandedDeliveryId, setExpandedDeliveryId] = useState<number | null>(null);
  const [pendingBalance, setPendingBalance] = useState(0);
  const [showReferralModal, setShowReferralModal] = useState(false);

  useEffect(() => {
    loadDriverDeliveries();
    loadPendingBalance();
  }, []);

  const loadPendingBalance = async () => {
    try {
      const response = await fetch('/api/profile/balance', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        console.log('[DeliveryView] Balance API response:', data);
        console.log('[DeliveryView] Setting pendingBalance to:', data.pending_balance || 0);
        setPendingBalance(data.pending_balance || 0);
      }
    } catch (error) {
      console.error('Error loading pending balance:', error);
    }
  };

  // Auto-activate location when opening scan view and start automated flow
  useEffect(() => {
    if (fullScreenView === "scan") {
      console.log("🚀 [AUTOMATED FLOW] Iniciando fluxo automático de leitura de etiqueta");
      // Reset states for fresh start
      setLocation(null);
      setLocationError(null);
      setNearbyDeliveries([]);
      setShowDeliveries(false);
      setIsSearchingDeliveries(false);
      // Start location activation
      activateLocation(0);
    }
  }, [fullScreenView]);

  // Step 2: When location is obtained in scan mode, automatically search for nearby deliveries
  useEffect(() => {
    if (fullScreenView === "scan" && location && !isLoadingLocation && !showDeliveries) {
      console.log("🔍 [AUTOMATED FLOW] Passo 2: Buscando encomendas próximas...");
      setIsSearchingDeliveries(true);
      
      const searchDeliveries = async () => {
        try {
          const startTime = Date.now();
          const data = await findNearbyDeliveries(location.latitude, location.longitude);
          const deliveries = data.deliveries || [];
          
          // Calculate how much time has passed
          const elapsedTime = Date.now() - startTime;
          const minDisplayTime = 2500; // Minimum 2.5 seconds to show loading
          const remainingTime = Math.max(0, minDisplayTime - elapsedTime);
          
          // Wait for remaining time if needed
          if (remainingTime > 0) {
            await new Promise(resolve => setTimeout(resolve, remainingTime));
          }
          
          setNearbyDeliveries(deliveries);
          
          if (deliveries.length > 0) {
            console.log(`✅ [AUTOMATED FLOW] Passo 2 concluído: ${deliveries.length} encomenda(s) encontrada(s)`);
            console.log("📸 [AUTOMATED FLOW] Passo 3: Abrindo câmera para captura de foto");
          } else {
            console.log("⚠️ [AUTOMATED FLOW] Passo 2 concluído: Nenhuma encomenda próxima encontrada");
          }
          
          setShowDeliveries(true);
          setIsSearchingDeliveries(false);
        } catch (error) {
          console.error("❌ [AUTOMATED FLOW] Erro ao buscar encomendas:", error);
          setLocationError(t("errors.generic"));
          setIsSearchingDeliveries(false);
        }
      };
      searchDeliveries();
    }
  }, [fullScreenView, location, isLoadingLocation, showDeliveries]);

  // Poll for delivery confirmation and wrong receiver alerts when QR code is displayed
  useEffect(() => {
    if (!qrCodeDataUrl || !selectedPackage?.id) return;

    console.log('[POLLING] Starting poll interval for droptag:', selectedPackage.id);
    
    const pollInterval = setInterval(async () => {
      try {
        console.log('[POLLING] Checking delivery status for droptag:', selectedPackage.id);
        const response = await fetch(`/api/delivery/check-delivery-confirmed/${selectedPackage.id}`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('[POLLING] Response data:', JSON.stringify(data));
          console.log('[POLLING] wrong_receiver_scan value:', data.wrong_receiver_scan, 'type:', typeof data.wrong_receiver_scan);
          
          // Check for wrong receiver scan
          if (data.wrong_receiver_scan === true) {
            console.log('[POLLING] Wrong receiver detected! Setting alert to TRUE.');
            setWrongReceiverAlert(true);
          } else {
            console.log('[POLLING] No wrong receiver scan detected.');
          }
          
          // Check if awaiting secret word - show input modal
          if (data.awaiting_secret_word && data.receiver_info && !secretWordModal) {
            setSecretWordModal({
              droptag_id: selectedPackage.id,
              driver_user_id: profile?.id || 0,
              receiver_id: data.receiver_info.receiver_id,
              receiver_key: data.receiver_info.receiver_key,
              receiver_nickname: data.receiver_info.receiver_name,
              package_title: selectedPackage.title || 'Pacote'
            });
          }
          
          // Check if delivery was confirmed
          if (data.confirmed) {
            clearInterval(pollInterval);
            setDeliveryConfirmed(true);
            setShowReceiverSelection(false);
            setQrCodeDataUrl(null);
            setSelectedReceiver(null);
            setSelectedPackage(null);
            setWrongReceiverAlert(false);
            setSecretWordModal(null);
            loadDriverDeliveries();
          }
        }
      } catch (error) {
        console.error('Error polling delivery status:', error);
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [qrCodeDataUrl, selectedPackage?.id, secretWordModal]);

  const loadDriverDeliveries = async () => {
    const data = await getMyDeliveries();
    setDriverDeliveries(data);
  };

  const activateLocation = async (attempt: number) => {
    console.log(`📍 [AUTOMATED FLOW] Passo 1: Ativando localização (tentativa ${attempt + 1}/${MAX_ATTEMPTS})`);
    setLocationAttempts(attempt);
    setIsLoadingLocation(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      console.error("❌ [AUTOMATED FLOW] Geolocalização não suportada pelo navegador");
      setLocationError(t("errors.generic"));
      setIsLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const loc = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        
        console.log(`✅ [AUTOMATED FLOW] Passo 1 concluído: Localização obtida (${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)})`);
        
        // Save location to backend
        await saveDeliveryLocation(loc.latitude, loc.longitude);
        
        setLocation(loc);
        setLocationError(null);
        setIsLoadingLocation(false);
      },
      (error) => {
        let errorMsg = t("driver.scan.locationError");
        if (error.code === error.PERMISSION_DENIED) {
          console.error("❌ [AUTOMATED FLOW] Permissão de localização negada");
          errorMsg = t("driver.scan.permissionDenied");
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          console.error("❌ [AUTOMATED FLOW] Localização indisponível");
          errorMsg = t("driver.scan.locationUnavailable");
        } else if (error.code === error.TIMEOUT) {
          console.error("❌ [AUTOMATED FLOW] Timeout ao obter localização");
          errorMsg = t("driver.scan.locationTimeout");
        }
        setLocationError(errorMsg);
        setIsLoadingLocation(false);
        
        if (attempt < MAX_ATTEMPTS - 1) {
          console.log(`🔄 [AUTOMATED FLOW] Tentando novamente em 2 segundos...`);
          // Auto retry
          setTimeout(() => activateLocation(attempt + 1), 2000);
        } else {
          console.error("❌ [AUTOMATED FLOW] Todas as tentativas de localização falharam");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const searchNearbyDeliveries = async () => {
    if (!location) return;
    
    const data = await findNearbyDeliveries(location.latitude, location.longitude);
    setNearbyDeliveries(data.deliveries || []);
    setShowDeliveries(true);
  };

  const handlePhotoCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !location) return;

    setIsSendingPhoto(true);
    
    // Rotating messages
    const messages = [
      t("driver.scan.messages.sending"),
      t("driver.scan.messages.reading"),
      t("driver.scan.messages.wait"),
      t("driver.scan.messages.verifying"),
      t("driver.scan.messages.crossChecking"),
      t("driver.scan.messages.wait")
    ];
    let messageIndex = 0;
    setSendingPhotoMessage(messages[0]);
    
    const messageInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % messages.length;
      setSendingPhotoMessage(messages[messageIndex]);
    }, 2500);

    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      let base64Image = await base64Promise;
      
      // Compress image to max 500kb
      try {
        const compressResponse = await fetch('https://pdf-to-png-service.up.railway.app/resize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            image: base64Image,
            maxWidth: 1200,
            maxHeight: 1200,
            quality: 75,
            maxSizeKb: 500
          }),
        });

        if (compressResponse.ok) {
          const compressResult = await compressResponse.json() as { success?: boolean; resized?: string };
          if (compressResult.success && compressResult.resized) {
            base64Image = compressResult.resized;
          }
        }
      } catch (compressError) {
        console.warn('Image compression failed, using original:', compressError);
      }

      // Get nearby deliveries to extract IDs
      const nearbyData = await findNearbyDeliveries(location.latitude, location.longitude);
      const trackedIds = nearbyData.deliveries?.map((d: any) => d.id) || [];

      if (trackedIds.length === 0) {
        setScanResultModal({
          show: true,
          success: false,
          title: 'Sem pacotes encontrados',
          message: 'Nenhum cliente foi encontrado a partir dos dados fornecidos pela foto que você tirou da etiqueta.',
        });
        setIsSendingPhoto(false);
        event.target.value = '';
        return;
      }

      // Retry logic - try up to 3 times before showing error
      const maxRetries = 3;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const response = await fetch('/api/delivery/scan-package', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              image: base64Image,
              tracked_delivery_ids: trackedIds,
            }),
          });

          const data = await response.json();

          if (response.ok && data.success) {
            // Success - go directly to receiver selection
            const receiversData = await getNearbyReceivers(data.package.id);
            setNearbyReceiversData(receiversData);
            setSelectedPackage(data.package);
            setShowReceiverSelection(true);
            loadDriverDeliveries();
            return; // Exit on success
          } else {
            // Continue to next attempt if not last try
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
            }
          }
        } catch (err) {
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }

      // All retries failed - show error
      setScanResultModal({
        show: true,
        success: false,
        title: 'Sem pacotes encontrados',
        message: 'Nenhum cliente foi encontrado a partir dos dados fornecidos pela foto que você tirou da etiqueta.',
      });
    } catch (error) {
      console.error('Error scanning label:', error);
      setScanResultModal({
        show: true,
        success: false,
        title: 'Erro',
        message: 'Erro ao processar a foto',
      });
    } finally {
      clearInterval(messageInterval);
      setIsSendingPhoto(false);
      event.target.value = '';
    }
  };

  const handleSecretWordSubmit = async () => {
    if (!secretWordModal || !secretWordInput.trim()) return;

    setIsValidatingSecretWord(true);
    setSecretWordError(null);

    try {
      const response = await fetch('/api/delivery/pending-secret-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          droptag_id: secretWordModal.droptag_id,
          secret_word: secretWordInput.toUpperCase().trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Success
        setSecretWordModal(null);
        setSecretWordInput("");
        setSecretWordError(null);
        setSecretWordAttempts(null);
        setSecretWordBlocked(null);
        setDeliveryConfirmed(true);
        setShowReceiverSelection(false);
        setSelectedReceiver(null);
        setQrCodeDataUrl(null);
        loadDriverDeliveries();
      } else {
        // Error
        if (data.blocked_until) {
          setSecretWordBlocked({
            blocked_until: data.blocked_until,
            remaining_minutes: data.remaining_minutes,
          });
        } else {
          setSecretWordError(data.error || 'Palavra secreta incorreta');
          if (data.attempts_remaining !== undefined) {
            setSecretWordAttempts(data.attempts_remaining);
          }
        }
      }
    } catch (error) {
      console.error('Error validating secret word:', error);
      setSecretWordError('Erro ao validar palavra secreta');
    } finally {
      setIsValidatingSecretWord(false);
    }
  };

  const handleReceiverSelection = async (receiver: any) => {
    setSelectedReceiver(receiver);
    
    // Generate QR code for receiver to scan
    try {
      const response = await fetch('/api/delivery/activate-receiver-point', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          droptag_id: selectedPackage.id,
          receiver_key: receiver.receiver_key,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        const qrData = data.qr_data;
        const qrDataUrl = await QRCode.toDataURL(qrData, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });
        setQrCodeDataUrl(qrDataUrl);
        setWrongReceiverAlert(false);
      } else {
        alert(data.error || 'Erro ao ativar ponto de entrega');
      }
    } catch (error) {
      console.error('Error activating receiver point:', error);
      alert('Erro ao gerar QR Code');
    }
  };

  const filteredDeliveries = driverDeliveries.filter(delivery => {
    const matchesSearch = !searchTerm || 
      delivery.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      delivery.tracking_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      delivery.consumer_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = statusFilter === "delivered" 
      ? delivery.status === "delivered"
      : statusFilter === "commission_pending"
      ? delivery.status === "delivered" && (delivery.sub_status === "awaiting_commission" || delivery.sub_status === "null" || !delivery.sub_status)
      : delivery.status === "delivered" && delivery.sub_status === "commission_paid";

    return matchesSearch && matchesFilter;
  });

  const deliveredCount = driverDeliveries.filter(d => d.status === "delivered").length;
  const commissionPendingCount = driverDeliveries.filter(d => 
    d.status === "delivered" && 
    (d.sub_status === "awaiting_commission" || d.sub_status === "null" || !d.sub_status)
  ).length;
  const commissionPaidCount = driverDeliveries.filter(d => 
    d.status === "delivered" && d.sub_status === "commission_paid"
  ).length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "in_transit":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "delivered":
        return "bg-green-50 text-green-700 border-green-200";
      case "picked_up":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "completed":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      default:
        return "bg-neutral-50 text-neutral-700 border-neutral-200";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "in_transit":
        return t("driver.status.inTransit");
      case "delivered":
        return t("driver.status.delivered");
      case "picked_up":
        return t("driver.status.pickedUp");
      case "completed":
        return t("driver.status.completed");
      default:
        return status;
    }
  };

  const getSubStatusColor = (subStatus: string) => {
    switch (subStatus) {
      case "awaiting_commission":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "commission_paid":
        return "bg-green-50 text-green-700 border-green-200";
      default:
        return "bg-amber-50 text-amber-700 border-amber-200";
    }
  };

  const getSubStatusLabel = (subStatus: string) => {
    switch (subStatus) {
      case "awaiting_commission":
        return t("driver.status.commissionPending");
      case "commission_paid":
        return t("driver.status.commissionPaid");
      default:
        return t("driver.status.commissionPending");
    }
  };

  // Handle fullscreen view close
  const handleCloseView = () => {
    setIsViewAnimating(false);
    setTimeout(() => setFullScreenView(null), 300);
  };

  // Icon grid items for driver
  const iconGridItems = [
    {
      id: "scan" as const,
      icon: Camera,
      label: t("driver.icons.scanLabel"),
      sublabel: t("driver.icons.scanSublabel"),
      enabled: true,
    },
    {
      id: "deliveries" as const,
      icon: Package,
      label: t("driver.icons.myDeliveries"),
      sublabel: t("driver.icons.viewHistory"),
      enabled: true,
      badge: pendingBalance > 0,
      badgeColor: 'yellow' as const,
    },
    {
      id: "extract" as const,
      icon: Receipt,
      label: t("extract.title"),
      sublabel: t("driver.icons.viewBalance"),
      enabled: true,
    },
    {
      id: null as FullScreenView,
      icon: Gift,
      label: t("driver.icons.referral"),
      sublabel: t("driver.icons.referralBonus"),
      enabled: true,
      isReferral: true,
    },
    {
      id: null as FullScreenView,
      icon: RefreshCw,
      label: t("driver.icons.switchProfile"),
      sublabel: t("driver.icons.currentDropper"),
      enabled: true,
      isProfileSwitch: true,
    },
  ];

  // Render fullscreen extract view
  if (fullScreenView === "extract") {
    return <ExtractView onBack={handleCloseView} />;
  }

  // Render fullscreen scan view
  if (fullScreenView === "scan") {
    return (
      <>
        {scanResultModal.show && (
          <Portal>
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[250] p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      scanResultModal.success 
                        ? 'bg-green-50' 
                        : 'bg-neutral-50'
                    }`}>
                      {scanResultModal.success ? (
                        <Package className="w-5 h-5 text-green-600" strokeWidth={2} />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-neutral-600" strokeWidth={2} />
                      )}
                    </div>
                    <h3 className="text-xl font-bold text-neutral-900">
                      {scanResultModal.title}
                    </h3>
                  </div>
                  <button
                    onClick={() => setScanResultModal({ ...scanResultModal, show: false })}
                    className="text-neutral-400 hover:text-neutral-600 transition-colors"
                  >
                    <X className="w-6 h-6" strokeWidth={2} />
                  </button>
                </div>
                
                <div className="space-y-4 text-left">
                  <p className="text-neutral-700 leading-relaxed">
                    {scanResultModal.message}
                  </p>

                  {scanResultModal.packageData && (
                    <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-3">
                      <div>
                        <div className="text-xs text-neutral-500 mb-1">Título</div>
                        <div className="font-semibold text-neutral-900">{scanResultModal.packageData.title}</div>
                      </div>
                      
                      <div>
                        <div className="text-xs text-neutral-500 mb-1">Código de Rastreamento</div>
                        <div className="font-mono text-sm text-neutral-900">{scanResultModal.packageData.tracking_code}</div>
                      </div>
                      
                      <div>
                        <div className="text-xs text-neutral-500 mb-1">Destinatário</div>
                        <div className="text-neutral-900">{toProperCase(scanResultModal.packageData.consumer_name)}</div>
                      </div>
                      
                      <div>
                        <div className="text-xs text-neutral-500 mb-1">Endereço de Entrega</div>
                        <div className="text-sm text-neutral-900">{scanResultModal.packageData.address}</div>
                      </div>

                      {scanResultModal.packageData.cep && (
                        <div>
                          <div className="text-xs text-neutral-500 mb-1">CEP</div>
                          <div className="text-neutral-900">{scanResultModal.packageData.cep}</div>
                        </div>
                      )}
                      
                      <div className="pt-3 border-t border-neutral-200">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-neutral-600">Compatibilidade</span>
                          <span className="font-semibold text-green-600">{scanResultModal.packageData.match_percentage}%</span>
                        </div>
                        <div className="text-xs text-neutral-500 mt-1">
                          Correspondências: {scanResultModal.packageData.match_details?.join(', ')}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setScanResultModal({ ...scanResultModal, show: false })}
                  className="mt-6 w-full bg-neutral-900 hover:bg-neutral-800 text-white font-semibold py-3 rounded-xl transition-all duration-200"
                >
                  {scanResultModal.success ? 'Entendi' : 'Fechar'}
                </button>
              </div>
            </div>
          </Portal>
        )}

        <Portal>
          <div className={`fixed inset-0 bg-white transition-opacity duration-300 ${isViewAnimating ? 'opacity-100' : 'opacity-0'}`} style={{ zIndex: 150 }}>
            <div className={`h-full flex flex-col transition-transform duration-300 ${isViewAnimating ? 'translate-y-0' : 'translate-y-8'}`}>
              {/* Fixed Header */}
              <div className="sticky top-0 bg-white border-b border-neutral-200 z-10 shadow-sm">
                <div className="max-w-2xl mx-auto flex items-center justify-between p-4">
                  <h2 className="text-xl font-bold text-neutral-900">Ler Etiqueta</h2>
                  <button
                    onClick={handleCloseView}
                    className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6 text-neutral-600" strokeWidth={2} />
                  </button>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-2xl mx-auto p-6">
                  {isSendingPhoto ? (
                    <LoadingScreen 
                      isLoading={true} 
                      variant="bar"
                      message={sendingPhotoMessage}
                    />
                  ) : isLoadingLocation || isSearchingDeliveries ? (
                    <LoadingScreen 
                      isLoading={true} 
                      variant="bar"
                      message={isLoadingLocation ? t("driver.scan.activatingLocation") : t("driver.scan.trackingNearby")}
                    />
                  ) : !location ? (
                    <div className="text-center space-y-6">
                      <div className="inline-flex items-center justify-center w-20 h-20 bg-neutral-100 rounded-2xl mb-4">
                        <MapPin className="w-10 h-10 text-neutral-400" strokeWidth={2} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                          {t("driver.scan.activateLocation")}
                        </h3>
                        <p className="text-neutral-600 mb-6 max-w-md mx-auto">
                          {t("driver.scan.activateLocationDesc")}
                        </p>
                      </div>

                      {locationError && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl max-w-md mx-auto">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" strokeWidth={2} />
                            <div className="text-left flex-1">
                              <p className="text-sm text-red-900">{locationError}</p>
                              <button
                                onClick={() => setShowPermissionsModal(true)}
                                className="text-sm text-red-700 hover:text-red-800 font-medium underline mt-2 inline-block"
                              >
                                {t("driver.scan.howToActivate")}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          console.log("🔄 [AUTOMATED FLOW] Reiniciando fluxo manualmente");
                          setLocation(null);
                          setLocationError(null);
                          setNearbyDeliveries([]);
                          setShowDeliveries(false);
                          setIsSearchingDeliveries(false);
                          activateLocation(0);
                        }}
                        className="w-full max-w-md mx-auto bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-8 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
                      >
                        {t("driver.scan.tryAgain")}
                      </button>
                    </div>
                  ) : nearbyDeliveries.length === 0 && showDeliveries ? (
                    <div className="text-center space-y-4">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-100 rounded-2xl mb-4">
                        <Package className="w-8 h-8 text-neutral-400" strokeWidth={2} />
                      </div>
                      <h4 className="text-lg font-semibold text-neutral-900">
                        {t("driver.scan.noDeliveriesFound")}
                      </h4>
                      <p className="text-neutral-600 max-w-md mx-auto">
                        {t("driver.scan.noDeliveriesDesc")}
                      </p>
                      <button
                        onClick={() => {
                          console.log("🔄 [AUTOMATED FLOW] Reiniciando fluxo completo");
                          setLocation(null);
                          setLocationError(null);
                          setNearbyDeliveries([]);
                          setShowDeliveries(false);
                          setIsSearchingDeliveries(false);
                          activateLocation(0);
                        }}
                        className="mt-8 max-w-xs mx-auto bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 px-6 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
                      >
                        {t("driver.scan.tryAgain")}
                      </button>
                    </div>
                  ) : (
                    <div className="text-center space-y-6">
                      <div className="inline-flex items-center justify-center w-20 h-20 bg-green-50 rounded-2xl">
                        <Package className="w-10 h-10 text-green-600" strokeWidth={2} />
                      </div>
                      <div>
                        <h4 className="text-2xl font-bold text-neutral-900 mb-3 tracking-tight">
                          {t("driver.scan.deliveriesAvailable")}
                        </h4>
                        <p className="text-neutral-600 mb-2 max-w-md mx-auto leading-relaxed">
                          {nearbyDeliveries.length === 1 
                            ? t("driver.scan.deliveriesAvailableDescSingular", { count: nearbyDeliveries.length })
                            : t("driver.scan.deliveriesAvailableDescPlural", { count: nearbyDeliveries.length })}
                        </p>
                        <p className="text-sm text-neutral-500 mb-8 max-w-md mx-auto">
                          {t("driver.scan.photoInstructions")}
                        </p>
                      </div>
                      <label className="inline-block">
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handlePhotoCapture}
                          disabled={isSendingPhoto}
                          className="hidden"
                        />
                        <span className="inline-block bg-action-600 hover:bg-action-700 text-white font-semibold py-3 px-8 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                          {t("driver.scan.photoButton")}
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Portal>

        {/* Receiver Selection Modal */}
        {showReceiverSelection && nearbyReceiversData && (
          <Portal>
            <div 
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[300] p-4"
              onClick={() => {
                setShowReceiverSelection(false);
                setSelectedReceiver(null);
                setQrCodeDataUrl(null);
                setFullScreenView(null);
              }}
            >
              <div 
                className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-neutral-900">
                    {qrCodeDataUrl ? t("driver.receiverSelection.qrCodeTitle") : t("driver.receiverSelection.chooseReceiver")}
                  </h3>
                  <button
                    onClick={() => {
                      if (qrCodeDataUrl) {
                        setSelectedReceiver(null);
                        setQrCodeDataUrl(null);
                      } else {
                        setShowReceiverSelection(false);
                        setSelectedReceiver(null);
                        setQrCodeDataUrl(null);
                        setFullScreenView(null);
                      }
                    }}
                    className="w-8 h-8 flex items-center justify-center text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" strokeWidth={2} />
                  </button>
                </div>

                {!qrCodeDataUrl ? (
                  <div className="space-y-6">
                    {/* Package info card */}
                    <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        {selectedPackage?.consumer_name && (
                          <p className="text-sm text-neutral-600">
                            {t("driver.receiverSelection.packageIdentified")} <span className="font-semibold text-neutral-900">{toProperCase(selectedPackage.consumer_name)}</span>
                          </p>
                        )}
                        {selectedPackage?.match_percentage != null && (
                          <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap">
                            {selectedPackage.match_percentage}% {t("driver.receiverSelection.compatible")}
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-neutral-900">{selectedPackage?.title}</p>
                      {selectedPackage?.tracking_code && (
                        <p className="text-sm text-neutral-600 mt-1">{selectedPackage.tracking_code}</p>
                      )}
                      {selectedPackage?.consumer_address && (
                        <p className="text-sm text-neutral-600 mt-1">{selectedPackage.consumer_address}</p>
                      )}
                    </div>

                    {/* Section title */}
                    <h4 className="font-bold text-neutral-900">
                      Pontos Próximos Disponíveis para entrega ({nearbyReceiversData.receivers.length})
                    </h4>

                    {/* Receiver cards */}
                    {nearbyReceiversData.receivers.map((receiver) => (
                      <div
                        key={receiver.receiver_key}
                        className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 hover:bg-neutral-100 transition-all duration-200"
                      >
                        {/* Header with icon, name, key, commission and distance */}
                        <div className="flex items-center gap-3">
                          <div className="bg-primary-50 p-2 rounded-lg flex-shrink-0">
                            <Home className="w-4 h-4 text-primary-600" strokeWidth={2} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-neutral-900 text-sm uppercase truncate">
                              {receiver.name?.toUpperCase()}
                            </div>
                            <div className="font-mono text-xs text-neutral-600">
                              {receiver.receiver_key}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            {receiver.driver_earning != null && (
                              <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                                {t("driver.receiverSelection.yourCommission")}: {formatCurrency(Number(receiver.driver_earning), language)}
                              </span>
                            )}
                            {receiver.distance != null && (
                              <span className="text-emerald-600 font-semibold text-xs">
                                {(receiver.distance * 1000).toFixed(0)}m
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Address details */}
                        <div className="mt-3 pt-3 border-t border-neutral-200">
                          <div className="flex items-start gap-2 text-xs text-neutral-600">
                            <MapPin className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
                            <div>
                              <span className="font-medium text-neutral-700">
                                {receiver.address}
                                {receiver.complement && `, ${receiver.complement}`}
                              </span>
                              <p className="text-neutral-500 mt-0.5">
                                {receiver.neighborhood} - {receiver.city}/{receiver.state}
                                {receiver.cep && ` • CEP: ${receiver.cep}`}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Contact buttons and QR Code button */}
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-neutral-200">
                          {receiver.latitude && receiver.longitude && (
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${receiver.latitude},${receiver.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center w-10 h-8 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MapPin className="w-4 h-4" strokeWidth={2} />
                            </a>
                          )}
                          {receiver.phone && (
                            <a
                              href={`https://wa.me/55${receiver.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Tudo bem? Meu nome é ${toProperCase(profile?.full_name?.split(' ')[0] || '')} quero entregar um pacote/encomenda através da Toodrop no seu ponto de recebimento.`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center w-10 h-8 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                            </a>
                          )}
                          <button
                            onClick={() => handleReceiverSelection(receiver)}
                            className="flex-1 bg-primary-700 hover:bg-primary-800 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm"
                          >
                            {t("driver.receiverSelection.generateQR")}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center space-y-6">
                    {wrongReceiverAlert && (
                      <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 animate-pulse">
                        <div className="flex items-center justify-center gap-2 text-red-700">
                          <AlertCircle className="w-5 h-5" strokeWidth={2} />
                          <p className="font-semibold">{t("driver.receiverSelection.wrongReceiver")}</p>
                        </div>
                        <p className="text-sm text-red-600 mt-1">
                          {t("driver.receiverSelection.wrongReceiverDesc")}
                        </p>
                      </div>
                    )}

                    <div>
                      <p className="text-sm text-neutral-600 mb-4">
                        {t("driver.receiverSelection.showQRToReceiver")}
                      </p>
                    </div>

                    <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-6 inline-block">
                      <img src={qrCodeDataUrl} alt="QR Code" className="w-64 h-64 mx-auto" />
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <p className="text-sm text-blue-900">
                        <strong>{t("driver.receiverSelection.instructions")}:</strong> {t("driver.receiverSelection.instructionsText")}
                      </p>
                    </div>

                    {selectedPackage?.has_secret_word && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <ShieldCheck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-amber-800">
                            <p className="font-bold mb-1">{t("driver.receiverSelection.secretWordWarningTitle")}</p>
                            <p className="leading-relaxed">
                              {t("driver.receiverSelection.secretWordWarningDesc")}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Portal>
        )}

        {/* Secret Word Input Modal - Driver enters word spoken by receiver */}
        {secretWordModal && (
          <Portal>
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[300] p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-300">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center">
                    <ShieldCheck className="w-7 h-7 text-amber-600" strokeWidth={2} />
                  </div>
                </div>
                
                <h3 className="text-xl font-bold text-neutral-900 text-center mb-2">
                  {t("driver.secretWord.title")}
                </h3>
                <p className="text-sm text-neutral-600 text-center mb-6">
                  {t("driver.secretWord.description", { name: secretWordModal.receiver_nickname })}
                </p>

                {secretWordBlocked ? (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-3 text-red-700">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" strokeWidth={2} />
                      <div>
                        <p className="font-semibold">{t("driver.secretWord.attemptsExhausted")}</p>
                        <p className="text-sm">
                          {t("driver.secretWord.waitMinutes", { minutes: secretWordBlocked.remaining_minutes })}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-4">
                      <input
                        type="text"
                        value={secretWordInput}
                        onChange={(e) => setSecretWordInput(e.target.value)}
                        placeholder={t("driver.secretWord.placeholder")}
                        className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:border-primary-500 focus:outline-none text-center text-lg font-medium uppercase tracking-wider"
                        autoFocus
                        disabled={isValidatingSecretWord}
                      />
                    </div>

                    {secretWordError && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-center gap-2 text-red-700 text-sm">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
                        <span>{secretWordError}</span>
                        {secretWordAttempts !== null && (
                          <span className="ml-auto font-semibold">
                            {secretWordAttempts} {t("driver.secretWord.attemptsRemaining")}
                          </span>
                        )}
                      </div>
                    )}

                    <button
                      onClick={handleSecretWordSubmit}
                      disabled={!secretWordInput.trim() || isValidatingSecretWord}
                      className="w-full bg-action-600 hover:bg-action-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                                            {isValidatingSecretWord ? t("driver.secretWord.validating") : t("driver.secretWord.confirmDelivery")}
                    </button>
                  </>
                )}

                <button
                  onClick={() => {
                    setSecretWordModal(null);
                    setSecretWordInput("");
                    setSecretWordError(null);
                    setSecretWordAttempts(null);
                    setSecretWordBlocked(null);
                  }}
                  className="w-full mt-3 text-neutral-500 hover:text-neutral-700 font-medium py-2"
                >
                  {t("driver.secretWord.cancel")}
                </button>
              </div>
            </div>
          </Portal>
        )}

        {/* Delivery Confirmed Success Modal */}
        {deliveryConfirmed && (
          <Portal>
            <div 
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[300] p-4"
              onClick={() => {
                setDeliveryConfirmed(false);
                loadDriverDeliveries();
              }}
            >
              <div 
                className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-in fade-in zoom-in duration-300 relative"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close button */}
                <button
                  onClick={() => {
                    setDeliveryConfirmed(false);
                    loadDriverDeliveries();
                  }}
                  className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                
                <div className="flex items-center justify-center mb-4">
                  <div className="w-20 h-20 bg-green-100 rounded-2xl flex items-center justify-center">
                    <CheckCircle className="w-10 h-10 text-green-600" strokeWidth={2} />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-neutral-900 text-center mb-2">
                  {t("driver.deliveryConfirmed.title")}
                </h3>
                <p className="text-neutral-600 text-center mb-6">
                  {t("driver.deliveryConfirmed.message")}
                </p>
                <button
                  onClick={() => {
                    setDeliveryConfirmed(false);
                    loadDriverDeliveries();
                  }}
                  className="w-full py-3.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors"
                >
                  {t("driver.deliveryConfirmed.understood")}
                </button>
              </div>
            </div>
          </Portal>
        )}

        {showPermissionsModal && (
          <Portal>
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[300] p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
                      <Info className="w-5 h-5 text-primary-600" strokeWidth={2} />
                    </div>
                    <h3 className="text-xl font-bold text-neutral-900">
                      {t("driver.permissions.title")}
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowPermissionsModal(false)}
                    className="text-neutral-400 hover:text-neutral-600 transition-colors"
                  >
                    <X className="w-6 h-6" strokeWidth={2} />
                  </button>
                </div>
                
                <div className="space-y-4 text-left">
                  <p className="text-neutral-700 leading-relaxed">
                    {t("driver.permissions.intro")}
                  </p>
                  
                  <ol className="space-y-3 text-neutral-700">
                    <li className="flex gap-3">
                      <span className="font-semibold text-primary-600 flex-shrink-0">1.</span>
                      <span>{t("driver.permissions.step1")}</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-semibold text-primary-600 flex-shrink-0">2.</span>
                      <span>{t("driver.permissions.step2")}</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-semibold text-primary-600 flex-shrink-0">3.</span>
                      <span>{t("driver.permissions.step3")}</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-semibold text-primary-600 flex-shrink-0">4.</span>
                      <span>{t("driver.permissions.step4")}</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-semibold text-primary-600 flex-shrink-0">5.</span>
                      <span>{t("driver.permissions.step5")}</span>
                    </li>
                  </ol>

                  <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 mt-4">
                    <p className="text-sm text-neutral-600">
                      <strong>{t("driver.permissions.tip")}</strong> {t("driver.permissions.tipText")}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowPermissionsModal(false)}
                  className="mt-6 w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-xl transition-all duration-200"
                >
                  {t("driver.permissions.understood")}
                </button>
              </div>
            </div>
          </Portal>
        )}
      </>
    );
  }

  // Render fullscreen deliveries view
  if (fullScreenView === "deliveries") {
    return (
      <Portal>
        <div className={`fixed inset-0 bg-white z-[150] transition-opacity duration-300 ${isViewAnimating ? 'opacity-100' : 'opacity-0'}`}>
          <div className={`h-full flex flex-col transition-transform duration-300 ${isViewAnimating ? 'translate-y-0' : 'translate-y-8'}`}>
            {/* Fixed Header */}
            <div className="sticky top-0 bg-white border-b border-neutral-200 z-10 shadow-sm">
              <div className="max-w-4xl mx-auto flex items-center justify-between p-4">
                <h2 className="text-xl font-bold text-neutral-900">{t("driver.myDeliveries.title")}</h2>
                <button
                  onClick={handleCloseView}
                  className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-neutral-600" strokeWidth={2} />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-4xl mx-auto p-6 space-y-4">
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" strokeWidth={2} />
                    <input
                      type="text"
                      placeholder={t("driver.myDeliveries.searchPlaceholder")}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                    className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-sm font-medium text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23666%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:20px] bg-[right_12px_center] bg-no-repeat pr-10"
                  >
                    <option value="delivered">{t("driver.myDeliveries.allDelivered")} ({deliveredCount})</option>
                    <option value="commission_pending">{t("driver.myDeliveries.commissionPending")} ({commissionPendingCount})</option>
                    <option value="commission_paid">{t("driver.myDeliveries.commissionPaid")} ({commissionPaidCount})</option>
                  </select>
                </div>

                {filteredDeliveries.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-100 rounded-2xl mb-4">
                      <Package className="w-8 h-8 text-neutral-400" strokeWidth={2} />
                    </div>
                    <p className="text-neutral-600">
                      {searchTerm ? t("driver.myDeliveries.noDeliveriesFound") : t("driver.myDeliveries.noDeliveriesRegistered")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredDeliveries.map((delivery) => (
                      <div
                        key={delivery.id}
                        className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 hover:bg-neutral-100 transition-all duration-200"
                      >
                        {/* Header - Título e código com toggle */}
                        <div 
                          className="flex items-center gap-3 cursor-pointer"
                          onClick={() => setExpandedDeliveryId(expandedDeliveryId === delivery.id ? null : delivery.id)}
                        >
                          <div className="bg-primary-50 p-2 rounded-lg flex-shrink-0">
                            <Package className="w-4 h-4 text-primary-600" strokeWidth={2} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-neutral-900 text-sm mb-0.5 truncate">
                              {delivery.title}
                            </div>
                            <div className="font-mono text-xs text-neutral-600">
                              {delivery.tracking_code}
                            </div>
                          </div>
                          <ChevronDown className={`w-5 h-5 text-neutral-400 flex-shrink-0 transition-transform duration-200 ${expandedDeliveryId === delivery.id ? 'rotate-180' : ''}`} strokeWidth={2} />
                        </div>

                        {/* Info do receptor (hub/toodroper), destino e data - Toggle */}
                        <div 
                          className={`grid transition-all duration-300 ease-in-out ${expandedDeliveryId === delivery.id ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                        >
                          <div className="overflow-hidden">
                            <div className="space-y-2 mt-3 pt-3 border-t border-neutral-200">
                              <div className="flex items-center gap-2 text-xs text-neutral-600">
                                <UserIcon className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" strokeWidth={2} />
                                <span className="truncate">{t("driver.myDeliveries.receivedBy")} <span className="font-bold">{toProperCase(delivery.receiver_name || delivery.consumer_name)}</span></span>
                              </div>
                              <div className="flex items-start gap-2 text-xs text-neutral-600">
                                <MapPin className="w-3.5 h-3.5 text-neutral-400 mt-0.5 flex-shrink-0" strokeWidth={2} />
                                <span>{delivery.receiver_address || delivery.destination}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-neutral-600">
                                <Calendar className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" strokeWidth={2} />
                                <span>{t("driver.myDeliveries.packageScannedAt")} {new Date(delivery.picked_up_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(", ", " às ")}</span>
                              </div>
                              {delivery.notes && (
                                <div className="flex items-start gap-2 text-xs text-neutral-600">
                                  <FileText className="w-3.5 h-3.5 text-neutral-400 mt-0.5 flex-shrink-0" strokeWidth={2} />
                                  <span><span className="font-medium">{t("driver.myDeliveries.observations")}:</span> {delivery.notes}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Rodapé - Data de entrega e comissão */}
                        {delivery.status === "delivered" && delivery.delivered_at && (
                          <div className="flex items-center justify-between pt-3 mt-3 border-t border-neutral-200">
                            <div className="text-xs text-neutral-500">
                              {t("driver.myDeliveries.deliveredAt")} {new Date(delivery.delivered_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(", ", " às ")}
                            </div>
                            {delivery.commission_amount != null && (
                              <div className="text-xs font-medium text-emerald-600">
                                {t("driver.myDeliveries.commission")}: R$ {delivery.commission_amount.toFixed(2).replace(".", ",")}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Status badges no rodapé */}
                        <div className={`flex flex-wrap items-center gap-2 pt-3 ${delivery.status !== "delivered" || !delivery.delivered_at ? 'mt-3 border-t border-neutral-200' : ''}`}>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(delivery.status)}`}>
                            {getStatusLabel(delivery.status)}
                          </span>
                          {delivery.status === "delivered" && (
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getSubStatusColor(delivery.sub_status || "awaiting_commission")}`}>
                              {getSubStatusLabel(delivery.sub_status || "awaiting_commission")}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Portal>
    );
  }

  // Render fullscreen track view
  if (fullScreenView === "track") {
    return (
      <Portal>
        <div className={`fixed inset-0 bg-background z-[150] transition-opacity duration-300 ${isViewAnimating ? 'opacity-100' : 'opacity-0'}`}>
          <div className={`h-full flex flex-col transition-transform duration-300 ${isViewAnimating ? 'translate-y-0' : 'translate-y-8'}`}>
            {/* Fixed Header */}
            <div className="sticky top-0 bg-white border-b border-neutral-200 z-10 shadow-sm">
              <div className="flex items-center justify-between p-4">
                <h2 className="text-xl font-bold text-neutral-900">Rastrear Entregas</h2>
                <button
                  onClick={handleCloseView}
                  className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-neutral-600" strokeWidth={2} />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-4xl mx-auto p-6 space-y-6">
                <p className="text-neutral-600 text-center max-w-md mx-auto leading-relaxed">
                  Ative sua localização para começar a rastrear entregas próximas a você.
                </p>

                {locationError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl max-w-md mx-auto">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" strokeWidth={2} />
                      <div className="text-left flex-1">
                        <p className="text-sm text-red-900">{locationError}</p>
                        <button
                          onClick={() => setShowPermissionsModal(true)}
                          className="text-sm text-red-700 hover:text-red-800 font-medium underline mt-2 inline-block"
                        >
                          Saiba mais como ativar a localização
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {location ? (
                  <div className="space-y-4 max-w-md mx-auto">
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <div className="flex items-center justify-center gap-2 text-green-900">
                        <MapPin className="w-5 h-5 text-green-600" strokeWidth={2} />
                        <p className="text-sm font-medium">Localização ativada</p>
                      </div>
                      <p className="text-xs text-green-700 mt-1 text-center">
                        {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                      </p>
                    </div>

                    <button
                      onClick={searchNearbyDeliveries}
                      className="w-full bg-action-600 hover:bg-action-700 text-white font-semibold py-3 px-8 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
                    >
                      Rastrear Entregas na Região
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => activateLocation(0)}
                    disabled={isLoadingLocation}
                    className="w-full max-w-md mx-auto bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-8 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoadingLocation 
                      ? t("driver.scan.activatingLocation")
                      : locationAttempts > 0 && locationAttempts < MAX_ATTEMPTS
                      ? t("driver.scan.retryAttempt", { current: locationAttempts + 1, max: MAX_ATTEMPTS })
                      : t("driver.scan.activateLocation")}
                  </button>
                )}

                {nearbyDeliveries.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-neutral-900 text-center">{t("driver.scan.nearbyDeliveries")}</h3>
                    {nearbyDeliveries.map((delivery) => (
                      <div
                        key={delivery.droptag_id}
                        className="bg-white border border-neutral-200 rounded-xl p-4"
                      >
                        <div className="space-y-2">
                          <div className="font-semibold text-neutral-900">{delivery.title}</div>
                          <div className="font-mono text-xs text-neutral-600">{delivery.tracking_code}</div>
                          <div className="flex items-start gap-2 text-xs text-neutral-600">
                            <MapPin className="w-3.5 h-3.5 text-neutral-400 mt-0.5 flex-shrink-0" strokeWidth={2} />
                            <span>{delivery.destination}</span>
                          </div>
                          {delivery.distance_km != null && (
                            <div className="text-xs text-neutral-500">
                              {delivery.distance_km.toFixed(1)} km de distância
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Portal>
    );
  }

  // Icon grid main view
  return (
    <div className="space-y-4">
      {/* Success Banner */}
      {deliverySuccessMessage && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 shadow-soft animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-2 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-green-600" strokeWidth={2} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-green-900">{deliverySuccessMessage}</p>
              <p className="text-sm text-green-700">A entrega foi adicionada à sua lista.</p>
            </div>
            <button
              onClick={() => setDeliverySuccessMessage(null)}
              className="text-green-600 hover:text-green-800 transition-colors p-1"
            >
              <X className="w-5 h-5" strokeWidth={2} />
            </button>
          </div>
        </div>
      )}

      {/* Icon Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {iconGridItems.map((item) => {
          const Icon = item.icon;
          
          return (
            <button
              key={item.id || ((item as any).isReferral ? 'referral' : 'profile-switch')}
              onClick={() => {
                if ((item as any).isProfileSwitch) {
                  onShowProfileSwitch?.();
                } else if ((item as any).isReferral) {
                  setShowReferralModal(true);
                } else {
                  // Reload data when opening deliveries view
                  if (item.id === "deliveries") {
                    loadDriverDeliveries();
                  }
                  setFullScreenView(item.id);
                  setTimeout(() => setIsViewAnimating(true), 10);
                }
              }}
              className="relative group cursor-pointer"
            >
              <div className="bg-white rounded-2xl shadow-soft p-6 transition-all duration-200 hover:shadow-lg hover:scale-105 active:scale-100">
                <div className="relative mb-4">
                  <Icon className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 text-neutral-600 mx-auto" strokeWidth={2} />
                  {(item as any).badge && (
                    <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white animate-pulse ${
                      (item as any).badgeColor === 'yellow' ? 'bg-amber-500' : 'bg-red-500'
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
