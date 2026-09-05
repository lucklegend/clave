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
        <div key={rule.heading} className="grid gap-[3px] border-b border-rule py-3 first:pt-0">
          <h3 className="text-[14px] tracking-[-0.005em]">{rule.heading}</h3>
          <p className="text-[13px] text-ink-2">{rule.body}</p>
        </div>
      ))}
    </div>
  );
}
