import type { Issue } from "@shared/api/types/issues";

function arrEq(a: string[], b: string[]) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
}

export function buildIssueEditActivityMessage(
    before: Issue,
    after: {
        title: string;
        description: string;
        type: string;
        status: string;
        priority: string;
        tags: string[];
    }
): string {
    const changes: string[] = [];

    if (before.title !== after.title) changes.push(`title "${before.title}" -> "${after.title}"`);
    if (before.description !== after.description) changes.push("description updated");
    if (before.type !== after.type) changes.push(`type ${before.type} -> ${after.type}`);
    if (before.status !== after.status) changes.push(`status ${before.status} -> ${after.status}`);
    if (before.priority !== after.priority) changes.push(`priority ${before.priority} -> ${after.priority}`);

    const prevTags = (before.tags ?? []).map((t) => t.name).sort();
    const nextTags = [...after.tags].sort();
    if (!arrEq(prevTags, nextTags)) changes.push(`tags [${prevTags.join(", ")}] -> [${nextTags.join(", ")}]`);

    return changes.length ? `Updated: ${changes.join("; ")}` : "Issue updated";
}
