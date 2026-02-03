
import React, { useState, useMemo, useEffect } from 'react';
import { WidgetWrapper } from './WidgetWrapper';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { LocationSearch } from '../common/LocationSearch';
import { GlassTimePicker } from '../common/GlassTimePicker'; // Added GlassTimePicker import
import type { TodoItem } from '../../types';

interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD (Start Date)
  endDate?: string; // YYYY-MM-DD (End Date)
  title: string;
  time?: string; // HH:MM
  location?: string; // 장소
  groupId?: string; // For linking multi-day/vertical recurrence events
}

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: Omit<CalendarEvent, 'id'>) => void;
  onDelete?: () => void;
  startDate: string;
  endDate: string;
  existingEvent?: CalendarEvent;
}

const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  startDate,
  endDate,
  existingEvent,
}) => {
  const [title, setTitle] = useState(existingEvent?.title || '');
  const [time, setTime] = useState(existingEvent?.time || '');
  const [location, setLocation] = useState(existingEvent?.location || '');

  useEffect(() => {
    setTitle(existingEvent?.title || '');
    setTime(existingEvent?.time || '');
    setLocation(existingEvent?.location || '');
  }, [existingEvent, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      date: startDate,
      endDate: endDate !== startDate ? endDate : undefined,
      title: title.trim(),
      time: time || undefined,
      location: location.trim() || undefined,
    });
    onClose();
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && title.trim()) {
      handleSave();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl w-full max-w-md overflow-visible shadow-2xl animate-scale-in"
        style={{ boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}
      >
        <div className="p-5">
          <h3 className="text-lg font-semibold text-white mb-1">
            {existingEvent ? 'Edit Event' : 'Add New Event'}
          </h3>
          <p className="text-sm text-white/60 mb-5">
            {startDate === endDate
              ? formatDateDisplay(startDate)
              : `${formatDateDisplay(startDate)} ~ ${formatDateDisplay(endDate)}`
            }
          </p>

          <div className="space-y-4" onKeyDown={handleKeyDown}>
            <div>
              <label
                htmlFor="modal-title"
                className="block text-sm font-medium text-white/80 mb-1"
              >
                Title <span className="text-white/80">*</span>
              </label>
              <input
                id="event-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Event Title"
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:bg-white/10 focus:border-white/30 transition-all"
                autoFocus
              />
            </div>

            <div>
              <label
                htmlFor="modal-time"
                className="block text-sm font-medium text-white/80 mb-1"
              >
                Time
              </label>
              <GlassTimePicker
                value={time}
                onChange={setTime}
              />
            </div>

            <div>
              <label
                htmlFor="event-location"
                className="block text-sm font-medium text-white/80 mb-1"
              >
                Location
              </label>
              <div className="location-search-wrapper">
                <LocationSearch
                  value={location}
                  onChange={(value) => setLocation(value)}
                  placeholder="Search for a place..."
                  limit={3} // Added limit prop
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-6">
            {existingEvent && onDelete && (
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium text-red-300 hover:text-red-200 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                Delete
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim()}
              className="px-5 py-2 text-sm font-medium text-white bg-white/10 border border-white/20 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors shadow-lg"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

type CalendarDisplayItem = {
  id: string;
  title: string;
  type: 'event' | 'todo';
  time?: string;
  isOverdue?: boolean;
  isMultiDay?: boolean;
  originalEvent?: CalendarEvent;
};

const sortItemsByPriority = (a: CalendarDisplayItem, b: CalendarDisplayItem) => {
  // 1. Multi-day events come first
  if (a.isMultiDay && !b.isMultiDay) return -1;
  if (!a.isMultiDay && b.isMultiDay) return 1;

  // 2. If both have no time (All day), sort by ID
  if (!a.time && !b.time) return a.id.localeCompare(b.id);

  // 3. Items without time (All day) come before timed items
  if (!a.time) return -1;
  if (!b.time) return 1;

  // 4. Sort by time
  if (a.time === b.time) return a.id.localeCompare(b.id);
  return a.time.localeCompare(b.time);
};

interface CalendarDay {
  date: number;
  dateStr: string;
  isCurrentMonth: boolean;
}

const EVENT_COLOR_CLASSES = [
  'bg-purple-500/20 hover:bg-purple-500/30 backdrop-blur-md border border-purple-200/40 text-purple-50 shadow-sm',
  'bg-blue-500/20 hover:bg-blue-500/30 backdrop-blur-md border border-blue-200/40 text-blue-50 shadow-sm',
  'bg-emerald-500/20 hover:bg-emerald-500/30 backdrop-blur-md border border-emerald-200/40 text-emerald-50 shadow-sm',
  'bg-rose-500/20 hover:bg-rose-500/30 backdrop-blur-md border border-rose-200/40 text-rose-50 shadow-sm',
  'bg-amber-500/20 hover:bg-amber-500/30 backdrop-blur-md border border-amber-200/40 text-amber-50 shadow-sm',
  'bg-indigo-500/20 hover:bg-indigo-500/30 backdrop-blur-md border border-indigo-200/40 text-indigo-50 shadow-sm',
  'bg-cyan-500/20 hover:bg-cyan-500/30 backdrop-blur-md border border-cyan-200/40 text-cyan-50 shadow-sm',
];

interface DayDetailsModalProps {
  dateStr: string | null;
  onClose: () => void;
  events: CalendarEvent[];
  onAddEvent: () => void;
  onEditEvent: (event: CalendarEvent) => void;
}

const DayDetailsModal: React.FC<DayDetailsModalProps> = ({
  dateStr,
  onClose,
  events,
  onAddEvent,
  onEditEvent,
}) => {
  if (!dateStr) return null;

  const date = new Date(dateStr + 'T00:00:00');
  const dateDisplay = date.toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  const dayEvents = events.filter((e) => {
    if (e.endDate) {
      return dateStr >= e.date && dateStr <= e.endDate;
    }
    return e.date === dateStr;
  }).map(e => ({
    id: e.id,
    title: e.title,
    type: 'event' as const,
    time: e.time,
    isMultiDay: !!(e.endDate && e.endDate !== e.date),
    originalEvent: e // Keep reference to original for click handling
  })).sort(sortItemsByPriority);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-scale-in"
        style={{ boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}
      >
        <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
          <h3 className="font-semibold text-white">
            {new Date(dateStr!.replace(/-/g, '/')).toLocaleDateString('en-US', { month: 'long', day: 'numeric', weekday: 'long' })}
          </h3>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">✕</button>
        </div>

        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3 custom-scrollbar">
          {dayEvents.length === 0 ? (
            <p className="text-center text-white/50 py-6 text-sm">No events.</p>
          ) : (
            dayEvents.map((e, index) => {
              const colorClass = EVENT_COLOR_CLASSES[index % EVENT_COLOR_CLASSES.length].split(' ')[0]; // Use just the bg part

              return (
                <div
                  key={e.id}
                  onClick={() => onEditEvent(e.originalEvent!)}
                  className="group cursor-pointer hover:bg-white/10 rounded-lg p-3 transition-colors border border-transparent hover:border-white/20"
                >
                  {/* Event Bar */}
                  <div className={`${colorClass} px-3 py-1.5 rounded-md text-sm font-medium shadow-sm mb-3 flex items-center`}>
                    <span className="mr-2 text-xs opacity-75">★</span> {e.title}
                  </div>

                  {/* Details */}
                  <div className="px-1 mt-1.5 flex flex-wrap items-center gap-x-4 text-sm text-gray-300">
                    {e.time && (
                      <span className="font-medium text-white tracking-wide">{e.time}</span>
                    )}
                    {e.originalEvent?.location && (
                      <span>{e.originalEvent.location}</span>
                    )}
                    {!e.time && !e.originalEvent?.location && (
                      <span className="text-gray-500 italic text-xs">No details</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            Close
          </button>
          <button
            onClick={onAddEvent}
            className="px-3 py-1.5 text-sm font-medium text-white bg-white/10 border border-white/20 hover:bg-white/20 rounded-lg transition-colors shadow-lg"
          >
            + Add Event
          </button>
        </div>
      </div>
    </div>
  );
};

export const CalendarWidget: React.FC = () => {
  const [events, setEvents] = useLocalStorage<CalendarEvent[]>('calendar-events', []);
  const [todos] = useLocalStorage<TodoItem[]>('todos', []);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedRange, setSelectedRange] = useState<{ start: string; end: string; type: 'vertical' | 'range' } | null>(null);
  const [viewDate, setViewDate] = useState<string | null>(null); // For detail view
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>(undefined);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);

  // Drag selection state
  const [dragStart, setDragStart] = useState<string | null>(null);
  const [dragEnd, setDragEnd] = useState<string | null>(null);
  const [dragHasLeftColumn, setDragHasLeftColumn] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const firstDayOfWeek = firstDay.getDay();

    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const days: CalendarDay[] = [];

    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const date = prevMonthLastDay - i;
      const prevMonth = month === 0 ? 12 : month;
      const prevYear = month === 0 ? year - 1 : year;
      const dateStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
      days.push({ date, dateStr, isCurrentMonth: false });
    }

    for (let date = 1; date <= daysInMonth; date++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
      days.push({ date, dateStr, isCurrentMonth: true });
    }

    const remainingCells = 7 - (days.length % 7);
    if (remainingCells < 7) {
      for (let date = 1; date <= remainingCells; date++) {
        const nextMonth = month === 11 ? 1 : month + 2;
        const nextYear = month === 11 ? year + 1 : year;
        const dateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
        days.push({ date, dateStr, isCurrentMonth: false });
      }
    }

    return days;
  }, [year, month]);

  const getItemsForDate = useMemo(() => {
    return (dateStr: string): CalendarDisplayItem[] => {
      const calEvents = events
        .filter((e) => {
          if (e.endDate) {
            return dateStr >= e.date && dateStr <= e.endDate;
          }
          return e.date === dateStr;
        })
        .map((e) => ({
          id: e.id,
          title: e.title,
          type: 'event' as const,
          time: e.time,
          isMultiDay: !!(e.endDate && e.endDate !== e.date)
        }));

      const dueTodos = todos
        .filter((t) => t.dueDate === dateStr && !t.completed)
        .map((t) => ({
          id: t.id,
          title: t.title,
          type: 'todo' as const,
          time: t.dueTime,
          isOverdue: t.dueDate! < todayStr,
          isMultiDay: false
        }));

      return [...calEvents, ...dueTodos];
    };
  }, [events, todos, todayStr]);

  const weekDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  const headerText = useMemo(() => {
    return currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }, [currentDate]);

  const goToPreviousMonth = () => {
    setSlideDirection('left');
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setSlideDirection('right');
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const isCurrentMonthToday = today.getFullYear() === year && today.getMonth() === month;

  // Helper
  const getDayOfWeek = (dateStr: string) => new Date(dateStr).getDay();

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent, dateStr: string) => {
    if (e.button !== 0) return; // Only allow left click
    setDragStart(dateStr);
    setDragEnd(dateStr);
    setDragHasLeftColumn(false);
  };

  const handleMouseEnter = (dateStr: string) => {
    if (dragStart) {
      setDragEnd(dateStr);
      // Check if we strayed from the column
      if (getDayOfWeek(dateStr) !== getDayOfWeek(dragStart)) {
        setDragHasLeftColumn(true);
      }
    }
  };

  const handleMouseUp = () => {
    if (dragStart && dragEnd) {
      const start = dragStart < dragEnd ? dragStart : dragEnd;
      const end = dragStart < dragEnd ? dragEnd : dragStart;

      // Vertical drag logic: same column AND didn't stray AND different dates
      const isVertical = getDayOfWeek(start) === getDayOfWeek(end) && start !== end && !dragHasLeftColumn;

      // If clicked on an event, handleEventClick handles it (propagation stopped)
      // Otherwise:
      setSelectedRange({ start, end, type: isVertical ? 'vertical' : 'range' });

      setDragStart(null);
      setDragEnd(null);
      setDragHasLeftColumn(false);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, dateStr: string) => {
    e.preventDefault();
    e.stopPropagation();
    // Ensure drag state is cleared
    setDragStart(null);
    setDragEnd(null);
    setDragHasLeftColumn(false);
    setViewDate(dateStr);
  };

  const isInDragRange = (dateStr: string) => {
    if (!dragStart || !dragEnd) return false;
    const start = dragStart < dragEnd ? dragStart : dragEnd;
    const end = dragStart < dragEnd ? dragEnd : dragStart;

    const isVertical = getDayOfWeek(start) === getDayOfWeek(end) && !dragHasLeftColumn;

    if (isVertical) {
      return dateStr >= start && dateStr <= end && getDayOfWeek(dateStr) === getDayOfWeek(start);
    }
    return dateStr >= start && dateStr <= end;
  };

  const handleEventClick = (e: React.MouseEvent, itemId: string, itemType: 'event' | 'todo') => {
    e.stopPropagation();
    if (itemType === 'event') {
      const event = events.find((evt) => evt.id === itemId);
      if (event) {
        setEditingEvent(event);
        setSelectedRange({ start: event.date, end: event.endDate || event.date, type: 'range' });
      }
    }
    // Todo click handling could be added here if needed
  };

  const handleSaveEvent = (eventData: Omit<CalendarEvent, 'id'>) => {
    const isVertical = selectedRange?.type === 'vertical';

    if (isVertical && !editingEvent) {
      const { date, endDate, ...rest } = eventData;
      const start = new Date(selectedRange!.start);
      const end = new Date(selectedRange!.end);
      const newEvents: CalendarEvent[] = [];
      const groupId = `${Date.now()}-group`; // Generate a group ID

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        newEvents.push({
          ...rest,
          date: dateStr,
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          groupId, // Assign group ID
        });
      }
      setEvents([...events, ...newEvents]);
    } else {
      if (editingEvent) {
        setEvents(
          events.map((evt) =>
            evt.id === editingEvent.id ? { ...eventData, id: evt.id, groupId: evt.groupId } : evt
          )
        );
      } else {
        const newEvent: CalendarEvent = {
          ...eventData,
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };
        setEvents([...events, newEvent]);
      }
    }
    setSelectedRange(null);
    setEditingEvent(undefined);
  };

  const handleDeleteEvent = () => {
    if (editingEvent) {
      if (editingEvent.groupId) {
        // Delete all events in the same group
        setEvents(events.filter((evt) => evt.groupId !== editingEvent.groupId));
      } else {
        // Delete single event
        setEvents(events.filter((evt) => evt.id !== editingEvent.id));
      }
    }
    setSelectedRange(null);
    setEditingEvent(undefined);
  };

  const handleCloseModal = () => {
    setSelectedRange(null);
    setEditingEvent(undefined);
  };

  const totalRows = calendarDays.length / 7;

  return (
    <WidgetWrapper title="Calendar">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-2 pb-3 sm:px-4 sm:pt-3 sm:pb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-100 tracking-tight">
            {headerText}
          </h2>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={goToToday}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-all border backdrop-blur-sm ${isCurrentMonthToday
                ? 'bg-[#4a4a4a]/20 border-white/5 text-white/30 cursor-default'
                : 'bg-[#4a4a4a]/40 border-white/10 text-white hover:bg-[#4a4a4a]/60 active:bg-[#4a4a4a]/80'
                } `}
            >
              Today
            </button>
            <button
              onClick={goToPreviousMonth}
              className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Previous month"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={goToNextMonth}
              className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Next month"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-gray-700/60 px-1">
          {weekDays.map((day, index) => (
            <div
              key={day}
              className={`text-center text-[11px] sm: text-xs font-semibold py-1.5 sm: py-2 uppercase tracking-wider ${index === 0
                ? 'text-red-400'
                : index === 6
                  ? 'text-blue-400'
                  : 'text-gray-500'
                } `}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div
          key={headerText} // Trigger animation on month change
          className={`grid grid-cols-7 flex-1 ${slideDirection === 'left' ? 'animate-slide-left' : slideDirection === 'right' ? 'animate-slide-right' : ''}`}
          style={{ gridTemplateRows: `repeat(${totalRows}, minmax(5rem, 1fr))` }}
        >
          {calendarDays.map((day, index) => {
            const { date, dateStr, isCurrentMonth } = day;
            const isToday = dateStr === todayStr;
            const dayOfWeek = index % 7;
            const isSunday = dayOfWeek === 0;
            const isSaturday = dayOfWeek === 6;
            const rowIndex = Math.floor(index / 7);
            const isLastRow = rowIndex === totalRows - 1;

            const items = isCurrentMonth ? getItemsForDate(dateStr) : [];
            items.sort(sortItemsByPriority);

            const visibleItems = items.slice(0, 3);
            const overflowCount = items.length > 3 ? items.length - 3 : 0;

            const borderClasses = [
              !isLastRow ? 'border-b border-gray-700/40' : '',
              dayOfWeek < 6 ? 'border-r border-gray-700/40' : '',
            ].join(' ');

            const isDragSelected = isInDragRange(dateStr);

            return (
              <button
                key={`${dateStr} -${index} `}
                onMouseDown={(e) => isCurrentMonth && handleMouseDown(e, dateStr)}
                onMouseEnter={() => isCurrentMonth && handleMouseEnter(dateStr)}
                onMouseUp={() => isCurrentMonth && handleMouseUp()}
                onContextMenu={(e) => isCurrentMonth && handleContextMenu(e, dateStr)}
                className={`
                  relative flex flex-col items-start text-left transition-colors overflow-hidden
                  ${borderClasses}
                  ${isCurrentMonth ? 'hover:bg-white/10 cursor-pointer' : 'cursor-default'}
                  ${!isCurrentMonth ? 'opacity-40 bg-transparent' : ''}
                  ${isDragSelected ? 'z-0' : ''}
`}
                disabled={!isCurrentMonth}
              >
                {isDragSelected && (
                  <div className="absolute inset-0 bg-white/20 backdrop-blur-md border-2 border-white/30 shadow-[inset_0_0_20px_rgba(255,255,255,0.2)] pointer-events-none z-0 transition-all" />
                )}

                {/* Date number */}
                <div className="flex items-start justify-start w-full px-1 sm:px-1.5 pt-1.5 mb-0.5 z-10">
                  {isToday ? (
                    <span className="inline-flex mt-1 items-center justify-center w-5 h-5 rounded-full bg-red-500/60 backdrop-blur-sm border border-red-500/30 text-white text-[10px] font-bold shadow-lg shadow-red-500/20">
                      {date}
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 sm: w-7 sm: h7 text-xs sm: text-sm ${!isCurrentMonth
                        ? 'text-gray-600'
                        : isSunday
                          ? 'text-red-400 font-medium'
                          : isSaturday
                            ? 'text-blue-400 font-medium'
                            : 'text-gray-300 font-medium'
                        } `}
                    >
                      {date}
                    </span>
                  )}
                </div>

                {/* Event/Todo bars */}
                {isCurrentMonth && visibleItems.length > 0 && (
                  <div className="flex flex-col w-full min-w-0 z-10 space-y-1 pb-1">
                    {visibleItems.map((item, index) => {
                      let barClass = '';
                      let icon = '';

                      const originalEvent = events.find(e => e.id === item.id);
                      const isMultiDay = originalEvent?.endDate && originalEvent.endDate !== originalEvent.date;

                      const isEventStart = originalEvent?.date === dateStr;
                      const isEventEnd = originalEvent?.endDate === dateStr;
                      const isWeekStart = dayOfWeek === 0;
                      const isWeekEnd = dayOfWeek === 6;

                      const isVisualStart = isEventStart || isWeekStart;
                      const isVisualEnd = isEventEnd || isWeekEnd;
                      const showText = isVisualStart;

                      if (item.type === 'event') {
                        const colorClasses = EVENT_COLOR_CLASSES[index % EVENT_COLOR_CLASSES.length];
                        barClass = `${colorClasses} cursor-pointer`;
                        icon = '\u2605';
                      } else if (item.isOverdue) {
                        barClass = 'bg-red-500/20 hover:bg-red-500/30 backdrop-blur-md border border-red-200/40 text-red-50 cursor-pointer shadow-sm';
                      } else {
                        barClass = 'bg-blue-500/20 hover:bg-blue-500/30 backdrop-blur-md border border-blue-200/40 text-blue-50 cursor-pointer shadow-sm';
                      }

                      // Adjust styles for continuous look
                      const marginClass = isMultiDay
                        ? `${isVisualStart ? 'ml-1' : '-ml-[1px]'} ${isVisualEnd ? 'mr-1' : '-mr-[1px]'} `
                        : 'mx-1';

                      const roundClass = isMultiDay
                        ? `${isVisualStart ? 'rounded-l-md' : 'rounded-l-none'} ${isVisualEnd ? 'rounded-r-md' : 'rounded-r-none'} `
                        : 'rounded-md';

                      return (
                        <div
                          key={item.id}
                          className={`${barClass} ${marginClass} ${roundClass} py-0.5 px-1 h-5 text-xs sm: text-sm leading-none truncate whitespace-nowrap overflow-hidden relative`}
                          title={item.title}
                          onClick={(e) => handleEventClick(e, item.id, item.type)}
                        >
                          {showText ? (
                            <div className="flex items-center">
                              {item.type === 'event' && <span className="mr-0.5 text-[0.7em]">{icon}</span>}
                              {item.title}
                            </div>
                          ) : (
                            <span className="opacity-0">&nbsp;</span>
                          )}
                        </div>
                      );
                    })}
                    {overflowCount > 0 && (
                      <span className="text-xs sm:text-sm text-gray-500 pl-1.5">
                        +{overflowCount}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Event Modal */}
      <EventModal
        isOpen={selectedRange !== null}
        onClose={handleCloseModal}
        onSave={handleSaveEvent}
        onDelete={editingEvent ? handleDeleteEvent : undefined}
        startDate={selectedRange?.start || ''}
        endDate={selectedRange?.end || ''}
        existingEvent={editingEvent}
      />

      {/* Day Details Modal */}
      <DayDetailsModal
        dateStr={viewDate}
        onClose={() => setViewDate(null)}
        events={events}
        onAddEvent={() => {
          if (viewDate) {
            setSelectedRange({ start: viewDate, end: viewDate, type: 'range' });
            setViewDate(null);
          }
        }}
        onEditEvent={(event) => {
          setEditingEvent(event);
          setSelectedRange({ start: event.date, end: event.endDate || event.date, type: 'range' });
          setViewDate(null);
        }}
      />
    </WidgetWrapper>
  );
};
