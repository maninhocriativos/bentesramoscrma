

## Melhorias Visuais para o Chat - Plano de Refinamento

### Melhorias Propostas

**1. Sidebar Header - Mais elegante**
- Adicionar um gradiente sutil no header (de `#202C33` para `#1A252C` no dark, de `#F0F2F5` para `#E8EBEE` no light)
- Usar `backdrop-blur` para efeito glassmorphism no header
- Reduzir o tamanho dos botões de ação e agrupá-los com espaçamento mais refinado

**2. Barra de Busca - Mais polida**
- Adicionar `rounded-xl` ao invés de `rounded-lg`
- Ícone de busca com animação de foco (transição de cor)
- Placeholder com texto mais claro e transição suave

**3. Lista de Conversas - Micro-interações**
- Adicionar `transition-all duration-200` com hover que levanta levemente o item (`hover:translate-x-1`)
- Avatar com borda sutil de gradiente no estado online
- Preview de mensagem com ícone de tipo (camera para foto, mic para áudio) antes do texto
- Separador entre conversas mais suave (usar `border-opacity` menor)

**4. Área de Mensagens - Refinamento das bolhas**
- Bolhas com `shadow-sm` mais suave ao invés de `shadow-md`
- Animação de entrada `animate-fade-in` para novas mensagens
- Date labels com design mais refinado (bordas arredondadas maiores, tipografia mais leve)
- Background pattern mais sutil com opacidade reduzida

**5. Input de Mensagem - Mais premium**
- Input com `rounded-2xl` e padding interno maior
- Botão de envio com micro-animação de rotação ao enviar
- Barra de ação (emoji, clip, contato) com hover mais suave e espaçamento uniforme
- Área do input com borda top sutil com gradiente

**6. Empty State - Mais sofisticado**
- Animação `animate-float` no ícone central
- Gradiente de texto no título
- Adicionar ilustração de linhas conectadas estilo "rede de contatos"

**7. Chat Header (conversa aberta) - Mais limpo**
- Status online com animação pulse sutil
- Tags com design mais refinado (sem borda, apenas background com opacidade)
- Separação visual mais clara entre info do contato e botões de ação

### Detalhes Tecnico

Todas as alterações são puramente CSS/Tailwind no arquivo `src/components/manychat/ChatInbox.tsx`, com adição de 2-3 keyframes em `tailwind.config.ts` se necessário. Nenhuma mudança de lógica ou estrutura de dados.

### Arquivos a editar
- `src/components/manychat/ChatInbox.tsx` - Ajustes de classes CSS nas seções do layout
- `src/components/chat/TagFilter.tsx` - Popover com backdrop-blur
- `src/index.css` - Possível adição de utilitários de animação

