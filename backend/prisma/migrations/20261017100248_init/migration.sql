-- CreateTable
CREATE TABLE "ConnectionTest" (
    "id" SERIAL NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectionTest_pkey" PRIMARY KEY ("id")
);
