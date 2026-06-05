-- CreateEnum
CREATE TYPE "Status" AS ENUM ('APPLIED', 'SCREEN', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "JobAplication" (
    "id" SERIAL NOT NULL,
    "company" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" "Status" NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "JobAplication_pkey" PRIMARY KEY ("id")
);
