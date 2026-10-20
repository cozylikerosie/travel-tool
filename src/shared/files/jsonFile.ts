// 在瀏覽器內產生檔案讓使用者下載，資料不離開這台裝置
export function downloadJson(fileName: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName.replace(/[\\/:*?"<>|]/g, "_");
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function readFileText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("無法讀取檔案"));
    reader.readAsText(file);
  });
}
