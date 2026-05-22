import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router";
import { useApi } from "@/react-app/hooks/useApi";
import { AdminLayout } from "@/react-app/components/AdminLayout";
import AdminDashboardPage from "@/react-app/pages/AdminDashboard";
import AdminReceiverApprovalsPage from "@/react-app/pages/AdminReceiverApprovals";
import AdminR2DiagnosticPage from "@/react-app/pages/AdminR2Diagnostic";
import AdminHubLocationLogsPage from "@/react-app/pages/AdminHubLocationLogs";
import AdminCommissionsPage from "@/react-app/pages/AdminCommissions";
import AdminAsaasExtractPage from "@/react-app/pages/AdminAsaasExtract";
import AdminWithdrawalsPage from "@/react-app/pages/AdminWithdrawals";
import { AdminUsers } from "@/react-app/pages/AdminUsers";
import { AdminDroptags } from "@/react-app/pages/AdminDroptags";
import { Loader2 } from "lucide-react";

export default function AdminPage() {
  const { fetchProfile, isLoading } = useApi();
  const [profile, setProfile] = useState<any>(null);
  const location = useLocation();

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const loadProfile = async () => {
    const data = await fetchProfile();
    setProfile(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" strokeWidth={2} />
      </div>
    );
  }

  return (
    <AdminLayout profile={profile}>
      <Routes>
        <Route path="/" element={<AdminDashboardPage />} />
        <Route path="/receivers" element={<AdminReceiverApprovalsPage />} />
        <Route path="/r2-diagnostic" element={<AdminR2DiagnosticPage />} />
        <Route path="/hub-logs" element={<AdminHubLocationLogsPage />} />
        <Route path="/commissions" element={<AdminCommissionsPage />} />
        <Route path="/asaas-extract" element={<AdminAsaasExtractPage />} />
        <Route path="/withdrawals" element={<AdminWithdrawalsPage />} />
        <Route path="/users" element={<AdminUsers />} />
        <Route path="/droptags" element={<AdminDroptags />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminLayout>
  );
}
