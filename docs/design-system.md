# Sistema de Design - TooDrop

Este documento define os padrões visuais e de interação para modais, telas fullscreen e componentes de interface do TooDrop.

## Princípios de Design

- **Limpeza Visual**: Interfaces claras com hierarquia bem definida
- **Consistência**: Mesmo padrão de cores, espaçamentos e transições em todo o app
- **Feedback Imediato**: Usuário sempre sabe o estado da ação (loading, sucesso, erro)
- **Mobile-First**: Design responsivo priorizando experiência mobile

---

## 1. Modais de Alerta

Usados para feedback ao usuário sobre ações completadas ou erros. Sempre centralizado na tela com backdrop escurecido.

### Tipos

#### Sucesso (success)
```tsx
<AlertModal
  isOpen={true}
  onClose={() => setShowAlert(false)}
  title="Sucesso!"
  message="Sua ação foi completada com sucesso."
  type="success"
  confirmText="OK"
/>
```

**Características:**
- Ícone: `CheckCircle` verde (green-600)
- Fundo do ícone: `bg-green-50 border-green-200`
- Texto: neutro escuro (neutral-900/neutral-600)

#### Erro (error)
```tsx
<AlertModal
  isOpen={true}
  onClose={() => setShowAlert(false)}
  title="Erro"
  message="Não foi possível completar a ação."
  type="error"
  confirmText="Entendi"
/>
```

**Características:**
- Ícone: `AlertCircle` vermelho (red-600)
- Fundo do ícone: `bg-red-50 border-red-200`

#### Aviso (warning)
```tsx
<AlertModal
  isOpen={true}
  onClose={() => setShowAlert(false)}
  title="Atenção"
  message="Esta ação é irreversível."
  type="warning"
  confirmText="Continuar"
  cancelText="Cancelar"
/>
```

**Características:**
- Ícone: `AlertTriangle` âmbar (amber-600)
- Fundo do ícone: `bg-amber-50 border-amber-200`

#### Informação (info)
```tsx
<AlertModal
  isOpen={true}
  onClose={() => setShowAlert(false)}
  title="Informação"
  message="Aqui está uma informação importante."
  type="info"
  confirmText="OK"
/>
```

**Características:**
- Ícone: `Info` azul (blue-600)
- Fundo do ícone: `bg-blue-50 border-blue-200`

### Especificações Técnicas

```tsx
// Estrutura do Modal de Alerta
<Portal>
  <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[200] backdrop-blur-sm">
    <div className="bg-white rounded-3xl shadow-strong w-full max-w-md">
      <div className="p-8">
        {/* Botão X no topo direito */}
        <div className="flex justify-end mb-4">
          <button className="text-neutral-400 hover:text-neutral-600">
            <X className="w-6 h-6" strokeWidth={2} />
          </button>
        </div>

        {/* Conteúdo centralizado */}
        <div className="text-center">
          {/* Ícone com fundo colorido */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6 border-2 {colorClasses}">
            {icon}
          </div>

          {/* Título */}
          <h2 className="text-2xl font-bold text-neutral-900 mb-4 tracking-tight">
            {title}
          </h2>

          {/* Mensagem */}
          <p className="text-neutral-600 mb-8 leading-relaxed whitespace-pre-line">
            {message}
          </p>

          {/* Botões de ação */}
          <div className="flex gap-3">
            {cancelText && (
              <button className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 active:scale-95">
                {cancelText}
              </button>
            )}
            <button className="flex-1 bg-action-600 hover:bg-action-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 shadow-sm active:scale-95">
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</Portal>
```

**Tokens de Cor:**
- Backdrop: `bg-black bg-opacity-60 backdrop-blur-sm`
- Modal: `bg-white rounded-3xl shadow-strong`
- Botão primário: `bg-action-600 hover:bg-action-700`
- Botão secundário: `bg-neutral-100 hover:bg-neutral-200`
- Z-index: `z-[200]`

