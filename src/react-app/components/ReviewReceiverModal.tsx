import { useState } from "react";
import { X, Loader2, CheckCircle, XCircle, Clock } from "lucide-react";

interface ReviewReceiverModalProps {
  onClose: () => void;
  onApprove: (notes?: string) => Promise<void>;
  onReject: (notes: string) => Promise<void>;
  onSetPending: (notes: string) => Promise<void>;
  receiverName: string;
}

type ReviewAction = "approve" | "reject" | "pending" | null;

const PENDING_PRESETS = [
  "Favor enviar documentação completa",
  "Favor enviar restante da documentação",
  "Favor enviar novamente comprovante de residência",
  "Favor enviar documento de identificação com melhor qualidade",
  "Favor enviar selfie segurando o documento",
  "Documento de identificação ilegível, favor reenviar",
];

const REJECT_PRESETS = [
  "Documentação incompleta ou inválida",
  "Endereço não corresponde ao comprovante enviado",
  "Selfie não confere com o documento de identificação",
];


export function ReviewReceiverModal({
  onClose,
  onApprove,
  onReject,
  onSetPending,
  receiverName,
}: ReviewReceiverModalProps) {
  const [action, setAction] = useState<ReviewAction>(null);
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!action) return;

    if ((action === "reject" || action === "pending") && !notes.trim()) {
      return;
    }

    setIsLoading(true);
    try {
      if (action === "approve") {
        await onApprove(notes.trim() || undefined);
      } else if (action === "reject") {
        await onReject(notes.trim());
      } else if (action === "pending") {
        await onSetPending(notes.trim());
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getButtonConfig = () => {
    switch (action) {
      case "approve":
        return {
          label: "Confirmar Aprovação",
          icon: CheckCircle,
          className: "bg-green-600 hover:bg-green-700",
        };
      case "reject":
        return {
          label: "Confirmar Reprovação",
          icon: XCircle,
          className: "bg-red-600 hover:bg-red-700",
        };
      case "pending":
        return {
          label: "Confirmar Pendência",
          icon: Clock,
          className: "bg-amber-600 hover:bg-amber-700",
        };
      default:
        return null;
    }
  };

  const buttonConfig = getButtonConfig();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[300] backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-strong w-full max-w-md">
        <div className="p-6 border-b border-neutral-100">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">
              Revisar Cadastro
            </h2>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              <X className="w-6 h-6" strokeWidth={2} />
            </button>
          </div>
          <p className="text-sm text-neutral-600 mt-2">
            {receiverName}
          </p>
        </div>

        <div className="p-6 space-y-4">
          {!action ? (
            <>
              <p className="text-neutral-600 mb-4">
                Escolha uma ação para este cadastro:
              </p>
              
              <button
                onClick={() => setAction("approve")}
                className="w-full bg-green-50 hover:bg-green-100 border-2 border-green-200 text-green-700 font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" strokeWidth={2} />
                Aprovar
              </button>

              <button
                onClick={() => setAction("pending")}
                className="w-full bg-amber-50 hover:bg-amber-100 border-2 border-amber-200 text-amber-700 font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
              >
                <Clock className="w-5 h-5" strokeWidth={2} />
                Pendente
              </button>

              <button
                onClick={() => setAction("reject")}
                className="w-full bg-red-50 hover:bg-red-100 border-2 border-red-200 text-red-700 font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
              >
                <XCircle className="w-5 h-5" strokeWidth={2} />
                Reprovar
              </button>
            </>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  {action === "approve"
                    ? "Observações (opcional)"
                    : action === "reject"
                    ? "Motivo da reprovação *"
                    : "Motivo da pendência *"}
                </label>

                {(action === "pending" || action === "reject") && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(action === "pending" ? PENDING_PRESETS : REJECT_PRESETS).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setNotes(preset)}
                        className="text-xs px-2.5 py-1 rounded-lg border border-neutral-300 text-neutral-600 hover:bg-neutral-100 hover:border-neutral-400 transition-colors text-left"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                )}

                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    action === "approve"
                      ? "Adicione observações sobre a aprovação..."
                      : action === "reject"
                      ? "Descreva o motivo da reprovação dos documentos..."
                      : "Descreva o que está pendente ou precisa ser corrigido..."
                  }
                  rows={4}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
                />
                {(action === "reject" || action === "pending") && !notes.trim() && (
                  <p className="text-xs text-red-600 mt-1">* Campo obrigatório</p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setAction(null);
                    setNotes("");
                  }}
                  className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold py-3.5 px-6 rounded-xl transition-all duration-200"
                >
                  Voltar
                </button>
                
                {buttonConfig && (
                  <button
                    onClick={handleSubmit}
                    disabled={isLoading || ((action === "reject" || action === "pending") && !notes.trim())}
                    className={`flex-1 ${buttonConfig.className} text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm active:scale-95`}
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
                    ) : (
                      <>
                        <buttonConfig.icon className="w-5 h-5" strokeWidth={2} />
                        {buttonConfig.label}
                      </>
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
