import { LoginForm } from './login-form';

export const metadata = { title: 'Sign in · Stellar Contract Health' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold">Stellar Contract Health</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Sign in with an API token
          </p>
        </div>
        <LoginForm next={next ?? '/'} />
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          Use the <code className="font-mono">ADMIN_API_TOKEN</code> from your server configuration,
          or a token created under Settings.
        </p>
      </div>
    </main>
  );
}
