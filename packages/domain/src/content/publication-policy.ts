export const contentStatuses = [
  "DRAFT",
  "REVIEW",
  "SCHEDULED",
  "PUBLISHED",
  "ARCHIVED",
] as const;

export type ContentStatus = (typeof contentStatuses)[number];

export type PublishableContent = {
  status: ContentStatus;
  publishedAt: Date | null;
  scheduledFor?: Date | null;
};

export function isPubliclyVisible(
  content: PublishableContent,
  now = new Date(),
): boolean {
  if (content.status !== "PUBLISHED") {
    return false;
  }

  if (!content.publishedAt || content.publishedAt > now) {
    return false;
  }

  return true;
}

export function canTransitionContent(
  from: ContentStatus,
  to: ContentStatus,
): boolean {
  const transitions: Record<ContentStatus, readonly ContentStatus[]> = {
    DRAFT: ["REVIEW", "SCHEDULED", "PUBLISHED", "ARCHIVED"],
    REVIEW: ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"],
    SCHEDULED: ["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"],
    PUBLISHED: ["DRAFT", "ARCHIVED"],
    ARCHIVED: ["DRAFT"],
  };

  return transitions[from].includes(to);
}
