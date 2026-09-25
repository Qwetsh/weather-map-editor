import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { toPng } from "html-to-image";
import { Camera, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

// Fond gris clair sans noms de lieux (gratuit, sans clé, CORS autorisé pour la capture).
// CARTO exige désormais une clé API : ses tuiles s'affichaient barrées « API KEY REQUIRED ».
const TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}";
const ATTRIBUTION = "Esri, HERE, Garmin, © OpenStreetMap";

function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(container);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

type Props = {
  onCapture: (dataUrl: string, aspect: number) => void;
  onError: () => void;
};

/** Carte interactive : on cadre la zone voulue puis on la « photographie » comme fond */
export function LeafletPicker({ onCapture, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);

  async function capture() {
    const el = containerRef.current?.querySelector<HTMLElement>(".leaflet-container");
    if (!el) return;
    setCapturing(true);
    try {
      const dataUrl = await toPng(el, {
        cacheBust: true,
        pixelRatio: 2,
        // Retire les boutons de zoom mais garde l'attribution exigée par la licence
        filter: (node) => !(node instanceof HTMLElement && node.classList.contains("leaflet-control-zoom")),
      });
      onCapture(dataUrl, el.offsetWidth / el.offsetHeight);
    } catch (err) {
      console.error("Capture de la carte interactive impossible :", err);
      onError();
    } finally {
      setCapturing(false);
    }
  }

  return (
    <div data-leaflet className="absolute inset-0 z-0" ref={containerRef}>
      <MapContainer center={[46.5, 2.5]} zoom={6} maxZoom={16} className="size-full">
        <TileLayer url={TILES} attribution={ATTRIBUTION} crossOrigin="anonymous" />
        <InvalidateOnResize />
      </MapContainer>
      <div className="absolute inset-x-0 bottom-4 z-[1000] flex justify-center">
        <Button size="lg" onClick={capture} disabled={capturing} className="rounded-full shadow-lg">
          {capturing ? <LoaderCircle className="animate-spin" /> : <Camera />}
          {capturing ? "Capture en cours…" : "Utiliser cette vue comme fond"}
        </Button>
      </div>
    </div>
  );
}
