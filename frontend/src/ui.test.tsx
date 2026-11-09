import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Badge, Empty, Field, MutationForm, Pagination, Sparkline } from './ui';
describe('operational components', () => {
  it('keeps field labels separate from descriptive help text', () => {
    render(
      <Field label="Resolution" hint="Required to resolve an incident.">
        <textarea />
      </Field>,
    );
    expect(screen.getByRole('textbox', { name: 'Resolution' })).toHaveAccessibleDescription(
      'Required to resolve an incident.',
    );
  });
  it('communicates health with text as well as color', () => {
    render(<Badge value="UNAVAILABLE" />);
    expect(screen.getByText('Unavailable')).toBeVisible();
  });
  it('explains empty chart data rather than displaying invented observations', () => {
    render(<Sparkline values={[]} label="Latency" />);
    expect(screen.getByText(/Collecting observations/)).toBeVisible();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
  it('renders measured values in an accessible chart', () => {
    render(<Sparkline values={[20, 700, 30]} label="Latency in milliseconds" />);
    expect(screen.getByRole('img', { name: 'Latency in milliseconds' })).toBeVisible();
  });
  it('enforces pagination boundaries', async () => {
    const onChange = vi.fn();
    render(<Pagination page={0} pages={2} total={30} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onChange).toHaveBeenCalledWith(1);
  });
  it('shows failed mutations and re-enables saving', async () => {
    const save = vi.fn().mockRejectedValue(new Error('Archived services are read-only.'));
    render(
      <MutationForm onSave={save}>
        <input aria-label="Name" name="name" defaultValue="API" />
      </MutationForm>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Archived services are read-only.');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });
  it('prevents duplicate submission while a request is pending', async () => {
    const save = vi.fn(() => new Promise<void>(() => {}));
    render(
      <MutationForm onSave={save}>
        <input name="name" />
      </MutationForm>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(save).toHaveBeenCalledTimes(1);
  });
  it('renders honest empty states', () => {
    render(<Empty title="No deployments" description="Record the first release." />);
    expect(screen.getByRole('heading', { name: 'No deployments' })).toBeVisible();
  });
});
