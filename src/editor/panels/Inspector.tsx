import { useEffect, useRef, type ReactNode } from "react";
import {
  ArrowUpToLine,
  CopyPlus,
  Crop,
  Globe,
  ImageUp,
  Lock,
  LockOpen,
  MapPin,
  Thermometer,
  Trash2,
  Wind,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip } from "@/components/ui/tooltip";
import { useEditor } from "../EditorContext";
import {
  BUILTIN_BACKGROUNDS,
  BUILTIN_ICONS,
  ELEMENT_NAMES,
  LEAFLET_BG_ID,
  LEAFLET_CAPTURED_BG_ID,
  UPLOAD_BG_ID,
  builtinBackground,
  findIcon,
  temperatureColor,
  type MapElement,
  type PressureElement,
  type TempElement,
  type TextElement,
} from "../model";
import { PressureDot } from "../PressureDot";
import { WeatherIcon } from "../WeatherIcon";
import { ColorField, Field, RangeField, Section, Segmented, Switch } from "./controls";

export function Inspector() {
  const { selectedElements } = useEditor();
  if (selectedElements.length === 0) return <MapSettings />;
  if (selectedElements.length === 1) return <ElementSettings el={selectedElements[0]} />;
  return <MultiSettings els={selectedElements} />;
}

// ---------- Rien de sélectionné : réglages de la carte ----------

function MapSettings() {
  const editor = useEditor();
  const { doc } = editor;
  const fileRef = useRef<HTMLInputElement>(null);
  const bgId = doc.background.id;

  return (
    <>
      <PanelHeader title="Carte" />
      <Section title="Fond de carte">
        <div className="grid grid-cols-2 gap-2">
          {BUILTIN_BACKGROUNDS.map((bg) => (
            <BackgroundTile key={bg.id} active={bgId === bg.id} label={bg.label} onClick={() => editor.setBackground(builtinBackground(bg.id)!)}>
              <img src={bg.src ?? ""} alt="" className="size-full object-cover" />
            </BackgroundTile>
          ))}
          <BackgroundTile
            active={bgId === LEAFLET_BG_ID || bgId === LEAFLET_CAPTURED_BG_ID}
            label="Carte interactive"
            onClick={editor.openInteractiveMap}
          >
            <Globe className="size-7 text-primary" strokeWidth={1.5} />
          </BackgroundTile>
          <BackgroundTile active={bgId === UPLOAD_BG_ID} label="Mon image" onClick={() => fileRef.current?.click()}>
            <ImageUp className="size-7 text-primary" strokeWidth={1.5} />
          </BackgroundTile>
        </div>
        {bgId === LEAFLET_CAPTURED_BG_ID && (
          <Button variant="outline" size="sm" onClick={editor.openInteractiveMap}>
            <Crop /> Recadrer la carte interactive
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) editor.uploadBackground(file);
            e.target.value = "";
          }}
        />
      </Section>
      <Section title="Légende">
        <Switch
          label="Afficher la légende"
          checked={doc.legend.visible}
          onChange={(visible) => editor.updateLegend({ visible })}
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Elle se remplit toute seule avec les pictos posés sur la carte. Fais-la glisser pour la déplacer.
        </p>
      </Section>
      <Section title="Astuces">
        <ul className="grid gap-2.5 text-[13px] text-muted-foreground">
          <Tip keys={["Double-clic"]}>modifier un élément</Tip>
          <Tip keys={["Clic droit"]}>plus d'options</Tip>
          <Tip keys={["Maj", "clic"]}>sélectionner plusieurs éléments</Tip>
          <Tip keys={["←", "→"]}>déplacer finement</Tip>
          <Tip keys={["Ctrl", "Z"]}>annuler</Tip>
        </ul>
      </Section>
    </>
  );
}

