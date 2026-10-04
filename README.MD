# LinkHub API

API REST para gerir utilizadores, categorias e links. A API usa JSON e está montada, por omissão, em `http://localhost:5000`.

## Requisitos e execução

- Node.js
- MongoDB

Crie um ficheiro `.env` na raiz do projeto:

```env
MONGO_URL=mongodb://localhost:27017/linkhub
JWT_SEC=altere-para-uma-chave-secreta-forte
PASS_SEC=altere-para-outra-chave-secreta-forte
```

Instale as dependências e inicie o servidor:

```bash
npm install
npm start
```

O servidor escuta na porta `5000`. O código atual não configura CORS nem uma porta através de variável de ambiente.

## Formato das requisições

Envie os corpos como JSON usando o cabeçalho:

```http
Content-Type: application/json
```

As rotas protegidas usam o token devolvido pelo login:

```http
Authorization: Bearer <accessToken>
```

Os tokens expiram após três dias. O endpoint de logout revoga o token.

## Autenticação

### Registar utilizador

`POST /api/auth/register`

Corpo:

```json
{
  "username": "ana",
  "email": "ana@example.com",
  "password": "uma-password-segura"
}
```

Resposta `201`:

```json
{
  "success": true,
  "message": "User has been created!"
}
```

O nome de utilizador e o email têm de ser únicos. Se já existirem, a API responde `400`.

### Iniciar sessão

`POST /api/auth/login`

Corpo:

```json
{
  "username": "ana",
  "password": "uma-password-segura"
}
```

Resposta `200` inclui os dados do utilizador e o token:

```json
{
  "success": true,
  "_id": "ID_DO_UTILIZADOR",
  "username": "ana",
  "email": "ana@example.com",
  "isAdmin": false,
  "accessToken": "JWT"
}
```

Credenciais incorretas respondem `401`.

### Terminar sessão

`POST /api/auth/logout`

Requer autenticação. Resposta `200`:

```json
{
  "success": true,
  "message": "Session ended successfully."
}
```

## Utilizadores

| Método | Endpoint | Acesso | Descrição |
| --- | --- | --- | --- |
| `PUT` | `/api/users/:id` | Dono ou admin | Atualiza o utilizador |
| `DELETE` | `/api/users/:id` | Dono ou admin | Apaga o utilizador |
| `GET` | `/api/users` | Admin | Lista utilizadores |
| `GET` | `/api/users/find/:id` | Admin | Consulta um utilizador |
| `GET` | `/api/users/stats` | Admin | Estatísticas mensais de registos no último ano |

Exemplo de atualização:

```json
{
  "username": "ana-nova",
  "email": "ana.nova@example.com"
}
```

Os campos permitidos são `username`, `email` e `password`. O campo `isAdmin` só pode ser alterado por um administrador. A palavra-passe nunca é devolvida nas respostas de consulta.

## Categorias

| Método | Endpoint | Acesso | Descrição |
| --- | --- | --- | --- |
| `POST` | `/api/category` | Admin | Cria uma categoria |
| `GET` | `/api/category` | Autenticado | Lista categorias |
| `GET` | `/api/category/find/:id` | Admin | Consulta uma categoria |
| `PUT` | `/api/category/:id` | Admin | Atualiza uma categoria |
| `DELETE` | `/api/category/:id` | Admin | Apaga uma categoria |

Corpo para criar uma categoria:

```json
{
  "name": "Ferramentas",
  "description": "Ferramentas úteis para desenvolvimento"
}
```

`name` e `description` são únicos. Um duplicado responde `409`.

**Limitação conhecida:** a implementação atual da rota `DELETE /api/category/:id` verifica incorretamente a existência de uma categoria antes de apagar. Pode responder `404` mesmo quando o ID enviado existe.

## Links

| Método | Endpoint | Acesso | Descrição |
| --- | --- | --- | --- |
| `POST` | `/api/link/register` | Autenticado | Regista um link |
| `GET` | `/api/link` | Público | Lista todos os links |
| `GET` | `/api/link/all` | Público | Alias para listar todos os links |
| `GET` | `/api/link/:id` | Público | Consulta um link |
| `PUT` | `/api/link/:id` | Dono ou admin | Atualiza um link |
| `DELETE` | `/api/link/:id` | Dono ou admin | Apaga um link |

Corpo para registar um link:

```json
{
  "categoryId": "ID_DA_CATEGORIA",
  "title": "Documentação",
  "link": "https://example.com/docs",
  "description": "Documentação do projeto"
}
```

O `userId` é obtido do token e não deve ser enviado no corpo. Os campos `categoryId`, `title`, `link` e `description` são obrigatórios. Links sem protocolo recebem `https://`; só são aceites URLs HTTP e HTTPS.

Cada utilizador só pode registar a mesma URL normalizada uma vez. Uma repetição responde `409`:

```json
{
  "success": false,
  "message": "You have already registered this link."
}
```

As respostas de consulta incluem `status_online`, calculado ao fazer um pedido ao URL guardado. Os valores são `disponivel`, `indisponivel` ou `unavailable (no link provided)`. A verificação pode tornar a listagem mais lenta, pois cada URL é verificado individualmente.

## Códigos de estado comuns

| Código | Significado |
| --- | --- |
| `200` | Pedido concluído |
| `201` | Recurso criado |
| `400` | Dados inválidos ou ID malformado |
| `401` | Autenticação necessária ou token revogado |
| `403` | Token inválido ou operação não autorizada |
| `404` | Recurso não encontrado |
| `409` | Conflito, como um registo duplicado |
| `500` | Erro interno do servidor |

