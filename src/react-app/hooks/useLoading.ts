import { create } from "zustand";

interface LoadingStore {
  isLoading: boolean;
  message: string | null;
  setLoading: (loading: boolean) => void;
  showLoading: (message?: string) => void;
  hideLoading: () => void;
  setMessage: (message: string | null) => void;
}

export const useLoading = create<LoadingStore>((set) => ({
  isLoading: false,
  message: null,
  setLoading: (loading: boolean) => set({ isLoading: loading }),
  showLoading: (message?: string) => set({ isLoading: true, message: message || null }),
  hideLoading: () => set({ isLoading: false, message: null }),
  setMessage: (message: string | null) => set({ message }),
}));