function BackgroundTile({ active, label, onClick, children }: { active: boolean; label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "group grid gap-1.5 rounded-xl p-1.5 text-left text-xs font-medium outline-none transition-colors hover:bg-surface-2 focus-visible:ring-3 focus-visible:ring-ring",
        active && "bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft",
      )}
    >
      <span
        className={cn(
          "grid aspect-[4/3] place-items-center overflow-hidden rounded-lg border bg-surface-2",
          active && "border-primary ring-1 ring-primary",
        )}
      >
        {children}
      </span>
      <span className="px-0.5">{label}</span>
    </button>
  );
}

function Tip({ keys, children }: { keys: string[]; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span className="flex shrink-0 items-center gap-0.5">
        {keys.map((k) => (
          <Kbd key={k}>{k}</Kbd>
        ))}
      </span>
      {children}
    </li>
  );
}

// ---------- Un élément ----------

const KIND_ICONS: Record<MapElement["kind"], ReactNode> = {
  icon: null,
  label: <MapPin />,
  temp: <Thermometer />,
  wind: <Wind />,
  pressure: null,
};

function ElementSettings({ el }: { el: MapElement }) {
  const editor = useEditor();
  const disabled = !!el.locked;
  const title =
    el.kind === "pressure"
      ? el.zone === "anticyclone" ? "Anticyclone" : "Dépression"
      : el.kind === "icon"
        ? findIcon(el.iconId, editor.doc.customIcons).label
        : ELEMENT_NAMES[el.kind];

  const icon =
    el.kind === "icon" ? (
      <WeatherIcon iconId={el.iconId} customIcons={editor.doc.customIcons} size={20} />
    ) : el.kind === "pressure" ? (
      <PressureDot zone={el.zone === "anticyclone" ? "A" : "D"} className="size-5 text-[11px]" />
    ) : (
      KIND_ICONS[el.kind]
    );

  return (
    <>
      <PanelHeader
        title={title}
        icon={icon}
        actions={
          <>
            <Tooltip content={disabled ? "Déverrouiller" : "Verrouiller"}>
              <Button
                variant={disabled ? "soft" : "ghost"}
                size="icon-sm"
                onClick={() => editor.setLocked([el.id], !disabled)}
                aria-label={disabled ? "Déverrouiller" : "Verrouiller"}
              >
                {disabled ? <Lock /> : <LockOpen />}
              </Button>
            </Tooltip>
            <Tooltip content="Supprimer (Suppr)">
              <Button variant="ghost-destructive" size="icon-sm" onClick={() => editor.deleteElements([el.id])} aria-label="Supprimer">
                <Trash2 />
              </Button>
            </Tooltip>
          </>
        }
      />
      {disabled && (
        <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
          <Lock className="size-3.5 shrink-0" /> Élément verrouillé : il ne peut plus être déplacé ni modifié.
        </div>
      )}
      {el.kind === "icon" && <IconFields el={el} disabled={disabled} />}
      {el.kind === "label" && <LabelFields el={el} disabled={disabled} />}
      {el.kind === "temp" && <TempFields el={el} disabled={disabled} />}
      {el.kind === "wind" && <WindFields el={el} disabled={disabled} />}
      {el.kind === "pressure" && <PressureFields el={el} disabled={disabled} />}
      <Section>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={() => editor.duplicate([el.id])}>
            <CopyPlus /> Dupliquer
          </Button>
          <Button variant="outline" size="sm" onClick={() => editor.reorder([el.id], "front")}>
            <ArrowUpToLine /> Premier plan
          </Button>
        </div>
      </Section>
    </>
  );
}

/** Mise à jour d'un champ : les frappes successives ne forment qu'une étape d'annulation */
function useFieldUpdater(el: MapElement) {
  const { updateElements } = useEditor();
  return (patch: Partial<MapElement>, key = Object.keys(patch).join()) =>
    updateElements([el.id], patch, { coalesce: `${el.id}:${key}` });
}

/** Donne le focus au champ principal quand on vient de créer l'élément ou qu'on double-clique dessus */
function useFocusOnRequest(el: MapElement) {
  const { focusTarget, clearFocusTarget } = useEditor();
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusTarget !== el.id) return;
    clearFocusTarget();
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.select();
    });
  }, [focusTarget, el.id, clearFocusTarget]);
  return ref;
}

