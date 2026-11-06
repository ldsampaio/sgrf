# SGRD — Design System Master File (Light Clay)

> **LOGIC:** When building a specific page, first check `design-system/sgrd/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.
>
> **Source of truth em código:** `frontend/src/styles/tokens.css` (implementação) e
> `frontend/src/styles/base.css` (assinaturas de componente). Este documento é a
> especificação legível.

---

**Project:** SGRD — Sistema de Gestão de Recursos Departamentais (SGRF)
**Estilo:** Claymorphism (light, contido — "clay institucional", lúdico-educacional)
**Fonte de inspiração:** design system do SGOA (`design-system/sgoa/MASTER.md`) — mesmo
estilo, aplicado às classes existentes do SGRD
**Stack:** Vue 3 + Vite (SPA), CSS puro tokenizado
**Dials:** Variance 4/10 | Motion 4/10 | Density 6/10
**Última atualização:** 2026-11-03 (revamp aplicado)

---

## 1. Global Rules

### 1.1 Cor — Light Clay (contrastes AA verificados)

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Background (cream) | `#FFF8EE` | `--bg` |
| Surface muted (canvas) | `#F4F1FA` | `--bg-deep` |
| Card | `#FFFFFF` | `--surface` |
| Text (ink) | `#1B1B2F` | `--text` (16.0 : 1 no cream) |
| Text muted | `#5B6270` | `--text-muted` (5.8 : 1) |
| Text soft/hierarquia | `#525866` | `--text-faint` (≥ 6 : 1) |
| Primary | `#4338CA` | `--accent` (indigo; links, valores, foco) |
| Primary strong | `#4F46E5` | `--accent-hover` |
| Primary soft (fundo) | `#EEF2FF` | `--accent-soft` |
| CTA | `#C2410C` | `--cta` (5.2 : 1 branco; botões primários) |
| Brand accent (marca/weave) | `#EA580C` | `--brand` (uso decorativo/tiles apenas) |
| Border (todos os bordões 2–3px) | `#1B1B2F` | `--border` |
| Divider/softline | `#CDC5B8` | `--border-soft` |
| Ring/foco | `#4F46E5` | `--ring` |
| Destructive | `#B91C1C` | `--danger` (6.5 : 1 branco) |
| Success (mint) | `#A7E8C3` | `--success` |

**Tiles pastel** (ícones KPI, avatares, chips, eyebrow — sempre com ink em cima):
`--accent-sky #BFDBFE` · `--accent-amber #FDE68A` · `--accent-lilac #C4B5FD` · `--accent-mint #A7E8C3` · `--neutral-tint #E7E5E4`

**Anti-padrões de cor (proibido):**
- ❌ `#EA580C` como fundo com texto branco (3.56 : 1 — falha AA normal-text). Para CTA use `#C2410C`.
- ❌ Cor como único indicador de estado/status.
- ❌ Hex direto em CSS que não seja `tokens.css` (exceção registrada: paleta JS do PieChart — Chart.js não lê CSS vars).
- ❌ Dark mode nativo (claymorphism light-first).

### 1.2 Status (cor + ícone + rótulo — nunca só cor)

| Status | Token | Ícone |
|---|---|---|
| Rascunho | `--color-status-rascunho` (stone) | `pencil` |
| Em votação | `--color-status-votacao` (sky) | `vote` |
| Aguardando desempate | `--color-status-desempate` (amber) | `scale` |
| Aprovado / Concluído | `--color-status-aprovado` (mint) | `check-circle` / `check` |
| Indeferido | `--color-status-indeferido` (red-700) | `ban` |
| Cancelado | `--color-status-cancelado` (stone) | `close` |
| Suspenso | `--color-status-suspenso` (lilac) | `pause` |

Status fora do mapa conhecido → pílula neutra + ícone `info`.

### 1.3 Tipografia

| Uso | Fonte | Peso | Token |
|---|---|---|---|
| Headings, botões, pílulas, números KPI, eyebrows | **Space Grotesk** | 600–700 | `--font-display` |
| Corpo, formulários, tabelas | **DM Sans** | 400–500 (700 para ênfase) | `--font-sans` |

Carregamento: `<link>` no `index.html` com `preconnect` + `display=swap` (nunca `@import` — render blocking).

### 1.4 Espaçamento / Radios / Sombra

- Ritmo 4/8: `--space-1..10` = 4/8/12/16/20/24/32/40/48/64px. Tiers de seção 16/24/32/48.
- Radii: `--radius-sm 14px` (inputs, alertas) · `--radius-md 20px` (cards, nav) · `--radius-lg 26px` · `--radius-pill` (botões, pílulas, tabs, nav).
- Assinatura clay: `border: 2–3px solid var(--border)`, **double shadow** `inset -2px -2px 6-8px rgba(ink,.04-.06), 3-6px 3-6px 10-16px rgba(ink,.10-.14)`.
- Botões: offset shadow dura `0 4px 0 ink` → no press `translateY(3px)` + `0 1px 0`.
- Touch target mínimo: 44px (`--touch-min-target`).

### 1.5 Movimento

