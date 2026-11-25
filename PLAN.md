# Confere — plano de construção

Aprovado por Bruno em 25/11/2026. Projeto solo para o Hack Brasil 2026, trilha 6 (Cibersegurança).
Este arquivo é a especificação. Quem executa (Claude Code, Opus) planeja as etapas a partir dele e não muda o escopo sem avisar.

## 1. O produto em uma frase

Um site público em que a pessoa informa quem pretende pagar, cola um Pix copia e cola, digita a linha de um boleto ou envia o print da tela de confirmação do banco, e recebe um de três vereditos com a evidência: **confere**, **não confere** ou **não consegui confirmar**.

Pergunta única que o produto responde: para quem vai este dinheiro, e é quem deveria ser?

### Para quem
Pessoa que vai pagar com calma: boleto recebido por e-mail ou WhatsApp, compra em loja ou de vendedor, cobrança de serviço.

### O que o Confere não é
- Não é detector genérico de mensagem de golpe (o WhatsApp e o Android já fazem aviso nativo).
- Não cobre golpe por ligação sob pressão (falsa central). Não prometer isso em lugar nenhum.
- Não faz a devolução do dinheiro (existe o botão de contestar dos bancos e o SOS Golpe).
- Nunca diz "seguro" nem "pode pagar". "Confere" significa só: bate com o que a pessoa informou.

## 2. Regras do hackathon que mandam no código

Conferidas em 25/11/2026 nas páginas oficiais. Fonte: https://hackbrasil.com/regulamento

- Entrega até **30/11/2026 às 23h59** pelo painel do time. Meta interna: enviar até 18h.
- Todo o código nasce em **repositório público novo**, criado depois de 04/11 às 21h. Sem fork, sem histórico importado.
- O repositório fica público até pelo menos 15/12. **Nenhum commit depois de 30/11 às 23h59.**
- Entregáveis: nome, frase e descrição; trilha; link do repositório; **link da demo no ar** durante a avaliação; **vídeo de até 3 minutos, sem login**, mostrando o produto funcionando.
- Critérios, peso igual, 0 a 10 cada: execução técnica, implementação técnica, impacto, comunicação. Corte: 20 de 40.
- **Desclassifica:** demo que exponha dados pessoais reais de terceiros. Só dados sintéticos no repositório, na demo e no vídeo.
- Trilha 6 aceita detecção de fraude e ferramentas de proteção. Fica de fora qualquer ferramenta para invadir ou espionar.

## 3. Entregável mínimo e ordem de corte

Mínimo que precisa existir, nesta ordem de prioridade:

1. Pix copia e cola: leitura, comparação e veredito.
2. Boleto por linha digitada: leitura, checagens e veredito.
3. Site publicado, com botões de casos de exemplo sintéticos para o jurado testar.
4. Página do placar: acerto no conjunto sintético, por categoria.

Se faltar tempo, cortar nesta ordem: denúncia de um toque, relógio dos 80 dias, registro no aparelho, leitura de boleto em imagem, leitura de print.

## 4. Arquitetura

Uma linguagem só: TypeScript.

```
core/     núcleo puro, sem IA e sem rede: leitores, validadores, regras de veredito
casos/    conjunto sintético com gabarito (JSON)
web/      React + Vite, tela única, celular primeiro
worker/   Cloudflare Worker: serve o site e três rotas de API
```

Decisões que não se deduzem do código:

- **O veredito é determinístico.** Só o `core/` decide. A IA nunca decide; ela só transforma imagem em campos.
- **Nada pessoal fica no servidor.** Leitura de Pix e de boleto roda no navegador. Imagem enviada é processada em memória e descartada.
- **Sem banco de dados e sem login.** O registro das conferências fica no aparelho (localStorage).
- **Toda resposta mostra a evidência:** o que foi lido, o que foi comparado e por que deu aquele veredito.

Rotas do Worker:

