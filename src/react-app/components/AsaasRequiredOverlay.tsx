import { AlertCircle, Wallet } from "lucide-react";

interface AsaasRequiredOverlayProps {
  userType: "receiver" | "driver";
}

export function AsaasRequiredOverlay({ userType }: AsaasRequiredOverlayProps) {
  const userTypeLabel = userType === "receiver" ? "recebedor" : "entregador";
  
  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-8 max-w-md text-center">
        <div className="flex justify-center mb-4">
          <div className="bg-amber-100 p-4 rounded-full">
            <Wallet className="w-10 h-10 text-amber-600" />
          </div>
        </div>
        
        <h3 className="text-xl font-bold text-amber-800 mb-3">
          Conta de Pagamentos Necessária
        </h3>
        
        <p className="text-amber-700 mb-6 leading-relaxed">
          Para utilizar o sistema como <strong>{userTypeLabel}</strong>, você precisa cadastrar sua conta de pagamentos.
        </p>
        
        <div className="bg-white border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3 text-left">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">Como cadastrar:</p>
              <ol className="list-decimal list-inside space-y-1 text-amber-700">
                <li>Acesse o menu de perfil (canto superior direito)</li>
                <li>Clique em "Endereço de Comissão"</li>
                <li>Preencha os dados e cadastre sua conta</li>
              </ol>
            </div>
          </div>
        </div>
        
        <p className="text-xs text-amber-600">
          Após o cadastro, você poderá acessar todas as funcionalidades.
        </p>
      </div>
    </div>
  );
}
