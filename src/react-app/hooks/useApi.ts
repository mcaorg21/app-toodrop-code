import { useState } from "react";
import { useLoading } from "@/react-app/hooks/useLoading";
import type { 
  User, 
  Address, 
  DropTag, 
  ReceiverDocs, 
  Schedule,
  CompleteProfileInput,
  AddressInput,
  CreateDropTagInput,
  UpdateScheduleInput,
} from "@/shared/types";

export function useApi() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showLoading, hideLoading } = useLoading();

  const fetchProfile = async (): Promise<User | null | { deactivated: true }> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/profile", { credentials: "include" });
      if (!response.ok) {
        if (response.status === 403) {
          const data = await response.json();
          if (data.error?.includes("desativado")) {
            return { deactivated: true };
          }
        }
        throw new Error("Failed to fetch profile");
      }
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const checkCpfAvailability = async (cpf: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/profile/check-cpf/${cpf}`, { credentials: "include" });
      if (!response.ok) return false;
      const data = await response.json();
      return data.available;
    } catch {
      return false;
    }
  };

  const completeProfile = async (data: CompleteProfileInput): Promise<User | null> => {
    try {
      setIsLoading(true);
      setError(null);
      showLoading();
      const response = await fetch("/api/profile/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to complete profile");
      }
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return null;
    } finally {
      setIsLoading(false);
      hideLoading();
    }
  };

  const updateMainInterest = async (main_interest: "consumer" | "receiver" | "delivery"): Promise<User | null> => {
    try {
      setIsLoading(true);
      setError(null);
      showLoading();
      const response = await fetch("/api/profile/main-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ main_interest }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update main interest");
      }
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return null;
    } finally {
      setIsLoading(false);
      hideLoading();
    }
  };

  const updateLastActiveTab = async (tab: "consumer" | "receiver" | "delivery"): Promise<boolean> => {
    try {
      const response = await fetch("/api/profile/last-active-tab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tab }),
      });
      if (!response.ok) throw new Error("Failed to update last active tab");
      return true;
    } catch (err) {
      console.error("Error updating last active tab:", err);
      return false;
    }
  };

  const fetchAddresses = async (): Promise<Address[]> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/addresses", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch addresses");
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const createAddress = async (data: AddressInput): Promise<Address | null> => {
    try {
      setIsLoading(true);
      setError(null);
      showLoading();
      const response = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to create address");
      }
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return null;
    } finally {
      setIsLoading(false);
      hideLoading();
    }
  };

  const updateAddress = async (id: number, data: AddressInput): Promise<Address | null> => {
    try {
      setIsLoading(true);
      setError(null);
      showLoading();
      const response = await fetch(`/api/addresses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update address");
      }
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return null;
    } finally {
      setIsLoading(false);
      hideLoading();
    }
  };

  const deleteAddress = async (id: number): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/addresses/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete address");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDropTags = async (): Promise<DropTag[]> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/droptags", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch droptags");
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const fetchNearbyHubs = async (addressId: number, maxDistance: number): Promise<any[]> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/droptags/nearby-hubs/${addressId}?maxDistance=${maxDistance}`, { credentials: "include" });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Erro ao buscar hubs: ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const createDropTag = async (data: CreateDropTagInput): Promise<DropTag | null> => {
    try {
      setIsLoading(true);
      setError(null);
      showLoading();
      const response = await fetch("/api/droptags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to create droptag");
      }
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return null;
    } finally {
      setIsLoading(false);
      hideLoading();
    }
  };

  const updateDropTag = async (id: number, data: Partial<CreateDropTagInput>): Promise<DropTag | null> => {
    try {
      setIsLoading(true);
      setError(null);
      showLoading();
      const response = await fetch(`/api/droptags/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update droptag");
      }
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return null;
    } finally {
      setIsLoading(false);
      hideLoading();
    }
  };

  const deleteDropTag = async (id: number): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/droptags/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete droptag");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const fetchQRCode = async (uuid: string): Promise<string | null> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/droptags/${uuid}/qrcode`);
      if (!response.ok) throw new Error("Failed to fetch QR code");
      const data = await response.json();
      return data.qrCodeDataUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAuthorizedReceivers = async (droptagId: number): Promise<any[]> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/droptags/${droptagId}/authorized-receivers`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch authorized receivers");
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const uploadReceiverDocuments = async (docs: {
    id_document: File;
    id_document_back?: File;
    selfie: File;
    address_proof: File;
    address_proof_type: string;
  }): Promise<ReceiverDocs | null> => {
    try {
      setIsLoading(true);
      setError(null);
      showLoading();

      const formData = new FormData();
      formData.append("id_document", docs.id_document);
      if (docs.id_document_back) {
        formData.append("id_document_back", docs.id_document_back);
      }
      formData.append("selfie", docs.selfie);
      formData.append("address_proof", docs.address_proof);
      formData.append("address_proof_type", docs.address_proof_type);

      const response = await fetch("/api/receiver/documents/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to upload documents");
      }
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return null;
    } finally {
      setIsLoading(false);
      hideLoading();
    }
  };

  const submitReceiverDocuments = async (docs: {
    id_document_url: string;
    selfie_url: string;
    address_proof_url: string;
    address_proof_type: string;
  }): Promise<ReceiverDocs | null> => {
    try {
      setIsLoading(true);
      setError(null);
      showLoading();
      const response = await fetch("/api/receiver/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(docs),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to submit documents");
      }
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return null;
    } finally {
      setIsLoading(false);
      hideLoading();
    }
  };

  const fetchReceiverDocuments = async (): Promise<ReceiverDocs | null> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/receiver/documents", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch documents");
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSchedule = async (): Promise<Schedule[]> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/receiver/schedule", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch schedule");
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const updateSchedule = async (data: UpdateScheduleInput): Promise<Schedule[]> => {
    try {
      setIsLoading(true);
      setError(null);
      showLoading();
      const response = await fetch("/api/receiver/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update schedule");
      }
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return [];
    } finally {
      setIsLoading(false);
      hideLoading();
    }
  };

  const fetchHubLocationLogs = async (): Promise<any[]> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/admin/hub-location-logs", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch hub location logs");
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const saveDeliveryLocation = async (latitude: number, longitude: number): Promise<boolean> => {
    try {
      const response = await fetch("/api/delivery/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ latitude, longitude }),
      });
      if (!response.ok) throw new Error("Failed to save delivery location");
      return true;
    } catch (err) {
      console.error("Error saving delivery location:", err);
      return false;
    }
  };

  const findNearbyDeliveries = async (latitude: number, longitude: number, maxDistance = 5000): Promise<{ count: number; deliveries: any[] }> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/delivery/nearby-deliveries?latitude=${latitude}&longitude=${longitude}&maxDistance=${maxDistance}`, { 
        credentials: "include" 
      });
      if (!response.ok) throw new Error("Failed to find nearby deliveries");
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return { count: 0, deliveries: [] };
    } finally {
      setIsLoading(false);
    }
  };

  const getMyDeliveries = async (): Promise<any[]> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/delivery/my-deliveries", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to get deliveries");
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const getNearbyReceivers = async (droptagId: number): Promise<{ droptag: any; receivers: any[] } | null> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/delivery/nearby-receivers/${droptagId}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to get nearby receivers");
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const getReceiverDeliveries = async (): Promise<any[]> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/receiver/my-deliveries", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to get receiver deliveries");
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const fetchReceiverStats = async (): Promise<{ inAnalysis: number; pendingAction: number; approved: number; rejected: number }> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/admin/receiver-stats", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch receiver stats");
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return { inAnalysis: 0, pendingAction: 0, approved: 0, rejected: 0 };
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPendingReceivers = async (status?: string): Promise<any[]> => {
    try {
      setIsLoading(true);
      setError(null);
      const url = status && status !== 'all' 
        ? `/api/admin/pending-receivers?status=${status}` 
        : "/api/admin/pending-receivers";
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch pending receivers");
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const approveReceiver = async (
    userId: number, 
    notes?: string,
    manualLatitude?: number,
    manualLongitude?: number
  ): Promise<{ 
    success: boolean; 
    error?: string; 
    needs_coordinates?: boolean;
    address?: { street: string; number: string; neighborhood: string; city: string; state: string; cep: string };
  }> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/admin/approve-receiver/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          notes: notes || null,
          manualLatitude,
          manualLongitude
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        const errorMsg = data.error || "Falha ao aprovar receptor";
        setError(errorMsg);
        return { 
          success: false, 
          error: errorMsg,
          needs_coordinates: data.needs_coordinates,
          address: data.address
        };
      }
      return { success: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  };

  const rejectReceiver = async (userId: number, notes: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/admin/reject-receiver/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notes }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to reject receiver");
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const setPendingReceiver = async (userId: number, notes: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/admin/set-pending/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notes }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to set pending");
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const updateReceiverCommission = async (
    userId: number,
    commission: {
      service_price: number;
      receiver_percent: number;
      driver_percent: number;
      platform_percent: number;
    }
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/admin/receiver-commission/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(commission),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || "Erro ao atualizar comissões" };
      }
      return { success: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  };

  const toggleUserAdmin = async (
    userId: number
  ): Promise<{ success: boolean; isAdmin?: boolean; message?: string; error?: string }> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/admin/toggle-admin/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || "Erro ao alterar permissão de admin" };
      }
      return { success: true, isAdmin: data.isAdmin, message: data.message };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPointStatus = async (): Promise<{ receiver_key: string; is_active: number; active_hub: number; last_ping?: string } | null> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/receiver/point-status", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch point status");
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const updatePointStatus = async (isActive: boolean): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      showLoading();
      const response = await fetch("/api/receiver/point-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_active: isActive }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update point status");
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return false;
    } finally {
      setIsLoading(false);
      hideLoading();
    }
  };

  const updateHubActiveStatus = async (activeHub: number): Promise<boolean> => {
    try {
      const response = await fetch("/api/receiver/hub-active-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ active_hub: activeHub }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update hub status");
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return false;
    }
  };

  const fetchAllUsers = async (): Promise<any[]> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/admin/users", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch users");
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserDetails = async (userId: number): Promise<any | null> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/admin/users/${userId}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch user details");
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const toggleUserActive = async (userId: number): Promise<{ success: boolean; is_active: number } | null> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/admin/users/${userId}/toggle-active`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to toggle user status");
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const apiMethods = {
    isLoading,
    error,
    fetchProfile,
    completeProfile,
    updateMainInterest,
    updateLastActiveTab,
    fetchAddresses,
    createAddress,
    updateAddress,
    deleteAddress,
    fetchDropTags,
    fetchNearbyHubs,
    createDropTag,
    updateDropTag,
    deleteDropTag,
    fetchQRCode,
    fetchAuthorizedReceivers,
    uploadReceiverDocuments,
    submitReceiverDocuments,
    fetchReceiverDocuments,
    fetchSchedule,
    updateSchedule,
    fetchReceiverStats,
    fetchPendingReceivers,
    approveReceiver,
    rejectReceiver,
    setPendingReceiver,
    updateReceiverCommission,
    fetchPointStatus,
    updatePointStatus,
    updateHubActiveStatus,
    fetchHubLocationLogs,
    saveDeliveryLocation,
    findNearbyDeliveries,
    getMyDeliveries,
    getNearbyReceivers,
    getReceiverDeliveries,
    fetchAllUsers,
    fetchUserDetails,
    toggleUserActive,
    toggleUserAdmin,
    getWalletExtract,
    getWalletBalance,
    createWithdrawal,
  };

  async function getWalletExtract(startDate: string, endDate: string, page: number, limit: number) {
    const response = await fetch(
      `/api/profile/extract?startDate=${startDate}&endDate=${endDate}&offset=${(page - 1) * limit}&limit=${limit}`,
      { credentials: 'include' }
    );
    if (!response.ok) throw new Error("Erro ao buscar extrato");
    return await response.json();
  }

  async function getWalletBalance() {
    const response = await fetch('/api/profile/balance', { credentials: 'include' });
    if (!response.ok) throw new Error("Erro ao buscar saldo");
    return await response.json();
  }

  async function createWithdrawal(value: number) {
    const response = await fetch('/api/profile/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ value })
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Erro ao criar saque');
    }
    return await response.json();
  }

  async function deleteUser(userId: number, password: string) {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ password })
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Erro ao deletar usuário');
    }
    return await response.json();
  }

  async function deleteDroptagAdmin(droptagId: number, password: string) {
    const response = await fetch(`/api/admin/droptags/${droptagId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ password })
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Erro ao deletar droptag');
    }
    return await response.json();
  }

  async function getPixKeys() {
    const response = await fetch('/api/profile/pix-keys', { credentials: 'include' });
    if (!response.ok) throw new Error("Erro ao buscar chaves PIX");
    return await response.json();
  }

  async function fetchWithdrawals() {
    const response = await fetch('/api/admin/withdrawals', { credentials: 'include' });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Erro ao buscar solicitações");
    }
    return await response.json();
  }

  async function updateWithdrawalStatus(withdrawalId: number, status: string, adminNotes: string | null) {
    const response = await fetch(`/api/admin/withdrawals/${withdrawalId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status, admin_notes: adminNotes })
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Erro ao atualizar status");
    }
    return await response.json();
  }

  return {
    ...apiMethods,
    getPixKeys,
    deleteUser,
    deleteDroptagAdmin,
    checkCpfAvailability,
    fetchWithdrawals,
    updateWithdrawalStatus,
  };
}
