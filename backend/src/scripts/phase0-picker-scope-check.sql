-- ============================================================================
-- PHASE 0 picker-scope check (docs/access-control-data-scoping-plan.md)
-- Read-only. Safe to run on production. No writes, no locks of consequence.
--
-- Answers: if we type-scope the people picker (show only users who effectively
-- hold `wf_type.<typeId>.read`), how many users survive per type, and would any
-- currently-assigned AUDIT staff (Lead Auditor / Approver / Team Members)
-- disappear from the audit staffing picker?
--
-- Effective-holder logic mirrors computeEffectivePermissions:
--   holder = (role grants OR department grants OR user GRANT override)
--            AND NOT user DENY override      (deny wins)
--
-- Implicit M2M join-table columns (Prisma, alphabetical by model name):
--   "_RolePermissions"        : "A" = Permission.id, "B" = Role.id
--   "_DepartmentPermissions"  : "A" = Department.id, "B" = Permission.id
-- ============================================================================

\echo '=== DB in use (must be kaizen_qms, NOT quantumkaizen) ==='
SELECT current_database() AS db;

\echo ''
\echo '=== Per-type: active users who survive a wf_type.<id>.read filter ==='
WITH read_perm AS (
  SELECT p.id AS perm_id, wt.id AS type_id, wt.name AS type_name
  FROM "WorkflowType" wt
  JOIN "Permission" p ON p.key = 'wf_type.' || wt.id || '.read'
  WHERE wt."isDeleted" = false
),
holders AS (
  SELECT rp.type_name, u.id AS user_id, COALESCE(s.code, 'NO-SITE') AS site_code
  FROM read_perm rp
  JOIN "User" u ON u."isActive" = true
  LEFT JOIN "Site" s ON s.id = u."siteId"
  WHERE (
        EXISTS (SELECT 1 FROM "_RolePermissions" x
                WHERE x."A" = rp.perm_id AND x."B" = u."roleId")
     OR EXISTS (SELECT 1 FROM "_DepartmentPermissions" y
                WHERE y."B" = rp.perm_id AND y."A" = u."departmentId")
     OR EXISTS (SELECT 1 FROM "UserPermission" up
                WHERE up."userId" = u.id AND up."permissionId" = rp.perm_id
                  AND up.effect = 'GRANT')
  )
  AND NOT EXISTS (SELECT 1 FROM "UserPermission" up2
                  WHERE up2."userId" = u.id AND up2."permissionId" = rp.perm_id
                    AND up2.effect = 'DENY')
),
by_site AS (
  SELECT type_name, site_code, COUNT(*) AS c
  FROM holders GROUP BY type_name, site_code
)
SELECT
  h.type_name,
  COUNT(*) AS holders,
  (SELECT COUNT(*) FROM "User" WHERE "isActive" = true) AS total_active,
  (SELECT string_agg(bs.site_code || ':' || bs.c, ' ' ORDER BY bs.site_code)
     FROM by_site bs WHERE bs.type_name = h.type_name) AS by_site,
  CASE WHEN COUNT(*) = 0 THEN 'EMPTY -> picker blank'
       WHEN COUNT(*) <= 2 THEN 'very small'
       ELSE '' END AS flag
FROM holders h
GROUP BY h.type_name
ORDER BY h.type_name;

\echo ''
\echo '=== Audit staffing cross-check: assigned staff vs. audit-key holders ==='
WITH audit_type AS (
  SELECT id FROM "WorkflowType"
  WHERE lower(trim(name)) = 'audit' AND "isDeleted" = false
  LIMIT 1
),
audit_perm AS (
  SELECT p.id AS perm_id
  FROM "Permission" p JOIN audit_type at ON p.key = 'wf_type.' || at.id || '.read'
),
staff AS (
  SELECT DISTINCT uid FROM (
    SELECT "auditorId"    AS uid FROM "AuditRegister" WHERE "auditorId"    IS NOT NULL
    UNION SELECT "approverId"     FROM "AuditRegister" WHERE "approverId"    IS NOT NULL
    UNION SELECT "approvedById"   FROM "AuditRegister" WHERE "approvedById"  IS NOT NULL
    UNION SELECT (m->>'id')
          FROM "AuditRegister",
               jsonb_array_elements(
                 CASE WHEN jsonb_typeof("teamMembers") = 'array'
                      THEN "teamMembers" ELSE '[]'::jsonb END) AS m
          WHERE m->>'id' IS NOT NULL
  ) q WHERE uid IS NOT NULL
)
SELECT
  u.name,
  u."isActive" AS active,
  CASE WHEN (
        EXISTS (SELECT 1 FROM audit_perm ap
                WHERE EXISTS (SELECT 1 FROM "_RolePermissions" x
                              WHERE x."A" = ap.perm_id AND x."B" = u."roleId")
                   OR EXISTS (SELECT 1 FROM "_DepartmentPermissions" y
                              WHERE y."B" = ap.perm_id AND y."A" = u."departmentId")
                   OR EXISTS (SELECT 1 FROM "UserPermission" up
                              WHERE up."userId" = u.id AND up."permissionId" = ap.perm_id
                                AND up.effect = 'GRANT'))
    AND NOT EXISTS (SELECT 1 FROM audit_perm ap2
                    JOIN "UserPermission" up2
                      ON up2."permissionId" = ap2.perm_id
                    WHERE up2."userId" = u.id AND up2.effect = 'DENY')
  ) THEN 'HOLDS' ELSE 'MISSING -> would vanish' END AS audit_key
FROM staff st JOIN "User" u ON u.id = st.uid
ORDER BY audit_key, u.name;

\echo ''
\echo '=== Verdict: any EMPTY/very-small type above, or any "would vanish" row, ==='
\echo '=== means keep that picker site-only (do NOT type-scope it).             ==='
