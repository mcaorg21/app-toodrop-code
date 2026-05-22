import { useState, useEffect } from "react";
import { ArrowDownToLine, Check, X, Loader2, AlertCircle } from "lucide-react";
import { useApi } from "@/react-app/hooks/useApi";
import { toProperCase } from "@/react-app/lib/utils";

interface WithdrawalRequest {
  id: number;
  user_id: number;
  user_name: string;
  user_cpf: string;
  amount: number;
  pix_key: string;
  status: string;
  admin_notes: string | null;
  processed_by_admin_id: number | null;
  processed_at: string | null;
  created_at: string;
}

export default function AdminWithdrawals() {
  const { fetchWithdrawals, updateWithdrawalStatus } = useApi();
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "paid" | "cancelled">("pending");
  
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRequest | null>(null);
  const [notes, setNotes] = useState("");
  const [actionType, setActionType] = useState<"paid" | "cancelled">("paid");

  useEffect(() => {
    loadWithdrawals();
  }, []);

  const loadWithdrawals = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWithdrawals();
      setWithdrawals(data);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar solicitações");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNotesModal = (withdrawal: WithdrawalRequest, action: "paid" | "cancelled") => {
    setSelectedWithdrawal(withdrawal);
    setActionType(action);
    setNotes("");
    setShowNotesModal(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedWithdrawal) return;

    setProcessingId(selectedWithdrawal.id);
    try {
      await updateWithdrawalStatus(selectedWithdrawal.id, actionType, notes || null);
      await loadWithdrawals();
      setShowNotesModal(false);
      setSelectedWithdrawal(null);
      setNotes("");
    } catch (err: any) {
      alert(err.message || "Erro ao processar solicitação");
    } finally {
      setProcessingId(null);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).replace(", ", " às ");
  };

  const formatCpf = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">Pendente</span>,
      paid: <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full">Pago</span>,
      cancelled: <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full">Cancelado</span>,
    };
    return badges[status as keyof typeof badges] || <span className="px-3 py-1 bg-neutral-100 text-neutral-800 text-xs font-bold rounded-full">{status}</span>;
  };

  const filteredWithdrawals = withdrawals.filter((w) => {
    if (filter === "all") return true;
    return w.status === filter;
  });

  const pendingCount = withdrawals.filter(w => w.status === "pending").length;
  const paidCount = withdrawals.filter(w => w.status === "paid").length;
  const cancelledCount = withdrawals.filter(w => w.status === "cancelled").length;

  return (
    <div className="space-y-4">
      {/* Filter Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <button
          onClick={() => setFilter(filter === 'pending' ? 'all' : 'pending')}
          className={`bg-white rounded-xl shadow-soft p-4 text-left transition-all ${
            filter === 'pending' 
              ? 'ring-2 ring-amber-200' 
              : 'hover:shadow-medium'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span className="text-xs text-neutral-500">Pendente</span>
          </div>
          <p className="text-lg font-bold text-amber-600">{pendingCount}</p>
        </button>

        <button
          onClick={() => setFilter(filter === 'paid' ? 'all' : 'paid')}
          className={`bg-white rounded-xl shadow-soft p-4 text-left transition-all ${
            filter === 'paid' 
              ? 'ring-2 ring-green-200' 
              : 'hover:shadow-medium'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Check className="w-4 h-4 text-green-600" />
            <span className="text-xs text-neutral-500">Aprovados</span>
          </div>
          <p className="text-lg font-bold text-green-600">{paidCount}</p>
        </button>

        <button
          onClick={() => setFilter(filter === 'cancelled' ? 'all' : 'cancelled')}
          className={`bg-white rounded-xl shadow-soft p-4 text-left transition-all ${
            filter === 'cancelled' 
              ? 'ring-2 ring-red-200' 
              : 'hover:shadow-medium'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <X className="w-4 h-4 text-red-600" />
            <span className="text-xs text-neutral-500">Rejeitados</span>
          </div>
          <p className="text-lg font-bold text-red-600">{cancelledCount}</p>
        </button>
      </div>

      {/* Header */}
      <div className="bg-white rounded-2xl shadow-soft p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary-100 p-2 rounded-lg">
              <ArrowDownToLine className="w-5 h-5 text-primary-700" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-800">Solicitações de Saque</h1>
              <p className="text-sm text-neutral-500">{filteredWithdrawals.length} solicitações encontradas</p>
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl shadow-soft">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 text-neutral-400 animate-spin mx-auto mb-4" strokeWidth={2} />
            <p className="text-neutral-600">Carregando solicitações...</p>
          </div>
        ) : error ? (
          <div className="p-12">
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 text-center">
              <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-3" strokeWidth={2} />
              <p className="text-red-800 font-medium">{error}</p>
            </div>
          </div>
        ) : filteredWithdrawals.length === 0 ? (
          <div className="p-12">
            <div className="bg-neutral-50 border-2 border-neutral-200 rounded-xl p-6 text-center">
              <ArrowDownToLine className="w-8 h-8 text-neutral-400 mx-auto mb-3" strokeWidth={2} />
              <p className="text-neutral-600">Nenhuma solicitação encontrada</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-neutral-200">
            {filteredWithdrawals.map((withdrawal) => (
              <div key={withdrawal.id} className="p-5 hover:bg-neutral-50 transition-colors">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-base font-bold text-neutral-900">
                        {toProperCase(withdrawal.user_name)}
                      </h3>
                      {getStatusBadge(withdrawal.status)}
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-neutral-600">
                        CPF: {formatCpf(withdrawal.user_cpf)}
                      </p>
                      <p className="text-xs text-neutral-600">
                        Chave PIX: {formatCpf(withdrawal.pix_key)}
                      </p>
                      <p className="text-xs text-neutral-500">
                        Solicitado em {formatDate(withdrawal.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(withdrawal.amount)}
                    </p>
                  </div>
                </div>

                {withdrawal.admin_notes && (
                  <div className="bg-neutral-100 rounded-lg p-3 mb-3">
                    <p className="text-xs font-bold text-neutral-700 mb-1">Observações</p>
                    <p className="text-xs text-neutral-600">{withdrawal.admin_notes}</p>
                  </div>
                )}

                {withdrawal.processed_at && (
                  <p className="text-xs text-neutral-500 mb-3">
                    Processado em {formatDate(withdrawal.processed_at)}
                  </p>
                )}

                {withdrawal.status === "pending" && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleOpenNotesModal(withdrawal, "paid")}
                      disabled={processingId === withdrawal.id}
                      className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm"
                    >
                      <Check className="w-4 h-4" strokeWidth={2} />
                      Marcar como Pago
                    </button>
                    <button
                      onClick={() => handleOpenNotesModal(withdrawal, "cancelled")}
                      disabled={processingId === withdrawal.id}
                      className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm"
                    >
                      <X className="w-4 h-4" strokeWidth={2} />
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes Modal */}
      {showNotesModal && selectedWithdrawal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[300] p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-neutral-900">
                {actionType === "paid" ? "Confirmar Pagamento" : "Cancelar Saque"}
              </h3>
              <button
                onClick={() => setShowNotesModal(false)}
                className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-neutral-600" />
              </button>
            </div>

            <div className="bg-neutral-50 border-2 border-neutral-200 rounded-lg p-4">
              <p className="text-sm text-neutral-600 mb-1">Usuário</p>
              <p className="text-lg font-bold text-neutral-900">{toProperCase(selectedWithdrawal.user_name)}</p>
              <p className="text-sm text-neutral-600 mt-2">Valor</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(selectedWithdrawal.amount)}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Observações (opcional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Adicione observações sobre este processamento..."
                rows={3}
                className="w-full px-4 py-3 border-2 border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowNotesModal(false)}
                className="flex-1 px-4 py-3 border-2 border-neutral-200 text-neutral-700 font-bold rounded-lg hover:bg-neutral-50 transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={handleUpdateStatus}
                disabled={processingId !== null}
                className={`flex-1 px-4 py-3 ${
                  actionType === "paid" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                } disabled:bg-neutral-300 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2`}
              >
                {processingId ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    {actionType === "paid" ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                    Confirmar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
