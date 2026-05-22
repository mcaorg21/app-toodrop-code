import { Header } from "@/react-app/components/Header";
import { Link, useLocation } from "react-router";
import { TrendingUp, Users, Percent, UserSearch, Package, Wallet, ArrowDownToLine } from "lucide-react";
import type { User } from "@/shared/types";

interface AdminLayoutProps {
  profile: User | null;
  children: React.ReactNode;
}

export function AdminLayout({ profile, children }: AdminLayoutProps) {
  const location = useLocation();
  
  const isActive = (path: string) => {
    if (path === "/admin") {
      return location.pathname === "/admin";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header profile={profile} showAdminLink={true} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <nav className="bg-white rounded-2xl shadow-soft p-4 mb-6">
          <div className="flex gap-2 flex-wrap">
            <Link
              to="/admin"
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                isActive("/admin")
                  ? "bg-primary-100 text-primary-700"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              <TrendingUp className="w-4 h-4" strokeWidth={2} />
              Visão Geral
            </Link>
            <Link
              to="/admin/receivers"
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                isActive("/admin/receivers")
                  ? "bg-primary-100 text-primary-700"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              <Users className="w-4 h-4" strokeWidth={2} />
              Gerir Hubs
            </Link>
            <Link
              to="/admin/commissions"
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                isActive("/admin/commissions")
                  ? "bg-primary-100 text-primary-700"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              <Percent className="w-4 h-4" strokeWidth={2} />
              Comissões
            </Link>
            <Link
              to="/admin/users"
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                isActive("/admin/users")
                  ? "bg-primary-100 text-primary-700"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              <UserSearch className="w-4 h-4" strokeWidth={2} />
              Usuários
            </Link>
            <Link
              to="/admin/droptags"
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                isActive("/admin/droptags")
                  ? "bg-primary-100 text-primary-700"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              <Package className="w-4 h-4" strokeWidth={2} />
              DropTags
            </Link>
            <Link
              to="/admin/asaas-extract"
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                isActive("/admin/asaas-extract")
                  ? "bg-primary-100 text-primary-700"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              <Wallet className="w-4 h-4" strokeWidth={2} />
              Extrato Asaas
            </Link>
            <Link
              to="/admin/withdrawals"
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                isActive("/admin/withdrawals")
                  ? "bg-primary-100 text-primary-700"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              <ArrowDownToLine className="w-4 h-4" strokeWidth={2} />
              Saques
            </Link>
          </div>
        </nav>
        
        {children}
      </div>
    </div>
  );
}
