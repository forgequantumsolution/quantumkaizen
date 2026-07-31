-- CAPA origin.
--
-- Four modules raise CAPAs into one register. Without an explicit source a
-- risk-driven CAPA links to neither a non-conformance nor a finding, so it
-- cannot be told apart from an audit one — and every module's CAPA list
-- showed every other module's. Additive: one enum, two columns, one index.

-- CreateEnum
CREATE TYPE "CapaSource" AS ENUM ('AUDIT', 'FINDING', 'RISK', 'OOS', 'CALIBRATION', 'MANUAL');

-- AlterTable
ALTER TABLE "Capa" ADD COLUMN     "source" "CapaSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "sourceRef" TEXT;