---

## 2. Modais de Confirmação

Usado quando precisa confirmação do usuário antes de executar uma ação (deletar, cancelar, etc).

```tsx
<AlertModal
  isOpen={showDeleteConfirm}
  onClose={() => setShowDeleteConfirm(false)}
  title="Confirmar Exclusão"
  message="Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita."
  type="warning"
  confirmText="Sim, excluir"
  cancelText="Cancelar"
  onConfirm={handleDelete}
/>
```

**Boas Práticas:**
- Sempre usar `type="warning"` para ações destrutivas
- Incluir `cancelText` para dar opção de voltar
- Mensagem deve explicar consequências da ação
- Texto do botão deve ser claro sobre o que vai acontecer

---

## 3. Modais de Dados (Formulários)

Modais que coletam informações do usuário através de formulários.

### Estrutura Base

```tsx
<Portal>
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
    <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="p-6 border-b-2 border-neutral-200 sticky top-0 bg-white">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-neutral-800">Título do Modal</h3>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-neutral-600" />
          </button>
        </div>
      </div>

      {/* Conteúdo/Formulário */}
      <div className="p-6 space-y-4">
        {/* Campos do formulário */}
      </div>

      {/* Footer com ações */}
      <div className="p-6 border-t-2 border-neutral-200 flex gap-3">
        <button 
          onClick={onClose}
          className="flex-1 px-4 py-3 border-2 border-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors font-medium"
        >
          Cancelar
        </button>
        <button 
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Salvando...</span>
            </>
          ) : (
            "Salvar"
          )}
        </button>
      </div>
    </div>
  </div>
</Portal>
```

### Campos de Formulário

**Input de Texto:**
```tsx
<div>
  <label className="block text-sm font-medium text-neutral-700 mb-2">
    Nome do Campo
  </label>
  <input
    type="text"
    value={value}
    onChange={(e) => setValue(e.target.value)}
    placeholder="Digite aqui..."
    className="w-full px-4 py-3 border-2 border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
  />
</div>
```

**Campo com Erro:**
```tsx
<div>
  <label className="block text-sm font-medium text-neutral-700 mb-2">
    CPF
  </label>
  <input
    type="text"
    className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 ${
      error 
        ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
        : 'border-neutral-200 focus:ring-green-500 focus:border-transparent'
    }`}
  />
  {error && (
    <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
      <AlertCircle className="w-4 h-4" />
      {error}
    </p>
  )}
</div>
```

**Mensagem Informativa:**
```tsx
<div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
  <p className="text-blue-800 text-sm font-medium">
    Informação importante sobre este campo
  </p>
