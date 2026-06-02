import { useState } from "react";
import { Loader2, Send, Users, CheckSquare, Square, Trash2 } from "lucide-react";
import { RichTextEditor } from "@/react-app/components/RichTextEditor";

interface Recipient {
  id: number;
  full_name: string;
  email: string;
}

interface SelectedRecipient extends Recipient {
  selected: boolean;
}

interface SendResult {
  sent: number;
  failed: number;
  errors: string[];
}

const GROUP_OPTIONS = [
  { value: "receiver", label: "TooDroper (Recebedor)" },
  { value: "delivery", label: "Dropper (Entregador)" },
  { value: "consumer", label: "Dropper One (Consumidor)" },
  { value: "all", label: "Todos os usuários" },
];

export default function AdminCommunicationPage() {
  const [group, setGroup] = useState("receiver");
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [recipients, setRecipients] = useState<SelectedRecipient[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  const selectedCount = recipients.filter((r) => r.selected).length;

  const loadRecipients = async () => {
    setLoadingRecipients(true);
    setLoaded(false);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/communication/recipients?group=${group}`, {
        credentials: "include",
      });
      const data = await res.json() as Recipient[];
      setRecipients(data.map((r) => ({ ...r, selected: true })));
      setLoaded(true);
    } catch {
      setRecipients([]);
      setLoaded(true);
    } finally {
      setLoadingRecipients(false);
    }
  };

  const toggleRecipient = (id: number) => {
    setRecipients((prev) =>
      prev.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r))
    );
  };

  const selectAll = () => {
    setRecipients((prev) => prev.map((r) => ({ ...r, selected: true })));
  };

  const removeAll = () => {
    setRecipients((prev) => prev.map((r) => ({ ...r, selected: false })));
  };

  const handleSend = async () => {
    const selectedRecipients = recipients.filter((r) => r.selected);
    const messageEmpty = !message || message === "<p></p>" || message.trim() === "";
    if (!subject.trim() || messageEmpty || selectedRecipients.length === 0) return;

    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/communication/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          message: message.trim(),
          recipients: selectedRecipients.map(({ id, email, full_name }) => ({ id, email, full_name })),
        }),
      });
      const data = await res.json() as SendResult;
      setResult(data);
    } catch {
      setResult({ sent: 0, failed: selectedRecipients.length, errors: ["Erro de conexão"] });
    } finally {
      setSending(false);
    }
  };

  const messageEmpty = !message || message === "<p></p>" || message.trim() === "";
  const canSend = subject.trim() && !messageEmpty && selectedCount > 0 && !sending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Comunicação</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Envie mensagens em massa para grupos de usuários da plataforma.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-soft p-6 space-y-6">
        <div>
          <h2 className="text-base font-semibold text-neutral-800 mb-4">
            Passo 1 — Selecionar grupo
          </h2>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Grupo de destinatários
              </label>
              <select
                value={group}
                onChange={(e) => {
                  setGroup(e.target.value);
                  setLoaded(false);
                  setRecipients([]);
                  setResult(null);
                }}
                className="w-full border border-neutral-300 rounded-xl px-3 py-2.5 text-sm text-neutral-800 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {GROUP_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={loadRecipients}
              disabled={loadingRecipients}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loadingRecipients ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Users className="w-4 h-4" />
              )}
              Carregar Lista
            </button>
          </div>
        </div>

        {loaded && (
          <>
            <div className="border-t border-neutral-100 pt-6">
              <h2 className="text-base font-semibold text-neutral-800 mb-1">
                Passo 2 — Escrever mensagem
              </h2>
              <div className="flex flex-wrap gap-1.5 mb-4 items-center">
                <span className="text-xs text-neutral-500">Variáveis disponíveis:</span>
                {[
                  { label: "Primeiro nome", variable: "{{nome}}" },
                  { label: "Nome completo", variable: "{{nome_completo}}" },
                ].map(({ label, variable }) => (
                  <button
                    key={variable}
                    type="button"
                    onClick={() => setSubject((s) => s + variable)}
                    title={`Inserir no assunto: ${variable}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 text-primary-700 border border-primary-200 rounded-md text-xs font-mono hover:bg-primary-100 transition-colors cursor-pointer"
                  >
                    {variable}
                    <span className="font-sans font-normal text-primary-500 text-[10px]">{label}</span>
                  </button>
                ))}
                <span className="text-xs text-neutral-400">— clique para inserir no assunto ou cole no corpo</span>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Assunto
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Ex: Olá {{nome}}, temos uma novidade para você!"
                    className="w-full border border-neutral-300 rounded-xl px-3 py-2.5 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Mensagem
                  </label>
                  <RichTextEditor
                    value={message}
                    onChange={setMessage}
                    placeholder="Digite a mensagem. Use {{nome}} para personalizar com o primeiro nome do destinatário..."
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-100 pt-6">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div>
                  <h2 className="text-base font-semibold text-neutral-800">
                    Passo 3 — Destinatários
                  </h2>
                  <p className="text-sm text-neutral-500 mt-0.5">
                    {selectedCount} destinatários selecionados de {recipients.length} total
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={removeAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-600 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remover todos
                  </button>
                  <button
                    onClick={selectAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-600 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    Selecionar todos
                  </button>
                </div>
              </div>

              {recipients.length === 0 ? (
                <p className="text-sm text-neutral-400 py-4 text-center">
                  Nenhum destinatário encontrado para este grupo.
                </p>
              ) : (
                <div className="border border-neutral-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                  {recipients.map((r) => (
                    <label
                      key={r.id}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 cursor-pointer border-b border-neutral-100 last:border-b-0"
                    >
                      <button
                        type="button"
                        onClick={() => toggleRecipient(r.id)}
                        className="text-primary-600 flex-shrink-0"
                      >
                        {r.selected ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4 text-neutral-400" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-neutral-800">
                          {r.full_name}
                        </span>
                        <span className="text-xs text-neutral-500 ml-2">{r.email}</span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-neutral-100 pt-6 flex flex-col gap-4">
              <button
                onClick={handleSend}
                disabled={!canSend}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {sending
                  ? "Enviando..."
                  : `Enviar para ${selectedCount} destinatário${selectedCount !== 1 ? "s" : ""} selecionado${selectedCount !== 1 ? "s" : ""}`}
              </button>

              {result && (
                <div
                  className={`rounded-xl p-4 text-sm ${
                    result.failed === 0
                      ? "bg-green-50 border border-green-200"
                      : "bg-yellow-50 border border-yellow-200"
                  }`}
                >
                  <p className="font-semibold text-neutral-800 mb-1">Resultado do envio</p>
                  <p className="text-neutral-700">
                    Enviados com sucesso:{" "}
                    <span className="font-semibold text-green-700">{result.sent}</span>
                    {result.failed > 0 && (
                      <>
                        {" · "}Falhas:{" "}
                        <span className="font-semibold text-red-600">{result.failed}</span>
                      </>
                    )}
                  </p>
                  {result.errors.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-red-600 list-disc list-inside">
                      {result.errors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
