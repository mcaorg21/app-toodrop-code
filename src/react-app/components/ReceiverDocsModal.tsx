import { useState, useRef, useEffect } from "react";
import { X, Loader2, Upload, Camera, ArrowRight, ArrowLeft, CheckCircle, XCircle, Clock } from "lucide-react";
import { CameraCapture } from "./CameraCapture";
import { Portal } from "./Portal";
import { useTranslation } from "@/react-app/i18n";

interface ReceiverDocsModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const PROOF_TYPES = [
  { value: "water", labelKey: "receiverDocs.proofTypes.water" },
  { value: "electricity", labelKey: "receiverDocs.proofTypes.electricity" },
  { value: "internet", labelKey: "receiverDocs.proofTypes.internet" },
  { value: "cable_tv", labelKey: "receiverDocs.proofTypes.cable_tv" },
];

interface DocValidation {
  doc_type: string;
  status: "pending" | "approved" | "rejected";
  rejection_reason?: string;
}

interface ValidationStatus {
  validations: DocValidation[];
  overall_status: string;
  all_approved: boolean;
  all_validated: boolean;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  id_document: "receiverDocs.docTypes.id_document",
  selfie: "receiverDocs.docTypes.selfie",
  address_proof: "receiverDocs.docTypes.address_proof",
};