</div>
```

---

## 4. Telas Fullscreen (Ocupando Toda Tela)

Padrão usado em ExtractView, ReceiverView, DeliveryView - telas que abrem ocupando toda a viewport.

### Estrutura Base

```tsx
export default function FullScreenView({ onBack }: { onBack?: () => void }) {
  const [isViewAnimating, setIsViewAnimating] = useState(false);

  // Ativar animação após mount
  useEffect(() => {
    setTimeout(() => setIsViewAnimating(true), 10);
  }, []);

  const handleClose = () => {
    setIsViewAnimating(false);
    setTimeout(() => {
      if (onBack) onBack();
    }, 300); // Espera animação terminar
  };

  return (
    <Portal>
      <div 
        className={`fixed inset-0 bg-white z-[150] transition-all duration-300 ${
          isViewAnimating 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 translate-y-4'
        }`}
      >
        {/* Header Fixo */}
        <div className="sticky top-0 bg-white border-b-2 border-neutral-200 z-10">
          <div className="px-4 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-neutral-800">
              Título da Tela
            </h1>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-neutral-600" />
            </button>
          </div>
        </div>

        {/* Conteúdo Scrollável */}
        <div className="overflow-y-auto h-[calc(100vh-73px)]">
          <div className="p-4 space-y-6">
            {/* Conteúdo aqui */}
          </div>
        </div>
      </div>
    </Portal>
  );
}
```

### Especificações

**Animação de Entrada/Saída:**
- Transição: `duration-300`
- Entrada: `opacity-100 translate-y-0`
- Saída: `opacity-0 translate-y-4`
- Delay antes de montar: `10ms`
- Delay antes de desmontar: `300ms` (duração da animação)

**Header Fixo:**
- Sticky: `sticky top-0`
- Fundo: `bg-white`
- Borda inferior: `border-b-2 border-neutral-200`
- Z-index: `z-10` (dentro do container z-[150])
- Padding: `px-4 py-4`

**Conteúdo:**
- Altura: `h-[calc(100vh-73px)]` (viewport - altura do header)
- Scroll: `overflow-y-auto`
- Padding: `p-4`
- Espaçamento: `space-y-6`

**Z-index da Tela:**
- Fullscreen view: `z-[150]`
- Modais dentro: `z-[200]` ou superior

---

## 5. Estados de Loading

### Skeleton Loading (Cards/Listas)

```tsx
{loading ? (
  <div className="space-y-3">
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="bg-neutral-100 rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-neutral-200 rounded w-3/4 mb-3"></div>
        <div className="h-3 bg-neutral-200 rounded w-1/2"></div>
      </div>
    ))}
  </div>
) : (
  // Conteúdo real
)}
```

### Skeleton Loading (Saldo/Valor)

```tsx
{loadingBalance ? (
  <div className="bg-gradient-to-r from-green-100 via-green-50 to-green-100 rounded-2xl p-6 animate-pulse">
    <div className="h-8 bg-green-200/50 rounded w-48 mx-auto"></div>
  </div>
) : (
  <div className="text-3xl font-bold text-green-700">
    {formatCurrency(balance)}
  </div>
)}
```

### Botão com Loading

```tsx
<button
  disabled={isLoading}
  className="px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
>
  {isLoading ? (
    <>
      <Loader2 className="w-5 h-5 animate-spin" />
      <span>Processando...</span>
    </>
  ) : (
    "Confirmar"
  )}
</button>
```

### Tela de Loading Fullscreen

```tsx
<div className="flex flex-col items-center justify-center min-h-screen">
  <Loader2 className="w-12 h-12 text-green-600 animate-spin mb-4" />
  <p className="text-neutral-600">Carregando...</p>
</div>
```

---

## 6. Cards e Containers

### Card Padrão

```tsx
<div className="bg-white rounded-2xl border-2 border-neutral-200 p-4">
  {/* Conteúdo */}
</div>
```

### Card com Shadow

```tsx
<div className="bg-white rounded-2xl shadow-lg p-6">
  {/* Conteúdo */}
</div>
```

### Card Interativo (Clicável)

```tsx
<button className="w-full bg-white rounded-2xl border-2 border-neutral-200 p-4 hover:border-green-500 hover:bg-green-50 transition-all duration-200 text-left active:scale-95">
  {/* Conteúdo */}
</button>
```

### Card de Status

```tsx
{/* Sucesso */}
<div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
  <p className="text-green-800 text-sm font-medium">Operação bem-sucedida</p>
</div>

{/* Erro */}
<div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
  <p className="text-red-800 text-sm font-medium">Erro ao processar</p>
</div>

{/* Aviso */}
<div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
  <p className="text-amber-800 text-sm font-medium">Atenção necessária</p>
</div>

{/* Info */}
<div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
  <p className="text-blue-800 text-sm font-medium">Informação importante</p>
</div>
```

---

## 7. Badges de Status

### Badge Padrão

```tsx
<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700">
  Status
</span>
```

### Badges Coloridos

```tsx
{/* Verde - Sucesso/Ativo */}
<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-300">
  <CheckCircle className="w-3 h-3" />
  Ativo
</span>

