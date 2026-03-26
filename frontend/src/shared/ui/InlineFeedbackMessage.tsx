interface InlineFeedbackMessageProps {
  message?: string | null;
  variant?: "error" | "success";
  className?: string;
}

export function InlineFeedbackMessage({
  message,
  variant = "error",
  className = "",
}: InlineFeedbackMessageProps) {
  if (!message) {
    return null;
  }

  return (
    <p
      role={variant === "error" ? "alert" : "status"}
      className={`text-sm font-medium ${variant === "error" ? "text-red-400" : "text-[#5cb85c]"} ${className}`.trim()}
    >
      {message}
    </p>
  );
}
