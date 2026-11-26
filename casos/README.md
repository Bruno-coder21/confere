# Conjunto sintético do Confere

**Todos os 40 casos são inventados pelo time do Confere.** Nenhum dado pessoal real.

- Empresas, pessoas e endereços são fictícios.
- CNPJs: o exemplo oficial da Receita Federal (`12.ABC.345/01DE-35`) e outros com raiz `ZZ`, montados só para teste.
- CPFs: nenhum CPF válido fica gravado (um CPF válido pode ser de alguém real). Os casos guardam marcadores (`CPF_TESTE_1` a `CPF_TESTE_3`), que `carregar.ts` troca por CPFs sorteados na hora. Casos com CPF têm `demo: false`: ficam só nos testes e no placar, nunca nos botões de exemplo nem no vídeo. A tela sempre mostra CPF mascarado.
- E-mails e endereços de Pix dinâmico usam `example.com`; o único IP é da faixa de documentação (`203.0.113.0/24`).
- A consulta de CNPJ é simulada dentro de cada caso. Nenhum caso chama a consulta real.

## Divisão

| Categoria | Casos | Veredito esperado |
|---|---|---|
| Pix legítimo | 8 | confere |
| Pix com recebedor trocado | 8 | não confere |
| Pix adulterado ou malformado | 4 | não confere |
| Boleto legítimo | 6 | não consegui confirmar (a linha não traz o nome) |
| Boleto com banco, valor ou vencimento divergente | 8 | não confere |
| Casos em que a resposta certa é "não consegui confirmar" | 6 | não consegui confirmar |

## Arquivos

- `definicoes.ts`: os casos em forma legível. Os textos de Pix e as linhas de boleto são montados com CRC e dígitos calculados.
- `casos.json`: gerado por `npm run gerar-casos`. Um teste garante que ninguém editou o arquivo à mão.
- `carregar.ts`: lê `casos.json` e troca os marcadores de CPF por CPFs sorteados.
- `placar.ts`: `npm run placar` imprime o acerto por categoria.

Depois que o gabarito for revisado e fechado, não mude um caso para o teste passar. Caso errado: relatar e corrigir com o Bruno.
