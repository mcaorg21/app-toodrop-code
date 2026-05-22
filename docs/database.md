# Banco de Dados - DropTag v4

Este documento descreve o schema do banco de dados e os relacionamentos entre as tabelas.

## Diagrama de Relacionamentos

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   users     │       │  addresses  │       │  schedules  │
│             │◄──────│             │       │             │
│  id (PK)    │1     N│  user_id    │       │  user_id    │
│             │       │             │       │             │
└──────┬──────┘       └─────────────┘       └─────────────┘
       │
       │1
       │
       ├──────────────────────────────────────────────────┐
       │                                                  │
       │N                                                 │N
┌──────▼──────┐                                   ┌───────▼──────┐
│  droptags   │                                   │receiver_docs │
│             │                                   │              │
│consumer_user│                                   │   user_id    │
│receiver_user│                                   │              │
└──────┬──────┘                                   └──────────────┘
       │
       │1
       │
       ├───────────────────┬─────────────────────┬──────────────────┐
       │N                  │N                    │N                 │N
┌──────▼──────┐    ┌───────▼───────┐    ┌───────▼───────┐   ┌──────▼──────┐
│delivery_    │    │driver_        │    │receiver_      │   │droptag_     │
│scans        │    │deliveries     │    │deliveries     │   │authorized_  │
│             │    │               │    │               │   │receivers    │
│ droptag_id  │    │ droptag_id    │    │ droptag_id    │   │ droptag_id  │
│ from_user_id│    │ driver_user_id│    │receiver_user  │   │ receiver_key│
│ to_user_id  │    │               │    │driver_user_id │   │             │
└─────────────┘    └───────────────┘    └───────────────┘   └─────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────┐
│receiver_point_  │     │hub_location_    │     │delivery_driver_     │
│status           │     │logs             │     │locations            │
│                 │     │                 │     │                     │
│ receiver_key    │     │ receiver_key    │     │ user_id (FK users)  │
└─────────────────┘     └─────────────────┘     └─────────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────┐
│admins           │     │commission_      │     │secret_word_         │
│                 │     │history          │     │attempts             │
│ user_id (FK)    │     │ user_id (FK)    │     │ droptag_id (FK)     │
│                 │     │ changed_by_user │     │ driver_user_id (FK) │
└─────────────────┘     └─────────────────┘     └─────────────────────┘

