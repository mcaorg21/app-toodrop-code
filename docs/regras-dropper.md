# Regras de Rastreamento - Área do Dropper (Entregador)

Este documento descreve as regras e fluxos de funcionamento da área do Dropper na plataforma Toodrop.

---

## 1. Ativação de Localização

- **Obrigatória** para usar a funcionalidade de rastreamento
- Sistema faz até **3 tentativas automáticas** de ativar o GPS
- Se falhar após 3 tentativas, mostra modal com instruções de como ativar a localização no navegador
- Configurações de geolocalização:
  - `enableHighAccuracy: true`
  - `timeout: 10000ms`
  - `maximumAge: 0`

---

## 2. Rastrear Entregas Disponíveis

### Endpoint: `GET /api/delivery/nearby-deliveries`

**Parâmetros:**
- `latitude` - Latitude atual do entregador
- `longitude` - Longitude atual do entregador
- `maxDistance` - Distância máxima em metros (padrão: 5000m / 5km)

**Regras de Filtragem:**
- Busca droptags com status `created`
- Filtra apenas pacotes que têm endereços com coordenadas válidas (`latitude` e `longitude` não nulos)
- Calcula distância usando fórmula de Haversine
- Retorna apenas pacotes dentro do raio máximo configurado
- **Ordena por distância** (mais próximos primeiro)

---

## 3. Identificação de Pacote via OCR

### Endpoint: `POST /api/delivery/scan-package`

### Fluxo:
1. Entregador tira foto da etiqueta do pacote
2. Imagem é **comprimida para máximo 1MB** no frontend
3. Imagem é enviada para **Google Vision API** (TEXT_DETECTION)
4. Texto extraído é enviado para **webhook de processamento**
5. Dados estruturados retornados são comparados com droptags disponíveis

### Compressão de Imagem:
- Qualidade inicial: 90%
- Se > 1MB: tenta 70%
- Se ainda > 1MB: reduz escala para 80% + qualidade 70%
- Se ainda > 1MB: reduz escala para 60% + qualidade 60%
- Último recurso: escala 50% + qualidade 50%

---

## 4. Matching de Pacotes

### Compatibilidade Mínima: **60%**

### Campos Verificados:

| Campo | Regra de Comparação |
|-------|---------------------|
| **Data do pacote** | Deve ser posterior à data de criação do droptag |
| **CEP** | Comparação exata (normalizado, apenas dígitos) |
| **Logradouro** | Comparação parcial (contains) |
| **Bairro** | Comparação parcial (contains) |
| **Cidade** | Comparação parcial (contains) |
| **Estado** | Comparação parcial (contains) |
| **Nome destinatário** | Primeiro nome ou nome completo (contains) |

### Cálculo de Score:
```
score = campos_correspondentes / total_campos_verificados * 100
```

- Se `score >= 60%`: pacote é considerado **match**
- Múltiplos matches são ordenados por % de compatibilidade (maior primeiro)
- Se nenhum match >= 60%: retorna erro "Pacote não encontrado"

---

## 5. Seleção de Recebedor

### Endpoint: `GET /api/delivery/nearby-receivers/:droptagId`

### Regras:
- Busca apenas recebedores **autorizados** para aquele droptag específico (tabela `droptag_authorized_receivers`)
- Filtra apenas recebedores com:
  - `is_active = 1` (ativo)
  - `active_hub = 1` (hub ativo)
  - Coordenadas válidas (`latitude` e `longitude` não nulos)
- Calcula distância do **endereço de destino** até cada recebedor
- Ordena por distância (mais próximos primeiro)

