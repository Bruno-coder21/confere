# Confere

## O que é
Site público que responde "para quem vai este dinheiro, e é quem deveria ser?" antes de a pessoa pagar um Pix ou um boleto. Devolve um de três vereditos com a evidência: confere, não confere ou não consegui confirmar.
Projeto solo do Bruno para o Hack Brasil 2026, trilha Cibersegurança. "Pronto" é: demo no ar, vídeo de 3 minutos e submissão enviada até 30/11/2026 às 18h (limite oficial: 23h59).

## De quem é o código
This codebase is yours: what it's for and how it's built are your call, and you'll keep building on it.

## Comandos
Projeto ainda sem código. Definir na etapa 2 e trocar "a confirmar" pelo comando testado.
- Instalar: `npm install` (a confirmar)
- Rodar local: `npm run dev` (a confirmar)
- Testes: `npm test` (a confirmar; rodar antes de dizer que terminou)
- Build/lint: `npm run build` (a confirmar)
- Publicar: Cloudflare Workers (a confirmar; só com o ok do Bruno)

## Stack e decisões
- TypeScript em tudo: `core/` (núcleo puro), `casos/` (conjunto sintético), `web/` (React + Vite), `worker/` (Cloudflare Worker).
- O veredito é determinístico e sai só do `core/`. A IA nunca decide; ela só transforma imagem em campos.
- Nada pessoal fica no servidor. Sem banco de dados e sem login; o registro fica no aparelho.
- Três estados, nunca a palavra "seguro". "Confere" só quando tudo bate; na dúvida, "não consegui confirmar".
- Toda resposta mostra a evidência do que foi lido e comparado.

## Regras que não podem ser quebradas
- Só dados sintéticos no repositório, na demo e no vídeo. Dado pessoal real de terceiros desclassifica.
- Repositório público e novo. Sem fork e sem histórico importado.
- Nenhum commit depois de 30/11/2026 às 23h59.
- Não fazer push, publicar nem enviar nada a terceiros sem o ok do Bruno.
- Não comprar, assinar nem pagar nada.

## Não mexer
- `casos/` depois que o gabarito estiver fechado — mudar o gabarito para o teste passar esconde erro. Caso errado: relatar e corrigir com o Bruno.

## Fontes
- Regras e prazo: https://hackbrasil.com/regulamento
- Plano atual: PLAN.md
