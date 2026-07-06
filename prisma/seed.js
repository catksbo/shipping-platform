require('dotenv/config');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient, UserRole } = require('@prisma/client');

const users = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'shipper@example.com',
    passwordHash: 'fake-password-hash',
    role: UserRole.SHIPPER,
    name: 'Demo Shipper',
    companyName: 'Acme Imports',
    phone: '+1-555-0101',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'broker@example.com',
    passwordHash: 'fake-password-hash',
    role: UserRole.BROKER,
    name: 'Demo Broker',
    companyName: 'Northstar Brokerage',
    phone: '+1-555-0202',
  },
];

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: user,
    });
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
