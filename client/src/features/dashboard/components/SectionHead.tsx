type Props = {
  title: string;
  tag?: string;
  right?: React.ReactNode;
};

export default function SectionHead({ title, tag, right }: Props) {
  return (
    <div className="sec-head">
      <span className="bar" />
      <h2>{title}</h2>
      {right ?? (tag && <span className="tag">{tag}</span>)}
    </div>
  );
}
