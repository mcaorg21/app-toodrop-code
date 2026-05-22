import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useApi } from "@/react-app/hooks/useApi";
import { useTranslation } from "@/react-app/i18n";
import type { DropTag } from "@/shared/types";
import { Package, Eye, EyeOff, MapPin, Edit2, Trash2, Loader2, PackageCheck, Phone, Home, Clock, Truck, CheckCircle, CreditCard, History, X } from "lucide-react";
import { QRCodeScannerModal } from "./QRCodeScannerModal";
import { AlertModal } from "./AlertModal";
import { toProperCase } from "@/react-app/lib/utils";

interface DropTagCardProps {
  dropTag: DropTag;
  onEdit: (dropTag: DropTag) => void;
  onDelete: (id: number) => void;
  onQRCodeScan?: (data: string) => void;
  consumerName?: string;
  onPaymentConfirmed?: () => void;
}

// Card brand icon component
const CardBrandIcon = ({ brand }: { brand: string }) => {
  const brandLower = brand?.toLowerCase() || '';
  
  if (brandLower.includes('visa')) {
    return (
      <img 
        src="https://019acbcb-92a6-7eb2-9ee6-8b655e0ba462.mochausercontent.com/visa.svg" 
        alt="Visa" 
        className="h-6 w-auto"
      />
    );
  }
  
  if (brandLower.includes('master')) {
    return (
      <img 
        src="https://019acbcb-92a6-7eb2-9ee6-8b655e0ba462.mochausercontent.com/master.svg" 
        alt="Mastercard" 
        className="h-6 w-auto"
      />
    );
  }
  
  if (brandLower.includes('elo')) {
    return (
      <img 
        src="https://019acbcb-92a6-7eb2-9ee6-8b655e0ba462.mochausercontent.com/elo.svg" 
        alt="Elo" 
        className="h-6 w-auto"
      />
    );
  }
  
  if (brandLower.includes('amex') || brandLower.includes('american')) {
    return (
      <img 
        src="https://019acbcb-92a6-7eb2-9ee6-8b655e0ba462.mochausercontent.com/american_express.svg" 
        alt="American Express" 
        className="h-6 w-auto"
      />
    );
  }
  
  if (brandLower.includes('diners')) {
    return (
      <img 
        src="https://019acbcb-92a6-7eb2-9ee6-8b655e0ba462.mochausercontent.com/diners_club.svg" 
        alt="Diners Club" 
        className="h-6 w-auto"
      />
    );
  }
  
  return (
    <CreditCard className="w-5 h-5 text-neutral-400" />
  );
};

// Format brand name
const formatBrandName = (brand: string | null, t: (key: string) => string) => {
  if (!brand) return t('droptagCard.unknown');
  const brandLower = brand.toLowerCase();
  if (brandLower === 'unknown' || brandLower === 'undefined') return t('droptagCard.unknown');
  return brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase();
};

