type AdminLike = {
  isAdmin?: boolean | null;
  role?: string | null;
  group?: string | null;
};

function normalizeRole(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

export function isAdminLike(entity: AdminLike | null | undefined): boolean {
  if (!entity) return false;
  if (entity.isAdmin === true) return true;

  const role = normalizeRole(entity.role);
  const group = normalizeRole(entity.group);

  return role === "admin" || role === "administrator" || group === "admin" || group === "administrator";
}