export function ReceiverDocsModal({ onClose, onSuccess }: ReceiverDocsModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [validationStatus, setValidationStatus] = useState<ValidationStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [reuploadingDocType, setReuploadingDocType] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState<"id_document" | "id_document_back" | "selfie" | "address_proof" | null>(null);
  
  const [files, setFiles] = useState({
    id_document: null as File | null,
    id_document_back: null as File | null,
    selfie: null as File | null,
    address_proof: null as File | null,
  });

  const [previews, setPreviews] = useState({
    id_document: null as string | null,
    id_document_back: null as string | null,
    selfie: null as string | null,
    address_proof: null as string | null,
  });

  const [addressProofType, setAddressProofType] = useState("");
  const [includeBackSide, setIncludeBackSide] = useState(false);

  const idDocInputRef = useRef<HTMLInputElement>(null);
  const idDocBackInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const addressProofInputRef = useRef<HTMLInputElement>(null);
  const reuploadInputRef = useRef<HTMLInputElement>(null);

  // Poll for validation status when on step 5
  useEffect(() => {
    if (step !== 5) return;

    const pollStatus = async () => {
      try {
        const response = await fetch("/api/receiver/documents/validation-status", {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setValidationStatus(data);
          
          // Stop polling if all validated
          if (data.all_validated) {
            setIsPolling(false);
          }
        }
      } catch (err) {
        console.error("Error polling validation status:", err);
      }
    };

    // Initial fetch
    pollStatus();
    setIsPolling(true);

    // Poll every 5 seconds
    const interval = setInterval(() => {
      if (isPolling) {
        pollStatus();
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      setIsPolling(false);
    };
  }, [step, isPolling]);

  const handleFileChange = (field: keyof typeof files, file: File | null) => {
    if (file) {
      setFiles({ ...files, [field]: file });
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews({ ...previews, [field]: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCameraCapture = (field: keyof typeof files, file: File) => {
    handleFileChange(field, file);
    setShowCamera(null);
  };

  // Upload ID Document and send to n8n (Step 1 → Step 2)
  const handleUploadIdDocument = async () => {
    if (!files.id_document) return;
    
    setIsUploading(true);
    setUploadError(null);
    
    try {
      const formData = new FormData();
      formData.append("id_document", files.id_document);
      if (files.id_document_back) {
        formData.append("id_document_back", files.id_document_back);
      }
      
      const response = await fetch("/api/receiver/documents/upload/id-document", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t("receiverDocs.errors.document"));
      }
      
      setStep(2);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : t("receiverDocs.errors.document"));
    } finally {
      setIsUploading(false);
    }
  };

  // Upload Selfie and send to n8n (Step 2 → Step 3)
  const handleUploadSelfie = async () => {
    if (!files.selfie) return;
    
    setIsUploading(true);
    setUploadError(null);
    
    try {
      const formData = new FormData();
      formData.append("selfie", files.selfie);
      
      const response = await fetch("/api/receiver/documents/upload/selfie", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t("receiverDocs.errors.selfie"));
      }
      
      setStep(3);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : t("receiverDocs.errors.selfie"));
    } finally {
      setIsUploading(false);
    }
  };

  // Upload Address Proof and send to n8n (Step 4 → Step 5)
  const handleUploadAddressProof = async () => {
    if (!files.address_proof || !addressProofType) return;
    
    setIsUploading(true);
    setUploadError(null);
    
    try {
      const formData = new FormData();
      formData.append("address_proof", files.address_proof);
      formData.append("address_proof_type", addressProofType);
      
      const response = await fetch("/api/receiver/documents/upload/address-proof", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t("receiverDocs.errors.proof"));
      }
      
      setStep(5);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : t("receiverDocs.errors.proof"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleFinish = () => {
    if (validationStatus?.all_approved) {
      onSuccess();
    }
  };

  // Handle re-upload of rejected document
  const handleReuploadRejected = async (file: File) => {
    if (!reuploadingDocType || !file) return;
    
    setIsUploading(true);
    setUploadError(null);
    
    try {
      const formData = new FormData();
      let endpoint = "";
      
      if (reuploadingDocType === "id_document") {
        formData.append("id_document", file);
        endpoint = "/api/receiver/documents/upload/id-document";
      } else if (reuploadingDocType === "selfie") {
        formData.append("selfie", file);
        endpoint = "/api/receiver/documents/upload/selfie";
      } else if (reuploadingDocType === "address_proof") {
        formData.append("address_proof", file);
        formData.append("address_proof_type", addressProofType || "electricity");
        endpoint = "/api/receiver/documents/upload/address-proof";
      }
      
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t("receiverDocs.errors.resend"));
      }
      
      // Reset and start polling again
      setReuploadingDocType(null);
      setIsPolling(true);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : t("receiverDocs.errors.resend"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleReuploadFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleReuploadRejected(file);
    }
  };

  const startReupload = (docType: string) => {
    setReuploadingDocType(docType);
    setUploadError(null);
    // Trigger file input after a small delay to ensure state is set
    setTimeout(() => {
      reuploadInputRef.current?.click();
    }, 100);
  };

  const canProceedStep1 = !!files.id_document && (!includeBackSide || !!files.id_document_back);
  const canProceedStep2 = !!files.selfie;
  const canProceedStep3 = !!addressProofType;
  const canProceedStep4 = !!files.address_proof;

  const isPdf = (file: File | null) => {
    return file?.type === 'application/pdf' || file?.name.toLowerCase().endsWith('.pdf');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="w-6 h-6 text-green-600" strokeWidth={2} />;
      case "rejected":
        return <XCircle className="w-6 h-6 text-red-600" strokeWidth={2} />;
      default:
        return <Clock className="w-6 h-6 text-amber-500 animate-pulse" strokeWidth={2} />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "approved":
        return t("receiverDocs.step5.approved");
      case "rejected":
        return t("receiverDocs.step5.rejected");
      default:
        return t("receiverDocs.step5.awaitingReview");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-50 border-green-200";
      case "rejected":
        return "bg-red-50 border-red-200";
      default:
        return "bg-amber-50 border-amber-200";
    }
  };

  return (
    <>
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[250] backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-strong w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-neutral-100 p-6 flex items-center justify-between rounded-t-3xl z-10">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">
              {t("receiverDocs.title")}
            </h2>
            <p className="text-sm text-neutral-500 mt-1">
              {t("common.stepOf", { current: step, total: 5 })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <X className="w-6 h-6" strokeWidth={2} />
          </button>
        </div>

        <div className="p-6">
          {uploadError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600 font-medium">{uploadError}</p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-sm text-blue-900 leading-relaxed">
                  {t("receiverDocs.step1.hint")}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  {t("receiverDocs.step1.idDocFront")}
                </label>
                <input
                  ref={idDocInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => handleFileChange('id_document', e.target.files?.[0] || null)}
                  className="hidden"
                />
                
                {previews.id_document ? (
                  <div className="w-full px-4 py-3 border-2 border-green-300 rounded-xl bg-green-50">
                    <div className="space-y-2">
                      {isPdf(files.id_document) ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="text-center">
                            <Upload className="w-12 h-12 text-green-600 mx-auto mb-2" strokeWidth={2} />
                            <p className="text-sm font-medium text-green-600">{t("receiverDocs.step1.pdfAttached")}</p>
                            <p className="text-xs text-neutral-500 mt-1">{files.id_document?.name}</p>
                          </div>
                        </div>
                      ) : (
                        <img src={previews.id_document} alt="Documento" className="w-full h-48 object-contain rounded-lg" />
                      )}
                      <p className="text-sm text-green-600 font-medium text-center">{t("receiverDocs.step1.docAttached")}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setFiles({ ...files, id_document: null });
                          setPreviews({ ...previews, id_document: null });
                        }}
                        className="w-full py-2 text-sm text-red-600 hover:text-red-700 font-medium"
                      >
                        {t("common.remove")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setShowCamera("id_document")}
                      className="px-4 py-6 border-2 border-dashed border-neutral-300 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all text-center"
                    >
                      <Camera className="w-10 h-10 text-neutral-600 mx-auto mb-2" strokeWidth={2} />
                      <span className="text-sm text-neutral-700 font-medium">{t("receiverDocs.buttons.useCamera")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => idDocInputRef.current?.click()}
                      className="px-4 py-6 border-2 border-dashed border-neutral-300 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all text-center"
                    >
                      <Upload className="w-10 h-10 text-neutral-600 mx-auto mb-2" strokeWidth={2} />
                      <span className="text-sm text-neutral-700 font-medium">{t("receiverDocs.step1.chooseFile")}</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 mt-1 p-3 bg-primary-50 border border-primary-200 rounded-lg">
                <input
                  type="checkbox"
                  id="includeBackSide"
                  checked={includeBackSide}
                  onChange={(e) => setIncludeBackSide(e.target.checked)}
                  className="w-4 h-4 text-primary-600 rounded border-primary-300 focus:ring-primary-500"
                />
                <label htmlFor="includeBackSide" className="text-sm font-medium text-primary-700 cursor-pointer">
                  {t("receiverDocs.step1.hasTwoSides")}
                </label>
              </div>

              {includeBackSide && (
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    {t("receiverDocs.step1.idDocBack")}
                  </label>
                  <input
                    ref={idDocBackInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => handleFileChange('id_document_back', e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  
                  {previews.id_document_back ? (
                    <div className="w-full px-4 py-3 border-2 border-green-300 rounded-xl bg-green-50">
                      <div className="space-y-2">
                        {isPdf(files.id_document_back) ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="text-center">
                              <Upload className="w-12 h-12 text-green-600 mx-auto mb-2" strokeWidth={2} />
                              <p className="text-sm font-medium text-green-600">{t("receiverDocs.step1.pdfAttached")}</p>
                              <p className="text-xs text-neutral-500 mt-1">{files.id_document_back?.name}</p>
                            </div>
                          </div>
                        ) : (
                          <img src={previews.id_document_back} alt="Documento Verso" className="w-full h-48 object-contain rounded-lg" />
                        )}
                        <p className="text-sm text-green-600 font-medium text-center">Verso anexado</p>
                        <button
                          type="button"
                          onClick={() => {
                            setFiles({ ...files, id_document_back: null });
                            setPreviews({ ...previews, id_document_back: null });
                          }}
                          className="w-full py-2 text-sm text-red-600 hover:text-red-700 font-medium"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setShowCamera("id_document_back")}
                        className="px-4 py-6 border-2 border-dashed border-neutral-300 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all text-center"
                      >
                        <Camera className="w-10 h-10 text-neutral-600 mx-auto mb-2" strokeWidth={2} />
                        <span className="text-sm text-neutral-700 font-medium">{t("receiverDocs.buttons.useCamera")}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => idDocBackInputRef.current?.click()}
                        className="px-4 py-6 border-2 border-dashed border-neutral-300 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all text-center"
                      >
                        <Upload className="w-10 h-10 text-neutral-600 mx-auto mb-2" strokeWidth={2} />
                        <span className="text-sm text-neutral-700 font-medium">{t("receiverDocs.step1.chooseFile")}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={handleUploadIdDocument}
                disabled={!canProceedStep1 || isUploading}
                className="w-full bg-action-600 hover:bg-action-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm active:scale-95"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
                    {t("receiverDocs.buttons.sending")}
                  </>
                ) : (
                  <>
                    {t("common.next")}
                    <ArrowRight className="w-5 h-5" strokeWidth={2} />
                  </>
                )}
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-sm text-blue-900 leading-relaxed">
                  {t("receiverDocs.step2.hint")}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  {t("receiverDocs.step2.selfie")}
                </label>
                <input
                  ref={selfieInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={(e) => handleFileChange('selfie', e.target.files?.[0] || null)}
                  className="hidden"
                />
                
                {previews.selfie ? (
                  <div className="w-full px-4 py-3 border-2 border-green-300 rounded-xl bg-green-50">
                    <div className="space-y-2">
                      <img src={previews.selfie} alt="Selfie" className="w-full h-48 object-contain rounded-lg" />
                      <p className="text-sm text-green-600 font-medium text-center">{t("receiverDocs.step2.selfieAttached")}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setFiles({ ...files, selfie: null });
                          setPreviews({ ...previews, selfie: null });
                        }}
                        className="w-full py-2 text-sm text-red-600 hover:text-red-700 font-medium"
                      >
                        {t("common.remove")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCamera("selfie")}
                    className="w-full px-4 py-6 border-2 border-dashed border-neutral-300 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all text-center"
                  >
                    <Camera className="w-10 h-10 text-neutral-600 mx-auto mb-2" strokeWidth={2} />
                    <span className="text-sm text-neutral-700 font-medium">{t("receiverDocs.buttons.useCamera")}</span>
                  </button>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={isUploading}
                  className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  <ArrowLeft className="w-5 h-5" strokeWidth={2} />
                  {t("common.back")}
                </button>
                <button
                  type="button"
                  onClick={handleUploadSelfie}
                  disabled={!canProceedStep2 || isUploading}
                  className="flex-1 bg-action-600 hover:bg-action-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm active:scale-95"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
                      {t("receiverDocs.buttons.sending")}
                    </>
                  ) : (
                    <>
                      {t("common.next")}
                      <ArrowRight className="w-5 h-5" strokeWidth={2} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-sm text-blue-900 leading-relaxed">
                  {t("receiverDocs.step3.hint")}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  {t("receiverDocs.step3.addressProofType")}
                </label>
                <select
                  value={addressProofType}
                  onChange={(e) => setAddressProofType(e.target.value)}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all appearance-none bg-white"
                >
                  <option value="">{t("receiverDocs.step3.selectType")}</option>
                  {PROOF_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {t(type.labelKey)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 active:scale-95"
                >
                  <ArrowLeft className="w-5 h-5" strokeWidth={2} />
                  {t("common.back")}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  disabled={!canProceedStep3}
                  className="flex-1 bg-action-600 hover:bg-action-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm active:scale-95"
                >
                  Próximo
                  <ArrowRight className="w-5 h-5" strokeWidth={2} />
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-sm text-blue-900 leading-relaxed">
                  {t("receiverDocs.step4.hint")}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  {t("receiverDocs.step4.addressProof")}
                </label>
                <input
                  ref={addressProofInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => handleFileChange('address_proof', e.target.files?.[0] || null)}
                  className="hidden"
                />
                
                {previews.address_proof ? (
                  <div className="w-full px-4 py-3 border-2 border-green-300 rounded-xl bg-green-50">
                    <div className="space-y-2">
                      {isPdf(files.address_proof) ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="text-center">
                            <Upload className="w-12 h-12 text-green-600 mx-auto mb-2" strokeWidth={2} />
                            <p className="text-sm font-medium text-green-600">{t("receiverDocs.step1.pdfAttached")}</p>
                            <p className="text-xs text-neutral-500 mt-1">{files.address_proof?.name}</p>
                          </div>
                        </div>
                      ) : (
                        <img src={previews.address_proof} alt="Comprovante" className="w-full h-48 object-contain rounded-lg" />
                      )}
                      <p className="text-sm text-green-600 font-medium text-center">{t("receiverDocs.step4.proofAttached")}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setFiles({ ...files, address_proof: null });
                          setPreviews({ ...previews, address_proof: null });
                        }}
                        className="w-full py-2 text-sm text-red-600 hover:text-red-700 font-medium"
                      >
                        {t("common.remove")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setShowCamera("address_proof")}
                      className="px-4 py-6 border-2 border-dashed border-neutral-300 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all text-center"
                    >
                      <Camera className="w-10 h-10 text-neutral-600 mx-auto mb-2" strokeWidth={2} />
                      <span className="text-sm text-neutral-700 font-medium">{t("receiverDocs.buttons.useCamera")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => addressProofInputRef.current?.click()}
                      className="px-4 py-6 border-2 border-dashed border-neutral-300 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all text-center"
                    >
                      <Upload className="w-10 h-10 text-neutral-600 mx-auto mb-2" strokeWidth={2} />
                      <span className="text-sm text-neutral-700 font-medium">{t("receiverDocs.step1.chooseFile")}</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={isUploading}
                  className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  <ArrowLeft className="w-5 h-5" strokeWidth={2} />
                  {t("common.back")}
                </button>
                <button
                  type="button"
                  onClick={handleUploadAddressProof}
                  disabled={!canProceedStep4 || isUploading}
                  className="flex-1 bg-action-600 hover:bg-action-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm active:scale-95"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
                      {t("receiverDocs.buttons.sending")}
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" strokeWidth={2} />
                      {t("receiverDocs.step4.submitForReview")}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-sm text-blue-900 leading-relaxed">
                  {t("receiverDocs.step5.hint")}
                </p>
              </div>

                            {/* Hidden input for re-upload */}
              <input
                ref={reuploadInputRef}
                type="file"
                accept={reuploadingDocType === "selfie" ? "image/*" : "image/*,application/pdf"}
                capture={reuploadingDocType === "selfie" ? "user" : undefined}
                onChange={handleReuploadFileChange}
                className="hidden"
              />

              <div className="space-y-3">
                {validationStatus?.validations.map((validation) => (
                  <div
                    key={validation.doc_type}
                    onClick={() => {
                      if (validation.status === "rejected" && !isUploading) {
                        startReupload(validation.doc_type);
                      }
                    }}
                    className={`p-4 border rounded-xl ${getStatusColor(validation.status)} ${
                      validation.status === "rejected" ? "cursor-pointer hover:border-red-400 hover:shadow-md transition-all" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {reuploadingDocType === validation.doc_type && isUploading ? (
                          <Loader2 className="w-6 h-6 text-primary-600 animate-spin" strokeWidth={2} />
                        ) : (
                          getStatusIcon(validation.status)
                        )}
                        <div>
                          <p className="font-semibold text-neutral-900">
                            {DOC_TYPE_LABELS[validation.doc_type] || validation.doc_type}
                          </p>
                          <p className={`text-sm ${
                            validation.status === "approved" ? "text-green-600" :
                            validation.status === "rejected" ? "text-red-600" :
                            "text-amber-600"
                          }`}>
                            {reuploadingDocType === validation.doc_type && isUploading 
                              ? t("receiverDocs.step5.resending") 
                              : getStatusText(validation.status)}
                          </p>
                        </div>
                      </div>
                      {validation.status === "rejected" && !isUploading && (
                        <div className="flex items-center gap-1 text-red-600">
                          <Upload className="w-4 h-4" strokeWidth={2} />
                          <span className="text-xs font-medium">{t("receiverDocs.step5.resend")}</span>
                        </div>
                      )}
                    </div>
                    {validation.status === "rejected" && validation.rejection_reason && (
                      <p className="mt-2 text-sm text-red-700 bg-red-100 p-2 rounded-lg">
                        {t("receiverDocs.step5.reason")}: {validation.rejection_reason}
                      </p>
                    )}
                  </div>
                )) || (
                  <div className="text-center py-8">
                    <Loader2 className="w-8 h-8 text-primary-600 animate-spin mx-auto mb-3" strokeWidth={2} />
                    <p className="text-neutral-600">{t("receiverDocs.step5.loadingStatus")}</p>
                  </div>
                )}
              </div>

              {validationStatus?.all_validated && !validationStatus.all_approved && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-700 font-medium">
                    {t("receiverDocs.step5.someRejected")}
                  </p>
                </div>
              )}

              {isPolling && !validationStatus?.all_validated && (
                <div className="flex items-center justify-center gap-2 text-neutral-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                  {t("receiverDocs.step5.autoUpdating")}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 active:scale-95"
                >
                  {t("common.close")}
                </button>
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={!validationStatus?.all_approved}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm active:scale-95"
                >
                  <CheckCircle className="w-5 h-5" strokeWidth={2} />
                  {t("receiverDocs.step5.complete")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {showCamera && (
      <Portal>
        <div className="fixed inset-0 bg-black z-[300] flex items-center justify-center">
          <CameraCapture
            onCapture={(file) => handleCameraCapture(showCamera, file)}
            onClose={() => setShowCamera(null)}
            mode={showCamera === "selfie" ? "selfie" : showCamera === "address_proof" ? "fullscreen" : "document"}
          />
        </div>
      </Portal>
    )}
    </>
  );
}
