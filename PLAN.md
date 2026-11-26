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

Conferido nas fontes oficiais em 25/11/2026 e implementado em `core/` (etapa 2). Cada regra tem teste com o exemplo publicado na fonte. Validado em 26/11/2026 com um Pix e um boleto reais do Bruno, fora do repositório: a leitura do `npm run conferir -- privado/reais.txt` bateu em todos os campos com um leitor independente.

### 5.1 Pix copia e cola

Fontes: BCB, *Manual de Padrões para Iniciação do Pix* versão 2.10.0 (seções 2.5 a 2.8; existe 2.11.0-rc1, não vigente); BCB, *Manual do BR Code* 2.0.1.

Formato de campos encadeados: 2 dígitos de identificador, 2 dígitos de tamanho, valor.

| Campo | Conteúdo |
|---|---|
| 00 | versão, "01" (obrigatório, primeiro campo) |
| 01 | opcional; "12" = código de uso único |
| 26 a 51 | conta Pix, em **qualquer** ID dessa faixa, achada pelo subcampo 00 = "br.gov.bcb.pix" (sem diferenciar maiúsculas). Subcampos: 01 = chave (estático); 02 = texto livre; 03 = ISPB do Pix Saque; 25 = endereço do conteúdo (dinâmico) |
| 52 | categoria, "0000" ou MCC (obrigatório) |
| 53 | moeda, "986" (obrigatório) |
| 54 | valor, até 13 caracteres, ponto decimal (opcional; "0" ou "0.00" = a pessoa digita). **No dinâmico, ignorar**: vale o valor do conteúdo buscado |
| 58 | país, "BR" (obrigatório) |
| 59 | nome, até 25 caracteres, pode vir cortado. **O banco não mostra este nome**: mostra o nome do dono da chave, consultado no DICT. Golpista pode escrever qualquer nome aqui |
| 60 | cidade, até 15 caracteres (obrigatório) |
| 61 | CEP (opcional) |
| 62 | dados adicionais (obrigatório); subcampo 05 = identificador da transação, até 25 caracteres, "***" quando não há |
| 80 a 99 | Pix Automático (QR composto): subcampo 25 = endereço da recorrência |
| 63 | verificação: CRC16 (polinômio 0x1021, valor inicial 0xFFFF) sobre todo o texto até "6304", inclusive; 4 hexadecimais maiúsculos (a leitura aceita minúsculas) |

Chaves: CPF (11 dígitos), CNPJ (14 caracteres, **pode ter letras**), telefone (+55...), e-mail, aleatória (com hífens).

O tamanho de cada campo conta caracteres (Manual do BR Code, seção 2.1). Se o código só fecha contando bytes (nome com acento), a leitura aceita com aviso. Campo ou subcampo repetido torna o código ambíguo: "não confere".

Pix dinâmico: endereço sem "https://", até 77 caracteres, acessado só por HTTPS depois de validado. Resposta assinada (JWS, `application/jose`); só usar depois de verificar a assinatura. Cobrança imediata (`/cob/` ou sem fragmento) traz a chave e o valor, **sem o nome do recebedor**. Cobrança com vencimento (`/cobv/`) traz CPF ou CNPJ, nome e endereço do recebedor. Os dois trazem CPF e nome do devedor: dado pessoal que passa pelo Worker e não pode ser guardado.

### 5.2 Boleto

Fontes: BCB, Carta-Circular 2.926/2000 (leiaute do código de barras e da linha); manual "Código de barras Santander" v36, abril de 2025 (módulo 10 e reinício do fator, com exemplo completo usado nos testes); BCB, lista de participantes do STR (códigos de banco, licença ODbL, retrato em `core/src/bancos.json`).

Linha de **47 dígitos** (cobrança bancária). Linha de 48 dígitos começando com 8 é conta de consumo ou tributo: fora do mínimo, responder "não consegui confirmar".

- Posições 1 a 3: código do banco. Posição 4: moeda (9).
- Três primeiros blocos terminam com dígito verificador em módulo 10.
- Dígito verificador geral em módulo 11 sobre os 43 dígitos do código de barras; resultado 0, 10 ou 11 vira 1.
- Últimos 14 dígitos: 4 do fator de vencimento e 10 do valor em centavos.
- Fator de vencimento: dias desde 07/10/1997; chegou a 9999 em 21/02/2025 e reiniciou em 1000 no dia 22/02/2025. Como o mesmo fator cai nos dois ciclos, vale a data mais perto de hoje. Fator 0000 = sem vencimento. Valor zerado = sem valor fixo.

Extrair: banco, vencimento, valor, validade dos dígitos. **A linha não traz o nome do recebedor.**

### 5.3 CNPJ

Fontes: Receita Federal, perguntas e respostas do CNPJ alfanumérico (pergunta 14); Serpro, cálculo dos dígitos. Primeiro CNPJ alfanumérico emitido em 31/07/2026.

- 12 caracteres (0 a 9 e A a Z maiúsculas) + 2 dígitos numéricos. Cada caractere vale código ASCII − 48; pesos 2 a 9 da direita para a esquerda; resto 0 ou 1 dá 0, senão 11 − resto. A mesma conta serve para o CNPJ numérico.
- O exemplo 1 da pergunta 23 da Receita (AA345678/0003-29) tem dígito errado; o certo é 86. Não usar como teste.
- Consulta pública: Minha Receita (`minhareceita.org/{cnpj}`), com BrasilAPI (`brasilapi.com.br/api/cnpj/v1/{cnpj}`) de reserva. As duas responderam ao CNPJ alfanumérico em 25/11, sem chave de acesso. Nenhuma publica termos de uso nem SLA. A resposta traz sócios, e-mail e telefone: o Worker corta para razão social, nome fantasia, situação e data de início. Se a consulta falhar, o veredito é "não consegui confirmar", nunca "confere".

