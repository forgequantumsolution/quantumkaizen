-- AlterTable
ALTER TABLE "TicketFlow" ADD COLUMN     "isRejected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rejectedAt" TIMESTAMP(3);
