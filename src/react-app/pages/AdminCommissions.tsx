import { useState, useEffect } from "react";
import { Loader2, DollarSign, TrendingUp, Users, Truck, User, Package, Calendar, ArrowUpRight } from "lucide-react";
import { TooltipLabel } from "@/react-app/components/PersonaLabel";
import { toProperCase } from "@/react-app/lib/utils";

interface Commission {
  id: number;
  asaas_charge_id: number;
  droptag_id: number;
  consumer_user_id: number;
  driver_user_id: number;
  receiver_user_id: number;
  total_value: number;
  driver_commission_percent: number;
  driver_commission_amount: number;
  receiver_commission_percent: number;
  receiver_commission_amount: number;
  platform_commission_percent: number;
  platform_commission_amount: number;
  asaas_payment_id: string;
  paid_at: string;
  created_at: string;
  droptag_description: string;
  tracking_code: string;
  consumer_name: string;
  driver_name: string;
  receiver_name: string;
}

interface Totals {
  total_count: number;
  total_revenue: number;
  total_platform_commission: number;
  total_driver_commission: number;
  total_receiver_commission: number;
}

export default function AdminCommissions() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCommissions();
  }, []);

  const loadCommissions = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/admin/commissions", { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setCommissions(data.commissions || []);
        setTotals(data.totals || null);
      }
    } catch (err) {
      console.error("Error loading commissions:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value);
  };

  const formatDate = (date: string) => {
    if (!date) return "-";
    return new Date(date).toLocaleString("pt-BR");
  };

  if (isLoading) {
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
        <div className="flex items-center gap-3">
          <div className="bg-primary-100 p-2 rounded-lg">
            <DollarSign className="w-5 h-5 text-primary-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-800">Comissões</h1>
            <p className="text-sm text-neutral-500">{commissions.length} pagamentos registrados</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {totals && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl shadow-soft p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-neutral-500">Receita Total</span>
            </div>
            <p className="text-lg font-bold text-neutral-800">
              {formatCurrency(totals.total_revenue)}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-soft p-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpRight className="w-4 h-4 text-green-600" />
              <span className="text-xs text-neutral-500">Plataforma</span>
            </div>
            <p className="text-lg font-bold text-green-600">
              {formatCurrency(totals.total_platform_commission)}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-soft p-4">
            <div className="flex items-center gap-2 mb-2">
              <Truck className="w-4 h-4 text-amber-600" />
              <TooltipLabel tooltip="Entregador, Deliver, Motorista" className="text-xs text-neutral-500">Droppers</TooltipLabel>
            </div>
            <p className="text-lg font-bold text-amber-600">
              {formatCurrency(totals.total_driver_commission)}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-soft p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-purple-600" />
              <TooltipLabel tooltip="Receiver, Recebedor" className="text-xs text-neutral-500">Toodropers</TooltipLabel>
            </div>
            <p className="text-lg font-bold text-purple-600">
              {formatCurrency(totals.total_receiver_commission)}
            </p>
          </div>
        </div>
      )}

      {/* Commissions Table */}
      <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-600">Data</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-600">DropTag</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-600">
                  <TooltipLabel tooltip="Comprador, Consumidor, Consumer">Dropper one</TooltipLabel>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-600">
                  <TooltipLabel tooltip="Entregador, Deliver, Motorista">Dropper</TooltipLabel>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-600">
                  <TooltipLabel tooltip="Receiver, Recebedor">Toodroper</TooltipLabel>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-neutral-600">Total</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-neutral-600">Plataforma</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-neutral-600">
                  <TooltipLabel tooltip="Entregador, Deliver, Motorista">Dropper</TooltipLabel>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-neutral-600">
                  <TooltipLabel tooltip="Receiver, Recebedor">Toodroper</TooltipLabel>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {commissions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-neutral-500">
                    Nenhuma comissão registrada ainda
                  </td>
                </tr>
              ) : (
                commissions.map((commission) => (
                  <tr key={commission.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-neutral-400" />
                        <span className="text-sm text-neutral-700">
                          {formatDate(commission.paid_at)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-primary-500" />
                        <div>
                          <p className="text-sm font-medium text-neutral-800">
                            #{commission.droptag_id}
                          </p>
                          {commission.tracking_code && (
                            <p className="text-xs text-neutral-500">{commission.tracking_code}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-blue-500" />
                        <p className="text-sm text-neutral-700">{toProperCase(commission.consumer_name) || "-"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-amber-500" />
                        <p className="text-sm text-neutral-700">{toProperCase(commission.driver_name) || "-"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-purple-500" />
                        <p className="text-sm text-neutral-700">{toProperCase(commission.receiver_name) || "-"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold text-neutral-800">
                        {formatCurrency(commission.total_value)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div>
                        <span className="text-sm font-medium text-green-600">
                          {formatCurrency(commission.platform_commission_amount)}
                        </span>
                        <p className="text-xs text-neutral-400">
                          {commission.platform_commission_percent}%
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div>
                        <span className="text-sm font-medium text-amber-600">
                          {formatCurrency(commission.driver_commission_amount)}
                        </span>
                        <p className="text-xs text-neutral-400">
                          {commission.driver_commission_percent}%
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div>
                        <span className="text-sm font-medium text-purple-600">
                          {formatCurrency(commission.receiver_commission_amount)}
                        </span>
                        <p className="text-xs text-neutral-400">
                          {commission.receiver_commission_percent}%
                        </p>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
