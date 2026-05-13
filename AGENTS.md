# AGENTS.md — Marketplace de Pedido Antecipado para Bares

> Executar com: `claude --dangerously-skip-permissions`
>
> Este arquivo instrui o agente a construir um marketplace de pedido antecipado estilo iFood,
> onde clientes compram produtos em bares/estabelecimentos via app, recebem um QR Code e
> retiram presencialmente sem enfrentar fila de caixa.

---

## Contexto do Produto

**O que é:** Marketplace onde estabelecimentos (bares, restaurantes, lanchonetes) cadastram
seu cardápio e clientes compram antecipadamente pelo app. Após o pagamento, o cliente recebe
um QR Code que é escaneado pelo atendente no momento da retirada.

**Atores:**
- `super_admin` — dono da plataforma (vocês), aprova estabelecimentos, vê métricas
- `establishment` — dono/gerente do bar, cadastra produtos, vê pedidos, escaneia QR
- `staff` — atendente do bar, escaneia QR Code
- `customer` — cliente final, compra pelo app mobile

**Fluxo principal:**
1. Cliente descobre estabelecimentos próximos no app
2. Abre cardápio → monta carrinho → aplica promoção opcional
3. Paga via PIX ou cartão (Pagar.me)
4. Webhook confirma pagamento → backend gera QR Code (JWT RS256)
5. Cliente chega no bar → mostra QR Code na tela do celular
6. Atendente escaneia pelo painel web → entrega o produto

---

## Stack Obrigatória

- **Backend:** Go (Gin framework)
- **Banco:** PostgreSQL + extensão PostGIS para geolocalização
- **Cache:** Redis
- **Mobile:** React Native com Expo
- **Web Admin:** React + Vite + TailwindCSS
- **Pagamento:** Pagar.me (PIX prioritário)
- **Auth:** JWT (RS256) + Refresh Token
- **QR Code:** JWT RS256 assinado com chave privada
- **Containerização:** Docker + docker-compose

---

## Estrutura de Diretórios a Criar

```
/
├── services/
│   └── api/                    # Backend Go
│       ├── cmd/api/
│       │   └── main.go
│       ├── internal/
│       │   ├── auth/
│       │   ├── establishment/
│       │   ├── catalog/
│       │   ├── order/
│       │   ├── payment/
│       │   ├── qrcode/
│       │   ├── notification/
│       │   ├── staff/
│       │   └── admin/
│       ├── pkg/
│       │   ├── database/
│       │   ├── redis/
│       │   ├── logger/
│       │   └── validator/
│       ├── migrations/
│       ├── Dockerfile
│       ├── go.mod
│       └── go.sum
├── apps/
│   ├── web/                    # React Web Admin
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── store/
│   │   ├── Dockerfile
│   │   └── package.json
│   └── mobile/                 # React Native Expo
│       ├── src/
│       │   ├── screens/
│       │   ├── components/
│       │   ├── hooks/
│       │   ├── services/
│       │   └── store/
│       └── package.json
├── docker-compose.yml
└── README.md
```

---

## Passo 1 — Setup Inicial do Projeto

1. Criar a estrutura de diretórios completa acima
2. Criar `docker-compose.yml` na raiz com os serviços:
   - `postgres` (postgres:16-alpine) com a extensão PostGIS habilitada, porta 5432
   - `redis` (redis:7-alpine), porta 6379
   - `api` (build do Dockerfile em `services/api`), porta 8080
   - `web` (build do Dockerfile em `apps/web`), porta 3000
   - Variáveis de ambiente via arquivo `.env`
3. Criar `.env.example` na raiz com todas as variáveis necessárias:
   ```
   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
   REDIS_URL
   JWT_PRIVATE_KEY_PATH, JWT_PUBLIC_KEY_PATH
   PAGARME_API_KEY, PAGARME_WEBHOOK_SECRET
   EXPO_ACCESS_TOKEN
   PLATFORM_FEE_PERCENT
   ```
4. Gerar par de chaves RSA (2048 bits) em `services/api/keys/` para assinar os JWTs e QR Codes

---

## Passo 2 — Backend Go: Fundação

### 2.1 Inicializar módulo Go

```bash
cd services/api
go mod init github.com/seuusuario/marketplace-api
```

