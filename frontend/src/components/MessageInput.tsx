import { KeyboardEvent, useRef, useState } from "react";

interface MessageInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function MessageInput({
  onSend,
  disabled,
  placeholder,
}: MessageInputProps) {
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    if (taRef.current) taRef.current.style.height = "auto";
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const autoresize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  return (
    <div className="px-3 sm:px-6 pb-4 pt-2">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end gap-2 bg-panel border border-border rounded-2xl px-3 py-2 shadow-sm focus-within:border-neutral-400 transition">
          <textarea
            ref={taRef}
            rows={1}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              autoresize(e.target);
            }}
            onKeyDown={onKeyDown}
            placeholder={placeholder || "Сообщение…"}
            disabled={disabled}
            className="flex-1 bg-transparent resize-none outline-none py-2 text-sm sm:text-base text-neutral-900 placeholder-neutral-400 max-h-[200px]"
          />
          <button
            onClick={submit}
            disabled={disabled || !value.trim()}
            className="shrink-0 h-9 w-9 rounded-full bg-accent text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition hover:bg-emerald-600"
            aria-label="Отправить"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 19V5" />
              <path d="m5 12 7-7 7 7" />
            </svg>
          </button>
        </div>
        <div className="text-[11px] text-neutral-500 text-center mt-2">
          Enter — отправить, Shift+Enter — новая строка
        </div>
      </div>
    </div>
  );
}
