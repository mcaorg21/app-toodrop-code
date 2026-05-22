import { useState, useEffect } from "react";
import { useApi } from "@/react-app/hooks/useApi";
import { Loader2, RefreshCw, Activity, CheckCircle, XCircle, MapPin, Clock, Hash } from "lucide-react";

interface HubLocationLog {
  id: number;
  receiver_key: string;
  request_latitude: number | null;
  request_longitude: number | null;
  request_timestamp: string | null;
  response_success: number;
  response_active: number | null;
  response_distance: number | null;
  response_message: string;
  response_status_code: number;
  created_at: string;
}

export default function AdminHubLocationLogsPage() {
  const { fetchHubLocationLogs, isLoading } = useApi();
  const [logs, setLogs] = useState<HubLocationLog[]>([]);
  const [searchKey, setSearchKey] = useState("");

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    const data = await fetchHubLocationLogs();
    setLogs(data);
  };

  const getStatusBadge = (log: HubLocationLog) => {
    if (log.response_success) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-semibold">
          <CheckCircle className="w-3.5 h-3.5" strokeWidth={2} />
          Sucesso
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-semibold">
          <XCircle className="w-3.5 h-3.5" strokeWidth={2} />
          Erro
        </div>
      );
    }
  };

  const getStatusCodeBadge = (code: number) => {
    const colors: Record<number, string> = {
      200: "bg-green-100 text-green-700",
      400: "bg-orange-100 text-orange-700",
      401: "bg-red-100 text-red-700",
      403: "bg-amber-100 text-amber-700",
      404: "bg-purple-100 text-purple-700",
      500: "bg-neutral-800 text-white",
    };

    const colorClass = colors[code] || "bg-neutral-100 text-neutral-700";

    return (
      <span className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${colorClass}`}>
        {code}
      </span>
    );
  };

  const filteredLogs = logs.filter(log => {
    if (!searchKey) return true;
    return log.receiver_key.toLowerCase().includes(searchKey.toLowerCase());
  });

  if (isLoading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" strokeWidth={2} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">Logs de Localização dos Hubs</h1>
        <button
          onClick={loadLogs}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} strokeWidth={2} />
          Atualizar
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Activity className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" strokeWidth={2} />
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Sobre este painel</h3>
            <p className="text-sm text-blue-800">
              Este painel exibe os últimos 50 registros de requisições POST feitas ao endpoint <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs font-mono">/api/hub/location</code> pelo aplicativo Toodrop HUB. 
              Cada registro mostra a localização enviada pelo hub, a resposta do sistema e se o hub foi ativado ou não.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-soft">
        <div className="p-4 border-b border-neutral-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-neutral-900">Registros de Requisições</h2>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
              {filteredLogs.length} registros
            </span>
          </div>
          
          <div>
            <label className="text-xs font-medium text-neutral-600 mb-1 block">Buscar por Chave do Hub</label>
            <input
              type="text"
              value={searchKey}
              onChange={(e) => setSearchKey(e.target.value)}
              placeholder="Digite a chave do hub (ex: H2D-12345678)..."
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        <div className="p-4">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-16 h-16 text-neutral-400 mx-auto mb-4" strokeWidth={2} />
              <p className="text-neutral-600">
                {searchKey ? 'Nenhum log encontrado com os filtros aplicados' : 'Nenhum log de localização registrado'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="border border-neutral-200 rounded-xl p-4 hover:border-neutral-300 hover:shadow-soft transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="bg-primary-100 p-2 rounded-lg">
                        <Hash className="w-4 h-4 text-primary-700" strokeWidth={2} />
                      </div>
                      <div>
                        <div className="font-mono font-semibold text-neutral-900 text-sm">
                          {log.receiver_key}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-neutral-500 mt-0.5">
                          <Clock className="w-3 h-3" strokeWidth={2} />
                          {new Date(log.created_at).toLocaleString("pt-BR")}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(log)}
                      {getStatusCodeBadge(log.response_status_code)}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <div className="bg-neutral-50 rounded-lg p-3">
                      <h4 className="text-xs font-semibold text-neutral-600 uppercase mb-2 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" strokeWidth={2} />
                        Requisição
                      </h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-neutral-600">Latitude:</span>
                          <span className="font-mono text-neutral-900">
                            {log.request_latitude !== null ? log.request_latitude.toFixed(6) : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-600">Longitude:</span>
                          <span className="font-mono text-neutral-900">
                            {log.request_longitude !== null ? log.request_longitude.toFixed(6) : 'N/A'}
                          </span>
                        </div>
                        {log.request_timestamp && (
                          <div className="flex justify-between">
                            <span className="text-neutral-600">Timestamp:</span>
                            <span className="text-xs font-mono text-neutral-900">
                              {new Date(log.request_timestamp).toLocaleString("pt-BR")}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-neutral-50 rounded-lg p-3">
                      <h4 className="text-xs font-semibold text-neutral-600 uppercase mb-2 flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5" strokeWidth={2} />
                        Resposta
                      </h4>
                      <div className="space-y-1 text-sm">
                        {log.response_active !== null && (
                          <div className="flex justify-between">
                            <span className="text-neutral-600">Hub Ativo:</span>
                            <span className={`font-semibold ${log.response_active ? 'text-green-700' : 'text-red-700'}`}>
                              {log.response_active ? 'Sim' : 'Não'}
                            </span>
                          </div>
                        )}
                        {log.response_distance !== null && (
                          <div className="flex justify-between">
                            <span className="text-neutral-600">Distância:</span>
                            <span className="font-mono text-neutral-900">
                              {log.response_distance} metros
                            </span>
                          </div>
                        )}
                        <div className="flex flex-col gap-1 pt-1">
                          <span className="text-neutral-600 text-xs">Mensagem:</span>
                          <span className={`text-xs font-medium ${log.response_success ? 'text-green-700' : 'text-red-700'}`}>
                            {log.response_message}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-neutral-500 pt-2 border-t border-neutral-100">
                    <span className="font-mono">Log ID: {log.id}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
