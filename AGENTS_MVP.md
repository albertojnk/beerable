# AGENTS_MVP.md — Protótipo Executável: Marketplace de Pedido Antecipado

> Executar com: `claude --dangerously-skip-permissions`
>
> **Objetivo:** Construir o menor protótipo funcional possível que valide o fluxo completo:
> estabelecimento cadastra produtos → cliente compra via PIX → recebe QR Code → atendente escaneia → produto entregue.
>
> **Critério de sucesso:** Um bar real consegue usar isso hoje. Nada mais, nada menos.

---

## O que o MVP FAZ

- Estabelecimento faz login e cadastra produtos com preço e foto
- Cliente vê o cardápio do estabelecimento no app, monta carrinho e paga via PIX
- Após confirmação do pagamento, cliente recebe um QR Code na tela
- Atendente abre o painel web, escaneia o QR Code com a câmera e entrega o produto
- Pedido marcado como retirado

## O que o MVP NÃO FAZ (deixar para depois)

- ~~Múltiplos estabelecimentos / discovery / geolocalização~~
- ~~Promoções e cupons~~
- ~~Notificações push~~
- ~~WebSocket / tempo real~~
- ~~Pagamento com cartão~~
- ~~Super admin / aprovação de estabelecimentos~~
- ~~Relatórios e dashboard~~
- ~~Gestão de estoque~~
- ~~Múltiplos atendentes / roles~~
- ~~Testes automatizados~~
- ~~Docker multi-stage / deploy~~

---

## Stack

- **Backend:** Go + Gin
- **Banco:** PostgreSQL
- **Mobile:** React Native + Expo (somente Android por ora, evita burocracia da Apple)
- **Web Admin:** React + Vite + TailwindCSS
- **Pagamento:** Pagar.me (apenas PIX)
- **Auth:** JWT simples (HS256, sem refresh token por ora)

---

## Estrutura de Diretórios

```
/
├── api/                        # Backend Go
│   ├── cmd/main.go
│   ├── internal/
│   │   ├── auth/
│   │   ├── catalog/
│   │   ├── order/
│   │   ├── payment/
│   │   └── qrcode/
│   ├── migrations/
│   ├── keys/                   # chaves RSA para assinar QR Code
│   ├── go.mod
│   └── .env
├── web/                        # Painel do estabelecimento
│   ├── src/
│   │   ├── pages/
│   │   └── components/
│   └── package.json
└── mobile/                     # App do cliente
    ├── src/
    │   ├── screens/
    │   └── services/
    └── package.json
```

---

## Banco de Dados — Schema Mínimo

Criar arquivo `api/migrations/001_mvp.sql` com o schema completo abaixo e executar na inicialização.

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Um único estabelecimento no MVP (hardcoded no .env se necessário)
CREATE TABLE establishments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    logo_url TEXT,
    owner_email VARCHAR(255) NOT NULL UNIQUE,
    owner_password_hash VARCHAR(255) NOT NULL,
    pix_key VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    establishment_id UUID NOT NULL REFERENCES establishments(id),
    name VARCHAR(100) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    establishment_id UUID NOT NULL REFERENCES establishments(id),
    category_id UUID REFERENCES categories(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    image_url TEXT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE order_status AS ENUM ('pending_payment', 'paid', 'collected', 'cancelled');

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    establishment_id UUID NOT NULL REFERENCES establishments(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    status order_status NOT NULL DEFAULT 'pending_payment',
    total DECIMAL(10,2) NOT NULL,
    payment_provider_ref VARCHAR(255),
    payment_idempotency_key VARCHAR(255) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    collected_at TIMESTAMPTZ
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id),
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    product_name VARCHAR(255) NOT NULL  -- snapshot do nome no momento da compra
);

CREATE TABLE qr_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL UNIQUE REFERENCES orders(id),
    token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    scanned_at TIMESTAMPTZ,
    is_valid BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Backend Go

