import Link from "next/link";
import {
  isAllowedContentBlockType,
  type StructuredContentBlock,
} from "@yatra/domain/content/structured-content";

function blocksFromUnknown(value: unknown): StructuredContentBlock[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      return [];
    }

    const source = entry as Record<string, unknown>;
    const type = typeof source.type === "string" ? source.type : "";
    const id = typeof source.id === "string" ? source.id : "";

    if (!id || !isAllowedContentBlockType(type)) return [];

    const data =
      typeof source.data === "object" &&
      source.data !== null &&
      !Array.isArray(source.data)
        ? (source.data as Record<string, unknown>)
        : {};

    return [{ id, type, data }];
  });
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
}

export function StructuredContentRenderer({ body }: { body: unknown }) {
  const blocks = blocksFromUnknown(body);
  if (blocks.length === 0) return null;

  return (
    <div className="structured-content">
      {blocks.map((block) => {
        const data = block.data;

        if (block.type === "paragraph") {
          const value = text(data.text);
          return value ? <p key={block.id}>{value}</p> : null;
        }

        if (block.type === "heading") {
          const value = text(data.text);
          const level = data.level === 3 ? 3 : 2;
          if (!value) return null;
          return level === 3
            ? <h3 key={block.id}>{value}</h3>
            : <h2 key={block.id}>{value}</h2>;
        }

        if (block.type === "quote") {
          const value = text(data.text);
          const attribution = text(data.attribution);
          return value ? (
            <blockquote key={block.id}>
              <p>{value}</p>
              {attribution ? <cite>{attribution}</cite> : null}
            </blockquote>
          ) : null;
        }

        if (block.type === "callout") {
          const title = text(data.title);
          const value = text(data.text);
          if (!title && !value) return null;
          return (
            <aside className="structured-callout" key={block.id}>
              {title ? <h3>{title}</h3> : null}
              {value ? <p>{value}</p> : null}
            </aside>
          );
        }

        if (block.type === "cta") {
          const label = text(data.label);
          const href = text(data.href);
          const value = text(data.text);
          if (!label || !href || !href.startsWith("/") || href.startsWith("//")) return null;
          return (
            <div className="structured-cta" key={block.id}>
              {value ? <p>{value}</p> : null}
              <Link className="button-link button-link--primary" href={href}>
                {label}
              </Link>
            </div>
          );
        }

        if (block.type === "list" || block.type === "routeHighlights" || block.type === "itinerarySummary") {
          const items = stringList(data.items);
          if (items.length === 0) return null;
          return (
            <ul key={block.id}>
              {items.map((item, index) => <li key={`${block.id}-${index}`}>{item}</li>)}
            </ul>
          );
        }

        if (block.type === "image") {
          const url = text(data.url);
          const alt = text(data.alt) ?? "";
          const caption = text(data.caption);
          if (!url || !(url.startsWith("https://") || url.startsWith("/"))) return null;
          return (
            <figure key={block.id}>
              <img src={url} alt={alt} loading="lazy"/>
              {caption ? <figcaption>{caption}</figcaption> : null}
            </figure>
          );
        }

        if (block.type === "faqGroup") {
          if (!Array.isArray(data.items)) return null;
          const items = data.items.flatMap((item: unknown) => {
            if (typeof item !== "object" || item === null || Array.isArray(item)) return [];
            const source = item as Record<string, unknown>;
            const question = text(source.question);
            const answer = text(source.answer);
            return question && answer ? [{ question, answer }] : [];
          });
          if (!items.length) return null;
          return (
            <div className="structured-faq" key={block.id}>
              {items.map((item: { question: string; answer: string }, index: number) => (
                <details key={`${block.id}-${index}`}>
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          );
        }

        if (block.type === "gallery") {
          if (!Array.isArray(data.items)) return null;
          const items = data.items.flatMap((item: unknown) => {
            if (typeof item !== "object" || item === null || Array.isArray(item)) return [];
            const source = item as Record<string, unknown>;
            const url = text(source.url);
            const alt = text(source.alt) ?? "";
            return url && (url.startsWith("https://") || url.startsWith("/"))
              ? [{ url, alt }]
              : [];
          });
          if (!items.length) return null;
          return (
            <div className="structured-gallery" key={block.id}>
              {items.map((item: { url: string; alt: string }, index: number) => (
                <img key={`${block.id}-${index}`} src={item.url} alt={item.alt} loading="lazy"/>
              ))}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
