import { useState, useEffect } from "react";
import { X, Gift, Link, Users, Mail, Copy, Check, Loader2, Send } from "lucide-react";

// X (formerly Twitter) logo icon
const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

// WhatsApp logo icon
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);
import { Portal } from "./Portal";
import { toProperCase } from "@/react-app/lib/utils";
import { useTranslation } from "@/react-app/i18n";

interface ReferralModalProps {
  userName: string;
  onClose: () => void;
}

interface Referral {
  id: number;
  referred_email: string;
  referred_name: string | null;
  status: "pending" | "registered" | "approved";
  created_at: string;
  approved_at: string | null;
}

export function ReferralModal({ userName, onClose }: ReferralModalProps) {
  const { t } = useTranslation();
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState<boolean | null>(null);
  const [isAcceptingTerms, setIsAcceptingTerms] = useState(false);
  const [activeTab, setActiveTab] = useState<"invite" | "referrals">("invite");
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [isLoadingReferrals, setIsLoadingReferrals] = useState(false);
  const [email, setEmail] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [referralLink, setReferralLink] = useState<string>("");
  const [isLoadingCode, setIsLoadingCode] = useState(true);

  useEffect(() => {
    checkTermsAcceptance();
    loadReferrals();
    loadReferralCode();
  }, []);

  const loadReferralCode = async () => {
    setIsLoadingCode(true);
    try {
      const response = await fetch('/api/referrals/code', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setReferralLink(data.link);
      }
    } catch (error) {
      console.error('Error loading referral code:', error);
    } finally {
      setIsLoadingCode(false);
    }
  };

  const checkTermsAcceptance = async () => {
    try {
      const response = await fetch('/api/referrals/check-terms', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setHasAcceptedTerms(data.accepted);
      } else {
        setHasAcceptedTerms(false);
      }
    } catch (error) {
      console.error('Error checking terms acceptance:', error);
      setHasAcceptedTerms(false);
    }
  };

  const acceptTerms = async () => {
    setIsAcceptingTerms(true);
    try {
      const response = await fetch('/api/referrals/accept-terms', {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        setHasAcceptedTerms(true);
      }
    } catch (error) {
      console.error('Error accepting terms:', error);
    } finally {
      setIsAcceptingTerms(false);
    }
  };

  const loadReferrals = async () => {
    setIsLoadingReferrals(true);
    try {
      const response = await fetch('/api/referrals/list', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setReferrals(data.referrals || []);
      }
    } catch (error) {
      console.error('Error loading referrals:', error);
    } finally {
      setIsLoadingReferrals(false);
    }
  };

  const handleSendEmail = async () => {
    if (!email.trim()) return;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError(t("referral.invalidEmail"));
      return;
    }

    setIsSendingEmail(true);
    setEmailError(null);

    try {
      const response = await fetch('/api/referrals/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim() }),
      });

      if (response.ok) {
        setEmailSent(true);
        setEmail("");
        loadReferrals();
        setTimeout(() => setEmailSent(false), 3000);
      } else {
        const data = await response.json();
        setEmailError(data.error || t("referral.sendError"));
      }
    } catch (error) {
      console.error('Error sending invite:', error);
      setEmailError(t("referral.sendErrorRetry"));
    } finally {
      setIsSendingEmail(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      console.error('Error copying link:', error);
    }
  };

  const shareWhatsApp = () => {
    const message = encodeURIComponent(
      t("referral.whatsappMessage", { name: toProperCase(userName.split(' ')[0]), link: referralLink })
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const shareTwitter = () => {
    const message = encodeURIComponent(
      t("referral.twitterMessage", { link: referralLink })
    );
    window.open(`https://twitter.com/intent/tweet?text=${message}`, '_blank');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-600 text-xs font-semibold rounded-full">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            {t("referral.statusApproved")}
          </span>
        );
      case "registered":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-600 text-xs font-semibold rounded-full">
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
            {t("referral.statusRegistered")}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-100 text-neutral-600 text-xs font-semibold rounded-full">
            <span className="w-2 h-2 bg-neutral-400 rounded-full"></span>
            {t("referral.statusPending")}
          </span>
        );
    }
  };

  // Loading state
  if (hasAcceptedTerms === null || isLoadingCode) {
    return (
      <Portal>
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[300] p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <div className="flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
            </div>
          </div>
        </div>
      </Portal>
    );
  }

  // Terms acceptance screen
  if (!hasAcceptedTerms) {
    return (
      <Portal>
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[300] p-4"
          onClick={onClose}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto modal-scroll"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white px-6 py-5 flex items-center justify-between border-b border-neutral-200 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="bg-primary-50 p-2.5 rounded-lg">
                  <Gift className="w-5 h-5 text-primary-600" strokeWidth={2.5} />
                </div>
                <h2 className="text-xl font-bold text-neutral-900">{t("referral.title")}</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-neutral-600" strokeWidth={2} />
              </button>
            </div>

            {/* Terms Content */}
            <div className="p-6 space-y-5">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-50 rounded-2xl mb-4">
                  <Gift className="w-8 h-8 text-green-600" strokeWidth={2} />
                </div>
                <h3 className="text-lg font-bold text-neutral-900 mb-2">
                  {t("referral.programTermsTitle")}
                </h3>
                <p className="text-neutral-600 text-sm">
                  {t("referral.programTermsDesc")}
                </p>
              </div>

              <div className="bg-neutral-50 rounded-xl p-5 border border-neutral-200">
                <div className="space-y-3 text-sm text-neutral-700 leading-relaxed">
                  <p className="font-semibold text-neutral-900">
                    {t("referral.programName")}
                  </p>
                  
                  <p>
                    {t("referral.agreementIntro")}
                  </p>

                  <div className="space-y-2">
                    <p className="font-medium text-neutral-900">{t("referral.term1Title")}</p>
                    <p>
                      {t("referral.term1Content")}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="font-medium text-neutral-900">{t("referral.term2Title")}</p>
                    <p>
                      {t("referral.term2Content")}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="font-medium text-neutral-900">{t("referral.term3Title")}</p>
                    <p>
                      {t("referral.term3Content")}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="font-medium text-neutral-900">{t("referral.term4Title")}</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>{t("referral.term4Rule1")}</li>
                      <li>{t("referral.term4Rule2")}</li>
                      <li>{t("referral.term4Rule3")}</li>
                      <li>{t("referral.term4Rule4")}</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <p className="font-medium text-neutral-900">{t("referral.term5Title")}</p>
                    <p>
                      {t("referral.term5Content")}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={acceptTerms}
                disabled={isAcceptingTerms}
                className="w-full bg-action-600 hover:bg-action-700 text-white font-semibold py-3.5 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isAcceptingTerms ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{t("referral.processing")}</span>
                  </>
                ) : (
                  <span>{t("referral.acceptTerms")}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </Portal>
    );
  }

  // Main referral modal (after accepting terms)
  return (
    <Portal>
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[300] p-4"
        onClick={onClose}
      >
        <div 
          className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white px-6 py-5 border-b border-neutral-200 rounded-t-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-primary-50 p-2.5 rounded-lg">
                  <Gift className="w-5 h-5 text-primary-600" strokeWidth={2.5} />
                </div>
                <h2 className="text-xl font-bold text-neutral-900">{t("referral.title")}</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-neutral-600" strokeWidth={2} />
              </button>
            </div>
            <div className="bg-green-50 rounded-xl p-4 border border-green-200">
              <p className="text-sm text-green-700 mb-1">{t("referral.earnPerReferral")}:</p>
              <p className="text-3xl font-bold text-green-600">R$ 30,00</p>
              <p className="text-sm text-green-600 mt-1">{t("referral.perApprovedNeighbor")}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-neutral-200">
            <button
              onClick={() => setActiveTab("invite")}
              className={`flex-1 py-3 px-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                activeTab === "invite"
                  ? "text-primary-600 border-b-2 border-primary-600"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              <Link className="w-4 h-4" strokeWidth={2} />
              {t("referral.invite")}
            </button>
            <button
              onClick={() => {
                setActiveTab("referrals");
                loadReferrals();
              }}
              className={`flex-1 py-3 px-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                activeTab === "referrals"
                  ? "text-primary-600 border-b-2 border-primary-600"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              <Users className="w-4 h-4" strokeWidth={2} />
              {t("referral.myReferrals")}
              {referrals.length > 0 && (
                <span className="bg-neutral-200 text-neutral-700 px-1.5 py-0.5 rounded text-xs">
                  {referrals.length}
                </span>
              )}
            </button>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[50vh] overflow-y-auto modal-scroll">
            {activeTab === "invite" ? (
              <div className="space-y-5">
                {/* Email invite */}
                <div className="bg-neutral-50 rounded-xl p-5 border border-neutral-200">
                  <label className="block text-sm font-semibold text-neutral-900 mb-3">
                    {t("referral.sendInviteByEmail")}
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" strokeWidth={2} />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setEmailError(null);
                        }}
                        placeholder="email@exemplo.com"
                        className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent bg-white"
                      />
                    </div>
                    <button
                      onClick={handleSendEmail}
                      disabled={isSendingEmail || !email.trim()}
                      className="bg-action-600 hover:bg-action-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isSendingEmail ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : emailSent ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Send className="w-4 h-4" strokeWidth={2} />
                      )}
                    </button>
                  </div>
                  {emailError && (
                    <p className="text-sm text-red-600 mt-2">{emailError}</p>
                  )}
                  {emailSent && (
                    <p className="text-sm text-green-600 mt-2">{t("referral.inviteSent")}</p>
                  )}
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-neutral-200"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-3 bg-white text-neutral-500">{t("referral.orShareLink")}</span>
                  </div>
                </div>

                {/* Share buttons */}
                <div className="space-y-3">
                  <button
                    onClick={shareWhatsApp}
                    className="w-full flex items-center gap-3 p-4 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl transition-colors"
                  >
                    <div className="bg-green-500 p-2.5 rounded-lg flex-shrink-0">
                      <WhatsAppIcon className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-neutral-900">WhatsApp</p>
                      <p className="text-sm text-neutral-600">{t("referral.sendToContacts")}</p>
                    </div>
                  </button>

                  <button
                    onClick={shareTwitter}
                    className="w-full flex items-center gap-3 p-4 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl transition-colors"
                  >
                    <div className="bg-sky-500 p-2.5 rounded-lg flex-shrink-0">
                      <XIcon className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-neutral-900">X</p>
                      <p className="text-sm text-neutral-600">{t("referral.shareWithFollowers")}</p>
                    </div>
                  </button>

                  <button
                    onClick={copyLink}
                    className="w-full flex items-center gap-3 p-4 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl transition-colors"
                  >
                    <div className="bg-neutral-600 p-2.5 rounded-lg flex-shrink-0">
                      {copiedLink ? (
                        <Check className="w-5 h-5 text-white" strokeWidth={2} />
                      ) : (
                        <Copy className="w-5 h-5 text-white" strokeWidth={2} />
                      )}
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="font-semibold text-neutral-900">
                        {copiedLink ? t("referral.linkCopied") : t("referral.copyLink")}
                      </p>
                      <p className="text-sm text-neutral-600 truncate">{referralLink}</p>
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {isLoadingReferrals ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
                  </div>
                ) : referrals.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-50 rounded-2xl mb-4 border border-neutral-200">
                      <Users className="w-8 h-8 text-neutral-400" strokeWidth={2} />
                    </div>
                    <p className="text-neutral-900 font-medium mb-2">{t("referral.noReferralsYet")}</p>
                    <p className="text-sm text-neutral-500">
                      {t("referral.shareAndEarn")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {referrals.map((referral) => (
                      <div
                        key={referral.id}
                        className="bg-neutral-50 border border-neutral-200 rounded-xl p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold text-neutral-900">
                            {referral.referred_name 
                              ? toProperCase(referral.referred_name)
                              : referral.referred_email}
                          </div>
                          {getStatusBadge(referral.status)}
                        </div>
                        {referral.referred_name && (
                          <p className="text-sm text-neutral-500 mb-1">{referral.referred_email}</p>
                        )}
                        <p className="text-xs text-neutral-400">
                          {t("referral.referredOn")} {new Date(referral.created_at).toLocaleDateString("pt-BR")}
                          {referral.status === "approved" && referral.approved_at && (
                            <> • {t("referral.approvedOn")} {new Date(referral.approved_at).toLocaleDateString("pt-BR")}</>
                          )}
                        </p>
                        {referral.status === "approved" && (
                          <div className="mt-2 pt-2 border-t border-neutral-200">
                            <span className="text-sm font-semibold text-green-600">
                              {t("referral.credited")}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
