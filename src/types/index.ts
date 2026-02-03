// Widget types
export type WidgetType =
  | 'calendar'
  | 'todo'
  | 'bookmark'
  | 'reading'
  | 'weather';

// React Grid Layout item type
export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
}

// Todo item type
export interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:MM
  recurring?: 'none' | 'daily' | 'weekly' | 'monthly';
  lastCompletedDate?: string; // YYYY-MM-DD
  createdAt: string;
  subTodos?: TodoItem[]; // 하위 할 일 목록
  isExpanded?: boolean;  // 하위 할 일 펼침 여부
  alarm?: {
    enabled: boolean;
    interval: number;
    unit: 'minute' | 'hour';
    lastFired?: number; // timestamp (ms)
  };
}

// Bookmark item type
export interface BookmarkItem {
  id: string;
  name: string;
  url?: string;
  tags?: string[];
  createdAt: string;
  type?: 'link' | 'folder';
  parentId?: string | null;
}

// Reading item type
export interface ReadingItem {
  id: string;
  title: string;
  url: string;
  status: 'unread' | 'reading' | 'read';
  createdAt: string;
  subItems?: ReadingItem[]; // 하위 항목 목록
  isExpanded?: boolean;  // 하위 항목 펼침 여부
}

// Weather data type
export interface WeatherData {
  location: string;
  temperature: number;
  condition: string;
  humidity?: number;
  windSpeed?: number;
  icon?: string;
  lastUpdated: Date;
}

// Widget props interface
export interface WidgetProps {
  title: string;
  children?: React.ReactNode;
}
