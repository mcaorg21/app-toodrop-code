import { useState, useEffect } from "react";
import { useApi } from "@/react-app/hooks/useApi";
import { 
  Search, User, MapPin, Package, Truck, Home, Calendar, Clock, 
  CheckCircle2, XCircle, AlertCircle, Power, Copy, Check, ChevronDown, ChevronRight, X, Shield, Trash2, Pencil, Save
} from "lucide-react";
import { TooltipLabel } from "@/react-app/components/PersonaLabel";
import { toProperCase } from "@/react-app/lib/utils";
import { Portal } from "@/react-app/components/Portal";


// Helper component for copiable field
function CopiableField({ label, value, formatDate = false }: { label: string; value: string | null; formatDate?: boolean }) {
  const [copied, setCopied] = useState(false);
  
  const displayValue = formatDate && value 
    ? new Date(value).toLocaleDateString("pt-BR")
    : value || "-";
  
  const handleCopy = () => {
    if (value) {
      navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };
  
  return (
    <div>
      <span className="text-xs text-neutral-500">{label}</span>
      <div className="flex items-center gap-1.5">
        <p className="font-medium text-sm truncate">{displayValue}</p>
        {value && value !== "-" && (
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-neutral-200 transition-colors flex-shrink-0"
            title="Copiar"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-600" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-neutral-400" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

interface UserListItem {
  id: number;
  full_name: string | null;
  cpf: string | null;
  phone: string | null;
  profile_status: string;
  main_interest: string | null;
  is_consumer_active: number;
  is_receiver_pending: number;
  is_receiver_active: number;
  is_active: number;
  created_at: string;
}

interface UserDetails {
  user: any;
  addresses: any[];
  droptags: any[];
  receiverDocs: any;
  driverDeliveries: any[];
  receiverDeliveries: any[];
  schedules: any[];
  commissionHistory: any[];
  isAdmin: boolean;
}

export function AdminUsers() {
  const api = useApi();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [userDetails, setUserDetails] = useState<{ [key: number]: UserDetails }>({});
  const [loadingDetails, setLoadingDetails] = useState<number | null>(null);
  const [togglingUser, setTogglingUser] = useState<number | null>(null);
  const [togglingAdmin, setTogglingAdmin] = useState<number | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [deleteModalUserId, setDeleteModalUserId] = useState<number | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingUser, setDeletingUser] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [savingUser, setSavingUser] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const profile = await api.fetchProfile();
      if (profile && 'id' in profile) {
        setCurrentUserId(profile.id);
      }
    } catch (error) {
      console.error("Error loading current user:", error);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await api.fetchAllUsers();
      setUsers(data);
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserDetails = async (userId: number) => {
    if (userDetails[userId]) return;
    setLoadingDetails(userId);
    try {
      const data = await api.fetchUserDetails(userId);
      if (data) {
        setUserDetails(prev => ({ ...prev, [userId]: data }));
      }
    } catch (error) {
      console.error("Error loading user details:", error);
    } finally {
      setLoadingDetails(null);
    }
  };

  const handleToggleExpand = async (userId: number) => {
    if (expandedId === userId) {
      setExpandedId(null);
    } else {
      setExpandedId(userId);
      await loadUserDetails(userId);
    }
  };

  const handleToggleActive = async (userId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Check if trying to toggle protected user
    const userToToggle = userDetails[userId];
    if (userToToggle?.user?.email === "mcaorg@gmail.com") {
      return;
    }
    
    setTogglingUser(userId);
    try {
      const result = await api.toggleUserActive(userId);
      if (result) {
        setUsers(users.map(u => 
          u.id === userId ? { ...u, is_active: result.is_active } : u
        ));
        if (userDetails[userId]) {
          setUserDetails(prev => ({
            ...prev,
            [userId]: {
              ...prev[userId],
              user: { ...prev[userId].user, is_active: result.is_active }
            }
          }));
        }
      }
    } catch (error) {
      console.error("Error toggling user status:", error);
    } finally {
      setTogglingUser(null);
    }
  };

  const handleToggleAdmin = async (userId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setTogglingAdmin(userId);
    try {
      const result = await api.toggleUserAdmin(userId);
      if (result?.success) {
        if (userDetails[userId]) {
          setUserDetails(prev => ({
            ...prev,
            [userId]: {
              ...prev[userId],
              isAdmin: result.isAdmin ?? false
            }
          }));
        }
      }
    } catch (error) {
      console.error("Error toggling admin status:", error);
    } finally {
      setTogglingAdmin(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteModalUserId) return;
    
    // Check if trying to delete protected user
    const userToDelete = userDetails[deleteModalUserId];
    if (userToDelete?.user?.email === "mcaorg@gmail.com") {
      setDeleteError("Este usuário não pode ser deletado");
      return;
    }
    
    setDeletingUser(true);
    setDeleteError(null);
    try {
      await api.deleteUser(deleteModalUserId, deletePassword);
      setUsers(users.filter(u => u.id !== deleteModalUserId));
      setDeleteModalUserId(null);
      setDeletePassword("");
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Erro ao deletar usuário");
    } finally {
      setDeletingUser(false);
    }
  };

  const startEditingUser = (userId: number) => {
    const user = userDetails[userId]?.user;
    if (!user) return;
    setEditingUserId(userId);
    setEditFullName(user.full_name || "");
    setEditBirthDate(user.birth_date || "");
    setEditError(null);
  };

  const cancelEditingUser = () => {
    setEditingUserId(null);
    setEditError(null);
  };

  const handleSaveUser = async (userId: number) => {
    const fullName = editFullName.trim();
    if (fullName.length < 2) {
      setEditError("Informe um nome válido.");
      return;
    }
    if (!editBirthDate) {
      setEditError("Informe a data de nascimento.");
      return;
    }

    setSavingUser(true);
    setEditError(null);
    try {
      const result = await api.updateAdminUser(userId, {
        full_name: fullName,
        birth_date: editBirthDate,
      });
      setUsers(prev => prev.map(user =>
        user.id === userId ? { ...user, full_name: result.user.full_name } : user
      ));
      setUserDetails(prev => ({
        ...prev,
        [userId]: {
          ...prev[userId],
          user: { ...prev[userId].user, ...result.user },
        },
      }));
      setEditingUserId(null);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Erro ao atualizar usuário");
    } finally {
      setSavingUser(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const search = searchTerm.toLowerCase();
    return (
      user.full_name?.toLowerCase().includes(search) ||
      user.cpf?.includes(search) ||
      user.phone?.includes(search)
    );
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (user: UserListItem) => {
    if (user.is_active === 0) return "bg-red-100 text-red-700";
    if (user.is_receiver_active) return "bg-green-100 text-green-700";
    if (user.is_receiver_pending) return "bg-amber-100 text-amber-700";
    if (user.profile_status === "complete") return "bg-blue-100 text-blue-700";
    return "bg-neutral-100 text-neutral-600";
  };

  const getStatusLabel = (user: UserListItem) => {
    if (user.is_active === 0) return "Desativado";
    if (user.is_receiver_active) return "Hub Ativo";
    if (user.is_receiver_pending) return "Hub Pendente";
    if (user.profile_status === "complete") return "Completo";
    return "Incompleto";
  };

  const getInterestLabel = (interest: string | null): string => {
    switch (interest) {
      case "consumer": return "Dropper one";
      case "receiver": return "Toodroper";
      case "delivery": return "Dropper";
      default: return "-";
    }
  };

  const getDayName = (day: number) => {
    const days = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    return days[day] || "-";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-neutral-500">
        Carregando...
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
              <User className="w-5 h-5 text-primary-700" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-800">Usuários</h1>
              <p className="text-sm text-neutral-500">{filteredUsers.length} usuários encontrados</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <input
            type="text"
            placeholder="Buscar por nome, CPF ou telefone..."
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
      </div>

      {/* Users List */}
      <div className="space-y-2">
        {filteredUsers.map((user) => (
          <div key={user.id} className="bg-white rounded-xl shadow-soft overflow-hidden">
            {/* User Row Header */}
            <div 
              className={`flex items-center gap-4 p-4 cursor-pointer hover:bg-neutral-50 transition-colors ${user.is_active === 0 ? "opacity-60" : ""}`}
              onClick={() => handleToggleExpand(user.id)}
            >
              <div className="flex-shrink-0">
                {expandedId === user.id ? (
                  <ChevronDown className="w-5 h-5 text-neutral-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-neutral-400" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-neutral-900 truncate">
                    {toProperCase(user.full_name) || "Sem nome"}
                  </span>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(user)}`}>
                    {getStatusLabel(user)}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-neutral-500">
                  <span>{user.cpf || "-"}</span>
                  <span>{user.phone || "-"}</span>
                  <span className="text-xs bg-neutral-100 px-2 py-0.5 rounded">
                    {getInterestLabel(user.main_interest)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-neutral-400">{formatDate(user.created_at)}</span>
                <button
                  onClick={(e) => handleToggleActive(user.id, e)}
                  disabled={togglingUser === user.id || userDetails[user.id]?.user?.email === "mcaorg@gmail.com"}
                  className={`p-2 rounded-lg transition-colors ${
                    userDetails[user.id]?.user?.email === "mcaorg@gmail.com"
                      ? "text-neutral-400 cursor-not-allowed"
                      : user.is_active === 0 
                        ? "text-green-600 hover:bg-green-50" 
                        : "text-red-600 hover:bg-red-50"
                  } ${togglingUser === user.id ? "opacity-50" : ""}`}
                  title={
                    userDetails[user.id]?.user?.email === "mcaorg@gmail.com"
                      ? "Este usuário não pode ser desativado"
                      : user.is_active === 0 
                        ? "Ativar usuário" 
                        : "Desativar usuário"
                  }
                >
                  <Power className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Expanded Details */}
            {expandedId === user.id && (
              <div className="px-4 pb-4 bg-neutral-50 border-t border-neutral-200">
                {loadingDetails === user.id ? (
                  <div className="py-8 text-center text-neutral-500">Carregando detalhes...</div>
                ) : userDetails[user.id] ? (
                  <div className="space-y-4 pt-4">
                    {/* Basic Info */}
                    <div className="py-4 border-b border-neutral-200">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-neutral-800 flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Informações Básicas
                        </h3>
                        {editingUserId !== user.id && (
                          <button
                            type="button"
                            onClick={() => startEditingUser(user.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Editar
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 bg-white rounded-lg p-4 border border-neutral-200">
                        {editingUserId === user.id ? (
                          <>
                            <label className="block">
                              <span className="text-xs text-neutral-500">Nome</span>
                              <input
                                type="text"
                                value={editFullName}
                                onChange={(e) => setEditFullName(e.target.value)}
                                maxLength={150}
                                className="mt-1 w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                            </label>
                            <label className="block">
                              <span className="text-xs text-neutral-500">Data de Nascimento</span>
                              <input
                                type="date"
                                value={editBirthDate}
                                max={new Date().toISOString().slice(0, 10)}
                                onChange={(e) => setEditBirthDate(e.target.value)}
                                className="mt-1 w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                            </label>
                          </>
                        ) : (
                          <>
                            <CopiableField label="Nome" value={toProperCase(userDetails[user.id].user.full_name)} />
                            <CopiableField label="Data de Nascimento" value={userDetails[user.id].user.birth_date} formatDate />
                          </>
                        )}
                        <CopiableField label="CPF" value={userDetails[user.id].user.cpf} />
                        <CopiableField label="Telefone" value={userDetails[user.id].user.phone} />
                        <CopiableField label="Email" value={userDetails[user.id].user.email} />
                        <CopiableField label="Interesse Principal" value={getInterestLabel(userDetails[user.id].user.main_interest)} />
                        <CopiableField label="PIX" value={userDetails[user.id].user.pix_key} />
                        <CopiableField label="ID Asaas Cliente" value={userDetails[user.id].user.id_customer_asaas} />
                        <CopiableField label="ID Asaas Conta" value={userDetails[user.id].user.asaas_account_id} />
                        <CopiableField label="Wallet ID Asaas" value={userDetails[user.id].user.asaas_wallet_id} />
                        {editingUserId === user.id && (
                          <div className="col-span-2 lg:col-span-4">
                            {editError && <p className="mb-2 text-sm text-red-600">{editError}</p>}
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={cancelEditingUser} disabled={savingUser} className="px-3 py-2 text-sm border border-neutral-300 rounded-lg hover:bg-neutral-50 disabled:opacity-50">
                                Cancelar
                              </button>
                              <button type="button" onClick={() => handleSaveUser(user.id)} disabled={savingUser} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50">
                                <Save className="w-4 h-4" />
                                {savingUser ? "Salvando..." : "Salvar"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status & Commissions */}
                    <div className="py-4 border-b border-neutral-200">
                      <h3 className="text-sm font-semibold text-neutral-800 mb-3">Status e Comissões</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white rounded-lg p-4 border border-neutral-200">
                          <span className="text-xs text-neutral-500 block mb-2">Status</span>
                          <div className="flex flex-wrap gap-2">
                            <span className={`px-3 py-1.5 text-sm rounded-full flex items-center gap-1.5 ${
                              userDetails[user.id].user.profile_status === "complete" 
                                ? "bg-green-100 text-green-700" 
                                : "bg-neutral-100 text-neutral-600"
                            }`}>
                              {userDetails[user.id].user.profile_status === "complete" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                              Perfil {userDetails[user.id].user.profile_status === "complete" ? "Completo" : "Incompleto"}
                            </span>
                            {userDetails[user.id].user.is_receiver_active ? (
                              <span className="px-3 py-1.5 text-sm rounded-full bg-green-100 text-green-700 flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4" /> Hub Ativo
                              </span>
                            ) : userDetails[user.id].user.is_receiver_pending ? (
                              <span className="px-3 py-1.5 text-sm rounded-full bg-amber-100 text-amber-700 flex items-center gap-1.5">
                                <AlertCircle className="w-4 h-4" /> Hub Pendente
                              </span>
                            ) : null}
                            <button
                              onClick={(e) => handleToggleAdmin(user.id, e)}
                              disabled={togglingAdmin === user.id || user.id === currentUserId}
                              className={`px-3 py-1.5 text-sm rounded-full flex items-center gap-1.5 transition-colors ${
                                userDetails[user.id].isAdmin
                                  ? "bg-purple-100 text-purple-700 hover:bg-purple-200"
                                  : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                              } ${togglingAdmin === user.id ? "opacity-50 cursor-wait" : ""} ${user.id === currentUserId ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                              title={user.id === currentUserId ? "Você não pode remover seu próprio acesso admin" : userDetails[user.id].isAdmin ? "Remover acesso admin" : "Conceder acesso admin"}
                            >
                              <Shield className="w-4 h-4" />
                              {togglingAdmin === user.id ? "..." : userDetails[user.id].isAdmin ? "Admin" : "Não Admin"}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (userDetails[user.id]?.user?.email !== "mcaorg@gmail.com") {
                                  setDeleteModalUserId(user.id);
                                }
                              }}
                              disabled={userDetails[user.id]?.user?.email === "mcaorg@gmail.com"}
                              className={`px-3 py-1.5 text-sm rounded-full flex items-center gap-1.5 transition-colors ${
                                userDetails[user.id]?.user?.email === "mcaorg@gmail.com"
                                  ? "bg-neutral-100 text-neutral-400 cursor-not-allowed opacity-50"
                                  : "bg-red-100 text-red-700 hover:bg-red-200 cursor-pointer"
                              }`}
                              title={userDetails[user.id]?.user?.email === "mcaorg@gmail.com" ? "Este usuário não pode ser deletado" : "Deletar usuário permanentemente"}
                            >
                              <Trash2 className="w-4 h-4" />
                              Deletar
                            </button>
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-neutral-200">
                          <span className="text-xs text-neutral-500 block mb-2">Comissões</span>
                          <div className="flex items-center gap-4">
                            <div className="text-center">
                              <p className="text-lg font-bold text-green-600">{userDetails[user.id].user.receiver_commission_percent}%</p>
                              <span className="text-xs text-neutral-500">Hub</span>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-blue-600">{userDetails[user.id].user.driver_commission_percent}%</p>
                              <span className="text-xs text-neutral-500">Entregador</span>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-purple-600">{userDetails[user.id].user.platform_commission_percent}%</p>
                              <span className="text-xs text-neutral-500">Plataforma</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Addresses */}
                    {userDetails[user.id].addresses.length > 0 && (
                      <div className="py-4 border-b border-neutral-200">
                        <h3 className="text-sm font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          Endereços ({userDetails[user.id].addresses.length})
                        </h3>
                        <div className="space-y-2">
                          {userDetails[user.id].addresses.map((addr: any) => (
                            <div key={addr.id} className="bg-white rounded-lg p-3 border border-neutral-200 text-sm">
                              <div className="flex items-start justify-between">
                                <div>
                                  {addr.address_type === "consumer" ? (
                                    <TooltipLabel tooltip="Consumer, Consumidor" className="text-xs font-medium text-primary-600 uppercase">DROPPER ONE</TooltipLabel>
                                  ) : addr.address_type === "receiver" ? (
                                    <TooltipLabel tooltip="Receiver, Recebedor" className="text-xs font-medium text-primary-600 uppercase">TOODROPER</TooltipLabel>
                                  ) : (
                                    <span className="text-xs font-medium text-primary-600 uppercase">{addr.address_type}</span>
                                  )}
                                  <p className="font-semibold text-neutral-900">{addr.nickname}</p>
                                  <p className="text-neutral-600">
                                    {addr.street}, {addr.number}{addr.complement ? ` - ${addr.complement}` : ""}
                                  </p>
                                  <p className="text-neutral-500">
                                    {addr.neighborhood}, {addr.city} - {addr.state}
                                  </p>
                                  {/* Coordenadas */}
                                  <div className="mt-2 flex items-center gap-3">
                                    {addr.latitude && addr.longitude ? (
                                      <span className="text-xs font-mono bg-green-50 text-green-700 px-2 py-1 rounded flex items-center gap-1">
                                        <MapPin className="w-3 h-3" />
                                        {Number(addr.latitude).toFixed(6)}, {Number(addr.longitude).toFixed(6)}
                                      </span>
                                    ) : (
                                      <span className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded flex items-center gap-1">
                                        <XCircle className="w-3 h-3" />
                                        Sem coordenadas
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {addr.receiver_key && (
                                  <span className="text-xs font-mono bg-primary-100 text-primary-700 px-2 py-1 rounded">
                                    {addr.receiver_key}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Droptags */}
                    {userDetails[user.id].droptags.length > 0 && (
                      <div className="py-4 border-b border-neutral-200">
                        <h3 className="text-sm font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                          <Package className="w-4 h-4" />
                          Droptags como <TooltipLabel tooltip="Comprador, Consumidor, Consumer">Dropper one</TooltipLabel> ({userDetails[user.id].droptags.length})
                        </h3>
                        <div className="space-y-2">
                          {userDetails[user.id].droptags.map((dt: any) => (
                            <div key={dt.id} className="bg-white rounded-lg p-3 border border-neutral-200 text-sm flex justify-between items-center">
                              <div>
                                <p className="font-semibold text-neutral-900">{dt.title || "-"}</p>
                                <p className="text-xs font-mono text-neutral-500">{dt.tracking_code}</p>
                              </div>
                              <div className="text-right">
                                <span className="px-2 py-0.5 text-xs rounded-full bg-neutral-100">{dt.status}</span>
                                <p className="text-xs text-neutral-400 mt-1">{formatDate(dt.created_at)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Driver Deliveries */}
                    {userDetails[user.id].driverDeliveries.length > 0 && (
                      <div className="py-4 border-b border-neutral-200">
                        <h3 className="text-sm font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                          <Truck className="w-4 h-4" />
                          Entregas como <TooltipLabel tooltip="Entregador, Deliver, Motorista">Dropper</TooltipLabel> ({userDetails[user.id].driverDeliveries.length})
                        </h3>
                        <div className="space-y-2">
                          {userDetails[user.id].driverDeliveries.map((dd: any) => (
                            <div key={dd.id} className="bg-white rounded-lg p-3 border border-neutral-200 text-sm flex justify-between items-center">
                              <div>
                                <p className="font-semibold text-neutral-900">{dd.title || "-"}</p>
                                <p className="text-xs font-mono text-neutral-500">{dd.tracking_code}</p>
                              </div>
                              <div className="text-right">
                                <span className="px-2 py-0.5 text-xs rounded-full bg-neutral-100">{dd.status}</span>
                                <p className="text-xs text-neutral-400 mt-1">{formatDate(dd.created_at)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Receiver Deliveries */}
                    {userDetails[user.id].receiverDeliveries.length > 0 && (
                      <div className="py-4 border-b border-neutral-200">
                        <h3 className="text-sm font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                          <Home className="w-4 h-4" />
                          Recebimentos como <TooltipLabel tooltip="Receiver, Recebedor">Toodroper</TooltipLabel> ({userDetails[user.id].receiverDeliveries.length})
                        </h3>
                        <div className="space-y-2">
                          {userDetails[user.id].receiverDeliveries.map((rd: any) => (
                            <div key={rd.id} className="bg-white rounded-lg p-3 border border-neutral-200 text-sm flex justify-between items-center">
                              <div>
                                <p className="font-semibold text-neutral-900">{rd.title || "-"}</p>
                                <p className="text-xs font-mono text-neutral-500">{rd.tracking_code}</p>
                              </div>
                              <div className="text-right">
                                <span className="px-2 py-0.5 text-xs rounded-full bg-neutral-100">{rd.status}</span>
                                <p className="text-xs text-neutral-400 mt-1">{formatDate(rd.received_at)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Schedules */}
                    {userDetails[user.id].schedules.length > 0 && (
                      <div className="py-4 border-b border-neutral-200">
                        <h3 className="text-sm font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Horários Disponíveis
                        </h3>
                        <div className="bg-white rounded-lg p-4 border border-neutral-200 space-y-2">
                          {userDetails[user.id].schedules.map((sched: any) => (
                            <div key={sched.id} className="flex items-center gap-4 text-sm">
                              <span className="w-20 font-medium text-neutral-700">{getDayName(sched.day_of_week)}</span>
                              <div className="flex items-center gap-2 text-neutral-600">
                                <Clock className="w-4 h-4" />
                                {sched.range1_start && sched.range1_end && (
                                  <span>{sched.range1_start} - {sched.range1_end}</span>
                                )}
                                {sched.range2_start && sched.range2_end && (
                                  <span className="ml-2">{sched.range2_start} - {sched.range2_end}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Timestamps */}
                    <div className="py-4">
                      <div className="flex gap-6 text-xs text-neutral-500">
                        <span>Criado: {formatDate(userDetails[user.id].user.created_at)}</span>
                        <span>Atualizado: {formatDate(userDetails[user.id].user.updated_at)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-neutral-500">Erro ao carregar detalhes</div>
                )}
              </div>
            )}
          </div>
        ))}

        {filteredUsers.length === 0 && (
          <div className="bg-white rounded-xl shadow-soft p-12 text-center text-neutral-500">
            {searchTerm ? "Nenhum usuário encontrado" : "Nenhum usuário cadastrado"}
          </div>
        )}
      </div>

      {/* Delete User Modal */}
      {deleteModalUserId && (
        <Portal>
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[300]">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-red-100 p-2 rounded-lg">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <h2 className="text-lg font-bold text-neutral-800">Deletar Usuário</h2>
              </div>

              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800 font-medium mb-2">⚠️ Atenção: Esta ação é irreversível!</p>
                <p className="text-sm text-red-700">
                  Todos os dados do usuário serão deletados permanentemente, incluindo:
                </p>
                <ul className="text-sm text-red-700 mt-2 ml-4 list-disc">
                  <li>Droptags</li>
                  <li>Entregas como motorista</li>
                  <li>Recebimentos como hub</li>
                  <li>Endereços</li>
                  <li>Histórico de comissões</li>
                </ul>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Senha de Administrador
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => {
                    setDeletePassword(e.target.value);
                    setDeleteError(null);
                  }}
                  placeholder="Digite a senha de admin"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  disabled={deletingUser}
                />
                <p className="text-xs text-neutral-500 mt-1">Digite a senha de administrador para confirmar</p>
              </div>

              {deleteError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{deleteError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setDeleteModalUserId(null);
                    setDeletePassword("");
                    setDeleteError(null);
                  }}
                  disabled={deletingUser}
                  className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteUser}
                  disabled={deletingUser || !deletePassword}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingUser ? "Deletando..." : "Deletar Permanentemente"}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
