# Dashboard Component Structure

## Directory Overview

```
src/
├── components/
│   ├── layout/
│   │   └── DashboardGrid.tsx         # React Grid Layout wrapper
│   ├── widgets/
│   │   ├── WidgetWrapper.tsx         # Common widget wrapper
│   │   ├── CalendarWidget.tsx        # Calendar widget
│   │   ├── TodoWidget.tsx            # Todo list widget
│   │   ├── BookmarkWidget.tsx        # Bookmark widget
│   │   ├── ReadingWidget.tsx         # Reading list widget
│   │   ├── WeatherWidget.tsx         # Weather widget
│   │   └── index.ts                  # Widget exports
│   └── common/
│       └── WidgetHeader.tsx          # Widget common header
├── types/
│   └── index.ts                      # TypeScript type definitions
├── utils/
│   └── storage.ts                    # localStorage utilities
└── hooks/
    └── useLocalStorage.ts            # localStorage custom hook
```

## Component Descriptions

### Layout Components

#### DashboardGrid
- **Location**: `/src/components/layout/DashboardGrid.tsx`
- **Purpose**: Main grid layout wrapper using React Grid Layout
- **Features**:
  - Draggable widgets (via drag handle)
  - Resizable widgets
  - Layout persistence to localStorage
  - 12-column responsive grid
  - Vertical compaction

### Widget Components

All widgets follow a consistent structure using the `WidgetWrapper` component.

#### CalendarWidget
- **Location**: `/src/components/widgets/CalendarWidget.tsx`
- **Features**: Displays current date, month, year, and day of week

#### TodoWidget
- **Location**: `/src/components/widgets/TodoWidget.tsx`
- **Features**:
  - Add new tasks
  - Check off completed tasks
  - Delete tasks
  - Data persisted to localStorage

#### BookmarkWidget
- **Location**: `/src/components/widgets/BookmarkWidget.tsx`
- **Features**:
  - Add bookmarks (title + URL)
  - Open bookmarks in new tab
  - Delete bookmarks
  - Data persisted to localStorage

#### ReadingWidget
- **Location**: `/src/components/widgets/ReadingWidget.tsx`
- **Features**:
  - Add reading items (title, URL, author)
  - Mark as read/unread
  - Delete items
  - Data persisted to localStorage

#### WeatherWidget
- **Location**: `/src/components/widgets/WeatherWidget.tsx`
- **Features**:
  - Display temperature and conditions
  - Show humidity and wind speed
  - Weather icon display
  - Mock data (ready for API integration)

### Common Components

#### WidgetWrapper
- **Location**: `/src/components/widgets/WidgetWrapper.tsx`
- **Purpose**: Consistent styling and structure for all widgets
- **Features**:
  - Card-style container
  - Dark mode support
  - Integrates WidgetHeader
  - Scrollable content area

#### WidgetHeader
- **Location**: `/src/components/common/WidgetHeader.tsx`
- **Purpose**: Standard header for widgets
- **Features**:
  - Title display
  - Optional icon
  - Bottom border separator

## Type Definitions

### Core Types (`/src/types/index.ts`)

```typescript
type WidgetType = 'calendar' | 'todo' | 'bookmark' | 'reading' | 'weather'

interface LayoutItem {
  i: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
}

interface TodoItem {
  id: string
  text: string
  completed: boolean
  createdAt: Date
  priority?: 'low' | 'medium' | 'high'
}

interface BookmarkItem {
  id: string
  title: string
  url: string
  category?: string
  createdAt: Date
}

interface ReadingItem {
  id: string
  title: string
  url: string
  author?: string
  readLater: boolean
  createdAt: Date
}

interface WeatherData {
  location: string
  temperature: number
  condition: string
  humidity?: number
  windSpeed?: number
  lastUpdated: Date
}
```

## Utilities

### localStorage Utilities (`/src/utils/storage.ts`)

- **saveToStorage**: Save data to localStorage with JSON serialization
- **getFromStorage**: Retrieve and parse data from localStorage
- **removeFromStorage**: Remove data from localStorage

### Custom Hooks (`/src/hooks/useLocalStorage.ts`)

- **useLocalStorage**: React hook for syncing state with localStorage
  - Similar API to useState
  - Automatic persistence
  - Type-safe

## Styling

### Tailwind CSS
All components use Tailwind CSS utility classes for styling:
- Dark mode support via `dark:` variants
- Responsive design
- Consistent spacing and colors
- Hover and transition effects

### React Grid Layout CSS
Grid layout styles are imported in `/src/index.css`:
```css
@import 'react-grid-layout/css/styles.css';
@import 'react-resizable/css/styles.css';
```

Custom grid styles include:
- Smooth transitions for dragging/resizing
- Blue placeholder for drop zones
- Rounded corners for placeholder

## Usage

### Adding a New Widget

1. Create widget component in `/src/components/widgets/`
2. Use `WidgetWrapper` for consistent styling
3. Add widget to `/src/components/widgets/index.ts`
4. Import in `App.tsx`
5. Add to `defaultLayout` array in `App.tsx`
6. Add as child of `DashboardGrid`

### Layout Configuration

Default layout is defined in `App.tsx`:
```typescript
const defaultLayout: Layout[] = [
  { i: 'calendar', x: 0, y: 0, w: 4, h: 2, minW: 3, minH: 2 },
  { i: 'weather', x: 4, y: 0, w: 4, h: 2, minW: 3, minH: 2 },
  // ... more widgets
]
```

- `i`: Widget identifier (must match key in DashboardGrid children)
- `x`, `y`: Grid position (12-column grid)
- `w`, `h`: Width and height in grid units
- `minW`, `minH`: Minimum dimensions

## Development

### Running the Development Server
```bash
npm run dev
```

### Building for Production
```bash
npm run build
```

### Type Checking
```bash
npm run build  # Runs tsc -b before build
```

## Features

- Drag and drop widget repositioning
- Resize widgets by dragging corners
- Layout persists to localStorage
- All widget data persists to localStorage
- Dark mode support
- Responsive design
- TypeScript strict mode
- Clean component architecture

## Future Enhancements

- [ ] Weather API integration
- [ ] Calendar event management
- [ ] Widget configuration panel
- [ ] Export/import dashboard layout
- [ ] Additional widgets (notes, timer, music player)
- [ ] Theme customization
- [ ] Keyboard shortcuts
- [ ] Widget settings modal
