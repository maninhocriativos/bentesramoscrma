# Templates Zapsign - PDFs Originais

Coloque os 5 PDFs dos templates aqui:

1. **declaracao-nao-contratacao.pdf** — Declaração de Não Contratação de Empréstimo
2. **declaracao-falso-advogado.pdf** — Declaração de Ciência e Orientação (Falso Advogado)
3. **declaracao-hipossuficiencia.pdf** — Declaração de Hipossuficiência
4. **contrato-honorarios.pdf** — Contrato de Prestação de Serviços e Honorários
5. **procuracao.pdf** — Instrumento de Procuração Ad Judicia Et Extra

## URLs dos templates

Os PDFs são servidos pelo domínio de produção (Netlify), no caminho
`/templates-zapsign/<arquivo>.pdf`. A URL base é resolvida em código por
`assetUrl()` (`src/lib/siteConfig.ts`) — não hardcode o domínio aqui.

Exemplo (relativo à origem do app):
- `/templates-zapsign/declaracao-nao-contratacao.pdf`
- `/templates-zapsign/declaracao-falso-advogado.pdf`
- `/templates-zapsign/declaracao-hipossuficiencia.pdf`
- `/templates-zapsign/contrato-honorarios.pdf`
- `/templates-zapsign/procuracao.pdf`
