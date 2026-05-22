# Guia de Design - Modais do Sistema

Este documento define o padrão visual e estrutural dos modais utilizados no TooDrop.

## Estrutura Base

### Container Principal
```tsx
<div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[300] p-4">
  <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
    {/* Conteúdo do modal */}
  </div>
</div>
```

**Especificações:**
- **Backdrop**: Fundo preto com 50% de opacidade (`bg-black/50`) e blur (`backdrop-blur-sm`)
- **Z-index**: `z-[300]` para garantir sobreposição
- **Padding externo**: `p-4` para margem nas bordas da tela
- **Container do modal**: Fundo branco (`bg-white`), cantos arredondados (`rounded-2xl`), sombra forte (`shadow-2xl`)
- **Largura máxima**: `max-w-lg` (512px)
- **Padding interno**: `p-6` (24px)

---

## Header do Modal

### Com Ícone + Título + Botão Fechar
```tsx
<div className="flex items-start justify-between mb-4">
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-neutral-50">
      <Icon className="w-5 h-5 text-neutral-600" strokeWidth={2} />
    </div>
    <h3 className="text-xl font-bold text-neutral-900">
      Título do Modal
    </h3>
  </div>
  <button
    onClick={onClose}
    className="text-neutral-400 hover:text-neutral-600 transition-colors"
  >
    <X className="w-6 h-6" strokeWidth={2} />
  </button>
</div>
```

### Apenas Título + Botão Fechar
```tsx
<div className="flex items-start justify-between mb-4">
  <div>
    <h3 className="text-xl font-bold text-neutral-900">Título do Modal</h3>
    <p className="text-sm text-neutral-500 mt-1">Subtítulo opcional</p>
  </div>
  <button
    onClick={onClose}
    className="text-neutral-400 hover:text-neutral-600 transition-colors"
  >
    <X className="w-6 h-6" strokeWidth={2} />
  </button>
</div>
```

**Especificações:**
- **Ícone**: Container de `10x10` (`w-10 h-10`) com fundo cinza claro (`bg-neutral-50`), cantos arredondados (`rounded-xl`)
- **Ícone interno**: `5x5` (`w-5 h-5`), cor cinza média (`text-neutral-600`), stroke de `2`
- **Título**: Fonte extra grande (`text-xl`), negrito (`font-bold`), cor preta (`text-neutral-900`)
- **Subtítulo**: Fonte pequena (`text-sm`), cor cinza (`text-neutral-500`), margem superior (`mt-1`)
- **Botão fechar**: Ícone X de `6x6`, cor cinza claro (`text-neutral-400`) com hover para cinza médio (`hover:text-neutral-600`)
- **Espaçamento inferior**: `mb-4` (16px)

---

## Área de Conteúdo

### Container de Conteúdo
```tsx
<div className="space-y-4">
  {/* Itens do conteúdo */}
</div>
```

**Especificações:**
- **Espaçamento vertical**: `space-y-4` (16px entre elementos)

### Timeline de Eventos (Estilo Histórico)
```tsx
<div className="space-y-4">
  {items.map((item, index) => (
    <div key={index} className="flex items-start gap-3">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${item.bgColor}`}>
        <item.Icon className={`w-5 h-5 ${item.iconColor}`} strokeWidth={2} />
      </div>
      <div className="flex-1 pt-1">
        <h4 className="font-semibold text-neutral-900">{item.title}</h4>
        <p className="text-sm text-neutral-600 mt-1">{item.description}</p>
        <p className="text-xs text-neutral-400 mt-1">{item.timestamp}</p>
      </div>
    </div>
  ))}
</div>
```

**Especificações:**
- **Ícone**: Container circular (`rounded-full`) de `10x10`, com `flex-shrink-0` para manter tamanho fixo
- **Cores dos ícones**: Variam por tipo de evento (azul, verde, cinza, etc.)
- **Título do item**: Negrito (`font-semibold`), cor preta (`text-neutral-900`)
- **Descrição**: Fonte pequena (`text-sm`), cor cinza média (`text-neutral-600`), margem superior (`mt-1`)
- **Timestamp**: Fonte extra pequena (`text-xs`), cor cinza clara (`text-neutral-400`), margem superior (`mt-1`)

### Cards de Informação
```tsx
<div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-3">
  <div>
    <div className="text-xs text-neutral-500 mb-1">Label</div>
    <div className="font-semibold text-neutral-900">Valor</div>
  </div>
