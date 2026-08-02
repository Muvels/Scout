type ErrorToastProps = {
  message: string | undefined;
};

export function ErrorToast({ message }: ErrorToastProps) {
  if (!message) return null;
  return (
    <p
      className="fixed bottom-5 right-5 z-[110] m-0 max-w-[380px] rounded-xl bg-[#2b2f38]/94 px-4 py-2.5 text-[13px] font-medium text-white/92 shadow-[0_12px_34px_rgba(10,14,22,0.35)] backdrop-blur-xl animate-in fade-in-0 slide-in-from-bottom-2"
      role="status"
      aria-live="polite"
    >
      {message}
    </p>
  );
}
