import { prisma } from "./prisma";

async function main() {
  const user = await prisma.user.create({
    data: {
      name: "Test User",
      email: "test.user@example.com",
    },
  });

  console.log("Created test user:", user);

  

  

  const allJobs = await prisma.jobAplication.findMany();
  console.log("All job applications:", JSON.stringify(allJobs, null, 2));
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
