import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Receipt, Calendar, ChevronLeft, ChevronRight, Loader2, AlertCircle, DollarSign, ChevronDown, X, ArrowDownToLine, Clock, FileText } from "lucide-react";
import { useAuth } from "@getmocha/users-service/react";
import { useApi } from "@/react-app/hooks/useApi";
import { Portal } from "@/react-app/components/Portal";
import { toProperCase, formatCurrency } from "@/react-app/lib/utils";
import { useTranslation, useLanguage } from "@/react-app/i18n";

interface ExtractViewProps {
  onBack?: () => void;
}

export default function ExtractView({ onBack }: ExtractViewProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { fetchProfile, getWalletExtract, getWalletBalance, createWithdrawal } = useApi();
  const { t } = useTranslation();
  const { language } = useLanguage();
  
  const [profile, setProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isViewAnimating, setIsViewAnimating] = useState(false);
  
  const [balance, setBalance] = useState<number | null>(null);
  const [pendingBalance, setPendingBalance] = useState<number | null>(null);
  const [pendingWithdrawal, setPendingWithdrawal] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;
  
  // Date filters - default to empty (show all transactions)
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Filter expansion state
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  // Withdrawal modal state
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [withdrawalDisplayValue, setWithdrawalDisplayValue] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawalError, setWithdrawalError] = useState<string | null>(null);
  const [withdrawalSuccess, setWithdrawalSuccess] = useState(false);

  // Details modal state
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  


  // Load profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await fetchProfile();
        if (data && typeof data === 'object' && 'id' in data) {
          setProfile(data);
        }
      } finally {
        setLoadingProfile(false);
      }
    };
    if (user) {
      loadProfile();
    }
  }, [user]);

  // Trigger animation on mount
  useEffect(() => {
    setTimeout(() => setIsViewAnimating(true), 10);
  }, []);

  const loadBalance = async () => {
    setLoadingBalance(true);
    try {
      const data = await getWalletBalance();
      setBalance(data.balance || 0);
      setPendingBalance(data.pending_balance || 0);
    } catch (err) {
      console.error("Error loading balance:", err);
    } finally {
      setLoadingBalance(false);
    }
  };

  const loadTransactions = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getWalletExtract(startDate, endDate, currentPage, limit);
      setTransactions(data.data || []);
      setTotalPages(Math.ceil(data.totalCount / limit) || 1);
      
      // Calculate pending withdrawal amount
      const pendingWithdrawalAmount = data.data
        .filter((t: any) => t.type === 'withdrawal_requested' && t.status === 'pending')
        .reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);
      setPendingWithdrawal(pendingWithdrawalAmount);
    } catch (err: any) {
      setError(err.message || t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const reloadExtractData = async () => {
    await loadBalance();
    await loadTransactions();
  };

  useEffect(() => {
    if (profile) {
      loadBalance();
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
      loadTransactions();
    }
  }, [profile, startDate, endDate, currentPage]);



  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(", ", " às ");
  };

  const getTransactionTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      'commission_received': t("extract.transactionTypes.commission_received"),
      'withdrawal_requested': t("extract.transactionTypes.withdrawal_requested"),
      'withdrawal_completed': t("extract.transactionTypes.withdrawal_completed"),
      'withdrawal_cancelled': t("extract.transactionTypes.withdrawal_cancelled"),
      'payment_received': t("extract.transactionTypes.payment_received"),
      'refund': t("extract.transactionTypes.refund"),
      'credit': t("extract.transactionTypes.credit"),
      'debit': t("extract.transactionTypes.debit"),
      'referral_commission': t("extract.transactionTypes.referral_commission"),
    };
    return types[type] || type;
  };

  const getStatusBadge = (type: string, status: string) => {
    // Referral commissions are always immediately available
    if (type === 'referral_commission') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-green-100 text-green-800 border-green-300">
          {t("extract.status.available")}
        </span>
      );
    }
    
    // Show status for commissions and withdrawals
    const statusConfig: Record<string, { label: string; color: string }> = {
      'pending': { 
        label: type === 'withdrawal_requested' ? t("extract.status.processing") : t("extract.status.pending"), 
        color: 'bg-amber-100 text-amber-800 border-amber-300' 
      },
      'confirmed': { label: t("extract.status.commissionPaid"), color: 'bg-green-100 text-green-800 border-green-300' },
      'completed': { label: t("extract.status.paid"), color: 'bg-green-100 text-green-800 border-green-300' },
      'cancelled': { label: t("extract.status.cancelled"), color: 'bg-red-100 text-red-800 border-red-300' },
    };

    const config = statusConfig[status] || statusConfig['pending'];

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const handleClose = () => {
    setIsViewAnimating(false);
    setTimeout(() => {
      if (onBack) {
        onBack();
      } else {
        navigate(-1);
      }
    }, 200);
  };

  const formatCurrencyInput = (value: string) => {
    // Remove tudo exceto números
    const numericValue = value.replace(/\D/g, '');
    
    if (!numericValue) {
      return '';
    }
    
    // Converte para número e formata
    const numberValue = parseInt(numericValue) / 100;
    return numberValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleWithdrawalInputChange = (value: string) => {
    const formatted = formatCurrencyInput(value);
    setWithdrawalDisplayValue(formatted);
    
    // Armazena o valor numérico
    const numericValue = value.replace(/\D/g, '');
    if (numericValue) {
      const numberValue = parseInt(numericValue) / 100;
      setWithdrawalAmount(numberValue.toString());
    } else {
      setWithdrawalAmount('');
    }
    
    setWithdrawalError(null);
  };

  const handleWithdrawal = async () => {
    const value = parseFloat(withdrawalAmount);
    
    if (!value || value <= 0) {
      setWithdrawalError(t("extract.withdrawal.invalidAmount"));
      return;
    }

    if (balance && value > balance) {
      setWithdrawalError(t("extract.withdrawal.insufficientBalance"));
      return;
    }

    setIsWithdrawing(true);
    setWithdrawalError(null);

    try {
      await createWithdrawal(value);
      setWithdrawalSuccess(true);
      setWithdrawalAmount("");
      setWithdrawalDisplayValue("");
      
      // Reload balance and transactions after withdrawal
      setTimeout(async () => {
        const balanceData = await getWalletBalance();
        setBalance(balanceData.balance || 0);
        setPendingBalance(balanceData.pending_balance || 0);
        
        // Reload transactions list
        const extractData = await getWalletExtract(startDate, endDate, currentPage, limit);
        setTransactions(extractData.data || []);
        setTotalPages(Math.ceil(extractData.totalCount / limit) || 1);
        
        // Recalculate pending withdrawal amount
        const pendingWithdrawalAmount = extractData.data
          .filter((t: any) => t.type === 'withdrawal_requested' && t.status === 'pending')
          .reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);
        setPendingWithdrawal(pendingWithdrawalAmount);
        
        setWithdrawalSuccess(false);
        setShowWithdrawalModal(false);
      }, 2000);
    } catch (err: any) {
      setWithdrawalError(err.message || t("common.error"));
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Show loading while profile is being fetched
  if (loadingProfile) {
    return (
      <Portal>
        <div className={`fixed inset-0 bg-white z-[100] overflow-y-auto transition-opacity duration-300 ${
          isViewAnimating ? 'opacity-100' : 'opacity-0'
        }`}>
          <div className={`sticky top-0 bg-white border-b border-neutral-200 z-10 transition-transform duration-300 ${
            isViewAnimating ? 'translate-y-0' : '-translate-y-4'
          }`}>
            <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-neutral-900">{t("extract.title")}</h2>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-neutral-600" strokeWidth={2} />
              </button>
            </div>
          </div>

          <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-neutral-400 animate-spin mx-auto mb-4" />
              <p className="text-neutral-600">{t("common.loading")}</p>
            </div>
          </div>
        </div>
      </Portal>
    );
  }

  return (
    <Portal>
      <div className={`fixed inset-0 bg-white z-[100] overflow-y-auto transition-opacity duration-300 ${
        isViewAnimating ? 'opacity-100' : 'opacity-0'
      }`}>
        {/* Header */}
        <div className={`sticky top-0 bg-white border-b border-neutral-200 z-10 transition-transform duration-300 ${
          isViewAnimating ? 'translate-y-0' : '-translate-y-4'
        }`}>
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-neutral-900">{t("extract.title")}</h2>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-neutral-600" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className={`max-w-4xl mx-auto px-4 py-6 transition-all duration-300 space-y-6 ${
          isViewAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}>

        {/* Balance Section */}
        <div className="bg-white rounded-xl border-2 border-neutral-200">
          <div className="p-6 space-y-4">
            {/* Available Balance */}
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-green-700 text-sm font-medium mb-1">{t("extract.availableBalance")}</p>
                  {loadingBalance ? (
                    <div className="h-9 w-40 bg-green-200 rounded-lg animate-pulse"></div>
                  ) : (
                    <p className="text-3xl font-bold text-green-800">
                      {formatCurrency(balance || 0, language)}
                    </p>
                  )}
                </div>
                <div className="p-4 bg-green-100 rounded-xl">
                  <DollarSign className="w-8 h-8 text-green-600" />
                </div>
              </div>
              
              {!loadingBalance && (balance ?? 0) >= 20 && (
                <div className="mt-4 pt-4 border-t-2 border-green-200">
                  <button
                    onClick={() => setShowWithdrawalModal(true)}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                  >
                    <ArrowDownToLine className="w-5 h-5" />
                    {t("extract.withdrawViaPix")}
                  </button>
                  <p className="text-xs text-green-700 mt-2 text-center">
                    {t("extract.minWithdrawal")}
                  </p>
                  <p className="text-xs text-green-700 mt-1 text-center">
                    {t("extract.pixKeyInfo")}
                  </p>
                </div>
              )}
              {!loadingBalance && (balance ?? 0) < 20 && (balance ?? 0) > 0 && (
                <div className="mt-4 pt-4 border-t-2 border-green-200">
                  <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-3">
                    <p className="text-xs text-amber-800 text-center font-medium">
                      {t("extract.minBalanceInfo")}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Pending Balance */}
            {!loadingBalance && (pendingBalance ?? 0) > 0 && (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-amber-700 text-sm font-medium mb-1">{t("extract.pendingBalance")}</p>
                    <p className="text-xl font-bold text-amber-800">
                      {formatCurrency(pendingBalance || 0, language)}
                    </p>
                    <p className="text-xs text-amber-600 mt-1">
                      {t("extract.pendingBalanceInfo")}
                    </p>
                  </div>
                  <div className="p-3 bg-amber-100 rounded-xl">
                    <Clock className="w-6 h-6 text-amber-600" />
                  </div>
                </div>
              </div>
            )}

            {/* Pending Withdrawal */}
            {!loading && (pendingWithdrawal ?? 0) > 0 && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-700 text-sm font-medium mb-1">{t("extract.withdrawalProcessing")}</p>
                    <p className="text-xl font-bold text-blue-800">
                      {formatCurrency(pendingWithdrawal || 0, language)}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      {t("extract.withdrawalProcessingInfo")}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <ArrowDownToLine className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      {/* Filters Section */}
      <div className="bg-white rounded-xl border-2 border-neutral-200">
          <button
            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
            className="w-full p-6 flex items-center justify-between hover:bg-neutral-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-neutral-700" />
              <h2 className="text-lg font-bold text-neutral-800">{t("extract.filters")}</h2>
            </div>
            <ChevronDown
              className={`w-5 h-5 text-neutral-600 transition-transform ${
                isFilterExpanded ? "rotate-180" : ""
              }`}
            />
          </button>

          <div
            className={`grid transition-all duration-300 ease-in-out ${
              isFilterExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
          >
            <div className="overflow-hidden">
              <div className="p-6 pt-0 border-t-2 border-neutral-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      {t("extract.startDate")}
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full px-4 py-2 border-2 border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      {t("extract.endDate")}
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full px-4 py-2 border-2 border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-xl border-2 border-neutral-200">
          <div className="p-6 border-b-2 border-neutral-200">
            <h2 className="text-lg font-bold text-neutral-800">{t("extract.transactions")}</h2>
            {!loading && !error && transactions.length > 0 && (
              <p className="text-sm text-neutral-600 mt-1">
                {transactions.length} {transactions.length !== 1 ? t("extract.transactionsFoundPlural") : t("extract.transactionsFound")}
              </p>
            )}
          </div>

          {loading ? (
            <div className="divide-y divide-neutral-200">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="h-5 w-3/4 bg-neutral-200 rounded animate-pulse"></div>
                      <div className="h-4 w-1/2 bg-neutral-200 rounded animate-pulse"></div>
                      <div className="h-3 w-1/4 bg-neutral-200 rounded animate-pulse"></div>
                    </div>
                    <div className="space-y-2 text-right">
                      <div className="h-6 w-24 bg-neutral-200 rounded animate-pulse ml-auto"></div>
                      <div className="h-3 w-20 bg-neutral-200 rounded animate-pulse ml-auto"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-12">
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 text-center">
                <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-3" />
                <p className="text-red-800 font-medium">{error}</p>
              </div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-12">
              <div className="bg-neutral-50 border-2 border-neutral-200 rounded-xl p-6 text-center">
                <Receipt className="w-8 h-8 text-neutral-400 mx-auto mb-3" />
                <p className="text-neutral-600">{t("extract.noTransactions")}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="divide-y divide-neutral-200">
                {transactions.map((transaction, index) => (
                  <div key={index} className="p-6 hover:bg-neutral-50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-bold text-neutral-800 truncate">
                            {getTransactionTypeLabel(transaction.type)}
                          </span>
                          {getStatusBadge(transaction.type, transaction.status)}
                        </div>
                        {transaction.description && (
                          <p className="text-xs text-neutral-500 mb-1">
                            {transaction.description}
                          </p>
                        )}
                        <p className="text-xs text-neutral-500">
                          {formatDate(transaction.created_at)}
                        </p>
                        {transaction.delivery_details && (
                          <button
                            onClick={() => {
                              setSelectedTransaction(transaction);
                              setShowDetailsModal(true);
                            }}
                            className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            {t("extract.viewDeliveryDetails")}
                          </button>
                        )}
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className={`text-lg font-bold ${
                          transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.amount >= 0 ? '+' : ''}
                          {formatCurrency(transaction.amount, language)}
                        </p>
                        {transaction.balance_after !== undefined && transaction.balance_after !== null && (
                          <p className="text-xs text-neutral-500 mt-1">
                            {t("extract.balance")}: {formatCurrency(transaction.balance_after, language)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-6 border-t-2 border-neutral-200">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 disabled:bg-neutral-50 disabled:text-neutral-400 rounded-lg transition-colors font-medium text-sm"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>{t("extract.previous")}</span>
                    </button>

                    <span className="text-sm text-neutral-600 font-medium">
                      {t("extract.pageOf", { current: currentPage, total: totalPages })}
                    </span>

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 disabled:bg-neutral-50 disabled:text-neutral-400 rounded-lg transition-colors font-medium text-sm"
                    >
                      <span>{t("extract.next")}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
      </div>
        </div>

        {/* Details Modal */}
        {showDetailsModal && selectedTransaction && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[300] p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b-2 border-neutral-200 p-6 flex items-center justify-between">
                <h3 className="text-xl font-bold text-neutral-900">{t("extract.details.title")}</h3>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedTransaction(null);
                  }}
                  className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-neutral-600" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Transaction Info */}
                <div className="bg-neutral-50 border-2 border-neutral-200 rounded-xl p-4">
                  <h4 className="font-bold text-neutral-800 mb-3">{t("extract.details.transaction")}</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-neutral-600">{t("extract.details.type")}:</span>
                      <span className="text-sm font-medium text-neutral-900">
                        {getTransactionTypeLabel(selectedTransaction.type)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-neutral-600">{t("extract.details.value")}:</span>
                      <span className={`text-sm font-bold ${
                        selectedTransaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {selectedTransaction.amount >= 0 ? '+' : ''}
                        {formatCurrency(selectedTransaction.amount, language)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-neutral-600">Status:</span>
                      <span>{getStatusBadge(selectedTransaction.type, selectedTransaction.status)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-neutral-600">{t("extract.details.date")}:</span>
                      <span className="text-sm font-medium text-neutral-900">
                        {formatDate(selectedTransaction.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Droptag Info */}
                {selectedTransaction.delivery_details?.droptag && (
                  <div className="bg-neutral-50 border-2 border-neutral-200 rounded-xl p-4">
                    <h4 className="font-bold text-neutral-800 mb-3">{t("extract.details.droptagInfo")}</h4>
                    <div className="space-y-2">
                      {selectedTransaction.delivery_details.droptag.title && (
                        <div className="flex justify-between">
                          <span className="text-sm text-neutral-600">{t("extract.details.droptagTitle")}:</span>
                          <span className="text-sm font-medium text-neutral-900">
                            {selectedTransaction.delivery_details.droptag.title}
                          </span>
                        </div>
                      )}
                      {selectedTransaction.delivery_details.droptag.tracking_code && (
                        <div className="flex justify-between">
                          <span className="text-sm text-neutral-600">{t("extract.details.trackingCode")}:</span>
                          <span className="text-sm font-medium text-neutral-900">
                            {selectedTransaction.delivery_details.droptag.tracking_code}
                          </span>
                        </div>
                      )}
                      {selectedTransaction.delivery_details.droptag.consumer_name && (
                        <div className="flex justify-between">
                          <span className="text-sm text-neutral-600">{t("extract.details.dropperOne")}:</span>
                          <span className="text-sm font-medium text-neutral-900">
                            {toProperCase(selectedTransaction.delivery_details.droptag.consumer_name)}
                          </span>
                        </div>
                      )}
                      {selectedTransaction.delivery_details.droptag.street && (
                        <div>
                          <span className="text-sm text-neutral-600 block mb-1">{t("extract.details.deliveryAddress")}:</span>
                          <span className="text-sm font-medium text-neutral-900">
                            {selectedTransaction.delivery_details.droptag.street}, {selectedTransaction.delivery_details.droptag.number}
                            {selectedTransaction.delivery_details.droptag.complement && ` - ${selectedTransaction.delivery_details.droptag.complement}`}
                            <br />
                            {selectedTransaction.delivery_details.droptag.neighborhood} - {selectedTransaction.delivery_details.droptag.city}/{selectedTransaction.delivery_details.droptag.state}
                          </span>
                        </div>
                      )}
                      {selectedTransaction.delivery_details.droptag.notes && (
                        <div>
                          <span className="text-sm text-neutral-600 block mb-1">{t("extract.details.notes")}:</span>
                          <span className="text-sm font-medium text-neutral-900">
                            {selectedTransaction.delivery_details.droptag.notes}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-sm text-neutral-600">{t("extract.details.status")}:</span>
                        <span className="text-sm font-medium text-neutral-900">
                          {selectedTransaction.delivery_details.droptag.status === 'completed' ? t("extract.details.completed") : selectedTransaction.delivery_details.droptag.status}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Driver Info */}
                {selectedTransaction.delivery_details?.driver_delivery && (
                  <div className="bg-neutral-50 border-2 border-neutral-200 rounded-xl p-4">
                    <h4 className="font-bold text-neutral-800 mb-3">{t("extract.details.driverInfo")}</h4>
                    <div className="space-y-2">
                      {selectedTransaction.delivery_details.driver_delivery.driver_name && (
                        <div className="flex justify-between">
                          <span className="text-sm text-neutral-600">{t("extract.details.name")}:</span>
                          <span className="text-sm font-medium text-neutral-900">
                            {toProperCase(selectedTransaction.delivery_details.driver_delivery.driver_name)}
                          </span>
                        </div>
                      )}
                      {selectedTransaction.delivery_details.driver_delivery.picked_up_at && (
                        <div className="flex justify-between">
                          <span className="text-sm text-neutral-600">{t("extract.details.pickedUpAt")}:</span>
                          <span className="text-sm font-medium text-neutral-900">
                            {formatDate(selectedTransaction.delivery_details.driver_delivery.picked_up_at)}
                          </span>
                        </div>
                      )}
                      {selectedTransaction.delivery_details.driver_delivery.delivered_at && (
                        <div className="flex justify-between">
                          <span className="text-sm text-neutral-600">{t("extract.details.deliveredAt")}:</span>
                          <span className="text-sm font-medium text-neutral-900">
                            {formatDate(selectedTransaction.delivery_details.driver_delivery.delivered_at)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Receiver Info */}
                {selectedTransaction.delivery_details?.receiver_delivery && (
                  <div className="bg-neutral-50 border-2 border-neutral-200 rounded-xl p-4">
                    <h4 className="font-bold text-neutral-800 mb-3">{t("extract.details.receiverInfo")}</h4>
                    <div className="space-y-2">
                      {selectedTransaction.delivery_details.receiver_delivery.receiver_name && (
                        <div className="flex justify-between">
                          <span className="text-sm text-neutral-600">{t("extract.details.name")}:</span>
                          <span className="text-sm font-medium text-neutral-900">
                            {toProperCase(selectedTransaction.delivery_details.receiver_delivery.receiver_name)}
                          </span>
                        </div>
                      )}
                      {selectedTransaction.delivery_details.receiver_delivery.received_at && (
                        <div className="flex justify-between">
                          <span className="text-sm text-neutral-600">{t("extract.details.receivedAt")}:</span>
                          <span className="text-sm font-medium text-neutral-900">
                            {formatDate(selectedTransaction.delivery_details.receiver_delivery.received_at)}
                          </span>
                        </div>
                      )}
                      {selectedTransaction.delivery_details.receiver_delivery.picked_up_at && (
                        <div className="flex justify-between">
                          <span className="text-sm text-neutral-600">{t("extract.details.withdrawnAt")}:</span>
                          <span className="text-sm font-medium text-neutral-900">
                            {formatDate(selectedTransaction.delivery_details.receiver_delivery.picked_up_at)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-white border-t-2 border-neutral-200 p-6">
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedTransaction(null);
                  }}
                  className="w-full bg-neutral-600 hover:bg-neutral-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  {t("common.close")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Withdrawal Modal */}
        {showWithdrawalModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[300] p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
              {withdrawalSuccess ? (
                <div className="flex flex-col items-center justify-center py-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <ArrowDownToLine className="w-8 h-8 text-green-600" />
                  </div>
                  <p className="text-xl font-semibold text-green-700 mb-1">{t("extract.withdrawal.success")}</p>
                  <p className="text-sm text-neutral-600 text-center mb-4">
                    {t("extract.withdrawal.successMessage")}
                  </p>
                  <div className="w-full bg-green-50 border border-green-200 rounded-2xl p-5 mb-4">
                    <p className="text-base text-green-700 text-center font-medium leading-relaxed">
                      {t("extract.withdrawal.successInfo")}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowWithdrawalModal(false);
                      setWithdrawalSuccess(false);
                      setWithdrawalAmount("");
                      setWithdrawalDisplayValue("");
                      setWithdrawalError(null);
                      reloadExtractData();
                    }}
                    className="w-full bg-action-600 hover:bg-action-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 active:scale-95"
                  >
                    {t("common.close")}
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-neutral-900">{t("extract.withdrawal.title")}</h3>
                    <button
                      onClick={() => {
                        setShowWithdrawalModal(false);
                        setWithdrawalAmount("");
                        setWithdrawalDisplayValue("");
                        setWithdrawalError(null);
                      }}
                      className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-neutral-600" />
                    </button>
                  </div>

                  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                    <p className="text-xs text-blue-700 font-medium mb-2">
                      {t("extract.withdrawal.pixKeyLabel")}
                    </p>
                    <p className="text-sm text-blue-900 font-bold">
                      {t("extract.withdrawal.cpf")}: {profile?.cpf ? profile.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : t("extract.withdrawal.notRegistered")}
                    </p>
                  </div>

                  <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-700 mb-1">{t("extract.withdrawal.availableBalance")}</p>
                    <p className="text-2xl font-bold text-green-800">{formatCurrency(balance || 0, language)}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      {t("extract.withdrawal.amountLabel")}
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 font-medium">
                        R$
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={withdrawalDisplayValue}
                        onChange={(e) => handleWithdrawalInputChange(e.target.value)}
                        placeholder={t("extract.withdrawal.placeholder")}
                        className="w-full pl-12 pr-4 py-3 border-2 border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent font-bold text-lg"
                      />
                    </div>
                  </div>

                  {withdrawalError && (
                    <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3">
                      <p className="text-red-800 text-sm font-medium">{withdrawalError}</p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => {
                        setShowWithdrawalModal(false);
                        setWithdrawalAmount("");
                        setWithdrawalDisplayValue("");
                        setWithdrawalError(null);
                      }}
                      className="flex-1 px-4 py-3 border-2 border-neutral-200 text-neutral-700 font-bold rounded-lg hover:bg-neutral-50 transition-colors"
                    >
                      {t("common.cancel")}
                    </button>
                    <button
                      onClick={handleWithdrawal}
                      disabled={isWithdrawing || !withdrawalAmount}
                      className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      {isWithdrawing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          {t("extract.withdrawal.processing")}
                        </>
                      ) : (
                        <>
                          <ArrowDownToLine className="w-5 h-5" />
                          {t("extract.withdrawal.confirm")}
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Portal>
  );
}