### Inicializar projeto

```bash
cd api
go mod init github.com/seuusuario/marketplace-mvp
go get github.com/gin-gonic/gin
go get github.com/gin-contrib/cors
go get github.com/jmoiron/sqlx
go get github.com/lib/pq
go get github.com/golang-jwt/jwt/v5
go get github.com/google/uuid
go get github.com/skip2/go-qrcode
go get golang.org/x/crypto
go get github.com/joho/godotenv
```

### Arquivo `.env`

```
PORT=8080
DB_URL=postgres://postgres:postgres@localhost:5432/marketplace_mvp?sslmode=disable
JWT_SECRET=troque_por_algo_secreto_aqui
PAGARME_API_KEY=sua_chave_sandbox_aqui
PAGARME_WEBHOOK_SECRET=seu_webhook_secret_aqui
QR_EXPIRY_HOURS=24
```

### `cmd/main.go`

- Carregar `.env`
- Conectar ao PostgreSQL
- Executar `001_mvp.sql` se as tabelas não existirem
- Criar router Gin com CORS liberado para desenvolvimento
- Registrar todas as rotas abaixo
- Escutar na porta do `.env`

### Rotas da API

```
# Público
POST /api/auth/establishment/login   → retorna JWT do estabelecimento
POST /api/auth/customer/register
POST /api/auth/customer/login        → retorna JWT do cliente

# Cliente (requer JWT de customer)
GET  /api/establishment/:id/menu     → categorias + produtos disponíveis
POST /api/orders                     → cria pedido + inicia pagamento PIX
GET  /api/orders/:id                 → status do pedido
GET  /api/orders/:id/qrcode          → retorna token JWT do QR Code (só se pago)
GET  /api/orders/my                  → histórico do cliente

# Estabelecimento (requer JWT de establishment)
GET  /api/admin/products             → lista produtos
POST /api/admin/products             → cria produto
PUT  /api/admin/products/:id         → edita produto (nome, preço, disponibilidade)
DELETE /api/admin/products/:id       → remove produto

GET  /api/admin/categories           → lista categorias
POST /api/admin/categories           → cria categoria

GET  /api/admin/orders               → lista pedidos (mais recentes primeiro)
POST /api/admin/qrcode/scan          → body: { token: "..." } → valida e marca como coletado

# Webhook Pagar.me (sem auth, validar assinatura HMAC)
POST /api/webhooks/pagarme
```

### Módulos internos

**`internal/auth/`**

- `jwt.go` — gerar e validar tokens JWT HS256 com `JWT_SECRET`. Claims: `user_id`, `user_type` (`customer` | `establishment`), `exp` (24h).
- `middleware.go` — `RequireCustomer()` e `RequireEstablishment()`: extraem e validam Bearer token.
- `password.go` — `Hash(plain)` e `Check(plain, hash)` com bcrypt custo 10.
- `handler.go` — handlers de login/registro.

**`internal/catalog/`**

- `repository.go` — CRUD de categories e products no PostgreSQL.
- `handler.go` — handlers para as rotas de admin (produtos e categorias).

**`internal/order/`**

- `repository.go` — criar order + order_items em uma transação, buscar por ID, listar por estabelecimento/cliente.
- `service.go` — `CreateOrder(customerID, establishmentID, items []CartItem)`:
  1. Buscar produtos do banco e validar que `is_available = true`
  2. Calcular total
  3. Gerar `payment_idempotency_key` (UUID)
  4. Persistir order com status `pending_payment`
  5. Chamar `payment.CreatePixCharge(order)` e retornar QR Code PIX
- `handler.go` — handlers das rotas de pedido.

**`internal/payment/`**

