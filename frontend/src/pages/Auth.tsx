import {
  ArrowRight,
  Box,
  ChartNoAxesCombined,
  Check,
  ExternalLink,
  HeartPulse,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { getCsrf, mutate } from '../api';
import { useSession } from '../state';
import type { User } from '../types';
import { Feedback, Field } from '../ui';
export function AuthPage({ register = false }: { register?: boolean }) {
  const { user, setUser, loading } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [registration, setRegistration] = useState(true);
  useEffect(() => {
    void getCsrf()
      .then((c) => setRegistration(c.registrationEnabled))
      .catch(() => {});
    setError('');
    setSuccess('');
  }, [register]);
  if (user && !loading) return <Navigate to="/" replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    const data = new FormData(event.currentTarget);
    try {
      if (register) {
        await mutate('/auth/register', 'POST', {
          email: data.get('email'),
          displayName: data.get('displayName'),
          password: data.get('password'),
        });
        setSuccess('Account created with viewer access. You can now sign in.');
      } else {
        const u = await mutate<User>('/auth/login', 'POST', {
          email: data.get('email'),
          password: data.get('password'),
        });
        await getCsrf();
        setUser(u);
        const from = (location.state as { from?: string } | null)?.from;
        void navigate(from?.startsWith('/') && !from.startsWith('//') ? from : '/', {
          replace: true,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <section className="auth-story">
        <Link className="brand" to="/status">
          <span className="brand-mark">
            <ChartNoAxesCombined size={23} />
          </span>
          OpsAtlas
        </Link>
        <div className="auth-story-content">
          <div className="eyebrow">THE OPERATIONAL BIG PICTURE</div>
          <h1>
            Your systems.
            <br />
            Your context.
            <br />
            <em>One clear view.</em>
          </h1>
          <p>
            Bring service health, releases, and incident response into a workspace built for the
            people behind the systems.
          </p>
          <div className="auth-capabilities">
            <span>
              <HeartPulse size={17} />
              Observe with confidence
            </span>
            <span>
              <Box size={17} />
              Know what shipped
            </span>
            <span>
              <TriangleAlert size={17} />
              Respond with context
            </span>
          </div>
        </div>
        <div className="auth-story-footer">
          <span>LOCAL-FIRST / CLOUD-READY</span>
          <span>01 — OPSATLAS</span>
        </div>
      </section>
      <section className="auth-form-section">
        <Link className="text-link auth-status" to="/status">
          Public status
          <ExternalLink size={14} />
        </Link>
        <div className="auth-form-container">
          <div className="eyebrow">PLATFORM WORKSPACE</div>
          <h2>{register ? 'Join the workspace' : 'Welcome back.'}</h2>
          <p>
            {register
              ? 'Create a viewer account. An administrator can grant operator access.'
              : 'Sign in for a clearer view of your operations.'}
          </p>
          {register && !registration ? (
            <div className="callout">Registration is disabled by the workspace administrator.</div>
          ) : (
            <form className="form auth-form" onSubmit={(e) => void submit(e)}>
              <fieldset disabled={busy || loading || !!success}>
                {register && (
                  <Field label="Display name">
                    <input name="displayName" required maxLength={80} autoComplete="name" />
                  </Field>
                )}
                <Field label="Email address">
                  <input
                    name="email"
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="username"
                    placeholder="you@example.com"
                  />
                </Field>
                <Field
                  label="Password"
                  hint={
                    register
                      ? '12–72 characters, within 72 UTF-8 bytes. Use a unique password.'
                      : undefined
                  }
                >
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={register ? 12 : undefined}
                    maxLength={72}
                    autoComplete={register ? 'new-password' : 'current-password'}
                  />
                </Field>
                <button className="button primary auth-submit" disabled={busy}>
                  {busy ? 'Please wait…' : register ? 'Create account' : 'Sign in to workspace'}
                  <ArrowRight size={17} />
                </button>
              </fieldset>
              <Feedback error={error} />
              {success && (
                <div className="success-box" role="status">
                  <Check size={18} />
                  {success}
                  <Link to="/login">Sign in</Link>
                </div>
              )}
            </form>
          )}
          <p className="auth-alternate">
            {register ? 'Already have an account?' : 'New to the workspace?'}{' '}
            <Link to={register ? '/login' : '/register'}>
              {register ? 'Sign in' : 'Create account'}
            </Link>
          </p>
          <div className="auth-security">
            <ShieldCheck size={17} />
            <span>Secure server-side sessions. Your password stays private.</span>
          </div>
        </div>
        <div className="auth-bottom">OpsAtlas · Service operations, thoughtfully connected.</div>
      </section>
    </div>
  );
}
