# 🔬 CQ Fácil

> Sistema web de Controle de Qualidade para Farmácias de Manipulação Veterinárias e Humanas

[![Deploy on Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=flat&logo=vercel)](https://vercel.com)
[![Vanilla JS](https://img.shields.io/badge/Stack-Vanilla%20JS-F7DF1E?style=flat&logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![IndexedDB](https://img.shields.io/badge/Storage-IndexedDB-4285F4?style=flat&logo=google-chrome)](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
[![Claude AI](https://img.shields.io/badge/AI-Claude%20Haiku-D97706?style=flat)](https://www.anthropic.com)

---

## 📋 Sobre o Projeto

O **CQ Fácil** é um sistema completo de escrituração e controle de qualidade de matérias-primas desenvolvido para farmácias de manipulação. Permite registrar entradas de MP, gerar laudos analíticos, imprimir etiquetas de aprovação/quarentena/reprovado e emitir fichas técnicas para fiscalização — tudo em um único arquivo HTML, sem backend, sem banco de dados externo e sem instalação.

Desenvolvido especificamente para atender às exigências das BPF (Boas Práticas de Fabricação) e legislação sanitária brasileira, com fluxo de trabalho adaptado ao cotidiano de farmácias de manipulação veterinárias.

---

## ✨ Funcionalidades

### 📝 Entrada de Dados
- Formulário completo de entrada de matéria-prima com numeração automática de R.E. por ano
- Busca inteligente em **1.505 substâncias** pré-cadastradas com preenchimento automático de:
  - DCB, CAS, DCI, Sinônimo, Fórmula e Peso Molecular
  - Características organolépticas, Solubilidade, Ponto de Fusão, Densidade, pH
  - Fator de Equivalência/Correção, Teor/Potência, Armazenamento e Referências bibliográficas
- Campos de conformidade: Laudo do Fornecedor, Peso/Volume, Rótulo
- Testes de identificação com coluna de Referência (especificação) e coluna de Resultado obtido
- Resultado final: **✅ Aprovado**, **🟡 Quarentena** ou **❌ Reprovado**
- Classificações para etiqueta: Port. 344, Termossensível, Fotossensível, Higroscópico, Hormônio, Citostático, Antibiótico

### 🔬 Laudos de Análise
- Laudo completo em formato A4 otimizado para impressão
- Cabeçalho com dados do produto e datas em destaque
- Tabela de detalhes da compra em 2 colunas
- Seção de testes de identificação comparando Referência × Resultado obtido × Conformidade
- Resultado final com destaque visual por cor

### 🏷️ Etiquetas
- Seleção múltipla de laudos para impressão em lote
- **Máximo de 8 etiquetas por folha A4** (2 colunas × 4 linhas)
- Controle de quantidade por laudo (ex: RE 001/26 × 3 etiquetas, RE 002/26 × 2 etiquetas)
- Nome da substância em **MAIÚSCULAS** com letras grandes
- Validade destacada em vermelho e negrito
- Fator de Correção em destaque quando diferente de 1
- Etiquetas coloridas conforme resultado: verde (aprovado), amarelo (quarentena), vermelho (reprovado)
- Filtro por ano com busca por produto ou RE

### 📄 Ficha Técnica
- Ficha técnica de matéria-prima para fiscalização sanitária
- Dados completos da substância: identificação, especificações técnicas, armazenamento e referências
- Impressão direta via botão no modal

### 📚 Histórico por Ano
- Abas de ano separadas: `2023 | 2024 | 2025 | 2026 | ...`
- Cada ano carregado sob demanda (sistema leve, sem travar)
- Nova aba criada automaticamente em janeiro de cada ano
- Ordenação decrescente (mais recentes primeiro)
- Busca por produto, R.E. ou fornecedor
- Acesso rápido a laudo e etiqueta de qualquer entrada histórica

### 🤖 Inteligência Artificial (Claude AI)
Três funcionalidades de IA via API da Anthropic:

**1. Análise de Laudo do Fornecedor**
- Upload de foto ou PDF do laudo impresso
- Preenchimento automático de: produto, fornecedor, lote, NF, quantidade, datas, origem, DCB, CAS, fator, teor, resultados dos testes e armazenamento

**2. Preenchimento de Referências de Substâncias**
- **📷 Foto/PDF:** análise de laudos, fichas técnicas, bulas e monografias
- **📝 Texto:** cole qualquer texto (farmacopeia, site do fornecedor, pesquisa)
- **🔬 CAS:** informe o número CAS e a IA busca os dados técnicos conhecidos

**3. Custo estimado de uso**
| Uso | Tokens | Custo estimado |
|-----|--------|----------------|
| 1 análise de laudo | ~2.000 | ~US$ 0,002 |
| 50 análises/mês | ~100k | ~US$ 0,10 |
| Uso anual típico | ~1,2M | ~US$ 1,20 |

> ⚠️ Créditos pré-pagos da Anthropic expiram em 1 ano. US$ 5 é suficiente para uso típico de uma farmácia por mais de 2 anos.

### 💾 Backup
- **Backup Completo:** baixa todos os anos + banco de substâncias com data e hora no nome
- **Backup do Ano Atual:** arquivo menor apenas com o ano em curso
- Nomes com timestamp automático: `2026-07-01_14-30_historico_COMPLETO.json`
- Histórico dos últimos 30 backups realizados
- **Indicador visual de backup no cabeçalho:**
  - 🟢 `💾 Backup hoje` / `Ontem`
  - 🟡 `💾 Há X dias` (2–7 dias)
  - 🔴 `⚠️ X dias sem backup` (>7 dias)
- **Backup no Google Drive** (OAuth2): envia automaticamente para pasta configurada na nuvem

### ⚙️ Gerenciar Substâncias
- Editar qualquer substância do banco (embutidas ou adicionadas)
  - Alterações em substâncias embutidas salvas como sobrescrita (override)
  - Botão "↺ Restaurar original" para desfazer edições
- Adicionar novas substâncias com formulário completo (17 campos)
- Importar banco de substâncias via JSON
- Exportar banco atual

---

## 🏗️ Arquitetura

```
index.html (único arquivo ~600KB)
├── <style>          CSS com variáveis, gradientes e responsive
├── <script> #1      Banco de 1.505 substâncias (JSON embutido, ~495KB)
└── <script> #2      Toda a lógica da aplicação (~80KB)
```

### Armazenamento — IndexedDB

```
IndexedDB: cq_farmacia (v1)
├── entries    KeyPath: id | Index: by_ano
│              Armazena todos os laudos, organizados por ano
├── config     Key-value: apiKey, driveToken, backupLog, overrides...
└── userdb     KeyPath: c | Substâncias adicionadas pelo usuário
```

**Por que IndexedDB e não localStorage?**

O `localStorage` tem limite de 5–10MB por domínio. Com o histórico crescendo (~800 bytes/entrada × milhares de entradas), o limite é atingido e as gravações falham silenciosamente — dados parecem salvar mas somem ao fechar o browser. O IndexedDB não tem limite prático (centenas de MB) e resolve definitivamente o problema.

**Migração automática:** ao abrir pela primeira vez após atualização, o sistema detecta dados no `localStorage`, migra tudo para IndexedDB e limpa o localStorage automaticamente.

---

## 🚀 Instalação e Deploy

### Pré-requisitos
- Conta gratuita no [Vercel](https://vercel.com) (ou qualquer host estático)
- Navegador moderno (Chrome, Edge, Firefox, Safari)

### Deploy no Vercel (5 minutos)

1. Acesse [vercel.com](https://vercel.com) e faça login com Google
2. Clique em **Add New → Project**
3. Arraste o arquivo `index.html` para a área de upload
4. Clique em **Deploy**
5. Acesse o endereço gerado (ex: `cq-facil.vercel.app`)

### Deploy em outra plataforma

O `index.html` é um arquivo estático puro. Funciona em qualquer servidor ou CDN:

```bash
# Netlify Drop
# Arraste o arquivo em app.netlify.com/drop

# GitHub Pages
# Coloque index.html na raiz do repositório e ative Pages

# Servidor local (teste)
python3 -m http.server 8080
# Acesse http://localhost:8080
```

---

## 📥 Importação do Histórico Existente

### Converter planilhas Excel para JSON

Use o script `conversor_cq.py` incluído no repositório:

```bash
# 1. Instale as dependências
pip install pandas openpyxl xlrd

# 2. Coloque o script na mesma pasta das planilhas Excel
# 3. Execute
python3 conversor_cq.py
```

O script detecta automaticamente os arquivos `.xlsx` e `.xls`, lê a aba de "Registro de Entradas" de cada ano e gera um único `historico_cq.json` pronto para importar.

**Estrutura esperada das planilhas:**

| Coluna | Campo |
|--------|-------|
| 0 | R.E. |
| 1 | Ano |
| 2 | Data de Entrada (Fracionamento) |
| 3 | Código |
| 4 | Descrição (Substância) |
| 5 | Fornecedor |
| 6 | Lote |
| 7 | Nota Fiscal |
| 8 | Quantidade |
| 9 | Data de Fabricação |
| 10 | Data de Validade |
| 11 | Origem |
| 12 | DCB |
| 13 | CAS |
| 14 | Fator |
| 15 | Armazenamento |
| 16 | Temperatura |
| 17 | Densidade |
| 18 | Teor |

### Importar no sistema

1. Abra o CQ Fácil no navegador
2. Vá em **⚙️ Gerenciar → Importar/Exportar**
3. Clique em **📂 Selecionar arquivo de histórico**
4. Selecione o `historico_cq.json` gerado
5. Entradas anteriores a 2023 são ignoradas automaticamente

> ⚠️ Repita a importação em cada computador que for usar o sistema (os dados ficam armazenados localmente no IndexedDB de cada browser).

---

## ☁️ Configurar Backup no Google Drive

### 1. Criar projeto no Google Cloud
1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um novo projeto (ex: `CQ Facil`)

### 2. Ativar API do Drive
1. APIs e Serviços → Biblioteca
2. Pesquise **Google Drive API** → Ativar

### 3. Configurar OAuth
1. APIs e Serviços → Tela de consentimento OAuth → **Externo**
2. Preencha nome do app e e-mail de suporte
3. Adicione usuários de teste (e-mails que vão usar o backup)

### 4. Criar credencial
1. APIs e Serviços → Credenciais → **Criar credenciais → ID do cliente OAuth 2.0**
2. Tipo: **Aplicativo da Web**
3. Origens JavaScript autorizadas: `https://seu-projeto.vercel.app`
4. URIs de redirecionamento: `https://seu-projeto.vercel.app`
5. Copie o **Client ID**

### 5. Conectar no sistema
1. CQ Fácil → **⚙️ Gerenciar → 💾 Backup**
2. Clique em **Conectar Google Drive**
3. Cole o Client ID quando solicitado
4. Faça login com sua conta Google

> ℹ️ O sistema só tem permissão para criar arquivos na pasta configurada. Nenhum outro dado do Drive é acessado.

---

## 🤖 Configurar IA (opcional)

### Obter chave de API

1. Acesse [console.anthropic.com](https://console.anthropic.com)
2. Crie uma conta e adicione créditos (US$ 5 é suficiente para anos de uso)
3. API Keys → **Create Key**
4. Copie a chave (começa com `sk-ant-`)

### Configurar no sistema

1. CQ Fácil → **📝 Nova Entrada**
2. Clique em **🤖 Analisar laudo com IA**
3. Cole a chave de API e clique em **Salvar Chave**

A chave fica salva no IndexedDB local e não precisa ser inserida novamente.

### Modelos utilizados
| Função | Modelo | Motivo |
|--------|--------|--------|
| Análise de laudo (foto/PDF) | `claude-haiku-4-5` | Rápido, barato, excelente OCR |
| Extração de dados de substâncias | `claude-haiku-4-5` | Suficiente para dados estruturados |

---

## 🔄 Rotina de Backup Recomendada

| Frequência | Ação |
|------------|------|
| **Diária** | Backup automático no Google Drive (configure uma vez) |
| **Semanal** | Backup Completo local (💾 Backup → Backup Completo) |
| **Mensal** | Arquivar backup em pasta com mês/ano |
| **Ao trocar de computador** | Exportar histórico → importar no novo computador |

### Estrutura sugerida de pastas

```
Backups_CQ/
├── 2025/
│   ├── 2025-01-06_09-00_historico_COMPLETO.json
│   └── 2025-01-06_09-00_substancias_cq.json
└── 2026/
    ├── 2026-07-01_13-00_historico_COMPLETO.json
    └── 2026-07-01_13-00_substancias_cq.json
```

---

## 🏢 Implantação em múltiplas farmácias

Cada farmácia deve ter seu **próprio projeto no Vercel** (gratuito) com dados independentes:

```
cq-farmacia-a.vercel.app   →  IndexedDB próprio, dados da Farmácia A
cq-farmacia-b.vercel.app   →  IndexedDB próprio, dados da Farmácia B
```

**Para implantar em uma nova farmácia:**
1. Criar novo projeto no Vercel com o mesmo `index.html`
2. Rodar `conversor_cq.py` nas planilhas históricas da farmácia
3. Importar o JSON gerado no novo sistema
4. Importar `substancias_cq.json` com o banco de substâncias

---

## 📁 Estrutura do Repositório

```
cq-facil/
├── index.html              # Aplicação completa (único arquivo necessário)
├── conversor_cq.py         # Script de conversão de planilhas Excel para JSON
├── README.md               # Esta documentação
└── exemplos/
    ├── historico_cq.json   # Exemplo de arquivo de histórico para importação
    └── substancias_cq.json # Exemplo de banco de substâncias para importação
```

---

## 🧰 Stack Tecnológica

| Componente | Tecnologia | Motivo da escolha |
|------------|-----------|-------------------|
| Frontend | HTML + CSS + Vanilla JS | Zero dependências, deploy trivial |
| Armazenamento | IndexedDB (browser) | Sem limite prático, offline-first |
| IA | Anthropic Claude Haiku API | Melhor custo-benefício para OCR/extração |
| Backup nuvem | Google Drive API (OAuth2) | Gratuito, familiar aos usuários |
| Deploy | Vercel (free tier) | Drag-and-drop, HTTPS automático |
| Impressão | CSS @media print | Sem dependências de PDF |
| Favicon | SVG inline (base64) | Sem arquivo externo |

---

## 🐛 Solução de Problemas

### Sistema mostra "Carregando..." indefinidamente
- Abra o DevTools (F12) → Console e verifique se há erros
- Tente limpar o cache: `Ctrl+Shift+R`
- Verifique se o browser suporta IndexedDB (todos os browsers modernos suportam)

### Dados sumiram após atualizar o arquivo no Vercel
- Os dados ficam no IndexedDB do browser, não no servidor — não são afetados por atualizações
- Se realmente sumiram, verifique se o cache foi limpo acidentalmente
- Restaure o backup mais recente em ⚙️ Gerenciar → Importar/Exportar

### Erro "Sessão expirada" ao fazer backup no Drive
- Tokens OAuth do Google expiram em ~1 hora
- Clique em "Conectar Google Drive" novamente para renovar

### A IA retornou dados incorretos
- A IA pode errar em laudos com layout incomum ou baixa qualidade de foto
- Sempre revise os campos antes de salvar
- Fotos com boa iluminação e em foco têm melhor precisão

### "App não verificado" ao conectar o Google Drive
- Normal para apps em modo de teste (uso interno)
- Clique em **Avançado → Acessar [nome do app] (não seguro)**

### Backup local não funciona (nada acontece ao clicar)
- Verifique se o browser não está bloqueando downloads automáticos
- Tente: Configurações do browser → Privacidade → Downloads → Permitir

---

## 📊 Capacidade e Limites

| Item | Limite |
|------|--------|
| Entradas por ano | Ilimitado (IndexedDB) |
| Anos de histórico | Ilimitado |
| Substâncias no banco embutido | 1.505 |
| Substâncias personalizadas | Ilimitado |
| Etiquetas por folha A4 | 8 |
| Laudos por lote de etiquetas | 8 |
| Tamanho máximo do histórico importado | Sem limite fixo (avisa se >2MB) |

---

## 📜 Contexto Regulatório

O sistema foi desenvolvido para auxiliar no cumprimento de:

- **RDC 67/2007** — Boas Práticas de Manipulação de Preparações Magistrais e Oficinais para Uso Humano
- **RDC 87/2008** — Complementa a RDC 67/2007
- **RDC 204/2017** — Boas Práticas de Manipulação Veterinária
- **Port. 344/1998 e atualizações** — Controle de substâncias sujeitas a controle especial

> ⚠️ Este sistema é uma ferramenta de auxílio ao controle de qualidade. A responsabilidade técnica e legal pelo processo de CQ é do Farmacêutico Responsável Técnico.

---

## 🤝 Contribuição

Sugestões, correções e melhorias são bem-vindas. Abra uma *issue* descrevendo o problema ou melhoria desejada.

**Áreas prioritárias para evolução futura:**
- [ ] Migração para banco de dados na nuvem (Supabase) para acesso multi-dispositivo
- [ ] Busca global em todos os anos simultâneos
- [ ] Atualização automática do banco de substâncias via PubChem/ANVISA
- [ ] Modo de entrada rápida com campos essenciais
- [ ] Atalhos de teclado (`Ctrl+S`, `Ctrl+N`, `Esc`)

---

## 👤 Autor

Desenvolvido por **Paulo Edson Fernandes** — CRF-GO 9303  
Farmacêutico Responsável Técnico · Fórmula Animal e Farmacelle · Anápolis, GO

---

## 📄 Licença

Este projeto é de uso privado. Todos os direitos reservados.

---

*CQ Fácil — Controle de Qualidade simplificado para farmácias de manipulação*