- `pagarme.go` — fazer POST na API do Pagar.me v5 para criar cobrança PIX. Retornar `{ pix_qr_code, pix_expiration, charge_id }`.
- `webhook.go` — handler do webhook:
  1. Validar assinatura HMAC-SHA256 do header `x-pagarme-signature`
  2. Verificar se `payment_idempotency_key` já foi processado (SELECT no banco) — **não usar Redis no MVP, só o banco mesmo**
  3. Se evento for `charge.paid`: `UPDATE orders SET status='paid', paid_at=NOW() WHERE payment_provider_ref=?`
  4. Chamar `qrcode.Generate(orderID)`

**`internal/qrcode/`**

- Gerar par de chaves RSA na primeira execução e salvar em `api/keys/` se não existirem.
- `generator.go` — `Generate(orderID string) error`:
  1. Montar JWT com claims: `order_id`, `type: "qrcode"`, `exp: now + 24h`, `jti: uuid`
  2. Assinar com RS256 usando chave privada
  3. Inserir em `qr_codes`
- `validator.go` — `Scan(token string) (*Order, error)`:
  1. Validar assinatura JWT com chave pública
  2. Buscar `qr_codes` onde `order_id = claims.order_id AND is_valid = true`
  3. Verificar `expires_at`
  4. Em transação: `UPDATE qr_codes SET is_valid=false, scanned_at=NOW()` + `UPDATE orders SET status='collected', collected_at=NOW()`
  5. Retornar dados do pedido para o atendente exibir na tela

---

## Web Admin (Painel do Estabelecimento)

### Setup

```bash
cd web
npm create vite@latest . -- --template react-ts
npm install tailwindcss @tailwindcss/vite
npm install react-router-dom axios
npm install lucide-react
npm install @zxing/library   # câmera para escanear QR Code
```

### Páginas (4 no total)

**`/login`**

Formulário simples: email + senha. Chama `POST /api/auth/establishment/login`. Salva JWT no `localStorage`. Redireciona para `/orders`.

**`/orders`**

Lista de pedidos do estabelecimento, ordenados por mais recente. Cada item mostra: número do pedido (últimos 8 chars do UUID), itens resumidos, valor total, status com badge colorido (`pending_payment` = cinza, `paid` = amarelo, `collected` = verde). Botão "Atualizar" para recarregar a lista. **Sem WebSocket no MVP — o atendente atualiza manualmente.**

**`/scanner`**

Componente de câmera usando `@zxing/library`. Ao decodificar um QR Code:
1. Chama `POST /api/admin/qrcode/scan` com o token
2. Se sucesso: fundo verde, exibe nome do cliente e itens do pedido por 3 segundos
3. Se erro (expirado, já usado, inválido): fundo vermelho, exibe mensagem de erro
4. Volta ao estado de leitura automaticamente

**`/products`**

Lista de produtos com toggle de disponibilidade (liga/desliga). Botão "Novo Produto" abre modal com campos: nome, descrição, preço, URL da imagem, categoria. Salva via `POST /api/admin/products`.

### Componente `PrivateRoute`

Verifica se tem JWT no `localStorage`. Se não tiver, redireciona para `/login`.

---

## Mobile (App do Cliente)

### Setup

```bash
cd mobile
npx create-expo-app . --template blank-typescript
npx expo install expo-router expo-secure-store
npm install axios
npm install nativewind
```

### Telas (6 no total)

**`(auth)/login`** — Email + senha. Salva JWT no `SecureStore`. Redireciona para home.

**`(auth)/register`** — Nome, email, telefone, senha. Chama `POST /api/auth/customer/register`.

**`(app)/index` — Cardápio**

Ao entrar, chamar `GET /api/establishment/{ESTABLISHMENT_ID}/menu` (ID do estabelecimento fixo no `.env` do app para o MVP — sem discovery). Exibir categorias como tabs horizontais no topo. Abaixo, grid ou lista de produtos com foto, nome e preço. Botão "+" adiciona ao carrinho. Badge no ícone do carrinho mostra quantidade.

**`(app)/cart` — Carrinho**

