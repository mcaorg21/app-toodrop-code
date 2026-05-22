import { useState, useEffect } from "react";
import { Loader2, Package, ChevronDown, ChevronRight, User, Truck, MapPin, QrCode, Clock, Search, X, Trash2 } from "lucide-react";
import { TooltipLabel } from "@/react-app/components/PersonaLabel";
import { toProperCase } from "@/react-app/lib/utils";
import { Portal } from "@/react-app/components/Portal";
import { useApi } from "@/react-app/hooks/useApi";

interface AuthorizedReceiver {
  droptag_id: number;
  receiver_key: string;
  nickname: string;
  street: string;
  number: string;
  city: string;
  user_name: string;
}

interface DriverDelivery {
  id: number;
  driver_user_id: number;
  droptag_id: number;
  status: string;
  sub_status: string;
  selected_receiver_key: string;
  picked_up_at: string;
  delivered_at: string;
  driver_name: string;
  service_price: number;
  commission_percent: number;
  commission_amount: number;
}

interface ReceiverDelivery {
  id: number;
  receiver_user_id: number;
  droptag_id: number;
  driver_user_id: number;
  status: string;
  sub_status: string;
  received_at: string;
  picked_up_at: string;
  receiver_name: string;
  driver_name: string;
  service_price: number;
  commission_percent: number;
  commission_amount: number;
}

interface DeliveryScan {
  id: number;
  droptag_id: number;
  scan_type: string;
  from_user_type: string;
  to_user_type: string;
  from_user_id: number;
  to_user_id: number;
  from_user_name: string;
  to_user_name: string;
  scanned_at: string;
}

interface Droptag {
  id: number;
  uuid: string;
  tracking_code: string;
  title: string;
  secret_word: string;
  notes: string;
  status: string;
  created_at: string;
  updated_at: string;
  consumer_user_id: number;
  receiver_user_id: number;
  address_id: number;
  consumer_name: string;
  consumer_phone: string;
  receiver_name: string;
  receiver_phone: string;
  address_nickname: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
  receiver_key: string;
  relations: {
    authorizedReceivers: AuthorizedReceiver[];
    driverDeliveries: DriverDelivery[];
    receiverDeliveries: ReceiverDelivery[];
    deliveryScans: DeliveryScan[];
  };
}

