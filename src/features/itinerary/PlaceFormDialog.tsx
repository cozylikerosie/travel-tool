import { useEffect, useRef, type ComponentProps } from "react";
import { PlaceForm } from "./PlaceForm";

type PlaceFormDialogProps = ComponentProps<typeof PlaceForm>;

// 新增／編輯地點以對話框呈現：不論時間軸捲到哪裡都直接出現在畫面中央
export function PlaceFormDialog(props: PlaceFormDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const { onCancel } = props;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLElement>('input:not([type="radio"]), textarea')?.focus();
    return () => {
      // 關閉後把焦點還給開啟對話框的按鈕
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[2000] grid place-items-center bg-ink/40 p-5">
      <section
        aria-label={props.initialPlace ? "編輯地點" : "新增地點"}
        aria-modal="true"
        className="max-h-[calc(100vh-2.5rem)] w-full max-w-2xl overflow-y-auto border border-rule bg-paper px-6 pb-6 md:px-8 md:pb-8"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onCancel();
          }
        }}
        ref={dialogRef}
        role="dialog"
      >
        <PlaceForm {...props} />
      </section>
    </div>
  );
}
