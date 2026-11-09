/* eslint-disable react-refresh/only-export-components */
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  LoaderCircle,
  X,
} from 'lucide-react';
export function label(value: string) {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
export function date(value: string | null) {
  return value
    ? new Date(value).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Not checked yet';
}
export function relative(value: string | null) {
  if (!value) return 'Awaiting first check';
  const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
  return seconds < 60
    ? 'Just now'
    : seconds < 3600
      ? `${Math.floor(seconds / 60)}m ago`
      : seconds < 86400
        ? `${Math.floor(seconds / 3600)}h ago`
        : `${Math.floor(seconds / 86400)}d ago`;
}
export function Badge({ value }: { value: string }) {
  const tone = ['HEALTHY', 'SUCCEEDED', 'RESOLVED'].includes(value)
    ? 'good'
    : ['DEGRADED', 'MONITORING', 'PENDING', 'SEV3'].includes(value)
      ? 'warn'
      : ['UNAVAILABLE', 'FAILED', 'SEV1', 'SEV2'].includes(value)
        ? 'bad'
        : 'neutral';
  return (
    <span className={`badge ${tone}`}>
      <span className="status-dot" />
      {label(value)}
    </span>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </header>
  );
}
export function Panel({
  title,
  description,
  action,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function MoreLink({ to, children = 'View all' }: { to: string; children?: ReactNode }) {
  return (
    <Link className="text-link" to={to}>
      {children}
      <ArrowRight size={14} />
    </Link>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Check size={22} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function Feedback({
  loading,
  error,
  retry,
}: {
  loading?: boolean;
  error?: string;
  retry?: () => void;
}) {
  if (error)
    return (
      <div className="error-box" role="alert">
        <CircleAlert size={18} />
        <span>{error}</span>
        {retry && (
          <button className="text-button" onClick={retry}>
            Retry
          </button>
        )}
      </div>
    );
  return loading ? (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={20} />
      Loading workspace…
    </div>
  ) : null;
}
export function Pagination({
  page,
  pages,
  total,
  onChange,
}: {
  page: number;
  pages: number;
  total: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {total} record{total !== 1 ? 's' : ''} · Page {pages ? page + 1 : 0} of {pages}
      </span>
      <div>
        <button aria-label="Previous page" disabled={page === 0} onClick={() => onChange(page - 1)}>
          <ChevronLeft size={16} />
        </button>
        <button
          aria-label="Next page"
          disabled={page + 1 >= pages}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-heading">
        <h2 id="modal-title">{title}</h2>
        <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function MutationForm({
  onSave,
  submit = 'Save changes',
  children,
}: {
  onSave: (data: FormData) => Promise<void>;
  submit?: string;
  children: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSave(new FormData(event.currentTarget));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={(e) => void save(e)} className="form">
      <fieldset disabled={busy}>{children}</fieldset>
      {error && <Feedback error={error} />}
      <div className="form-footer">
        <span>Changes are recorded in activity history.</span>
        <button className="button primary" disabled={busy}>
          {busy ? <LoaderCircle className="spin" size={16} /> : null}
          {busy ? 'Saving…' : submit}
        </button>
      </div>
    </form>
  );
}
export function Field({
  label: caption,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{caption}</label>
      {isValidElement<{ id?: string; 'aria-describedby'?: string }>(children)
        ? cloneElement(children, { id, 'aria-describedby': hint ? `${id}-hint` : undefined })
        : children}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
export const text = (data: FormData, key: string) => String(data.get(key) ?? '').trim();
export function Sparkline({ values, label: caption }: { values: number[]; label: string }) {
  if (!values.length)
    return (
      <div className="chart-empty">Collecting observations. The first check runs shortly.</div>
    );
  const max = Math.max(...values, 1);
  const width = 600;
  const height = 120;
  const points = values
    .map(
      (v, i) =>
        `${values.length === 1 ? width / 2 : (i / (values.length - 1)) * width},${height - (v / max) * 95}`,
    )
    .join(' ');
  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${width} ${height + 10}`}
      role="img"
      aria-label={caption}
    >
      <defs>
        <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="var(--accent)" stopOpacity=".18" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[25, 65, 105].map((y) => (
        <line
          key={y}
          x1="0"
          x2={width}
          y1={y}
          y2={y}
          stroke="var(--border)"
          strokeDasharray="3 5"
        />
      ))}
      {values.length > 1 && (
        <polygon points={`0,130 ${points} ${width},130`} fill="url(#chart-fill)" />
      )}
      <polyline
        points={points}
        stroke="var(--accent)"
        fill="none"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {values.map((v, i) => (
        <circle
          key={i}
          cx={values.length === 1 ? width / 2 : (i / (values.length - 1)) * width}
          cy={height - (v / max) * 95}
          r={3}
          fill="var(--accent)"
        >
          <title>{v} ms</title>
        </circle>
      ))}
    </svg>
  );
}
