import { useState, useEffect } from "react";
import { Loader2, RefreshCw, Database, FileText, Calendar } from "lucide-react";

interface R2File {
  key: string;
  size: number;
  uploaded: string;
}

interface R2DiagnosticData {
  success: boolean;
  bucket_name: string;
  file_count: number;
  files: R2File[];
}

export default function AdminR2DiagnosticPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<R2DiagnosticData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/admin/r2-diagnostic", { credentials: "include" });
      if (!response.ok) {
        throw new Error("Failed to fetch R2 diagnostic data");
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" strokeWidth={2} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-6">
        <p className="text-neutral-600">No data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">Diagnóstico R2 Bucket</h1>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-all"
        >
          <RefreshCw className="w-4 h-4" strokeWidth={2} />
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-soft p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Database className="w-5 h-5 text-blue-700" strokeWidth={2} />
            </div>
            <h3 className="text-sm font-semibold text-neutral-600 uppercase">Bucket</h3>
          </div>
          <p className="text-lg font-bold text-neutral-900 font-mono">{data.bucket_name}</p>
        </div>

        <div className="bg-white rounded-xl shadow-soft p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-green-100 p-2 rounded-lg">
              <FileText className="w-5 h-5 text-green-700" strokeWidth={2} />
            </div>
            <h3 className="text-sm font-semibold text-neutral-600 uppercase">Total de Arquivos</h3>
          </div>
          <p className="text-2xl font-bold text-neutral-900">{data.file_count}</p>
        </div>

        <div className="bg-white rounded-xl shadow-soft p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-purple-100 p-2 rounded-lg">
              <Database className="w-5 h-5 text-purple-700" strokeWidth={2} />
            </div>
            <h3 className="text-sm font-semibold text-neutral-600 uppercase">Tamanho Total</h3>
          </div>
          <p className="text-2xl font-bold text-neutral-900">
            {formatBytes(data.files.reduce((sum, f) => sum + f.size, 0))}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-soft">
        <div className="p-6 border-b border-neutral-100">
          <h2 className="text-lg font-semibold text-neutral-900">Arquivos no Bucket</h2>
        </div>
        <div className="p-6">
          {data.files.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-neutral-400 mx-auto mb-4" strokeWidth={2} />
              <p className="text-neutral-600">Nenhum arquivo encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-200">
                    <th className="text-left py-3 px-4 font-semibold text-neutral-700 text-sm">
                      Caminho
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-neutral-700 text-sm">
                      Tamanho
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-neutral-700 text-sm">
                      Data de Upload
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.files.map((file, index) => (
                    <tr key={index} className="border-b border-neutral-100 hover:bg-neutral-50">
                      <td className="py-3 px-4 font-mono text-sm text-neutral-900">
                        {file.key}
                      </td>
                      <td className="py-3 px-4 text-sm text-neutral-600">
                        {formatBytes(file.size)}
                      </td>
                      <td className="py-3 px-4 text-sm text-neutral-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" strokeWidth={2} />
                          {new Date(file.uploaded).toLocaleString("pt-BR")}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