| Início → meio | Redução |
|---|---|
| Foco/hover | `180ms ease-out` |
| Press (squish) | `200ms cubic-bezier(.34,1.56,.64,1)` |
| Entrada (menu, painel, modal) | `220ms` clay |
| Saída | `150ms` (exit faster than enter) |
| Spinner | `0.9s ease-in-out` |

Bounce/clay-easing apenas onde agrega (botões, pílulas, KPIs). **Regra:** transições sem transform de layout; press por `translateY` + sombra. `@media (prefers-reduced-motion: reduce)` obrigatório (`base.css`).

### 1.6 Ícones

- Biblioteca: SVG stroke próprio (`components/Icon.vue`), uma família para todo o app.
- Peso visual `stroke-width 2`; sempre `aria-hidden` em decorativos; rótulo leva a informação. Emoji como ícone é proibido.
- Pílulas de status: ícone 14px junto do rótulo (ver §1.2).

---

## 2. Regras de Componente

| Componente | Assinatura clay |
|---|---|
| `.card` | bg card, border-3 ink, radius-md 20, shadow flat, padding 24 |
| `.btn` | pill, border 2.5px ink, offset shadow `0 4px 0 ink`; primário = CTA orange; press `translateY(3px)` |
| `.input/.select/.textarea` | bg card, border-2 soft → 2px ink no foco + ring indigo .25; radius-sm |
| `.badge` (StatusBadge) | pílula com **ícone + rótulo**, bg tingida por status, border-2 ink |
| `.alert` | flex com ícone; erro = red-100/red-800; sucesso = mint; dica = canvas |
| `.table` | th com bg canvas + uppercase; hairline `border-soft`; hover indigo .06 |
| `.tab/.segment` | pílulas clay; ativa = border ink + primary-soft + shadow hard |
| `.topbar` | **floating clay card** (sticky top 12px), border-3, nav items pill; ativo = primary-soft + border primary. **Teto de largura**: `--content-ceiling`, centralizado — alinha com o conteúdo em vez de esticar até a tela |
| `.page` | coluna central limitada pelo mesmo teto (`--content-ceiling`) — o **teto compartilhado de 1080 px** com sgoa e sgtu, que é a largura total máxima da interface. `--content-max` é o teto menos o padding lateral 2×40 = **1000**; a linha mais larga do dashboard (4 cards + 3 gaps de 20) se reparte por essa coluna. `.page--narrow` (760) e login ficam fora dessa soma |
| `.pilula-flutuante` | pílula CTA fixa, **dentro do teto**: o lado direito encosta na coluna de conteúdo (centro vertical), ícone 24 + rótulo — o ícone nunca é o único portador de informação. Quando a calha esquerda não comporta a pílula (≤1339 px), desce para o canto inferior da coluna, onde não cobre texto. Dimensões de token, sem px cru fora de `@media`; some com o drawer mobile aberto |
| `.eyebrow` | pílula amber com diamante brand; nunca só texto uppercase |
| `.stat` | KPI clay card; ícone em tile pastel rotativo (sky/amber/lilac/mint); número em Space Grotesk |
| `.progress` / `.medidores` | pílula clay `role="meter"`, border-2 ink, fill do token de status; **valor numérico sempre ao lado** (cor nunca é o único portador). Fill usa `:style` dinâmico (percentual de dados) — única exceção aceita a style inline |
| `.auth` | split: hero com trama weave decorativa + `caixa-login` clay + chips pastel |
| `.modal` | cartão clay border-3 ink, scrim ink .5 |

Progress tracking é parte do sistema: Dashboard usa `.medidores` para execução do
exercício e distribuição por status (Dashboard.vue `meters`), sempre com valor textual.

---

## 3. Pre-Delivery Checklist

- [x] Nenhum hex fora de `tokens.css` (exceção registrada: paleta JS do PieChart).
- [x] Contraste ≥ 4.5:1 de texto no light clay.
- [x] Foco visível em todos os controles (`:focus-visible`, ring indigo).
- [x] `prefers-reduced-motion` respeitado (duas coberturas em `base.css`).
- [x] Ícones SVG consistentes; nenhum emoji estrutural.
- [x] States disabled/loading/empty estilizados.
- [ ] Testado visualmente em 375 / 768 / 1024 / 1440 px (breakpoints 767/1023/1000/1339 cobertos estaticamente).

---

## 4. Notas de migração (revamp 2026-11-03)

- **Dark studio → Light Clay:** `tokens.css` reescrito (3 camadas) mantendo os nomes de
  tokens consumidos pelas views (`--space-*`, `--text-*`, `--accent`, `--border-subtle`,
  `--weight-*`); valores remapeados para o clay.
- **StatusBadge:** dot → ícone + rótulo (MAP com `icon` por status).
- **PieChart:** rampa amber → tiles pastel vibrantes; borda ink 3px; tooltip white/ink;
  canvas de exportação PDF branco.
- **Fonts:** Readex Pro → Space Grotesk (display) + DM Sans (body), via `<link>` com
  preconnect.
- **Progress tracking:** nova classe `.medidores` em `base.css` + seção "Execução do
  exercício" no Dashboard com `role="meter"`.
