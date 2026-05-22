# Regras de Validação de Documentos - Pontos de Recebimento

## Fluxo de Cadastro de Ponto de Recebimento

### 1. Envio de Documentos
O usuário deve enviar 3 documentos obrigatórios:
- **Documento de identificação** (RG, CNH, etc.) - frente e verso opcional
- **Selfie** - foto do rosto para validação facial
- **Comprovante de endereço** - conta de luz, água, etc.

### 2. Validação Automática (n8n)
Cada documento é enviado para o n8n para validação automática via OCR:
- Documento de identificação → endpoint `documento_identificacao` (e `documento_identificacao_verso` se tiver verso)
- Selfie → endpoint separado para validação facial
- Comprovante de endereço → endpoint `comprovante_endereco`

O n8n retorna aprovação ou rejeição via webhook com URLs de callback:
- `approve_url` - marca o documento como aprovado
- `reject_url` - marca o documento como rejeitado

### 3. Status do Cadastro

| Status | Condição | Cor | Descrição |
|--------|----------|-----|-----------|
| **Em análise** | `status = pending` e sem validações | Âmbar | Documentos ainda não foram validados |
| **Aguardando aprovação** | `status = pending` e `all_docs_validated = true` | Azul | Todos os 3 docs validados pelo n8n, aguardando admin |
| **Aguardando ação** | `status = pending` e tem `review_notes` | Âmbar | Admin solicitou correções, usuário pode reenviar |
| **Aprovado** | `status = approved` | Verde | Admin aprovou, ponto ativo |
| **Rejeitado** | `status = rejected` | Vermelho | Admin rejeitou definitivamente |

### 4. Prioridade de Status no Frontend
1. `all_docs_validated = true` → sempre mostra "Aguardando aprovação"
2. `review_notes` presente → mostra "Aguardando ação" (apenas se não validado)
3. Sem nenhum → mostra "Em análise"

### 5. Ações do Admin

#### Aprovar
- Define `status = approved`
- Ativa o usuário como receptor (`is_receiver_active = 1`)
- Ativa o ponto de recebimento

#### Colocar em Pendente (solicitar correções)
- Define `status = pending` com `review_notes`
- **Limpa todas as validações de documentos** (usuário precisa reenviar)
- Desativa o ponto de recebimento
- Usuário vê "Aguardando ação" e pode atualizar documentos

#### Rejeitar
- Define `status = rejected` com motivo
- Desativa permanentemente
- Usuário não pode reenviar documentos

### 6. Bloqueios de Edição/Exclusão de Endereço

O usuário **NÃO pode** editar ou excluir o endereço quando:
- Status = "Em análise" (documentos sendo processados)
- Status = "Aguardando aprovação" (validado, aguardando admin)
- Status = "Rejeitado"
- Ponto está ativo

O usuário **PODE** editar ou excluir quando:
- Status = "Aguardando ação" (admin solicitou correções)

### 7. Tabelas Envolvidas

- `users` - flags `is_receiver_pending` e `is_receiver_active`
- `receiver_docs` - status geral, URLs dos documentos, `review_notes`
- `receiver_doc_validations` - status individual de cada documento validado pelo n8n
- `addresses` - endereço do ponto de recebimento
- `receiver_point_status` - status operacional do ponto (ativo/inativo, hub)

### 8. Cálculo de `all_docs_validated`

Retorna `true` quando existem 3 documentos aprovados na tabela `receiver_doc_validations`:
- `id_document` (obrigatório)
- `selfie` (obrigatório)
- `address_proof` (obrigatório)
- `id_document_back` (opcional, não conta para validação)

```sql
SELECT * FROM receiver_doc_validations WHERE user_id = ?
-- Filtra apenas os 3 obrigatórios
-- Verifica se todos têm status = 'approved'
```