{/* Vermelho - Erro/Inativo */}
<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-300">
  <AlertCircle className="w-3 h-3" />
  Inativo
</span>

{/* Amarelo - Pendente */}
<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-300">
  <Loader2 className="w-3 h-3 animate-spin" />
  Pendente
</span>

{/* Azul - Informação */}
<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-300">
  <Info className="w-3 h-3" />
  Em análise
</span>
```

### Badge de Notificação

```tsx
<div className="relative">
  <button className="p-2">
    <Bell className="w-6 h-6" />
  </button>
  {/* Badge vermelho no canto superior direito */}
  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
    3
  </span>
</div>
```

---

## 8. Botões

### Primário (Ação Principal)

```tsx
<button className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors active:scale-95">
  Confirmar
</button>
```

### Secundário (Ação Alternativa)

```tsx
<button className="w-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold py-3 px-6 rounded-lg transition-colors active:scale-95">
  Cancelar
</button>
```

### Outline (Ação Terciária)

```tsx
<button className="w-full border-2 border-neutral-200 text-neutral-700 font-medium py-3 px-6 rounded-lg hover:bg-neutral-50 transition-colors active:scale-95">
  Voltar
</button>
```

### Destrutivo (Deletar/Remover)

```tsx
<button className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors active:scale-95">
  Excluir
</button>
```

### Ícone Only

```tsx
<button className="p-2 hover:bg-neutral-100 rounded-lg transition-colors">
  <Trash2 className="w-5 h-5 text-neutral-600" />
</button>
```

### Desabilitado

```tsx
<button 
  disabled
  className="w-full bg-green-600 text-white font-semibold py-3 px-6 rounded-lg opacity-50 cursor-not-allowed"
>
  Confirmar
</button>
```

---

## 9. Cores do Sistema

### Principais

```css
/* Verde - Ação/Sucesso */
green-50: #f0fdf4
green-100: #dcfce7
green-500: #22c55e
green-600: #16a34a (primary action)
green-700: #15803d (hover)

/* Vermelho - Erro/Destrutivo */
red-50: #fef2f2
red-100: #fee2e2
red-600: #dc2626
red-700: #b91c1c

/* Amarelo - Aviso */
amber-50: #fffbeb
amber-100: #fef3c7
amber-600: #d97706
amber-700: #b45309

/* Azul - Informação */
blue-50: #eff6ff
blue-100: #dbeafe
blue-600: #2563eb
blue-700: #1d4ed8

/* Neutro - Textos/Backgrounds */
neutral-50: #fafafa
neutral-100: #f5f5f5
neutral-200: #e5e5e5
neutral-600: #525252
neutral-700: #404040
neutral-800: #262626
neutral-900: #171717
```

### Uso das Cores

- **Textos principais:** `text-neutral-800` ou `text-neutral-900`
- **Textos secundários:** `text-neutral-600`
- **Borders:** `border-neutral-200`
- **Backgrounds:** `bg-white` ou `bg-neutral-50`
- **Ação primária:** `bg-green-600 hover:bg-green-700`
- **Ação destrutiva:** `bg-red-600 hover:bg-red-700`

---

## 10. Espaçamentos

```css
/* Padding/Margin interno de cards */
p-4: 16px (padrão para cards pequenos)
p-6: 24px (padrão para modais/cards médios)
p-8: 32px (modais grandes/telas importantes)

/* Gaps entre elementos */
gap-2: 8px (ícone + texto)
gap-3: 12px (botões lado a lado)
gap-4: 16px (campos de formulário)
gap-6: 24px (seções)

/* Espaçamento vertical (space-y) */
space-y-3: 12px (lista de cards)
space-y-4: 16px (formulários)
space-y-6: 24px (seções de página)
```

---

## 11. Portal Component

Todos os modais e telas fullscreen devem usar o componente `Portal` para renderizar fora da hierarquia DOM:

```tsx
import { Portal } from "@/react-app/components/Portal";

