import { useState, useEffect, useMemo } from "react";
import { useApi } from "@/react-app/hooks/useApi";
import { ReviewReceiverModal } from "@/react-app/components/ReviewReceiverModal";
import { Loader2, Eye, User, MapPin, FileText, X, ZoomIn, Clock, AlertCircle, CheckCircle, XCircle, RefreshCw, ChevronDown, ChevronRight, Search, Home, Percent, Pencil, Save, Radio, Key, Map, AlertTriangle, MousePointer, Gift } from "lucide-react";
import { TooltipLabel } from "@/react-app/components/PersonaLabel";
import { toProperCase } from "@/react-app/lib/utils";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Map click handler component
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Map controller to fly to searched location
function MapController({ flyTo }: { flyTo: { lat: number; lng: number; zoom: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (flyTo) {
      map.flyTo([flyTo.lat, flyTo.lng], flyTo.zoom, { duration: 1.5 });
    }
  }, [flyTo, map]);
  return null;
}

// Red marker for manual selection
const redMarker = L.divIcon({
  html: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="32" height="48">
      <path fill="#EF4444" stroke="#991B1B" stroke-width="1" d="M12 0C5.4 0 0 5.4 0 12c0 7.2 12 24 12 24s12-16.8 12-24c0-6.6-5.4-12-12-12z"/>
      <circle fill="white" cx="12" cy="12" r="5"/>
    </svg>
  `,
  className: 'custom-marker',
  iconSize: [32, 48],
  iconAnchor: [16, 48],
});

interface MapPickerModalProps {
  address: { street: string; number: string; neighborhood: string; city: string; state: string; cep: string };
  onConfirm: (lat: number, lng: number) => void;
  onClose: () => void;
  isLoading: boolean;
}

function MapPickerModal({ address, onConfirm, onClose, isLoading }: MapPickerModalProps) {
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
  
  // Default center on Brazil
  const defaultCenter = { lat: -14.235, lng: -51.9253 };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const query = encodeURIComponent(searchQuery + ', Brasil');
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`);
      const data = await response.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        setFlyTo({ lat, lng, zoom: 17 });
        setSelectedCoords({ lat, lng });
      }
    } catch (error) {
      console.error('Search error:', error);
    }
    setIsSearching(false);
  };

  // Auto-search with full address on mount
  useEffect(() => {
    const fullAddress = `${address.street}, ${address.number}, ${address.neighborhood}, ${address.city}, ${address.state}`;
    setSearchQuery(fullAddress);
  }, [address]);
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-neutral-200 bg-gradient-to-r from-amber-50 to-orange-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-amber-100 p-2 rounded-lg">
                <MousePointer className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900">Definir Localização Manual</h3>
                <p className="text-sm text-neutral-600">Clique no mapa para marcar a localização do hub</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-neutral-500" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 bg-neutral-50 border-b border-neutral-200">
          <div className="bg-white rounded-lg p-3 border border-neutral-200 mb-3">
            <p className="text-sm font-medium text-neutral-800 mb-1">Endereço:</p>
            <p className="text-sm text-neutral-600">
              {address.street}, {address.number} - {address.neighborhood}
            </p>
            <p className="text-sm text-neutral-600">
              {address.city} - {address.state}, {address.cep}
            </p>
          </div>
          
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Buscar localização..."
              className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-neutral-300 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
            >
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Buscar
            </button>
          </div>
        </div>
        
        <div className="h-[250px] sm:h-[350px] relative">
          <MapContainer
            center={[defaultCenter.lat, defaultCenter.lng]}
            zoom={4}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler onMapClick={(lat, lng) => setSelectedCoords({ lat, lng })} />
            <MapController flyTo={flyTo} />
            {selectedCoords && (
              <Marker position={[selectedCoords.lat, selectedCoords.lng]} icon={redMarker}>
                <Popup>
                  <div className="text-sm">
                    <p className="font-semibold">Localização Selecionada</p>
                    <p className="text-neutral-600">Lat: {selectedCoords.lat.toFixed(6)}</p>
                    <p className="text-neutral-600">Lng: {selectedCoords.lng.toFixed(6)}</p>
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>
          
          {!selectedCoords && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm flex items-center gap-2">
              <MousePointer className="w-4 h-4" />
              Clique no mapa para selecionar
            </div>
          )}
        </div>
        
        {selectedCoords && (
          <div className="p-3 bg-green-50 border-t border-green-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  Coordenadas: {selectedCoords.lat.toFixed(6)}, {selectedCoords.lng.toFixed(6)}
                </span>
              </div>
              <button
                onClick={() => setSelectedCoords(null)}
                className="text-sm text-green-700 hover:text-green-900 underline"
              >
                Limpar
              </button>
            </div>
          </div>
        )}
        </div>
        
        <div className="p-4 border-t border-neutral-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 text-neutral-700 bg-neutral-100 hover:bg-neutral-200 font-medium rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => selectedCoords && onConfirm(selectedCoords.lat, selectedCoords.lng)}
            disabled={!selectedCoords || isLoading}
            className="flex-1 py-3 px-4 text-white bg-green-600 hover:bg-green-700 disabled:bg-neutral-300 disabled:cursor-not-allowed font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Aprovando...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Confirmar e Aprovar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Custom marker icons
const createMarkerIcon = (color: string) => {
  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
      <path fill="${color}" stroke="#333" stroke-width="1" d="M12 0C5.4 0 0 5.4 0 12c0 7.2 12 24 12 24s12-16.8 12-24c0-6.6-5.4-12-12-12z"/>
      <circle fill="white" cx="12" cy="12" r="5"/>
    </svg>
  `;
  return L.divIcon({
    html: svgIcon,
    className: 'custom-marker',
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
  });
};

const blueMarker = createMarkerIcon('#3B82F6');
const yellowMarker = createMarkerIcon('#F59E0B');

interface PendingReceiver {
  user_id: number;
  full_name: string;
  cpf: string;
  phone: string;
  email: string;
  approval_status: 'in_analysis' | 'pending_action' | 'approved' | 'rejected';
  address: {
    nickname: string;
    street: string;
    number: string;
    complement: string | null;
    neighborhood: string;
    city: string;
    state: string;
    cep: string;
    latitude: number | null;
    longitude: number | null;
  };
  docs: {
    id_document_url: string;
    id_document_back_url: string | null;
    selfie_url: string;
    address_proof_url: string;
    address_proof_type: string;
    submitted_at: string;
  };
  commission: {
    service_price: number;
    receiver_percent: number;
    driver_percent: number;
    platform_percent: number;
  };
  hub_status?: {
    is_active: boolean;
    active_hub: boolean;
    last_ping: string | null;
    receiver_key: string | null;
  };
  referral?: {
    referrer_id: number;
    referrer_name: string;
    status: string;
    commission_paid: boolean;
    commission_amount: number | null;
  } | null;
}

interface ImageModalProps {
  imageUrl: string;
  title: string;
  onClose: () => void;
}

function ImageModal({ imageUrl, title, onClose }: ImageModalProps) {
  const [displayUrl, setDisplayUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const safeImageUrl = imageUrl || '';
  const urlParts = safeImageUrl.split('/file/');
  const encodedPath = urlParts[1] || '';
  const decodedPath = decodeURIComponent(encodedPath);
  const isPdf = decodedPath.toLowerCase().endsWith('.pdf');
  
  const absoluteUrl = safeImageUrl.startsWith('http') ? safeImageUrl : `${window.location.origin}${safeImageUrl}`;

  useEffect(() => {
    const loadFile = async () => {
      try {
        setIsLoading(true);
        const urlWithTimestamp = `${absoluteUrl}${absoluteUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
        
        const response = await fetch(urlWithTimestamp, {
          credentials: 'include',
        });
        
        if (!response.ok) {
          throw new Error('Falha ao carregar arquivo');
        }
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        setDisplayUrl(blobUrl);
      } catch (err) {
        console.error('Erro ao carregar arquivo:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadFile();
    
    return () => {
      if (displayUrl && displayUrl.startsWith('blob:')) {
        URL.revokeObjectURL(displayUrl);
      }
    };
  }, [absoluteUrl]);
  
  const handleDownload = async () => {
    if (!displayUrl) return;
    
    try {
      const link = document.createElement('a');
      link.href = displayUrl;
      link.download = `${title}${isPdf ? '.pdf' : '.jpg'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Erro ao baixar arquivo:', err);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-[60] backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="relative max-w-5xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <button
            onClick={onClose}
            className="bg-white hover:bg-neutral-100 text-neutral-900 p-3 rounded-full shadow-strong transition-all"
          >
            <X className="w-6 h-6" strokeWidth={2} />
          </button>
        </div>
        
        <div className="bg-white rounded-2xl overflow-hidden shadow-strong">
          <div className="p-4 border-b border-neutral-200 bg-neutral-50">
            <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
              <ZoomIn className="w-5 h-5" strokeWidth={2} />
              {title}
            </h3>
          </div>
          <div className="p-4 bg-neutral-100 max-h-[calc(90vh-100px)] overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 text-primary-600 animate-spin mx-auto mb-3" strokeWidth={2} />
                  <p className="text-sm text-neutral-600">Carregando arquivo...</p>
                </div>
              </div>
            ) : displayUrl ? (
              isPdf ? (
                <div className="bg-white rounded-xl p-8 text-center">
                  <div className="mb-6">
                    <FileText className="w-16 h-16 text-blue-600 mx-auto mb-4" strokeWidth={2} />
                    <h4 className="text-lg font-semibold text-neutral-900 mb-2">Documento PDF</h4>
                    <p className="text-sm text-neutral-600">Clique no botão abaixo para baixar e visualizar o documento</p>
                  </div>
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-sm active:scale-95"
                  >
                    <FileText className="w-5 h-5" strokeWidth={2} />
                    Baixar PDF
                  </button>
                </div>
              ) : (
                <img 
                  src={displayUrl} 
                  alt={title}
                  className="w-full h-auto rounded-lg shadow-medium"
                />
              )
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminReceiverApprovalsPage() {
  const { fetchReceiverStats, fetchPendingReceivers, approveReceiver, rejectReceiver, setPendingReceiver, updateReceiverCommission, isLoading } = useApi();
  const [stats, setStats] = useState({ inAnalysis: 0, pendingAction: 0, approved: 0, rejected: 0 });
  const [pendingReceivers, setPendingReceivers] = useState<PendingReceiver[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [viewingImage, setViewingImage] = useState<{ url: string; title: string } | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'inAnalysis' | 'pendingAction' | 'approved' | 'rejected'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showMap, setShowMap] = useState(false);
  
  // Commission editing state
  const [editingCommissionId, setEditingCommissionId] = useState<number | null>(null);
  const [editCommission, setEditCommission] = useState<{
    service_price: number;
    receiver_percent: number;
    driver_percent: number;
    platform_percent: number;
  } | null>(null);
  const [commissionError, setCommissionError] = useState<string | null>(null);
  const [savingCommission, setSavingCommission] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  
  // Referral info modal
  const [referralModalReceiver, setReferralModalReceiver] = useState<PendingReceiver | null>(null);

  // Map picker state for manual coordinates
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapPickerAddress, setMapPickerAddress] = useState<{ street: string; number: string; neighborhood: string; city: string; state: string; cep: string } | null>(null);
  const [mapPickerUserId, setMapPickerUserId] = useState<number | null>(null);
  const [isApprovingWithCoords, setIsApprovingWithCoords] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadReceivers();
  }, [activeFilter]);

  const loadData = async () => {
    const statsData = await fetchReceiverStats();
    setStats(statsData);
    await loadReceivers();
  };

  const loadReceivers = async () => {
    const receiversData = await fetchPendingReceivers(activeFilter);
    setPendingReceivers(receiversData);
  };

  const handleApprove = async (notes?: string) => {
    const receiver = pendingReceivers.find(r => r.user_id === expandedId);
    if (!receiver) return;
    setApprovalError(null);
    const result = await approveReceiver(receiver.user_id, notes);
    if (result.success) {
      await loadData();
      setExpandedId(null);
      setShowReviewModal(false);
    } else if (result.needs_coordinates && result.address) {
      // Show map picker for manual coordinate selection
      setShowReviewModal(false);
      setMapPickerAddress(result.address);
      setMapPickerUserId(receiver.user_id);
      setShowMapPicker(true);
    } else {
      setShowReviewModal(false);
      setApprovalError(result.error || "Erro ao aprovar o hub");
    }
  };

  const handleApproveWithCoords = async (lat: number, lng: number) => {
    if (!mapPickerUserId) return;
    setIsApprovingWithCoords(true);
    const result = await approveReceiver(mapPickerUserId, undefined, lat, lng);
    if (result.success) {
      await loadData();
      setShowMapPicker(false);
      setMapPickerAddress(null);
      setMapPickerUserId(null);
      setExpandedId(null);
    } else {
      setShowMapPicker(false);
      setApprovalError(result.error || "Erro ao aprovar o hub");
    }
    setIsApprovingWithCoords(false);
  };

  const handleReject = async (notes: string) => {
    const receiver = pendingReceivers.find(r => r.user_id === expandedId);
    if (!receiver) return;
    const success = await rejectReceiver(receiver.user_id, notes);
    if (success) {
      await loadData();
      setExpandedId(null);
      setShowReviewModal(false);
    }
  };

  const handleSetPending = async (notes: string) => {
    const receiver = pendingReceivers.find(r => r.user_id === expandedId);
    if (!receiver) return;
    const success = await setPendingReceiver(receiver.user_id, notes);
    if (success) {
      await loadData();
      setExpandedId(null);
      setShowReviewModal(false);
    }
  };

  const startEditingCommission = (receiver: PendingReceiver) => {
    setEditingCommissionId(receiver.user_id);
    setEditCommission({
      service_price: receiver.commission.service_price,
      receiver_percent: receiver.commission.receiver_percent,
      driver_percent: receiver.commission.driver_percent,
      platform_percent: receiver.commission.platform_percent,
    });
    setCommissionError(null);
  };

  const cancelEditingCommission = () => {
    setEditingCommissionId(null);
    setEditCommission(null);
    setCommissionError(null);
  };

  const handleCommissionChange = (field: 'service_price' | 'receiver_percent' | 'driver_percent' | 'platform_percent', value: string) => {
    if (!editCommission) return;
    
    const numValue = parseFloat(value) || 0;
    const updated = { ...editCommission, [field]: numValue };
    
    // Validate total doesn't exceed 100%
    const total = updated.receiver_percent + updated.driver_percent + updated.platform_percent;
    if (total > 100 && field !== 'service_price') {
      setCommissionError(`Total das comissões não pode exceder 100% (atual: ${total}%)`);
    } else if (total < 100 && field !== 'service_price') {
      setCommissionError(`Total das comissões deve ser exatamente 100% (atual: ${total}%)`);
    } else {
      setCommissionError(null);
    }
    
    setEditCommission(updated);
  };

  const saveCommission = async () => {
    if (!editCommission || !editingCommissionId) return;
    
    const total = editCommission.receiver_percent + editCommission.driver_percent + editCommission.platform_percent;
    if (total !== 100) {
      setCommissionError(`Total das comissões deve ser exatamente 100% (atual: ${total}%)`);
      return;
    }
    
    if (editCommission.service_price <= 0) {
      setCommissionError('Preço do serviço deve ser maior que zero');
      return;
    }
    
    if (editCommission.receiver_percent < 0 || editCommission.driver_percent < 0 || editCommission.platform_percent < 0) {
      setCommissionError('Percentuais não podem ser negativos');
      return;
    }
    
    setSavingCommission(true);
    setCommissionError(null);
    
    const result = await updateReceiverCommission(editingCommissionId, editCommission);
    
    if (result.success) {
      // Update local state
      setPendingReceivers(prev => prev.map(r => 
        r.user_id === editingCommissionId 
          ? { ...r, commission: editCommission }
          : r
      ));
      setEditingCommissionId(null);
      setEditCommission(null);
    } else {
      setCommissionError(result.error || 'Erro ao salvar comissão');
    }
    
    setSavingCommission(false);
  };

  const getProofTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      water: "Conta de Água",
      electricity: "Conta de Luz",
      internet: "Conta de Internet",
      cable_tv: "Conta de TV a Cabo",
    };
    return types[type] || type;
  };

  const handleViewImage = (url: string, title: string) => {
    setViewingImage({ url, title });
  };

  const filteredReceivers = pendingReceivers
    .filter(receiver => {
      const search = searchTerm.toLowerCase();
      return (
        receiver.full_name.toLowerCase().includes(search) ||
        (receiver.email?.toLowerCase() || '').includes(search) ||
        receiver.cpf.includes(search) ||
        receiver.phone.includes(search) ||
        (receiver.address?.nickname?.toLowerCase() || '').includes(search) ||
        (receiver.address?.city?.toLowerCase() || '').includes(search) ||
        (receiver.address?.neighborhood?.toLowerCase() || '').includes(search) ||
        (receiver.address?.street?.toLowerCase() || '').includes(search) ||
        (receiver.hub_status?.receiver_key?.toLowerCase() || '').includes(search)
      );
    })
    .sort((a, b) => {
      // "Em Análise" always appears first, regardless of creation date
      const aFirst = a.approval_status === 'in_analysis' ? 0 : 1;
      const bFirst = b.approval_status === 'in_analysis' ? 0 : 1;
      return aFirst - bFirst;
    });

  // Calculate map center and markers
  const hubsWithCoordinates = useMemo(() => {
    return pendingReceivers.filter(r => r.address.latitude && r.address.longitude);
  }, [pendingReceivers]);

  const mapCenter = useMemo(() => {
    if (hubsWithCoordinates.length === 0) return { lat: -23.5505, lng: -46.6333 }; // São Paulo default
    const avgLat = hubsWithCoordinates.reduce((sum, r) => sum + (r.address.latitude || 0), 0) / hubsWithCoordinates.length;
    const avgLng = hubsWithCoordinates.reduce((sum, r) => sum + (r.address.longitude || 0), 0) / hubsWithCoordinates.length;
    return { lat: avgLat, lng: avgLng };
  }, [hubsWithCoordinates]);

  if (isLoading && pendingReceivers.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" strokeWidth={2} />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Mini Dashboard - Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => setActiveFilter(activeFilter === 'inAnalysis' ? 'all' : 'inAnalysis')}
            className={`bg-white rounded-xl shadow-soft p-4 text-left transition-all ${
              activeFilter === 'inAnalysis' 
                ? 'ring-2 ring-blue-200' 
                : 'hover:shadow-medium'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-neutral-500">Em Análise</span>
            </div>
            <p className="text-lg font-bold text-blue-600">{stats.inAnalysis}</p>
          </button>

          <button
            onClick={() => setActiveFilter(activeFilter === 'pendingAction' ? 'all' : 'pendingAction')}
            className={`bg-white rounded-xl shadow-soft p-4 text-left transition-all ${
              activeFilter === 'pendingAction' 
                ? 'ring-2 ring-amber-200' 
                : 'hover:shadow-medium'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span className="text-xs text-neutral-500">Pendente</span>
            </div>
            <p className="text-lg font-bold text-amber-600">{stats.pendingAction}</p>
          </button>

          <button
            onClick={() => setActiveFilter(activeFilter === 'approved' ? 'all' : 'approved')}
            className={`bg-white rounded-xl shadow-soft p-4 text-left transition-all ${
              activeFilter === 'approved' 
                ? 'ring-2 ring-green-200' 
                : 'hover:shadow-medium'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-xs text-neutral-500">Aprovados</span>
            </div>
            <p className="text-lg font-bold text-green-600">{stats.approved}</p>
          </button>

          <button
            onClick={() => setActiveFilter(activeFilter === 'rejected' ? 'all' : 'rejected')}
            className={`bg-white rounded-xl shadow-soft p-4 text-left transition-all ${
              activeFilter === 'rejected' 
                ? 'ring-2 ring-red-200' 
                : 'hover:shadow-medium'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-4 h-4 text-red-600" />
              <span className="text-xs text-neutral-500">Rejeitados</span>
            </div>
            <p className="text-lg font-bold text-red-600">{stats.rejected}</p>
          </button>
        </div>

        {/* Map Section */}
        <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
          <button
            onClick={() => setShowMap(!showMap)}
            className="w-full flex items-center justify-between p-4 hover:bg-neutral-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Map className="w-5 h-5 text-blue-700" />
              </div>
              <div className="text-left">
                <h2 className="text-lg font-semibold text-neutral-800">Mapa de Hubs</h2>
                <p className="text-sm text-neutral-500">
                  {hubsWithCoordinates.length} hubs com coordenadas
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                  Aprovados
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                  Pendentes
                </span>
              </div>
              {showMap ? (
                <ChevronDown className="w-5 h-5 text-neutral-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-neutral-400" />
              )}
            </div>
          </button>
          
          {showMap && (
            <div className="border-t border-neutral-200">
              <div className="h-[400px] w-full">
                {hubsWithCoordinates.length > 0 ? (
                  <MapContainer
                    center={[mapCenter.lat, mapCenter.lng]}
                    zoom={12}
                    style={{ height: '100%', width: '100%' }}
                    scrollWheelZoom={true}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {hubsWithCoordinates.map((receiver) => (
                      <Marker
                        key={receiver.user_id}
                        position={[receiver.address.latitude!, receiver.address.longitude!]}
                        icon={receiver.approval_status === 'approved' ? blueMarker : yellowMarker}
                      >
                        <Popup>
                          <div className="text-sm">
                            <p className="font-semibold">{toProperCase(receiver.full_name)}</p>
                            <p className="text-neutral-600">{receiver.address.nickname}</p>
                            <p className="text-neutral-500 text-xs mt-1">
                              {receiver.address.street}, {receiver.address.number}
                            </p>
                            <p className="text-neutral-500 text-xs">
                              {receiver.address.neighborhood} - {receiver.address.city}
                            </p>
                            <p className={`mt-2 text-xs font-medium ${
                              receiver.approval_status === 'approved' ? 'text-blue-600' : 'text-amber-600'
                            }`}>
                              {receiver.approval_status === 'approved' ? '● Aprovado' : 
                               receiver.approval_status === 'in_analysis' ? '● Em Análise' :
                               receiver.approval_status === 'pending_action' ? '● Pendente' : '● Rejeitado'}
                            </p>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                ) : (
                  <div className="h-full flex items-center justify-center bg-neutral-50">
                    <div className="text-center">
                      <MapPin className="w-12 h-12 text-neutral-300 mx-auto mb-2" />
                      <p className="text-neutral-500">Nenhum hub com coordenadas cadastradas</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Header with Search */}
        <div className="bg-white rounded-2xl shadow-soft p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary-100 p-2 rounded-lg">
                <Home className="w-5 h-5 text-primary-700" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-neutral-800">Gerir Hubs</h1>
                <p className="text-sm text-neutral-500">{filteredReceivers.length} hubs encontrados</p>
              </div>
            </div>
            <button
              onClick={loadData}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
              title="Atualizar lista"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} strokeWidth={2} />
              Atualizar
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar por nome, e-mail, CPF, telefone, endereço, cidade, bairro ou chave..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-neutral-100 rounded-full"
              >
                <X className="w-4 h-4 text-neutral-400" />
              </button>
            )}
          </div>

          {activeFilter !== 'all' && (
            <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-2 flex items-center justify-between">
              <span className="text-sm text-blue-700 font-medium">
                Filtro ativo: {
                  activeFilter === 'inAnalysis' ? 'Em Análise' :
                  activeFilter === 'pendingAction' ? 'Pendente' :
                  activeFilter === 'approved' ? 'Aprovados' :
                  'Reprovados'
                }
              </span>
              <button
                onClick={() => setActiveFilter('all')}
                className="text-sm text-blue-600 hover:text-blue-800 font-semibold"
              >
                Limpar filtro
              </button>
            </div>
          )}

          {approvalError && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-800 font-medium">Erro ao aprovar hub</p>
                <p className="text-sm text-red-700 mt-1">{approvalError}</p>
              </div>
              <button
                onClick={() => setApprovalError(null)}
                className="p-1 hover:bg-red-100 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-red-600" />
              </button>
            </div>
          )}
        </div>

        {/* Receivers List */}
        <div className="space-y-2">
          {filteredReceivers.map((receiver) => (
            <div key={receiver.user_id} className="bg-white rounded-xl shadow-soft overflow-hidden">
              {/* Receiver Row Header */}
              <div 
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-neutral-50 transition-colors"
                onClick={() => setExpandedId(expandedId === receiver.user_id ? null : receiver.user_id)}
              >
                <div className="flex-shrink-0">
                  {expandedId === receiver.user_id ? (
                    <ChevronDown className="w-5 h-5 text-neutral-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-neutral-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-neutral-900 truncate">
                    {toProperCase(receiver.full_name)}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-500">
                    <span>E-mail: {receiver.email || '-'}</span>
                    <span>CPF: {receiver.cpf}</span>
                    <span>Tel: {receiver.phone}</span>
                  </div>
                </div>

                {/* Status Badges */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Approval Status */}
                  {receiver.approval_status === 'approved' && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      <CheckCircle className="w-3 h-3" />
                      Aprovado
                    </span>
                  )}
                  {receiver.approval_status === 'in_analysis' && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      <Clock className="w-3 h-3" />
                      Em Análise
                    </span>
                  )}
                  {receiver.approval_status === 'pending_action' && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                      <AlertCircle className="w-3 h-3" />
                      Pendente
                    </span>
                  )}
                  {receiver.approval_status === 'rejected' && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                      <XCircle className="w-3 h-3" />
                      Rejeitado
                    </span>
                  )}
                  
                  {/* Referral badge */}
                  {receiver.referral && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setReferralModalReceiver(receiver); }}
                      title={`Indicado por ${toProperCase(receiver.referral.referrer_name)}`}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
                    >
                      <Gift className="w-3 h-3" />
                      Indicado
                    </button>
                  )}

                  {/* Hub Status - only for approved */}
                  {receiver.approval_status === 'approved' && receiver.hub_status && (
                    receiver.hub_status.is_active && receiver.hub_status.active_hub ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                        <Radio className="w-3 h-3" />
                        Ativo
                      </span>
                    ) : receiver.hub_status.is_active && !receiver.hub_status.active_hub ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        <Radio className="w-3 h-3" />
                        Desativado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600">
                        <Radio className="w-3 h-3" />
                        Inativo
                      </span>
                    )
                  )}
                </div>

                <div className="flex items-center gap-2 text-sm text-neutral-500 flex-shrink-0">
                  <MapPin className="w-4 h-4" />
                  <span className="truncate max-w-[200px]">
                    {receiver.address.city}/{receiver.address.state}
                  </span>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === receiver.user_id && (
                <div className="px-4 pb-4 bg-neutral-50 border-t border-neutral-200">
                  <div className="space-y-4 pt-4">
                    {/* Personal Data */}
                    <div className="py-4 border-b border-neutral-200">
                      <h3 className="text-sm font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Dados Pessoais
                      </h3>
                      <div className="bg-white rounded-lg p-4 border border-neutral-200 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-neutral-600">Nome Completo:</span>
                          <span className="font-semibold text-neutral-900">{toProperCase(receiver.full_name)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-600">CPF:</span>
                          <span className="font-semibold text-neutral-900">{receiver.cpf}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-600">Telefone:</span>
                          <span className="font-semibold text-neutral-900">{receiver.phone}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-neutral-600">E-mail:</span>
                          <span className="font-semibold text-neutral-900 break-all text-right">{receiver.email || '-'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Address */}
                    <div className="py-4 border-b border-neutral-200">
                      <h3 className="text-sm font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Endereço do Ponto
                      </h3>
                      <div className="bg-white rounded-lg p-4 border border-neutral-200 text-sm">
                        <p className="font-semibold text-neutral-900 mb-2">{receiver.address.nickname}</p>
                        <div className="text-neutral-600 space-y-1">
                          <p>{receiver.address.street}, {receiver.address.number}</p>
                          {receiver.address.complement && <p>{receiver.address.complement}</p>}
                          <p>{receiver.address.neighborhood}</p>
                          <p>{receiver.address.city} - {receiver.address.state}</p>
                          <p>CEP: {receiver.address.cep}</p>
                          {receiver.address.latitude && receiver.address.longitude ? (
                            <p className="mt-2 pt-2 border-t border-neutral-100 flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                <MapPin className="w-3 h-3" />
                                {receiver.address.latitude.toFixed(6)}, {receiver.address.longitude.toFixed(6)}
                              </span>
                            </p>
                          ) : (
                            <p className="mt-2 pt-2 border-t border-neutral-100 flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                <MapPin className="w-3 h-3" />
                                Sem coordenadas
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Hub Status */}
                    {receiver.hub_status && (
                      <div className="py-4 border-b border-neutral-200">
                        <h3 className="text-sm font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                          <Radio className="w-4 h-4" />
                          Status do Hub
                        </h3>
                        <div className="bg-white rounded-lg p-4 border border-neutral-200 space-y-3 text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-neutral-600">Status do Ponto:</span>
                            {receiver.hub_status.is_active ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                Ativo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600">
                                <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full"></span>
                                Inativo
                              </span>
                            )}
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-neutral-600">Aceita Entregas:</span>
                            {receiver.hub_status.active_hub ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                <CheckCircle className="w-3.5 h-3.5" />
                                Sim
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                <XCircle className="w-3.5 h-3.5" />
                                Não
                              </span>
                            )}
                          </div>
                          {receiver.hub_status.receiver_key && (
                            <div className="flex justify-between items-center">
                              <span className="text-neutral-600 flex items-center gap-1.5">
                                <Key className="w-3.5 h-3.5" />
                                Receiver Key:
                              </span>
                              <span className="font-mono text-xs bg-neutral-100 px-2 py-1 rounded text-neutral-700">
                                {receiver.hub_status.receiver_key}
                              </span>
                            </div>
                          )}

                        </div>
                      </div>
                    )}

                    {/* Documents */}
                    <div className="py-4 border-b border-neutral-200">
                      <h3 className="text-sm font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Documentação
                      </h3>
                      <div className="space-y-2">
                        {receiver.docs.id_document_back_url ? (
                          <>
                            <div className="bg-white rounded-lg p-3 border border-neutral-200 text-sm flex items-center justify-between">
                              <span className="font-medium text-neutral-700">Documento de Identificação - Frente</span>
                              <button
                                onClick={() => handleViewImage(receiver.docs.id_document_url, "Documento de Identificação - Frente")}
                                className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
                              >
                                <Eye className="w-4 h-4" />
                                Visualizar
                              </button>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-neutral-200 text-sm flex items-center justify-between">
                              <span className="font-medium text-neutral-700">Documento de Identificação - Verso</span>
                              <button
                                onClick={() => handleViewImage(receiver.docs.id_document_back_url!, "Documento de Identificação - Verso")}
                                className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
                              >
                                <Eye className="w-4 h-4" />
                                Visualizar
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="bg-white rounded-lg p-3 border border-neutral-200 text-sm flex items-center justify-between">
                            <span className="font-medium text-neutral-700">Documento de Identificação</span>
                            <button
                              onClick={() => handleViewImage(receiver.docs.id_document_url, "Documento de Identificação")}
                              className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
                            >
                              <Eye className="w-4 h-4" />
                              Visualizar
                            </button>
                          </div>
                        )}

                        <div className="bg-white rounded-lg p-3 border border-neutral-200 text-sm flex items-center justify-between">
                          <span className="font-medium text-neutral-700">Selfie com Documento</span>
                          <button
                            onClick={() => handleViewImage(receiver.docs.selfie_url, "Selfie com Documento")}
                            className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
                          >
                            <Eye className="w-4 h-4" />
                            Visualizar
                          </button>
                        </div>

                        <div className="bg-white rounded-lg p-3 border border-neutral-200 text-sm flex items-center justify-between">
                          <span className="font-medium text-neutral-700">
                            Comprovante de Endereço ({getProofTypeLabel(receiver.docs.address_proof_type)})
                          </span>
                          <button
                            onClick={() => handleViewImage(receiver.docs.address_proof_url, `Comprovante de Endereço - ${getProofTypeLabel(receiver.docs.address_proof_type)}`)}
                            className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
                          >
                            <Eye className="w-4 h-4" />
                            Visualizar
                          </button>
                        </div>

                        <p className="text-xs text-neutral-500 text-center pt-2">
                          Documentos enviados em {new Date(receiver.docs.submitted_at).toLocaleDateString("pt-BR")} às {new Date(receiver.docs.submitted_at).toLocaleTimeString("pt-BR")}
                        </p>
                      </div>
                    </div>

                    {/* Commission Configuration */}
                    {receiver.commission && (
                      <div className="py-4 border-b border-neutral-200">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-neutral-800 flex items-center gap-2">
                            <Percent className="w-4 h-4" />
                            Configuração de Comissão
                          </h3>
                          {editingCommissionId !== receiver.user_id && (
                            <button
                              onClick={() => startEditingCommission(receiver)}
                              className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Editar
                            </button>
                          )}
                        </div>
                        
                        {editingCommissionId === receiver.user_id && editCommission ? (
                          <div className="bg-white rounded-lg p-4 border border-primary-200 space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-neutral-600 text-sm">Preço do Serviço:</span>
                              <div className="flex items-center gap-1">
                                <span className="text-neutral-500 text-sm">R$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={editCommission.service_price}
                                  onChange={(e) => handleCommissionChange('service_price', e.target.value)}
                                  className="w-20 text-right font-semibold text-neutral-900 border border-neutral-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                              </div>
                            </div>
                            <div className="border-t border-neutral-100 pt-3 space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-neutral-600 text-sm">Comissão do <TooltipLabel tooltip="Receiver, Recebedor">Toodroper</TooltipLabel>:</span>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={editCommission.receiver_percent}
                                    onChange={(e) => handleCommissionChange('receiver_percent', e.target.value)}
                                    className="w-16 text-right font-semibold text-green-600 border border-neutral-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                  />
                                  <span className="text-green-600 font-semibold">%</span>
                                </div>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-neutral-600 text-sm">Comissão do <TooltipLabel tooltip="Entregador, Deliver, Motorista">Dropper</TooltipLabel>:</span>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={editCommission.driver_percent}
                                    onChange={(e) => handleCommissionChange('driver_percent', e.target.value)}
                                    className="w-16 text-right font-semibold text-blue-600 border border-neutral-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                  />
                                  <span className="text-blue-600 font-semibold">%</span>
                                </div>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-neutral-600 text-sm">Comissão da Plataforma:</span>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={editCommission.platform_percent}
                                    onChange={(e) => handleCommissionChange('platform_percent', e.target.value)}
                                    className="w-16 text-right font-semibold text-amber-600 border border-neutral-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                  />
                                  <span className="text-amber-600 font-semibold">%</span>
                                </div>
                              </div>
                            </div>
                            
                            {commissionError && (
                              <div className="bg-red-50 border border-red-200 rounded-lg p-2 mt-2">
                                <p className="text-red-600 text-xs flex items-center gap-1">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  {commissionError}
                                </p>
                              </div>
                            )}
                            
                            <div className="border-t border-neutral-100 pt-3">
                              <div className="flex justify-between items-center text-xs text-neutral-500 mb-3">
                                <span>Total das comissões:</span>
                                <span className={`font-medium ${
                                  editCommission.receiver_percent + editCommission.driver_percent + editCommission.platform_percent === 100
                                    ? 'text-green-600'
                                    : 'text-red-600'
                                }`}>
                                  {editCommission.receiver_percent + editCommission.driver_percent + editCommission.platform_percent}%
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={cancelEditingCommission}
                                  className="flex-1 py-2 px-3 text-sm font-medium text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
                                >
                                  Cancelar
                                </button>
                                <button
                                  onClick={saveCommission}
                                  disabled={savingCommission || editCommission.receiver_percent + editCommission.driver_percent + editCommission.platform_percent !== 100}
                                  className="flex-1 py-2 px-3 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-1.5"
                                >
                                  {savingCommission ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      <Save className="w-4 h-4" />
                                      Salvar
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-white rounded-lg p-4 border border-neutral-200 space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-neutral-600 text-sm">Preço do Serviço:</span>
                              <span className="font-semibold text-neutral-900 text-lg">
                                R$ {receiver.commission.service_price.toFixed(2).replace('.', ',')}
                              </span>
                            </div>
                            <div className="border-t border-neutral-100 pt-3 space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-neutral-600 text-sm">Comissão do <TooltipLabel tooltip="Receiver, Recebedor">Toodroper</TooltipLabel>:</span>
                                <span className="font-semibold text-green-600">
                                  {receiver.commission.receiver_percent}%
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-neutral-600 text-sm">Comissão do <TooltipLabel tooltip="Entregador, Deliver, Motorista">Dropper</TooltipLabel>:</span>
                                <span className="font-semibold text-blue-600">
                                  {receiver.commission.driver_percent}%
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-neutral-600 text-sm">Comissão da Plataforma:</span>
                                <span className="font-semibold text-amber-600">
                                  {receiver.commission.platform_percent}%
                                </span>
                              </div>
                            </div>
                            <div className="border-t border-neutral-100 pt-3">
                              <div className="flex justify-between items-center text-xs text-neutral-500">
                                <span>Valores calculados sobre o preço do serviço</span>
                                <span className="font-medium">
                                  Total: {receiver.commission.receiver_percent + receiver.commission.driver_percent + receiver.commission.platform_percent}%
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="pt-4">
                      <button
                        onClick={() => {
                          setApprovalError(null);
                          setShowReviewModal(true);
                        }}
                        className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-sm active:scale-95"
                      >
                        Revisar Cadastro
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {filteredReceivers.length === 0 && (
            <div className="bg-white rounded-xl shadow-soft p-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-100 rounded-2xl mb-4">
                <User className="w-8 h-8 text-neutral-400" strokeWidth={2} />
              </div>
              <p className="text-neutral-600">
                {searchTerm ? 'Nenhum hub encontrado com os filtros aplicados' : 'Nenhum hub aguardando aprovação'}
              </p>
            </div>
          )}
        </div>
      </div>

      {referralModalReceiver?.referral && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[300] backdrop-blur-sm" onClick={() => setReferralModalReceiver(null)}>
          <div className="bg-white rounded-3xl shadow-strong w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 p-2 rounded-xl">
                  <Gift className="w-5 h-5 text-purple-600" />
                </div>
                <h2 className="text-lg font-bold text-neutral-900">Indicação</h2>
              </div>
              <button onClick={() => setReferralModalReceiver(null)} className="text-neutral-400 hover:text-neutral-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Ponto indicado</p>
                <p className="font-semibold text-neutral-900">{toProperCase(referralModalReceiver.full_name)}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Indicado por</p>
                <p className="font-semibold text-neutral-900">{toProperCase(referralModalReceiver.referral.referrer_name)}</p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Status da indicação</p>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                    referralModalReceiver.referral.status === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : referralModalReceiver.referral.status === 'registered'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-neutral-100 text-neutral-600'
                  }`}>
                    {referralModalReceiver.referral.status === 'approved' ? 'Aprovada' :
                     referralModalReceiver.referral.status === 'registered' ? 'Registrada' : 'Pendente'}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Comissão</p>
                  {referralModalReceiver.referral.commission_paid ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      <CheckCircle className="w-3 h-3" />
                      R$ {(referralModalReceiver.referral.commission_amount ?? 30).toFixed(2)} pago
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                      <Clock className="w-3 h-3" />
                      Aguardando
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewingImage && (
        <ImageModal
          imageUrl={viewingImage.url}
          title={viewingImage.title}
          onClose={() => setViewingImage(null)}
        />
      )}

      {showReviewModal && expandedId && (
        <ReviewReceiverModal
          onClose={() => setShowReviewModal(false)}
          onApprove={handleApprove}
          onReject={handleReject}
          onSetPending={handleSetPending}
          receiverName={toProperCase(pendingReceivers.find(r => r.user_id === expandedId)?.full_name) || ""}
        />
      )}

      {showMapPicker && mapPickerAddress && (
        <MapPickerModal
          address={mapPickerAddress}
          onConfirm={handleApproveWithCoords}
          onClose={() => {
            setShowMapPicker(false);
            setMapPickerAddress(null);
            setMapPickerUserId(null);
          }}
          isLoading={isApprovingWithCoords}
        />
      )}
    </>
  );
}
