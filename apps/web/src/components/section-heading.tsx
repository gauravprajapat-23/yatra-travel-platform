type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  tone?: "light" | "dark";
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  tone = "light",
}: SectionHeadingProps) {
  return (
    <div className={`section-heading section-heading--${tone}`}>
      {eyebrow ? <p className="section-heading__eyebrow">{eyebrow}</p> : null}
      <h2>{title}</h2>
      {description ? <p className="section-heading__description">{description}</p> : null}
    </div>
  );
}