export function DropTagCard({ dropTag, onEdit, onDelete, onQRCodeScan = () => {}, consumerName, onPaymentConfirmed }: DropTagCardProps) {
  const { t } = useTranslation();
  const { fetchAuthorizedReceivers } = useApi();
  const [showSecret, setShowSecret] = useState(false);
  const [showAuthorizedPoints, setShowAuthorizedPoints] = useState(false);
  const [authorizedReceivers, setAuthorizedReceivers] = useState<any[]>([]);
  const [loadingReceivers, setLoadingReceivers] = useState(false);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [pickupStep, setPickupStep] = useState<'info' | 'payment'>('info');
  const [pixCopied, setPixCopied] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('pix');
  const pickupModalRef = useRef<HTMLDivElement>(null);
  
  // Card form state
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [saveCard, setSaveCard] = useState(false);
  const [useSavedCard, setUseSavedCard] = useState(false);
  
  // Saved cards
  const [savedCards, setSavedCards] = useState<any[]>([]);
  const [selectedSavedCardId, setSelectedSavedCardId] = useState<number | null>(null);
  const [loadingSavedCards, setLoadingSavedCards] = useState(false);
  
  // Service price from receiver_deliveries
  const [servicePrice, setServicePrice] = useState<number | null>(null);
  const [loadingServicePrice, setLoadingServicePrice] = useState(false);
  
  // Asaas payment state
  const [isCreatingCharge, setIsCreatingCharge] = useState(false);
  const [chargeError, setChargeError] = useState<string | null>(null);
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [pixCopyPaste, setPixCopyPaste] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false);
  const pollingRef = useRef<number | null>(null);
  
  // Timeline modal state
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  
  // Delete card modal state
  const [showDeleteCardModal, setShowDeleteCardModal] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<number | null>(null);

  // Auto-scroll to payment button when declaration is accepted
  useEffect(() => {
    if (declarationAccepted && pickupModalRef.current) {
      setTimeout(() => {
        if (pickupModalRef.current) {
          pickupModalRef.current.scrollTo({
            top: pickupModalRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 100);
    }
  }, [declarationAccepted]);

  // Fetch saved cards
  const fetchSavedCards = async () => {
    setLoadingSavedCards(true);
    try {
      const response = await fetch('/api/payments/saved-cards', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setSavedCards(data.cards || []);
        
        // Auto-select default card if exists
        const defaultCard = data.cards?.find((c: any) => c.is_default);
        if (defaultCard) {
          setSelectedSavedCardId(defaultCard.id);
          setUseSavedCard(true);
        }
      }
    } catch (error) {
      // Silently fail
    } finally {
      setLoadingSavedCards(false);
    }
  };

  // Delete saved card
  const deleteSavedCard = async (cardId: number) => {
    try {
      const response = await fetch(`/api/payments/saved-cards/${cardId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        // Refresh cards list
        await fetchSavedCards();
        
        // If deleted card was selected, clear selection
        if (selectedSavedCardId === cardId) {
          setSelectedSavedCardId(null);
        }
        
        // Keep useSavedCard true if there are still cards after deletion
        // The savedCards state will be updated by fetchSavedCards
      }
    } catch (error) {
      console.error('Error deleting card:', error);
    }
  };
  
  // Handle delete card confirmation
  const handleConfirmDeleteCard = () => {
    if (cardToDelete) {
      deleteSavedCard(cardToDelete);
      setCardToDelete(null);
      setShowDeleteCardModal(false);
    }
  };

  // Fetch service price when pickup modal is opened
  const fetchServicePrice = async () => {
    setLoadingServicePrice(true);
    try {
      const response = await fetch(`/api/droptags/${dropTag.id}/service-price`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setServicePrice(data.service_price);
      }
    } catch (error) {
      // Silently fail - will use default price
    } finally {
      setLoadingServicePrice(false);
    }
  };

  // Fetch timeline events
  const fetchTimeline = async () => {
    setLoadingTimeline(true);
    try {
      const response = await fetch(`/api/droptags/${dropTag.id}/timeline`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setTimelineEvents(data.events || []);
      }
    } catch (error) {
      // Silently fail
    } finally {
      setLoadingTimeline(false);
    }
  };

  const handleOpenTimeline = () => {
    setShowTimelineModal(true);
    fetchTimeline();
  };

  const getTimelineIcon = (icon: string) => {
    switch (icon) {
      case 'package': return <Package className="w-4 h-4" />;
      case 'truck': return <Truck className="w-4 h-4" />;
      case 'home': return <Home className="w-4 h-4" />;
      case 'clock': return <Clock className="w-4 h-4" />;
      case 'check': return <CheckCircle className="w-4 h-4" />;
      case 'check-circle': return <CheckCircle className="w-4 h-4" />;
      case 'credit-card': return <CreditCard className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  const formatTimelineDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Create Asaas charge
  const createCharge = async (billingType: 'PIX' | 'CREDIT_CARD', cardData?: any) => {
    setIsCreatingCharge(true);
    setChargeError(null);
    
    try {
      const body: any = {
        droptag_id: dropTag.id,
        billing_type: billingType,
        value: servicePrice ?? 10
      };
      
      if (billingType === 'CREDIT_CARD') {
        if (useSavedCard && selectedSavedCardId) {
          body.use_saved_card = true;
        } else if (cardData) {
          body.creditCard = cardData;
          body.save_card = saveCard;
        }
      }
      
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar cobrança');
      }
      
      if (data.pix_qr_code) {
        setPixQrCode(data.pix_qr_code);
      }
      if (data.pix_copy_paste) {
        setPixCopyPaste(data.pix_copy_paste);
      }
      setPaymentStatus(data.status);
      
      // If already paid (reused charge), confirm immediately
      if (data.status === 'paid' || data.status === 'RECEIVED' || data.status === 'CONFIRMED') {
        setIsPaymentConfirmed(true);
        setIsCreatingCharge(false);
        return;
      }
      
      // For PIX, stop loading and show QR code
      if (billingType === 'PIX') {
        setIsCreatingCharge(false);
      }
      // For CREDIT_CARD, keep loading until payment is confirmed
      
      // Start polling for payment status
      startPolling();
      
    } catch (error: any) {
      setChargeError(error.message || 'Erro ao processar pagamento');
      setIsCreatingCharge(false);
    }
  };

  // Poll for payment status
  const startPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    
    pollingRef.current = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/payments/poll/${dropTag.id}`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          setPaymentStatus(data.status);
          
          if (data.status === 'paid' || data.status === 'RECEIVED' || data.status === 'CONFIRMED') {
            setIsPaymentConfirmed(true);
            setIsCreatingCharge(false);
            stopPolling();
          }
        }
      } catch (error) {
        // Continue polling on error
      }
    }, 5000);
  };
  
  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };
  
  // Cleanup polling on unmount
  useEffect(() => {
    return () => stopPolling();
  }, []);

  // Format card number with spaces (0000 0000 0000 0000)
  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    const groups = digits.match(/.{1,4}/g) || [];
    return groups.join(' ');
  };

  // Format expiry date (MM/AA)
  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 2) {
      return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    return digits;
  };



  // Validation helpers
  const isCardNumberValid = cardNumber.replace(/\s/g, '').length === 16;
  const isExpiryValid = () => {
    const match = cardExpiry.match(/^(\d{2})\/(\d{2})$/);
    if (!match) return false;
    const month = parseInt(match[1], 10);
    return month >= 1 && month <= 12;
  };
  const isCvvValid = cardCvv.length === 3;
  const isNameValid = cardName.trim().length >= 3 && cardName.trim().length <= 50;

  const isCardFormValid = isCardNumberValid && isExpiryValid() && isCvvValid && isNameValid;

  const handleConfirmPayment = () => {
    if (useSavedCard && selectedSavedCardId) {
      // Using saved card - no card data needed
      createCharge('CREDIT_CARD');
      return;
    }

    if (!isCardFormValid) {
      setChargeError('Preencha todos os campos do cartão corretamente');
      return;
    }

    const [month, year] = cardExpiry.split('/');
    
    const cardData = {
      holderName: cardName,
      number: cardNumber.replace(/\s/g, ''),
      expiryMonth: month,
      expiryYear: `20${year}`,
      ccv: cardCvv
    };
    
    createCharge('CREDIT_CARD', cardData);
  };

  const handleCopyPixCode = () => {
    if (pixCopyPaste) {
      navigator.clipboard.writeText(pixCopyPaste);
      setPixCopied(true);
      setTimeout(() => setPixCopied(false), 2000);
    }
  };

  const handleOpenPickupModal = async () => {
    setPickupStep('info');
    setDeclarationAccepted(false);
    setShowPickupModal(true);
    fetchServicePrice();
    
    // Fetch saved cards
    await fetchSavedCards();
  };

  const handleGoToPayment = async () => {
    setPickupStep('payment');
    // Create PIX charge by default when entering payment step
    await createCharge('PIX');
  };

  const handleClosePickupModal = () => {
    setShowPickupModal(false);
    setPickupStep('info');
    setDeclarationAccepted(false);
    // Reset card form
    setCardNumber('');
    setCardExpiry('');
    setCardCvv('');
    setCardName('');
    setSaveCard(false);
    setUseSavedCard(false);
    setPaymentMethod('pix');
    // Reset service price
    setServicePrice(null);
    // Reset payment state
    stopPolling();
    setPixQrCode(null);
    setPixCopyPaste(null);
    setPaymentStatus(null);
    setChargeError(null);
    setIsPaymentConfirmed(false);
  };

  const handleShowAuthorizedPoints = async () => {
    setShowAuthorizedPoints(true);
    if (authorizedReceivers.length === 0) {
      setLoadingReceivers(true);
      const receivers = await fetchAuthorizedReceivers(dropTag.id);
      setAuthorizedReceivers(receivers);
      setLoadingReceivers(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "created":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "in_transit":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "awaiting_pickup":
      case "at_receiver":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "delivered":
      case "completed":
        return "bg-green-50 text-green-700 border-green-200";
      default:
        return "bg-neutral-100 text-neutral-700 border-neutral-200";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "created":
        return t('droptagCard.status.created');
      case "in_transit":
        return t('droptagCard.status.inTransit');
      case "awaiting_pickup":
      case "at_receiver":
        return t('droptagCard.status.awaitingPickup');
      case "delivered":
        return t('droptagCard.status.delivered');
      case "completed":
        return t('droptagCard.status.delivered');
      default:
        return status;
    }
  };

  const canEdit = dropTag.status === "created";

  return (
    <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-5 hover:border-neutral-300 hover:shadow-soft transition-all duration-200">
      <div className="flex items-center justify-end gap-3 mb-4">
        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(dropTag)}
              className="text-primary-600 hover:text-primary-700 transition-colors p-1"
              title={t('droptagCard.editDropTag')}
            >
              <Edit2 className="w-4 h-4" strokeWidth={2} />
            </button>
            <button
              onClick={() => onDelete(dropTag.id)}
              className="text-red-600 hover:text-red-700 transition-colors p-1"
              title={t('droptagCard.deleteDropTag')}
            >
              <Trash2 className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        )}
        <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${getStatusColor(dropTag.status)}`}>
          {getStatusLabel(dropTag.status)}
        </span>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="bg-primary-50 p-2.5 rounded-xl">
          <Package className="w-5 h-5 text-primary-600" strokeWidth={2} />
        </div>
        <div>
          {dropTag.title && (
            <div className="font-semibold text-neutral-900 text-base mb-0.5">
              {dropTag.title}
            </div>
          )}
          <div className="font-mono text-sm text-neutral-600">
            {dropTag.tracking_code}
          </div>
          <div className="text-xs text-neutral-500 mt-0.5">
            {new Date(dropTag.created_at).toLocaleDateString("pt-BR")}
          </div>
        </div>
      </div>

      {dropTag.secret_word && (
        <div className="mb-3 p-4 bg-neutral-50 rounded-xl border border-neutral-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-neutral-700">{t('droptagCard.secretWord')}</span>
            <button
              onClick={() => setShowSecret(!showSecret)}
              className="flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700"
            >
              {showSecret ? (
                <>
                  <EyeOff className="w-4 h-4" strokeWidth={2} />
                  {t('common.hide')}
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" strokeWidth={2} />
                  {t('common.show')}
                </>
              )}
            </button>
          </div>
          {showSecret && (
            <div className="font-semibold text-neutral-900">
              {dropTag.secret_word}
            </div>
          )}
        </div>
      )}

      {dropTag.notes && (
        <div className="mb-3 p-4 bg-neutral-50 rounded-xl border border-neutral-100">
          <div className="text-sm font-medium text-neutral-700 mb-1">{t('droptagCard.notes')}</div>
          <div className="text-sm text-neutral-600 leading-relaxed">{dropTag.notes}</div>
        </div>
      )}



      <div className="flex flex-col sm:flex-row gap-2">
        {dropTag.status !== "completed" && (
          <button
            onClick={dropTag.status !== "created" ? handleOpenPickupModal : undefined}
            disabled={dropTag.status === "created"}
            className={`flex-1 flex items-center justify-center gap-1.5 font-semibold text-sm py-3 px-3 rounded-xl transition-all duration-200 ${
              dropTag.status === "created"
                ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                : "bg-action-600 hover:bg-action-700 text-white active:scale-95"
            }`}
          >
            <PackageCheck className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
            <span>{t('droptagCard.pickupPackage')}</span>
          </button>
        )}
        <button
          onClick={handleShowAuthorizedPoints}
          className="flex-1 flex items-center justify-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold text-sm py-3 px-3 rounded-xl transition-all duration-200 active:scale-95"
        >
          <MapPin className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
          <span>{t('droptagCard.chosenPoints')}</span>
        </button>
        {dropTag.status === "completed" && (
          <button
            onClick={handleOpenTimeline}
            className="flex-1 flex items-center justify-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold text-sm py-3 px-3 rounded-xl transition-all duration-200 active:scale-95"
          >
            <History className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
            <span>{t('droptagCard.viewHistory')}</span>
          </button>
        )}
      </div>

      {showPickupModal && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[300] backdrop-blur-sm" onClick={handleClosePickupModal}>
          <div ref={pickupModalRef} className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-strong modal-scroll" onClick={(e) => e.stopPropagation()}>
            {pickupStep === 'info' ? (
              <>
                <div className="sticky top-0 bg-white border-b border-neutral-100 p-6 rounded-t-3xl">
                  <h3 className="text-2xl font-bold text-neutral-900 mb-2 tracking-tight">
                    {t('droptagCard.pickupModal.title')}
                  </h3>
                  <p className="text-sm text-neutral-600">
                    {t('droptagCard.pickupModal.subtitle')}
                  </p>
                </div>

                <div className="p-6 space-y-5">
                  {/* Receiver Info */}
                  {dropTag.receiver_name && (
                    <div className="bg-gradient-to-br from-action-50 to-blue-50 border border-action-100 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm bg-neutral-100 border border-neutral-200">
                          <Home className="w-7 h-7 text-neutral-600" strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] text-neutral-500 font-medium">{t('droptagCard.pickupModal.whoReceived')}</div>
                          <div className="font-bold text-neutral-900 text-lg truncate">
                            {dropTag.receiver_name.split(' ')[0]}
                          </div>
                          <div className="text-xs text-action-600 font-medium">{t('droptagCard.pickupModal.neighborTooDropper')}</div>
                          {dropTag.receiver_address && (
                            <div className="flex items-start gap-1.5 text-xs text-neutral-500 mt-1">
                              <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" strokeWidth={2} />
                              <span className="flex-1 leading-relaxed">
                                {dropTag.receiver_address}
                                {dropTag.receiver_complement && ` - ${dropTag.receiver_complement}`}
                                {' • '}{dropTag.receiver_neighborhood}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      {dropTag.receiver_phone && (
                        <div className="flex gap-2 mt-3">
                          <a
                            href={`https://wa.me/55${dropTag.receiver_phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                            `${t('droptagCard.pickupModal.whatsappMessage', { name: consumerName?.split(' ')[0] || t('droptagCard.pickupModal.neighbor') })}`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1.5 bg-[#25D366] hover:bg-[#1da851] text-white font-semibold text-sm py-2.5 px-3 rounded-xl transition-all duration-200 active:scale-95"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            WhatsApp
                          </a>
                          <a
                            href={`tel:+55${dropTag.receiver_phone.replace(/\D/g, '')}`}
                            className="flex items-center justify-center bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold text-sm py-2.5 px-3 rounded-xl transition-all duration-200 active:scale-95"
                          >
                            <Phone className="w-4 h-4" strokeWidth={2} />
                          </a>
                          {dropTag.receiver_address && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                `${dropTag.receiver_address}${dropTag.receiver_complement ? ' ' + dropTag.receiver_complement : ''}, ${dropTag.receiver_neighborhood}, ${dropTag.receiver_city}`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold text-sm py-2.5 px-3 rounded-xl transition-all duration-200 active:scale-95"
                            >
                              <MapPin className="w-4 h-4" strokeWidth={2} />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Declaration Section */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={declarationAccepted}
                        onChange={(e) => setDeclarationAccepted(e.target.checked)}
                        className="mt-1 w-5 h-5 text-primary-600 border-neutral-300 rounded focus:ring-2 focus:ring-primary-500 flex-shrink-0"
                      />
                      <div className="flex-1">
                        <p className="text-sm text-blue-900 font-bold mb-2">
                          {t('droptagCard.declaration.title')}
                        </p>
                        <div className="text-xs text-blue-800 leading-relaxed space-y-2">
                          <p>
                            {t('droptagCard.declaration.intro')}
                          </p>
                          <ul className="list-disc list-inside space-y-1.5 ml-1">
                            <li><strong>{t('droptagCard.declaration.priorAgreement')}:</strong> {t('droptagCard.declaration.priorAgreementText')}</li>
                            <li><strong>{t('droptagCard.declaration.paymentForPickup')}:</strong> {t('droptagCard.declaration.paymentForPickupText')}</li>
                            <li><strong>{t('droptagCard.declaration.automaticSplit')}:</strong> {t('droptagCard.declaration.automaticSplitText')}</li>
                          </ul>

                        </div>
                      </div>
                    </label>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={handleGoToPayment}
                      disabled={!declarationAccepted}
                      className={`w-full font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 ${
                        declarationAccepted
                          ? 'bg-action-600 hover:bg-action-700 text-white active:scale-95'
                          : 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                      }`}
                    >
                      {t('droptagCard.goToPayment')}
                    </button>
                    <button
                      onClick={handleClosePickupModal}
                      className="w-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 active:scale-95"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="sticky top-0 bg-white border-b border-neutral-100 p-6 rounded-t-3xl z-10">
                  <h3 className="text-2xl font-bold text-neutral-900 mb-2 tracking-tight">
                    {t('droptagCard.payment.title')}
                  </h3>
                  <p className="text-sm text-neutral-600">
                    {t('droptagCard.payment.subtitle')}
                  </p>
                </div>

                <div className="p-6 space-y-6">
                  {/* Payment Method Tabs */}
                  <div className="flex gap-2 p-1 bg-neutral-100 rounded-xl">
                    <button
                      onClick={() => setPaymentMethod('pix')}
                      className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 ${
                        paymentMethod === 'pix'
                          ? 'bg-white text-neutral-900 shadow-sm'
                          : 'text-neutral-600 hover:text-neutral-900'
                      }`}
                    >
                      {t('droptagCard.payment.pixCopyPaste')}
                    </button>
                    <button
                      onClick={() => setPaymentMethod('card')}
                      className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 ${
                        paymentMethod === 'card'
                          ? 'bg-white text-neutral-900 shadow-sm'
                          : 'text-neutral-600 hover:text-neutral-900'
                      }`}
                    >
                      {t('droptagCard.payment.creditCard')}
                    </button>
                  </div>

                  <div className="bg-gradient-to-br from-primary-50 to-action-50 border border-primary-200 rounded-2xl p-6 transition-all duration-300 ease-out">
                    <div className="text-center mb-4">
                      <div className="text-sm font-medium text-neutral-700 mb-2">{t('droptagCard.payment.serviceValue')}</div>
                      <div className="text-4xl font-bold text-neutral-900">
                        {loadingServicePrice ? (
                          <Loader2 className="w-8 h-8 animate-spin mx-auto text-neutral-400" />
                        ) : (
                          `R$ ${(servicePrice ?? 10).toFixed(2).replace('.', ',')}`
                        )}
                      </div>
                    </div>
                    
                    <div className="transition-all duration-300 ease-out overflow-hidden">
                    {paymentMethod === 'pix' ? (
                      <div className="bg-white rounded-xl p-4 border border-neutral-200">
                        {/* Loading state */}
                        {isCreatingCharge && (
                          <div className="flex flex-col items-center justify-center py-8">
                            <Loader2 className="w-10 h-10 animate-spin text-action-600 mb-3" />
                            <p className="text-sm text-neutral-600">{t('droptagCard.payment.generatingPix')}</p>
                          </div>
                        )}
                        
                        {/* Error state */}
                        {chargeError && !isCreatingCharge && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                            <p className="text-sm text-red-700 font-medium">{t('droptagCard.payment.errorGenerating')}</p>
                            <p className="text-xs text-red-600 mt-1">{chargeError}</p>
                            <button
                              onClick={() => createCharge('PIX')}
                              className="mt-3 w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
                            >
                              {t('common.tryAgain')}
                            </button>
                          </div>
                        )}
                        
                        {/* Payment confirmed state */}
                        {isPaymentConfirmed && (
                          <div className="flex flex-col items-center justify-center py-6">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                              <PackageCheck className="w-8 h-8 text-green-600" />
                            </div>
                            <p className="text-xl font-semibold text-green-700 mb-1">{t('droptagCard.payment.paymentCompleted')}</p>
                            <p className="text-sm text-neutral-600 text-center mb-4">
                              {t('droptagCard.payment.processFinished')}
                            </p>
                            <div className="w-full bg-green-50 border border-green-200 rounded-2xl p-5 mb-4">
                              <p className="text-base text-green-700 text-center font-medium leading-relaxed">
                                {t('droptagCard.payment.canPickup', { name: dropTag.receiver_name ? toProperCase(dropTag.receiver_name) : '' })}
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                setShowPickupModal(false);
                                setPickupStep('info');
                                setIsPaymentConfirmed(false);
                                setPixQrCode(null);
                                setPixCopyPaste(null);
                                setPaymentStatus(null);
                                // Refresh the droptags list
                                window.location.reload();
                              }}
                              className="w-full bg-action-600 hover:bg-action-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 active:scale-95"
                            >
                              {t('common.close')}
                            </button>
                          </div>
                        )}
                        
                        {/* PIX QR Code and Copy-Paste */}
                        {!isCreatingCharge && !chargeError && !isPaymentConfirmed && pixQrCode && (
                          <>
                            {/* QR Code Image */}
                            <div className="flex justify-center mb-4">
                              <div className="bg-white p-3 rounded-xl border-2 border-neutral-200 shadow-sm">
                                <img 
                                  src={`data:image/png;base64,${pixQrCode}`} 
                                  alt="QR Code PIX" 
                                  className="w-48 h-48"
                                />
                              </div>
                            </div>
                            
                            {/* Status indicator */}
                            <div className="flex items-center justify-center gap-2 mb-4">
                              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                              <span className="text-xs text-neutral-600">
                                {paymentStatus === 'PENDING' ? t('droptagCard.payment.awaitingPayment') : t('droptagCard.payment.scanQrCode')}
                              </span>
                            </div>
                            
                            <p className="font-mono text-xs text-neutral-600 truncate max-w-full mb-3 text-center">
                              {pixCopyPaste || t('droptagCard.payment.pixCodeNotAvailable')}
                            </p>
                            <div className="flex justify-center">
                              <button
                                onClick={handleCopyPixCode}
                                disabled={!pixCopyPaste}
                                className="inline-flex items-center justify-center gap-2 bg-action-600 hover:bg-action-700 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-5 rounded-xl transition-all duration-200 active:scale-95"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                {pixCopied ? t('common.copied') : t('droptagCard.payment.copyCode')}
                              </button>
                            </div>
                          </>
                        )}
                        
                        {/* Initial state - no charge created yet */}
                        {!isCreatingCharge && !chargeError && !isPaymentConfirmed && !pixQrCode && (
                          <div className="flex flex-col items-center justify-center py-6">
                            <p className="text-sm text-neutral-600 text-center mb-4">
                              Clique abaixo para gerar o QR Code de pagamento PIX
                            </p>
                            <button
                              onClick={() => createCharge('PIX')}
                              className="w-full bg-action-600 hover:bg-action-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 active:scale-95"
                            >
                              Gerar QR Code PIX
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-white rounded-xl p-4 border border-neutral-200">
                        {/* Loading state */}
                        {isCreatingCharge && (
                          <div className="flex flex-col items-center justify-center py-8">
                            <Loader2 className="w-10 h-10 animate-spin text-action-600 mb-3" />
                            <p className="text-sm font-medium text-neutral-700">Processando, aguarde...</p>
                          </div>
                        )}
                        
                        {/* Error state */}
                        {chargeError && !isCreatingCharge && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <p className="text-sm text-red-700 font-medium">Erro no pagamento</p>
                            <p className="text-xs text-red-600 mt-1">{chargeError}</p>
                            <button
                              onClick={() => {
                                setChargeError(null);
                              }}
                              className="mt-3 w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
                            >
                              Tentar novamente
                            </button>
                          </div>
                        )}
                        
                        {/* Payment confirmed state */}
                        {isPaymentConfirmed && !isCreatingCharge && (
                          <div className="flex flex-col items-center justify-center py-6">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                              <PackageCheck className="w-8 h-8 text-green-600" />
                            </div>
                            <p className="text-xl font-semibold text-green-700 mb-1 text-center">Pagamento realizado</p>
                            <p className="text-sm text-neutral-600 text-center mb-4">
                              O processo foi finalizado.
                            </p>
                            <div className="w-full bg-green-50 border border-green-200 rounded-2xl p-5 mb-4">
                              <p className="text-base text-green-700 text-center font-medium leading-relaxed">
                                Você já pode retirar sua encomenda{dropTag.receiver_name ? ` com ${toProperCase(dropTag.receiver_name)}` : ''}!
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                setShowPickupModal(false);
                                setPickupStep('info');
                                setIsPaymentConfirmed(false);
                                setPixQrCode(null);
                                setPixCopyPaste(null);
                                setPaymentStatus(null);
                                // Call the callback to refresh the droptags list without page reload
                                if (onPaymentConfirmed) {
                                  onPaymentConfirmed();
                                }
                              }}
                              className="w-full bg-action-600 hover:bg-action-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 active:scale-95"
                            >
                              Fechar
                            </button>
                          </div>
                        )}
                        
                        {/* Card form */}
                        {!isCreatingCharge && !chargeError && !isPaymentConfirmed && (
                          <div className="space-y-4">
                            {/* Loading saved cards */}
                            {loadingSavedCards && (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
                                <span className="ml-2 text-sm text-neutral-600">Carregando cartões...</span>
                              </div>
                            )}
                            
                            {/* Saved cards list */}
                            {!loadingSavedCards && savedCards.length > 0 && useSavedCard && (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-sm font-semibold text-neutral-700">Cartões salvos</p>
                                  <p className="text-xs text-neutral-500">{savedCards.length}/3</p>
                                </div>
                                {savedCards.map((card) => (
                                  <div
                                    key={card.id}
                                    className="flex items-center gap-3 p-4 border-2 rounded-xl transition-all"
                                    style={{
                                      borderColor: selectedSavedCardId === card.id ? 'rgb(59, 130, 246)' : 'rgb(229, 231, 235)',
                                      backgroundColor: selectedSavedCardId === card.id ? 'rgb(239, 246, 255)' : 'white'
                                    }}
                                  >
                                    <input
                                      type="radio"
                                      name="saved-card"
                                      checked={selectedSavedCardId === card.id}
                                      onChange={() => {
                                        setSelectedSavedCardId(card.id);
                                        setUseSavedCard(true);
                                        // Clear card form when selecting saved card
                                        setCardNumber('');
                                        setCardExpiry('');
                                        setCardCvv('');
                                        setCardName('');
                                      }}
                                      className="w-5 h-5"
                                    />
                                    <CardBrandIcon brand={card.card_brand} />
                                    <div className="flex-1">
                                      <div className="font-semibold text-sm text-neutral-900">
                                        {formatBrandName(card.card_brand, t)}
                                      </div>
                                      <div className="text-xs text-neutral-600 mt-0.5">
                                        •••• {card.card_last_digits}
                                      </div>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCardToDelete(card.id);
                                        setShowDeleteCardModal(true);
                                      }}
                                      className="p-2 hover:bg-red-50 rounded-lg transition-colors group"
                                      title={t('droptagCard.deleteCard.title')}
                                    >
                                      <Trash2 className="w-4 h-4 text-neutral-400 group-hover:text-red-600" />
                                    </button>
                                  </div>
                                ))}
                                
                                {/* Option to add new card */}
                                {savedCards.length < 3 && (
                                  <label
                                    className="flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all hover:bg-neutral-50"
                                    style={{
                                      borderColor: !useSavedCard ? 'rgb(59, 130, 246)' : 'rgb(229, 231, 235)',
                                      backgroundColor: !useSavedCard ? 'rgb(239, 246, 255)' : 'white'
                                    }}
                                  >
                                    <input
                                      type="radio"
                                      name="saved-card"
                                      checked={!useSavedCard}
                                      onChange={() => {
                                        setUseSavedCard(false);
                                        setSelectedSavedCardId(null);
                                      }}
                                      className="w-5 h-5"
                                    />
                                    <div className="flex-1">
                                      <div className="font-semibold text-sm text-neutral-900">
                                        Usar novo cartão
                                      </div>
                                      <div className="text-xs text-neutral-600 mt-0.5">
                                        Preencha os dados abaixo
                                      </div>
                                    </div>
                                    <CreditCard className="w-5 h-5 text-blue-600" />
                                  </label>
                                )}
                                
                                {savedCards.length >= 3 && useSavedCard && (
                                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                    <p className="text-xs text-amber-800 text-center">
                                      {t('droptagCard.payment.cardLimitReached')}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* New card form - only show if not using saved card and not loading */}
                            {!loadingSavedCards && !useSavedCard && (
                              <>
                                {/* Back button - only show if there are saved cards */}
                                {savedCards.length > 0 && (
                                  <div className="flex justify-end mb-4">
                                    <button
                                      onClick={() => setUseSavedCard(true)}
                                      className="flex items-center gap-2 text-sm font-semibold text-action-600 hover:text-action-700 transition-colors"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                      </svg>
                                      {t('common.back')}
                                    </button>
                                  </div>
                                )}
                                
                                <div>
                                  <label className="text-xs font-semibold text-neutral-700 mb-1.5 block">{t('droptagCard.payment.cardNumber')}</label>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={cardNumber}
                                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                                    placeholder="0000 0000 0000 0000"
                                    className={`w-full px-4 py-3 bg-neutral-50 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-action-500 focus:border-transparent transition-colors ${
                                      cardNumber && !isCardNumberValid ? 'border-red-300 bg-red-50' : cardNumber && isCardNumberValid ? 'border-green-300 bg-green-50' : 'border-neutral-200'
                                    }`}
                                  />
                                  {cardNumber && !isCardNumberValid && (
                                    <p className="text-xs text-red-600 mt-1">{t('droptagCard.payment.enterCardDigits')}</p>
                                  )}
                                </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs font-semibold text-neutral-700 mb-1.5 block">{t('droptagCard.payment.expiry')}</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={cardExpiry}
                                  onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                                  placeholder="MM/AA"
                                  className={`w-full px-4 py-3 bg-neutral-50 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-action-500 focus:border-transparent transition-colors ${
                                    cardExpiry && !isExpiryValid() ? 'border-red-300 bg-red-50' : cardExpiry && isExpiryValid() ? 'border-green-300 bg-green-50' : 'border-neutral-200'
                                  }`}
                                />
                                {cardExpiry && !isExpiryValid() && (
                                  <p className="text-xs text-red-600 mt-1">{t('droptagCard.payment.invalidMonth')}</p>
                                )}
                              </div>
                              <div>
                                <label className="text-xs font-semibold text-neutral-700 mb-1.5 block">CVV</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={cardCvv}
                                  onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 3))}
                                  placeholder="123"
                                  className={`w-full px-4 py-3 bg-neutral-50 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-action-500 focus:border-transparent transition-colors ${
                                    cardCvv && !isCvvValid ? 'border-red-300 bg-red-50' : cardCvv && isCvvValid ? 'border-green-300 bg-green-50' : 'border-neutral-200'
                                  }`}
                                />
                                {cardCvv && !isCvvValid && (
                                  <p className="text-xs text-red-600 mt-1">{t('droptagCard.payment.threeDigits')}</p>
                                )}
                              </div>
                            </div>
                                <div>
                                  <label className="text-xs font-semibold text-neutral-700 mb-1.5 block">{t('droptagCard.payment.nameOnCard')}</label>
                                  <input
                                    type="text"
                                    value={cardName}
                                    onChange={(e) => setCardName(e.target.value.toUpperCase())}
                                    maxLength={50}
                                    placeholder={t('droptagCard.payment.nameAsOnCard')}
                                    className={`w-full px-4 py-3 bg-neutral-50 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-action-500 focus:border-transparent transition-colors ${
                                      cardName && !isNameValid ? 'border-red-300 bg-red-50' : cardName && isNameValid ? 'border-green-300 bg-green-50' : 'border-neutral-200'
                                    }`}
                                  />
                                  {cardName && !isNameValid && (
                                    <p className="text-xs text-red-600 mt-1">{t('droptagCard.payment.enterFullName')}</p>
                                  )}
                                </div>

                                {/* Save card checkbox - only for new cards and if under limit */}
                                {savedCards.length < 3 && (
                                  <label className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl cursor-pointer hover:bg-blue-100 transition-colors">
                                    <input
                                      type="checkbox"
                                      checked={saveCard}
                                      onChange={(e) => setSaveCard(e.target.checked)}
                                      className="w-4 h-4"
                                    />
                                    <div className="flex-1">
                                      <span className="text-sm font-medium text-blue-900">
                                        {t('droptagCard.payment.saveForFuture')}
                                      </span>
                                      <p className="text-xs text-blue-700 mt-0.5">
                                        {t('droptagCard.payment.dataStoredSecurely')}
                                      </p>
                                    </div>
                                  </label>
                                )}
                              </>
                            )}

                            <button
                              onClick={handleConfirmPayment}
                              disabled={useSavedCard ? false : !isCardFormValid}
                              className={`w-full font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 active:scale-95 ${
                                (useSavedCard ? false : !isCardFormValid)
                                  ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                                  : 'bg-green-600 hover:bg-green-700 text-white'
                              }`}
                            >
                              {useSavedCard ? 'Pagar com cartão salvo' : 'Pagar com cartão'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    </div>
                  </div>

                  {/* Hide back button when payment is confirmed */}
                  {!isPaymentConfirmed && (
                    <div className="space-y-3">
                      <button
                        onClick={() => setPickupStep('info')}
                        className="w-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 active:scale-95"
                      >
                        {t('common.back')}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {showQRScanner && (
        <QRCodeScannerModal
          title={t('droptagCard.pickup.scanQrCode')}
          onClose={() => setShowQRScanner(false)}
          onScan={onQRCodeScan}
        />
      )}



      {showAuthorizedPoints && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[300] backdrop-blur-sm" onClick={() => setShowAuthorizedPoints(false)}>
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-strong" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-neutral-100 p-6 rounded-t-3xl">
              <h3 className="text-2xl font-bold text-neutral-900 mb-2 tracking-tight">
                {t('droptagCard.authorizedPoints.title')}
              </h3>
              <p className="text-sm text-neutral-600">
                {t('droptagCard.authorizedPoints.subtitle')}
              </p>
            </div>

            <div className="p-6">
              {loadingReceivers ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 text-primary-600 animate-spin" strokeWidth={2} />
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-neutral-700">
                        {t('droptagCard.authorizedPoints.authorized')}
                      </span>
                      <span className="text-sm font-semibold text-primary-600">
                        {authorizedReceivers.length}
                      </span>
                    </div>
                    
                    {authorizedReceivers.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-100 rounded-2xl mb-4">
                          <MapPin className="w-8 h-8 text-neutral-400" strokeWidth={2} />
                        </div>
                        <p className="text-neutral-600 mb-2">
                          {t('droptagCard.authorizedPoints.noPoints')}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {authorizedReceivers.map((receiver) => {
                          const hasPackage = (dropTag.status === 'awaiting_pickup' || dropTag.status === 'at_receiver') && receiver.receiver_key === dropTag.receiver_key;
                          return (
                          <div
                            key={receiver.receiver_key}
                            onClick={hasPackage ? () => {
                              setShowAuthorizedPoints(false);
                              setShowPickupModal(true);
                            } : undefined}
                            className={`p-4 border border-neutral-200 rounded-xl hover:border-neutral-300 hover:shadow-soft transition-all duration-200 ${hasPackage ? 'cursor-pointer hover:bg-purple-50' : ''}`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <div className="font-semibold text-neutral-900">
                                  {receiver.name}
                                </div>
                                <div className="text-sm text-neutral-600 mt-1">
                                  {receiver.address}
                                </div>
                                <div className="text-xs text-neutral-500 mt-1">
                                  {receiver.city} - {receiver.state}
                                </div>
                              </div>
                              <div className="flex flex-col items-end">
                                <div className="text-sm font-semibold text-primary-600 mb-1">
                                  {receiver.distance}m
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-neutral-500">
                                  {receiver.deliveries || 0} {t('droptagCard.authorizedPoints.deliveries')}
                                </span>
                                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                  R$ {(receiver.service_price ?? 10).toFixed(2).replace('.', ',')}
                                </span>
                              </div>
                              {(dropTag.status === 'awaiting_pickup' || dropTag.status === 'at_receiver') && receiver.receiver_key === dropTag.receiver_key ? (
                                <span className="text-xs font-semibold text-purple-600 bg-purple-100 px-2.5 py-1 rounded-full border border-purple-200 animate-pulse">
                                  {t('droptagCard.authorizedPoints.packageHere')}
                                </span>
                              ) : (
                                <span className="text-xs font-semibold text-green-600">
                                  ✓ {t('droptagCard.authorizedPoints.authorizedLabel')}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}

              <button
                onClick={() => setShowAuthorizedPoints(false)}
                className="w-full bg-action-600 hover:bg-action-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 active:scale-95"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Timeline Modal */}
      {showTimelineModal && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[300] backdrop-blur-sm" onClick={() => setShowTimelineModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-strong modal-scroll" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-neutral-100 p-6 rounded-t-3xl flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-neutral-900 tracking-tight">
                  {t('droptagCard.timeline.title')}
                </h3>
                <p className="text-sm text-neutral-600 mt-1">
                  {dropTag.title}
                </p>
              </div>
              <button
                onClick={() => setShowTimelineModal(false)}
                className="p-2 hover:bg-neutral-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>

            <div className="p-6">
              {loadingTimeline ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-action-600 animate-spin" />
                </div>
              ) : timelineEvents.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                  <p className="text-neutral-500">{t('droptagCard.timeline.noEvents')}</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-neutral-200"></div>
                  
                  <div className="space-y-4">
                    {timelineEvents.map((event, index) => (
                      <div key={index} className="relative flex gap-4">
                        {/* Icon circle */}
                        <div className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          event.type === 'created' ? 'bg-blue-100 text-blue-600' :
                          event.type === 'scan' ? 'bg-amber-100 text-amber-600' :
                          event.type === 'driver_status' ? 'bg-purple-100 text-purple-600' :
                          event.type === 'receiver_status' ? 'bg-teal-100 text-teal-600' :
                          event.type === 'payment' ? 'bg-green-100 text-green-600' :
                          event.type === 'completed' ? 'bg-green-100 text-green-600' :
                          'bg-neutral-100 text-neutral-600'
                        }`}>
                          {getTimelineIcon(event.icon)}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 pb-4">
                          <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-100">
                            <p className="font-semibold text-neutral-900 text-sm">
                              {event.title}
                            </p>
                            {event.description && (
                              <p className="text-xs text-neutral-600 mt-1">
                                {event.description}
                              </p>
                            )}
                            <p className="text-xs text-neutral-400 mt-2">
                              {formatTimelineDate(event.timestamp)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 pt-0">
              <button
                onClick={() => setShowTimelineModal(false)}
                className="w-full bg-action-600 hover:bg-action-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 active:scale-95"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {/* Delete card confirmation modal */}
      <AlertModal
        isOpen={showDeleteCardModal}
        type="warning"
        title={t('droptagCard.deleteCard.title')}
        message={t('droptagCard.deleteCard.message')}
        confirmText={t('droptagCard.deleteCard.confirm')}
        cancelText={t('common.cancel')}
        onConfirm={handleConfirmDeleteCard}
        onClose={() => {
          setShowDeleteCardModal(false);
          setCardToDelete(null);
        }}
      />
    </div>
  );
}
