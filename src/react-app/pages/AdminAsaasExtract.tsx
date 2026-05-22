import { useState, useEffect } from "react";
import { 
  Wallet, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  RefreshCw,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Banknote,
  CreditCard,
  Receipt
} from "lucide-react";
import { toProperCase } from "@/react-app/lib/utils";

interface Transaction {
  id: string;
  value: number;
  balance: number;
  type: string;
  date: string;
  description: string;
  paymentId?: string;
  originalPaymentValue?: number;
}

interface Balance {
  balance: number;
  totalPending?: number;
}

const TRANSACTION_TYPES: Record<string, { label: string; color: string }> = {
  // Cartão Asaas
  ASAAS_CARD_RECHARGE: { label: "Recarga de Cartão Asaas", color: "text-blue-600 bg-blue-50" },
  ASAAS_CARD_RECHARGE_REVERSAL: { label: "Estorno Recarga de Cartão", color: "text-amber-600 bg-amber-50" },
  ASAAS_CARD_TRANSACTION: { label: "Transação Cartão Asaas", color: "text-blue-600 bg-blue-50" },
  ASAAS_CARD_CASHBACK: { label: "Cashback Cartão Asaas", color: "text-emerald-600 bg-emerald-50" },
  ASAAS_CARD_TRANSACTION_FEE: { label: "Taxa Transação Cartão Asaas", color: "text-red-600 bg-red-50" },
  ASAAS_CARD_TRANSACTION_FEE_REFUND: { label: "Estorno Taxa Transação Cartão", color: "text-amber-600 bg-amber-50" },
  ASAAS_CARD_TRANSACTION_PARTIAL_REFUND: { label: "Estorno Parcial Cartão Asaas", color: "text-amber-600 bg-amber-50" },
  ASAAS_CARD_TRANSACTION_PARTIAL_REFUND_CANCELLATION: { label: "Cancel. Estorno Parcial Cartão", color: "text-amber-600 bg-amber-50" },
  ASAAS_CARD_TRANSACTION_REFUND: { label: "Estorno Transação Cartão Asaas", color: "text-amber-600 bg-amber-50" },
  ASAAS_CARD_TRANSACTION_REFUND_CANCELLATION: { label: "Cancel. Estorno Transação Cartão", color: "text-amber-600 bg-amber-50" },
  ASAAS_CARD_BALANCE_REFUND: { label: "Estorno de Cartão Asaas", color: "text-amber-600 bg-amber-50" },
  ASAAS_CARD_BILL_PAYMENT: { label: "Pagamento Fatura Cartão Asaas", color: "text-blue-600 bg-blue-50" },
  ASAAS_CARD_BILL_PAYMENT_REFUND: { label: "Estorno Pagamento Fatura Cartão", color: "text-amber-600 bg-amber-50" },
  ASAAS_DEBIT_CARD_REQUEST_FEE: { label: "Taxa Adesão Cartão Débito", color: "text-red-600 bg-red-50" },
  ASAAS_PREPAID_CARD_REQUEST_FEE: { label: "Taxa Adesão Cartão Pré-pago", color: "text-red-600 bg-red-50" },

  // Asaas Money
  ASAAS_MONEY_PAYMENT_ANTICIPATION_FEE: { label: "Taxa Parcelamento Asaas Money", color: "text-red-600 bg-red-50" },
  ASAAS_MONEY_PAYMENT_ANTICIPATION_FEE_REFUND: { label: "Estorno Taxa Parcelamento Asaas Money", color: "text-amber-600 bg-amber-50" },
  ASAAS_MONEY_PAYMENT_COMPROMISED_BALANCE: { label: "Bloqueio Saldo Asaas Money", color: "text-red-600 bg-red-50" },
  ASAAS_MONEY_PAYMENT_COMPROMISED_BALANCE_REFUND: { label: "Desbloqueio Saldo Asaas Money", color: "text-amber-600 bg-amber-50" },
  ASAAS_MONEY_PAYMENT_FINANCING_FEE: { label: "Taxa Financiamento Asaas Money", color: "text-red-600 bg-red-50" },
  ASAAS_MONEY_PAYMENT_FINANCING_FEE_REFUND: { label: "Estorno Taxa Financiamento Asaas Money", color: "text-amber-600 bg-amber-50" },
  ASAAS_MONEY_TRANSACTION_CASHBACK: { label: "Cashback Asaas Money", color: "text-emerald-600 bg-emerald-50" },
  ASAAS_MONEY_TRANSACTION_CASHBACK_REFUND: { label: "Estorno Cashback Asaas Money", color: "text-amber-600 bg-amber-50" },
  ASAAS_MONEY_TRANSACTION_CHARGEBACK: { label: "Chargeback Asaas Money", color: "text-red-600 bg-red-50" },
  ASAAS_MONEY_TRANSACTION_CHARGEBACK_REVERSAL: { label: "Estorno Chargeback Asaas Money", color: "text-amber-600 bg-amber-50" },

  // Pagamento de Contas
  BILL_PAYMENT: { label: "Pagamento de Conta", color: "text-blue-600 bg-blue-50" },
  BILL_PAYMENT_CANCELLED: { label: "Cancelamento Pagamento Conta", color: "text-amber-600 bg-amber-50" },
  BILL_PAYMENT_REFUNDED: { label: "Estorno Pagamento Conta", color: "text-amber-600 bg-amber-50" },
  BILL_PAYMENT_FEE: { label: "Taxa Pagamento de Conta", color: "text-red-600 bg-red-50" },
  BILL_PAYMENT_FEE_CANCELLED: { label: "Cancel. Taxa Pagamento Conta", color: "text-amber-600 bg-amber-50" },

  // Chargeback
  CHARGEBACK: { label: "Bloqueio por Chargeback", color: "text-red-600 bg-red-50" },
  CHARGEBACK_REVERSAL: { label: "Cancel. Bloqueio Chargeback", color: "text-amber-600 bg-amber-50" },

  // Crédito e Débito
  CREDIT: { label: "Crédito", color: "text-emerald-600 bg-emerald-50" },
  DEBIT: { label: "Débito", color: "text-red-600 bg-red-50" },
  DEBIT_REVERSAL: { label: "Estorno de Débito", color: "text-amber-600 bg-amber-50" },

  // Transferências Internas
  INTERNAL_TRANSFER_CREDIT: { label: "Transferência Interna Recebida", color: "text-emerald-600 bg-emerald-50" },
  INTERNAL_TRANSFER_DEBIT: { label: "Transferência Interna Enviada", color: "text-blue-600 bg-blue-50" },
  INTERNAL_TRANSFER_REVERSAL: { label: "Estorno Transferência Interna", color: "text-amber-600 bg-amber-50" },

  // Transferências Bancárias
  TRANSFER: { label: "Transferência Bancária", color: "text-blue-600 bg-blue-50" },
  TRANSFER_FEE: { label: "Taxa Transferência Bancária", color: "text-red-600 bg-red-50" },
  TRANSFER_REVERSAL: { label: "Estorno Transferência Bancária", color: "text-amber-600 bg-amber-50" },

  // PIX
  PIX_TRANSACTION_CREDIT: { label: "PIX Recebido", color: "text-emerald-600 bg-emerald-50" },
  PIX_TRANSACTION_CREDIT_FEE: { label: "Taxa PIX Recebido", color: "text-red-600 bg-red-50" },
  PIX_TRANSACTION_CREDIT_REFUND: { label: "Estorno PIX Recebido", color: "text-amber-600 bg-amber-50" },
  PIX_TRANSACTION_CREDIT_REFUND_CANCELLATION: { label: "Cancel. Estorno PIX Recebido", color: "text-amber-600 bg-amber-50" },
  PIX_TRANSACTION_DEBIT: { label: "PIX Enviado", color: "text-blue-600 bg-blue-50" },
  PIX_TRANSACTION_DEBIT_FEE: { label: "Taxa PIX Enviado", color: "text-red-600 bg-red-50" },
  PIX_TRANSACTION_DEBIT_REFUND: { label: "Estorno PIX Enviado", color: "text-amber-600 bg-amber-50" },

  // Pagamentos/Cobranças
  PAYMENT_RECEIVED: { label: "Cobrança Recebida", color: "text-emerald-600 bg-emerald-50" },
  PAYMENT_FEE: { label: "Taxa de Cobrança", color: "text-red-600 bg-red-50" },
  PAYMENT_FEE_REVERSAL: { label: "Estorno Taxa Cobrança", color: "text-amber-600 bg-amber-50" },
  PAYMENT_REVERSAL: { label: "Estorno de Fatura", color: "text-amber-600 bg-amber-50" },
  PAYMENT_REFUND_CANCELLED: { label: "Cancel. Estorno Fatura", color: "text-amber-600 bg-amber-50" },
  PAYMENT_CUSTODY_BLOCK: { label: "Bloqueio por Custódia", color: "text-red-600 bg-red-50" },
  PAYMENT_CUSTODY_BLOCK_REVERSAL: { label: "Desbloqueio Custódia", color: "text-amber-600 bg-amber-50" },
  PARTIAL_PAYMENT: { label: "Cobrança Parcialmente Recebida", color: "text-emerald-600 bg-emerald-50" },

  // Taxas de Notificação
  PAYMENT_SMS_NOTIFICATION_FEE: { label: "Taxa SMS Cobrança", color: "text-red-600 bg-red-50" },
  PAYMENT_MESSAGING_NOTIFICATION_FEE: { label: "Taxa Mensageria Fatura", color: "text-red-600 bg-red-50" },
  PAYMENT_INSTANT_TEXT_MESSAGE_FEE: { label: "Taxa Mensagem Instantânea", color: "text-red-600 bg-red-50" },
  PHONE_CALL_NOTIFICATION_FEE: { label: "Taxa Notificação por Voz", color: "text-red-600 bg-red-50" },
  INSTANT_TEXT_MESSAGE_FEE: { label: "Taxa WhatsApp", color: "text-red-600 bg-red-50" },

  // Negativação
  PAYMENT_DUNNING_CANCELLATION_FEE: { label: "Taxa Cancel. Negativação", color: "text-red-600 bg-red-50" },
  PAYMENT_DUNNING_RECEIVED_FEE: { label: "Taxa Negativação", color: "text-red-600 bg-red-50" },
  PAYMENT_DUNNING_RECEIVED_IN_CASH_FEE: { label: "Taxa Negativação em Dinheiro", color: "text-red-600 bg-red-50" },
  PAYMENT_DUNNING_REQUEST_FEE: { label: "Taxa Solicitação Negativação", color: "text-red-600 bg-red-50" },
  CHARGED_FEE_REFUND: { label: "Estorno Taxa Negativação/PIX", color: "text-amber-600 bg-amber-50" },

  // Antecipação
  RECEIVABLE_ANTICIPATION_GROSS_CREDIT: { label: "Antecipação Recebida", color: "text-emerald-600 bg-emerald-50" },
  RECEIVABLE_ANTICIPATION_DEBIT: { label: "Baixa Antecipação", color: "text-blue-600 bg-blue-50" },
  RECEIVABLE_ANTICIPATION_FEE: { label: "Taxa Antecipação", color: "text-red-600 bg-red-50" },
  RECEIVABLE_ANTICIPATION_PARTNER_SETTLEMENT: { label: "Baixa Parcela/Antecipação", color: "text-blue-600 bg-blue-50" },

  // Notas Fiscais
  INVOICE_FEE: { label: "Taxa Nota Fiscal Serviço", color: "text-red-600 bg-red-50" },
  PRODUCT_INVOICE_FEE: { label: "Taxa NF Produto Base ERP", color: "text-red-600 bg-red-50" },
  CONSUMER_INVOICE_FEE: { label: "Taxa NF Consumidor Base ERP", color: "text-red-600 bg-red-50" },

  // Estornos e Reembolsos
  REFUND_REQUEST_CANCELLED: { label: "Cancel. Estorno Fatura", color: "text-amber-600 bg-amber-50" },
  REFUND_REQUEST_FEE: { label: "Taxa Estorno Fatura", color: "text-red-600 bg-red-50" },
  REFUND_REQUEST_FEE_REVERSAL: { label: "Cancel. Taxa Estorno Fatura", color: "text-amber-600 bg-amber-50" },
  REVERSAL: { label: "Estorno", color: "text-amber-600 bg-amber-50" },

  // Recarga de Celular
  MOBILE_PHONE_RECHARGE: { label: "Recarga de Celular", color: "text-blue-600 bg-blue-50" },
  REFUND_MOBILE_PHONE_RECHARGE: { label: "Estorno Recarga Celular", color: "text-amber-600 bg-amber-50" },
  CANCEL_MOBILE_PHONE_RECHARGE: { label: "Cancelamento Recarga Celular", color: "text-amber-600 bg-amber-50" },

  // Judicial
  BACEN_JUDICIAL_LOCK: { label: "Bloqueio Judicial", color: "text-red-600 bg-red-50" },
  BACEN_JUDICIAL_UNLOCK: { label: "Desbloqueio Judicial", color: "text-emerald-600 bg-emerald-50" },
  BACEN_JUDICIAL_TRANSFER: { label: "Transferência Judicial", color: "text-red-600 bg-red-50" },

  // Contratos e Efeitos Contratuais
  CONTRACTUAL_EFFECT_SETTLEMENT: { label: "Valor Recebíveis Reservado", color: "text-blue-600 bg-blue-50" },
  CONTRACTUAL_EFFECT_SETTLEMENT_REVERSAL: { label: "Estorno Recebíveis Reservado", color: "text-amber-600 bg-amber-50" },
  EXTERNAL_SETTLEMENT_CONTRACTUAL_EFFECT_BATCH_CREDIT: { label: "Crédito Liquidação Contrato", color: "text-emerald-600 bg-emerald-50" },
  EXTERNAL_SETTLEMENT_CONTRACTUAL_EFFECT_BATCH_REVERSAL: { label: "Estorno Liquidação Contrato", color: "text-amber-600 bg-amber-50" },

  // Comissões de Parceiros
  CUSTOMER_COMMISSION_SETTLEMENT_CREDIT: { label: "Crédito Comissão Parceiro", color: "text-emerald-600 bg-emerald-50" },
  CUSTOMER_COMMISSION_SETTLEMENT_DEBIT: { label: "Débito Comissão Parceiro", color: "text-red-600 bg-red-50" },

  // Códigos Promocionais
  PROMOTIONAL_CODE_CREDIT: { label: "Desconto na Taxa", color: "text-emerald-600 bg-emerald-50" },
  PROMOTIONAL_CODE_DEBIT: { label: "Estorno Desconto Taxa", color: "text-red-600 bg-red-50" },
  FREE_PAYMENT_USE: { label: "Estorno Campanha Promocional", color: "text-emerald-600 bg-emerald-50" },

  // Serasa
  CREDIT_BUREAU_REPORT: { label: "Taxa Consulta Serasa", color: "text-red-600 bg-red-50" },

  // Correios
  POSTAL_SERVICE_FEE: { label: "Taxa Envio Boleto Correios", color: "text-red-600 bg-red-50" },

  // Renegociação
  DEBT_RECOVERY_NEGOTIATION_FINANCIAL_CHARGES: { label: "Encargos Renegociação", color: "text-red-600 bg-red-50" },

  // Taxas de Conta
  CHILD_ACCOUNT_KNOWN_YOUR_CUSTOMER_BATCH_FEE: { label: "Taxa Criação Contas Filhas", color: "text-red-600 bg-red-50" },
  CONTRACTED_CUSTOMER_PLAN_FEE: { label: "Mensalidade Plano Asaas", color: "text-red-600 bg-red-50" },
  ACCOUNT_INACTIVITY_FEE: { label: "Taxa Conta Inativa", color: "text-red-600 bg-red-50" },
};

