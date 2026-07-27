type Props = {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
};

export function PageHeader({ eyebrow, title, description, children }: Props) {
  return (
    <div className="page-header">
      <div className="page-header-copy">
        <div className="breadcrumbs">{eyebrow}</div>
        <h1 className="page-title">{title}</h1>
        <p className="section-copy">{description}</p>
      </div>
      {children ? <div className="page-header-actions">{children}</div> : null}
    </div>
  );
}