- `POST /api/ler-imagem`: recebe imagem, devolve campos em JSON (modelo de visão).
- `GET /api/cnpj/:cnpj`: consulta pública de CNPJ, com cache.
- `POST /api/pix-dinamico`: busca o conteúdo de um Pix dinâmico no endereço que vem no código.

## 5. Especificação do núcleo

As regras abaixo foram testadas em 25/11 só com dados sintéticos montados pelas mesmas regras. Isso prova coerência interna, não compatibilidade com o mundo real. **Na etapa 2, confirmar cada formato na fonte oficial e validar com um boleto e um Pix reais do Bruno, fora do repositório.**

### 5.1 Pix copia e cola

Formato de campos encadeados: 2 dígitos de identificador, 2 dígitos de tamanho, valor.

| Campo | Conteúdo |
|---|---|
| 00 | versão, "01" |
| 26 | conta do recebedor, com subcampos: 00 = "br.gov.bcb.pix"; 01 = chave (Pix estático); 25 = endereço do conteúdo (Pix dinâmico) |
| 54 | valor (opcional) |
| 59 | nome do recebedor (até 25 caracteres, pode vir cortado) |
| 60 | cidade |
| 62 | dados adicionais; subcampo 05 = identificador da transação |
| 63 | verificação: CRC16 (polinômio 0x1021, valor inicial 0xFFFF) sobre todo o texto até "6304", inclusive |

Extrair: verificação íntegra ou não, nome, cidade, valor, chave e tipo da chave (CPF, CNPJ, e-mail, telefone, aleatória), endereço dinâmico se houver.
Confirmar na fonte: Manual de Padrões para Iniciação do Pix, do Banco Central.

### 5.2 Boleto

Linha de **47 dígitos** (cobrança bancária). Linha de 48 dígitos começando com 8 é conta de consumo ou tributo: fora do mínimo, responder "não consegui confirmar".

- Posições 1 a 3: código do banco. Posição 4: moeda (9).
- Três primeiros blocos terminam com dígito verificador em módulo 10.
- Dígito verificador geral em módulo 11 sobre os 43 dígitos do código de barras; resultado 0, 10 ou 11 vira 1.
- Últimos 14 dígitos: 4 do fator de vencimento e 10 do valor em centavos.
- Fator de vencimento: reiniciou em 1000 no dia 22/02/2025. Fator 0000 = sem vencimento. Valor zerado = sem valor fixo.

Extrair: banco, vencimento, valor, validade dos dígitos. **A linha não traz o nome do recebedor.**
Confirmar na fonte: especificação do boleto da FEBRABAN e lista de códigos de banco do Banco Central.

### 5.3 CNPJ

- Validar os dois dígitos verificadores.
- Desde julho de 2026 existem CNPJs com letras. Confirmar a regra de cálculo na Receita Federal e aceitar os dois formatos.
- Consulta pública (situação cadastral, data de abertura, nome): escolher a fonte na etapa 2, conferindo disponibilidade e termos de uso. Se a consulta falhar, o veredito é "não consegui confirmar", nunca "confere".

### 5.4 Comparação com quem a pessoa pretende pagar

Entrada da pessoa: nome da empresa ou da pessoa e, se souber, o CNPJ.

- Normalizar: maiúsculas, sem acento, sem "LTDA", "S.A.", "ME", "EIRELI" e pontuação.
- O nome no Pix pode vir cortado em 25 caracteres: aceitar prefixo.
- Se a pessoa deu o CNPJ e a chave é um CNPJ, a comparação é exata.

### 5.5 Regras de veredito

**Não confere** quando qualquer uma for verdadeira:
- o código falha na verificação;
- o recebedor lido é claramente diferente do informado;
- a pessoa disse que paga uma empresa e a chave é um CPF;
- o banco, o valor ou o vencimento lidos divergem do que está impresso ou do que a pessoa informou.

**Confere** só quando tudo for verdadeiro: código íntegro, recebedor bate por nome ou CNPJ, nenhum sinal acima.

