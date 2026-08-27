import type { ReactNode } from "react";

interface PageWrapperProps {
  children: ReactNode;
  title: string;
  description?: string;
  className?: string;
  actions?: ReactNode;
  narrow?: boolean;
}

export default function PageWrapper({
  children,
  title,
  description,
  className = "",
  actions,
  narrow = false,
}: PageWrapperProps) {
  return (
    <div className={`page-shell ${narrow ? "page-shell--narrow" : ""} ${className}`.trim()}>
      <div className="page-header">
        <div className="min-w-0">
          <h1 className="page-title">{title}</h1>
          {description ? <p className="page-subtitle">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
