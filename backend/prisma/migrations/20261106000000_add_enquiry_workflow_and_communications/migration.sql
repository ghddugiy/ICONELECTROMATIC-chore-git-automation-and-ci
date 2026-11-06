-- CreateEnum
CREATE TYPE "EnquiryRegion" AS ENUM ('INDIA', 'SINGAPORE', 'USA');

-- CreateEnum
CREATE TYPE "EnquiryWorkflowStatus" AS ENUM ('NEW', 'ASSIGNED', 'IN_PROGRESS', 'QUOTED', 'CONTACTED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CommunicationType" AS ENUM ('INTERNAL_NOTE', 'EMAIL_OUTBOUND', 'CUSTOMER_REPLY', 'PHONE_LOG', 'STATUS_CHANGE');

-- AlterTable
ALTER TABLE "Enquiry" ADD COLUMN     "assignedToId" TEXT,
ADD COLUMN     "region" "EnquiryRegion",
ADD COLUMN     "workflowStatus" "EnquiryWorkflowStatus" NOT NULL DEFAULT 'NEW';

-- CreateTable
CREATE TABLE "EnquiryCommunication" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "type" "CommunicationType" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "metadata" JSONB,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnquiryCommunication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Enquiry_workflowStatus_region_createdAt_idx" ON "Enquiry"("workflowStatus", "region", "createdAt");

-- CreateIndex
CREATE INDEX "Enquiry_assignedToId_workflowStatus_idx" ON "Enquiry"("assignedToId", "workflowStatus");

-- CreateIndex
CREATE INDEX "EnquiryCommunication_enquiryId_createdAt_idx" ON "EnquiryCommunication"("enquiryId", "createdAt");

-- CreateIndex
CREATE INDEX "EnquiryCommunication_type_createdAt_idx" ON "EnquiryCommunication"("type", "createdAt");

-- CreateIndex
CREATE INDEX "EnquiryCommunication_authorId_createdAt_idx" ON "EnquiryCommunication"("authorId", "createdAt");

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryCommunication" ADD CONSTRAINT "EnquiryCommunication_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryCommunication" ADD CONSTRAINT "EnquiryCommunication_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
