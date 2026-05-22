# Fluxo de Status das Entregas - Toodrop

Este documento descreve o fluxo completo de uma entrega desde a criação até a finalização, incluindo todos os status e sub_status envolvidos.

---

## Tabelas Envolvidas

| Tabela | Descrição |
|--------|-----------|
| `droptags` | Registro principal da entrega (criado pelo consumidor) |
| `driver_deliveries` | Registro da entrega do ponto de vista do motorista |
| `receiver_deliveries` | Registro da entrega do ponto de vista do hub/receptor |

---

## Status da Droptag (tabela `droptags`)

| Status | Label PT | Descrição |
|--------|----------|-----------|
| `created` | Criada | Droptag acabou de ser criada pelo consumidor |
| `in_transit` | Em Trânsito | Motorista coletou e está levando ao hub |
| `awaiting_pickup` | Aguardando Retirada | Entrega está no hub, aguardando consumidor retirar |
| `delivered` | Entregue | Entrega foi entregue ao hub |
| `picked_up` | Retirado | Consumidor retirou a encomenda |
| `completed` | Finalizada | Processo completo (pagamento confirmado) |
| `cancelled` | Cancelada | Entrega foi cancelada |

---

## Sub-Status do Motorista (tabela `driver_deliveries`)

| Sub-Status | Descrição |
|------------|-----------|
| `qr_generated` | QR Code foi gerado, motorista selecionou o hub de destino |
| `awaiting_secret_word` | Receptor escaneou o QR, aguardando confirmação com palavra secreta |
| `awaiting_commission` | Entrega confirmada, aguardando pagamento da comissão |
| `commission_paid` | Comissão do motorista foi paga via Asaas |

---

## Sub-Status do Receptor/Hub (tabela `receiver_deliveries`)

| Sub-Status | Descrição |
|------------|-----------|
| `awaiting_commission` | Hub recebeu a entrega, aguardando pagamento |
| `commission_paid` | Comissão do hub foi paga via Asaas |

---

## Fluxo Completo Passo a Passo

### 1️⃣ Criação da Droptag
**Ator:** Consumidor (Dropper One)

- Consumidor cria uma droptag no app
- **droptags.status** = `created`

---

### 2️⃣ Motorista Coleta e Seleciona Hub
**Ator:** Motorista (Dropper)

- Motorista escaneia QR code da droptag
- Seleciona um hub de destino (receiver point)
- Sistema cria registro em `driver_deliveries`

**Mudanças:**
- **droptags.status** = `in_transit`
- **driver_deliveries.status** = `in_transit`
- **driver_deliveries.sub_status** = `qr_generated`

---

### 3️⃣ Hub Recebe a Entrega
**Ator:** Hub/Receptor (Toodroper)

- Receptor escaneia o QR code da entrega
- Sistema verifica se o QR code pertence ao receptor correto
- Se for o receptor errado, exibe alerta: "Este QR Code é para outro ponto de recebimento"
- Se correto, exibe declaração de responsabilidade
- Receptor marca checkbox: "Declaro que recebi este pacote e me responsabilizo pela guarda até a retirada pelo consumidor (Dropper One)"
- Após aceitar, sistema confirma recebimento

**Mudanças:**
- **driver_deliveries.sub_status** = `awaiting_secret_word` (se houver palavra secreta) ou `awaiting_commission` (se não houver)

---

### 4️⃣ Confirmação com Palavra Secreta (Se Aplicável)
**Ator:** Motorista

- Se a droptag tiver palavra secreta configurada:
  - Motorista insere a palavra secreta para confirmar entrega
  - Hub valida a palavra secreta
- Sistema cria registro em `receiver_deliveries`

**Mudanças:**
- **droptags.status** = `awaiting_pickup` ou `delivered`
- **driver_deliveries.status** = `delivered`
- **driver_deliveries.sub_status** = `awaiting_commission`
- **receiver_deliveries.status** = `at_receiver`
- **receiver_deliveries.sub_status** = `awaiting_commission`

---

### 5️⃣ Consumidor Retira a Encomenda
**Ator:** Consumidor (Dropper One)

- Consumidor vai ao hub retirar sua encomenda
- Abre modal de pagamento no app
- Realiza pagamento via PIX ou Cartão (Asaas)

**Mudanças:**
- Sistema cria cobrança no Asaas
- QR Code PIX é exibido (se PIX) ou redirect para checkout (se cartão)

---

### 6️⃣ Pagamento Confirmado
**Ator:** Sistema (webhook ou polling Asaas)

- Asaas confirma o pagamento
- Sistema atualiza todos os status
- Comissões são distribuídas automaticamente (split payment)

**Mudanças:**
- **droptags.status** = `completed`
- **driver_deliveries.sub_status** = `commission_paid`
- **receiver_deliveries.status** = `picked_up`
- **receiver_deliveries.sub_status** = `commission_paid`
- Registro criado em `platform_commissions`

---

## Diagrama de Fluxo

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLUXO DA ENTREGA                                  │
└─────────────────────────────────────────────────────────────────────────────┘

