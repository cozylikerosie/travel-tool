import L from "leaflet";

// 所有標記都使用自訂 divIcon，不使用 L.Icon.Default（Vite 打包後預設圖示路徑會失效）。
// html 只包含程式產生的數字，不插入使用者輸入；顏色由 tailwind.css 的 .map-marker 透過顏色變數決定。
export function createNumberedMarkerIcon(order: number, isSelected: boolean): L.DivIcon {
  const size = isSelected ? 36 : 28;
  return L.divIcon({
    className: isSelected ? "map-marker map-marker--selected" : "map-marker",
    html: `<span>${Math.trunc(order)}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}