function IconFields({ el, disabled }: { el: Extract<MapElement, { kind: "icon" }>; disabled: boolean }) {
  const { doc } = useEditor();
  const update = useFieldUpdater(el);
  return (
    <Section title="Picto">
      <div className="grid grid-cols-6 gap-1">
        {[...BUILTIN_ICONS, ...doc.customIcons].map((ic) => (
          <Tooltip key={ic.id} content={ic.label}>
            <button
              disabled={disabled}
              onClick={() => update({ iconId: ic.id })}
              aria-label={ic.label}
              aria-pressed={el.iconId === ic.id}
              className={cn(
                "grid aspect-square place-items-center rounded-lg outline-none hover:bg-surface-2 focus-visible:ring-3 focus-visible:ring-ring disabled:opacity-40",
                el.iconId === ic.id && "bg-primary-soft ring-1 ring-primary",
              )}
            >
              <WeatherIcon iconId={ic.id} customIcons={doc.customIcons} size={28} />
            </button>
          </Tooltip>
        ))}
      </div>
      <RangeField label="Taille" value={el.size} min={16} max={240} disabled={disabled} onChange={(size) => update({ size })} />
    </Section>
  );
}

function TextStyleFields({ el, disabled }: { el: TextElement; disabled: boolean }) {
  const { rememberTextSize } = useEditor();
  const update = useFieldUpdater(el);
  return (
    <>
      <RangeField
        label="Taille du texte"
        value={el.fontSize}
        min={8}
        max={120}
        disabled={disabled}
        onChange={(fontSize) => {
          update({ fontSize });
          rememberTextSize(el.kind, fontSize);
        }}
      />
      <ColorField value={el.color} disabled={disabled} onChange={(color) => update({ color })} />
      <div className="grid gap-2.5">
        <Switch label="Fond blanc" checked={el.bg} disabled={disabled} onChange={(bg) => update({ bg })} />
        <Switch label="Bordure" checked={el.border} disabled={disabled} onChange={(border) => update({ border })} />
      </div>
    </>
  );
}

