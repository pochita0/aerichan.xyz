
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { WidgetWrapper } from './WidgetWrapper';
import { LocationSearch } from '../common/LocationSearch';
import { CalendarPicker } from '../../components/common/CalendarPicker';
import { GlassTimePicker } from '../../components/common/GlassTimePicker';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import type { TodoItem } from '../../types';

// Swipeable Todo Item Component
interface SwipeableTodoItemProps {
  todo: TodoItem;
  isEditing: boolean;
  editingText: string;
  editingRecurring: 'none' | 'daily' | 'weekly' | 'monthly';
  onToggle: () => void;
  onDelete: () => void;
  onStartEdit: () => void;
  onEditTextChange: (text: string) => void;
  onEditRecurringChange: (recurring: 'none' | 'daily' | 'weekly' | 'monthly') => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  getDueDateStatus: (dueDate?: string) => string;
  formatDueDateTime: (dueDate?: string, dueTime?: string) => string;
  getRecurringIcon: (recurring?: 'none' | 'daily' | 'weekly' | 'monthly') => React.ReactNode;
  // Sub-task props
  depth?: number;
  hasSubTodos?: boolean;
  isExpanded?: boolean;
  onToggleSubTasks?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

const SwipeableTodoItem: React.FC<SwipeableTodoItemProps> = ({
  todo,
  isEditing,
  editingText,
  editingRecurring,
  onToggle,
  onDelete,
  onStartEdit,
  onEditTextChange,
  onEditRecurringChange,
  onSaveEdit,
  onCancelEdit,
  getDueDateStatus,
  formatDueDateTime,
  getRecurringIcon,
  depth = 0,
  hasSubTodos,
  isExpanded,
  onToggleSubTasks,
  onContextMenu,
}) => {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const itemRef = useRef<HTMLDivElement>(null);

  const SWIPE_THRESHOLD = 80; // pixels to trigger delete
  const DELETE_ANIMATION_DURATION = 300;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isEditing) return;
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = e.touches[0].clientX;
    setIsDragging(true);
  }, [isEditing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || isEditing) return;
    currentXRef.current = e.touches[0].clientX;
    const diff = currentXRef.current - startXRef.current;
    // Limit the swipe distance with resistance
    const limitedDiff = Math.sign(diff) * Math.min(Math.abs(diff), 150);
    setTranslateX(limitedDiff);
  }, [isDragging, isEditing]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging || isEditing) return;
    setIsDragging(false);

    if (Math.abs(translateX) >= SWIPE_THRESHOLD) {
      // Trigger delete animation
      setIsDeleting(true);
      setTranslateX(translateX > 0 ? 300 : -300);
      setTimeout(() => {
        onDelete();
      }, DELETE_ANIMATION_DURATION);
    } else {
      // Snap back
      setTranslateX(0);
    }
  }, [isDragging, isEditing, translateX, onDelete]);

  // Mouse events for desktop
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isEditing || e.button !== 0) return;

    // Allow native drag if clicking the handle
    if ((e.target as HTMLElement).closest('.drag-handle')) return;

    e.preventDefault(); // Prevent native drag to allow swipe

    startXRef.current = e.clientX;
    currentXRef.current = e.clientX;
    setIsDragging(true);

    const handleMouseMove = (e: MouseEvent) => {
      currentXRef.current = e.clientX;
      const diff = currentXRef.current - startXRef.current;
      const limitedDiff = Math.sign(diff) * Math.min(Math.abs(diff), 150);
      setTranslateX(limitedDiff);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      const diff = currentXRef.current - startXRef.current;
      if (Math.abs(diff) >= SWIPE_THRESHOLD) {
        setIsDeleting(true);
        setTranslateX(diff > 0 ? 300 : -300);
        setTimeout(() => {
          onDelete();
        }, DELETE_ANIMATION_DURATION);
      } else {
        setTranslateX(0);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [isEditing, onDelete]);

  // Double click to edit
  const handleDoubleClick = useCallback(() => {
    if (!isEditing) {
      onStartEdit();
    }
  }, [isEditing, onStartEdit]);

  // Single click to toggle (with delay to differentiate from double click)
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleClick = useCallback(() => {
    if (isEditing || isDragging || Math.abs(translateX) > 5) return;

    if (clickTimeoutRef.current) {
      // Double click detected, clear single click
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      handleDoubleClick();
    } else {
      // Wait to see if it's a double click
      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = null;
        onToggle();
      }, 200);
    }
  }, [isEditing, isDragging, translateX, onToggle, handleDoubleClick]);

  const dueDateStatus = getDueDateStatus(todo.dueDate);

  // Get swipe style (like ReadingWidget)
  const getSwipeStyle = (): React.CSSProperties => {
    if (isDeleting) {
      const dir = translateX > 0 ? 1 : -1;
      return {
        transform: `translateX(${dir * 500}px)`,
        opacity: 0,
        transition: 'transform 0.3s ease-out, opacity 0.3s ease-out',
      };
    }
    if (isDragging) {
      const opacity = Math.max(0.3, 1 - Math.abs(translateX) / 300);
      return {
        transform: `translateX(${translateX}px)`,
        opacity,
        transition: 'none',
      };
    }
    return {
      transform: 'translateX(0)',
      opacity: 1,
      transition: 'transform 0.3s ease-out, opacity 0.3s ease-out',
    };
  };

  return (
    <div className="overflow-hidden rounded-md mb-2">
      {/* Main item */}
      <div
        ref={itemRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onContextMenu={(e) => {
          console.log('Right click detected on item', todo.id);
          if (onContextMenu) {
            e.preventDefault();
            e.stopPropagation(); // Stop propagation just in case
            onContextMenu(e);
          } else {
            console.warn('onContextMenu prop is missing');
          }
        }}
        onClick={handleClick}
        style={{ ...getSwipeStyle(), marginLeft: depth * 24 }}
        className={`flex items-start gap-2 p-3 rounded-xl group transition-all duration-200 select-none cursor-grab active:cursor-grabbing border backdrop-blur-sm ${isEditing ? 'border-white/20 bg-black/40' : ''
          } ${dueDateStatus === 'overdue' && !todo.completed
            ? 'bg-red-500/20 border-red-500/30 hover:bg-red-500/30'
            : dueDateStatus === 'today' && !todo.completed
              ? 'bg-yellow-500/20 border-yellow-500/30 hover:bg-yellow-500/30'
              : 'bg-black/40 border-white/5 hover:bg-black/50 hover:border-white/10'
          } `}
      >
        {isEditing ? (
          // Edit Mode
          <div className="flex-1 space-y-2" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={editingText}
              onChange={(e) => onEditTextChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveEdit();
                if (e.key === 'Escape') onCancelEdit();
              }}
              className="w-full px-2 py-1.5 text-sm border border-white/10 rounded-lg bg-black/20 text-white focus:outline-none focus:bg-black/40 focus:border-white/30 backdrop-blur-sm placeholder-white/30"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <select
                value={editingRecurring}
                onChange={(e) => onEditRecurringChange(e.target.value as any)}
                className="flex-1 px-2 py-1.5 text-xs border border-white/10 rounded-lg bg-black/20 text-white focus:outline-none focus:bg-black/40 focus:border-white/30 [&>option]:bg-[#252525] [&>option]:text-white"
              >
                <option value="none">No repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              <button
                onClick={onSaveEdit}
                className="px-2 py-1.5 text-xs bg-green-500/20 border border-green-500/30 text-green-300 rounded-lg hover:bg-green-500/30 transition-colors"
              >
                Save
              </button>
              <button
                onClick={onCancelEdit}
                className="px-2 py-1.5 text-xs bg-white/10 border border-white/10 text-white/70 rounded-lg hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          // View Mode
          <>
            {/* Drag Handle */}
            <div
              className="drag-handle cursor-grab active:cursor-grabbing p-1 -ml-1 text-white/30 hover:text-white/60 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
            </div>

            {/* Custom Checkbox (Bullet or L-shape) */}
            <div
              className={`leading-none mt-0.5 cursor-pointer select-none transition-colors ${todo.completed
                ? 'text-white/30'
                : 'text-white/80 hover:text-blue-400'
                } ${depth > 0 ? 'text-sm mr-1' : 'text-xl'} `}
            >
              {depth > 0 ? '└' : '•'}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-base break-words transition-colors ${todo.completed
                    ? 'line-through text-white/30 decoration-white/30'
                    : 'text-white/90'
                    } `}
                >
                  {todo.title}
                </span>
                {getRecurringIcon(todo.recurring)}
              </div>
              {(todo.dueDate || todo.dueTime) && (
                <div className="flex items-center gap-2 mt-1">
                  <p
                    className={`text-xs ${dueDateStatus === 'overdue' && !todo.completed
                      ? 'text-red-400 font-medium'
                      : dueDateStatus === 'today' && !todo.completed
                        ? 'text-yellow-400 font-medium'
                        : 'text-white/50'
                      } `}
                  >
                    {formatDueDateTime(todo.dueDate, todo.dueTime)}
                  </p>
                </div>
              )}

            </div>
          </>
        )}
      </div>
    </div>
  );
};

export const TodoWidget: React.FC = () => {
  const [todos, setTodos] = useLocalStorage<TodoItem[]>('todos', []);
  const [inputValue, setInputValue] = useState('');
  const [recurringType, setRecurringType] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editingRecurring, setEditingRecurring] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalDate, setModalDate] = useState('');
  const [modalTime, setModalTime] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [modalRecurringType, setModalRecurringType] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const [parentTodoId, setParentTodoId] = useState<string | null>(null);

  // Alarm state
  const [isAlarm, setIsAlarm] = useState(false);
  const [alarmInterval, setAlarmInterval] = useState('1');
  const [alarmUnit, setAlarmUnit] = useState<'minute' | 'hour'>('hour');

  // Drag & Drop state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleContextMenu = (e: React.MouseEvent, todoId: string, depth: number) => {
    e.preventDefault();
    e.stopPropagation();

    // Prevent creating sub-tasks for sub-tasks (max depth 1)
    if (depth >= 1) return;

    // Open modal for sub-task
    setParentTodoId(todoId);
    setModalTitle('');
    setModalDate('');
    setModalTime('');
    setIsRecurring(false);
    setModalRecurringType('daily');

    setIsAlarm(false);
    setAlarmInterval('1');
    setAlarmUnit('hour');
    setIsModalOpen(true);
  };

  // Check and regenerate recurring todos on mount and when todos change
  // Reset time: 5:00 AM
  useEffect(() => {
    // Helper to get the "cycle date" (YYYY-MM-DD) for a given date
    // Cycle starts at 5:00 AM. So we subtract 5 hours from the time to get the logic date.
    // e.g. 04:59 AM -> Previous Day. 05:00 AM -> Today.
    const getCycleDate = (dateObj: Date) => {
      const shifted = new Date(dateObj);
      shifted.setHours(shifted.getHours() - 5);
      // Use local YYYY-MM-DD
      const y = shifted.getFullYear();
      const m = String(shifted.getMonth() + 1).padStart(2, '0');
      const d = String(shifted.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const now = new Date();
    const todayCycle = getCycleDate(now);

    let hasChanges = false;

    const updatedTodos = todos.map((todo) => {
      if (!todo.recurring || todo.recurring === 'none' || !todo.completed || !todo.lastCompletedDate) {
        return todo;
      }

      const lastCompleted = new Date(todo.lastCompletedDate);
      const lastCycle = getCycleDate(lastCompleted);

      // Compare cycle dates
      // Convert to timestamps for easier diff calc
      const todayTime = new Date(todayCycle).getTime(); // Local midnight of cycle date
      const lastTime = new Date(lastCycle).getTime();

      const dayMs = 1000 * 60 * 60 * 24;
      const daysDiff = Math.floor((todayTime - lastTime) / dayMs);

      let shouldRegenerate = false;

      if (todo.recurring === 'daily' && daysDiff >= 1) {
        shouldRegenerate = true;
      } else if (todo.recurring === 'weekly' && daysDiff >= 7) {
        shouldRegenerate = true;
      } else if (todo.recurring === 'monthly') {
        const d1 = new Date(todayCycle);
        const d2 = new Date(lastCycle);
        const monthsDiff = (d1.getFullYear() - d2.getFullYear()) * 12 + (d1.getMonth() - d2.getMonth());
        if (monthsDiff >= 1) {
          shouldRegenerate = true;
        }
      }

      if (shouldRegenerate) {
        hasChanges = true;
        return { ...todo, completed: false };
      }

      return todo;
    });

    if (hasChanges) {
      setTodos(updatedTodos);
    }

  }, [todos, setTodos]);

  // Alarm Check Effect
  useEffect(() => {
    const playAlarmSound = () => {
      // Simple beep sound
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3'); // Notification chime
      audio.volume = 0.5;
      audio.play().catch(e => console.warn('Audio play failed:', e));
    };

    const checkAlarms = () => {
      const now = Date.now();
      let hasUpdates = false;

      // Recursive check and update
      const checkTree = (items: TodoItem[]): TodoItem[] => {
        return items.map(item => {
          let newItem = { ...item };

          if (newItem.subTodos) {
            newItem.subTodos = checkTree(newItem.subTodos);
          }

          if (newItem.alarm && newItem.alarm.enabled) {
            const { interval, unit, lastFired } = newItem.alarm;
            const intervalMs = unit === 'minute'
              ? interval * 60 * 1000
              : interval * 60 * 60 * 1000;

            // If never fired, base it on createdAt, otherwise lastFired
            const baseTime = lastFired || new Date(newItem.createdAt).getTime();

            if (now - baseTime >= intervalMs) {
              console.log('Triggering alarm for:', newItem.title);
              playAlarmSound();
              // Show notification if supported
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Todo Alarm', { body: newItem.title });
              }

              newItem.alarm = {
                ...newItem.alarm,
                lastFired: now
              };
              hasUpdates = true;
            }
          }
          return newItem;
        });
      };

      // We need to update state if alarms fired to save 'lastFired'
      const updated = checkTree(todos);
      if (hasUpdates) {
        setTodos(updated);
      }
    };

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const timer = setInterval(checkAlarms, 30000); // Check every 30s
    return () => clearInterval(timer);
  }, [todos, setTodos]);

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      const newTodo: TodoItem = {
        id: Date.now().toString(),
        title: inputValue.trim(),
        completed: false,
        recurring: recurringType === 'none' ? undefined : recurringType,
        createdAt: new Date().toISOString(),
      };
      setTodos([...todos, newTodo]);
      setInputValue('');
      setRecurringType('none');
    }
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (modalTitle.trim()) {
      const newTodo: TodoItem = {
        id: Date.now().toString(),
        title: modalTitle.trim(),
        completed: false,
        dueDate: modalDate || undefined,
        dueTime: modalTime || undefined,
        recurring: isRecurring ? modalRecurringType : undefined,
        createdAt: new Date().toISOString(),
        alarm: isAlarm ? {
          enabled: true,
          interval: parseInt(alarmInterval) || 1,
          unit: alarmUnit,
          lastFired: Date.now()
        } : undefined,
      };

      if (parentTodoId) {
        // Add as sub-task
        const addSubTaskToTree = (items: TodoItem[]): TodoItem[] => {
          return items.map((item) => {
            if (item.id === parentTodoId) {
              return {
                ...item,
                subTodos: [...(item.subTodos || []), newTodo],
                isExpanded: true,
              };
            }
            if (item.subTodos) {
              return { ...item, subTodos: addSubTaskToTree(item.subTodos) };
            }
            return item;
          });
        };
        setTodos((prev) => addSubTaskToTree(prev));
      } else {
        // Add as top-level task
        setTodos([...todos, newTodo]);
      }

      closeModal();
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setParentTodoId(null);
    setModalTitle('');
    setModalDate('');
    setModalTime('');
    setIsRecurring(false);
    setModalRecurringType('daily');
    setIsAlarm(false);
    setAlarmInterval('1');
    setAlarmUnit('hour');
  };

  /* Helper Functions */

  const getDueDateStatus = (dueDate?: string) => {
    if (!dueDate) return 'none';
    const today = new Date().toISOString().split('T')[0];
    if (dueDate < today) return 'overdue';
    if (dueDate === today) return 'today';
    return 'upcoming';
  };

  const formatDueDateTime = (dueDate?: string, dueTime?: string) => {
    if (!dueDate) return '';
    const date = new Date(dueDate);
    const dateStr = date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    if (dueTime) {
      return `${dateStr} ${dueTime} `;
    }
    return dateStr;
  };

  // Recursive update helper
  const updateTodoInTree = (items: TodoItem[], id: string, updater: (item: TodoItem) => TodoItem | null): TodoItem[] => {
    return items.reduce<TodoItem[]>((acc, item) => {
      if (item.id === id) {
        const updated = updater(item);
        if (updated) acc.push(updated);
      } else {
        const newItem = { ...item };
        if (item.subTodos) {
          newItem.subTodos = updateTodoInTree(item.subTodos, id, updater);
        }
        acc.push(newItem);
      }
      return acc;
    }, []);
  };

  // Sub-task handlers
  const handleAddSubTask = (parentId: string) => {
    const newSubTodo: TodoItem = {
      id: Date.now().toString(),
      title: '새 하위 할 일',
      completed: false,
      createdAt: new Date().toISOString(),
      recurring: 'none',
    };

    const addSubTaskToTree = (items: TodoItem[]): TodoItem[] => {
      return items.map((item) => {
        if (item.id === parentId) {
          return {
            ...item,
            subTodos: [...(item.subTodos || []), newSubTodo],
            isExpanded: true,
          };
        }
        if (item.subTodos) {
          return { ...item, subTodos: addSubTaskToTree(item.subTodos) };
        }
        return item;
      });
    };

    setTodos((prev) => addSubTaskToTree(prev));
    setContextMenu(null);
    startEditing(newSubTodo);
  };

  const toggleSubTasks = (todoId: string) => {
    const toggleInTree = (items: TodoItem[]): TodoItem[] => {
      return items.map((item) => {
        if (item.id === todoId) {
          return { ...item, isExpanded: !item.isExpanded };
        }
        if (item.subTodos) {
          return { ...item, subTodos: toggleInTree(item.subTodos) };
        }
        return item;
      });
    };
    setTodos((prev) => toggleInTree(prev));
  };

  // Synchronize parent completion status based on children (Bottom-up sync)
  const syncCompletionStatus = (items: TodoItem[]): TodoItem[] => {
    return items.map((item) => {
      let newItem = { ...item };
      if (newItem.subTodos && newItem.subTodos.length > 0) {
        // First sync children recursively
        newItem.subTodos = syncCompletionStatus(newItem.subTodos);

        // Then check if all children are completed
        const allCompleted = newItem.subTodos.every((sub) => sub.completed);

        // Update parent status if different
        if (newItem.completed !== allCompleted) {
          newItem.completed = allCompleted;
          // Automatically collapse if completed
          if (allCompleted) {
            newItem.isExpanded = false;
          }
        }
      }
      return newItem;
    });
  };

  // Main handlers (recursive)
  const toggleTodo = (id: string, hasSubTodos: boolean) => {
    if (hasSubTodos) {
      toggleSubTasks(id);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    setTodos((prev) => {
      const toggled = updateTodoInTree(prev, id, (item) => {
        const newCompleted = !item.completed;
        if (newCompleted && item.recurring && item.recurring !== 'none') {
          return { ...item, completed: newCompleted, lastCompletedDate: today };
        }
        return { ...item, completed: newCompleted };
      });

      return syncCompletionStatus(toggled);
    });
  };

  const deleteTodo = (id: string) => {
    setTodos((prev) => updateTodoInTree(prev, id, () => null));
  };

  const startEditing = (todo: TodoItem) => {
    setEditingId(todo.id);
    setEditingText(todo.title);
    setEditingRecurring(todo.recurring || 'none');
  };

  const saveEdit = () => {
    if (!editingId || !editingText.trim()) return;

    setTodos((prev) => updateTodoInTree(prev, editingId, (item) => ({
      ...item,
      title: editingText.trim(),
      recurring: editingRecurring === 'none' ? undefined : editingRecurring,
    })));

    setEditingId(null);
    setEditingText('');
    setEditingRecurring('none');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText('');
    setEditingRecurring('none');
  };

  const getRecurringIcon = (recurring?: 'none' | 'daily' | 'weekly' | 'monthly') => {
    return null;
  };

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetId: string, depth: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    // Only allow dropping on root-level items (max depth 1 for sub-tasks)
    if (targetId !== draggedId && depth === 0) {
      setDragOverId(targetId);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string, depth: number) => {
    e.preventDefault();
    setDragOverId(null);
    setDraggedId(null);

    const sourceId = e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetId || depth > 0) return;

    // Find and remove source todo from tree
    const findAndRemove = (items: TodoItem[]): { items: TodoItem[], removed: TodoItem | null } => {
      let removed: TodoItem | null = null;
      const filtered = items.filter(item => {
        if (item.id === sourceId) {
          removed = item;
          return false;
        }
        return true;
      }).map(item => {
        if (item.subTodos && item.subTodos.length > 0) {
          const result = findAndRemove(item.subTodos);
          if (result.removed) removed = result.removed;
          return { ...item, subTodos: result.items };
        }
        return item;
      });
      return { items: filtered, removed };
    };

    const { items: newTodos, removed } = findAndRemove(todos);
    if (!removed) return;

    // Add removed item as sub-task of target
    const addAsSubTask = (items: TodoItem[]): TodoItem[] => {
      return items.map(item => {
        if (item.id === targetId) {
          const subTodos = item.subTodos || [];
          return {
            ...item,
            subTodos: [...subTodos, { ...removed!, subTodos: undefined }],
            isExpanded: true
          };
        }
        if (item.subTodos) {
          return { ...item, subTodos: addAsSubTask(item.subTodos) };
        }
        return item;
      });
    };

    setTodos(syncCompletionStatus(addAsSubTask(newTodos)));
  };

  // Recursive renderer
  const renderTodoTree = (items: TodoItem[], depth = 0) => {
    return items.map((todo) => {
      const hasSubTodos = !!(todo.subTodos && todo.subTodos.length > 0);
      const isDragOver = dragOverId === todo.id;
      return (
        <div
          key={todo.id}
          className={`w-full transition-all duration-150 ${isDragOver ? 'ring-2 ring-blue-400 rounded-lg bg-blue-500/10' : ''} `}
          draggable
          onDragStart={(e) => handleDragStart(e, todo.id)}
          onDragOver={(e) => handleDragOver(e, todo.id, depth)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, todo.id, depth)}
        >
          <SwipeableTodoItem
            todo={todo}
            depth={depth}
            hasSubTodos={hasSubTodos}
            isExpanded={todo.isExpanded}
            onToggleSubTasks={() => toggleSubTasks(todo.id)}
            onContextMenu={(e) => handleContextMenu(e, todo.id, depth)}
            isEditing={editingId === todo.id}
            editingText={editingText}
            editingRecurring={editingRecurring}
            onToggle={() => toggleTodo(todo.id, hasSubTodos)}
            onDelete={() => deleteTodo(todo.id)}
            onStartEdit={() => startEditing(todo)}
            onEditTextChange={setEditingText}
            onEditRecurringChange={setEditingRecurring}
            onSaveEdit={saveEdit}
            onCancelEdit={cancelEdit}
            getDueDateStatus={getDueDateStatus}
            formatDueDateTime={formatDueDateTime}
            getRecurringIcon={getRecurringIcon}
          />
          {hasSubTodos && (
            <div className={`expand-wrapper ${todo.isExpanded ? 'expanded' : ''} `}>
              <div className="expand-inner">
                {renderTodoTree(todo.subTodos, depth + 1)}
              </div>
            </div>
          )}
        </div>
      );
    });
  };

  // Sort: recurring first, then by nearest due date, then no-date items.
  const sortedTodos = useMemo(() => {
    return [...todos].sort((a, b) => {
      // Recurring tasks always first
      const aRecurring = !!(a.recurring && a.recurring !== 'none');
      const bRecurring = !!(b.recurring && b.recurring !== 'none');
      if (aRecurring !== bRecurring) return aRecurring ? -1 : 1;

      // Among the rest, dated tasks sorted by nearest due date
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;

      return 0;
    });
  }, [todos]);

  return (
    <WidgetWrapper title="Todo List">
      <div className="flex flex-col h-full relative group/container">
        {/* Todo List-Drop zone for moving items to root */}
        <div
          className="flex-1 overflow-y-auto space-y-2 overscroll-contain pb-2"
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
          onDrop={(e) => {
            e.preventDefault();
            const sourceId = e.dataTransfer.getData('text/plain');
            if (!sourceId) return;

            // Find and move to root
            const moveToRoot = (items: TodoItem[]): { items: TodoItem[], moved: TodoItem | null } => {
              let moved: TodoItem | null = null;
              const newItems: TodoItem[] = [];
              for (const item of items) {
                if (item.subTodos && item.subTodos.length > 0) {
                  const foundInSub = item.subTodos.find(s => s.id === sourceId);
                  if (foundInSub) {
                    moved = foundInSub;
                    newItems.push({ ...item, subTodos: item.subTodos.filter(s => s.id !== sourceId) });
                  } else {
                    const result = moveToRoot(item.subTodos);
                    if (result.moved) moved = result.moved;
                    newItems.push({ ...item, subTodos: result.items });
                  }
                } else {
                  newItems.push(item);
                }
              }
              return { items: newItems, moved };
            };

            const { items: newTodos, moved } = moveToRoot(todos);
            if (moved) {
              setTodos(syncCompletionStatus([...newTodos, moved]));
            }
            setDraggedId(null);
            setDragOverId(null);
          }}
        >
          {todos.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">
              No tasks yet. Click the + button to add one!
            </p>
          ) : (
            <>
              {renderTodoTree(sortedTodos.filter(t => t.recurring && t.recurring !== 'none'))}

              {sortedTodos.some(t => t.recurring && t.recurring !== 'none') &&
                sortedTodos.some(t => !t.recurring || t.recurring === 'none') && (
                  <div className="my-3 border-t border-gray-200 dark:border-gray-700 mx-2" />
                )}

              {renderTodoTree(sortedTodos.filter(t => !t.recurring || t.recurring === 'none'))}
            </>
          )}


        </div>

        {/* Floating Action Button */}
        {/* Floating Action Button */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="absolute bottom-5 right-5 w-11 h-11 bg-white/10 border border-white/20 hover:bg-white/20 text-white rounded-full shadow-lg backdrop-blur-md transition-all duration-200 flex items-center justify-center active:scale-95 z-10 opacity-0 group-hover/container:opacity-100 translate-y-2 group-hover/container:translate-y-0"
          title="Add new task"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
        </button>

        {/* Modal */}
        {isModalOpen && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={(e) => e.target === e.currentTarget && closeModal()}
          >
            <div
              className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4 overflow-visible shadow-2xl animate-scale-in"
              style={{ boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}
            >
              <h2 className="text-xl font-semibold text-white">
                {parentTodoId ? 'Add Sub Task' : 'Add New Task'}
              </h2>

              <form onSubmit={handleModalSubmit} className="space-y-4">
                {/* Title */}
                <div>
                  <label
                    htmlFor="modal-title"
                    className="block text-sm font-medium text-white/80 mb-1"
                  >
                    Title <span className="text-white/80">*</span>
                  </label>
                  <input
                    id="modal-title"
                    type="text"
                    value={modalTitle}
                    onChange={(e) => setModalTitle(e.target.value)}
                    placeholder="What do you need to do?"
                    className="w-full px-3 py-2 border border-white/10 rounded-xl bg-white/5 text-white placeholder-white/30 focus:outline-none focus:bg-white/10 focus:border-white/30 transition-all"
                    autoFocus
                    required
                  />
                </div>

                {/* Checkboxes Row */}
                <div className="flex items-center gap-6 mb-4">


                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="w-4 h-4 text-blue-400 rounded focus:ring-0 bg-white/10 border-white/20"
                    />
                    <span className="text-sm font-medium text-white/80">
                      Recurring Task
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isAlarm}
                      onChange={(e) => setIsAlarm(e.target.checked)}
                      className="w-4 h-4 text-blue-400 rounded focus:ring-0 bg-white/10 border-white/20"
                    />
                    <span className="text-sm font-medium text-white/80">
                      Set Alarm
                    </span>
                  </label>
                </div>

                {/* Main Content Flex */}
                <div className="flex gap-4">

                  {/* Left Column: Settings (Visible only when settings active) */}


                  {/* Date/Time (Hidden when Recurring) */}
                  {!isRecurring && (
                    <div className={`space-y-4 transition-all duration-500 ease -in -out ${isAlarm ? 'w-[calc(50%-0.5rem)]' : 'w-full'} animate -in fade -in zoom -in `}>
                      <div>
                        <label htmlFor="modal-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Due Date
                        </label>
                        <CalendarPicker
                          value={modalDate}
                          onChange={setModalDate}
                        />
                      </div>
                      <div>

                        <label htmlFor="modal-time" className="block text-sm font-medium text-white/80 mb-1">
                          Due Time
                        </label>
                        <GlassTimePicker
                          value={modalTime}
                          onChange={setModalTime}
                        />
                      </div>
                    </div>
                  )}

                  {/* Repeats (Show if Recurring) */}
                  {isRecurring && (
                    <div className={`space-y-4 transition-all duration-500 ease -in -out ${isAlarm ? 'w-[calc(50%-0.5rem)]' : 'w-full'} animate -in fade -in zoom -in `}>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-1">
                          Repeats
                        </label>
                        <select
                          value={modalRecurringType}
                          onChange={(e) => setModalRecurringType(e.target.value as any)}
                          className="w-full px-3 py-2 border border-white/10 rounded-xl bg-white/5 text-white focus:outline-none focus:bg-white/10 focus:border-white/30 transition-all [color-scheme:dark]"
                        >
                          <option value="daily" className="bg-gray-800">Daily</option>
                          <option value="weekly" className="bg-gray-800">Weekly</option>
                          <option value="monthly" className="bg-gray-800">Monthly</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Alarm (Show if Alarm) */}
                  {isAlarm && (
                    <div className="space-y-4 w-[calc(50%-0.5rem)] animate-in fade-in slide-in-from-right-2 duration-500">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Alarm Interval
                        </label>
                        <input
                          type="number"
                          value={alarmInterval}
                          onChange={(e) => setAlarmInterval(e.target.value)}
                          className="w-full px-3 py-2 border border-white/10 rounded-md bg-white/5 text-white focus:outline-none focus:bg-white/10 focus:border-white/30"
                          min={alarmUnit === 'minute' ? "5" : "1"}
                          step={alarmUnit === 'minute' ? "5" : "1"}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 invisible">
                          Unit
                        </label>
                        <select
                          value={alarmUnit}
                          onChange={(e) => setAlarmUnit(e.target.value as any)}
                          className="w-full px-3 py-2 border border-white/10 rounded-md bg-white/5 text-white focus:outline-none focus:bg-white/10 focus:border-white/30"
                        >
                          <option value="minute">Minutes</option>
                          <option value="hour">Hours</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Sounds every interval.</p>
                      </div>
                    </div>
                  )}

                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-4 py-2 border border-white/10 text-white/60 rounded-xl hover:bg-white/10 hover:text-white transition-colors focus:outline-none"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-white/10 border border-white/20 text-white rounded-xl hover:bg-white/20 transition-colors focus:outline-none shadow-lg"
                  >
                    Add Task
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
        }
      </div >
    </WidgetWrapper >
  );
};
