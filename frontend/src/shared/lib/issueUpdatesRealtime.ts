import type { IssueUpdate } from "../api/types/issues";

export function upsertIssueUpdates(
  current: IssueUpdate[] = [],
  incoming: IssueUpdate | IssueUpdate[],
): IssueUpdate[] {
  const nextItems = Array.isArray(incoming) ? incoming : [incoming];
  const merged = new Map<number, IssueUpdate>();

  for (const item of current) {
    merged.set(item.updateId, item);
  }

  for (const item of nextItems) {
    merged.set(item.updateId, item);
  }

  return [...merged.values()].sort((left, right) => right.updateId - left.updateId);
}

export function getLatestIssueUpdateId(updates: IssueUpdate[] = []): number {
  return updates.reduce((latest, update) => {
    return update.updateId > latest ? update.updateId : latest;
  }, 0);
}
