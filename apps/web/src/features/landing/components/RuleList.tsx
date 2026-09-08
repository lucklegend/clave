export type Rule = {
  heading: string;
  body: string;
};

export type RuleListProps = {
  rules: readonly Rule[];
};

// The artifact's `.rules`: hairline-separated heading/body pairs. Used verbatim by the statement
// section and by amenities, four rules each.
export function RuleList({ rules }: RuleListProps) {
  return (
    <div className="grid">
      {rules.map((rule) => (
        <div
          key={rule.heading}
          className="grid gap-[3px] border-b border-outline-variant py-3.5 first:pt-0"
        >
          <h3 className="title-m text-on-surface">{rule.heading}</h3>
          <p className="body-m text-on-surface-variant">{rule.body}</p>
        </div>
      ))}
    </div>
  );
}