CONSUMIDOR          MOTORISTA              HUB                    SISTEMA
    │                   │                   │                        │
    │ Cria droptag      │                   │                        │
    ├──────────────────►│                   │                        │
    │                   │                   │                        │
    │ droptag.status = created              │                        │
    │                   │                   │                        │
    │                   │ Escaneia QR       │                        │
    │                   │ Seleciona hub     │                        │
    │                   ├──────────────────►│                        │
    │                   │                   │                        │
    │ droptag.status = in_transit           │                        │
    │ dd.status = in_transit                │                        │
    │ dd.sub_status = qr_generated          │                        │
    │                   │                   │                        │
    │                   │                   │ Escaneia QR            │
    │                   │                   │ da entrega             │
    │                   │◄──────────────────┤                        │
    │                   │                   │                        │
    │ dd.sub_status = awaiting_secret_word  │                        │
    │                   │                   │                        │
    │                   │ Insere palavra    │                        │
    │                   │ secreta           │                        │
    │                   ├──────────────────►│                        │
    │                   │                   │                        │
    │ droptag.status = awaiting_pickup      │                        │
    │ dd.status = delivered                 │                        │
    │ dd.sub_status = awaiting_commission   │                        │
    │ rd.status = at_receiver               │                        │
    │ rd.sub_status = awaiting_commission   │                        │
    │                   │                   │                        │
    │ Vai retirar       │                   │                        │
    │ encomenda         │                   │                        │
    ├───────────────────┼──────────────────►│                        │
    │                   │                   │                        │
    │ Paga via PIX/     │                   │                        │
    │ Cartão            │                   │                        │
    ├───────────────────┼───────────────────┼───────────────────────►│
    │                   │                   │                        │
    │                   │                   │    Confirma pagamento  │
    │                   │                   │    Distribui comissões │
    │◄──────────────────┼───────────────────┼────────────────────────┤
    │                   │                   │                        │
    │ droptag.status = completed            │                        │
    │ dd.sub_status = commission_paid       │                        │
    │ rd.status = picked_up                 │                        │
    │ rd.sub_status = commission_paid       │                        │
    │                   │                   │                        │
    ▼                   ▼                   ▼                        ▼
```

---

## Legendas

- **dd** = driver_deliveries
- **rd** = receiver_deliveries
- **Dropper One** = Consumidor (quem envia/recebe a encomenda)
- **Dropper** = Motorista (quem transporta)
- **Toodroper** = Hub/Receptor (ponto de recebimento)

---

## Distribuição de Comissões

Quando o pagamento é confirmado, o valor do serviço é dividido:

| Destinatário | Percentual Padrão |
|--------------|-------------------|
| Hub (Receptor) | 60% |
| Motorista | 20% |
| Plataforma | 20% |

Os percentuais são configuráveis por hub no painel administrativo.

---

## Observações Importantes

1. **Split Payment**: O Asaas distribui automaticamente os valores para as carteiras de cada participante.

2. **Polling vs Webhook**: O sistema usa tanto webhook do Asaas quanto polling a cada 5 segundos para garantir que o pagamento seja detectado.

3. **Sub-status "null"**: Em alguns casos antigos, o sub_status pode estar como a string literal "null" (não NULL). O código trata ambos os casos.

4. **Status "at_receiver"**: Equivalente a "awaiting_pickup" - indica que a encomenda está no hub aguardando retirada.

5. **Criação de Subconta Asaas (Wallet)**: A subconta Asaas não é mais criada no cadastro do endereço de comissões. Agora é criada automaticamente:
   - **Para TooDroper**: Quando o admin aprova o ponto de recebimento
   - **Para Dropper**: No primeiro scan de pacote bem-sucedido
   
6. **Endereço de Comissões**: O modal solicitando endereço de comissões aparece quando o usuário tenta acessar pela primeira vez as áreas de TooDroper ou Dropper.

7. **Declaração de Responsabilidade**: Antes de confirmar o recebimento do pacote, o receptor deve marcar uma checkbox declarando que recebeu o pacote e se responsabiliza pela guarda até a retirada pelo consumidor.

8. **Verificação de Receptor**: O sistema verifica se o QR code escaneado pertence ao receptor correto. Se um receptor errado escanear, exibe mensagem de erro e não permite o recebimento.

9. **Alertas de Receptor Incorreto**: Durante a exibição do QR code pelo motorista, o sistema faz polling a cada 5 segundos. Se detectar que um receptor errado escaneou, exibe alerta pulsante vermelho: "Este QR Code foi lido por um outro ponto de recebimento."

10. **Palavra Secreta Opcional**: A palavra secreta é opcional na criação da droptag. Se não configurada, o fluxo pula a etapa de confirmação com palavra secreta.

11. **Registro de Comissões na Validação da Palavra Secreta**: Quando o motorista valida a palavra secreta com sucesso, o sistema registra automaticamente as comissões do motorista e do receptor. Isso inclui:
    - Atualização de `driver_deliveries` com `service_price`, `commission_percent`, e `commission_amount`
    - Criação/atualização de `receiver_deliveries` com os mesmos dados de comissão
    - Crédito do valor da comissão no saldo (`balance`) de cada usuário
    - Registro de transação em `user_transactions` para ambos (motorista e receptor)
