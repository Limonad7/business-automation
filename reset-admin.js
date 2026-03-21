const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function resetAdmin() {
  const hashedPassword = await bcrypt.hash("password123", 10);
  
  // Find any ADMIN user and reset their email and password
  const adminKeys = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  
  if (adminKeys) {
    await prisma.user.update({
      where: { id: adminKeys.id },
      data: {
        email: 'admin@test.ru',
        password: hashedPassword,
        isBlocked: false
      }
    });
    console.log("Admin reset successfully to admin@test.ru / password123");
  } else {
    console.log("No admin found.");
  }
}

resetAdmin()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
