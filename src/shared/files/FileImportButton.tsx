import { Upload } from "lucide-react";
import { useId, useRef, useState } from "react";
import { readFileText } from "./jsonFile";

interface FileImportButtonProps {
  label: string;
  // 回傳成功訊息；丟出錯誤時顯示錯誤訊息
  onImport: (text: string) => Promise<string>;
}

export function FileImportButton({ label, onImport }: FileImportButtonProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function handleChange(file: File | undefined) {
    if (!file) return;
    setIsImporting(true);
    setMessage(null);
    try {
      setMessage({ kind: "success", text: await onImport(await readFileText(file)) });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "匯入失敗，請再試一次。" });
    } finally {
      setIsImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="grid content-start gap-2">
      <label
        className={`inline-flex min-h-11 w-fit cursor-pointer items-center gap-2 border border-ink px-4 text-sm text-ink hover:bg-ink hover:text-paper ${
          isImporting ? "pointer-events-none opacity-60" : ""
        }`}
        htmlFor={inputId}
      >
        <Upload aria-hidden="true" className="size-4" />
        {isImporting ? "匯入中…" : label}
      </label>
      <input
        accept="application/json,.json"
        className="sr-only"
        id={inputId}
        onChange={(event) => void handleChange(event.target.files?.[0])}
        ref={inputRef}
        type="file"
      />
      {message && (
        <p
          className={`text-sm ${message.kind === "error" ? "text-budget-over" : "text-ink"}`}
          role={message.kind === "error" ? "alert" : "status"}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