### 5.4 Comparação com quem a pessoa pretende pagar

Entrada da pessoa: nome da empresa ou da pessoa, se é empresa ou pessoa e, se souber, o CNPJ.

- Normalizar: maiúsculas, sem acento, sem "LTDA", "S.A.", "S/A", "ME", "EPP", "EIRELI", "MEI" e pontuação.
- Nome do campo 59 do Pix: aceitar prefixo (pode vir cortado em 25 caracteres). Serve só para achar nome **claramente diferente**; nunca para dar "confere".
- Nome da consulta pública de CNPJ: tem de ser **igual** à razão social ou ao nome fantasia. Começo parecido não basta (golpista pode abrir empresa com nome que começa igual).
- Se a pessoa deu o CNPJ e a chave é um CNPJ, a comparação é exata.

### 5.5 Regras de veredito

Aprovadas por Bruno em 25/11/2026, depois da conferência nas fontes. Implementadas em `core/src/veredito.ts`.

**Pix — não confere** quando qualquer uma for verdadeira:
- o código falha na verificação, está malformado, não tem conta Pix, tem campo ou subcampo repetido ou tem chave inválida;
- o endereço do Pix dinâmico está fora do padrão do Banco Central;
- a pessoa disse que paga uma empresa e a chave (ou a cobrança) é de CPF;
- o CNPJ da chave é diferente do CNPJ informado;
- a consulta pública ou a cobrança assinada mostra outra empresa, mesmo quando o CNPJ é igual ao informado (a pessoa pode ter copiado o CNPJ da própria cobrança falsa);
- o nome do campo 59 é claramente diferente do informado e também do titular do CNPJ (o código pode trazer a razão social enquanto a pessoa conhece o nome fantasia);
- o valor lido é diferente do informado.

**Pix — confere** só com prova por documento e consulta respondida, sem nenhum sinal acima:
- chave CNPJ igual ao CNPJ informado, empresa ATIVA; ou
- chave CNPJ (ou CNPJ da cobrança com vencimento) cuja consulta traz nome igual ao informado, empresa ATIVA **e aberta há pelo menos 90 dias** (decisão do Bruno, 26/11/2026: golpista pode abrir empresa nova com o nome fantasia de uma loja). Empresa mais nova, ou consulta sem data de abertura, dá "não consegui confirmar" com a data em destaque. Com o CNPJ informado pela pessoa, a idade da empresa não pesa.

Esses sinais valem para todo Pix lido, inclusive dinâmico sem conteúdo e Pix Automático.

**Pix — não consegui confirmar** em todo o resto, incluindo: chave e-mail, telefone, aleatória ou CPF com nome do campo 59 batendo; CNPJ informado com dígito errado; consulta indisponível; situação diferente de ATIVA; nome da consulta só parecido; Pix dinâmico cujo conteúdo não pôde ser buscado; cobrança sem valor ou com situação diferente de ATIVA; Pix Automático.

**Boleto só com a linha — nunca confere.**
- Não confere: dígito de bloco ou dígito geral falha; valor, vencimento ou banco diverge do informado ou do impresso.
- Não consegui confirmar: todo o resto, com banco, vencimento e valor lidos. Código de banco fora da lista do BC entra aqui com alerta (a lista pode estar desatualizada).

Sempre que der "não consegui confirmar", a resposta orienta: "Na tela do seu banco, antes de confirmar, o nome tem de ser X. Envie o print dessa tela para eu conferir."

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
- CPFs e telefones (decisão do Bruno, 26/11/2026): nenhum CPF com dígito válido fica gravado no repositório, porque a Receita não tem faixa de CPF para teste e qualquer CPF válido pode ser de alguém real. Os casos guardam marcadores (`CPF_TESTE_1` a `CPF_TESTE_3`) que `casos/carregar.ts` troca por CPFs sorteados na hora. O único CPF gravado tem dígito inválido de propósito. Telefones de teste usam DDD 00, que não existe. Um teste barra CPF válido ou telefone com DDD real em `core/`, `casos/`, PLAN.md e CLAUDE.md.
- Casos com CPF ficam só nos testes e no placar (`demo: false` em `casos.json`). Botões de exemplo e vídeo usam só casos com `demo: true`. A tela sempre mascara CPF.
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

- Formatos conferidos na fonte em 25/11 e validados com dados reais em 26/11 (§5). Gabarito dos 40 casos ainda sem a revisão do Bruno; até lá, `casos/` não está fechado.
- O reinício do fator do boleto em 22/02/2025 está no manual do Santander e em fontes secundárias; o comunicado da própria FEBRABAN não foi localizado.
- Consulta de CNPJ: Minha Receita e BrasilAPI funcionam hoje, mas não publicam termos de uso nem SLA.
- Pix dinâmico: o Manual de Segurança do SFN (regras da assinatura JWS e do acesso ao endereço) deu 404 no site do BC. Falta saber se o Worker consegue buscar e validar o conteúdo, e se os PSPs aceitam pedidos vindos da Cloudflare. Até isso ser provado na etapa 3, Pix dinâmico real dá "não consegui confirmar".
- Requisito da etapa 3 para a busca do Pix dinâmico: `validarLocation` só checa a forma do endereço. O Worker ainda tem de recusar domínio que resolve para IP privado e não seguir redirecionamento.
- Qualidade do modelo de visão gratuito da Cloudflare para ler prints em português. Se for ruim, trocar por um modelo com chave do Bruno.

## 11. Fora do escopo

WhatsApp, login, cadastro de empresas, banco de dados, qualquer coleta automática de dados de terceiros.
