-- Calibration & Measuring Equipment — independent module.
--
-- Purely additive: 14 new tables and 18 new enums owned entirely by this
-- module. No existing table is altered and no column is dropped. LIMS
-- `Equipment` / `Supplier` are deliberately untouched — the link to them is the
-- nullable, FK-free `CalibrationInstrument.limsEquipmentId`.

-- CreateEnum
CREATE TYPE "InstrumentKind" AS ENUM ('LAB_INSTRUMENT', 'PRODUCTION_GAUGE', 'MONITORING_DEVICE', 'REFERENCE_STANDARD', 'UTILITY');

-- CreateEnum
CREATE TYPE "InstrumentCriticality" AS ENUM ('CRITICAL', 'MAJOR', 'MINOR', 'INDICATIVE');

-- CreateEnum
CREATE TYPE "CalibrationStatus" AS ENUM ('CALIBRATED', 'DUE_SOON', 'OVERDUE', 'UNDER_CALIBRATION', 'LIMITED_USE', 'OUT_OF_SERVICE', 'NOT_REQUIRED');

-- CreateEnum
CREATE TYPE "QualificationState" AS ENUM ('NOT_STARTED', 'IQ', 'OQ', 'PQ', 'QUALIFIED', 'REQUALIFICATION_DUE');

-- CreateEnum
CREATE TYPE "ToleranceType" AS ENUM ('ABSOLUTE', 'PERCENT_OF_READING', 'PERCENT_OF_SPAN', 'MPE_MULTIPLE');

-- CreateEnum
CREATE TYPE "InUseFrequency" AS ENUM ('PER_SHIFT', 'DAILY', 'WEEKLY', 'PER_BATCH', 'MONTHLY');

-- CreateEnum
CREATE TYPE "IntervalType" AS ENUM ('DAYS', 'MONTHS', 'USAGE_HOURS', 'USAGE_CYCLES', 'RISK_MODULATED');

-- CreateEnum
CREATE TYPE "IntervalBasis" AS ENUM ('PERFORMED_DATE', 'PREVIOUS_DUE_DATE');

-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('INTERNAL', 'EXTERNAL', 'MANUFACTURER');

-- CreateEnum
CREATE TYPE "CalibrationEventType" AS ENUM ('PERIODIC', 'INITIAL', 'AFTER_REPAIR', 'AFTER_RELOCATION', 'AD_HOC', 'VERIFICATION');

