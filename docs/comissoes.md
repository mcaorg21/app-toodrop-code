# Sistema de Comissões - TooDrop

Este documento descreve como as comissões são calculadas e registradas durante o processo de entrega.

## Visão Geral

Cada entrega gera comissões para três partes:
- **Recebedor**: quem recebe o pacote no ponto de entrega
- **Entregador**: quem transporta o pacote até o ponto de entrega
- **Plataforma**: TooDrop

As porcentagens de comissão são configuráveis por usuário na tabela `users`:
- `receiver_commission_percent` (padrão: 60%)
- `driver_commission_percent` (padrão: 20%)
- `platform_commission_percent` (padrão: 20%)

O preço do serviço (`service_price`) é definido por ponto de recebimento na tabela `receiver_point_status` (padrão: R$ 10,00).

## Fluxos de Entrega

### Fluxo 1: Entrega COM Palavra Secreta

Usado quando a DropTag possui uma palavra secreta configurada.

**Sequência:**
1. Entregador gera QR Code → `POST /api/delivery/activate-receiver-point`
   - Cria `driver_deliveries` com `status='in_transit'`, `sub_status='qr_generated'`
   - Sem comissões ainda

2. Recebedor escaneia QR Code → `POST /api/receiver/scan-delivery`
   - Detecta que DropTag tem `secret_word`
   - Atualiza `driver_deliveries` para `sub_status='awaiting_secret_word'`
   - Retorna `requires_secret_word: true` + a palavra secreta para o recebedor exibir

3. Entregador confirma palavra secreta → `POST /api/receiver/validate-secret-word`
   - Busca `service_price` da tabela `receiver_point_status`
   - Busca `driver_commission_percent` e `receiver_commission_percent` da tabela `users`
   - Calcula valores: `commission_amount = service_price * commission_percent / 100`
   - Atualiza/Insere `driver_deliveries` com `status='delivered'`, `sub_status='awaiting_commission'` + campos de comissão
   - Insere `receiver_deliveries` com `status='awaiting_pickup'` + campos de comissão

**Endpoint responsável pelas comissões:** `validate-secret-word` (receiver.ts ~linha 1660)

---

### Fluxo 2: Entrega SEM Palavra Secreta

Usado quando a DropTag não possui palavra secreta (auto-confirmação).

**Sequência:**
1. Entregador gera QR Code → `POST /api/delivery/activate-receiver-point`
   - Cria `driver_deliveries` com `status='in_transit'`, `sub_status='qr_generated'`
   - Sem comissões ainda

2. Recebedor escaneia QR Code → `POST /api/receiver/scan-delivery`
   - Detecta que DropTag NÃO tem `secret_word`
   - Busca `service_price` da tabela `receiver_point_status`
   - Busca `driver_commission_percent` e `receiver_commission_percent` da tabela `users`
   - Calcula valores: `commission_amount = service_price * commission_percent / 100`
   - Atualiza/Insere `driver_deliveries` com `status='delivered'`, `sub_status='awaiting_commission'` + campos de comissão
   - Insere `receiver_deliveries` com `status='awaiting_pickup'` + campos de comissão
   - Retorna `success: true`

**Endpoint responsável pelas comissões:** `scan-delivery` (receiver.ts ~linha 1520)

---

## Campos de Comissão

### Tabela `driver_deliveries`
| Campo | Descrição |
|-------|-----------|
| `service_price` | Preço total do serviço (ex: R$ 10,00) |
| `commission_percent` | Percentual do entregador (ex: 20) |
| `commission_amount` | Valor em reais (ex: R$ 2,00) |

### Tabela `receiver_deliveries`
| Campo | Descrição |
|-------|-----------|
| `service_price` | Preço total do serviço (ex: R$ 10,00) |
| `commission_percent` | Percentual do recebedor (ex: 60) |
| `commission_amount` | Valor em reais (ex: R$ 6,00) |

## Exemplo de Cálculo

Configuração:
- `service_price`: R$ 10,00
- `receiver_commission_percent`: 60%
- `driver_commission_percent`: 20%
- `platform_commission_percent`: 20%

Resultado:
- Recebedor ganha: R$ 10,00 × 60% = **R$ 6,00**
- Entregador ganha: R$ 10,00 × 20% = **R$ 2,00**
- Plataforma: R$ 10,00 × 20% = **R$ 2,00**

## Preservação de Histórico

Os valores de `service_price` e `commission_percent` são copiados no momento da entrega. Isso garante que:
- Mudanças futuras no preço do serviço não afetam entregas já realizadas
- Mudanças nas comissões do usuário não retroagem para entregas passadas
- O histórico financeiro permanece consistente