┌─────────────────────┐
│receiver_doc_        │
│validations          │
│                     │
│ user_id (FK users)  │
└─────────────────────┘
```

---

## Tabelas

### users
Tabela principal de usuários do sistema. Armazena informações de consumidores, recebedores e entregadores.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | Identificador único |
| mocha_user_id | TEXT | ID do usuário no sistema Mocha Auth |
| full_name | TEXT | Nome completo |
| cpf | TEXT | CPF (único) |
| birth_date | DATE | Data de nascimento |
| phone | TEXT | Telefone |
| pix_key | TEXT | Chave PIX para recebimento |
| profile_status | TEXT | Status do perfil: 'incomplete', 'complete' |
| is_consumer_active | BOOLEAN | Perfil de consumidor ativo |
| is_receiver_pending | BOOLEAN | Aguardando aprovação como recebedor |
| is_receiver_active | BOOLEAN | Perfil de recebedor aprovado e ativo |
| last_active_tab | TEXT | Última aba acessada no dashboard |
| main_interest | TEXT | Interesse principal: 'consumer', 'receiver', 'driver' |
| has_seen_consumer_tour | BOOLEAN | Visualizou tour de consumidor |
| has_seen_receiver_tour | BOOLEAN | Visualizou tour de recebedor |
| has_seen_delivery_tour | BOOLEAN | Visualizou tour de entregador |
| asaas_wallet_id | TEXT | ID da carteira no Asaas |
| asaas_api_key | TEXT | API Key do Asaas |
| asaas_account_id | TEXT | ID da conta no Asaas |
| receiver_commission_percent | INTEGER | % comissão do recebedor (padrão: 60) |
| driver_commission_percent | INTEGER | % comissão do entregador (padrão: 20) |
| platform_commission_percent | INTEGER | % comissão da plataforma (padrão: 20) |
| id_customer_asaas | TEXT | ID do cliente no Asaas (para cobranças) |
| is_active | BOOLEAN | Usuário ativo no sistema (padrão: 1) |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

---

### addresses
Endereços dos usuários (consumidor ou ponto de recebimento).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | Identificador único |
| user_id | INTEGER FK | Referência ao usuário |
| address_type | TEXT | Tipo: 'consumer' ou 'receiver' |
| nickname | TEXT | Apelido do endereço |
| cep | TEXT | CEP |
| street | TEXT | Rua |
| number | TEXT | Número |
| complement | TEXT | Complemento |
| neighborhood | TEXT | Bairro |
| city | TEXT | Cidade |
| state | TEXT | Estado (UF) |
| receiver_key | TEXT | Chave única do ponto de recebimento |
| latitude | REAL | Latitude (geolocalização) |
| longitude | REAL | Longitude (geolocalização) |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

**Relacionamentos:**
- `user_id` → `users.id` (N:1)

---

### droptags
Etiquetas de rastreamento criadas pelos consumidores.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | Identificador único |
| uuid | TEXT | UUID único da droptag |
| consumer_user_id | INTEGER FK | Consumidor que criou |
| receiver_user_id | INTEGER FK | Recebedor designado |
| address_id | INTEGER FK | Endereço de entrega |
| tracking_code | TEXT | Código de rastreio original |
| title | TEXT | Título/descrição do pacote |
| secret_word | TEXT | Palavra secreta para confirmação |
| notes | TEXT | Observações |
| status | TEXT | Status: 'created', 'in_transit', 'awaiting_pickup', 'delivered' |
| qr_code_data | TEXT | Dados do QR Code |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

**Relacionamentos:**
- `consumer_user_id` → `users.id` (N:1)
- `receiver_user_id` → `users.id` (N:1)
- `address_id` → `addresses.id` (N:1)

---

### schedules
Horários de disponibilidade dos recebedores.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | Identificador único |
| user_id | INTEGER FK | Referência ao usuário recebedor |
| day_of_week | INTEGER | Dia da semana (0=Domingo, 6=Sábado) |
| range1_start | TEXT | Início do primeiro intervalo (HH:MM) |
| range1_end | TEXT | Fim do primeiro intervalo |
| range2_start | TEXT | Início do segundo intervalo |
| range2_end | TEXT | Fim do segundo intervalo |
| is_active | BOOLEAN | Dia ativo |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

**Relacionamentos:**
- `user_id` → `users.id` (N:1)

---

### receiver_docs
Documentos enviados para aprovação de recebedor.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | Identificador único |
| user_id | INTEGER FK | Referência ao usuário |
| id_document_url | TEXT | URL do documento de identidade (frente) |
| id_document_back_url | TEXT | URL do documento de identidade (verso) |
| selfie_url | TEXT | URL da selfie com documento |
| address_proof_url | TEXT | URL do comprovante de endereço |
| address_proof_type | TEXT | Tipo do comprovante |
| status | TEXT | Status: 'pending', 'approved', 'rejected' |
| review_notes | TEXT | Notas da revisão |
| reviewed_at | TIMESTAMP | Data da revisão |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

**Relacionamentos:**
- `user_id` → `users.id` (1:1)

---

### receiver_doc_validations
Validações individuais de cada documento do recebedor.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | Identificador único |
| user_id | INTEGER FK | Referência ao usuário |
| doc_type | TEXT | Tipo: 'id_front', 'id_back', 'selfie', 'address_proof' |
| status | TEXT | Status: 'pending', 'approved', 'rejected' |
| rejection_reason | TEXT | Motivo da rejeição |
| validated_at | DATETIME | Data da validação |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

**Relacionamentos:**
- `user_id` → `users.id` (N:1)

---

### delivery_scans
Registro de escaneamentos durante o fluxo de entrega.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | Identificador único |
| droptag_id | INTEGER FK | Referência à droptag |
| scan_type | TEXT | Tipo de scan |
| from_user_type | TEXT | Tipo do remetente |
| to_user_type | TEXT | Tipo do destinatário |
| from_user_id | INTEGER FK | Usuário remetente |
| to_user_id | INTEGER FK | Usuário destinatário |
| photo_url | TEXT | URL da foto do scan |
| latitude | REAL | Latitude do scan |
| longitude | REAL | Longitude do scan |
| scanned_at | TIMESTAMP | Data/hora do scan |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

**Relacionamentos:**
- `droptag_id` → `droptags.id` (N:1)
- `from_user_id` → `users.id` (N:1)
- `to_user_id` → `users.id` (N:1)

---

### driver_deliveries
Entregas em andamento por entregadores.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | Identificador único |
| driver_user_id | INTEGER FK | Entregador |
| droptag_id | INTEGER FK | Droptag sendo entregue |
| status | TEXT | Status: 'in_transit', 'delivered' |
| sub_status | TEXT | Sub-status: 'qr_generated', 'awaiting_secret_word' |
| selected_receiver_key | TEXT | Chave do recebedor selecionado |
| picked_up_at | TIMESTAMP | Data/hora da coleta |
| delivered_at | TIMESTAMP | Data/hora da entrega |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

**Relacionamentos:**
- `driver_user_id` → `users.id` (N:1)
- `droptag_id` → `droptags.id` (N:1)

---

### receiver_deliveries
Entregas recebidas pelos recebedores.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | Identificador único |
| receiver_user_id | INTEGER FK | Recebedor |
| droptag_id | INTEGER FK | Droptag recebida |
| driver_user_id | INTEGER FK | Entregador que trouxe |
| status | TEXT | Status: 'awaiting_pickup', 'picked_up' |
| sub_status | TEXT | Sub-status detalhado |
| received_at | TIMESTAMP | Data/hora do recebimento |
| picked_up_at | TIMESTAMP | Data/hora da retirada pelo consumidor |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

**Relacionamentos:**
- `receiver_user_id` → `users.id` (N:1)
- `driver_user_id` → `users.id` (N:1)
- `droptag_id` → `droptags.id` (N:1)

---

### droptag_authorized_receivers
Recebedores autorizados para cada droptag.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | Identificador único |
| droptag_id | INTEGER FK | Referência à droptag |
| receiver_key | TEXT | Chave do recebedor autorizado |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

**Relacionamentos:**
- `droptag_id` → `droptags.id` (N:1)

---

### receiver_point_status
Status em tempo real dos pontos de recebimento.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | Identificador único |
| receiver_key | TEXT | Chave única do ponto |
| is_active | BOOLEAN | Ponto está ativo |
| active_hub | BOOLEAN | Hub ativo (recebendo entregas) |
| latitude | REAL | Última latitude |
| longitude | REAL | Última longitude |
| last_ping | DATETIME | Último ping de atividade |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

---

### hub_location_logs
Logs de verificação de localização dos hubs.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | Identificador único |
| receiver_key | TEXT | Chave do recebedor |
| request_latitude | REAL | Latitude da requisição |
| request_longitude | REAL | Longitude da requisição |
| request_timestamp | TEXT | Timestamp da requisição |
| response_success | BOOLEAN | Resposta bem-sucedida |
| response_active | BOOLEAN | Hub ativo na resposta |
| response_distance | INTEGER | Distância calculada (metros) |
| response_message | TEXT | Mensagem de resposta |
| response_status_code | INTEGER | Código de status HTTP |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

---

### delivery_driver_locations
Localização em tempo real dos entregadores.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | Identificador único |
| user_id | INTEGER FK | Referência ao entregador |
| latitude | REAL | Latitude atual |
| longitude | REAL | Longitude atual |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

**Relacionamentos:**
- `user_id` → `users.id` (N:1)

---

### secret_word_attempts
Tentativas de validação da palavra secreta.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | Identificador único |
| droptag_id | INTEGER FK | Referência à droptag |
| driver_user_id | INTEGER FK | Entregador que tentou |
| failed_attempts | INTEGER | Número de tentativas falhas |
| last_attempt_at | DATETIME | Data/hora da última tentativa |
| blocked_until | DATETIME | Bloqueado até (após muitas falhas) |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

**Relacionamentos:**
- `droptag_id` → `droptags.id` (N:1)
- `driver_user_id` → `users.id` (N:1)

---

### admins
Usuários com permissões administrativas.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | Identificador único |
| user_id | INTEGER FK | Referência ao usuário |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

**Relacionamentos:**
- `user_id` → `users.id` (1:1)

---

### commission_history
Histórico de alterações nas comissões dos usuários.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | Identificador único |
| user_id | INTEGER FK | Usuário que teve comissão alterada |
| changed_by_user_id | INTEGER FK | Admin que fez a alteração |
| receiver_commission_percent | INTEGER | % comissão recebedor |
| driver_commission_percent | INTEGER | % comissão entregador |
| platform_commission_percent | INTEGER | % comissão plataforma |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

**Relacionamentos:**
- `user_id` → `users.id` (N:1)
- `changed_by_user_id` → `users.id` (N:1)

---

## Fluxos Principais

### 1. Fluxo de Entrega Completo

```
1. Consumidor cria droptag
   └── INSERT droptags (status='created')

