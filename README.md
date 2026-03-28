# Business Process Automation (BIZ-AUTO)

Веб-приложение для управления задачами, учёта трудозатрат и расчёта выплат исполнителям.

## Стек

- **Next.js 16** (App Router), **React 19**, **TypeScript**
- **PostgreSQL** (через **Prisma ORM**)
- **NextAuth** (аутентификация по логину/паролю, JWT)

## Требования

- **Node.js** 20+ и **npm**
- **PostgreSQL** 14+ (локально через Docker или облачный сервис)

## Быстрый старт

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
|------------|----------|--------|
| `DATABASE_URL` | Строка подключения к PostgreSQL | `postgresql://user:password@localhost:5432/business_automation` |
| `NEXTAUTH_URL` | URL приложения | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | Секрет для подписи JWT (любая длинная случайная строка) | `my-super-secret-key-123` |

### 4. Поднять PostgreSQL (Docker)

```bash
docker run -d \
  --name pg-biz \
  -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=business_automation \
  -p 5432:5432 \
  postgres:16
```

Или используйте любой другой способ (облачный Postgres, локальная установка). Главное — чтобы `DATABASE_URL` в `.env` указывал на рабочую базу.

### 5. Создать таблицы в базе данных

```bash
npx prisma generate
npx prisma db push
```

Prisma автоматически создаст все таблицы, индексы и связи по схеме из `prisma/schema.prisma`. Вручную SQL выполнять не нужно.

### 6. (По желанию) Загрузить демо-данные

```bash
node prisma/seed.js
```

### 7. Запустить приложение

```bash
npm run dev
```

Открыть в браузере: **http://localhost:3000**

## Тестовые учётные записи

После выполнения `seed.js` доступны следующие пользователи (пароль для всех: **`password123`**):

| Email | Роль | Описание |
|-------|------|----------|
| `admin@test.ru` | ADMIN | Полный доступ: пользователи, справочники, ставки, логи |
| `exec1@test.ru` | EXECUTOR | Исполнитель задач, отчёты по своим задачам |
| `exec2@test.ru` | EXECUTOR | Исполнитель задач |
| `uch@test.ru` | UCH | Учебный координатор, управление задачами и отчётами |

## Структура базы данных

Вся схема описана в `prisma/schema.prisma`. Основные таблицы:

| Таблица | Назначение |
|---------|------------|
| `User` | Пользователи (email, пароль, роль, ФИО) |
| `Task` | Задачи (название, описание, тип, дедлайн, статус) |
| `TaskType` | Справочник типов задач |
| `TaskDirection` | Справочник направлений |
| `TaskAssignee` | Связь задача ↔ исполнитель (many-to-many) |
| `TaskDirectionMapping` | Связь задача ↔ направление (many-to-many) |
| `SalaryRate` | Ставки оплаты (исполнитель + тип задачи + период + единица) |
| `UserWorkReport` | Отчёты о работе с автоматическим расчётом суммы |
| `Comment` | Комментарии к задачам |
| `AuditLog` | Журнал действий пользователей |

## Роли

| Роль | Возможности |
|------|------------|
| **ADMIN** | Полный доступ: CRUD пользователей, справочников, ставок, просмотр логов |
| **EXECUTOR** | Работа со своими задачами и отчётами, ограниченное редактирование |
| **UCH** | Управление задачами (своими и других УЧ), создание отчётов |

## Полезные команды

```bash
npm run dev          # Режим разработки
npm run build        # Сборка для продакшена
npm start            # Запуск продакшен-сборки
npx prisma studio    # Веб-интерфейс для просмотра данных в БД
```

### Docker (PostgreSQL)

```bash
docker ps                  # Проверить запущенные контейнеры
docker stop pg-biz         # Остановить
docker start pg-biz        # Запустить снова
docker rm -f pg-biz        # Удалить контейнер
```


---

## Деплой на Railway

### Что такое Railway

[Railway](https://railway.com) — облачная платформа для деплоя приложений. Бесплатный план включает $5 в месяц, чего хватает для тестирования.

### Шаг 1. Исправить TypeScript ошибки (Next.js 16)

В Next.js 15+ параметр `params` в Route Handlers стал `Promise`. Все файлы вида `app/api/.../[id]/route.ts` должны иметь такую сигнатуру:

```ts
// ✅ Правильно для Next.js 15+
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
}
```

### Шаг 2. Создать проект на Railway

1. Зарегистрироваться на [railway.com](https://railway.com)
2. Нажать **New Project → Deploy from GitHub repo**
3. Выбрать репозиторий `business-automation`
4. Railway автоматически начнёт первый деплой (он упадёт — это нормально, нужно настроить переменные)

### Шаг 3. Добавить PostgreSQL

1. В проекте Railway нажать **+ New Service → Database → PostgreSQL**
2. Дождаться статуса **Online**
3. Railway автоматически создаст переменную `DATABASE_URL` внутри Postgres-сервиса

### Шаг 4. Добавить переменные окружения

Открыть сервис `business-automation` → вкладка **Variables** → нажать **New Variable** и добавить:

| Переменная | Значение |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` — Railway подставит автоматически |
| `NEXTAUTH_URL` | `https://<ваш-домен>.up.railway.app` |
| `NEXTAUTH_SECRET` | Любая случайная строка 32+ символов (например: `openssl rand -base64 32`) |

Нажать **Deploy** для применения.

### Шаг 5. Настроить Pre-deploy команду

Открыть сервис → **Settings → Deploy → Pre-deploy Command**:

```
npx prisma migrate deploy && npx prisma db seed
```

> ⚠️ `npx prisma db seed` заполняет БД тестовыми данными и **очищает её при каждом деплое**.
> Для продакшена уберите `&& npx prisma db seed` и оставьте только `npx prisma migrate deploy`.

Нажать **Deploy** — Railway запустит миграции, seed и поднимет сервис.

### Шаг 6. Получить URL приложения

После успешного деплоя URL будет виден в верхней части сервиса:
`https://<название>-production-XXXX.up.railway.app`

### Тестовые данные после seed

| Email | Пароль | Роль |
|---|---|---|
| `admin@test.ru` | `password123` | ADMIN |
| `exec1@test.ru` | `password123` | EXECUTOR |
| `exec2@test.ru` | `password123` | EXECUTOR |
| `uch@test.ru` | `password123` | UCH |

### Что происходит при каждом пуше в main

Railway автоматически подхватывает новые коммиты и запускает новый деплой:
1. Сборка образа (`npm run build`)
2. Pre-deploy: `npx prisma migrate deploy` (применяет новые миграции)
3. Запуск сервера (`npm start`)
