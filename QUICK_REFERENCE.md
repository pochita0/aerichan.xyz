# Dashboard Quick Reference

## Component Hierarchy

```
App
└── DashboardGrid (React Grid Layout wrapper)
    ├── CalendarWidget
    │   └── WidgetWrapper
    │       └── WidgetHeader
    ├── WeatherWidget
    │   └── WidgetWrapper
    │       └── WidgetHeader
    ├── TodoWidget
    │   └── WidgetWrapper
    │       └── WidgetHeader
    ├── BookmarkWidget
    │   └── WidgetWrapper
    │       └── WidgetHeader
    └── ReadingWidget
        └── WidgetWrapper
            └── WidgetHeader
```

## Data Flow

```
Widget Component
    ↓
useLocalStorage Hook
    ↓
storage.ts Utilities
    ↓
localStorage API
```

## Key File Locations

| Component | Path |
|-----------|------|
| **Main App** | `/Users/jong-geon/Desktop/aeri.xyz/dashboard/src/App.tsx` |
| **Grid Layout** | `/Users/jong-geon/Desktop/aeri.xyz/dashboard/src/components/layout/DashboardGrid.tsx` |
| **Widgets** | `/Users/jong-geon/Desktop/aeri.xyz/dashboard/src/components/widgets/` |
| **Types** | `/Users/jong-geon/Desktop/aeri.xyz/dashboard/src/types/index.ts` |
| **Storage** | `/Users/jong-geon/Desktop/aeri.xyz/dashboard/src/utils/storage.ts` |
| **Hook** | `/Users/jong-geon/Desktop/aeri.xyz/dashboard/src/hooks/useLocalStorage.ts` |

## localStorage Keys

| Key | Purpose | Data Type |
|-----|---------|-----------|
| `dashboard-layout` | Grid layout positions | `Layout[]` |
| `todos` | Todo list items | `TodoItem[]` |
| `bookmarks` | Bookmark items | `BookmarkItem[]` |
| `readings` | Reading list items | `ReadingItem[]` |

## Grid Layout Configuration

- **Columns**: 12
- **Row Height**: 100px
- **Drag Handle**: `.drag-handle` class
- **Compact Type**: Vertical
- **Min Widget Width**: 3 columns
- **Min Widget Height**: 2-3 rows (varies by widget)

## Widget Sizes (Default)

| Widget | Width (cols) | Height (rows) | Position (x, y) |
|--------|--------------|---------------|-----------------|
| Calendar | 4 | 2 | 0, 0 |
| Weather | 4 | 2 | 4, 0 |
| Todo | 4 | 4 | 8, 0 |
| Bookmark | 4 | 3 | 0, 2 |
| Reading | 4 | 3 | 4, 2 |

## Tailwind CSS Classes Used

### Colors
- `bg-white` / `dark:bg-gray-800` - Widget backgrounds
- `text-gray-800` / `dark:text-gray-100` - Primary text
- `border-gray-200` / `dark:border-gray-700` - Borders

### Layout
- `flex`, `flex-col` - Flexbox layouts
- `p-4`, `px-3`, `py-2` - Padding
- `rounded-lg`, `rounded-md` - Border radius
- `shadow-lg` - Box shadows

### Interactions
- `hover:bg-gray-50` - Hover states
- `focus:ring-2` - Focus indicators
- `transition-colors` - Smooth transitions

## Common Patterns

### Creating a New Widget

```typescript
import React from 'react';
import { WidgetWrapper } from './WidgetWrapper';

export const MyWidget: React.FC = () => {
  return (
    <WidgetWrapper title="My Widget" icon="🎨">
      <div>Widget content here</div>
    </WidgetWrapper>
  );
};
```

### Using localStorage Hook

```typescript
import { useLocalStorage } from '../../hooks/useLocalStorage';

const [data, setData] = useLocalStorage<MyType[]>('my-key', []);
```

### Adding to Grid

1. Import widget in `App.tsx`
2. Add layout config to `defaultLayout`
3. Add widget component as child of `DashboardGrid`

## Development Commands

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Type check
npx tsc --noEmit

# Lint
npm run lint
```

## Current Status

- Development Server: http://localhost:5174/
- TypeScript: No errors
- All components: Implemented
- Grid Layout: Functional
- localStorage: Integrated
- Dark Mode: Supported

## Widget Features Summary

| Widget | Add | Edit | Delete | Persist | Icon |
|--------|-----|------|--------|---------|------|
| Calendar | - | - | - | - | 📅 |
| Weather | - | - | - | - | 🌡️ |
| Todo | ✓ | ✓ | ✓ | ✓ | ✓ |
| Bookmark | ✓ | - | ✓ | ✓ | 🔖 |
| Reading | ✓ | ✓ | ✓ | ✓ | 📚 |

## Accessibility Features

- Semantic HTML structure
- Keyboard accessible forms
- Focus indicators on inputs
- Proper button types
- ARIA-friendly markup

## Browser Compatibility

Tested with modern browsers supporting:
- CSS Grid
- Flexbox
- localStorage API
- ES6+ JavaScript
- CSS Custom Properties
