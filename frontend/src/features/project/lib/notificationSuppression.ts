const suppressedProjectRemovalStorageKey = "bugboard26:suppressed-project-removals";

function readSuppressedProjectRemovalIds(): number[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.sessionStorage.getItem(suppressedProjectRemovalStorageKey);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((value): value is number => Number.isInteger(value) && value > 0);
  } catch {
    return [];
  }
}

function writeSuppressedProjectRemovalIds(projectIds: number[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (projectIds.length === 0) {
      window.sessionStorage.removeItem(suppressedProjectRemovalStorageKey);
      return;
    }

    window.sessionStorage.setItem(
      suppressedProjectRemovalStorageKey,
      JSON.stringify(projectIds),
    );
  } catch {
    // Ignore storage errors and keep the UX functional.
  }
}

export function suppressOwnProjectRemovalNotification(projectId: number) {
  const currentIds = readSuppressedProjectRemovalIds();
  if (currentIds.includes(projectId)) {
    return;
  }

  writeSuppressedProjectRemovalIds([...currentIds, projectId]);
}

export function consumeOwnProjectRemovalNotificationSuppression(projectId: number): boolean {
  const currentIds = readSuppressedProjectRemovalIds();
  if (!currentIds.includes(projectId)) {
    return false;
  }

  writeSuppressedProjectRemovalIds(currentIds.filter((id) => id !== projectId));
  return true;
}
