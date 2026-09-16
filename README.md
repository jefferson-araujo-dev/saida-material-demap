# 📦 Gestão de Materiais | COENG

Aplicação web progressiva (PWA) para controle de saídas de materiais em almoxarifado, com autenticação, painel gerencial, importação/exportação de dados e sincronização em tempo real com Firebase.

---

## ✨ Principais funcionalidades

- Autenticação com e-mail/senha, acesso anônimo e recuperação de senha.
- Gestão de lançamentos com cadastro, edição, baixa e exclusão controlada.
- Painel com cards de resumo, gráficos de barras e estados vazios mais claros quando não há dados.
- Filtros avançados, busca, ordenação e paginação para a tabela de lançamentos.
- Importação de base de materiais e histórico de lançamentos a partir de arquivos Excel/CSV.
- Exportação da visão atual para Excel, incluindo colunas personalizáveis.
- Feedback visual com toasts, loading skeletons e banner de atualização para a PWA.
- Suporte a uso offline através de service worker e manifesto de instalação.

---

## 🛠️ Tecnologias

- HTML, CSS e JavaScript modular
- Tailwind CSS
- Vite
- Firebase Auth e Firestore
- Chart.js
- SheetJS (xlsx)

---

## 📂 Estrutura do projeto

```text
/
├── assets/               # Ícones e favicon
├── css/
│   └── output.css        # CSS gerado pelo Tailwind
├── js/
│   ├── app.js            # Ponto de entrada: liga os módulos e a delegação de eventos
│   ├── auth.js           # Login, logout e perfil do usuário
│   ├── base.js           # Base de materiais (código → nome)
│   ├── dashboard.js      # Cartões-resumo e gráficos do painel
│   ├── database.js       # Integrações com Firebase (Firestore)
│   ├── encarregados.js   # Lista de responsáveis pelas saídas
│   ├── firebase.js       # Configuração do Firebase
│   ├── lancamentos.js    # CRUD, grade, filtros, paginação e exportação
│   ├── modal.js          # Abrir/fechar modal, confirmação e prompt genéricos
│   ├── normalizacao.mjs  # Normalização de dados importados
│   ├── notificacoes.js   # Sino de notificações
│   ├── pwa.js            # Atualização do service worker
│   ├── state.js          # Estado compartilhado entre módulos (usuário, dados atuais)
│   ├── ui.js             # Componentes de interface e utilidades visuais
│   └── utils.js          # Utilitários genéricos (datas, erros do Firebase, debounce)
├── public/
│   ├── sw.js             # Service worker (copiado para dist/ no build)
│   └── manifest.json     # Configuração PWA
├── index.html            # Estrutura principal da interface
├── firestore.rules       # Regras de segurança do Firestore
├── firebase.json         # Configuração de deploy do Firebase CLI
└── vite.config.js        # Configuração do Vite
```

---

## ▶️ Como executar localmente

### 1. Instale as dependências

```bash
npm install
```

### 2. Configure o Firebase

Crie um arquivo chamado `.env.local` na raiz do projeto e adicione as credenciais do seu projeto do Firebase. Este arquivo não será enviado para o repositório.

```
VITE_FIREBASE_API_KEY="SUA_API_KEY"
VITE_FIREBASE_AUTH_DOMAIN="SEU_AUTH_DOMAIN"
VITE_FIREBASE_PROJECT_ID="SEU_PROJECT_ID"
VITE_FIREBASE_STORAGE_BUCKET="SEU_STORAGE_BUCKET"
VITE_FIREBASE_MESSAGING_SENDER_ID="SEU_MESSAGING_SENDER_ID"
VITE_FIREBASE_APP_ID="SEU_APP_ID"
VITE_APP_ID="demap-estoque-app"
```

**Importante:** Para o deploy na Vercel, essas mesmas variáveis devem ser configuradas no painel do projeto em **Settings > Environment Variables**.

Certifique-se de habilitar:

- Authentication
- Firestore Database

### Regras de segurança do Firestore

As regras ficam em `firestore.rules` e **precisam ser publicadas** — sem elas os
dados ficam abertos ou o app perde acesso. Com o [Firebase CLI](https://firebase.google.com/docs/cli):

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules --project SEU_PROJECT_ID
```

Alternativamente, cole o conteúdo de `firestore.rules` no console do Firebase em
**Firestore Database > Regras**.

> As regras filtram o acesso por usuário, mas **não** aplicam o soft-delete: o
> filtro do campo `deleted` é feito no cliente (`js/lancamentos.js`), o que mantém
> visíveis lançamentos antigos criados antes desse campo existir.

### Definir administradores (Custom Claims)

Tanto as regras quanto o `js/auth.js` reconhecem administrador pela claim
`admin: true` no token de ID. Ela é definida com o Firebase Admin SDK (script
Node executado uma vez, com uma chave de conta de serviço):

```js
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert(require("./serviceAccountKey.json")) });

admin
  .auth()
  .getUserByEmail("pessoa@exemplo.com")
  .then((u) => admin.auth().setCustomUserClaims(u.uid, { admin: true }))
  .then(() => console.log("claim definida — o usuário precisa fazer login novamente"));
```

O usuário precisa renovar o token (novo login) para a claim valer.

### Apelidos nos gráficos

Os rótulos dos gráficos usam a primeira palavra do nome do encarregado. Para
exibir apelidos sem colocá-los no código, defina no navegador:

```js
localStorage.setItem(
  "demap_apelidos",
  JSON.stringify({ "trecho do nome": "Apelido", "outro nome": "Outro" }),
);
```

A comparação é feita em minúsculas por `includes`.

### 3. Inicie o ambiente de desenvolvimento

```bash
npm run dev
```

A aplicação ficará disponível no endereço local informado pelo Vite.

---

## 🏗️ Build para produção

```bash
npm run build
```

O build gerará a versão otimizada em `dist/` para publicação.

---

## 📱 PWA

A aplicação está preparada para instalação como app no navegador, com suporte a atualização e uso parcial offline via service worker.

---

## 📄 Licença

Desenvolvido para uso interno da COENG. Todos os direitos reservados ao contexto do projeto.
