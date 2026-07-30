import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/react-app/hooks/useAuth";
import { useApi } from "@/react-app/hooks/useApi";
import { useTranslation } from "@/react-app/i18n";
import type { User } from "@/shared/types";
import { Header } from "@/react-app/components/Header";
import { CompleteProfileModal } from "@/react-app/components/CompleteProfileModal";
import { ProfileSwitchModal } from "@/react-app/components/ProfileSwitchModal";
import { CommissionAddressModal } from "@/react-app/components/CommissionAddressModal";
import { AlertModal } from "@/react-app/components/AlertModal";
import { ReceiverDocsModal } from "@/react-app/components/ReceiverDocsModal";
import { ConsumerView } from "@/react-app/components/ConsumerView";
import { ReceiverView } from "@/react-app/components/ReceiverView";
import { DeliveryView } from "@/react-app/components/DeliveryView";
import ExtractView from "@/react-app/pages/ExtractView";
import { Loader2 } from "lucide-react";

export default function DashboardPage() {
  const { t } = useTranslation();
  const { fetchProfile, fetchReceiverDocuments, updateLastActiveTab } = useApi();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"consumer" | "receiver" | "delivery">("consumer");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [slideDirection, setSlideDirection] = useState<"left" | "right">("right");

  const handleTabChange = (tab: "consumer" | "receiver" | "delivery") => {
    if (tab === activeTab) return;
    
    // Close extract view when switching tabs
    setShowExtract(false);
    
    // Check if user needs to register commission address for receiver/delivery tabs
    if ((tab === "receiver" || tab === "delivery") && profile && !((profile as any).commission_cep && (profile as any).commission_street)) {
      setPendingTabAfterAddress(tab);
      setShowCommissionAddressModal(true);
      return;
    }
    
    performTabChange(tab);
  };
  
  const performTabChange = (tab: "consumer" | "receiver" | "delivery") => {
    // Determine slide direction based on tab order
    const tabs: Array<"consumer" | "receiver" | "delivery"> = ["consumer", "receiver", "delivery"];
    const currentIndex = tabs.indexOf(activeTab);
    const newIndex = tabs.indexOf(tab);
    setSlideDirection(newIndex > currentIndex ? "right" : "left");
    
    setIsTransitioning(true);
    setIsExiting(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Save the tab preference
    updateLastActiveTab(tab);
    
    // Shorter, smoother transition
    setTimeout(() => {
      setActiveTab(tab);
      setIsExiting(true);
      setTimeout(() => {
        setIsTransitioning(false);
        setIsExiting(false);
      }, 250);
    }, 400);
  };
  const [isLoading, setIsLoading] = useState(true);
  const [showCompleteProfile, setShowCompleteProfile] = useState(false);
  const [showDisabledTabAlert, setShowDisabledTabAlert] = useState(false);
  const [showCommissionAddressModal, setShowCommissionAddressModal] = useState(false);
  const [pendingTabAfterAddress, setPendingTabAfterAddress] = useState<"receiver" | "delivery" | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [showExtract, setShowExtract] = useState(false);
  const [showProfileSwitch, setShowProfileSwitch] = useState(false);
  const [showPendingDocsAlert, setShowPendingDocsAlert] = useState(false);
  const [showPendingDocsUpload, setShowPendingDocsUpload] = useState(false);

  useEffect(() => {
    loadProfile();
    
    // Link referral code if stored (for Google login users)
    const storedReferralCode = localStorage.getItem("toodrop_referral_code");
    if (storedReferralCode) {
      fetch("/api/referrals/link-referred", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ referralCode: storedReferralCode }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            console.error("[Referral] link-referred failed:", res.status, data);
          }
          localStorage.removeItem("toodrop_referral_code");
        })
        .catch((err) => {
          console.error("[Referral] Error linking referral:", err);
          localStorage.removeItem("toodrop_referral_code");
        });
    }
  }, []);

  const loadProfile = async () => {
    setIsLoading(true);
    const response = await fetchProfile();
    
    // Check if user is deactivated
    if (response && typeof response === 'object' && 'deactivated' in response && response.deactivated) {
      await logout();
      navigate("/login?suspended=true", { replace: true });
      return;
    }
    
    const data = response as User | null;
    setProfile(data);
    
    // Determine target tab based on: 1) last saved preference, 2) main interest, 3) default to consumer
    let targetTab: "consumer" | "receiver" | "delivery" = "consumer";
    if (data?.last_active_tab && ["consumer", "receiver", "delivery"].includes(data.last_active_tab)) {
      targetTab = data.last_active_tab as "consumer" | "receiver" | "delivery";
    } else if (data?.main_interest && ["consumer", "receiver", "delivery"].includes(data.main_interest)) {
      targetTab = data.main_interest as "consumer" | "receiver" | "delivery";
    }
    
    // If user would land on receiver/delivery but doesn't have commission address, default to consumer
    const hasCommissionAddress = !!((data as any)?.commission_cep && (data as any)?.commission_street);
    if ((targetTab === "receiver" || targetTab === "delivery") && !hasCommissionAddress) {
      targetTab = "consumer";
    }
    
    setActiveTab(targetTab);
    
    // Check if user is admin
    if (data) {
      const adminCheck = await fetch("/api/admin/check", { credentials: "include" });
      if (adminCheck.ok) {
        const adminData = await adminCheck.json();
        setIsAdmin(adminData.isAdmin);
      }
    }
    
    setIsLoading(false);

    if (data && data.profile_status === "incomplete") {
      setShowCompleteProfile(true);
    } else if (
      data?.main_interest === "receiver" &&
      data.is_receiver_pending === 1 &&
      data.is_receiver_active !== 1
    ) {
      const receiverDocs = await fetchReceiverDocuments();
      const hasCompleteDocs = Boolean(
        receiverDocs?.id_document_url?.trim() &&
        receiverDocs?.selfie_url?.trim() &&
        receiverDocs?.address_proof_url?.trim()
      );

      if (!hasCompleteDocs || receiverDocs?.status === "action_required") {
        setShowPendingDocsAlert(true);
      }
    }
  };

  const handleOpenPendingDocuments = () => {
    setActiveTab("receiver");
    updateLastActiveTab("receiver");
    setShowPendingDocsUpload(true);
  };

  const handlePendingDocumentsSubmitted = async () => {
    setShowPendingDocsUpload(false);
    setShowPendingDocsAlert(false);
    await loadProfile();
  };

  const handleProfileComplete = async () => {
    setShowCompleteProfile(false);
    const response = await fetchProfile();
    
    // Check if user is deactivated
    if (response && typeof response === 'object' && 'deactivated' in response) {
      await logout();
      navigate("/login?suspended=true", { replace: true });
      return;
    }
    
    const updatedProfile = response as User | null;
    setProfile(updatedProfile);
    
    // If user registered as receiver or delivery, show commission address modal
    if (updatedProfile && (updatedProfile.main_interest === "receiver" || updatedProfile.main_interest === "delivery")) {
      if (!((updatedProfile as any).commission_cep && (updatedProfile as any).commission_street)) {
        setPendingTabAfterAddress(updatedProfile.main_interest as "receiver" | "delivery");
        setShowCommissionAddressModal(true);
        return;
      }
    }
    
    // Set active tab based on main interest
    if (updatedProfile?.main_interest) {
      setActiveTab(updatedProfile.main_interest as "consumer" | "receiver" | "delivery");
    }
  };
  
  const handleCommissionAddressComplete = async () => {
    setShowCommissionAddressModal(false);
    const response = await fetchProfile();
    
    // Check if user is deactivated
    if (response && typeof response === 'object' && 'deactivated' in response) {
      await logout();
      navigate("/login?suspended=true", { replace: true });
      return;
    }
    
    const updatedProfile = response as User | null;
    setProfile(updatedProfile);
    
    // Now switch to the pending tab
    if (pendingTabAfterAddress) {
      performTabChange(pendingTabAfterAddress);
      setPendingTabAfterAddress(null);
    }
  };

  // Handle profile update from modal - also switch to the new default tab
  const handleProfileUpdateFromModal = (updatedProfile: User) => {
    setProfile(updatedProfile);
    
    // If main_interest changed, switch to that tab
    if (updatedProfile.main_interest && updatedProfile.main_interest !== activeTab) {
      const newTab = updatedProfile.main_interest as "consumer" | "receiver" | "delivery";
      handleTabChange(newTab);
    }
  };

  // Swipe gesture handlers
  const minSwipeDistance = 50;

  const isInteractiveElement = (target: EventTarget | null): boolean => {
    if (!target || !(target instanceof HTMLElement)) return false;
    const tagName = target.tagName.toLowerCase();
    // Skip swipe on inputs, textareas, selects, buttons, or elements inside modals
    if (['input', 'textarea', 'select', 'button'].includes(tagName)) return true;
    // Check if element is inside a modal (has modal-related parent)
    if (target.closest('[role="dialog"], .modal, [class*="Modal"], [class*="modal"]')) return true;
    return false;
  };

  const onTouchStart = (e: React.TouchEvent) => {
    // Don't track swipe if any modal is open or touching interactive element
    if (showCompleteProfile || showCommissionAddressModal || showProfileSwitch || showExtract) {
      setTouchStart(null);
      return;
    }
    if (isInteractiveElement(e.target)) {
      setTouchStart(null);
      return;
    }
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return; // Skip if we didn't start tracking
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe || isRightSwipe) {
      const tabs: Array<"consumer" | "receiver" | "delivery"> = ["consumer", "receiver", "delivery"];
      const currentIndex = tabs.indexOf(activeTab);
      
      if (isLeftSwipe && currentIndex < tabs.length - 1) {
        // Swipe left = next tab
        handleTabChange(tabs[currentIndex + 1]);
      } else if (isRightSwipe && currentIndex > 0) {
        // Swipe right = previous tab
        handleTabChange(tabs[currentIndex - 1]);
      }
    }
    
    // Reset touch state
    setTouchStart(null);
    setTouchEnd(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" strokeWidth={2} />
      </div>
    );
  }

  const isProfileComplete = profile?.profile_status !== "incomplete";
  
  // Disable swipe when any modal is open
  const isSwipeEnabled = isProfileComplete && !showCompleteProfile && !showCommissionAddressModal && !showProfileSwitch && !showExtract;

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header 
        profile={profile} 
        showAdminLink={isAdmin} 
        onProfileUpdate={handleProfileUpdateFromModal}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onShowExtract={() => setShowExtract(true)}
      />
      
      {isTransitioning && (
        <div className={`fixed inset-0 bg-white/95 backdrop-blur-sm flex items-center justify-center z-[300] ${isExiting ? 'transition-overlay-exit' : 'transition-overlay-enter'}`}>
          <div className="flex flex-col items-center gap-5">
            <div className="logo-pulse">
              <img 
                src="https://mocha-cdn.com/019acbcb-92a6-7eb2-9ee6-8b655e0ba462/Sem-nome-(200-x-80-px).png" 
                alt="Toodrop"
                className="h-20 w-auto object-contain"
              />
            </div>
            <p className="text-neutral-600 font-medium text-base">{t("dashboard.switchingProfile")}</p>
          </div>
        </div>
      )}
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div 
          className="mb-6"
          onTouchStart={isSwipeEnabled ? onTouchStart : undefined}
          onTouchMove={isSwipeEnabled ? onTouchMove : undefined}
          onTouchEnd={isSwipeEnabled ? onTouchEnd : undefined}
        >
          {!isProfileComplete && (
            <div className="bg-white rounded-2xl shadow-soft p-12 sm:p-16 text-center min-h-[70vh] flex flex-col items-center justify-center">
              <div className="mb-8">
                <img 
                  src="https://mocha-cdn.com/019acbcb-92a6-7eb2-9ee6-8b655e0ba462/Sem-nome-(200-x-80-px).png" 
                  alt="Toodrop"
                  className="h-24 w-auto object-contain mx-auto"
                />
              </div>
              <p className="text-neutral-700 mb-6 text-balance text-xl sm:text-2xl font-semibold max-w-2xl">
                {t("dashboard.completeRegistrationTitle")}
              </p>
              <p className="text-base sm:text-lg text-neutral-500 mb-10 text-balance max-w-xl mx-auto">
                {t("dashboard.completeRegistrationDesc")}
              </p>
              <button
                onClick={() => setShowCompleteProfile(true)}
                className="bg-action-600 hover:bg-action-700 text-white font-semibold py-4 px-12 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg active:scale-95 text-lg"
              >
                {t("dashboard.completeRegistrationBtn")}
              </button>
            </div>
          )}

          {isProfileComplete && activeTab === "consumer" && (
            <div key="consumer" className={slideDirection === "right" ? "slide-in-right" : "slide-in-left"}>
              <ConsumerView profile={profile} onProfileUpdate={loadProfile} isActiveTab={activeTab === "consumer"} onShowProfileSwitch={() => setShowProfileSwitch(true)} />
            </div>
          )}

          {isProfileComplete && activeTab === "receiver" && (
            <div key="receiver" className={slideDirection === "right" ? "slide-in-right" : "slide-in-left"}>
              <ReceiverView profile={profile} onProfileUpdate={loadProfile} onShowProfileSwitch={() => setShowProfileSwitch(true)} />
            </div>
          )}

          {isProfileComplete && activeTab === "delivery" && (
            <div key="delivery" className={slideDirection === "right" ? "slide-in-right" : "slide-in-left"}>
              <DeliveryView profile={profile} onShowProfileSwitch={() => setShowProfileSwitch(true)} />
            </div>
          )}
        </div>
      </div>

      {showCompleteProfile && (
        <CompleteProfileModal 
          onClose={() => setShowCompleteProfile(false)}
          onComplete={handleProfileComplete}
        />
      )}

      {showCommissionAddressModal && (
        <CommissionAddressModal
          required={false}
          onClose={() => {
            setShowCommissionAddressModal(false);
            setPendingTabAfterAddress(null);
            // Return to consumer tab when closing
            performTabChange("consumer");
          }}
          onComplete={() => {
            setShowCommissionAddressModal(false);
            handleCommissionAddressComplete();
          }}
        />
      )}

      <AlertModal
        isOpen={showDisabledTabAlert}
        onClose={() => setShowDisabledTabAlert(false)}
        title={t("dashboard.incompleteRegistrationTitle")}
        message={t("dashboard.incompleteRegistrationMsg")}
        type="info"
        confirmText={t("dashboard.understood")}
      />

      <AlertModal
        isOpen={showPendingDocsAlert}
        onClose={() => setShowPendingDocsAlert(false)}
        title="Documentação pendente"
        message="Para concluir seu cadastro como TooDropper, você precisa enviar o restante da documentação."
        type="warning"
        confirmText="Enviar documentos"
        cancelText="Agora não"
        onConfirm={handleOpenPendingDocuments}
      />

      {showPendingDocsUpload && (
        <ReceiverDocsModal
          onClose={() => setShowPendingDocsUpload(false)}
          onSuccess={handlePendingDocumentsSubmitted}
        />
      )}

      {showExtract && (
        <ExtractView onBack={() => setShowExtract(false)} />
      )}

      <ProfileSwitchModal
        isOpen={showProfileSwitch}
        onClose={() => setShowProfileSwitch(false)}
        onSelect={(tab) => {
          setShowProfileSwitch(false);
          handleTabChange(tab);
        }}
        currentTab={activeTab}
        profile={profile}
        isLoading={isTransitioning}
      />

      {/* WhatsApp floating button */}
      <a
        href={`https://wa.me/553131575716?text=${encodeURIComponent("Oi, estou com algumas dúvidas sobre a Toodrop, pode me ajudar?")}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-[200] bg-[#25D366] hover:bg-[#20bd5a] text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95"
        aria-label="WhatsApp"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>
    </div>
  );
}
