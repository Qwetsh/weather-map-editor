export type Tool = "select" | "icon" | "label" | "temp" | "wind" | "anticyclone" | "depression";
export type PlacementTool = "icon" | "label" | "temp" | "wind";

export function isPlacementTool(tool: Tool): tool is PlacementTool {
  return tool === "icon" || tool === "label" || tool === "temp" || tool === "wind";
}

export const TOOLS: { id: Tool; label: string; key: string; hint: string }[] = [
  { id: "select", label: "Sélection", key: "1", hint: "" },
  { id: "icon", label: "Picto météo", key: "2", hint: "Clique sur la carte pour placer le picto" },
  { id: "label", label: "Nom de ville", key: "3", hint: "Clique sur la carte pour placer une ville" },
  { id: "temp", label: "Température", key: "4", hint: "Clique sur la carte pour placer une température" },
  { id: "wind", label: "Force du vent", key: "5", hint: "Clique sur la carte pour indiquer la force du vent" },
  { id: "anticyclone", label: "Anticyclone", key: "6", hint: "Clique et fais glisser pour tracer un anticyclone" },
  { id: "depression", label: "Dépression", key: "7", hint: "Clique et fais glisser pour tracer une dépression" },
];
