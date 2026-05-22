/**
 * Maps backend error messages to translation keys
 * Backend returns raw strings, this maps them to i18n keys for frontend translation
 */

// Map of backend error messages to translation keys
const errorKeyMap: Record<string, string> = {
  // Authentication errors
  "Unauthorized": "errors.unauthorized",
  "Não autorizado": "errors.unauthorized",
  "Unauthorized - Invalid admin key": "errors.unauthorized",
  "Unauthorized - Admin access required": "errors.adminRequired",
  "Acesso negado - Requer permissão de administrador": "errors.adminRequired",
  
  // User errors
  "User not found": "errors.userNotFound",
  "Usuário não encontrado": "errors.userNotFound",
  "User deactivated": "errors.userDeactivated",
  "Usuário desativado": "errors.userDeactivated",
  
  // Address errors
  "Endereço não encontrado": "errors.addressNotFound",
  "Address not found": "errors.addressNotFound",
  "Endereço do Toodroper não encontrado": "errors.receiverAddressNotFound",
  "Limite de 10 endereços atingido": "errors.addressLimitReached",
  "Apenas 1 endereço permitido para recebedor": "errors.receiverSingleAddress",
  "Não foi possível encontrar as coordenadas do endereço": "errors.coordinatesNotFound",
  
  // Request errors
  "Solicitação não encontrada": "errors.requestNotFound",
  "Esta solicitação já foi processada": "errors.requestAlreadyProcessed",
  "Status inválido": "errors.invalidStatus",
  
  // Processing errors
  "Erro ao carregar solicitações": "errors.loadError",
  "Erro ao processar solicitação": "errors.processError",
  "Erro ao buscar hubs próximos": "errors.fetchHubsError",
  
  // Financial errors
  "Saldo insuficiente": "errors.insufficientBalance",
  "Valor mínimo para saque é R$ 20,00": "errors.minWithdrawal",
  "Erro ao processar saque": "errors.withdrawalError",
  "Erro ao processar pagamento": "errors.paymentError",
  
  // Document errors
  "Erro ao enviar documentos": "errors.documentUploadError",
  "Erro ao processar a foto": "errors.photoProcessError",
  
  // QR/Delivery errors
  "Erro ao gerar QR Code": "errors.qrCodeError",
  "Palavra secreta incorreta": "errors.secretWordIncorrect",
  "Tentativas esgotadas": "errors.attemptsExhausted",
  
  // CPF/Email errors
  "Este CPF já está cadastrado": "errors.cpfInUse",
  "CPF já cadastrado": "errors.cpfInUse",
  "Este email já está registrado": "errors.emailAlreadyRegistered",
  "Email já cadastrado": "errors.emailAlreadyRegistered",
  "CPF inválido": "errors.invalidCpf",
  "Email inválido": "errors.invalidEmail",
  "Telefone inválido": "errors.invalidPhone",
  
  // Auth errors
  "Email ou senha incorretos": "errors.invalidCredentials",
  "Incorrect email or password": "errors.invalidCredentials",
  "Conta não verificada": "errors.accountNotVerified",
  "Código inválido": "errors.invalidCode",
  "Invalid code": "errors.invalidCode",
  
  // Admin errors
  "Senha incorreta": "errors.invalidPassword",
  "Este usuário não pode ser modificado": "errors.protectedUser",
  "A soma das comissões deve ser igual a 100%": "errors.commissionTotalError",
  
  // Network errors
  "Failed to fetch": "errors.network",
  "Network error": "errors.network",
};

/**
 * Get the translation key for a backend error message
 * Returns the key if found, or 'errors.unknown' if not mapped
 */
export function getErrorKey(errorMessage: string): string {
  // Check exact match first
  if (errorKeyMap[errorMessage]) {
    return errorKeyMap[errorMessage];
  }
  
  // Check if message contains any of the mapped strings
  for (const [backendMsg, key] of Object.entries(errorKeyMap)) {
    if (errorMessage.includes(backendMsg)) {
      return key;
    }
  }
  
  // Check for common patterns
  if (errorMessage.toLowerCase().includes("unauthorized") || 
      errorMessage.toLowerCase().includes("não autorizado")) {
    return "errors.unauthorized";
  }
  
  if (errorMessage.toLowerCase().includes("not found") || 
      errorMessage.toLowerCase().includes("não encontrad")) {
    return "errors.notFound";
  }
  
  if (errorMessage.toLowerCase().includes("invalid") || 
      errorMessage.toLowerCase().includes("inválid")) {
    return "errors.invalidData";
  }
  
  return "errors.unknown";
}

/**
 * Translates a backend error using the i18n system
 * Usage: translateError(t, errorMessage)
 */
export function translateError(
  t: (key: string) => string, 
  errorMessage: string
): string {
  const key = getErrorKey(errorMessage);
  const translated = t(key);
  
  // If translation returns the key itself, return original message
  if (translated === key) {
    return errorMessage;
  }
  
  return translated;
}