**Não consegui confirmar** em todo o resto, incluindo:
- boleto só com a linha (não há nome para comparar). Nesse caso a resposta orienta: "Na tela do seu banco, antes de confirmar, o nome tem de ser X. Envie o print para eu conferir.";
- Pix dinâmico cujo conteúdo não pôde ser buscado;
- consulta de CNPJ indisponível.

### 5.6 Print da tela de confirmação

O modelo de visão devolve só campos: nome do recebedor, documento mascarado, instituição, valor. A tela mostra os campos para a pessoa corrigir antes da comparação. Depois vale a regra 5.5. A imagem não é guardada.

## 6. Conjunto sintético (`casos/`)

Quarenta casos em JSON, todos inventados. Cada caso tem: entrada, quem a pessoa pretende pagar, veredito esperado e motivo.

| Categoria | Casos |
|---|---|
| Pix legítimo | 8 |
| Pix com recebedor trocado | 8 |
| Pix adulterado ou malformado | 4 |
| Boleto legítimo | 6 |
| Boleto com banco, valor ou vencimento divergente | 8 |
| Casos em que a resposta certa é "não consegui confirmar" | 6 |

- Empresas e pessoas fictícias. Nos testes, a consulta de CNPJ é simulada.
- O mesmo conjunto alimenta os testes automáticos e a página do placar.
- A página do placar diz com todas as letras que o conjunto é sintético e foi criado pelo time.

## 7. Interface

- Uma tela. Primeiro campo: "Quem você pretende pagar?". Depois, três entradas: colar o Pix, digitar a linha do boleto, enviar o print.
- Resultado em um cartão: veredito em uma palavra no topo, depois a evidência em lista curta.
- Botões "testar com um exemplo" que carregam casos sintéticos.
- Texto simples, sem jargão. Funciona com uma mão, no celular.

## 8. Etapas

| # | Quando | O que | Como saber que terminou |
|---|---|---|---|
| 1 | 25/11 | Repositório público novo e rascunho no painel | Link do repositório; rascunho enviado |
| 2 | 26/11 | `core/` e `casos/` | Testes passando nos 40 casos; formatos confirmados na fonte; um boleto e um Pix reais validados localmente |
| 3 | 27/11 | `web/` com Pix e boleto por texto, publicado | Link público abre no celular e resolve os exemplos |
| 4 | 28/11 | Leitura de print e de boleto em imagem; cartão com CNPJ | Três prints sintéticos de bancos diferentes lidos corretamente |
| 5 | 29/11 manhã | Registro no aparelho, relógio dos 80 dias, denúncia de um toque (só gera o texto) | Cortável; cada item funciona nos exemplos |
| 6 | 29/11 tarde | Teste com três pessoas, correções, página do placar | Lista do que travou e do que foi corrigido |
| 7 | 30/11 até 18h | Vídeo de 3 minutos, texto da submissão, envio | Submissão enviada; nenhum commit depois |

## 9. Riscos

1. **Formato real diferente do sintético.** Mitigação: confirmar na fonte e validar com dados reais na etapa 2, antes de construir a tela.
2. **Leitura de print falhar.** Mitigação: fica por último, com campos editáveis; o mínimo não depende dela.
3. **Dado pessoal real aparecer na demo.** Mitigação: só casos sintéticos; nada salvo no servidor; revisar o vídeo antes de enviar.
4. **Veredito errado gerar dano.** Mitigação: três estados, "confere" só com tudo batendo, e nunca a palavra "seguro".

## 10. Ainda não verificado

- Os formatos do Pix, do boleto e do CNPJ foram escritos de memória e testados só em dados sintéticos.
- Fonte pública de consulta de CNPJ: disponibilidade e termos.
- Se o conteúdo de um Pix dinâmico pode ser buscado pelo servidor.
- Qualidade do modelo de visão gratuito da Cloudflare para ler prints em português. Se for ruim, trocar por um modelo com chave do Bruno.

## 11. Fora do escopo

WhatsApp, login, cadastro de empresas, banco de dados, qualquer coleta automática de dados de terceiros.
