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
│   ├── app.js            # Lógica principal da aplicação
│   ├── database.js       # Integrações com Firebase
│   ├── firebase.js       # Configuração do Firebase
│   └── ui.js             # Componentes de interface e utilidades visuais
├── index.html            # Estrutura principal da interface
├── manifest.json         # Configuração PWA
├── sw.js                 # Service worker
└── vite.config.js       # Configuração do Vite
```

---

## ▶️ Como executar localmente

### 1. Instale as dependências

```bash
npm install
```

### 2. Configure o Firebase

<<<<<<< HEAD
Crie um arquivo chamado `.env` na raiz do projeto e adicione suas credenciais do Firebase. Use o arquivo `.env.example` (se existir) como modelo ou a estrutura abaixo:

```
VITE_FIREBASE_API_KEY="SUA_API_KEY"
VITE_FIREBASE_AUTH_DOMAIN="SEU_AUTH_DOMAIN"
... (e as outras chaves)
```

=======
Edite o arquivo [js/firebase.js](js/firebase.js) e substitua o objeto `firebaseConfig` pelas credenciais do seu projeto no Firebase Console.

> > > > > > > 24d2cb891fc548c14a2e39aedda9bc6f613aead5

Certifique-se de habilitar:

- Authentication
- Firestore Database

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

Unmerged paths:
(use "git add <file>..." to mark resolution)
both modified: README.md
both modified: .gitignore

## 📄 Licença

Desenvolvido para uso interno da COENG. Todos os direitos reservados ao contexto do projeto.
