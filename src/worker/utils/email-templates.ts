// Email template helpers
const LOGO_URL = "https://019acbcb-92a6-7eb2-9ee6-8b655e0ba462.mochausercontent.com/Sem-nome-(200-x-80-px).png";

export const emailLogo = () => `
<div style="padding: 32px 40px 16px 40px; text-align: center;">
  <img src="${LOGO_URL}" alt="Toodrop" width="200" height="80" style="display: inline-block;" />
</div>
`;

export const emailTemplate = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 40px 20px; background-color: #f4f4f5; font-family: Arial, Helvetica, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px;">
    ${emailLogo()}
    ${content}
  </div>
</body>
</html>
`;

export const emailHeader = (title: string) => `
<div style="padding: 32px 40px 24px 40px; border-bottom: 1px solid #e4e4e7;">
  <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #18181b;">${title}</h1>
</div>
`;

export const emailBody = (content: string) => `
<div style="padding: 32px 40px;">
  ${content}
</div>
`;

export const emailButton = (text: string, url: string) => `
<a href="${url}" style="display: inline-block; margin: 24px 0; padding: 12px 24px; background-color: #033d67; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 500; border-radius: 6px;">${text}</a>
`;

export const emailFooter = (text: string) => `
<div style="padding: 24px 40px; border-top: 1px solid #e4e4e7;">
  <p style="margin: 0; font-size: 12px; color: #71717a; text-align: center;">${text}</p>
</div>
`;

// Helper to capitalize first letter of each word
const toProperCase = (name: string): string => {
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Welcome email after first registration
export const welcomeEmail = (fullName: string, mainInterest: string) => {
  const properName = toProperCase(fullName);
  const roleLabel = 
    mainInterest === "consumer" ? "Dropper One" :
    mainInterest === "driver" ? "Dropper" :
    mainInterest === "receiver" ? "Toodroper" : "usuário";

  const subject = "Bem-vindo à Toodrop!";
  
  const html_body = emailTemplate(`
    ${emailHeader(`Bem-vindo à Toodrop, ${properName}!`)}
    ${emailBody(`
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        Olá <strong>${properName}</strong> (<em>${roleLabel}</em>),
      </p>
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        Estamos muito felizes em ter você na Toodrop! Você deu o primeiro passo para transformar a forma como entregas acontecem.
      </p>
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        A plataforma já está pronta para você começar a usar. Acesse agora e explore todas as funcionalidades disponíveis.
      </p>
      ${emailButton("Acessar Toodrop", "https://app.toodrop.com/")}
      <p style="margin: 16px 0 0 0; font-size: 14px; line-height: 20px; color: #71717a;">
        Se tiver dúvidas ou precisar de ajuda, estamos à disposição.
      </p>
    `)}
    ${emailFooter("© 2025 Toodrop. Todos os direitos reservados.")}
  `);

  const text_body = `Bem-vindo à Toodrop, ${properName}!\n\nEstamos muito felizes em ter você na Toodrop! Você deu o primeiro passo para transformar a forma como entregas acontecem.\n\nA plataforma já está pronta para você começar a usar. Acesse agora: https://app.toodrop.com/\n\nSe tiver dúvidas ou precisar de ajuda, estamos à disposição.`;

  return { subject, html_body, text_body };
};

// Email notification when package is delivered to Toodroper
export const packageDeliveredToToodropperEmail = (
  consumerName: string,
  receiverName: string,
  hubNickname: string
) => {
  const properConsumerName = toProperCase(consumerName);
  const properReceiverName = toProperCase(receiverName);

  const subject = "Sua encomenda está disponível para retirada!";
  
  const html_body = emailTemplate(`
    ${emailHeader("Sua encomenda chegou!")}
    ${emailBody(`
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        Olá <strong>${properConsumerName}</strong> (<em>Dropper One</em>),
      </p>
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        Ótimas notícias! Sua encomenda foi entregue por nosso Dropper ao hub <strong>${hubNickname}</strong>, gerenciado por <strong>${properReceiverName}</strong> (<em>Toodroper</em>).
      </p>
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        Seu pacote já está disponível para retirada. Acesse a plataforma para ver os detalhes e coordenar a coleta.
      </p>
      ${emailButton("Ver Detalhes", "https://app.toodrop.com/")}
      <p style="margin: 16px 0 0 0; font-size: 14px; line-height: 20px; color: #71717a;">
        Lembre-se de levar um documento de identificação na hora da retirada.
      </p>
    `)}
    ${emailFooter("© 2025 Toodrop. Todos os direitos reservados.")}
  `);

  const text_body = `Olá ${properConsumerName}!\n\nSua encomenda foi entregue ao hub ${hubNickname}, gerenciado por ${properReceiverName} (Toodroper).\n\nSeu pacote já está disponível para retirada. Acesse a plataforma: https://app.toodrop.com/\n\nLembre-se de levar um documento de identificação na hora da retirada.`;

  return { subject, html_body, text_body };
};

