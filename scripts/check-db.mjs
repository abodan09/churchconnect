import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const profiles = await prisma.userProfile.findMany();
console.log('UserProfiles:', JSON.stringify(profiles, null, 2));

const churches = await prisma.church.findMany();
console.log('Churches:', JSON.stringify(churches, null, 2));

await prisma.$disconnect();
