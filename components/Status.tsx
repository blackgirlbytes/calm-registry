/** A full-height message for loading and error states. */
export function Status({ children, tone }: { children: React.ReactNode; tone?: "error" }) {
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`py-24 text-center ${tone === "error" ? "text-danger" : "text-muted"}`}>
      {children}
    </p>
  );
}