// Email notification when Dropper One pays and commission is available
export const packagePickedUpEmail = (
  userName: string,
  role: "Dropper" | "Toodroper",
  commissionAmount: number
) => {
  const properName = toProperCase(userName);
  const formattedAmount = commissionAmount.toLocaleString('pt-BR', { 
    style: 'currency', 
    currency: 'BRL' 
  });

  const subject = "Comissão disponível!";
  
  const html_body = emailTemplate(`
    ${emailHeader("Você recebeu uma comissão!")}
    ${emailBody(`
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        Olá <strong>${properName}</strong> (<em>${role}</em>),
      </p>
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        Ótimas notícias! O Dropper One realizou o pagamento da entrega e sua comissão de <strong>${formattedAmount}</strong> já está disponível na sua carteira.
      </p>
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        Acesse a plataforma para visualizar seu saldo e realizar saques quando desejar.
      </p>
      ${emailButton("Ver Extrato", "https://app.toodrop.com/")}
      <p style="margin: 16px 0 0 0; font-size: 14px; line-height: 20px; color: #71717a;">
        Continue realizando entregas para aumentar seus ganhos!
      </p>
    `)}
    ${emailFooter("© 2025 Toodrop. Todos os direitos reservados.")}
  `);

  const text_body = `Olá ${properName} (${role})!\n\nO Dropper One realizou o pagamento da entrega e sua comissão de ${formattedAmount} já está disponível na sua carteira.\n\nAcesse a plataforma para visualizar seu saldo: https://app.toodrop.com/\n\nContinue realizando entregas para aumentar seus ganhos!`;

  return { subject, html_body, text_body };
};

// Email notification when receiver point is approved
export const receiverPointApprovedEmail = (fullName: string, hubNickname: string) => {
  const properName = toProperCase(fullName);

  const subject = "Seu ponto de recebimento foi aprovado!";
  
  const html_body = emailTemplate(`
    ${emailHeader("Parabéns! Seu ponto foi aprovado!")}
    ${emailBody(`
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        Olá <strong>${properName}</strong> (<em>Toodroper</em>),
      </p>
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        Ótimas notícias! Seu ponto de recebimento <strong>${hubNickname}</strong> foi aprovado e já está ativo na plataforma.
      </p>
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        A partir de agora, você pode começar a receber encomendas e ganhar suas comissões. Acesse a plataforma para gerenciar seu hub.
      </p>
      ${emailButton("Acessar Plataforma", "https://app.toodrop.com/")}
      <p style="margin: 16px 0 0 0; font-size: 14px; line-height: 20px; color: #71717a;">
        Mantenha seu ponto sempre ativo para maximizar seus ganhos!
      </p>
    `)}
    ${emailFooter("© 2025 Toodrop. Todos os direitos reservados.")}
  `);

  const text_body = `Olá ${properName} (Toodroper)!\n\nSeu ponto de recebimento ${hubNickname} foi aprovado e já está ativo na plataforma.\n\nA partir de agora, você pode começar a receber encomendas e ganhar suas comissões. Acesse a plataforma: https://app.toodrop.com/\n\nMantenha seu ponto sempre ativo para maximizar seus ganhos!`;

  return { subject, html_body, text_body };
};

// Email notification when receiver point is rejected
export const receiverPointRejectedEmail = (fullName: string, hubNickname: string, reason: string) => {
  const properName = toProperCase(fullName);

  const subject = "Seu ponto de recebimento foi reprovado";
  
  const html_body = emailTemplate(`
    ${emailHeader("Atualização sobre seu ponto de recebimento")}
    ${emailBody(`
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        Olá <strong>${properName}</strong> (<em>Toodroper</em>),
      </p>
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        Infelizmente, seu ponto de recebimento <strong>${hubNickname}</strong> não foi aprovado neste momento.
      </p>
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        <strong>Motivo:</strong> ${reason}
      </p>
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        Você pode revisar os documentos e informações fornecidas e enviar uma nova solicitação quando estiver pronto.
      </p>
      ${emailButton("Acessar Plataforma", "https://app.toodrop.com/")}
      <p style="margin: 16px 0 0 0; font-size: 14px; line-height: 20px; color: #71717a;">
        Se tiver dúvidas, entre em contato com nosso suporte.
      </p>
    `)}
    ${emailFooter("© 2025 Toodrop. Todos os direitos reservados.")}
  `);

  const text_body = `Olá ${properName} (Toodroper)!\n\nSeu ponto de recebimento ${hubNickname} não foi aprovado neste momento.\n\nMotivo: ${reason}\n\nVocê pode revisar os documentos e informações fornecidas e enviar uma nova solicitação quando estiver pronto.\n\nAcesse a plataforma: https://app.toodrop.com/`;

  return { subject, html_body, text_body };
};

