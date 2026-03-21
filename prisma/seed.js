const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("Cleaning database...");
  await prisma.userWorkReport.deleteMany();
  await prisma.salaryRate.deleteMany();
  await prisma.taskAssignee.deleteMany();
  await prisma.taskDirectionMapping.deleteMany();
  await prisma.task.deleteMany();
  await prisma.taskType.deleteMany();
  await prisma.taskDirection.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();

  console.log("Seeding types and directions...");
  const taskTypesNames = [
    "Разработка материалов", "Создание приложений", "Индивидуальная консультация",
    "Менторская консультация", "Групповая консультация", "Встреча по наставничеству",
    "Подготовка к консультации", "Вебинар", "Подготовка к вебинару",
    "Мастер-класс", "Исследование", "Дежурство на платформе",
    "Ответы в чатах", "Проверка домашних заданий", "Проверка этапов ДП",
    "Прием экзамена", "Защита ДП", "Доработка нейро-сервисов УИИ"
  ];
  const typeMap = {};
  for (const name of taskTypesNames) {
    const t = await prisma.taskType.create({ data: { name } });
    typeMap[name] = t.id;
  }

  const directionNames = [
    "Data Science", "GPT", "Vibe coding", "No code", "Программирование",
    "Маркетинг и продажи", "Project Management", "Frontend", "Backend", "Fullstack-разработка"
  ];
  const directionMap = {};
  for (const name of directionNames) {
    const d = await prisma.taskDirection.create({ data: { name } });
    directionMap[name] = d.id;
  }

  console.log("Seeding users...");
  const password = await bcrypt.hash("password123", 10);
  
  const admin = await prisma.user.create({
    data: { email: "admin@test.ru", fullName: "Иванов Иван (Админ)", role: "ADMIN", password }
  });
  
  const executor1 = await prisma.user.create({
    data: { email: "exec1@test.ru", fullName: "Петров Петр (Исполнитель)", role: "EXECUTOR", password }
  });

  const executor2 = await prisma.user.create({
    data: { email: "exec2@test.ru", fullName: "Сидоров Сидор (Исполнитель)", role: "EXECUTOR", password }
  });

  const uch = await prisma.user.create({
    data: { email: "uch@test.ru", fullName: "Смирнова Анна (УЧ)", role: "UCH", password }
  });

  console.log("Seeding rates...");
  // Executor 1 rates
  await prisma.salaryRate.create({
    data: {
      executorId: executor1.id,
      typeId: typeMap["Вебинар"],
      rate: 5000,
      startDate: new Date("2025-01-01"),
      unit: "UNITS", // per session
      comment: "Стандартная ставка за вебинар"
    }
  });

  await prisma.salaryRate.create({
    data: {
      executorId: executor1.id,
      typeId: typeMap["Создание приложений"],
      rate: 1500,
      startDate: new Date("2025-01-01"),
      unit: "HOURS",
      comment: "Почасовая разработка"
    }
  });

  // Executor 2 rates
  await prisma.salaryRate.create({
    data: {
      executorId: executor2.id,
      typeId: typeMap["Проверка домашних заданий"],
      rate: 200,
      startDate: new Date("2025-01-01"),
      unit: "UNITS",
      comment: "За одну проверку"
    }
  });

  console.log("Seeding tasks...");
  const task1 = await prisma.task.create({
    data: {
      title: "Провести вебинар по Next.js",
      description: "Подготовить презентацию и провести эфир на 1.5 часа",
      typeId: typeMap["Вебинар"],
      deadline: new Date("2025-04-20"),
      creatorId: admin.id,
      status: "IN_PROGRESS",
      assignees: { create: { userId: executor1.id } },
      directions: { create: { directionId: directionMap["Frontend"] } }
    }
  });

  const task2 = await prisma.task.create({
    data: {
      title: "Разработать модуль чата",
      description: "Реализовать WebSocket соединение и UI",
      typeId: typeMap["Создание приложений"],
      deadline: new Date("2025-05-15"),
      creatorId: uch.id,
      status: "PENDING",
      assignees: { create: { userId: executor1.id } },
      directions: { create: { directionId: directionMap["Fullstack-разработка"] } }
    }
  });

  console.log("Seeding work reports...");
  await prisma.userWorkReport.create({
    data: {
      executorId: executor1.id,
      taskId: task1.id,
      volume: 1,
      comment: "Провел вебинар, все прошло успешно",
      creatorId: executor1.id,
      recordDate: new Date("2025-03-01"),
      amountCalculated: 5000,
      unitMatched: "UNITS"
    }
  });

  console.log("Seed finished!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
