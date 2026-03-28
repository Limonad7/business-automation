# Business Process Automation (BIZ-AUTO)

Веб-приложение для управления задачами, учёта трудозатрат и расчёта выплат исполнителям.

## Стек

- **Next.js 16** (App Router), **React 19**, **TypeScript**
- **PostgreSQL** (через **Prisma ORM**)
- **NextAuth** (аутентификация по логину/паролю, JWT)

## Требования

- **Node.js** 20+ и **npm**
- **PostgreSQL** 14+ (локально через Docker или облачный сервис)

## Быстрый старт (локально)

### 1. Клонировать репозиторий

```bash
git clone <url>
cd business-automation
```

### 2. Установить зависимости

```bash
npm install
```

### 3. Настроить переменные окружения

Скопировать шаблон и заполнить своими значениями:

```bash
cp .env.example .env
```

Содержимое `.env`:

| Переменная | Описание | Пример |
|---|---|---|
| `DATABASE_URL` | Строка подключения к PostgreSQL | `postgresql://user:pass@localhost:5432/biz` |
| `NEXTAUTH_URL` | URL приложения | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | Секретный ключ (32+ символов) | `openssl rand -base64 32` |

### 4. Применить миграции и заполнить БД

```bash
npx prisma migrate deploy
npx prisma generate
node prisma/seed.js
```

### 5. Запустить

```bash
npm run dev
```

Открыть: `http://localhost:3000/login`

---

## Деплой на Railway

> Это рабочий способ деплоя — проверен и настроен. Railway использует `Dockerfile` из репозитория.

### Шаг 1. Создать аккаунт на Railway

Перейти на [railway.com](https://railway.com) и зарегистрироваться через GitHub.

### Шаг 2. Создать новый проект

1. Нажать **New Project**
2. Выбрать **Deploy from GitHub repo**
3. Выбрать репозиторий `business-automation`

### Шаг 3. Добавить PostgreSQL

1. В проекте нажать **+ New** → **Database** → **Add PostgreSQL**
2. Railway создаст базу данных автоматически

### Шаг 4. Настроить переменные окружения

Открыть сервис `business-automation` → вкладка **Variables** → нажать **New Variable** и добавить:

| Переменная | Значение |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` — Railway подставит автоматически |
| `NEXTAUTH_URL` | `https://<ваш-домен>.up.railway.app` |
| `NEXTAUTH_SECRET` | Любая случайная строка 32+ символов (например: `openssl rand -base64 32`) |

Нажать **Deploy** для применения.

### Шаг 5. Деплой запустится автоматически

Railway увидит `Dockerfile` в репозитории и запустит сборку.

При каждом старте контейнер выполняет:

```
npx prisma migrate deploy   # применяет миграции БД
node prisma/seed.js         # заполняет БД тестовыми данными
npm run start               # запускает Next.js сервер
```

> ⚠️ `seed.js` **очищает** БД и заново заполняет тестовыми данными при каждом перезапуске контейнера.
> Для продакшена удалите `&& node prisma/seed.js` из `CMD` в `Dockerfile`.

### Шаг 6. Получить URL приложения

После успешного деплоя URL будет виден в верхней части сервиса:
`https://<название>-production-XXXX.up.railway.app`

---

## Тестовые данные (после seed)

| Email | Пароль | Роль |
|---|---|---|
| `admin@test.ru` | `password123` | ADMIN |
| `exec1@test.ru` | `password123` | EXECUTOR |
| `exec2@test.ru` | `password123` | EXECUTOR |
| `uch@test.ru` | `password123` | UCH |

---

## Dockerfile (итоговый)

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD sh -c "npx prisma migrate deploy && node prisma/seed.js && npm run start"
```

---

## Что происходит при каждом пуше в main

Railway автоматически подхватывает новые коммиты и запускает новый деплой:
1. Сборка образа (`npm run build`)
2. Применение миграций (`npx prisma migrate deploy`)
3. Запуск seed (`node prisma/seed.js`)
4. Запуск сервера (`npm start`)