// Email notification when receiver point is set to pending
export const receiverPointPendingEmail = (fullName: string, hubNickname: string, notes: string) => {
  const properName = toProperCase(fullName);

  const subject = "Ação necessária - Seu ponto de recebimento";
  
  const html_body = emailTemplate(`
    ${emailHeader("Ação necessária para seu ponto")}
    ${emailBody(`
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        Olá <strong>${properName}</strong> (<em>Toodroper</em>),
      </p>
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        Seu ponto de recebimento <strong>${hubNickname}</strong> está com status <strong>pendente</strong> e precisa de ação da sua parte.
      </p>
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        <strong>Observações:</strong> ${notes}
      </p>
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        Por favor, acesse a plataforma e revise as informações ou documentos solicitados para que possamos aprovar seu ponto.
      </p>
      ${emailButton("Acessar Plataforma", "https://app.toodrop.com/")}
      <p style="margin: 16px 0 0 0; font-size: 14px; line-height: 20px; color: #71717a;">
        Quanto antes você resolver as pendências, mais rápido seu ponto será aprovado!
      </p>
    `)}
    ${emailFooter("© 2025 Toodrop. Todos os direitos reservados.")}
  `);

  const text_body = `Olá ${properName} (Toodroper)!\n\nSeu ponto de recebimento ${hubNickname} está com status pendente e precisa de ação da sua parte.\n\nObservações: ${notes}\n\nPor favor, acesse a plataforma e revise as informações ou documentos solicitados.\n\nAcesse: https://app.toodrop.com/`;

  return { subject, html_body, text_body };
};

// Pending hub registration reminder email
export const pendingHubReminderEmail = (firstName: string) => {
  const properFirstName = toProperCase(firstName);

  const subject = "Finalize seu cadastro na Toodrop!";
  
  const html_body = emailTemplate(`
    ${emailHeader("Finalize seu cadastro de Toodroper")}
    ${emailBody(`
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        Olá <strong>${properFirstName}</strong>,
      </p>
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        Notamos que seu cadastro como <strong>Toodroper</strong> ainda não foi finalizado. Para começar a receber encomendas e ganhar suas comissões, você precisa completar o envio dos documentos.
      </p>
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        <strong>O que falta?</strong>
      </p>
      <ul style="margin: 0 0 16px 0; padding-left: 24px; font-size: 16px; line-height: 24px; color: #3f3f46;">
        <li>Documento de identidade (frente e verso)</li>
        <li>Selfie segurando o documento</li>
        <li>Comprovante de endereço</li>
      </ul>
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        O processo é rápido e você pode fazer tudo pelo celular. Acesse agora e finalize em poucos minutos!
      </p>
      ${emailButton("Finalizar Cadastro", "https://app.toodrop.com/")}
      <p style="margin: 16px 0 0 0; font-size: 14px; line-height: 20px; color: #71717a;">
        Quanto antes você finalizar, mais rápido poderá começar a ganhar!
      </p>
    `)}
    ${emailFooter("© 2025 Toodrop. Todos os direitos reservados.")}
  `);

  const text_body = `Olá ${properFirstName}!\n\nNotamos que seu cadastro como Toodroper ainda não foi finalizado. Para começar a receber encomendas e ganhar suas comissões, você precisa completar o envio dos documentos.\n\nO que falta:\n- Documento de identidade (frente e verso)\n- Selfie segurando o documento\n- Comprovante de endereço\n\nAcesse agora e finalize: https://app.toodrop.com/\n\nQuanto antes você finalizar, mais rápido poderá começar a ganhar!`;

  return { subject, html_body, text_body };
};

// Referral invite email
export const referralInviteTemplate = ({
  referrerName,
  referralLink,
}: {
  referrerName: string;
  referralLink: string;
}) => {
  return emailTemplate(`
    ${emailHeader(`${referrerName} te convidou para a Toodrop!`)}
    ${emailBody(`
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        Olá!
      </p>
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        <strong>${referrerName}</strong> está te convidando para fazer parte da <strong>Toodrop</strong>, a plataforma que conecta vizinhos para receber encomendas!
      </p>
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        Como <strong>Toodroper</strong> (ponto de recebimento), você pode:
      </p>
      <ul style="margin: 0 0 16px 0; padding-left: 24px; font-size: 16px; line-height: 24px; color: #3f3f46;">
        <li>Receber encomendas dos vizinhos</li>
        <li>Ganhar comissão por cada entrega</li>
        <li>Trabalhar no conforto da sua casa</li>
        <li>Definir seus próprios horários</li>
      </ul>
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        Cadastre-se agora usando o link abaixo:
      </p>
      ${emailButton("Cadastre-se na Toodrop", referralLink)}
      <p style="margin: 16px 0 0 0; font-size: 14px; line-height: 20px; color: #71717a;">
        Este convite foi enviado por ${referrerName} através da plataforma Toodrop.
      </p>
    `)}
    ${emailFooter("© 2025 Toodrop. Todos os direitos reservados.")}
  `);
};