<Portal>
  <div className="fixed inset-0 ...">
    {/* Conteúdo do modal */}
  </div>
</Portal>
```

Isso garante que os modais não sejam afetados por `transform`, `overflow` ou `z-index` de elementos pais.

---

## 12. Transições e Animações

### Transições Padrão

```css
transition-colors: /* Para hover em botões/links */
transition-all duration-200: /* Para interações rápidas */
transition-all duration-300: /* Para animações de entrada/saída */
```

### Animações

```css
animate-spin: /* Loading spinners */
animate-pulse: /* Skeleton loading */
active:scale-95: /* Feedback de clique em botões */
```

### Exemplo de Transição de Modal

```tsx
const [isOpen, setIsOpen] = useState(false);
const [isAnimating, setIsAnimating] = useState(false);

const handleOpen = () => {
  setIsOpen(true);
  setTimeout(() => setIsAnimating(true), 10);
};

const handleClose = () => {
  setIsAnimating(false);
  setTimeout(() => setIsOpen(false), 300);
};

return isOpen ? (
  <div className={`fixed inset-0 transition-all duration-300 ${
    isAnimating ? 'opacity-100' : 'opacity-0'
  }`}>
    {/* Conteúdo */}
  </div>
) : null;
```

---

## 13. Responsividade

### Breakpoints

```css
/* Mobile-first approach */
sm: 640px  /* Tablet pequeno */
md: 768px  /* Tablet */
lg: 1024px /* Desktop */
xl: 1280px /* Desktop grande */
```

### Padrões Mobile

- Padding lateral: `px-4`
- Modais: `max-w-md` (448px) com `w-full`
- Texto responsivo: usar `text-base` ou `text-lg` no mobile
- Botões: altura mínima de `py-3` para facilitar toque

### Exemplo de Modal Responsivo

```tsx
<div className="fixed inset-0 flex items-center justify-center p-4">
  <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
    {/* Conteúdo scrollável se ultrapassar 90% da altura */}
  </div>
</div>
```

---

## 14. Acessibilidade

### Botão de Fechar (X)

Sempre incluir em modais:

```tsx
<button
  onClick={onClose}
  className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
  aria-label="Fechar"
>
  <X className="w-5 h-5 text-neutral-600" />
</button>
```

### Estados de Formulário

```tsx
<input
  type="text"
  disabled={isLoading}
  aria-invalid={!!error}
  aria-describedby={error ? "error-message" : undefined}
  className="..."
/>
{error && (
  <p id="error-message" className="text-red-600 text-sm mt-1">
    {error}
  </p>
)}
```

### Loading States

```tsx
<button disabled={isLoading} aria-busy={isLoading}>
  {isLoading ? (
    <>
      <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
      <span>Carregando...</span>
    </>
  ) : (
    "Confirmar"
  )}
</button>
```

---

## Checklist de Implementação

Ao criar novos modais ou telas, verificar:

- [ ] Usa componente `Portal`
- [ ] Tem backdrop escurecido (`bg-black/50` ou `bg-black bg-opacity-60`)
- [ ] Tem botão X para fechar (com `aria-label`)
- [ ] Tem animação de entrada/saída (fade + translate)
- [ ] Tem z-index apropriado (200+ para modais, 150 para fullscreen)
- [ ] Botões têm estados de hover e disabled
- [ ] Loading states mostram spinner `Loader2`
- [ ] Formulários têm validação visual (border vermelho + mensagem)
- [ ] Cards de status usam cores semânticas (verde/vermelho/amarelo/azul)
- [ ] Espaçamentos consistentes (p-4/p-6, gap-3/gap-4, space-y-4/space-y-6)
- [ ] Responsivo no mobile (max-w-md, p-4, max-h-[90vh])
- [ ] Transições suaves (duration-200 ou duration-300)

---

**Última atualização:** Janeiro 2025
