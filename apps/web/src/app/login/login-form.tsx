'use client';

import { useActionState } from 'react';
import { Alert, Button, Card, Field, Input } from '@stellar-health/ui';
import { login, type LoginState } from './actions';

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <Card className="p-6">
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <Field label="API token" htmlFor="token">
          <Input
            id="token"
            name="token"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
            placeholder="schm_…"
          />
        </Field>
        {state.error && <Alert>{state.error}</Alert>}
        <Button type="submit" className="w-full" loading={pending}>
          Sign in
        </Button>
      </form>
    </Card>
  );
}
