"use client";

import { useMemo, useState } from "react";
import {
  contentBlockTypes,
  type ContentBlockType,
  type StructuredContentBlock,
} from "@yatra/domain/content/structured-content";

type Block = StructuredContentBlock;

function normalizeBlocks(value: unknown): Block[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      return [];
    }

    const source = entry as Record<string, unknown>;
    const type =
      typeof source.type === "string" &&
      (contentBlockTypes as readonly string[]).includes(source.type)
        ? (source.type as ContentBlockType)
        : null;

    if (!type) return [];

    return [{
      id:
        typeof source.id === "string" && source.id.trim()
          ? source.id
          : crypto.randomUUID(),
      type,
      data:
        typeof source.data === "object" &&
        source.data !== null &&
        !Array.isArray(source.data)
          ? (source.data as Record<string, unknown>)
          : {},
    }];
  });
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown, fallback = 2): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function listText(value: unknown): string {
  return stringList(value).join("\n");
}

function parseLines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function faqText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .flatMap((item) => {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        return [];
      }
      const source = item as Record<string, unknown>;
      const q = stringValue(source.question).trim();
      const a = stringValue(source.answer).trim();
      return q || a ? [`${q} | ${a}`] : [];
    })
    .join("\n");
}

function parseFaq(value: string) {
  return value
    .split("\n")
    .map((line) => {
      const [question, ...rest] = line.split("|");
      return {
        question: question?.trim() ?? "",
        answer: rest.join("|").trim(),
      };
    })
    .filter((item) => item.question && item.answer);
}

function galleryText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .flatMap((item) => {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        return [];
      }
      const source = item as Record<string, unknown>;
      const url = stringValue(source.url).trim();
      const alt = stringValue(source.alt).trim();
      return url ? [`${url} | ${alt}`] : [];
    })
    .join("\n");
}

function parseGallery(value: string) {
  return value
    .split("\n")
    .map((line) => {
      const [url, ...rest] = line.split("|");
      return {
        url: url?.trim() ?? "",
        alt: rest.join("|").trim(),
      };
    })
    .filter((item) => item.url);
}