-- CreateEnum
CREATE TYPE "CalibrationEventStatus" AS ENUM ('PLANNED', 'SCHEDULED', 'IN_PROGRESS', 'PENDING_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CalibrationOutcome" AS ENUM ('PASS', 'FAIL', 'CONDITIONAL', 'NOT_PERFORMED');

-- CreateEnum
CREATE TYPE "OotWindow" AS ENUM ('SINCE_LAST_CALIBRATION', 'SINCE_LAST_PASSING_CHECK', 'FIXED_DAYS');

-- CreateEnum
CREATE TYPE "OotStatus" AS ENUM ('OPEN', 'IMPACT_IN_PROGRESS', 'PENDING_QA_APPROVAL', 'CLOSED');

-- CreateEnum
CREATE TYPE "OotDisposition" AS ENUM ('NO_IMPACT', 'IMPACT_CONFIRMED', 'INCONCLUSIVE');

-- CreateEnum
CREATE TYPE "MsaStudyType" AS ENUM ('GAGE_RR_CROSSED', 'GAGE_RR_NESTED', 'BIAS', 'LINEARITY', 'STABILITY', 'ATTRIBUTE_AGREEMENT');

-- CreateEnum
CREATE TYPE "MsaVerdict" AS ENUM ('ACCEPTABLE', 'CONDITIONAL', 'UNACCEPTABLE');

-- CreateEnum
CREATE TYPE "InstrumentStatus" AS ENUM ('ACTIVE', 'OUT_OF_SERVICE', 'RETIRED');

-- CreateTable
CREATE TABLE "CalibrationInstrument" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "InstrumentKind" NOT NULL DEFAULT 'LAB_INSTRUMENT',
    "status" "InstrumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "categoryId" TEXT,
    "siteId" TEXT,
    "departmentId" TEXT,
    "custodianId" TEXT,
    "labRef" TEXT,
    "limsEquipmentId" TEXT,
    "serialNo" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "location" TEXT,
    "assetTag" TEXT,
    "criticality" "InstrumentCriticality" NOT NULL DEFAULT 'MAJOR',
    "calibrationStatus" "CalibrationStatus" NOT NULL DEFAULT 'CALIBRATED',
    "isCalibrationRequired" BOOLEAN NOT NULL DEFAULT true,
    "exemptionReason" TEXT,
    "lastCalibratedAt" TIMESTAMP(3),
    "calibrationDueAt" TIMESTAMP(3),
    "measurementRangeMin" DECIMAL(18,6),
    "measurementRangeMax" DECIMAL(18,6),
    "unitCode" TEXT,
    "resolution" DECIMAL(18,6),
    "accuracyClass" TEXT,
    "mpe" DECIMAL(18,6),
    "qualificationState" "QualificationState" NOT NULL DEFAULT 'NOT_STARTED',
    "aiqGroup" TEXT,
    "gampCategory" TEXT,
    "qrToken" TEXT,
    "receivedAt" TIMESTAMP(3),
    "warrantyUntil" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "retirementReason" TEXT,
    "legalMetrologyStampNo" TEXT,
    "legalMetrologyValidUntil" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalibrationInstrument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationProvider" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProviderType" NOT NULL DEFAULT 'EXTERNAL',
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "country" TEXT,
    "accreditationBody" TEXT,
    "accreditationNo" TEXT,
    "accreditationScope" TEXT,
    "accreditationExpiry" TIMESTAMP(3),
    "limsSupplierId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalibrationProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentCategory" (
    "code" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "InstrumentKind" NOT NULL DEFAULT 'LAB_INSTRUMENT',
    "siteId" TEXT,
    "industryPack" TEXT,
    "description" TEXT,
    "defaultIntervalDays" INTEGER,
    "defaultCriticality" "InstrumentCriticality" NOT NULL DEFAULT 'MAJOR',
    "defaultToleranceType" "ToleranceType",
    "defaultToleranceValue" DECIMAL(18,6),
    "requiresMsa" BOOLEAN NOT NULL DEFAULT false,
    "requiresInUseCheck" BOOLEAN NOT NULL DEFAULT false,
    "inUseCheckFrequency" "InUseFrequency",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationPointTemplate" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "nominalValue" DECIMAL(18,6),
    "nominalPercentOfSpan" DECIMAL(9,4),
    "unitCode" TEXT,
    "toleranceType" "ToleranceType" NOT NULL DEFAULT 'ABSOLUTE',
    "toleranceValue" DECIMAL(18,6) NOT NULL,

    CONSTRAINT "CalibrationPointTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationConfig" (
    "id" TEXT NOT NULL,
    "siteId" TEXT,
    "industryPack" TEXT NOT NULL DEFAULT 'CUSTOM',
    "eventNumberPrefix" TEXT NOT NULL DEFAULT 'CAL',
    "certificateNumberPrefix" TEXT NOT NULL DEFAULT 'CC',
    "dueSoonWindowDays" INTEGER NOT NULL DEFAULT 30,
    "autoSpawnLeadDays" INTEGER NOT NULL DEFAULT 14,
    "graceDays" INTEGER NOT NULL DEFAULT 0,
    "allowEarlyCalibration" BOOLEAN NOT NULL DEFAULT true,
    "earlyWindowDays" INTEGER NOT NULL DEFAULT 15,
    "intervalResetBasis" "IntervalBasis" NOT NULL DEFAULT 'PERFORMED_DATE',
    "blockUseWhenOverdue" BOOLEAN NOT NULL DEFAULT true,
    "blockUseWhenFailed" BOOLEAN NOT NULL DEFAULT true,
    "requireCompetencyToPerform" BOOLEAN NOT NULL DEFAULT false,
    "requirePerformerSignature" BOOLEAN NOT NULL DEFAULT true,
    "requireReviewerSignature" BOOLEAN NOT NULL DEFAULT true,
    "requireApproverSignature" BOOLEAN NOT NULL DEFAULT true,
    "requireReasonForChange" BOOLEAN NOT NULL DEFAULT true,
    "ootImpactAssessmentRequired" BOOLEAN NOT NULL DEFAULT true,
    "ootImpactWindow" "OotWindow" NOT NULL DEFAULT 'SINCE_LAST_CALIBRATION',
    "ootAutoSpawn" TEXT[] DEFAULT ARRAY['DEVIATION']::TEXT[],
    "ootRequiresCustomerNotification" BOOLEAN NOT NULL DEFAULT false,
    "ootRequiresProductHold" BOOLEAN NOT NULL DEFAULT false,
    "enableMsa" BOOLEAN NOT NULL DEFAULT false,
    "enableInUseChecks" BOOLEAN NOT NULL DEFAULT false,
    "enableLegalMetrology" BOOLEAN NOT NULL DEFAULT false,
    "enableAiqGroups" BOOLEAN NOT NULL DEFAULT false,
    "enableUsageIntervals" BOOLEAN NOT NULL DEFAULT false,
    "labelTemplate" JSONB,
    "certificateTemplate" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalibrationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationPlan" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "intervalType" "IntervalType" NOT NULL DEFAULT 'MONTHS',
    "intervalValue" INTEGER NOT NULL DEFAULT 12,
    "intervalJustification" TEXT,
    "methodDocId" TEXT,
    "methodRef" TEXT,
    "providerType" "ProviderType" NOT NULL DEFAULT 'INTERNAL',
    "providerId" TEXT,
    "estimatedDurationHours" DECIMAL(6,2),
    "requiresMsa" BOOLEAN NOT NULL DEFAULT false,
    "requiredCourseId" TEXT,
    "requiredStandardCategoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "nextDueAt" TIMESTAMP(3),
    "lastEventId" TEXT,
    "supersededById" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalibrationPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationPoint" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "nominalValue" DECIMAL(18,6) NOT NULL,
    "unitCode" TEXT,
    "toleranceType" "ToleranceType" NOT NULL DEFAULT 'ABSOLUTE',
    "toleranceValue" DECIMAL(18,6) NOT NULL,
    "lowerLimit" DECIMAL(18,6) NOT NULL,
    "upperLimit" DECIMAL(18,6) NOT NULL,

    CONSTRAINT "CalibrationPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationEvent" (
    "id" TEXT NOT NULL,
    "eventNo" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "planId" TEXT,
    "planVersion" INTEGER,
    "type" "CalibrationEventType" NOT NULL DEFAULT 'PERIODIC',
    "status" "CalibrationEventStatus" NOT NULL DEFAULT 'PLANNED',
    "siteId" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "performedAt" TIMESTAMP(3),
    "performedById" TEXT,
    "performedByExternal" TEXT,
    "providerType" "ProviderType" NOT NULL DEFAULT 'INTERNAL',
    "providerId" TEXT,
    "ambientTemperature" DECIMAL(8,3),
    "ambientHumidity" DECIMAL(8,3),
    "environmentNotes" TEXT,
    "asFoundOutcome" "CalibrationOutcome",
    "asLeftOutcome" "CalibrationOutcome",
    "overallOutcome" "CalibrationOutcome",
    "adjustmentMade" BOOLEAN NOT NULL DEFAULT false,
    "certificateNo" TEXT,
    "certificateDocId" TEXT,
    "nextDueAt" TIMESTAMP(3),
    "remarks" TEXT,
    "ticketId" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "cancelReason" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalibrationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationReading" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "nominalValue" DECIMAL(18,6) NOT NULL,
    "unitCode" TEXT,
    "lowerLimit" DECIMAL(18,6) NOT NULL,
    "upperLimit" DECIMAL(18,6) NOT NULL,
    "asFoundValue" DECIMAL(18,6),
    "asFoundError" DECIMAL(18,6),
    "asFoundInTolerance" BOOLEAN,
    "asLeftValue" DECIMAL(18,6),
    "asLeftError" DECIMAL(18,6),
    "asLeftInTolerance" BOOLEAN,
    "uncertainty" DECIMAL(18,6),
    "remarks" TEXT,

    CONSTRAINT "CalibrationReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationStandardUse" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "standardInstrumentId" TEXT NOT NULL,
    "certificateNo" TEXT,
    "certificateValidUntil" TIMESTAMP(3),
    "traceableTo" TEXT,
    "wasValidAtUse" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalibrationStandardUse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutOfToleranceAssessment" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" "OotStatus" NOT NULL DEFAULT 'OPEN',
    "impactWindowFrom" TIMESTAMP(3) NOT NULL,
    "impactWindowTo" TIMESTAMP(3) NOT NULL,
    "maxObservedError" DECIMAL(18,6),
    "affectedResultIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "affectedQcResultIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "affectedSampleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "affectedBatchRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "affectedTicketIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastScannedAt" TIMESTAMP(3),
    "disposition" "OotDisposition",
    "justification" TEXT,
    "qaComments" TEXT,
    "deviationTicketId" TEXT,
    "capaTicketId" TEXT,
    "riskId" TEXT,
    "customerNotificationRequired" BOOLEAN NOT NULL DEFAULT false,
    "customerNotifiedAt" TIMESTAMP(3),
    "customerNotificationRef" TEXT,
    "productHoldRequired" BOOLEAN NOT NULL DEFAULT false,
    "productHoldRef" TEXT,
    "assessedById" TEXT,
    "assessedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutOfToleranceAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InUseVerification" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "performedById" TEXT,
    "shift" TEXT,
    "outcome" "CalibrationOutcome" NOT NULL,
    "readings" JSONB NOT NULL,
    "batchRef" TEXT,
    "remarks" TEXT,
    "holdTriggered" BOOLEAN NOT NULL DEFAULT false,
    "holdRef" TEXT,
    "holdWindowFrom" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InUseVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MsaStudy" (
    "id" TEXT NOT NULL,
    "studyNo" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "type" "MsaStudyType" NOT NULL DEFAULT 'GAGE_RR_CROSSED',
    "performedAt" TIMESTAMP(3) NOT NULL,
    "performedById" TEXT,
    "partCount" INTEGER NOT NULL DEFAULT 10,
    "operatorCount" INTEGER NOT NULL DEFAULT 3,
    "trialCount" INTEGER NOT NULL DEFAULT 3,
    "repeatabilityEv" DECIMAL(18,6),
    "reproducibilityAv" DECIMAL(18,6),
    "grr" DECIMAL(18,6),
    "partVariation" DECIMAL(18,6),
    "totalVariation" DECIMAL(18,6),
    "grrPercent" DECIMAL(9,4),
    "ndc" INTEGER,
    "verdict" "MsaVerdict",
    "toleranceUsed" DECIMAL(18,6),
    "notes" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MsaStudy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MsaTrial" (
    "id" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "partNo" INTEGER NOT NULL,
    "operator" INTEGER NOT NULL,
    "trial" INTEGER NOT NULL,
    "measured" DECIMAL(18,6) NOT NULL,

    CONSTRAINT "MsaTrial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationInstrument_code_key" ON "CalibrationInstrument"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationInstrument_qrToken_key" ON "CalibrationInstrument"("qrToken");

-- CreateIndex
CREATE INDEX "CalibrationInstrument_kind_calibrationStatus_idx" ON "CalibrationInstrument"("kind", "calibrationStatus");

-- CreateIndex
CREATE INDEX "CalibrationInstrument_calibrationDueAt_idx" ON "CalibrationInstrument"("calibrationDueAt");

-- CreateIndex
CREATE INDEX "CalibrationInstrument_siteId_idx" ON "CalibrationInstrument"("siteId");

-- CreateIndex
CREATE INDEX "CalibrationInstrument_custodianId_idx" ON "CalibrationInstrument"("custodianId");

-- CreateIndex
CREATE INDEX "CalibrationInstrument_categoryId_idx" ON "CalibrationInstrument"("categoryId");

-- CreateIndex
CREATE INDEX "CalibrationInstrument_limsEquipmentId_idx" ON "CalibrationInstrument"("limsEquipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationProvider_code_key" ON "CalibrationProvider"("code");

-- CreateIndex
CREATE INDEX "CalibrationProvider_isActive_idx" ON "CalibrationProvider"("isActive");

-- CreateIndex
CREATE INDEX "CalibrationProvider_accreditationExpiry_idx" ON "CalibrationProvider"("accreditationExpiry");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentCategory_code_key" ON "EquipmentCategory"("code");

-- CreateIndex
CREATE INDEX "EquipmentCategory_kind_idx" ON "EquipmentCategory"("kind");

-- CreateIndex
CREATE INDEX "EquipmentCategory_industryPack_idx" ON "EquipmentCategory"("industryPack");

-- CreateIndex
CREATE INDEX "EquipmentCategory_siteId_idx" ON "EquipmentCategory"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationPointTemplate_categoryId_sequence_key" ON "CalibrationPointTemplate"("categoryId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationConfig_siteId_key" ON "CalibrationConfig"("siteId");

-- CreateIndex
CREATE INDEX "CalibrationPlan_instrumentId_isActive_idx" ON "CalibrationPlan"("instrumentId", "isActive");

-- CreateIndex
CREATE INDEX "CalibrationPlan_nextDueAt_idx" ON "CalibrationPlan"("nextDueAt");

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationPlan_instrumentId_version_key" ON "CalibrationPlan"("instrumentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationPoint_planId_sequence_key" ON "CalibrationPoint"("planId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationEvent_eventNo_key" ON "CalibrationEvent"("eventNo");

-- CreateIndex
CREATE INDEX "CalibrationEvent_instrumentId_performedAt_idx" ON "CalibrationEvent"("instrumentId", "performedAt");

-- CreateIndex
CREATE INDEX "CalibrationEvent_status_idx" ON "CalibrationEvent"("status");

-- CreateIndex
CREATE INDEX "CalibrationEvent_siteId_idx" ON "CalibrationEvent"("siteId");

-- CreateIndex
CREATE INDEX "CalibrationEvent_nextDueAt_idx" ON "CalibrationEvent"("nextDueAt");

-- CreateIndex
CREATE INDEX "CalibrationEvent_scheduledFor_idx" ON "CalibrationEvent"("scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationReading_eventId_sequence_key" ON "CalibrationReading"("eventId", "sequence");

-- CreateIndex
CREATE INDEX "CalibrationStandardUse_standardInstrumentId_idx" ON "CalibrationStandardUse"("standardInstrumentId");

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationStandardUse_eventId_standardInstrumentId_key" ON "CalibrationStandardUse"("eventId", "standardInstrumentId");

-- CreateIndex
CREATE UNIQUE INDEX "OutOfToleranceAssessment_eventId_key" ON "OutOfToleranceAssessment"("eventId");

-- CreateIndex
CREATE INDEX "OutOfToleranceAssessment_status_idx" ON "OutOfToleranceAssessment"("status");

-- CreateIndex
CREATE INDEX "InUseVerification_instrumentId_performedAt_idx" ON "InUseVerification"("instrumentId", "performedAt");

-- CreateIndex
CREATE INDEX "InUseVerification_outcome_idx" ON "InUseVerification"("outcome");

-- CreateIndex
CREATE UNIQUE INDEX "MsaStudy_studyNo_key" ON "MsaStudy"("studyNo");

-- CreateIndex
CREATE INDEX "MsaStudy_instrumentId_idx" ON "MsaStudy"("instrumentId");

-- CreateIndex
CREATE UNIQUE INDEX "MsaTrial_studyId_partNo_operator_trial_key" ON "MsaTrial"("studyId", "partNo", "operator", "trial");

-- AddForeignKey
ALTER TABLE "CalibrationInstrument" ADD CONSTRAINT "CalibrationInstrument_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EquipmentCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationPointTemplate" ADD CONSTRAINT "CalibrationPointTemplate_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EquipmentCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationPlan" ADD CONSTRAINT "CalibrationPlan_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "CalibrationInstrument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationPlan" ADD CONSTRAINT "CalibrationPlan_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "CalibrationProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationPoint" ADD CONSTRAINT "CalibrationPoint_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CalibrationPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationEvent" ADD CONSTRAINT "CalibrationEvent_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "CalibrationInstrument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationEvent" ADD CONSTRAINT "CalibrationEvent_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CalibrationPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationEvent" ADD CONSTRAINT "CalibrationEvent_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "CalibrationProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationReading" ADD CONSTRAINT "CalibrationReading_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalibrationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationStandardUse" ADD CONSTRAINT "CalibrationStandardUse_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalibrationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationStandardUse" ADD CONSTRAINT "CalibrationStandardUse_standardInstrumentId_fkey" FOREIGN KEY ("standardInstrumentId") REFERENCES "CalibrationInstrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutOfToleranceAssessment" ADD CONSTRAINT "OutOfToleranceAssessment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalibrationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InUseVerification" ADD CONSTRAINT "InUseVerification_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "CalibrationInstrument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MsaStudy" ADD CONSTRAINT "MsaStudy_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "CalibrationInstrument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MsaTrial" ADD CONSTRAINT "MsaTrial_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "MsaStudy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
