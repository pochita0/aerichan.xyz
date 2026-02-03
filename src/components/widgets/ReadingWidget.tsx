import React, { useState, useRef, useEffect, useCallback } from 'react';
import { WidgetWrapper } from './WidgetWrapper';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import type { ReadingItem } from '../../types';

export const ReadingWidget: React.FC = () => {
  const [readings, setReadings] = useLocalStorage<ReadingItem[]>('readings', []);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');

  // Drag & Drop for reordering
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Swipe state
  const [activeSwipe, setActiveSwipe] = useState<{ id: string; offsetX: number } | null>(null);
  const [dismissing, setDismissing] = useState<{ id: string; direction: number } | null>(null);
  const swipeStartRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    committed: boolean;
  } | null>(null);
  const activeSwipeRef = useRef<typeof activeSwipe>(null);

  useEffect(() => {
    activeSwipeRef.current = activeSwipe;
  }, [activeSwipe]);

  const handleAddReading = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim() && url.trim()) {
      const newReading: ReadingItem = {
        id: Date.now().toString(),
        title: title.trim(),
        url: url.trim(),
        status: 'unread',
        createdAt: new Date().toISOString(),
      };
      setReadings([...readings, newReading]);
      setTitle('');
      setUrl('');
      setIsAdding(false);
    }
  };

  const handleEditReading = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId && title.trim() && url.trim()) {
      setReadings(
        readings.map((reading) =>
          reading.id === editingId
            ? { ...reading, title: title.trim(), url: url.trim() }
            : reading
        )
      );
      setTitle('');
      setUrl('');
      setEditingId(null);
    }
  };

  const startEdit = (reading: ReadingItem) => {
    setEditingId(reading.id);
    setTitle(reading.title);
    setUrl(reading.url);
    setIsAdding(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setTitle('');
    setUrl('');
  };

  const deleteReading = useCallback(
    (id: string) => {
      setReadings((prev: ReadingItem[]) => prev.filter((r) => r.id !== id));
    },
    [setReadings]
  );

  // Swipe helpers
  const SWIPE_THRESHOLD = 120;

  const processMove = (clientX: number, clientY: number) => {
    const ref = swipeStartRef.current;
    if (!ref) return;
    const dx = clientX - ref.startX;
    const dy = clientY - ref.startY;

    if (!ref.committed) {
      if (Math.abs(dy) > Math.abs(dx)) {
        swipeStartRef.current = null;
        setActiveSwipe(null);
        return;
      }
      if (Math.abs(dx) > 10) {
        ref.committed = true;
      } else {
        return;
      }
    }

    setActiveSwipe({ id: ref.id, offsetX: dx });
  };

  const processEnd = useCallback(() => {
    const swipe = activeSwipeRef.current;
    if (swipe && Math.abs(swipe.offsetX) > SWIPE_THRESHOLD) {
      const dir = swipe.offsetX > 0 ? 1 : -1;
      setDismissing({ id: swipe.id, direction: dir });
      setActiveSwipe(null);
      swipeStartRef.current = null;
      setTimeout(() => {
        deleteReading(swipe.id);
        setDismissing(null);
      }, 300);
    } else {
      setActiveSwipe(null);
      swipeStartRef.current = null;
    }
  }, [deleteReading]);

  // Touch events
  const handleTouchStart = (e: React.TouchEvent, id: string) => {
    if ((e.target as HTMLElement).closest('button, a, input')) return;
    const touch = e.touches[0];
    swipeStartRef.current = { id, startX: touch.clientX, startY: touch.clientY, committed: false };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    processMove(e.touches[0].clientX, e.touches[0].clientY);
    if (swipeStartRef.current?.committed) {
      e.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    processEnd();
  };

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    if ((e.target as HTMLElement).closest('button, a, input')) return;

    // Allow native drag if clicking the handle
    if ((e.target as HTMLElement).closest('.drag-handle')) return;

    e.preventDefault();
    swipeStartRef.current = { id, startX: e.clientX, startY: e.clientY, committed: false };

    const onMove = (ev: MouseEvent) => {
      processMove(ev.clientX, ev.clientY);
    };
    const onUp = () => {
      processEnd();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Swipe style per card
  const getSwipeStyle = (id: string): React.CSSProperties => {
    if (dismissing?.id === id) {
      return {
        transform: `translateX(${dismissing.direction * 500}px)`,
        opacity: 0,
        transition: 'transform 0.3s ease-out, opacity 0.3s ease-out',
      };
    }
    if (activeSwipe?.id === id) {
      const opacity = Math.max(0.3, 1 - Math.abs(activeSwipe.offsetX) / 300);
      return {
        transform: `translateX(${activeSwipe.offsetX}px)`,
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

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    // Create a temporary ghost image if needed, or rely on browser default
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIdx === null) return;
    if (draggedIdx !== index) {
      setDragOverIdx(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIdx(null);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx === null) return;

    const newReadings = [...readings];
    const [draggedItem] = newReadings.splice(draggedIdx, 1);
    newReadings.splice(index, 0, draggedItem);

    setReadings(newReadings);
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  return (
    <WidgetWrapper title="Reading List">
      <div className="flex flex-col h-full relative group/container">
        {/* Add/Edit form */}
        {(isAdding || editingId) && (
          <form
            onSubmit={editingId ? handleEditReading : handleAddReading}
            className="mb-3 space-y-2 p-3 bg-black/20 backdrop-blur-md rounded-xl border border-white/10 animate-scale-in"
          >
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title..."
              className="w-full px-3 py-2 border border-white/10 rounded-xl bg-black/20 text-white placeholder-white/30 focus:outline-none focus:bg-black/40 focus:border-white/30 transition-all text-sm"
              autoFocus
            />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-white/10 rounded-xl bg-black/20 text-white placeholder-white/30 focus:outline-none focus:bg-black/40 focus:border-white/30 transition-all text-sm"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-3 py-1.5 bg-white/10 border border-white/20 text-white rounded-lg text-sm hover:bg-white/20 transition-colors shadow-sm"
              >
                {editingId ? 'Update' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (editingId) {
                    cancelEdit();
                  } else {
                    setIsAdding(false);
                    setTitle('');
                    setUrl('');
                  }
                }}
                className="px-3 py-1.5 border border-white/10 text-white/60 rounded-lg text-sm hover:text-white hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Reading list */}
        <div className="flex-1 overflow-y-auto space-y-2 overscroll-contain pb-2">
          {readings.length === 0 ? (
            <p className="text-gray-400 text-xs sm:text-sm text-center py-8">
              No readings saved yet. Hover and click + to add one!
            </p>
          ) : (
            readings.map((reading, index) => (
              <div
                key={reading.id}
                className={`overflow-hidden rounded-md transition-all duration-200 ${draggedIdx === index ? 'opacity-50' : ''
                  } ${dragOverIdx === index ? 'ring-2 ring-blue-500 scale-[1.02]' : ''
                  }`}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
              >
                <div
                  className="p-2.5 sm:p-3 rounded-xl border border-white/5 bg-black/40 hover:bg-black/50 hover:border-white/10 backdrop-blur-sm group/item transition-all duration-200 select-none cursor-pointer relative"
                  style={getSwipeStyle(reading.id)}
                  onTouchStart={(e) => handleTouchStart(e, reading.id)}
                  onTouchMove={(e) => handleTouchMove(e)}
                  onTouchEnd={handleTouchEnd}
                  onMouseDown={(e) => handleMouseDown(e, reading.id)}
                  onDoubleClick={() => startEdit(reading)}
                  onClick={() => window.open(reading.url, '_blank')}
                >
                  <div className="flex items-center gap-2">
                    {/* Drag Handle */}
                    <div
                      className="drag-handle cursor-grab active:cursor-grabbing p-1 -ml-1 text-white/30 hover:text-white/60 opacity-0 group-hover/item:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                      </svg>
                    </div>

                    <div className="flex-1 flex items-center justify-between overflow-hidden gap-2">
                      <span className="text-sm sm:text-base font-medium text-white/90 group-hover/item:text-blue-300 truncate transition-colors duration-200">
                        {reading.title}
                      </span>
                      <span className="text-xs sm:text-sm text-white/40 group-hover/item:text-white/60 flex-shrink-0 transition-colors duration-200">
                        {(() => {
                          try {
                            return new URL(reading.url).hostname;
                          } catch {
                            return '';
                          }
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Floating Action Button - visible on hover */}
        {/* Floating Action Button - visible on hover */}
        < button
          onClick={() => setIsAdding(true)}
          className="absolute bottom-5 right-5 w-11 h-11 bg-white/10 border border-white/20 hover:bg-white/20 text-white rounded-full shadow-lg backdrop-blur-md transition-all duration-200 flex items-center justify-center active:scale-95 focus:outline-none z-10 opacity-0 group-hover/container:opacity-100 translate-y-2 group-hover/container:translate-y-0"
          title="Add new reading"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
        </button>
      </div>
    </WidgetWrapper>
  );
};
