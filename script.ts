import { prisma } from "./prisma";

async function main() {
  const user = await prisma.user.create({
    data: {
      name: "Test User",
      email: "test.user@example.com",
    },
  });

  console.log("Created test user:", user);

  const jobApplications = await prisma.jobAplication.createMany({
    data: [
      {
        company: "Acme Corp",
        role: "Frontend Developer",
        status: "APPLIED",
        appliedAt: new Date("2026-06-01T09:00:00Z"),
        notes: "Applied through company website.",
      },
      {
        company: "Bright Future Inc.",
        role: "Backend Engineer",
        status: "SCREEN",
        appliedAt: new Date("2026-05-02T10:30:00Z"),
        notes: "Phone screen scheduled.",
      },
      {
        company: "CloudShift",
        role: "Fullstack Engineer",
        status: "INTERVIEW",
        appliedAt: new Date("2026-06-03T08:15:00Z"),
        notes: "Technical interview completed.",
      },
      {
        company: "Delta Systems",
        role: "DevOps Engineer",
        status: "OFFER",
        appliedAt: new Date("2026-06-04T11:45:00Z"),
        notes: "Offer received, reviewing details.",
      },
      {
        company: "Evergreen Labs",
        role: "QA Engineer",
        status: "REJECTED",
        appliedAt: new Date("2026-05-05T14:00:00Z"),
        notes: "Application rejected after interview.",
      },
    ],
  });

  console.log("Created job applications:", jobApplications);

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
