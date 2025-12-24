# Weather Map Editor - Project Saving Features

## Overview
Complete project saving and loading system for the React weather map editor with auto-save, JSON export/import, and localStorage persistence.

## Features Implemented

### 1. **Auto-Save to localStorage**
- **Interval**: 30 seconds (configurable via `AUTO_SAVE_INTERVAL`)
- **Trigger**: Automatic save runs on a fixed interval independent of user actions
- **Data Saved**: 
  - Background (bgId, bgUrl, aspectRatio)
  - All elements (icons, labels, temps, winds, pressure zones)
  - Custom icons (user-created emoji icons)
- **Storage Key**: `"weathermap_project"`
- **Error Handling**: Gracefully catches and logs localStorage quota/write errors

### 2. **Auto-Restore on Page Load**
- When the component initializes, it attempts to load the last saved project
- Falls back to defaults if localStorage is empty or corrupted
- **Restored State**:
  - Background configuration
  - Map elements with all properties
  - Custom icons
  - Aspect ratio setting

### 3. **JSON Export**
- **Button**: "Exporter Projet" (blue outline)
- **Filename Format**: `weather-map-YYYY-MM-DD.json`
- **Content**:
  ```json
  {
    "version": 1,
    "timestamp": 1234567890,
    "bgId": "france",
    "bgUrl": "...",
    "aspectRatio": "16 / 9",
    "elements": [...],
    "customIcons": [...]
  }
  ```
- **Use Case**: Save projects locally for archiving, sharing, or backup

### 4. **JSON Import**
- **Button**: "Importer Projet" (folder icon)
- **File Type**: `.json` files only
- **Validation**: Checks for required fields (version, elements, customIcons)
- **On Import**:
  - Restores full project state (background, elements, icons, layout)
  - Clears selection and clipboard for fresh start
  - Shows success alert to user
  - Handles errors gracefully with user-friendly message

## Project Data Structure

```typescript
type ProjectData = {
  version: number;              // For future compatibility
  timestamp: number;            // When saved (unix ms)
  bgId: string;                 // "grid", "france", "europe", "world", or custom
  bgUrl: string | null;         // Data URI or image URL
  aspectRatio: string;          // "16 / 9" etc
  elements: ElementT[];         // All map elements
  customIcons: Array<{          // User-created icons
    id: string;
    label: string;
    glyph: string;              // emoji
  }>;
};
```

## Element Types Saved
- **IconElement**: Emoji icons with size
- **LabelElement**: City names with text styling
- **TempElement**: Temperature badges with colors
- **WindElement**: Wind speed indicators
- **PressureZoneElement**: Anticyclone/Depression circles with animations

## Usage

### Auto-Save
- Happens automatically every 30 seconds
- No user action required
- Persists across browser refreshes, system reboots, etc.

### Export Project
1. Click "Exporter Projet" button
2. JSON file downloads with current date in filename
3. Can be shared, emailed, or archived

### Import Project
1. Click "Importer Projet" button
2. Select a previously exported `.json` file
3. Entire project state restores immediately
4. Success confirmation shown

## Technical Details

### localStorage Limits
- **Size**: Typically 5-10MB per domain (browser dependent)
- **Quota**: One project can be ~100-500KB (depends on element count)
- **Multiple Projects**: You can store multiple exported files locally

### Backward Compatibility
- Version field allows future schema changes
- Defaults handle missing/corrupted data gracefully
- Timestamp useful for organizing multiple saves

### Performance Impact
- Auto-save runs non-blocking on 30s interval
- No interference with PNG export
- No performance impact on drawing/editing
- JSON parsing only on explicit import action

## Storage API Reference

### Internal Functions
```typescript
saveProjectToLocalStorage(data: ProjectData)      // Save to browser storage
loadProjectFromLocalStorage(): ProjectData | null // Load from browser storage
exportProjectAsJson(data: ProjectData): string    // Convert to JSON string
downloadJsonFile(content, filename)               // Trigger file download
importProjectFromJson(json): ProjectData | null   // Parse and validate JSON
```

## Error Handling

### localStorage Errors
- Caught and logged to console
- User not blocked (auto-save fails silently)
- Manual export always works (downloads to disk)

### Invalid JSON Import
- Shows user-friendly error alert
- Original project state unchanged
- File input cleared for retry

## Browser Compatibility
- Works in all modern browsers (Chrome, Firefox, Safari, Edge)
- localStorage: IE8+
- FileReader API: IE10+
- Tested with ES2015+ target

## Notes for Students
- **No Cloud**: Projects saved locally in your browser only
- **Browser Specific**: Each browser/device has its own storage
- **Export for Safety**: Regularly export important projects
- **Clear Cache Risk**: Clearing browser data will delete auto-saves
- **Manual Backups**: Export JSON files for permanent archiving

## Future Enhancement Ideas
- Cloud sync (optional)
- Version history / snapshots
- Project templates
- Sharing via URL/QR code
- Merge/combine projects