Instalar dependências:
```bash
go get github.com/gin-gonic/gin
go get github.com/gin-contrib/cors
go get github.com/jmoiron/sqlx
go get github.com/lib/pq
go get github.com/redis/go-redis/v9
go get github.com/golang-jwt/jwt/v5
go get github.com/google/uuid
go get github.com/skip2/go-qrcode
go get golang.org/x/crypto
go get github.com/joho/godotenv
go get github.com/golang-migrate/migrate/v4
go get go.uber.org/zap
go get github.com/go-playground/validator/v10
```

### 2.2 Criar `pkg/database/postgres.go`

Pool de conexão com PostgreSQL usando `sqlx`. Função `Connect(dsn string) (*sqlx.DB, error)`.
Testar conexão com `db.Ping()` na inicialização.

### 2.3 Criar `pkg/redis/client.go`

Cliente Redis usando `go-redis`. Função `Connect(url string) (*redis.Client, error)`.

### 2.4 Criar `pkg/logger/logger.go`

Logger estruturado com `zap`. Funções: `Info`, `Error`, `Debug`, `Fatal`.

### 2.5 Criar `cmd/api/main.go`

- Carregar `.env`
- Inicializar logger
- Conectar ao PostgreSQL
- Conectar ao Redis
- Executar migrations pendentes
- Criar router Gin com middleware: CORS, logger, recovery
- Registrar todas as rotas (ver Passo 4)
- Iniciar servidor na porta 8080

---

## Passo 3 — Migrations PostgreSQL

Criar os arquivos de migration em `services/api/migrations/` na ordem abaixo.
Usar `golang-migrate` com formato `{versão}_{nome}.up.sql` e `{versão}_{nome}.down.sql`.

### 001_extensions.up.sql
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
```

### 002_establishments.up.sql
```sql
CREATE TYPE establishment_status AS ENUM ('pending_approval', 'active', 'suspended');
CREATE TYPE establishment_category AS ENUM ('bar', 'restaurante', 'lanchonete', 'cafe', 'outro');

CREATE TABLE establishments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    logo_url TEXT,
    cover_url TEXT,
    address VARCHAR(500) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(2) NOT NULL,
    zip_code VARCHAR(9),
    location GEOGRAPHY(POINT, 4326),
    category establishment_category NOT NULL DEFAULT 'bar',
    opening_hours JSONB NOT NULL DEFAULT '{}',
    status establishment_status NOT NULL DEFAULT 'pending_approval',
    owner_name VARCHAR(255) NOT NULL,
    owner_email VARCHAR(255) NOT NULL UNIQUE,
    owner_phone VARCHAR(20),
    pix_key VARCHAR(255),
    commission_rate DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_establishments_location ON establishments USING GIST (location);
CREATE INDEX idx_establishments_status ON establishments (status);
CREATE INDEX idx_establishments_city ON establishments (city);
```

### 003_staff.up.sql
```sql
CREATE TYPE staff_role AS ENUM ('owner', 'manager', 'attendant');

CREATE TABLE staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role staff_role NOT NULL DEFAULT 'attendant',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_staff_establishment ON staff (establishment_id);
CREATE INDEX idx_staff_email ON staff (email);
```

### 004_catalog.up.sql
```sql
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    image_url TEXT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    stock_controlled BOOLEAN NOT NULL DEFAULT FALSE,
    stock_quantity INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_establishment ON products (establishment_id);
CREATE INDEX idx_products_category ON products (category_id);
CREATE INDEX idx_categories_establishment ON categories (establishment_id);
```

### 005_promotions.up.sql
```sql
CREATE TYPE promotion_type AS ENUM ('percentage', 'fixed_amount', 'combo');
CREATE TYPE promotion_applies_to AS ENUM ('all', 'category', 'product');

CREATE TABLE promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type promotion_type NOT NULL,
    value DECIMAL(10,2) NOT NULL,
    applies_to promotion_applies_to NOT NULL DEFAULT 'all',
    applies_to_id UUID,
    coupon_code VARCHAR(50),
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    max_uses INT,
    uses_count INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_promotions_establishment ON promotions (establishment_id);
CREATE UNIQUE INDEX idx_promotions_coupon ON promotions (coupon_code) WHERE coupon_code IS NOT NULL;
```

### 006_customers.up.sql
```sql
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    profile_picture TEXT,
    push_token TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_email ON customers (email);
