import React, { useRef, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { toPng } from "html-to-image";

interface LeafletPickerProps {
  onCapture: (dataUrl: string, width: number, height: number) => void;
  theme: "light" | "dark";
}

// Tile URLs — borders only, no labels
const TILES_LIGHT =
  "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png";
const TILES_DARK =
  "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

function InvalidateOnMount() {
  const map = useMap();
  React.useEffect(() => {
    // Ensure tiles load correctly when container size is set via CSS
    setTimeout(() => map.invalidateSize(), 200);
  }, [map]);
  return null;
}

export default function LeafletPicker({ onCapture, theme }: LeafletPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);

  async function handleCapture() {
    if (!containerRef.current) return;
    setCapturing(true);
    try {
      // Small delay to let tiles finish rendering
      await new Promise((r) => setTimeout(r, 400));
      const el = containerRef.current.querySelector(".leaflet-container") as HTMLElement;
      if (!el) return;
      const dataUrl = await toPng(el, { cacheBust: true, pixelRatio: 2 });
      onCapture(dataUrl, el.offsetWidth, el.offsetHeight);
    } catch (err) {
      console.error("Leaflet capture failed:", err);
    } finally {
      setCapturing(false);
    }
  }

  const tileUrl = theme === "dark" ? TILES_DARK : TILES_LIGHT;

  return (
    <div className="relative w-full h-full" ref={containerRef}>
      <MapContainer
        center={[46.5, 2.5]}
        zoom={6}
        className="w-full h-full"
        style={{ position: "absolute", inset: 0 }}
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer url={tileUrl} attribution={ATTRIBUTION} />
        <InvalidateOnMount />
      </MapContainer>
      <button
        onClick={handleCapture}
        disabled={capturing}
        className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000] px-4 py-2 rounded-xl font-semibold shadow-lg transition-colors"
        style={{
          background: capturing ? "#6b7280" : "#4f46e5",
          color: "#fff",
          cursor: capturing ? "wait" : "pointer",
        }}
      >
        {capturing ? "Capture en cours…" : "📸 Capturer cette vue"}
      </button>
    </div>
  );
}
