-- No-op: RBAC tables and has_permission are defined in 20260209232412 and
-- canonical functions in 20260407120000_rbac_canonical_permission_functions.sql.
-- The alternate role_id / roles.code shape in this file breaks db push when 232412 ran first.

SELECT 1;
