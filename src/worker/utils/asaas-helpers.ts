// Helper functions for Asaas integration

interface AsaasConfig {
  baseUrl: string;
  apiKey: string;
}

interface CreateSubcontaParams {
  name: string;
  email: string;
  cpf: string;
  birthDate: string;
  phone: string;
  street: string;
  number: string;
  neighborhood: string;
  cep: string;
}

interface SubcontaResult {
  accountId: string;
  walletId: string;
  apiKey: string;
}

/**
 * Creates an Asaas subconta (sub-account) for commission payments
 * This is called only when a user becomes eligible to receive commissions:
 * - For TooDroper: When admin approves the receiver point
 * - For Dropper: When they successfully scan their first package
 */
export async function createAsaasSubconta(
  asaasConfig: AsaasConfig,
  params: CreateSubcontaParams,
  isProduction: boolean
): Promise<SubcontaResult | null> {
  try {
    // In development, modify email to avoid conflicts with existing Asaas accounts
    let asaasEmail = params.email;
    
    // Special handling for mcaorg@gmail.com
    if (params.email === "mcaorg@gmail.com" || params.email === "mcaorg_2@gmail.com") {
      asaasEmail = isProduction ? "mcaorg_subconta2@gmail.com" : "mcaorg_subconta@gmail.com";
    } else if (!isProduction && asaasEmail.includes('@gmail.com')) {
      // For other emails in development, add _2 suffix
      asaasEmail = asaasEmail.replace('@gmail.com', '_2@gmail.com');
    }
    
    const asaasResponse = await fetch(`${asaasConfig.baseUrl}/accounts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": asaasConfig.apiKey,
        "User-Agent": "TDV4/1.0",
      },
      body: JSON.stringify({
        name: params.name,
        email: asaasEmail,
        cpfCnpj: params.email === "mcaorg@gmail.com" && isProduction
          ? "09771872095"
          : params.cpf.replace(/\D/g, ""),
        birthDate: params.birthDate,
        mobilePhone: params.phone.replace(/\D/g, "").replace(/^55/, ""),
        incomeValue: 3000,
        address: params.street,
        addressNumber: params.number,
        province: params.neighborhood,
        postalCode: params.cep.replace(/\D/g, ""),
      }),
    });

    const responseText = await asaasResponse.text();
    console.log("[Asaas Subconta] Response status:", asaasResponse.status);
    console.log("[Asaas Subconta] Response body:", responseText.substring(0, 200));

    if (!asaasResponse.ok) {
      console.error("[Asaas Subconta] Error creating subconta:", responseText);
      return null;
    }

    const asaasData = JSON.parse(responseText);
    
    return {
      accountId: asaasData.id,
      walletId: asaasData.walletId,
      apiKey: asaasData.apiKey,
    };
  } catch (error) {
    console.error("[Asaas Subconta] Exception creating subconta:", error);
    return null;
  }
}