</div>
```

**Especificações:**
- **Container**: Fundo cinza claro (`bg-neutral-50`), borda cinza (`border-neutral-200`), cantos arredondados (`rounded-xl`), padding `p-4`
- **Labels**: Fonte extra pequena (`text-xs`), cor cinza média (`text-neutral-500`), margem inferior (`mb-1`)
- **Valores**: Negrito (`font-semibold`), cor preta (`text-neutral-900`)

### Texto Descritivo
```tsx
<p className="text-neutral-700 leading-relaxed">
  Texto descritivo do modal com espaçamento confortável para leitura.
</p>
```

**Especificações:**
- **Cor**: Cinza escuro (`text-neutral-700`)
- **Espaçamento de linha**: Relaxado (`leading-relaxed`)

---

## Botões

### Botão Primário (Principal)
```tsx
<button className="w-full bg-[#0a4169] hover:bg-[#083554] text-white font-semibold py-3 rounded-xl transition-all duration-200">
  Fechar
</button>
```

**Especificações:**
- **Largura**: Total (`w-full`)
- **Cor de fundo**: Azul escuro `#0a4169` (cor principal do TooDrop)
- **Hover**: Azul mais escuro `#083554`
- **Texto**: Branco (`text-white`), negrito (`font-semibold`)
- **Altura**: Padding vertical `py-3` (12px)
- **Cantos**: Arredondados (`rounded-xl`)
- **Transição**: Suave (`transition-all duration-200`)
- **Margem superior**: Geralmente `mt-6` (24px)

### Botão Secundário
```tsx
<button className="w-full bg-neutral-100 hover:bg-neutral-200 text-neutral-900 font-semibold py-3 rounded-xl transition-all duration-200">
  Cancelar
</button>
```

**Especificações:**
- **Cor de fundo**: Cinza claro (`bg-neutral-100`)
- **Hover**: Cinza médio (`hover:bg-neutral-200`)
- **Texto**: Preto (`text-neutral-900`), negrito (`font-semibold`)
- **Demais propriedades**: Iguais ao botão primário

### Grupo de Botões (Primário + Secundário)
```tsx
<div className="flex gap-3 mt-6">
  <button className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 font-semibold py-3 rounded-xl transition-all duration-200">
    Cancelar
  </button>
  <button className="flex-1 bg-[#0a4169] hover:bg-[#083554] text-white font-semibold py-3 rounded-xl transition-all duration-200">
    Confirmar
  </button>
</div>
```

**Especificações:**
- **Container**: Flex com gap de `gap-3` (12px)
- **Botões**: `flex-1` para largura igual
- **Margem superior**: `mt-6` (24px)

---

## Cores do Sistema

### Cores Principais
- **Azul principal (botões)**: `#0a4169`
- **Azul hover**: `#083554`
- **Branco (fundo)**: `#FFFFFF`
- **Preto (textos)**: `text-neutral-900`

### Cores Neutras (Escalas de Cinza)
- **Neutral 50**: `bg-neutral-50` - Fundos de cards/ícones
- **Neutral 100**: `bg-neutral-100` - Botões secundários
- **Neutral 200**: `border-neutral-200` - Bordas
- **Neutral 400**: `text-neutral-400` - Timestamps, textos terciários
- **Neutral 500**: `text-neutral-500` - Labels, subtítulos
- **Neutral 600**: `text-neutral-600` - Descrições
- **Neutral 700**: `text-neutral-700` - Textos descritivos
- **Neutral 900**: `text-neutral-900` - Títulos, textos principais

### Cores de Status (Ícones)
- **Azul** (`bg-blue-50` + `text-blue-600`): Criação, informação
- **Verde** (`bg-green-50` + `text-green-600`): Sucesso, conclusão, confirmação
- **Amarelo** (`bg-amber-50` + `text-amber-600`): Atenção, pendência
- **Vermelho** (`bg-red-50` + `text-red-600`): Erro, alerta, rejeição
- **Roxo** (`bg-purple-50` + `text-purple-600`): Em andamento, processamento