Lista de itens com quantidade (+ e -) e subtotal por item. Total na parte inferior. Botão "Pagar com PIX". Ao tocar, chama `POST /api/orders`. Se sucesso, navega para tela de pagamento PIX.

**`(app)/pix-payment` — Pagamento PIX**

Exibe o QR Code PIX gerado pelo Pagar.me (imagem base64 ou texto para copiar). Instrução: "Abra seu banco e escaneie o QR Code". Polling a cada 3 segundos em `GET /api/orders/:id` verificando se `status === 'paid'`. Quando pago, navega automaticamente para tela do QR Code de retirada. Timeout de 10 minutos — se não pagar, exibe mensagem de expiração.

**`(app)/qrcode` — QR Code de Retirada**

Tela em tela cheia. Fundo escuro. QR Code grande e centralizado (gerado localmente a partir do token JWT retornado por `GET /api/orders/:id/qrcode`). Abaixo do QR: nome do estabelecimento, lista de itens, valor total. Texto de aviso: "Mostre este QR Code para o atendente". Exibir horário de expiração. Manter tela acesa enquanto esta página estiver ativa (`expo-keep-awake`).

**`(app)/orders` — Histórico**

Lista simples de pedidos do cliente (`GET /api/orders/my`). Card com data, itens resumidos, valor e status. Toque em um pedido pago redireciona para tela do QR Code.

### `src/services/api.ts`

Instância do axios com:
- `baseURL` fixo no arquivo (IP da máquina de desenvolvimento ou ngrok URL)
- Interceptor de request: adiciona `Authorization: Bearer <token>` se existir no `SecureStore`
- Em 401: limpar token e redirecionar para login

---

## Ordem de Execução

Execute nesta ordem exata para ter algo funcional o mais rápido possível:

```
1.  Criar estrutura de diretórios
2.  api/migrations/001_mvp.sql
3.  api/.env com variáveis preenchidas
4.  Backend: go.mod + go get nas dependências
5.  Backend: internal/auth/ completo
6.  Backend: cmd/main.go (server + migrations + rotas esqueleto)
7.  Backend: internal/catalog/ (CRUD de produtos)
8.  Backend: internal/order/repository.go e service.go
9.  Backend: internal/payment/pagarme.go (criar cobrança PIX)
10. Backend: internal/qrcode/ (gerar e validar)
11. Backend: internal/payment/webhook.go (confirmar pagamento → gerar QR)
12. Backend: registrar todas as rotas no main.go
13. Testar fluxo completo via curl ou Postman antes de partir pro front
14. Web: setup + TailwindCSS
15. Web: página de login
16. Web: página de pedidos
17. Web: página de scanner QR
18. Web: página de produtos
19. Mobile: setup + expo-router
20. Mobile: telas de auth (login + registro)
21. Mobile: tela de cardápio (busca o menu, exibe produtos)
22. Mobile: carrinho
23. Mobile: pagamento PIX + polling
24. Mobile: tela do QR Code de retirada
25. Mobile: histórico de pedidos
26. Teste de ponta a ponta: registrar cliente → comprar → pagar PIX → mostrar QR → escanear no web → pedido coletado ✓
```

---

## Validação do MVP

O protótipo está pronto quando este fluxo funcionar sem erros:

1. Atendente faz login no painel web
2. Cadastra 3 produtos com preço
3. Cliente instala o app (APK direto ou Expo Go)
4. Cliente registra conta e vê o cardápio
5. Cliente adiciona 2 produtos ao carrinho e finaliza pedido
6. App exibe QR Code PIX → cliente paga no banco
7. App detecta pagamento e exibe QR Code de retirada automaticamente
8. Atendente abre `/scanner` no painel web e aponta câmera para o celular do cliente
9. Painel exibe confirmação verde com os itens do pedido
10. Pedido aparece como "coletado" na lista de pedidos

Se isso funcionar, o MVP está validado.