### Geração de QR Code:
Após selecionar um recebedor, o entregador gera um QR Code contendo:
```json
{
  "receiver_key": "chave_do_recebedor",
  "droptag_id": 123,
  "driver_user_id": 456,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

O recebedor escaneia este QR Code para confirmar o recebimento do pacote.

### Ativação do Ponto de Entrega:
Quando o entregador gera o QR Code:
1. Sistema chama `POST /api/delivery/activate-receiver-point` com `selected_receiver_key`
2. `driver_delivery.sub_status` é atualizado para `qr_generated`
3. Se o pacote tiver **palavra secreta**, o recebedor visualiza a palavra em sua tela

Quando o QR Code é fechado (X ou Concluir):
1. Sistema chama `POST /api/delivery/clear-receiver-point`
2. `selected_receiver_key` e `sub_status` são limpos

---

## 6. Palavra Secreta (Segurança Adicional)

### Visão Geral:
O consumidor pode definir uma **palavra secreta** ao criar o droptag. Essa palavra adiciona uma camada extra de segurança na transferência de responsabilidade.

### Fluxo Completo:

**1. Entregador gera QR Code:**
- Se o pacote tem palavra secreta, aparece um aviso amarelo:
  > "Este pacote possui uma palavra secreta. Após o recebedor escanear o QR Code, você deverá digitar a palavra secreta que ele informará verbalmente."

**2. Recebedor recebe notificação de entrega chegando:**
- Quando o entregador ativa o ponto de entrega (gera QR), o recebedor vê em sua tela:
  - Card animado "Entrega chegando!" (polling a cada 5 segundos em `GET /api/receiver/incoming-deliveries`)
  - Se o pacote tem palavra secreta, mostra aviso que precisará informar a palavra ao entregador

**3. Recebedor escaneia o QR Code:**
- `POST /api/receiver/scan-delivery`
- Se o pacote tem `secret_word`:
  - Retorna `requires_secret_word: true` + a palavra secreta
  - Atualiza `driver_delivery.sub_status` para `awaiting_secret_word`
  - Modal aparece para o recebedor mostrando a palavra secreta que deve falar ao entregador
  - **NÃO confirma a entrega** (responsabilidade não é transferida)

**4. Entregador recebe notificação:**
- Enquanto o QR Code está visível, o app do entregador faz polling em `GET /api/delivery/pending-secret-word`
- Quando detecta `sub_status = 'awaiting_secret_word'`, exibe modal para digitar a palavra secreta
- Entregador deve digitar exatamente a palavra que o recebedor informou verbalmente
- Validação é **case insensitive** (ignora maiúsculas/minúsculas)

**5. Validação:**
- `POST /api/receiver/validate-secret-word`
- Se **correta**: 
  - Entrega é confirmada, responsabilidade transferida
  - Modal de sucesso "Entrega Confirmada!" aparece para o entregador
  - Após 2 segundos, tela volta automaticamente para lista de pacotes
- Se **incorreta**: tentativa é registrada, mostra tentativas restantes

### Limite de Tentativas:

| Tentativas | Resultado |
|------------|-----------|
| 1ª falha | Mostra "2 tentativas restantes" |
| 2ª falha | Mostra "1 tentativa restante" |
| 3ª falha | **Bloqueio de 15 minutos** |

### Tabela: `secret_word_attempts`
- `droptag_id` - ID do pacote
- `driver_user_id` - ID do entregador
- `failed_attempts` - Contador de falhas
- `blocked_until` - Data/hora até quando está bloqueado

### Importante:
- **Sem palavra correta = sem transferência de responsabilidade**
- A responsabilidade permanece com o entregador até validação bem-sucedida
- O bloqueio de 15 minutos é por combinação entregador + pacote

---

## 7. Status das Entregas do Entregador

### Tabela: `driver_deliveries`

| Status | Descrição |
|--------|-----------|
| `in_transit` | Entrega em andamento - pacote foi coletado pelo entregador |
| `delivered` | Entregue ao recebedor |

### Sub-status:

| Sub-status | Descrição |
|------------|-----------|
| `qr_generated` | QR Code gerado, aguardando recebedor escanear |
| `awaiting_secret_word` | Recebedor escaneou QR, aguardando entregador digitar palavra secreta |
| `awaiting_commission` | Aguardando pagamento de comissão ao entregador |

---

## 8. Arquivos Relacionados

### Frontend:
- `src/react-app/components/DeliveryView.tsx` - Interface principal do entregador

### Backend:
- `src/worker/routes/delivery.ts` - Rotas da API de entregas
- `src/worker/routes/receiver.ts` - Rotas da API de recebedor (inclui validação de palavra secreta)
- `src/worker/utils/distance.ts` - Cálculo de distância (Haversine)

### Hooks:
- `src/react-app/hooks/useApi.ts` - Funções de API utilizadas:
  - `saveDeliveryLocation()`
  - `findNearbyDeliveries()`
  - `getMyDeliveries()`
  - `getNearbyReceivers()`
  - `activateReceiverPoint()`
  - `clearReceiverPoint()`
  - `getPendingSecretWord()` - Polling para verificar se recebedor escaneou QR de pacote com palavra secreta

---

## 9. Integrações Externas

| Serviço | Uso |
|---------|-----|
| **Google Vision API** | OCR para leitura de etiquetas |
| **Webhook Railway** | Processamento e estruturação dos dados extraídos |

---

*Documento atualizado em: Janeiro 2025 (fluxo completo de Palavra Secreta com modal no lado do entregador)*
