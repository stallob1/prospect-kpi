export function ConfigBanner({ message }: { message: string }) {
  return (
    <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
      {message}
    </div>
  );
}