function LabelFields({ el, disabled }: { el: Extract<MapElement, { kind: "label" }>; disabled: boolean }) {
  const update = useFieldUpdater(el);
  const ref = useFocusOnRequest(el);
  return (
    <Section title="Ville">
      <Field label="Nom" htmlFor="label-text">
        <Input
          id="label-text"
          ref={ref}
          value={el.text}
          disabled={disabled}
          placeholder="Nom de la ville"
          onChange={(e) => update({ text: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
      </Field>
      <TextStyleFields el={el} disabled={disabled} />
    </Section>
  );
}

function TempFields({ el, disabled }: { el: TempElement; disabled: boolean }) {
  const update = useFieldUpdater(el);
  const ref = useFocusOnRequest(el);
  const auto = el.colorMode === "auto";
  return (
    <Section title="Température">
      <Field label="Valeur" htmlFor="temp-value">
        <div className="relative">
          <Input
            id="temp-value"
            ref={ref}
            value={el.value}
            disabled={disabled}
            placeholder="25"
            className="pr-10"
            onChange={(e) => update({ value: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">°C</span>
        </div>
      </Field>
      <Field label="Style">
        <Segmented
          label="Style de la température"
          value={auto ? "auto" : "custom"}
          disabled={disabled}
          onChange={(colorMode) => update({ colorMode })}
          options={[
            {
              value: "auto",
              label: (
                <>
                  <span className="size-2.5 rounded-full" style={{ background: temperatureColor(el.value) }} /> Pastille auto
                </>
              ),
            },
            { value: "custom", label: "Texte libre" },
          ]}
        />
      </Field>
      {auto ? (
        <RangeField
          label="Taille"
          value={el.fontSize}
          min={8}
          max={120}
          disabled={disabled}
          onChange={(fontSize) => update({ fontSize })}
        />
      ) : (
        <TextStyleFields el={el} disabled={disabled} />
      )}
      {auto && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          La couleur de la pastille suit la valeur, du violet (très froid) au rouge foncé (canicule).
        </p>
      )}
    </Section>
  );
}

function WindFields({ el, disabled }: { el: Extract<MapElement, { kind: "wind" }>; disabled: boolean }) {
  const update = useFieldUpdater(el);
  const ref = useFocusOnRequest(el);
  return (
    <Section title="Vent">
      <Field label="Vitesse" htmlFor="wind-speed">
        <div className="relative">
          <Input
            id="wind-speed"
            ref={ref}
            type="number"
            min={0}
            max={400}
            value={el.speedKmh}
            disabled={disabled}
            className="pr-14"
            onChange={(e) => update({ speedKmh: Math.max(0, Number(e.target.value) || 0) })}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">km/h</span>
        </div>
      </Field>
      <TextStyleFields el={el} disabled={disabled} />
    </Section>
  );
}

function PressureFields({ el, disabled }: { el: PressureElement; disabled: boolean }) {
  const update = useFieldUpdater(el);
  const clockwise = (el.hemisphere === "North") === (el.zone === "anticyclone");
  return (
    <Section title="Zone de pression">
      <Segmented
        label="Type de zone"
        value={el.zone}
        disabled={disabled}
        onChange={(zone) => update({ zone })}
        options={[
          { value: "anticyclone", label: <><PressureDot zone="A" /> Anticyclone</> },
          { value: "depression", label: <><PressureDot zone="D" /> Dépression</> },
        ]}
      />
      <RangeField label="Rayon" value={el.radius} min={2} max={50} disabled={disabled} onChange={(radius) => update({ radius })} />
      <Field label="Hémisphère">
        <Segmented
          label="Hémisphère"
          value={el.hemisphere ?? "North"}
          disabled={disabled}
          onChange={(hemisphere) => update({ hemisphere })}
          options={[
            { value: "North", label: "Nord" },
            { value: "South", label: "Sud" },
          ]}
        />
      </Field>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Dans l'hémisphère {el.hemisphere === "South" ? "Sud" : "Nord"}, l'air tourne{" "}
        <strong className="font-medium text-foreground">
          {clockwise ? "dans le sens des aiguilles d'une montre" : "dans le sens inverse des aiguilles d'une montre"}
        </strong>{" "}
        autour {el.zone === "anticyclone" ? "d'un anticyclone" : "d'une dépression"}.
      </p>
    </Section>
  );
}

// ---------- Plusieurs éléments ----------

function MultiSettings({ els }: { els: MapElement[] }) {
  const editor = useEditor();
  const ids = els.map((e) => e.id);
  const anyLocked = els.some((e) => e.locked);
  return (
    <>
      <PanelHeader title={`${els.length} éléments`} />
      <Section>
        <div className="grid gap-2">
          <Button variant="outline" size="sm" className="justify-start" onClick={() => editor.duplicate(ids)}>
            <CopyPlus /> Dupliquer la sélection
          </Button>
          <Button variant="outline" size="sm" className="justify-start" onClick={() => editor.setLocked(ids, !anyLocked)}>
            {anyLocked ? <LockOpen /> : <Lock />} {anyLocked ? "Tout déverrouiller" : "Tout verrouiller"}
          </Button>
          <Button variant="outline" size="sm" className="justify-start" onClick={() => editor.reorder(ids, "front")}>
            <ArrowUpToLine /> Mettre au premier plan
          </Button>
          <Button variant="ghost-destructive" size="sm" className="justify-start" onClick={() => editor.deleteElements(ids)}>
            <Trash2 /> Supprimer la sélection
          </Button>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Fais glisser un des éléments pour déplacer tout le groupe. La poignée à droite les agrandit ensemble.
        </p>
      </Section>
    </>
  );
}

function PanelHeader({ title, icon, actions }: { title: string; icon?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2.5 border-b px-4 [&_svg]:size-5 [&_svg]:shrink-0">
      {icon}
      <h2 className="flex-1 truncate font-semibold">{title}</h2>
      <div className="flex items-center gap-0.5 [&_svg]:size-4">{actions}</div>
    </header>
  );
}
