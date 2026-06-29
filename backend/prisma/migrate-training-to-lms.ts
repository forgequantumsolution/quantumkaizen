/**
 * One-time data backfill: legacy Training → LMS (Phase 1).
 *
 * Maps each `TrainingItem` → an `LmsCourse` (type DOC_ACK, version 1) and each
 * `TrainingAssignment` → an `LmsEnrollment`. Non-destructive and idempotent —
 * re-running skips rows already migrated (matched by course `code` and the
 * enrollment unique key). The legacy tables are left intact for the transition
 * period; drop them in a later migration once the LMS UI is cut over.
 *
 * Run:  npx tsx prisma/migrate-training-to-lms.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const items = await prisma.trainingItem.findMany({
    where: { isDeleted: false },
    include: { assignments: true },
  });
  console.log(`Found ${items.length} training items to migrate.`);

  let coursesCreated = 0;
  let enrollmentsCreated = 0;

  for (const item of items) {
    // Course is keyed by [code, version]; reuse the legacy code at version 1.
    let course = await prisma.lmsCourse.findFirst({
      where: { code: item.code, version: 1 },
    });

    if (!course) {
      course = await prisma.lmsCourse.create({
        data: {
          code: item.code,
          title: item.title,
          description: item.description,
          type: 'DOC_ACK',
          status: item.isActive ? 'PUBLISHED' : 'RETIRED',
          version: 1,
          isLatestVersion: true,
          documentId: item.documentId,
          ownerId: item.createdById,
          createdById: item.createdById,
          publishedAt: item.isActive ? item.createdAt : null,
          effectiveDate: item.isActive ? item.createdAt : null,
        },
      });
      coursesCreated++;
    }

    for (const a of item.assignments) {
      const exists = await prisma.lmsEnrollment.findUnique({
        where: {
          courseId_userId_courseVersion: {
            courseId: course.id,
            userId: a.userId,
            courseVersion: 1,
          },
        },
      });
      if (exists) continue;

      await prisma.lmsEnrollment.create({
        data: {
          courseId: course.id,
          courseVersion: 1,
          userId: a.userId,
          status: a.status === 'COMPLETED' ? 'COMPLETED' : 'ASSIGNED',
          source: 'DIRECT',
          dueDate: a.dueDate,
          assignedById: a.assignedById,
          assignedAt: a.assignedAt,
          startedAt: a.status === 'COMPLETED' ? a.assignedAt : null,
          completedAt: a.completedAt,
          progressPct: a.status === 'COMPLETED' ? 100 : 0,
        },
      });
      enrollmentsCreated++;
    }
  }

  console.log(
    `Done. Courses created: ${coursesCreated}, enrollments created: ${enrollmentsCreated}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