```

### 007_orders.up.sql
```sql
CREATE TYPE order_status AS ENUM (
    'pending_payment', 'paid', 'ready', 'collected', 'cancelled', 'refunded'
);
CREATE TYPE payment_method AS ENUM ('pix', 'credit_card', 'debit_card');
CREATE TYPE payment_status AS ENUM ('pending', 'confirmed', 'failed', 'refunded');

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    establishment_id UUID NOT NULL REFERENCES establishments(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    status order_status NOT NULL DEFAULT 'pending_payment',
    subtotal DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    platform_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    payment_method payment_method,
    payment_status payment_status NOT NULL DEFAULT 'pending',
    payment_provider_ref VARCHAR(255),
    payment_idempotency_key VARCHAR(255) UNIQUE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    collected_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    product_snapshot JSONB NOT NULL
);

CREATE TABLE order_promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    promotion_id UUID NOT NULL REFERENCES promotions(id),
    discount_applied DECIMAL(10,2) NOT NULL
);

CREATE INDEX idx_orders_establishment ON orders (establishment_id);
CREATE INDEX idx_orders_customer ON orders (customer_id);
CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_orders_payment_status ON orders (payment_status);
CREATE INDEX idx_order_items_order ON order_items (order_id);
```

### 008_qrcodes.up.sql
```sql
CREATE TABLE qr_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    scanned_at TIMESTAMPTZ,
    scanned_by_staff_id UUID REFERENCES staff(id),
    is_valid BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_qrcodes_order ON qr_codes (order_id);
CREATE INDEX idx_qrcodes_valid ON qr_codes (is_valid) WHERE is_valid = TRUE;
```

### 009_super_admins.up.sql
```sql
CREATE TABLE super_admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Passo 4 — Backend Go: Rotas e Handlers

### Rotas Públicas (sem autenticação)

```
POST /api/v1/auth/customer/register
POST /api/v1/auth/customer/login
POST /api/v1/auth/staff/login
POST /api/v1/auth/super-admin/login
POST /api/v1/auth/refresh

GET  /api/v1/establishments?lat=&lng=&radius=&city=&category=&page=&limit=
GET  /api/v1/establishments/:id
GET  /api/v1/establishments/:id/products
GET  /api/v1/establishments/:id/promotions

POST /api/v1/webhooks/pagarme
```

### Rotas do Cliente (Bearer token de customer)

```
GET  /api/v1/customer/me
PUT  /api/v1/customer/me
PUT  /api/v1/customer/me/push-token

POST /api/v1/orders
GET  /api/v1/orders
GET  /api/v1/orders/:id
GET  /api/v1/orders/:id/qrcode
POST /api/v1/orders/:id/cancel

POST /api/v1/promotions/validate   # valida cupom antes do checkout
```

### Rotas do Staff (Bearer token de staff)

```
GET  /api/v1/staff/me
GET  /api/v1/staff/establishment/orders?status=&date=
GET  /api/v1/staff/establishment/orders/:id
PUT  /api/v1/staff/establishment/orders/:id/status

POST /api/v1/staff/qrcode/scan     # body: { token: "..." }
```

### Rotas do Establishment Admin (role: owner ou manager)

```
GET  /api/v1/establishment/me
PUT  /api/v1/establishment/me

GET  /api/v1/establishment/staff
POST /api/v1/establishment/staff
PUT  /api/v1/establishment/staff/:id
DELETE /api/v1/establishment/staff/:id

GET  /api/v1/establishment/categories
POST /api/v1/establishment/categories
PUT  /api/v1/establishment/categories/:id
DELETE /api/v1/establishment/categories/:id

GET  /api/v1/establishment/products
POST /api/v1/establishment/products
PUT  /api/v1/establishment/products/:id
DELETE /api/v1/establishment/products/:id

GET  /api/v1/establishment/promotions
POST /api/v1/establishment/promotions
PUT  /api/v1/establishment/promotions/:id
DELETE /api/v1/establishment/promotions/:id

GET  /api/v1/establishment/dashboard
GET  /api/v1/establishment/reports/sales?from=&to=

GET  /api/v1/establishment/orders        # WebSocket também disponível
GET  /api/v1/establishment/orders/:id
```

### WebSocket

```
WS /api/v1/ws/establishment/orders   # push de novos pedidos em tempo real
```

### Rotas Super Admin

