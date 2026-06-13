/** Mostrado quando o Supabase ainda não foi configurado (.env.local ausente). */
export default function SetupNotice() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-5xl">🔌</div>
      <h1 className="text-2xl font-bold">Conecte o Supabase</h1>
      <p className="text-muted">
        O app está rodando, mas ainda não há banco de dados conectado. Crie um
        projeto gratuito no Supabase e preencha o arquivo{" "}
        <code className="rounded bg-[var(--surface-2)] px-1.5 py-0.5">.env.local</code>{" "}
        com a URL e a chave anônima.
      </p>
      <ol className="surface bordered space-y-2 rounded-xl p-5 text-left text-sm">
        <li>
          1. Crie um projeto em{" "}
          <a className="font-semibold text-primary" href="https://supabase.com" target="_blank" rel="noopener">
            supabase.com
          </a>
        </li>
        <li>2. Rode o SQL de <code>supabase/migrations/0001_init.sql</code> no SQL Editor</li>
        <li>3. Copie <code>.env.example</code> para <code>.env.local</code> e cole suas chaves</li>
        <li>4. Reinicie o servidor (<code>npm run dev</code>)</li>
      </ol>
      <p className="text-xs text-muted">Passo a passo completo no arquivo SETUP.md.</p>
    </main>
  );
}
