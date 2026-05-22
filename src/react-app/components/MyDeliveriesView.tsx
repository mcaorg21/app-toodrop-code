import { useState, useEffect } from "react";
import type { User } from "@/shared/types";
import { Package, Search, Calendar, User as UserIcon, Loader2, MapPin, Phone, ChevronDown, FileText } from "lucide-react";
import { useApi } from "@/react-app/hooks/useApi";
import { toProperCase, formatCurrency } from "@/react-app/lib/utils";
import { useTranslation, useLanguage } from "@/react-app/i18n";

interface MyDeliveriesViewProps {
  profile: User | null;
}

interface Delivery {
  id: number;
  tracking_code: string;
  consumer_name: string;
  consumer_phone?: string | null;
  consumer_address?: string | null;
  consumer_lat?: number | null;
  consumer_lng?: number | null;
  received_at: string;
  status: string;
  sub_status?: string | null;
  title: string;
  days_stored: number;
  delivered_at?: string;
  secret_word?: string | null;
  service_price?: number | null;
  commission_percent?: number | null;
  commission_amount?: number | null;
  notes?: string | null;
  driver_name?: string | null;
}

export function MyDeliveriesView({}: MyDeliveriesViewProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { getReceiverDeliveries } = useApi();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "awaiting_pickup" | "delivered" | "commission_pending" | "commission_paid">("all");
  const [expandedDeliveryId, setExpandedDeliveryId] = useState<number | null>(null);

  useEffect(() => {
    loadDeliveries();
  }, []);

  const loadDeliveries = async () => {
    setIsLoading(true);
    try {
      const data = await getReceiverDeliveries();
      setDeliveries(data);
    } catch (error) {
      console.error("Error loading deliveries:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "awaiting_pickup":
      case "at_receiver":
        return t("myDeliveriesReceiver.status.awaitingPickup");
      case "delivered":
        return t("myDeliveriesReceiver.status.delivered");
      case "picked_up":
        return t("myDeliveriesReceiver.status.pickedUp");
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "awaiting_pickup":
      case "at_receiver":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "delivered":
        return "bg-green-50 text-green-700 border-green-200";
      case "picked_up":
        return "bg-blue-50 text-blue-700 border-blue-200";
      default:
        return "bg-neutral-100 text-neutral-700 border-neutral-200";
    }
  };

  const getCommissionStatusColor = (subStatus: string | null | undefined) => {
    switch (subStatus) {
      case "commission_paid":
        return "bg-green-100 text-green-800 border-green-300";
      default:
        return "bg-amber-50 text-amber-700 border-amber-200";
    }
  };

  const getCommissionStatusLabel = (subStatus: string | null | undefined) => {
    switch (subStatus) {
      case "commission_paid":
        return t("myDeliveriesReceiver.commissionStatus.paid");
      default:
        return t("myDeliveriesReceiver.commissionStatus.pending");
    }
  };

  // Filter deliveries
  const filteredDeliveries = deliveries.filter(delivery => {
    const matchesSearch = 
      delivery.tracking_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      delivery.consumer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      delivery.title.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Helper to check if delivery is awaiting pickup (both status values mean the same)
    const isAwaitingPickup = delivery.status === "awaiting_pickup" || delivery.status === "at_receiver";
    
    let matchesStatus = true;
    if (statusFilter === "all") {
      matchesStatus = true;
    } else if (statusFilter === "awaiting_pickup") {
      matchesStatus = isAwaitingPickup;
    } else if (statusFilter === "delivered") {
      matchesStatus = delivery.status === "delivered";
    } else if (statusFilter === "commission_pending") {
      // Consider pending when sub_status is null, "null", undefined, empty, or "awaiting_commission" - all deliveries
      const isPending = !delivery.sub_status || delivery.sub_status === "null" || delivery.sub_status === "awaiting_commission";
      matchesStatus = isPending;
    } else if (statusFilter === "commission_paid") {
      matchesStatus = delivery.sub_status === "commission_paid";
    }

    return matchesSearch && matchesStatus;
  });

  const awaitingCount = deliveries.filter(d => d.status === "awaiting_pickup" || d.status === "at_receiver").length;
  const deliveredDeliveries = deliveries.filter(d => d.status === "delivered");
  const deliveredCount = deliveredDeliveries.length;
  // Consider pending when sub_status is null, "null", undefined, empty, or "awaiting_commission" - count ALL deliveries, not just delivered
  const commissionPendingCount = deliveries.filter(d => !d.sub_status || d.sub_status === "null" || d.sub_status === "awaiting_commission").length;
  const commissionPaidCount = deliveries.filter(d => d.sub_status === "commission_paid").length;

  const formatPhoneForWhatsApp = (phone: string): string => {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    // Add Brazil country code if not present
    if (digits.startsWith('55')) {
      return digits;
    }
    return `55${digits}`;
  };

  const openWhatsApp = (phone: string, title: string) => {
    const formattedPhone = formatPhoneForWhatsApp(phone);
    const message = t("myDeliveriesReceiver.whatsappMessage", { title });
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${formattedPhone}?text=${encodedMessage}`, '_blank');
  };

  const openMaps = (address: string) => {
    const encodedAddress = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 text-primary-600 animate-spin" strokeWidth={2} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" strokeWidth={2} />
          <input
            type="text"
            placeholder={t("myDeliveriesReceiver.searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="flex-1 px-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-sm font-medium text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23666%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:20px] bg-[right_12px_center] bg-no-repeat pr-10"
          >
            <option value="all">{t("myDeliveriesReceiver.all")} ({deliveries.length})</option>
            <option value="awaiting_pickup">{t("myDeliveriesReceiver.awaitingPickup")} ({awaitingCount})</option>
            <option value="delivered">{t("myDeliveriesReceiver.delivered")} ({deliveredCount})</option>
            <option value="commission_pending">{t("myDeliveriesReceiver.commissionPending")} ({commissionPendingCount})</option>
            <option value="commission_paid">{t("myDeliveriesReceiver.commissionPaid")} ({commissionPaidCount})</option>
          </select>
        </div>
      </div>

      {filteredDeliveries.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-soft p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-100 rounded-2xl mb-4">
            <Package className="w-8 h-8 text-neutral-400" strokeWidth={2} />
          </div>
          <p className="text-neutral-600">
            {searchTerm ? t("myDeliveriesReceiver.noDeliveriesFound") : t("myDeliveriesReceiver.noDeliveriesRegistered")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDeliveries.map((delivery) => {
            const isExpanded = expandedDeliveryId === delivery.id;
            return (
            <div
              key={delivery.id}
              className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 hover:bg-neutral-100 transition-all duration-200"
            >
              {/* Header - Título e código (clicável para toggle) */}
              <div 
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => {
                  console.log('Click - Delivery ID:', delivery.id, 'Current expanded:', expandedDeliveryId, 'Will set to:', expandedDeliveryId === delivery.id ? null : delivery.id);
                  setExpandedDeliveryId(expandedDeliveryId === delivery.id ? null : delivery.id);
                }}
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
                <ChevronDown 
                  className={`w-5 h-5 text-neutral-400 transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} 
                  strokeWidth={2} 
                />
              </div>

              {/* Info do consumidor e data - Toggle */}
              <div 
                className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
              >
                <div className="overflow-hidden">
                  <div className="space-y-2 mt-3 pt-3 border-t border-neutral-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-neutral-600">
                          <UserIcon className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" strokeWidth={2} />
                          <span className="font-bold">{toProperCase(delivery.consumer_name)}</span>
                        </div>
                        {delivery.consumer_address && (
                          <div className="ml-5 mt-1 text-xs text-neutral-500 leading-relaxed">
                            {delivery.consumer_address}
                          </div>
                        )}
                      </div>
                      {(delivery.status === "awaiting_pickup" || delivery.status === "at_receiver") && (
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          {delivery.consumer_phone && (
                            <button
                              onClick={(e) => { e.stopPropagation(); window.open(`tel:${delivery.consumer_phone}`, '_self'); }}
                              className="flex items-center justify-center w-10 h-8 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-colors"
                              title={t("myDeliveriesReceiver.call")}
                            >
                              <Phone className="w-4 h-4" strokeWidth={2} />
                            </button>
                          )}
                          {delivery.consumer_address && (
                            <button
                              onClick={(e) => { e.stopPropagation(); openMaps(delivery.consumer_address!); }}
                              className="flex items-center justify-center w-10 h-8 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-colors"
                              title={t("myDeliveriesReceiver.viewOnMap")}
                            >
                              <MapPin className="w-4 h-4" strokeWidth={2} />
                            </button>
                          )}
                          {delivery.consumer_phone && (
                            <button
                              onClick={(e) => { e.stopPropagation(); openWhatsApp(delivery.consumer_phone!, delivery.title); }}
                              className="flex items-center justify-center w-10 h-8 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                              title={t("myDeliveriesReceiver.contactWhatsApp")}
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {delivery.driver_name && (
                      <div className="flex items-center gap-2 text-xs text-neutral-600">
                        <Package className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" strokeWidth={2} />
                        <span><span className="font-medium">{t("myDeliveriesReceiver.driver")}:</span> {toProperCase(delivery.driver_name)}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-neutral-600">
                      <Calendar className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" strokeWidth={2} />
                      <span>{t("myDeliveriesReceiver.receivedAt")} {new Date(delivery.received_at).toLocaleDateString("pt-BR")} {t("myDeliveriesReceiver.at")} {new Date(delivery.received_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    {delivery.notes && (
                      <div className="flex items-start gap-2 text-xs text-neutral-600">
                        <FileText className="w-3.5 h-3.5 text-neutral-400 mt-0.5 flex-shrink-0" strokeWidth={2} />
                        <span><span className="font-medium">{t("myDeliveriesReceiver.observations")}:</span> {delivery.notes}</span>
                      </div>
                    )}
                    {delivery.secret_word && (
                      <div className="mt-2 px-2.5 py-1.5 bg-violet-50 border border-violet-200 rounded-lg flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-violet-600">Palavra secreta:</span>
                        <span className="text-xs font-semibold text-violet-800">{delivery.secret_word}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Rodapé - Dias armazenados e comissão */}
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-neutral-200 mb-3">
                <div className="text-xs">
                  <span className="text-neutral-500">{t("myDeliveriesReceiver.storedFor")} </span>
                  <span className="font-semibold text-neutral-900">
                    {delivery.days_stored} {delivery.days_stored === 1 ? t("myDeliveriesReceiver.day") : t("myDeliveriesReceiver.days")}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {delivery.commission_amount != null && (
                    <div className="text-xs font-medium text-emerald-600">
                      {t("myDeliveriesReceiver.commission")}: {formatCurrency(delivery.commission_amount, language)}
                    </div>
                  )}
                  {delivery.status === "delivered" && delivery.delivered_at && (
                    <div className="text-xs text-neutral-500">
                      {t("myDeliveriesReceiver.deliveredAt")} {new Date(delivery.delivered_at).toLocaleDateString("pt-BR")}
                    </div>
                  )}
                </div>
              </div>

              {/* Status badges no rodapé */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-neutral-200">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(delivery.status)}`}>
                  {getStatusLabel(delivery.status)}
                </span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getCommissionStatusColor(delivery.sub_status)}`}>
                  {getCommissionStatusLabel(delivery.sub_status)}
                </span>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
