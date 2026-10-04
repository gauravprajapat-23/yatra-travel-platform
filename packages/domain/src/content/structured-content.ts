export const contentBlockTypes = [
  "paragraph",
  "heading",
  "image",
  "gallery",
  "quote",
  "callout",
  "cta",
  "list",
  "routeHighlights",
  "itinerarySummary",
  "faqGroup",
] as const;

export type ContentBlockType = (typeof contentBlockTypes)[number];

export type StructuredContentBlock = {
  type: ContentBlockType;
  id: string;
  data: Record<string, unknown>;
};

export function isAllowedContentBlockType(
  value: string,
): value is ContentBlockType {
  return (contentBlockTypes as readonly string[]).includes(value);
}

/**
 * CMS bodies are stored as structured JSON.
 * Raw executable HTML/script is intentionally not an allowed block type.
 */
export function assertStructuredContent(
  blocks: readonly StructuredContentBlock[],
): void {
  for (const block of blocks) {
    if (!isAllowedContentBlockType(block.type)) {
      throw new Error(`Unsupported content block type: ${block.type}`);
    }

    if (!block.id.trim()) {
      throw new Error("Structured content block id is required.");
    }
  }
}