```
GET  /api/v1/admin/establishments?status=
PUT  /api/v1/admin/establishments/:id/approve
PUT  /api/v1/admin/establishments/:id/suspend
GET  /api/v1/admin/dashboard
GET  /api/v1/admin/reports/transactions?from=&to=
```

---

## Passo 5 — Backend Go: Módulos Internos

### 5.1 `internal/auth/`

Criar:
- `jwt.go` — geração e validação de tokens JWT RS256. Funções: `GenerateAccessToken(claims)`, `GenerateRefreshToken(userID)`, `ValidateToken(token)`. Access token expira em 15 minutos, refresh em 7 dias.
- `middleware.go` — `RequireCustomer()`, `RequireStaff(roles ...string)`, `RequireSuperAdmin()`. Extraem e validam o Bearer token do header `Authorization`.
- `password.go` — `HashPassword(plain)`, `CheckPassword(plain, hash)` usando bcrypt custo 12.
- `handler.go` — handlers de login e registro para cada tipo de ator. Armazenar refresh tokens no Redis com TTL de 7 dias.

### 5.2 `internal/establishment/`

Criar:
- `repository.go` — queries PostgreSQL. Incluir busca geoespacial com `ST_DWithin` e `ST_Distance`.
- `service.go` — lógica de negócio: registro, aprovação, suspensão.
- `handler.go` — handlers Gin para as rotas listadas.
- `dto.go` — structs de request/response com tags `json` e `validate`.

### 5.3 `internal/catalog/`

Criar `repository.go`, `service.go`, `handler.go`, `dto.go` para categories, products e promotions.

Na service de promotions, implementar função `CalculateDiscount(cart, promotionID) (discountAmount, error)`.

### 5.4 `internal/order/`

Criar:
- `repository.go` — CRUD de orders e order_items.
- `service.go`:
  - `CreateOrder(customerID, establishmentID, items, promotionID, paymentMethod)` — calcula subtotal, aplica desconto, calcula taxa da plataforma (`commission_rate`), persiste pedido com status `pending_payment`, gera `payment_idempotency_key` único.
  - `GetOrdersByEstablishment(establishmentID, filters)` — com paginação.
  - `UpdateOrderStatus(orderID, status, staffID)`.
- `handler.go` — handlers Gin.
- `websocket.go` — hub de WebSocket para notificar estabelecimento em tempo real quando novo pedido chega. Usar gorilla/websocket ou nhooyr.io/websocket.
- `dto.go`.

### 5.5 `internal/payment/`

Criar:
- `pagarme.go` — cliente HTTP para API do Pagar.me v5. Implementar:
  - `CreatePixPayment(order)` — cria transação PIX, retorna QR Code PIX e `payment_provider_ref`.
  - `CreateCardPayment(order, cardToken)` — cria transação com cartão tokenizado.
  - `ValidateWebhookSignature(payload, signature, secret)` — HMAC-SHA256.
- `webhook_handler.go` — handler `POST /webhooks/pagarme`. **Implementar idempotência:** antes de processar, verificar se `payment_provider_ref` já foi processado (checar no Redis com TTL de 24h). Se pagamento confirmado (`payment_status: paid`): atualizar order para `paid`, chamar `qrcode.Generate(orderID)`, enviar push notification.
- `dto.go`.

### 5.6 `internal/qrcode/`

Criar:
- `generator.go`:
  - `Generate(orderID, establishmentID) (tokenString, qrCodePNG, error)`
  - Claims do JWT: `order_id`, `establishment_id`, `type: "qrcode"`, `exp: now + 24h`, `jti: uuid`
  - Assinar com RS256 usando chave privada do arquivo `keys/private.pem`
  - Gerar imagem PNG do QR Code com `skip2/go-qrcode` (256x256 pixels)
  - Persistir token na tabela `qr_codes`
- `validator.go`:
  - `Scan(token, staffID) (*Order, error)`
  - Validar assinatura JWT
  - Verificar se `is_valid = true` no banco
  - Verificar `expires_at`
  - Em transação atômica: setar `is_valid = false`, `scanned_at = now`, `scanned_by_staff_id`, atualizar order para status `collected`

### 5.7 `internal/notification/`

Criar `expo.go` com função `SendPushNotification(pushToken, title, body, data)` usando a API HTTP do Expo Push Notifications.

---

## Passo 6 — Web Admin (React)

### 6.1 Setup

