# Guia de Migração para Produção

Este documento descreve os passos necessários para migrar o app Toodrop de ambiente de desenvolvimento (sandbox) para produção.

## 1. Asaas - Migração de Sandbox para Produção

### 1.1 Criar Conta de Produção no Asaas
1. Acesse https://www.asaas.com
2. Crie uma conta de produção (diferente da conta sandbox)
3. Complete o processo de cadastro e verificação da empresa

### 1.2 Obter API Key de Produção
1. No painel do Asaas de produção, vá em **Integrações > API**
2. Gere uma nova API Key
3. Guarde essa chave em local seguro

### 1.3 Configurar Webhooks de Produção
1. No painel do Asaas de produção, vá em **Integrações > Webhooks**
2. Configure os webhooks para apontar para:
   - URL: `https://tdv4.mocha.app/api/payments/webhook`
   - Eventos: Payment Confirmed, Payment Received

### 1.4 Atualizar Código do App

**Passo 1: Atualizar a URL base do Asaas**

Nos arquivos que fazem chamadas para a API do Asaas, mudar de:
```
https://sandbox.asaas.com/api/v3
```
para:
```
https://www.asaas.com/api/v3
```

Arquivos que precisam ser atualizados:
- `src/worker/routes/payments.ts`
- `src/worker/routes/profile.ts`
- `src/worker/routes/admin.ts`

**Passo 2: Atualizar a API Key**

No Mocha, atualizar o secret `ASAAS_API_KEY` com a nova chave de produção.

### 1.5 Validações Importantes

Antes de publicar:
- [ ] Confirmar que a URL base está apontando para www.asaas.com
- [ ] Confirmar que a API Key de produção está configurada
- [ ] Confirmar que os webhooks estão configurados para a URL de produção
- [ ] Testar um pagamento pequeno em produção para validar todo o fluxo

## 2. Banco de Dados

### 2.1 Dados de Desenvolvimento vs Produção

**IMPORTANTE**: O banco de dados de desenvolvimento (preview) e produção são completamente separados. Quando você publicar:

- As **migrations** serão executadas automaticamente no banco de produção
- Os **dados** não serão copiados (cada ambiente tem seus próprios dados)
- Usuários precisarão se cadastrar novamente em produção

### 2.2 Dados Iniciais (Seed)

Se houver dados que precisam existir em produção desde o início (ex: configurações, categorias), eles devem ser criados através de migrations com INSERT statements.

## 3. Assets e Imagens

Os assets (imagens) já estão no CDN do Mocha e funcionarão automaticamente em produção, pois usam URLs completas.

## 4. Checklist Final de Publicação

Antes de publicar o app em produção:

- [ ] Asaas configurado para produção (URL + API Key)
- [ ] Webhooks do Asaas apontando para URL de produção
- [ ] Testar fluxo completo de pagamento em produção
- [ ] Testar criação de contas de usuário
- [ ] Testar criação de DropTags
- [ ] Testar fluxo de entrega completo
- [ ] Validar cálculo de comissões
- [ ] Testar saques (começar com valores pequenos)

## 5. Monitoramento Pós-Publicação

Após publicar:

1. Monitore logs de erro
2. Acompanhe transações no painel do Asaas
3. Valide que as comissões estão sendo calculadas corretamente
4. Teste com alguns usuários beta antes de divulgação ampla

## 6. Rollback

Se algo der errado após publicar, você pode:
1. Restaurar versão anterior em Mocha → Versions
2. Reverter API Key do Asaas para sandbox (se necessário para debug)

## 7. Observações Importantes

- O Asaas cobra taxas diferentes entre sandbox e produção
- Comissões reais serão cobradas em produção
- Saques em produção movem dinheiro real
- Mantenha backup dos secrets e configurações