---

## Ícones

### Biblioteca
- **Lucide React**: Biblioteca padrão de ícones do sistema

### Tamanhos Padrão
- **Ícones em cards/timeline**: `w-5 h-5` (20x20px)
- **Ícones de botão fechar**: `w-6 h-6` (24x24px)
- **Stroke**: `strokeWidth={2}` para consistência

### Container de Ícones
- **Quadrados**: `rounded-xl` (12px de border-radius)
- **Circulares**: `rounded-full`
- **Tamanho padrão**: `w-10 h-10` (40x40px)

---

## Responsividade

### Mobile First
```tsx
<div className="max-w-lg w-full p-4 sm:p-6">
  {/* Mobile: p-4, Desktop: p-6 */}
</div>
```

**Breakpoints:**
- **Padding**: `p-4` (mobile) → `sm:p-6` (desktop 640px+)
- **Largura máxima**: `max-w-lg` (512px) para modais padrão
- **Padding externo**: `p-4` constante para margem nas bordas

---

## Animações e Transições

### Backdrop Fade-in (Opcional)
```tsx
// Com biblioteca de animação ou CSS transitions
<div className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn">
```

### Transições de Botões
```tsx
className="transition-all duration-200"
```

**Especificações:**
- **Propriedade**: `transition-all` (todas as propriedades)
- **Duração**: `duration-200` (200ms)

---

## Boas Práticas

1. **Sempre incluir botão de fechar** (X no canto superior direito)
2. **Backdrop deve fechar o modal** ao clicar fora do conteúdo
3. **Use Portal** para renderizar modais fora da hierarquia de componentes (evita bugs de z-index e transform)
4. **Títulos descritivos**: Seja claro sobre o propósito do modal
5. **Hierarquia visual**: Título > Descrição > Ações
6. **Botão primário à direita** em grupos de botões
7. **Cores consistentes**: Use a paleta definida
8. **Espaçamento generoso**: `space-y-4` no conteúdo, `mt-6` antes dos botões
9. **Textos concisos**: Evite parágrafos longos
10. **Acessibilidade**: Inclua `aria-label` quando necessário

---

## Exemplo Completo

```tsx
import { X, Package } from 'lucide-react';
import Portal from './Portal';

function ExampleModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[300] p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-neutral-50">
                <Package className="w-5 h-5 text-neutral-600" strokeWidth={2} />
              </div>
              <h3 className="text-xl font-bold text-neutral-900">
                Título do Modal
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              <X className="w-6 h-6" strokeWidth={2} />
            </button>
          </div>

          {/* Conteúdo */}
          <div className="space-y-4">
            <p className="text-neutral-700 leading-relaxed">
              Descrição ou conteúdo do modal.
            </p>

            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-3">
              <div>
                <div className="text-xs text-neutral-500 mb-1">Label</div>
                <div className="font-semibold text-neutral-900">Valor</div>
              </div>
            </div>
          </div>

          {/* Botões */}
          <button
            onClick={onClose}
            className="mt-6 w-full bg-[#0a4169] hover:bg-[#083554] text-white font-semibold py-3 rounded-xl transition-all duration-200"
          >
            Fechar
          </button>
        </div>
      </div>
    </Portal>
  );
}
```

---

## Variações Específicas

### Modal de Confirmação
- Ícone de alerta (`AlertCircle`) em amarelo ou vermelho
- Dois botões: Cancelar (secundário) + Confirmar (primário)
- Texto descritivo claro sobre a ação

### Modal de Sucesso
- Ícone de check (`CheckCircle`) em verde
- Um botão: Fechar ou Continuar
- Mensagem positiva e breve

### Modal de Erro
- Ícone de alerta (`AlertCircle`) em vermelho
- Um ou dois botões: Fechar ou Tentar Novamente
- Mensagem clara sobre o problema

### Modal de Informação
- Ícone relevante ao contexto em azul ou cinza
- Conteúdo estruturado (timeline, cards, listas)
- Botão de fechar

---

**Última atualização**: 2025-01-13