```bash
cd apps/web
npm create vite@latest . -- --template react-ts
npm install tailwindcss @tailwindcss/vite
npm install react-router-dom axios zustand @tanstack/react-query
npm install lucide-react react-hot-toast
npm install @zxing/library  # para scanner de QR Code via câmera
npm install recharts        # para gráficos no dashboard
```

### 6.2 Páginas a Implementar

**Públicas:**
- `/login` — formulário de login para staff e super admin

**Painel do Estabelecimento** (rota base `/dashboard`):
- `/dashboard` — métricas do dia: pedidos hoje, faturamento, ticket médio, gráfico de pedidos por hora
- `/dashboard/orders` — lista de pedidos em tempo real com WebSocket. Cards com status colorido. Botão para marcar como "pronto".
- `/dashboard/scanner` — tela de scanner QR Code usando câmera do browser via `@zxing/library`. Ao escanear, chama `POST /staff/qrcode/scan` e exibe feedback visual (verde = sucesso, vermelho = erro).
- `/dashboard/products` — listagem com toggle de disponibilidade, edição e criação
- `/dashboard/categories` — gerenciamento de categorias
- `/dashboard/promotions` — criação e listagem de promoções com badge de status (ativa/expirada)

**Painel Super Admin** (rota base `/admin`):
- `/admin/establishments` — tabela paginada com filtro de status. Botões "Aprovar" e "Suspender".
- `/admin/dashboard` — volume de transações, estabelecimentos ativos, pedidos totais

### 6.3 Componentes Globais

- `ProtectedRoute` — redireciona para login se não autenticado
- `OrderCard` — card de pedido com status badge
- `QRScanner` — componente de câmera com overlay de foco
- `Sidebar` — navegação lateral responsiva
- `DataTable` — tabela paginada reutilizável
- `StatCard` — card de métrica para dashboards

### 6.4 Estado Global (Zustand)

Criar stores: `authStore` (user, token, logout), `ordersStore` (pedidos em tempo real via WebSocket).

---

## Passo 7 — Mobile (React Native + Expo)

### 7.1 Setup

```bash
cd apps/mobile
npx create-expo-app . --template blank-typescript
npx expo install expo-router expo-camera expo-location
npx expo install expo-notifications expo-secure-store
npm install axios zustand @tanstack/react-query
npm install react-native-safe-area-context react-native-screens
npm install nativewind
npm install react-native-maps
```

### 7.2 Telas a Implementar

**Autenticação:**
- `(auth)/login` — login com email/senha
- `(auth)/register` — cadastro com nome, email, telefone, senha

**App Principal (tabs):**
- `(tabs)/index` — Feed de estabelecimentos próximos. Solicitar permissão de localização. Cards com foto de capa, nome, categoria, distância. Filtro por categoria. Busca por nome.
- `(tabs)/orders` — Histórico de pedidos do cliente. Lista com status badge.
- `(tabs)/profile` — Dados do usuário, edição de perfil.

**Fluxo de Compra (stack dentro do tab home):**
- `establishment/[id]` — perfil do estabelecimento: cover, nome, horário, lista de categorias como tabs horizontais, grid de produtos.
- `product/[id]` — detalhe do produto com foto grande, descrição, botão "Adicionar ao carrinho".
- `cart` — resumo do carrinho, campo de cupom, resumo de valores (subtotal, desconto, total), seleção de método de pagamento, botão "Finalizar Pedido".
- `checkout/pix` — exibe QR Code PIX do Pagar.me para pagamento. Polling a cada 3 segundos em `GET /orders/:id` até `payment_status = confirmed`. Navegar automaticamente para tela de sucesso.
- `checkout/success` — animação de sucesso, botão "Ver meu QR Code".
- `order/[id]/qrcode` — exibe QR Code da retirada em tela cheia, grande o suficiente para o atendente escanear. Exibe também: nome do estabelecimento, itens do pedido, valor total, hora de expiração. Brilho da tela no máximo enquanto esta tela estiver aberta.

### 7.3 Serviços

Criar `src/services/api.ts` — instância do axios com:
- `baseURL` do env
- Interceptor de request: adiciona `Authorization: Bearer <token>`
- Interceptor de response: em 401, tenta refresh token e repete a request. Se refresh falhar, faz logout.

### 7.4 Notificações Push

