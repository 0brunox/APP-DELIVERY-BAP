export default function AdminSoon({ title, note }: { title: string; note: string }) {
  return (
    <div className="surface-2 rounded-2xl py-16 text-center">
      <div className="mb-3 text-5xl opacity-50">🚧</div>
      <h1 className="mb-2 text-xl font-bold">{title}</h1>
      <p className="mx-auto max-w-sm px-4 text-sm text-muted">{note}</p>
    </div>
  );
}