export function AdminDroptags() {
  const api = useApi();
  const [droptags, setDroptags] = useState<Droptag[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [deleteModalDroptagId, setDeleteModalDroptagId] = useState<number | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingDroptag, setDeletingDroptag] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    loadDroptags();
  }, []);

  const loadDroptags = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/admin/droptags", { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setDroptags(data);
      }
    } catch (err) {
      console.error("Error loading droptags:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDroptag = async () => {
    if (!deleteModalDroptagId) return;
    setDeletingDroptag(true);
    setDeleteError(null);
    try {
      await api.deleteDroptagAdmin(deleteModalDroptagId, deletePassword);
      setDroptags(droptags.filter(d => d.id !== deleteModalDroptagId));
      setDeleteModalDroptagId(null);
      setDeletePassword("");
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Erro ao deletar droptag");
    } finally {
      setDeletingDroptag(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "created": return "bg-blue-100 text-blue-700";
      case "in_transit": return "bg-amber-100 text-amber-700";
      case "awaiting_pickup": return "bg-purple-100 text-purple-700";
      case "delivered": return "bg-green-100 text-green-700";
      case "cancelled": return "bg-red-100 text-red-700";
      case "completed": return "bg-emerald-100 text-emerald-700";
      case "picked_up": return "bg-blue-100 text-blue-700";
      default: return "bg-neutral-100 text-neutral-700";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "created": return "Criada";
      case "in_transit": return "Em Trânsito";
      case "awaiting_pickup": return "Aguardando Retirada";
      case "delivered": return "Entregue";
      case "cancelled": return "Cancelada";
      case "completed": return "Finalizada";
      case "picked_up": return "Retirado";
      default: return status;
    }
  };



  const getScanTypeLabel = (scanType: string) => {
    switch (scanType) {
      case "pickup": return "Retirada";
      case "delivery": return "Entrega";
      case "transfer": return "Transferência";
      default: return scanType;
    }
  };

  const getUserTypeLabel = (userType: string) => {
    switch (userType) {
      case "consumer": return "Dropper one";
      case "receiver": return "Toodroper";
      case "driver": return "Dropper";
      case "hub": return "Toodroper";
      default: return userType;
    }
  };

  const formatDate = (date: string) => {
    if (!date) return "-";
    return new Date(date).toLocaleString("pt-BR");
  };

  const filteredDroptags = droptags.filter(d => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      d.tracking_code?.toLowerCase().includes(searchLower) ||
      d.title?.toLowerCase().includes(searchLower) ||
      d.consumer_name?.toLowerCase().includes(searchLower) ||
      d.receiver_name?.toLowerCase().includes(searchLower) ||
      d.id.toString().includes(searchLower)
    );
  });

  if (isLoading && droptags.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-soft p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary-100 p-2 rounded-lg">
              <Package className="w-5 h-5 text-primary-700" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-800">DropTags</h1>
              <p className="text-sm text-neutral-500">{filteredDroptags.length} droptags encontradas</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <input
            type="text"
            placeholder="Buscar por código, título, nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-neutral-100 rounded-full"
            >
              <X className="w-4 h-4 text-neutral-400" />
            </button>
          )}
        </div>
      </div>

      {/* DropTags List */}
      <div className="space-y-2">
        {filteredDroptags.map((droptag) => (
          <div key={droptag.id} className="bg-white rounded-xl shadow-soft overflow-hidden">
            {/* Header Row */}
            <div
              onClick={() => setExpandedId(expandedId === droptag.id ? null : droptag.id)}
              className="flex items-center gap-4 p-4 cursor-pointer hover:bg-neutral-50 transition-colors"
            >
              <div className="flex-shrink-0">
                {expandedId === droptag.id ? (
                  <ChevronDown className="w-5 h-5 text-neutral-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-neutral-400" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-neutral-900">{droptag.title || "Sem título"}</span>
                  <span className="font-mono text-xs text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                    {droptag.tracking_code}
                  </span>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(droptag.status)}`}>
                    {getStatusLabel(droptag.status)}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-neutral-500">
                  <span>ID: {droptag.id}</span>
                  <span>Consumidor: {toProperCase(droptag.consumer_name)}</span>
                  <span>{formatDate(droptag.created_at)}</span>
                </div>
              </div>
            </div>

              {/* Expanded Details */}
              {expandedId === droptag.id && (
                <div className="px-4 pb-4 bg-neutral-50 border-t border-neutral-200">
                  {/* Basic Info */}
                  <div className="py-4 grid grid-cols-2 lg:grid-cols-4 gap-4 border-b border-neutral-200">
                    <div>
                      <span className="text-xs text-neutral-500 block mb-1">UUID</span>
                      <p className="font-mono text-xs text-neutral-700 break-all">{droptag.uuid}</p>
                    </div>
                    <div>
                      <span className="text-xs text-neutral-500 block mb-1">Palavra Secreta</span>
                      <p className="text-sm text-neutral-900">{droptag.secret_word || "-"}</p>
                    </div>
                    <div>
                      <span className="text-xs text-neutral-500 block mb-1">Notas</span>
                      <p className="text-sm text-neutral-700">{droptag.notes || "-"}</p>
                    </div>
                    <div>
                      <span className="text-xs text-neutral-500 block mb-1">Atualizada em</span>
                      <p className="text-sm text-neutral-600">{formatDate(droptag.updated_at)}</p>
                    </div>
                  </div>

                  {/* Foreign Keys */}
                  <div className="py-4 border-b border-neutral-200">
                    <h3 className="text-sm font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Relacionamentos Diretos (Foreign Keys)
                    </h3>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div className="bg-white rounded-lg p-3 border border-neutral-200">
                        <span className="text-xs text-neutral-500 block">
                          <TooltipLabel tooltip="Comprador, Consumidor, Consumer">Dropper one</TooltipLabel> (ID usuário)
                        </span>
                        <p className="font-semibold text-neutral-900">{droptag.consumer_user_id} - {toProperCase(droptag.consumer_name)}</p>
                        <p className="text-xs text-neutral-500">{droptag.consumer_phone}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-neutral-200">
                        <span className="text-xs text-neutral-500 block">
                          <TooltipLabel tooltip="Receiver, Recebedor">Toodroper</TooltipLabel> (ID usuário)
                        </span>
                        <p className="font-semibold text-neutral-900">
                          {droptag.receiver_user_id ? `${droptag.receiver_user_id} - ${toProperCase(droptag.receiver_name)}` : "-"}
                        </p>
                        <p className="text-xs text-neutral-500">{droptag.receiver_phone || ""}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-neutral-200">
                        <span className="text-xs text-neutral-500 block">
                          <TooltipLabel tooltip="Entregador, Deliver, Motorista">Dropper</TooltipLabel> (ID usuário)
                        </span>
                        {droptag.relations.driverDeliveries.length > 0 ? (
                          <>
                            <p className="font-semibold text-neutral-900">
                              {droptag.relations.driverDeliveries[0].driver_user_id} - {toProperCase(droptag.relations.driverDeliveries[0].driver_name)}
                            </p>
                          </>
                        ) : (
                          <p className="text-neutral-400">-</p>
                        )}
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-neutral-200">
                        <span className="text-xs text-neutral-500 block">Endereço (ID)</span>
                        <p className="font-semibold text-neutral-900">{droptag.address_id} - {droptag.address_nickname}</p>
                        <p className="text-xs text-neutral-500">{droptag.street}, {droptag.number} - {droptag.city}/{droptag.state}</p>
                        {droptag.receiver_key && (
                          <p className="text-xs text-primary-600 mt-1 font-mono">{droptag.receiver_key}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Authorized Receivers */}
                  <div className="py-4 border-b border-neutral-200">
                    <h3 className="text-sm font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <TooltipLabel tooltip="Receiver, Recebedor">Toodropers</TooltipLabel> Autorizados ({droptag.relations.authorizedReceivers.length})
                    </h3>
                    {droptag.relations.authorizedReceivers.length > 0 ? (
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                        {droptag.relations.authorizedReceivers.map((ar, i) => (
                          <div key={i} className="bg-white rounded-lg p-2 border border-neutral-200 text-xs">
                            <p className="font-mono text-primary-600">{ar.receiver_key}</p>
                            <p className="text-neutral-700">{toProperCase(ar.user_name)} - {ar.nickname}</p>
                            <p className="text-neutral-500">{ar.street}, {ar.number} - {ar.city}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-neutral-500 italic">Nenhum recebedor autorizado</p>
                    )}
                  </div>

                  {/* Driver Deliveries */}
                  <div className="py-4 border-b border-neutral-200">
                    <h3 className="text-sm font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                      <Truck className="w-4 h-4" />
                      Entregas do <TooltipLabel tooltip="Entregador, Deliver, Motorista">Dropper</TooltipLabel> ({droptag.relations.driverDeliveries.length})
                    </h3>
                    {droptag.relations.driverDeliveries.length > 0 ? (
                      <div className="space-y-2">
                        {droptag.relations.driverDeliveries.map((dd) => (
                          <div key={dd.id} className="bg-white rounded-lg p-3 border border-neutral-200 text-sm">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-semibold text-neutral-900">
                                  ID: {dd.id} | <TooltipLabel tooltip="Entregador, Deliver, Motorista">Dropper</TooltipLabel>: {dd.driver_user_id} - {toProperCase(dd.driver_name)}
                                </p>
                                <p className="text-neutral-600">
                                  Status: <span className={`px-1.5 py-0.5 rounded text-xs ${getStatusColor(dd.status)}`}>{getStatusLabel(dd.status)}</span>
                                  <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${dd.sub_status === "commission_paid" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                                    {dd.sub_status === "commission_paid" ? "Comissão Paga" : "Comissão Pendente"}
                                  </span>
                                </p>
                                {dd.selected_receiver_key && (
                                  <p className="text-xs text-neutral-500 font-mono mt-1">Ponto: {dd.selected_receiver_key}</p>
                                )}
                              </div>
                              <div className="text-right text-xs">
                                <p className="text-neutral-500">Retirada: {formatDate(dd.picked_up_at)}</p>
                                <p className="text-neutral-500">Entrega: {formatDate(dd.delivered_at)}</p>
                                {dd.commission_amount && (
                                  <p className="text-green-600 font-semibold mt-1">
                                    Comissão: R$ {dd.commission_amount?.toFixed(2)} ({dd.commission_percent}%)
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-neutral-500 italic">Nenhuma entrega de dropper</p>
                    )}
                  </div>

                  {/* Receiver Deliveries */}
                  <div className="py-4 border-b border-neutral-200">
                    <h3 className="text-sm font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Entregas do <TooltipLabel tooltip="Receiver, Recebedor">Toodroper</TooltipLabel> ({droptag.relations.receiverDeliveries.length})
                    </h3>
                    {droptag.relations.receiverDeliveries.length > 0 ? (
                      <div className="space-y-2">
                        {droptag.relations.receiverDeliveries.map((rd) => (
                          <div key={rd.id} className="bg-white rounded-lg p-3 border border-neutral-200 text-sm">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-semibold text-neutral-900">
                                  ID: {rd.id} | <TooltipLabel tooltip="Receiver, Recebedor">Toodroper</TooltipLabel>: {rd.receiver_user_id} - {toProperCase(rd.receiver_name)}
                                </p>
                                <p className="text-neutral-600">
                                  <TooltipLabel tooltip="Entregador, Deliver, Motorista">Dropper</TooltipLabel>: {rd.driver_user_id} - {toProperCase(rd.driver_name)}
                                </p>
                                <p className="text-neutral-600">
                                  Status: <span className={`px-1.5 py-0.5 rounded text-xs ${getStatusColor(rd.status)}`}>{getStatusLabel(rd.status)}</span>
                                  <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${rd.sub_status === "commission_paid" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                                    {rd.sub_status === "commission_paid" ? "Comissão Paga" : "Comissão Pendente"}
                                  </span>
                                </p>
                              </div>
                              <div className="text-right text-xs">
                                <p className="text-neutral-500">Recebido: {formatDate(rd.received_at)}</p>
                                <p className="text-neutral-500">Retirado: {formatDate(rd.picked_up_at)}</p>
                                {rd.commission_amount && (
                                  <p className="text-green-600 font-semibold mt-1">
                                    Comissão: R$ {rd.commission_amount?.toFixed(2)} ({rd.commission_percent}%)
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-neutral-500 italic">Nenhuma entrega de recebedor</p>
                    )}
                  </div>

                  {/* Delete Button */}
                  <div className="py-4 border-b border-neutral-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteModalDroptagId(droptag.id);
                      }}
                      className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                    >
                      <Trash2 className="w-4 h-4" />
                      Deletar DropTag Permanentemente
                    </button>
                  </div>

                  {/* Delivery Scans */}
                  <div className="py-4">
                    <h3 className="text-sm font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                      <QrCode className="w-4 h-4" />
                      Scans de Entrega ({droptag.relations.deliveryScans.length})
                    </h3>
                    {droptag.relations.deliveryScans.length > 0 ? (
                      <div className="space-y-2">
                        {droptag.relations.deliveryScans.map((ds) => (
                          <div key={ds.id} className="bg-white rounded-lg p-3 border border-neutral-200 text-sm flex justify-between items-center">
                            <div>
                              <p className="font-semibold text-neutral-900">
                                ID: {ds.id} | Tipo: {getScanTypeLabel(ds.scan_type)}
                              </p>
                              <p className="text-neutral-600">
                                {getUserTypeLabel(ds.from_user_type)} ({ds.from_user_id} - {toProperCase(ds.from_user_name) || "-"}) → 
                                {getUserTypeLabel(ds.to_user_type)} ({ds.to_user_id} - {toProperCase(ds.to_user_name) || "-"})
                              </p>
                            </div>
                            <div className="text-right text-xs flex items-center gap-2 text-neutral-500">
                              <Clock className="w-3 h-3" />
                              {formatDate(ds.scanned_at)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-neutral-500 italic">Nenhum scan registrado</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

        {filteredDroptags.length === 0 && (
          <div className="bg-white rounded-xl shadow-soft p-12 text-center text-neutral-500">
            {search ? "Nenhuma droptag encontrada para a busca" : "Nenhuma droptag encontrada"}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalDroptagId && (
        <Portal>
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999]"
            onClick={() => {
              setDeleteModalDroptagId(null);
              setDeletePassword("");
              setDeleteError(null);
            }}
          >
            <div 
              className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-red-100 p-2 rounded-lg">
                  <Trash2 className="w-6 h-6 text-red-700" />
                </div>
                <h2 className="text-xl font-bold text-neutral-900">Deletar DropTag</h2>
              </div>

              <div className="mb-6">
                <p className="text-sm text-neutral-700 mb-4">
                  Esta ação é <strong>irreversível</strong> e deletará permanentemente:
                </p>
                <ul className="text-sm text-neutral-600 space-y-2 ml-4 list-disc">
                  <li>A DropTag (ID: {deleteModalDroptagId})</li>
                  <li>Todas as entregas de motorista relacionadas</li>
                  <li>Todas as entregas de recebedor relacionadas</li>
                  <li>Todos os scans de entrega relacionados</li>
                  <li>Todo histórico de comissão relacionado</li>
                  <li>Todas as cobranças Asaas relacionadas</li>
                </ul>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Digite a senha de administrador para confirmar:
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => {
                    setDeletePassword(e.target.value);
                    setDeleteError(null);
                  }}
                  placeholder="Senha de admin"
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  disabled={deletingDroptag}
                />
                {deleteError && (
                  <p className="mt-2 text-sm text-red-600">{deleteError}</p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setDeleteModalDroptagId(null);
                    setDeletePassword("");
                    setDeleteError(null);
                  }}
                  className="flex-1 px-4 py-2 bg-neutral-100 text-neutral-700 hover:bg-neutral-200 rounded-lg transition-colors"
                  disabled={deletingDroptag}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteDroptag}
                  disabled={deletingDroptag || !deletePassword}
                  className="flex-1 px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deletingDroptag ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deletando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Deletar Permanentemente
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