Em `src/hooks/usePushNotifications.ts`:
- Solicitar permissão de notificação ao logar
- Obter Expo Push Token
- Chamar `PUT /customer/me/push-token` para registrar no backend
- Ouvir notificações em foreground e exibir toast

---

## Passo 8 — Docker e Infraestrutura

### 8.1 `docker-compose.yml` (raiz do projeto)

Deve incluir:
- **postgres**: imagem `postgis/postgis:16-3.4-alpine`, healthcheck, volume persistente
- **redis**: imagem `redis:7-alpine`, com senha via `requirepass`
- **api**: build de `services/api`, depende de postgres e redis (healthcheck), expõe porta 8080, monta arquivo `.env`
- **web**: build de `apps/web`, porta 3000
- Rede bridge compartilhada entre todos os serviços

### 8.2 `services/api/Dockerfile`

Multi-stage build:
1. Stage `builder`: `golang:1.23-alpine`, copia código, `go build -o /app/server ./cmd/api`
2. Stage `runner`: `alpine:3.19`, copia binário e pasta `keys/`, `migrations/`, expõe 8080, `CMD ["/app/server"]`

### 8.3 `apps/web/Dockerfile`

Multi-stage:
1. Stage `builder`: `node:20-alpine`, instala deps, `npm run build`
2. Stage `runner`: `nginx:alpine`, copia `dist/`, copia `nginx.conf` com SPA fallback

---

## Passo 9 — Testes

### Backend (Go)

Criar testes unitários em `_test.go` para:
- `internal/auth/jwt_test.go` — geração e validação de tokens
- `internal/payment/webhook_handler_test.go` — idempotência do webhook
- `internal/qrcode/validator_test.go` — cenários: token válido, expirado, já usado, assinatura inválida
- `internal/catalog/service_test.go` — cálculo de desconto

Usar `testify` para assertions. Usar mocks para repositórios.

### Executar todos os testes:
```bash
cd services/api && go test ./...
```

---

## Passo 10 — README.md

Criar `README.md` na raiz com:
- Descrição do produto
- Diagrama de arquitetura (em texto/ASCII)
- Instruções de setup local (pré-requisitos, variáveis de ambiente, como rodar)
- Descrição de cada serviço
- Fluxo do pedido explicado
- Como rodar os testes
- Endpoints principais da API (resumo)

---

## Regras Gerais para o Agente

- **Nunca** gerar QR Code antes do `payment_status = confirmed`
- **Sempre** usar transações PostgreSQL ao alterar order + qr_code simultaneamente
- **Sempre** validar e sanitizar inputs com o validator do Go antes de persistir
- **Nunca** logar dados sensíveis (senhas, chaves, tokens completos)
- **Sempre** retornar erros no formato `{ "error": "mensagem", "code": "ERRO_CODE" }`
- **Sempre** paginar listagens com parâmetros `page` e `limit` (default: limit=20, max=100)
- **Todos** os timestamps devem ser UTC
- **Sempre** usar UUID como primary key, nunca inteiros sequenciais
- O QR Code JWT deve conter `jti` (JWT ID) único para prevenir reuso mesmo após manipulação
- O webhook do Pagar.me deve responder HTTP 200 imediatamente e processar de forma assíncrona com goroutine

---

## Ordem de Execução Recomendada

```
1. Criar estrutura de diretórios
2. docker-compose.yml + .env.example
3. Gerar chaves RSA
4. Backend: go.mod + dependências
5. Backend: pkg/ (database, redis, logger)
6. Backend: migrations (001 ao 009)
7. Backend: cmd/api/main.go
8. Backend: internal/auth/
9. Backend: internal/establishment/
10. Backend: internal/catalog/
11. Backend: internal/order/ (sem WebSocket primeiro)
12. Backend: internal/payment/
13. Backend: internal/qrcode/
14. Backend: WebSocket em internal/order/websocket.go
15. Backend: internal/notification/
16. Backend: internal/staff/ e internal/admin/
17. Testes do backend
18. Dockerfiles
19. Web Admin: setup + estrutura
20. Web Admin: auth + layout
21. Web Admin: painel do estabelecimento
22. Web Admin: scanner QR
23. Web Admin: super admin
24. Mobile: setup + navegação
25. Mobile: auth
26. Mobile: feed + cardápio
27. Mobile: carrinho + checkout + PIX
28. Mobile: tela QR Code
29. Mobile: push notifications
30. README.md
```