function blockLabel(type: ContentBlockType): string {
  return type
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function newBlock(type: ContentBlockType): Block {
  return {
    id: crypto.randomUUID(),
    type,
    data:
      type === "heading"
        ? { text: "", level: 2 }
        : type === "list" ||
            type === "routeHighlights" ||
            type === "itinerarySummary"
          ? { items: [] }
          : type === "gallery" || type === "faqGroup"
            ? { items: [] }
            : {},
  };
}

export function AdminStructuredContentEditor({
  name = "body",
  initialValue,
}: {
  name?: string;
  initialValue: unknown;
}) {
  const initialBlocks = useMemo(
    () => normalizeBlocks(initialValue),
    [initialValue],
  );
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [addType, setAddType] = useState<ContentBlockType>("paragraph");
  const [advanced, setAdvanced] = useState(false);
  const [advancedJson, setAdvancedJson] = useState(
    JSON.stringify(initialBlocks, null, 2),
  );

  const serialized = advanced
    ? advancedJson
    : JSON.stringify(blocks, null, 2);

  function setBlockData(
    id: string,
    updater: (data: Record<string, unknown>) => Record<string, unknown>,
  ) {
    setBlocks((current) =>
      current.map((block) =>
        block.id === id
          ? { ...block, data: updater(block.data) }
          : block,
      ),
    );
  }

  function move(index: number, offset: -1 | 1) {
    const target = index + offset;
    if (target < 0 || target >= blocks.length) return;

    setBlocks((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  function remove(id: string) {
    setBlocks((current) => current.filter((block) => block.id !== id));
  }

  function toggleAdvanced() {
    if (!advanced) {
      setAdvancedJson(JSON.stringify(blocks, null, 2));
      setAdvanced(true);
      return;
    }

    try {
      const parsed = JSON.parse(advancedJson);
      setBlocks(normalizeBlocks(parsed));
      setAdvanced(false);
    } catch {
      window.alert("Advanced JSON must be valid before returning to guided mode.");
    }
  }

  return (
    <div className="admin-block-editor">
      <textarea
        name={name}
        value={serialized}
        readOnly
        hidden
        aria-hidden="true"
      />

      <div className="admin-block-editor__toolbar">
        <div>
          <strong>Content blocks</strong>
          <small>
            Build safe structured content without editing JSON manually.
          </small>
        </div>
        <button
          className="admin-secondary-button"
          type="button"
          onClick={toggleAdvanced}
        >
          {advanced ? "Return to Guided Editor" : "Advanced JSON"}
        </button>
      </div>

      {advanced ? (
        <label className="admin-field admin-field--wide">
          <span className="admin-field__label">Structured JSON</span>
          <textarea
            className="admin-block-editor__json"
            value={advancedJson}
            onChange={(event) => setAdvancedJson(event.target.value)}
            rows={24}
            spellCheck={false}
          />
          <small className="admin-field__hint">
            Advanced mode submits directly to the existing server-side structured-content validator.
          </small>
        </label>
      ) : (
        <>
          {blocks.length === 0 ? (
            <div className="admin-block-editor__empty">
              <strong>No content blocks yet</strong>
              <p>Add a paragraph, heading, image, FAQ group or another supported block.</p>
            </div>
          ) : null}

          <div className="admin-block-editor__list">
            {blocks.map((block, index) => (
              <section className="admin-block-card" key={block.id}>
                <header className="admin-block-card__header">
                  <div>
                    <span>{index + 1}</span>
                    <strong>{blockLabel(block.type)}</strong>
                  </div>
                  <div className="admin-block-card__actions">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label="Move block up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === blocks.length - 1}
                      aria-label="Move block down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(block.id)}
                      aria-label="Delete block"
                    >
                      ×
                    </button>
                  </div>
                </header>

                <div className="admin-block-card__body">
                  {block.type === "paragraph" ? (
                    <label className="admin-field admin-field--wide">
                      <span className="admin-field__label">Paragraph</span>
                      <textarea
                        value={stringValue(block.data.text)}
                        onChange={(event) =>
                          setBlockData(block.id, (data) => ({
                            ...data,
                            text: event.target.value,
                          }))
                        }
                        rows={5}
                        placeholder="Write the paragraph text…"
                      />
                    </label>
                  ) : null}

                  {block.type === "heading" ? (
                    <div className="admin-form-grid admin-form-grid--2">
                      <label className="admin-field">
                        <span className="admin-field__label">Heading</span>
                        <input
                          value={stringValue(block.data.text)}
                          onChange={(event) =>
                            setBlockData(block.id, (data) => ({
                              ...data,
                              text: event.target.value,
                            }))
                          }
                          placeholder="Section heading"
                        />
                      </label>
                      <label className="admin-field">
                        <span className="admin-field__label">Level</span>
                        <select
                          value={numberValue(block.data.level)}
                          onChange={(event) =>
                            setBlockData(block.id, (data) => ({
                              ...data,
                              level: Number(event.target.value),
                            }))
                          }
                        >
                          <option value={2}>H2</option>
                          <option value={3}>H3</option>
                        </select>
                      </label>
                    </div>
                  ) : null}

                  {block.type === "quote" ? (
                    <div className="admin-form-grid admin-form-grid--1">
                      <label className="admin-field">
                        <span className="admin-field__label">Quote</span>
                        <textarea
                          value={stringValue(block.data.text)}
                          onChange={(event) =>
                            setBlockData(block.id, (data) => ({
                              ...data,
                              text: event.target.value,
                            }))
                          }
                          rows={4}
                        />
                      </label>
                      <label className="admin-field">
                        <span className="admin-field__label">Attribution</span>
                        <input
                          value={stringValue(block.data.attribution)}
                          onChange={(event) =>
                            setBlockData(block.id, (data) => ({
                              ...data,
                              attribution: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                  ) : null}

                  {block.type === "callout" ? (
                    <div className="admin-form-grid admin-form-grid--1">
                      <label className="admin-field">
                        <span className="admin-field__label">Title</span>
                        <input
                          value={stringValue(block.data.title)}
                          onChange={(event) =>
                            setBlockData(block.id, (data) => ({
                              ...data,
                              title: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="admin-field">
                        <span className="admin-field__label">Callout text</span>
                        <textarea
                          value={stringValue(block.data.text)}
                          onChange={(event) =>
                            setBlockData(block.id, (data) => ({
                              ...data,
                              text: event.target.value,
                            }))
                          }
                          rows={4}
                        />
                      </label>
                    </div>
                  ) : null}

                  {block.type === "cta" ? (
                    <div className="admin-form-grid admin-form-grid--2">
                      <label className="admin-field admin-field--wide">
                        <span className="admin-field__label">Supporting text</span>
                        <textarea
                          value={stringValue(block.data.text)}
                          onChange={(event) =>
                            setBlockData(block.id, (data) => ({
                              ...data,
                              text: event.target.value,
                            }))
                          }
                          rows={3}
                        />
                      </label>
                      <label className="admin-field">
                        <span className="admin-field__label">Button label</span>
                        <input
                          value={stringValue(block.data.label)}
                          onChange={(event) =>
                            setBlockData(block.id, (data) => ({
                              ...data,
                              label: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="admin-field">
                        <span className="admin-field__label">Internal path</span>
                        <input
                          value={stringValue(block.data.href)}
                          onChange={(event) =>
                            setBlockData(block.id, (data) => ({
                              ...data,
                              href: event.target.value,
                            }))
                          }
                          placeholder="/contact"
                        />
                        <small className="admin-field__hint">
                          Must start with a single /.
                        </small>
                      </label>
                    </div>
                  ) : null}

                  {block.type === "list" ||
                  block.type === "routeHighlights" ||
                  block.type === "itinerarySummary" ? (
                    <label className="admin-field admin-field--wide">
                      <span className="admin-field__label">
                        {blockLabel(block.type)} items
                      </span>
                      <textarea
                        value={listText(block.data.items)}
                        onChange={(event) =>
                          setBlockData(block.id, (data) => ({
                            ...data,
                            items: parseLines(event.target.value),
                          }))
                        }
                        rows={6}
                        placeholder={"One item per line\nSecond item\nThird item"}
                      />
                      <small className="admin-field__hint">
                        One item per line.
                      </small>
                    </label>
                  ) : null}

                  {block.type === "image" ? (
                    <div className="admin-form-grid admin-form-grid--1">
                      <label className="admin-field">
                        <span className="admin-field__label">Image URL</span>
                        <input
                          value={stringValue(block.data.url)}
                          onChange={(event) =>
                            setBlockData(block.id, (data) => ({
                              ...data,
                              url: event.target.value,
                            }))
                          }
                          placeholder="https://… or /…"
                        />
                      </label>
                      <label className="admin-field">
                        <span className="admin-field__label">Alt text</span>
                        <input
                          value={stringValue(block.data.alt)}
                          onChange={(event) =>
                            setBlockData(block.id, (data) => ({
                              ...data,
                              alt: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="admin-field">
                        <span className="admin-field__label">Caption</span>
                        <input
                          value={stringValue(block.data.caption)}
                          onChange={(event) =>
                            setBlockData(block.id, (data) => ({
                              ...data,
                              caption: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                  ) : null}

                  {block.type === "gallery" ? (
                    <label className="admin-field admin-field--wide">
                      <span className="admin-field__label">Gallery images</span>
                      <textarea
                        value={galleryText(block.data.items)}
                        onChange={(event) =>
                          setBlockData(block.id, (data) => ({
                            ...data,
                            items: parseGallery(event.target.value),
                          }))
                        }
                        rows={7}
                        placeholder={"https://example.com/image.jpg | Temple exterior\n/images/room.webp | Hotel room"}
                      />
                      <small className="admin-field__hint">
                        One image per line: URL | alt text.
                      </small>
                    </label>
                  ) : null}

                  {block.type === "faqGroup" ? (
                    <label className="admin-field admin-field--wide">
                      <span className="admin-field__label">FAQ items</span>
                      <textarea
                        value={faqText(block.data.items)}
                        onChange={(event) =>
                          setBlockData(block.id, (data) => ({
                            ...data,
                            items: parseFaq(event.target.value),
                          }))
                        }
                        rows={8}
                        placeholder={"What is included? | Hotel, transfers and sightseeing.\nCan I customize it? | Yes, contact our travel team."}
                      />
                      <small className="admin-field__hint">
                        One FAQ per line: Question | Answer.
                      </small>
                    </label>
                  ) : null}
                </div>
              </section>
            ))}
          </div>

          <div className="admin-block-editor__add">
            <label className="admin-field">
              <span className="admin-field__label">Add block</span>
              <select
                value={addType}
                onChange={(event) =>
                  setAddType(event.target.value as ContentBlockType)
                }
              >
                {contentBlockTypes.map((type) => (
                  <option key={type} value={type}>
                    {blockLabel(type)}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="admin-secondary-button"
              type="button"
              onClick={() =>
                setBlocks((current) => [...current, newBlock(addType)])
              }
            >
              + Add Block
            </button>
          </div>
        </>
      )}
    </div>
  );
}
