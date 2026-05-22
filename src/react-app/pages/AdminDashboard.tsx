import { useState, useEffect } from "react";
import { useApi } from "@/react-app/hooks/useApi";
import { Users, Package, TrendingUp, Activity } from "lucide-react";

export default function AdminDashboardPage() {
  const { fetchPendingReceivers } = useApi();
  const [stats, setStats] = useState({
    pendingReceivers: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const receivers = await fetchPendingReceivers();
    setStats({
      pendingReceivers: receivers.length,
    });
  };

  const statCards = [
    {
      title: "Hubs",
      value: stats.pendingReceivers,
      icon: Users,
      color: "amber",
      bgColor: "bg-amber-100",
      textColor: "text-amber-700",
    },
    {
      title: "DropTags Ativos",
      value: "Em breve",
      icon: Package,
      color: "blue",
      bgColor: "bg-blue-100",
      textColor: "text-blue-700",
    },
    {
      title: "Entregas do Mês",
      value: "Em breve",
      icon: TrendingUp,
      color: "green",
      bgColor: "bg-green-100",
      textColor: "text-green-700",
    },
    {
      title: "Status do Sistema",
      value: "Operacional",
      icon: Activity,
      color: "emerald",
      bgColor: "bg-emerald-100",
      textColor: "text-emerald-700",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-2xl shadow-soft p-6 hover:shadow-medium transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`${stat.bgColor} p-3 rounded-xl`}>
                  <Icon className={`w-6 h-6 ${stat.textColor}`} strokeWidth={2} />
                </div>
              </div>
              <h3 className="text-neutral-600 text-sm font-medium mb-1">
                {stat.title}
              </h3>
              <p className="text-2xl font-bold text-neutral-900">
                {stat.value}
              </p>
            </div>
          );
        })}
      </div>

      
    </div>
  );
}