export default function AdminAsaasExtract() {
  // Default dates: first and last day of current month
  const getDefaultDates = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start: firstDay.toISOString().split('T')[0],
      end: lastDay.toISOString().split('T')[0]
    };
  };
  
  const defaultDates = getDefaultDates();
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [startDate, setStartDate] = useState(defaultDates.start);
  const [finishDate, setFinishDate] = useState(defaultDates.end);
  const limit = 20;

  useEffect(() => {
    loadBalance();
    loadTransactions();
  }, []);

  const loadBalance = async () => {
    try {
      const response = await fetch("/api/admin/asaas-balance");
      if (!response.ok) {
        throw new Error("Erro ao carregar saldo");
      }
      const data = await response.json();
      setBalance(data);
    } catch (err) {
      console.error("Error loading balance:", err);
    }
  };

  const loadTransactions = async (newOffset = 0) => {
    setLoading(true);
    setError(null);
    
    try {
      let url = `/api/admin/asaas-extract?offset=${newOffset}&limit=${limit}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (finishDate) url += `&finishDate=${finishDate}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao carregar extrato");
      }
      
      const data = await response.json();
      setTransactions(data.data || []);
      setHasMore(data.hasMore || false);
      setOffset(newOffset);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    loadTransactions(0);
  };

  const handlePrevPage = () => {
    if (offset > 0) {
      loadTransactions(Math.max(0, offset - limit));
    }
  };

  const handleNextPage = () => {
    if (hasMore) {
      loadTransactions(offset + limit);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getTransactionType = (type: string) => {
    return TRANSACTION_TYPES[type] || { label: type, color: "text-neutral-600 bg-neutral-50" };
  };

  const getTransactionIcon = (type: string) => {
    if (type.includes("FEE") || type === "DEBIT" || type === "CHARGEBACK" || type === "REFUND") {
      return <ArrowUpCircle className="w-5 h-5 text-red-500" />;
    }
    if (type.includes("RECEIVED") || type === "CREDIT") {
      return <ArrowDownCircle className="w-5 h-5 text-emerald-500" />;
    }
    if (type.includes("PIX")) {
      return <Banknote className="w-5 h-5 text-teal-500" />;
    }
    if (type.includes("SPLIT")) {
      return <Receipt className="w-5 h-5 text-indigo-500" />;
    }
    return <CreditCard className="w-5 h-5 text-neutral-500" />;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-soft p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary-100 p-2 rounded-lg">
              <Wallet className="w-5 h-5 text-primary-700" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-800">Extrato Asaas</h1>
              <p className="text-sm text-neutral-500">Transações financeiras da conta</p>
            </div>
          </div>
          <button
            onClick={() => { loadBalance(); loadTransactions(offset); }}
            className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white text-sm rounded-xl hover:bg-primary-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {balance && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl shadow-soft p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-emerald-600" />
              <span className="text-xs text-neutral-500">Saldo Disponível</span>
            </div>
            <p className="text-lg font-bold text-emerald-600">
              {formatCurrency(balance.balance)}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-soft p-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpCircle className="w-4 h-4 text-amber-600" />
              <span className="text-xs text-neutral-500">Pendente</span>
            </div>
            <p className="text-lg font-bold text-amber-600">
              {formatCurrency(balance.totalPending || 0)}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-soft p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Data Inicial
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Data Final
            </label>
            <input
              type="date"
              value={finishDate}
              onChange={(e) => setFinishDate(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <button
            onClick={handleFilter}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-700 rounded-xl hover:bg-neutral-200 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Filtrar
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* Transactions List */}
      <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
        <div className="p-4 border-b border-neutral-100">
          <h2 className="font-semibold text-neutral-900">Transações</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 text-neutral-500">
            Nenhuma transação encontrada
          </div>
        ) : (
          <>
            <div className="divide-y divide-neutral-100">
              {transactions.map((transaction) => {
                const typeInfo = getTransactionType(transaction.type);
                const isNegative = transaction.value < 0 || 
                  transaction.type.includes("FEE") || 
                  transaction.type === "DEBIT" ||
                  transaction.type === "CHARGEBACK";
                
                return (
                  <div key={transaction.id} className="p-4 hover:bg-neutral-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0">
                        {getTransactionIcon(transaction.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${typeInfo.color}`}>
                            {typeInfo.label}
                            {/* Show fee percentage for payment fees */}
                            {(transaction.type === "PAYMENT_FEE" || transaction.type.includes("_FEE")) && (() => {
                              // Use originalPaymentValue from backend (fetched from payment API)
                              if (transaction.originalPaymentValue && transaction.originalPaymentValue > 0) {
                                const feePercent = (Math.abs(transaction.value) / transaction.originalPaymentValue) * 100;
                                return ` (${feePercent.toFixed(2)}%)`;
                              }
                              return null;
                            })()}
                          </span>
                        </div>
                        <p className="text-sm text-neutral-600 truncate">
                          {transaction.description 
                            ? transaction.description.replace(/([A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]{2,}(\s+[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]{2,})*)/g, (match) => toProperCase(match))
                            : "Sem descrição"}
                        </p>
                        <p className="text-xs text-neutral-400 mt-1">
                          {formatDate(transaction.date)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${isNegative ? "text-red-600" : "text-emerald-600"}`}>
                          {isNegative ? "-" : "+"} {formatCurrency(Math.abs(transaction.value))}
                        </p>
                        <p className="text-xs text-neutral-400 mt-1">
                          Saldo: {formatCurrency(transaction.balance)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="p-4 border-t border-neutral-100 flex items-center justify-between">
              <button
                onClick={handlePrevPage}
                disabled={offset === 0}
                className="flex items-center gap-2 px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </button>
              <span className="text-sm text-neutral-500">
                Mostrando {offset + 1} - {offset + transactions.length}
              </span>
              <button
                onClick={handleNextPage}
                disabled={!hasMore}
                className="flex items-center gap-2 px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Próximo
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
