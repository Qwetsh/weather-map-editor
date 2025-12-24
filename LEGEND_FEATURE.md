# Automatic Legend Feature

## Overview
An automatic legend has been added to the React weather map editor that dynamically displays all elements currently on the map. The legend is draggable, toggleable, and included in PNG exports.

## Features

### ✅ Automatic Generation
The legend automatically analyzes the map and displays:
- **Weather Icons**: All unique emoji icons with individual counts
- **Pressure Zones**: Anticyclones (A) and Depressions (D) with counts
- **Temperature Markers**: Grouped as "Température" with count
- **Wind Indicators**: Grouped as "Vent" with count  
- **Location Labels**: Grouped as "Localité" with count

### ✅ Dynamic Updates
- Legend updates automatically when elements are added
- Legend updates automatically when elements are deleted
- Legend updates automatically when elements are modified
- Empty categories don't appear in the legend
- Count displays only when there are multiple items of the same type

### ✅ Draggable
- Click and drag the legend to move it anywhere on the map
- Legend position is preserved as you add/remove elements
- Position is relative to the stage (uses percentages, not fixed pixels)

### ✅ Toggle Show/Hide
- **"Afficher légende"** button appears when legend is hidden
- **"Masquer légende"** button appears when legend is shown
- Button shows active state (darker when legend is visible)

### ✅ PNG Export Compatible
- Legend appears in PNG exports
- Exports include the legend in its current position
- Works perfectly with the "Export PNG" button

### ✅ Simple & Readable Design
- Clean white background with semi-transparency
- Dark mode support (follows app theme)
- Large, clear emoji/symbols
- Short French labels suitable for middle school students
- Compact layout that doesn't clutter the map

## Implementation Details

### State Management
```typescript
const [showLegend, setShowLegend] = useState(true);
const [legendPosition, setLegendPosition] = useState<{ x: number; y: number }>({ x: 2, y: 2 });
const legendDragRef = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);
```

### Legend Generator Function
The `generateLegend()` function:
1. Iterates through all elements on the map
2. Groups identical element types together
3. Counts occurrences of each type
4. Returns sorted legend entries (icons first, then pressure zones, temps, wind, labels)

### Legend Rendering
- Rendered as an overlay on the stage
- Uses pointer events for dragging
- Supports both light and dark themes
- Displays counts only when count > 1
- Properly positioned at percentage coordinates to work with responsive layout

### Drag Implementation
- Uses `legendDragRef` to track drag state
- Calculates percentage-based movement
- Clamps position to 0-100% to keep legend on stage
- Works seamlessly with other stage interactions

## Legend Entry Types

| Element Type | Symbol | Label | Count Display |
|---|---|---|---|
| Weather Icons | ☀️ / ☁️ / 🌧️ / etc. | [Icon label] | Yes, if > 1 |
| Anticyclone | A | Anticyclone | Yes, if > 1 |
| Depression | D | Dépression | Yes, if > 1 |
| Temperature | °C | Température | Yes, if > 1 |
| Wind | 💨 | Vent | Yes, if > 1 |
| Location | 📍 | Localité | Yes, if > 1 |

## User Guide

### Showing/Hiding the Legend
1. Click the **"Afficher légende"** button to show the legend
2. Click the **"Masquer légende"** button to hide the legend
3. Button color changes to indicate state (active vs inactive)

### Moving the Legend
1. Click and drag the legend box anywhere on the map
2. Legend stays within the map boundaries
3. Position is preserved when adding/removing elements

### Reading the Legend
1. Each row shows a symbol and its description
2. Count appears in parentheses if more than one item of that type exists
3. Legend only shows types that are currently on the map

### PNG Export
1. Position the legend where you want it
2. Click **"Export PNG"**
3. Legend will appear in the exported image at the exact position

## Code Structure

### Files Modified
- [src/weatherMap.tsx](src/weatherMap.tsx)

### Key Components

#### Legend State (lines ~273-275)
```typescript
const [showLegend, setShowLegend] = useState(true);
const [legendPosition, setLegendPosition] = useState<{ x: number; y: number }>({ x: 2, y: 2 });
const legendDragRef = useRef<...>(null);
```

#### Legend Generator Function (lines ~309-371)
```typescript
function generateLegend(): LegendEntry[] { ... }
```

#### Legend Rendering (lines ~1298-1355)
```typescript
{showLegend && (() => { ... })()}
```

#### Toggle Button (lines ~1008-1014)
```typescript
<Button 
  variant={showLegend ? "default" : "outline"} 
  className="rounded-xl gap-2" 
  onClick={() => setShowLegend(!showLegend)}
>
  📋 {showLegend ? 'Masquer' : 'Afficher'} légende
</Button>
```

## Responsive Behavior

- Legend adapts to dark mode automatically
- Legend stays visible in both light and dark themes
- Legend position is maintained across theme changes
- Responsive sizing (width: 160px, height: dynamic based on entries)
- Works on different screen sizes and aspect ratios

## Browser Compatibility
- Works on all modern browsers (Chrome, Firefox, Safari, Edge)
- Uses pointer events for cross-device support
- Touch-friendly dragging on tablets and hybrid devices

## Performance Considerations
- Legend generation is fast (O(n) where n = number of elements)
- Memoization not needed as legend updates are infrequent
- Minimal impact on rendering performance
- Legend is only rendered when visible

## Accessibility
- Clear labels in French suitable for students
- High contrast between text and background
- Large emoji symbols for easy identification
- Simple, intuitive drag interface

## Customization Options (Future)

If needed, these aspects can be easily customized:
- Legend position (default: top-left at 2%, 2%)
- Legend width (currently 160px)
- Legend transparency (currently 0.95)
- Label colors and fonts
- Animation when toggling visibility
- Keyboard shortcut to toggle (e.g., Alt+L)
