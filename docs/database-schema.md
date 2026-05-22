# TooDrop - Database Schema Reference

Este documento contém todas as definições de tabelas do banco de dados TooDrop (SQLite/D1).
Use como referência para migração ou recriação do banco de dados.

---

## Índice de Tabelas

1. [users](#users) - Usuários do sistema
2. [email_credentials](#email_credentials) - Credenciais de login por email
3. [email_verification_codes](#email_verification_codes) - Códigos de verificação de email
4. [addresses](#addresses) - Endereços dos usuários
5. [droptags](#droptags) - Encomendas/pacotes
6. [droptag_authorized_receivers](#droptag_authorized_receivers) - Hubs autorizados por droptag
7. [receiver_docs](#receiver_docs) - Documentos de TooDropers
8. [receiver_doc_validations](#receiver_doc_validations) - Validações individuais de documentos
9. [receiver_point_status](#receiver_point_status) - Status dos pontos de recebimento (Hubs)
10. [schedules](#schedules) - Horários de funcionamento dos Hubs
11. [driver_deliveries](#driver_deliveries) - Entregas do motorista (Dropper)
12. [receiver_deliveries](#receiver_deliveries) - Entregas recebidas pelo Hub (TooDroper)
13. [delivery_scans](#delivery_scans) - Histórico de escaneamentos
14. [delivery_driver_locations](#delivery_driver_locations) - Localização dos motoristas
15. [secret_word_attempts](#secret_word_attempts) - Tentativas de palavra secreta
16. [asaas_charges](#asaas_charges) - Cobranças Asaas
17. [platform_commissions](#platform_commissions) - Comissões da plataforma
18. [user_transactions](#user_transactions) - Transações financeiras dos usuários
19. [saved_cards](#saved_cards) - Cartões salvos dos usuários
20. [withdrawal_requests](#withdrawal_requests) - Solicitações de saque
21. [commission_history](#commission_history) - Histórico de alterações de comissão
22. [admins](#admins) - Administradores do sistema
23. [hub_location_logs](#hub_location_logs) - Logs de localização de Hubs

---

## Relacionamentos (Foreign Keys)

> **Nota:** O banco SQLite/D1 não usa constraints de FK reais, mas estes são os relacionamentos lógicos entre tabelas.

```
users.email_credential_id          → email_credentials.id
addresses.user_id                  → users.id
droptags.consumer_user_id          → users.id
droptags.address_id                → addresses.id
droptags.receiver_user_id          → users.id
receiver_docs.user_id              → users.id
receiver_doc_validations.user_id   → users.id
schedules.user_id                  → users.id
delivery_scans.droptag_id          → droptags.id
delivery_scans.from_user_id        → users.id
delivery_scans.to_user_id          → users.id
admins.user_id                     → users.id
receiver_point_status.receiver_key → addresses.receiver_key (TEXT match)
hub_location_logs.receiver_key     → addresses.receiver_key (TEXT match)
droptag_authorized_receivers.droptag_id    → droptags.id
droptag_authorized_receivers.receiver_key  → addresses.receiver_key (TEXT match)
delivery_driver_locations.user_id  → users.id
driver_deliveries.driver_user_id   → users.id
driver_deliveries.droptag_id       → droptags.id
driver_deliveries.selected_receiver_key → addresses.receiver_key (TEXT match)
receiver_deliveries.receiver_user_id → users.id
receiver_deliveries.droptag_id     → droptags.id
receiver_deliveries.driver_user_id → users.id
secret_word_attempts.droptag_id    → droptags.id
secret_word_attempts.driver_user_id → users.id
commission_history.user_id         → users.id
commission_history.changed_by_user_id → users.id
asaas_charges.droptag_id           → droptags.id
asaas_charges.driver_user_id       → users.id
asaas_charges.receiver_user_id     → users.id
platform_commissions.asaas_charge_id → asaas_charges.id
platform_commissions.droptag_id    → droptags.id
platform_commissions.consumer_user_id → users.id
platform_commissions.driver_user_id → users.id
platform_commissions.receiver_user_id → users.id
saved_cards.user_id                → users.id
user_transactions.user_id          → users.id
user_transactions.related_droptag_id → droptags.id
user_transactions.related_delivery_id → driver_deliveries.id OR receiver_deliveries.id
user_transactions.asaas_charge_id  → asaas_charges.id
withdrawal_requests.user_id        → users.id
withdrawal_requests.processed_by_admin_id → users.id
email_verification_codes.email     → email_credentials.email (TEXT match)
```

---

## Diagrama de Relacionamentos

```
                    ┌─────────────────────┐
                    │  email_credentials  │
                    └──────────┬──────────┘
                               │
                               ▼
┌──────────────┐         ┌─────────┐         ┌─────────────┐
│   addresses  │◄────────│  users  │────────►│   admins    │
└──────┬───────┘         └────┬────┘         └─────────────┘
       │                      │
       │    ┌─────────────────┼─────────────────┐
       │    │                 │                 │
       │    ▼                 ▼                 ▼
       │  ┌──────────┐  ┌─────────────┐  ┌───────────────┐
       │  │ droptags │  │receiver_docs│  │   schedules   │
       │  └────┬─────┘  └─────────────┘  └───────────────┘
       │       │
       │       ├──────────────────────────────────┐
       │       │                                  │
       │       ▼                                  ▼
       │  ┌───────────────────────┐    ┌─────────────────────┐
       │  │ droptag_authorized_   │    │   driver_deliveries │
       │  │      receivers        │    └──────────┬──────────┘
       │  └───────────────────────┘               │
       │                                          │
       │  ┌───────────────────────┐               ▼
       └─►│ receiver_point_status │    ┌─────────────────────┐
          └───────────────────────┘    │ receiver_deliveries │
                                       └──────────┬──────────┘
                                                  │
                                                  ▼
                                       ┌─────────────────────┐
                                       │    asaas_charges    │
                                       └──────────┬──────────┘
                                                  │
                                                  ▼
                                       ┌─────────────────────┐
                                       │ platform_commissions│
                                       └─────────────────────┘
```

---

## CREATE TABLE Statements

### users

Tabela principal de usuários do sistema (Dropper One, Dropper, TooDroper).

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mocha_user_id TEXT NOT NULL UNIQUE,
  email_credential_id INTEGER,
  full_name TEXT,
  email TEXT,
  cpf TEXT UNIQUE,
  birth_date DATE,
  phone TEXT,
  pix_key TEXT,
  profile_status TEXT DEFAULT 'incomplete',
  main_interest TEXT,
  last_active_tab TEXT DEFAULT 'consumer',
  
  -- Perfis ativos
  is_consumer_active BOOLEAN DEFAULT 0,
  is_receiver_pending BOOLEAN DEFAULT 0,
  is_receiver_active BOOLEAN DEFAULT 0,
  is_active BOOLEAN DEFAULT 1,
  
  -- Tours visualizados
  has_seen_consumer_tour BOOLEAN DEFAULT 0,
  has_seen_receiver_tour BOOLEAN DEFAULT 0,
  has_seen_delivery_tour BOOLEAN DEFAULT 0,
  
  -- Asaas
  asaas_wallet_id TEXT,
  asaas_api_key TEXT,
  asaas_account_id TEXT,
  id_customer_asaas TEXT,
  
  -- Comissões
  receiver_commission_percent INTEGER DEFAULT 60,
  driver_commission_percent INTEGER DEFAULT 20,
  platform_commission_percent INTEGER DEFAULT 20,
  balance REAL DEFAULT 0,
  
  -- Endereço para comissões
  commission_cep TEXT,
  commission_street TEXT,
  commission_number TEXT,
  commission_complement TEXT,
  commission_neighborhood TEXT,
  commission_city TEXT,
  commission_state TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Campos importantes:**
- `mocha_user_id`: ID do Google OAuth (ou placeholder para email auth: `email_auth_{id}_{timestamp}`)
- `email_credential_id`: FK para `email_credentials` quando login por email
- `main_interest`: 'consumer' | 'delivery' | 'receiver'
- `profile_status`: 'incomplete' | 'complete'

---

### email_credentials

Credenciais para autenticação por email (alternativa ao Google OAuth).

```sql
CREATE TABLE email_credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  is_verified INTEGER DEFAULT 0,
  failed_attempts INTEGER DEFAULT 0,
  locked_until DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

### email_verification_codes

Códigos de verificação enviados por email (cadastro e recuperação de senha).

```sql
CREATE TABLE email_verification_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  is_used INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

### addresses

Endereços cadastrados pelos usuários (consumidor ou hub).

```sql
CREATE TABLE addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  address_type TEXT DEFAULT 'consumer',
  nickname TEXT NOT NULL,
  receiver_key TEXT,
  cep TEXT NOT NULL,
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  complement TEXT,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Campos importantes:**
- `address_type`: 'consumer' | 'receiver'
- `receiver_key`: Código único do hub (ex: "ABC123"), gerado apenas para type='receiver'

---

### droptags

Encomendas/pacotes criados pelos consumidores (Dropper One).

```sql
CREATE TABLE droptags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT NOT NULL UNIQUE,
  consumer_user_id INTEGER NOT NULL,
  address_id INTEGER,
  receiver_user_id INTEGER,
  title TEXT,
  tracking_code TEXT NOT NULL,
  secret_word TEXT,
  notes TEXT,
  status TEXT DEFAULT 'created',
  qr_code_data TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Campos importantes:**
- `status`: 'created' | 'in_transit' | 'awaiting_pickup' | 'picked_up' | 'completed'
- `uuid`: UUID único para identificação externa
- `qr_code_data`: JSON com dados do QR code

---

### droptag_authorized_receivers

Hubs autorizados pelo consumidor para receber uma droptag.

```sql
CREATE TABLE droptag_authorized_receivers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  droptag_id INTEGER NOT NULL,
  receiver_key TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### receiver_docs

Documentos enviados pelos TooDropers para aprovação.

```sql
CREATE TABLE receiver_docs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  id_document_url TEXT NOT NULL,
  id_document_back_url TEXT,
  selfie_url TEXT NOT NULL,
  address_proof_url TEXT NOT NULL,
  address_proof_type TEXT,
  status TEXT DEFAULT 'pending',
  review_notes TEXT,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Campos importantes:**
- `status`: 'pending' | 'approved' | 'rejected'

---

### receiver_doc_validations

Validações individuais de cada tipo de documento (fluxo assíncrono com n8n).

```sql
CREATE TABLE receiver_doc_validations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  doc_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  rejection_reason TEXT,
  validated_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Campos importantes:**
- `doc_type`: 'id_front' | 'id_back' | 'selfie' | 'address_proof'
- `status`: 'pending' | 'approved' | 'rejected'

---

### receiver_point_status

Status e localização dos pontos de recebimento (Hubs).

```sql
CREATE TABLE receiver_point_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receiver_key TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT 0,
  active_hub BOOLEAN DEFAULT 0,
  latitude REAL,
  longitude REAL,
  last_ping DATETIME,
  service_price REAL DEFAULT 10.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Campos importantes:**
- `is_active`: Hub aprovado pela admin
- `active_hub`: Hub online/disponível no momento
- `service_price`: Preço do serviço em R$

---

### schedules

Horários de funcionamento dos Hubs.

```sql
CREATE TABLE schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL,
  range1_start TEXT,
  range1_end TEXT,
  range2_start TEXT,
  range2_end TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Campos importantes:**
- `day_of_week`: 0 = Domingo, 1 = Segunda, ..., 6 = Sábado

---

### driver_deliveries

Entregas em andamento pelo motorista (Dropper).

```sql
CREATE TABLE driver_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  driver_user_id INTEGER NOT NULL,
  droptag_id INTEGER NOT NULL,
  selected_receiver_key TEXT,
  status TEXT DEFAULT 'in_transit',
  sub_status TEXT,
  service_price REAL,
  commission_percent INTEGER,
  commission_amount REAL,
  wrong_receiver_scan_at DATETIME,
  picked_up_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  delivered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Campos importantes:**
- `status`: 'in_transit' | 'delivered'
- `sub_status`: 'qr_generated' | 'at_receiver' | 'awaiting_secret_word' | 'awaiting_commission' | NULL

---

### receiver_deliveries

Entregas recebidas pelo Hub (TooDroper).

```sql
CREATE TABLE receiver_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receiver_user_id INTEGER NOT NULL,
  droptag_id INTEGER NOT NULL,
  driver_user_id INTEGER NOT NULL,
  status TEXT DEFAULT 'awaiting_pickup',
  sub_status TEXT,
  service_price REAL,
  commission_percent INTEGER,
  commission_amount REAL,
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  picked_up_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Campos importantes:**
- `status`: 'awaiting_pickup' | 'at_receiver' | 'picked_up'
- `sub_status`: 'awaiting_commission' | NULL

---

### delivery_scans

Histórico de todos os escaneamentos de entregas.

```sql
CREATE TABLE delivery_scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  droptag_id INTEGER NOT NULL,
  scan_type TEXT NOT NULL,
  from_user_type TEXT NOT NULL,
  to_user_type TEXT NOT NULL,
  from_user_id INTEGER,
  to_user_id INTEGER,
  photo_url TEXT,
  latitude REAL,
  longitude REAL,
  scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### delivery_driver_locations

Última localização conhecida dos motoristas.

```sql
CREATE TABLE delivery_driver_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### secret_word_attempts

Controle de tentativas de palavra secreta (anti-brute-force).

```sql
CREATE TABLE secret_word_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  droptag_id INTEGER NOT NULL,
  driver_user_id INTEGER NOT NULL,
  failed_attempts INTEGER DEFAULT 0,
  last_attempt_at DATETIME,
  blocked_until DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### asaas_charges

Cobranças criadas no Asaas (PIX e cartão de crédito).

```sql
CREATE TABLE asaas_charges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  droptag_id INTEGER NOT NULL,
  asaas_payment_id TEXT,
  billing_type TEXT NOT NULL,
  value REAL NOT NULL,
  status TEXT DEFAULT 'pending',
  due_date DATE NOT NULL,
  description TEXT,
  pix_qr_code TEXT,
  pix_copy_paste TEXT,
  invoice_url TEXT,
  driver_user_id INTEGER,
  receiver_user_id INTEGER,
  driver_commission_percent INTEGER,
  receiver_commission_percent INTEGER,
  platform_commission_percent INTEGER,
  paid_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Campos importantes:**
- `billing_type`: 'PIX' | 'CREDIT_CARD'
- `status`: 'pending' | 'confirmed' | 'received' | 'overdue' | 'refunded'

---

### platform_commissions

Registro de comissões distribuídas após pagamento.

```sql
CREATE TABLE platform_commissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asaas_charge_id INTEGER,
  droptag_id INTEGER,
  consumer_user_id INTEGER,
  driver_user_id INTEGER,
  receiver_user_id INTEGER,
  total_value REAL NOT NULL,
  driver_commission_percent REAL,
  driver_commission_amount REAL,
  receiver_commission_percent REAL,
  receiver_commission_amount REAL,
  platform_commission_percent REAL,
  platform_commission_amount REAL,
  asaas_payment_id TEXT,
  paid_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

### user_transactions

Transações financeiras dos usuários (comissões, saques).

```sql
CREATE TABLE user_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  balance_after REAL,
  description TEXT,
  related_droptag_id INTEGER,
  related_delivery_id INTEGER,
  asaas_charge_id INTEGER,
  status TEXT DEFAULT 'completed',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Campos importantes:**
- `type`: 'commission_received' | 'withdrawal_requested' | 'withdrawal_completed' | 'withdrawal_rejected'
- `status`: 'pending' | 'confirmed' | 'completed' | 'cancelled'

---

### saved_cards

Cartões de crédito salvos dos usuários (tokenizados no Asaas).

```sql
CREATE TABLE saved_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  card_token TEXT NOT NULL,
  card_brand TEXT NOT NULL,
  card_last_digits TEXT NOT NULL,
  is_default BOOLEAN DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### withdrawal_requests

Solicitações de saque dos usuários.

```sql
CREATE TABLE withdrawal_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  pix_key TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  admin_notes TEXT,
  processed_by_admin_id INTEGER,
  processed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Campos importantes:**
- `status`: 'pending' | 'approved' | 'rejected'

---

### commission_history

Histórico de alterações de comissão feitas por admin.

```sql
CREATE TABLE commission_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  changed_by_user_id INTEGER NOT NULL,
  receiver_commission_percent INTEGER NOT NULL,
  driver_commission_percent INTEGER NOT NULL,
  platform_commission_percent INTEGER NOT NULL,
  service_price REAL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### admins

Usuários com permissões administrativas.

```sql
CREATE TABLE admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### hub_location_logs

Logs de requisições de localização de Hubs (debug/auditoria).

```sql
CREATE TABLE hub_location_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receiver_key TEXT NOT NULL,
  request_latitude REAL,
  request_longitude REAL,
  request_timestamp TEXT,
  response_success BOOLEAN,
  response_active BOOLEAN,
  response_distance INTEGER,
  response_message TEXT,
  response_status_code INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Notas para Migração

1. **Ordem de criação:** Criar tabelas na ordem apresentada neste documento respeitará as dependências.

2. **SQLite/D1 não suporta:**
   - Foreign key constraints (usar validação na aplicação)
   - Check constraints
   - Triggers
   - Enums (usar TEXT com validação na aplicação)

3. **Booleans:** SQLite armazena booleans como INTEGER (0/1).

4. **Timestamps:** Usar DATETIME ou TIMESTAMP, SQLite trata ambos como TEXT.

5. **receiver_key:** É uma chave de texto única gerada para cada endereço de hub. Funciona como FK lógica entre várias tabelas.

6. **Autenticação:** O sistema suporta dois métodos:
   - Google OAuth (via Mocha): `mocha_user_id` contém o ID real
   - Email/Senha: `mocha_user_id` contém placeholder, `email_credential_id` aponta para `email_credentials`

---

*Documento gerado em: 2025*
*Versão do banco: TooDrop v4*