2. Entregador escaneia pacote
   └── INSERT delivery_scans

3. Entregador seleciona recebedor e gera QR
   └── INSERT/UPDATE driver_deliveries (status='in_transit', sub_status='qr_generated')

4. Recebedor escaneia QR do entregador
   └── UPDATE receiver_point_status (is_active=1)
   └── UPDATE driver_deliveries (sub_status='awaiting_secret_word')

5. Entregador digita palavra secreta
   └── INSERT/UPDATE secret_word_attempts
   └── UPDATE driver_deliveries (status='delivered')
   └── INSERT receiver_deliveries
   └── UPDATE droptags (status='awaiting_pickup')

6. Consumidor retira pacote
   └── UPDATE receiver_deliveries (status='picked_up')
   └── UPDATE droptags (status='delivered')
```

### 2. Aprovação de Recebedor

```
1. Usuário envia documentos
   └── INSERT receiver_docs (status='pending')
   └── INSERT receiver_doc_validations (para cada documento)

2. Webhook n8n valida documentos
   └── UPDATE receiver_doc_validations

3. Todos documentos aprovados
   └── UPDATE receiver_docs (status='approved')
   └── UPDATE users (is_receiver_active=1, is_receiver_pending=0)
```

### 3. Gestão de Comissões

```
1. Admin altera comissão de usuário
   └── UPDATE users (receiver/driver/platform_commission_percent)
   └── INSERT commission_history

2. Admin altera em massa
   └── UPDATE users (múltiplos)
   └── INSERT commission_history (para cada usuário)
```
