import React, { useState, useMemo, useRef, useCallback, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
import { WidgetWrapper } from './WidgetWrapper';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import type { BookmarkItem } from '../../types';

export const BookmarkWidget: React.FC = () => {
  const [bookmarks, setBookmarks] = useLocalStorage<BookmarkItem[]>('bookmarks', []);
  const [isAdding, setIsAdding] = useState(false);
  const [addType, setAddType] = useState<'link' | 'folder'>('link');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Folder preview state - shows folder animation when hovering over another app
  const [folderPreviewTarget, setFolderPreviewTarget] = useState<string | null>(null);
  const folderHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHoverTarget = useRef<string | null>(null);

  // Folder popup state - stores folder id and position
  const [expandedFolder, setExpandedFolder] = useState<{ id: string; rect: DOMRect } | null>(null);
  const folderRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevRects = useRef<Map<string, DOMRect>>(new Map());

  // Root items only (no parentId)
  const rootItems = useMemo(() => {
    return bookmarks.filter(b => !b.parentId);
  }, [bookmarks]);

  // Get folder children
  const getFolderChildren = (folderId: string) => {
    return bookmarks.filter(b => b.parentId === folderId);
  };

  // FLIP Animation
  // FLIP Animation
  useLayoutEffect(() => {
    itemRefs.current.forEach((el, id) => {
      const prev = prevRects.current.get(id);
      if (prev && el && el.isConnected) {
        const current = el.getBoundingClientRect();
        const dx = prev.left - current.left;
        const dy = prev.top - current.top;
        if (dx !== 0 || dy !== 0) {
          el.style.transform = `translate(${dx}px, ${dy}px)`;
          el.style.transition = 'none';
          requestAnimationFrame(() => {
            if (el && el.isConnected) {
              el.style.transform = '';
              el.style.transition = 'transform 300ms cubic-bezier(0.2, 0, 0.2, 1)';
            }
          });
        }
      }
    });
  }, [bookmarks]);

  const validateUrl = (urlString: string): boolean => {
    try {
      const urlObj = new URL(urlString);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch { return false; }
  };

  const resetForm = () => {
    setName(''); setUrl(''); setIsAdding(false); setEditingId(null);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setUrl(text);
    } catch (err) {
      console.error('Failed to paste:', err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (addType === 'link' && (!url.trim() || !validateUrl(url.trim()))) return;
    if (addType === 'folder' && !name.trim()) return;

    const finalName = name.trim() || (addType === 'link' ? url.trim() : 'New Folder');

    if (editingId) {
      setBookmarks(bookmarks.map(b =>
        b.id === editingId ? { ...b, name: finalName, url: addType === 'link' ? url.trim() : undefined } : b
      ));
    } else {
      const newBookmark: BookmarkItem = {
        id: Date.now().toString(),
        name: finalName,
        url: addType === 'link' ? url.trim() : undefined,
        createdAt: new Date().toISOString(),
        type: addType,
        parentId: expandedFolder?.id || undefined,
      };
      setBookmarks([...bookmarks, newBookmark]);
    }
    resetForm();
  };



  const deleteBookmark = (id: string) => {
    const idsToDelete = new Set<string>([id]);
    let found = true;
    while (found) {
      found = false;
      bookmarks.forEach(b => {
        if (b.parentId && idsToDelete.has(b.parentId) && !idsToDelete.has(b.id)) {
          idsToDelete.add(b.id);
          found = true;
        }
      });
    }
    setBookmarks(bookmarks.filter((b) => !idsToDelete.has(b.id)));
    if (expandedFolder && idsToDelete.has(expandedFolder.id)) setExpandedFolder(null);
  };

  const openAddModal = () => {
    resetForm();
    setAddType('link');
    setIsAdding(true);
  };

  const handlePressStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => setEditMode(true), 500);
  }, []);

  const handlePressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    handlePressEnd();
    setDraggedId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetId?: string, isGapHover = false) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // If gap hover, find closest item
    let effectiveTargetId = targetId;
    if (isGapHover && editMode && draggedId) {
      let closestId = null;
      let minDistance = Infinity;

      itemRefs.current.forEach((el, id) => {
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dist = Math.hypot(e.clientX - centerX, e.clientY - centerY);

        if (dist < minDistance) {
          minDistance = dist;
          closestId = id;
        }
      });

      if (closestId) {
        effectiveTargetId = closestId;
      }
    }

    const targetItem = effectiveTargetId ? bookmarks.find(b => b.id === effectiveTargetId) : null;
    const isTargetFolder = targetItem?.type === 'folder';
    const draggedItem = draggedId ? bookmarks.find(b => b.id === draggedId) : null;
    const isDraggedFolder = draggedItem?.type === 'folder';

    // Zone Detection
    let isInReorderZone = true;
    let isInFolderZone = false;

    if (!isGapHover && effectiveTargetId && editMode) {
      const targetEl = itemRefs.current.get(effectiveTargetId);
      if (targetEl) {
        const rect = targetEl.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        const h = rect.height;

        // Define Folder Zone: inner 60% of vertical height
        // Top 20% and Bottom 20% are for Reordering (swapping)
        if (relativeY > h * 0.2 && relativeY < h * 0.8) {
          isInFolderZone = true;
          isInReorderZone = false;
        }
      }
    } else if (isGapHover) {
      isInReorderZone = true;
      isInFolderZone = false;
    }

    // Target Change Handling
    if (effectiveTargetId !== lastHoverTarget.current) {
      if (folderHoverTimer.current) {
        clearTimeout(folderHoverTimer.current);
        folderHoverTimer.current = null;
      }
      setFolderPreviewTarget(null);
      lastHoverTarget.current = effectiveTargetId || null;
    }

    // Timer Management
    if (editMode && draggedId && effectiveTargetId && draggedId !== effectiveTargetId && !isTargetFolder && !isGapHover && !isDraggedFolder) {
      if (isInFolderZone) {
        if (!folderHoverTimer.current && !folderPreviewTarget) {
          folderHoverTimer.current = setTimeout(() => {
            setFolderPreviewTarget(effectiveTargetId);
          }, 400); // 400ms hover to trigger folder creation
        }
      } else {
        if (folderHoverTimer.current) {
          clearTimeout(folderHoverTimer.current);
          folderHoverTimer.current = null;
        }
        if (folderPreviewTarget) {
          setFolderPreviewTarget(null);
        }
      }
    }

    // Live Reordering
    if (editMode && draggedId && effectiveTargetId && draggedId !== effectiveTargetId && !folderPreviewTarget && isInReorderZone) {
      const sourceIndex = bookmarks.findIndex(b => b.id === draggedId);
      let targetIndex = bookmarks.findIndex(b => b.id === effectiveTargetId);

      if (sourceIndex !== -1 && targetIndex !== -1 && bookmarks[sourceIndex] && bookmarks[targetIndex]) {
        // Capture current positions for FLIP animation
        itemRefs.current.forEach((el, id) => prevRects.current.set(id, el.getBoundingClientRect()));

        // Check if we skipping AHEAD (to right/down) or BACK (left/up)
        // If target is Folder, precise Top/Bottom edge detection matters
        if (isTargetFolder) {
          const targetEl = itemRefs.current.get(effectiveTargetId);
          if (targetEl) {
            const rect = targetEl.getBoundingClientRect();
            const relativeY = e.clientY - rect.top;
            const h = rect.height;
            // If dragging downward/rightward past the folder's vertical center (or bottom edge zone),
            // treat as inserting AFTER the folder.
            if (relativeY > h * 0.5) {
              targetIndex = Math.min(targetIndex + 1, bookmarks.length);
            }
          }
        } else {
          // For normal items, standard reorder logic
          // If moving right (source < target), we generally want to place AFTER target 
          // UNLESS we are hovering the TOP/LEFT half.
          // But simpler logic: standard splice/insert usually places BEFORE target.

          // If source < target (moving right), placing at targetIndex puts it BEFORE target.
          // Effectively shifting target to right. Correct.

          // BUT, if we want to "swap" feel, we might need adjustments.
          // Currently, standard splice-based reorder is:
          // [A, B, C] -> move A to C -> splice A, insert at index of C -> [B, A, C]
          // So A takes C's spot, C moves right.
        }

        const newBookmarks = [...bookmarks];
        const [removed] = newBookmarks.splice(sourceIndex, 1);

        // Adjust index if we removed an item before the target position
        // If we want to insert 'at' targetIndex in the original array...
        // If source was before target, targetIndex shifts down by 1 during splice.
        // So we might need to adjust.
        // Let's rely on the simple logic: remove, then insert at current visual target index.
        // Note: isTargetFolder logic above might increment targetIndex to mean "after this item".

        // Standard reorder correction:
        // When source < target, and we drop "at" target, we usually mean "put after target" 
        // if we are past its center. But here we just use the slot index.
        // The FLIP animation handles the visual smoothing.

        let finalInsertIndex = targetIndex;
        if (sourceIndex < targetIndex) {
          finalInsertIndex -= 1; // adjustments for removal shifting indices
        }
        if (finalInsertIndex < 0) finalInsertIndex = 0;

        // However, if we explicitly bumped targetIndex +1 (for folder bottom half), 
        // we might not want to subtract 1?
        // Let's refine.
        // Simpler: Just reconstruct the list.

        // Only trigger update if the index actually changes to prevent jitter
        // But with FLIP, frequent updates are okay-ish.

        // Let's trust the splice logic but ensure stable "After Folder" handling
        // If targetIndex was bumped (meaning "after folder"), that index is based on the OLD list.
        // [A, Folder, B] (Indices: 0, 1, 2)
        // Move A (0) to Folder (1) bottom half -> targetIndex becomes 2 (after folder).
        // Splice A (0) -> [Folder, B]
        // Insert at 2-1 = 1 -> [Folder, A, B]. Correct.
        // Move A (0) to Folder (1) top half -> targetIndex is 1.
        // Splice A -> [Folder, B]. Insert at 1-1 = 0 -> [A, Folder, B]. No change? (Wait, source<target)

        // Correct logic for "insert at index":
        // Remove item. Remaining items shift.
        // If insertion point > removal point, insertion point --.

        if (sourceIndex < targetIndex) {
          targetIndex--;
        }

        newBookmarks.splice(targetIndex, 0, { ...removed, parentId: undefined });
        setBookmarks(newBookmarks);
      }
    }

    setDragOverId(effectiveTargetId && effectiveTargetId !== draggedId ? effectiveTargetId : null);
  };

  const handleDrop = (e: React.DragEvent, targetId?: string, inFolder?: boolean) => {
    e.preventDefault();
    setDragOverId(null);
    setDraggedId(null);

    // Clear folder preview state
    if (folderHoverTimer.current) {
      clearTimeout(folderHoverTimer.current);
      folderHoverTimer.current = null;
    }
    const shouldCreateFolder = folderPreviewTarget !== null && folderPreviewTarget === targetId;
    setFolderPreviewTarget(null);
    lastHoverTarget.current = null;

    const sourceId = e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetId) return;

    const sourceItem = bookmarks.find(b => b.id === sourceId);
    if (!sourceItem) return;

    let updated = [...bookmarks];

    const cleanUpAllFolders = (list: BookmarkItem[]) => {
      let changed = false;
      let newList = [...list];
      const folderIds = new Set(newList.filter(b => b.type === 'folder').map(b => b.id));

      folderIds.forEach(fid => {
        const children = newList.filter(b => b.parentId === fid);
        if (children.length <= 1) {
          changed = true;
          const folder = newList.find(b => b.id === fid);
          if (folder) {
            // Dissolve: remove folder, move children to folder's parent
            newList = newList.filter(b => b.id !== fid);
            newList = newList.map(b => b.parentId === fid ? { ...b, parentId: folder.parentId } : b);

            // If we dissolved the expanded folder, close it
            if (fid === expandedFolder?.id) {
              setExpandedFolder(null);
            }
          }
        }
      });
      return changed ? newList : list;
    };

    // Drop on empty area - move to root or current folder
    if (!targetId) {
      // If in editMode and dropping on root gap, live reordering has already placed the item.
      // Just cleanup and return to avoid moving it to the end.
      if (editMode && !inFolder) {
        updated = cleanUpAllFolders(updated);
        setBookmarks(updated);
        return;
      }

      const newParentId = inFolder ? expandedFolder?.id : undefined;
      // Force move to end
      updated = [...updated.filter(b => b.id !== sourceId), { ...sourceItem, parentId: newParentId }];
      updated = cleanUpAllFolders(updated);
      setBookmarks(updated);
      return;
    }

    const targetItem = bookmarks.find(b => b.id === targetId);
    if (!targetItem) return;

    // Drop on folder - move into folder
    if (targetItem.type === 'folder') {
      const sourceItem = bookmarks.find(b => b.id === sourceId);
      if (sourceItem?.type === 'folder') return; // Block folder into folder
      if (!sourceItem) return;

      updated = [...updated.filter(b => b.id !== sourceId), { ...sourceItem, parentId: targetItem.id }];
      updated = cleanUpAllFolders(updated);
      setBookmarks(updated);
      return;
    }

    // Create new folder only if folder preview was shown (held over target)
    if (!shouldCreateFolder) {
      // Just cleanup, no folder creation
      updated = cleanUpAllFolders(updated);
      setBookmarks(updated);
      return;
    }

    // Create new folder logic (default behavior when not editing)
    const newFolderId = Date.now().toString();
    const newFolder: BookmarkItem = {
      id: newFolderId,
      name: 'New Folder',
      type: 'folder',
      createdAt: new Date().toISOString(),
      parentId: targetItem.parentId
    };

    // Find target's position in the list
    const targetIndex = updated.findIndex(b => b.id === targetId);

    // Remove source and target
    updated = updated.filter(b => b.id !== sourceId && b.id !== targetId);

    // Insert folder at target's original position
    const insertIndex = Math.min(targetIndex, updated.length);
    updated.splice(insertIndex, 0, newFolder);

    // Add items as children of the new folder (at the end)
    updated.push({ ...sourceItem, parentId: newFolderId });
    updated.push({ ...targetItem, parentId: newFolderId });

    updated = cleanUpAllFolders(updated);
    setBookmarks(updated);
  };

  // Render folder preview (2x2 grid showing contents)
  const renderFolderPreview = (folderId: string) => {
    const children = getFolderChildren(folderId);
    const count = children.length;

    if (count === 0) {
      return <div className="w-full h-full bg-white/5 backdrop-blur-sm border border-white/5 rounded-xl transition-colors hover:bg-white/10" onClick={() => {
        const rect = folderRefs.current.get(folderId)?.getBoundingClientRect();
        if (rect) setExpandedFolder({ id: folderId, rect });
      }} />;
    }

    // Helper to render a draggable child item in folder preview
    const renderChildItem = (child: BookmarkItem) => (
      <div
        key={child.id}
        className="w-14 h-14 rounded-xl overflow-hidden cursor-pointer hover:scale-105 transition-transform"
        draggable={editMode}
        onDragStart={(e) => {
          e.stopPropagation();
          setDraggedId(child.id);
          e.dataTransfer.setData('text/plain', child.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onMouseDown={(e) => { e.stopPropagation(); handlePressStart(); }}
        onMouseUp={(e) => { e.stopPropagation(); handlePressEnd(); }}
        onMouseLeave={() => { handlePressEnd(); }}
        onTouchStart={(e) => { e.stopPropagation(); handlePressStart(); }}
        onTouchEnd={(e) => { e.stopPropagation(); handlePressEnd(); }}
        onClick={(e) => {
          e.stopPropagation();
          if (editMode) return;
          if (child.type === 'folder') {
            const rect = folderRefs.current.get(child.id)?.getBoundingClientRect();
            if (rect) setExpandedFolder({ id: child.id, rect });
          } else {
            window.open(child.url, '_blank');
          }
        }}>
        {child.type === 'folder' ? (
          <div className="w-full h-full bg-gray-400/50 flex items-center justify-center text-sm rounded-xl">📁</div>
        ) : (
          <img src={`https://www.google.com/s2/favicons?domain=${new URL(child.url || 'http://localhost').hostname}&sz=128`}
            alt="" className="w-full h-full object-cover scale-110 rounded-xl"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        )}
      </div>
    );

    // 4 items or less: show each in 2x2 grid, each directly clickable
    if (count <= 4) {
      return (
        <div className="grid grid-cols-2 grid-rows-2 gap-4 w-full h-full p-1 bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg"
          style={{ boxShadow: "inset 0 1px 0 0 rgba(255, 255, 255, 0.3), 0 4px 6px -1px rgba(0, 0, 0, 0.1)" }}>
          {children.slice(0, 4).map(child => renderChildItem(child))}
        </div>
      );
    }

    // 5+ items: show 3 items + mini 2x2 grid of remaining
    const firstThree = children.slice(0, 3);
    const remaining = children.slice(3, 7); // Show up to 4 in mini grid

    return (
      <div className="grid grid-cols-2 grid-rows-2 gap-4 w-full h-full p-1 bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg"
        style={{ boxShadow: "inset 0 1px 0 0 rgba(255, 255, 255, 0.3), 0 4px 6px -1px rgba(0, 0, 0, 0.1)" }}>
        {firstThree.map(child => renderChildItem(child))}
        {/* Mini 2x2 grid - clicking this expands the folder overlay */}
        <div
          className="w-14 h-14 grid grid-cols-2 grid-rows-2 gap-1 p-1 rounded-xl overflow-hidden bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-md border border-white/20 cursor-pointer hover:scale-105 transition-transform shadow-inner"
          style={{ boxShadow: "inset 0 1px 0 0 rgba(255, 255, 255, 0.3)" }}
          onClick={(e) => {
            e.stopPropagation();
            if (!editMode) {
              const rect = folderRefs.current.get(folderId)?.getBoundingClientRect();
              if (rect) setExpandedFolder({ id: folderId, rect });
            }
          }}>
          {remaining.map(child => (
            <div key={child.id} className="w-full h-full rounded-md overflow-hidden relative">
              {child.type === 'folder' ? (
                <div className="w-full h-full bg-white/10 flex items-center justify-center text-[8px]">📁</div>
              ) : (
                <img src={`https://www.google.com/s2/favicons?domain=${new URL(child.url || 'http://localhost').hostname}&sz=32`}
                  alt="" className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render a single item (app icon)
  const renderItem = (item: BookmarkItem, inFolderPopup = false) => {
    const isFolder = item.type === 'folder';
    const isOver = dragOverId === item.id;

    // Folder: 2x2 size (2 apps + gap). App: 1x1 size.
    // App: 64px, Grid Gap: 8px (gap-2)
    // Two Apps Stacked Height: 64 + 8 + 64 = 136px.
    // Folder is 136px. Perfect match.
    const spanClass = isFolder ? 'row-span-2' : '';
    const iconSize = isFolder ? 'w-[136px] h-[136px]' : 'w-[64px] h-[64px]';
    const itemWidth = isFolder ? 136 : 64;

    const isDragged = draggedId === item.id;

    return (
      <div key={item.id}
        ref={(el) => {
          if (el) {
            itemRefs.current.set(item.id, el);
            if (isFolder) folderRefs.current.set(item.id, el);
          } else {
            itemRefs.current.delete(item.id);
            if (isFolder) folderRefs.current.delete(item.id);
          }
        }}
        className={`flex flex-col items-center relative ${spanClass} ${isOver ? 'scale-105 z-10' : ''} ${editMode ? 'animate-wiggle' : ''} ${isDragged ? 'opacity-40 scale-110' : 'opacity-100'} transition-all duration-100`}
        style={{ width: `${itemWidth}px` }}
        draggable={editMode}
        onDragStart={(e) => handleDragStart(e, item.id)}
        onDragOver={(e) => { e.stopPropagation(); handleDragOver(e, item.id); }}
        onDrop={(e) => { e.stopPropagation(); handleDrop(e, item.id, inFolderPopup); }}
        onMouseDown={() => handlePressStart()}
        onMouseUp={handlePressEnd}
        onMouseLeave={() => { handlePressEnd(); setHoveredId(null); }}
        onMouseEnter={() => setHoveredId(item.id)}
        onTouchStart={() => handlePressStart()}
        onTouchEnd={handlePressEnd}
        onClick={(e) => {
          if (editMode) { e.stopPropagation(); return; }
          // Folders: clicks are handled by internal items in renderFolderPreview
          if (!isFolder) {
            window.open(item.url, '_blank');
          }
        }}>

        <div className={`${iconSize} cursor-pointer relative rounded-[14px] transition-transform duration-200 ${isOver ? 'ring-2 ring-blue-400 ring-offset-2 scale-105' : ''}`}>
          <div className="absolute inset-0 rounded-[14px] overflow-hidden">
            {folderPreviewTarget === item.id && draggedId && !isFolder ? (
              <div className="w-full h-full bg-white/10 backdrop-blur-md rounded-2xl p-1 animate-pulse border border-white/20" style={{ animation: 'folderPreviewPop 0.2s ease-out' }}>
                <div className="grid grid-cols-2 grid-rows-2 gap-1 w-full h-full">
                  <div className="w-full h-full rounded-lg overflow-hidden">
                    <img src={`https://www.google.com/s2/favicons?domain=${new URL(item.url || 'http://localhost').hostname}&sz=64`}
                      alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="w-full h-full rounded-lg overflow-hidden">
                    {(() => {
                      const draggedItem = bookmarks.find(b => b.id === draggedId);
                      return draggedItem ? (
                        <img src={`https://www.google.com/s2/favicons?domain=${new URL(draggedItem.url || 'http://localhost').hostname}&sz=64`}
                          alt="" className="w-full h-full object-cover" />
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>
            ) : isFolder ? renderFolderPreview(item.id) : (
              // App Icon - Minimalist Glass Gradient (No Box)
              <div className="relative w-full h-full rounded-[14px] transition-transform duration-200 group-hover:scale-105 shadow-md">
                <img src={`https://www.google.com/s2/favicons?domain=${new URL(item.url || 'http://localhost').hostname}&sz=128`}
                  alt={item.name}
                  className="w-full h-full object-cover rounded-[14px]"
                  style={{ objectFit: 'cover' }}
                  onError={(e) => { (e.target as HTMLImageElement).closest('.relative')?.nextElementSibling?.classList.remove('hidden'); (e.target as HTMLImageElement).style.display = 'none'; }} />

                {/* Subtle Gradient Overlay - No Border */}
                <div className="absolute inset-0 rounded-[14px] bg-gradient-to-br from-white/40 to-transparent opacity-50 pointer-events-none" style={{ mixBlendMode: 'overlay' }} />
              </div>
            )}
            {!isFolder && folderPreviewTarget !== item.id && <span className="hidden w-full h-full bg-transparent flex items-center justify-center text-2xl">🔗</span>}
          </div>

          {
            editMode && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteBookmark(item.id); }}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-white/10 hover:bg-red-500/50 backdrop-blur-md border border-white/20 text-white rounded-full flex items-center justify-center text-[10px] shadow-lg z-30 transition-all"
                >
                  ✕
                </button>
              </>
            )
          }
        </div >

        {/* Name Hidden as requested */}
        <span className="hidden">
          {item.name}
        </span>
      </div >
    );
  };

  // Get expanded folder and its children (items after first 3)
  const expandedFolderData = expandedFolder ? bookmarks.find(b => b.id === expandedFolder.id) : null;
  const expandedFolderChildren = expandedFolder ? getFolderChildren(expandedFolder.id).slice(3) : [];

  return (
    <WidgetWrapper title="Bookmarks">
      <div className="flex flex-col h-full relative group" onClick={() => editMode && setEditMode(false)}>

        <div className="flex-1 overflow-x-auto overflow-y-hidden" onDragOver={(e) => handleDragOver(e, undefined, true)} onDrop={(e) => handleDrop(e)}>
          {rootItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-50">
              <p className="text-xs">Empty</p>
            </div>
          ) : (
            <div className="grid grid-rows-[64px_64px] grid-flow-col auto-cols-max gap-2 h-full p-3 content-start items-start">
              {rootItems.map((item) => (
                <React.Fragment key={item.id}>
                  {renderItem(item)}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        {/* Folder Overlay - positioned relative to the folder */}
        {expandedFolder && expandedFolderData && ReactDOM.createPortal(
          <>
            {/* Backdrop - dropping here moves item to root */}
            <div
              className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm"
              style={{ animation: 'fadeIn 0.15s ease-out' }}
              onClick={() => setExpandedFolder(null)}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
              onDrop={(e) => {
                e.preventDefault();
                const sourceId = e.dataTransfer.getData('text/plain');
                if (!sourceId) return;
                const sourceItem = bookmarks.find(b => b.id === sourceId);
                if (!sourceItem) return;
                const oldParentId = sourceItem.parentId;

                // Move to root
                let updated = bookmarks.map(b => b.id === sourceId ? { ...b, parentId: undefined } : b);

                // Auto-dissolve folder if only 1 item left
                if (oldParentId) {
                  const remaining = updated.filter(b => b.parentId === oldParentId);
                  if (remaining.length === 1) {
                    const folder = updated.find(b => b.id === oldParentId);
                    updated = updated
                      .map(b => b.parentId === oldParentId ? { ...b, parentId: folder?.parentId } : b)
                      .filter(b => b.id !== oldParentId);
                  }
                }
                setBookmarks(updated);
                setExpandedFolder(null);
                setDraggedId(null);
              }}
            />
            {/* Expanded folder overlay */}
            <div
              className="fixed z-[9999] bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-2xl border border-white/20 rounded-3xl p-2"
              style={{
                left: Math.max(8, expandedFolder.rect.left - 8),
                top: expandedFolder.rect.top - 8,
                height: '144px',
                animation: 'scaleIn 0.2s ease-out',
                transformOrigin: 'top left',
                boxShadow: "inset 0 1px 0 0 rgba(255, 255, 255, 0.3), 0 20px 40px -10px rgba(0,0,0,0.5)"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Items grid - 2 rows, expanding horizontally */}
              <div className="grid grid-rows-2 grid-flow-col auto-cols-max gap-3 h-full items-center px-1">
                {expandedFolderChildren.map(child => (
                  <div
                    key={child.id}
                    className="group flex flex-col items-center cursor-pointer hover:scale-105 transition-transform relative"
                    draggable={editMode}
                    onDragStart={(e) => handleDragStart(e, child.id)}
                    onMouseDown={(e) => { e.stopPropagation(); handlePressStart(); }}
                    onMouseUp={(e) => { e.stopPropagation(); handlePressEnd(); }}
                    onMouseLeave={() => { handlePressEnd(); }}
                    onTouchStart={(e) => { e.stopPropagation(); handlePressStart(); }}
                    onTouchEnd={(e) => { e.stopPropagation(); handlePressEnd(); }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (child.type === 'folder') {
                        const rect = folderRefs.current.get(child.id)?.getBoundingClientRect();
                        if (rect) setExpandedFolder({ id: child.id, rect });
                      } else {
                        window.open(child.url, '_blank');
                        setExpandedFolder(null);
                      }
                    }}
                  >
                    <div className="w-14 h-14 rounded-xl overflow-hidden shadow-sm">
                      {child.type === 'folder' ? (
                        <div className="w-full h-full bg-gray-500/50 flex items-center justify-center text-lg">📁</div>
                      ) : (
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${new URL(child.url || 'http://localhost').hostname}&sz=128`}
                          alt={child.name}
                          className="w-full h-full object-cover scale-110"
                          onError={(e) => { (e.target as HTMLImageElement).src = ''; }}
                        />
                      )}
                    </div>
                    <span className="absolute -bottom-4 text-[9px] text-gray-300 w-14 truncate text-center opacity-0 group-hover:opacity-100 transition-opacity">{child.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </>,
          document.body
        )}

        {/* Done button when in edit mode */}
        {editMode ? (
          <button onClick={(e) => { e.stopPropagation(); setEditMode(false); }}
            className="absolute bottom-3 right-3 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-full shadow-lg z-40">
            Done
          </button>
        ) : (
          <button onClick={openAddModal}
            className="absolute bottom-3 right-3 w-10 h-10 bg-white/10 border border-white/20 hover:bg-white/20 text-white rounded-full flex items-center justify-center shadow-lg backdrop-blur-md transition-all duration-200 active:scale-95 z-40 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0"
            title="Add Bookmark">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
          </button>
        )}

        {/* Add Modal */}
        {isAdding && ReactDOM.createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl w-full max-w-xs p-6 animate-scale-in" onClick={(e) => e.stopPropagation()} style={{ boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
              <h3 className="text-base font-bold text-center mb-5 text-white">
                {editingId ? 'Edit' : 'New'} {addType === 'folder' ? 'Folder' : 'Bookmark'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                {addType === 'folder' && (
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="Folder Name"
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:bg-white/10 focus:border-white/30 text-center transition-all"
                    autoFocus />
                )}
                {addType === 'link' && (
                  <div className="flex gap-2">
                    <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..."
                      className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:bg-white/10 focus:border-white/30 text-center transition-all"
                      autoFocus
                    />
                    <button type="button" onClick={handlePaste}
                      className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-xl border border-white/10 transition-colors whitespace-nowrap"
                    >
                      Paste
                    </button>
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={resetForm}
                    className="flex-1 py-2 text-xs text-white/60 bg-transparent border border-white/10 hover:bg-white/10 hover:text-white rounded-xl transition-all">Cancel</button>
                  <button type="submit"
                    className="flex-1 py-2 text-xs font-bold text-white bg-white/10 border border-white/20 hover:bg-white/20 rounded-xl shadow-lg transition-all">Done</button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
      </div>

      <style>{`
        @keyframes wiggle { 0%, 100% { transform: rotate(-1deg); } 50% { transform: rotate(1deg); } }
        .animate-wiggle { animation: wiggle 0.15s ease-in-out infinite; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
        @keyframes folderPreviewPop { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </WidgetWrapper>
  );
};
