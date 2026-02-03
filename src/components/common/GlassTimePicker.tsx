import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface GlassTimePickerProps {
    value?: string;
    onChange: (time: string) => void;
}

const ITEM_HEIGHT = 40;
const VISIBLE_ITEMS = 5;
const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const SPACER_HEIGHT = ((VISIBLE_ITEMS - 1) / 2) * ITEM_HEIGHT;
// Reduce multiplier for performance, use Direct DOM manipulation for speed
const LOOP_MULTIPLIER = 10;
const LOOP_CENTER_INDEX = Math.floor(LOOP_MULTIPLIER / 2);

const Column = React.memo(({
    items,
    type,
    onValueChange,
    setRef
}: {
    items: (string | number)[],
    type: 'hour' | 'minute' | 'ampm',
    onValueChange: (val: string | number) => void,
    setRef: (el: HTMLDivElement | null) => void
}) => {
    const isLooped = type !== 'ampm';
    const displayItems = useMemo(() => {
        return isLooped
            ? Array.from({ length: LOOP_MULTIPLIER }, () => items).flat()
            : items;
    }, [isLooped, items]);

    const scrollRef = useRef<HTMLDivElement | null>(null);
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
    const isDragging = useRef(false);
    const startY = useRef(0);
    const startScrollTop = useRef(0);
    const lastSelectedIndex = useRef<number>(-1);

    // Helper to update styles directly without React render cycle
    const updateStyles = useCallback((scrollTop: number) => {
        const index = Math.round(scrollTop / ITEM_HEIGHT);
        if (index === lastSelectedIndex.current) return;

        const prev = itemRefs.current[lastSelectedIndex.current];
        const next = itemRefs.current[index];

        // Reset prev
        if (prev) {
            prev.style.opacity = '0.4';
            prev.style.transform = 'scale(0.95)';
            prev.style.filter = 'blur(0.5px)';
            prev.style.color = 'rgba(255, 255, 255, 0.4)';
            prev.style.fontWeight = '400';
            prev.style.fontSize = '1.125rem'; // text-lg
        }

        // Highlight next
        if (next) {
            next.style.opacity = '1';
            next.style.transform = 'scale(1.1)';
            next.style.filter = 'none';
            next.style.color = 'white';
            next.style.fontWeight = '500';
            next.style.fontSize = '1.25rem'; // text-xl
        }

        lastSelectedIndex.current = index;
    }, []);

    const handleRef = useCallback((el: HTMLDivElement | null) => {
        scrollRef.current = el;
        setRef(el);
        // Initial highlight
        if (el) {
            // Find initial index
            // Wait for layout?
        }
    }, [setRef]);

    // Initial Scroll Effect handled by parent, but we need to set initial styles
    useEffect(() => {
        // We need to find the index of initialItem
        // Ideally we pick the one in the center loop set
        // But parent handles scrolling.
        // We can just run updateStyles based on current scrollTop after a delay
        const timer = setTimeout(() => {
            if (scrollRef.current) {
                updateStyles(scrollRef.current.scrollTop);
            }
        }, 50);
        return () => clearTimeout(timer);
    }, [updateStyles]);


    const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        const scrollTop = target.scrollTop;

        // 1. Direct Style Update (Instant visual feedback)
        requestAnimationFrame(() => updateStyles(scrollTop));

        // 2. Value Update (Debounced or Threshold based?)
        // If we update parent state on every pixel, it might lag.
        // But parent 'handleScroll' is debounced for onChange.
        // We need to tell parent "the value changed" so it can update its local 'tempValue' 
        // effectively without causing re-render of THIS component.

        // Actually, parent re-rendering THIS component is the problem.
        // But this component is React.memo. It only re-renders if props change.
        // 'initialItem' prop changes when parent state updates.
        // We should decouple 'visual selection' from 'react state'.
        // Parent passes 'initialItem' only for initial mount.

        // Calculate Value
        const itemLen = items.length;
        const index = Math.round(scrollTop / ITEM_HEIGHT);
        const normalizedIndex = isLooped
            ? ((index % itemLen) + itemLen) % itemLen
            : Math.min(Math.max(index, 0), itemLen - 1);

        const val = items[normalizedIndex];
        if (val !== undefined) {
            onValueChange(val);
        }
    };

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        isDragging.current = true;
        startY.current = e.clientY;
        if (scrollRef.current) startScrollTop.current = scrollRef.current.scrollTop;
        e.preventDefault();
    }, []);

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!isDragging.current || !scrollRef.current) return;
            const delta = startY.current - e.clientY;
            scrollRef.current.scrollTop = startScrollTop.current + delta;
        };
        const onMouseUp = () => {
            isDragging.current = false;
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, []);

    return (
        <div
            ref={handleRef}
            className="flex-1 h-full overflow-y-auto relative z-30 touch-pan-y snap-y snap-mandatory"
            onScroll={onScroll}
            onMouseDown={onMouseDown}
            style={{
                scrollbarWidth: 'none',
                cursor: 'grab',
            }}
        >
            <style dangerouslySetInnerHTML={{
                __html: `
                .no-scrollbar::-webkit-scrollbar { display: none; }
            `}} />

            <div style={{ height: SPACER_HEIGHT }} />
            {displayItems.map((item, i) => (
                <div
                    key={i}
                    ref={el => { itemRefs.current[i] = el; }}
                    className="h-[40px] flex items-center justify-center snap-center snap-always transition-none will-change-transform text-white/40 text-lg opacity-40 scale-95 blur-[0.5px]"
                // Default static classes, dynamic ones handled by JS for perf
                >
                    {String(item).padStart(type === 'minute' ? 2 : 1, '0')}
                </div>
            ))}
            <div style={{ height: SPACER_HEIGHT }} />
        </div>
    );
});

Column.displayName = 'Column';

export const GlassTimePicker: React.FC<GlassTimePickerProps> = ({ value = "", onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLDivElement>(null);
    const [coords, setCoords] = useState({ top: 0, left: 0 });

    const originalHours = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
    const originalMinutes = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);
    const ampms = useMemo(() => ['AM', 'PM'], []);

    const parseTime = (timeStr: string | undefined) => {
        if (!timeStr || typeof timeStr !== 'string') return { hour: 12, minute: 0, ampm: 'AM' };
        try {
            const parts = timeStr.split(':');
            if (parts.length !== 2) return { hour: 12, minute: 0, ampm: 'AM' };
            let [h, m] = parts.map(Number);
            if (isNaN(h)) h = 12;
            if (isNaN(m)) m = 0;
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12 || 12;
            return { hour: h, minute: m, ampm };
        } catch (e) {
            return { hour: 12, minute: 0, ampm: 'AM' };
        }
    };

    // We store tempValue in Ref for logic, and State for sync/display ONLY when needed
    // But we need to update Parent onChange.
    // The visual picker should be self-contained as much as possible.
    const [tempValue, setTempValue] = useState(parseTime(value));

    // To prevent Parent re-renders from re-rendering Columns (and resetting scroll),
    // Columns are Memoized. 'initialItem' only updates when 'value' prop likely changes deeply?
    // Actually we only need initialItem for opening.

    useEffect(() => {
        setTempValue(parseTime(value));
    }, [value]);

    const hourRef = useRef<HTMLDivElement | null>(null);
    const minuteRef = useRef<HTMLDivElement | null>(null);
    const ampmRef = useRef<HTMLDivElement | null>(null);

    const setHourRef = useCallback((el: HTMLDivElement | null) => { hourRef.current = el; }, []);
    const setMinuteRef = useCallback((el: HTMLDivElement | null) => { minuteRef.current = el; }, []);
    const setAmpmRef = useCallback((el: HTMLDivElement | null) => { ampmRef.current = el; }, []);

    const getScrollPos = (index: number, totalItems: number, looped: boolean) => {
        if (!looped) return index * ITEM_HEIGHT;
        return (LOOP_CENTER_INDEX * totalItems + index) * ITEM_HEIGHT;
    };

    const scrollToValue = useCallback((smooth = false) => {
        const behavior = smooth ? 'smooth' : 'auto';
        try {
            if (hourRef.current) {
                const idx = originalHours.indexOf(tempValue.hour);
                if (idx !== -1) hourRef.current.scrollTo({ top: getScrollPos(idx, originalHours.length, true), behavior });
            }
            if (minuteRef.current) {
                const idx = originalMinutes.indexOf(tempValue.minute);
                if (idx !== -1) minuteRef.current.scrollTo({ top: getScrollPos(idx, originalMinutes.length, true), behavior });
            }
            if (ampmRef.current) {
                const idx = ampms.indexOf(tempValue.ampm);
                if (idx !== -1) ampmRef.current.scrollTo({ top: getScrollPos(idx, ampms.length, false), behavior });
            }
        } catch (e) { console.error(e); }
    }, [originalHours, originalMinutes, ampms, tempValue.hour, tempValue.minute, tempValue.ampm]);

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom + 8,
                left: rect.left
            });
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            requestAnimationFrame(() => scrollToValue(false));
        }
    }, [isOpen]);

    // Callback from Column. 
    // This runs frequently. We must NOT update state that causes Column to re-render.
    const handleColumnChange = useCallback((type: 'hour' | 'minute' | 'ampm', val: string | number) => {
        setTempValue(prev => {
            let currentVal;
            if (type === 'hour') currentVal = prev.hour;
            else if (type === 'minute') currentVal = prev.minute;
            else currentVal = prev.ampm;

            if (currentVal === val) return prev;

            const newVal = { ...prev };
            if (type === 'hour') newVal.hour = val as number;
            else if (type === 'minute') newVal.minute = val as number;
            else newVal.ampm = val as string;

            // Calc final string
            const h24 = newVal.hour;
            let finalH = h24;
            if (newVal.ampm === 'PM' && finalH !== 12) finalH += 12;
            if (newVal.ampm === 'AM' && finalH === 12) finalH = 0;
            const timeStr = `${String(finalH).padStart(2, '0')}:${String(newVal.minute).padStart(2, '0')}`;

            // Call onChange via timeout (debounce) to avoid spamming updates? 
            // Or just call it.
            // If parent updates 'value' prop, it triggers useEffect -> setTempValue -> re-render.
            // But Column is memoized on 'initialItem'. 
            // 'initialItem' comes from tempValue? No, we should pass initial value only?

            // To fix re-render loop: 
            // We do NOT pass 'tempValue.hour' to 'initialItem' in render. 
            // We pass it once. But if parent updates prop from outside, we need to reflect it.

            // Actually, we can just call onChange. 
            // As long as 'onChange' doesn't cause this component to unmount/mount.
            onChange(timeStr);

            return newVal;
        });
    }, [onChange]);

    // Cleanup
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            const dropdownEl = document.getElementById('glass-time-picker-dropdown');
            if (
                triggerRef.current && !triggerRef.current.contains(event.target as Node) &&
                dropdownEl && !dropdownEl.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleResize = () => {
            if (triggerRef.current) {
                const rect = triggerRef.current.getBoundingClientRect();
                setCoords({ top: rect.bottom + 8, left: rect.left });
            }
        };
        window.addEventListener('resize', handleResize);
        window.addEventListener('scroll', handleResize, true);
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('scroll', handleResize, true);
        };
    }, [isOpen]);

    return (
        <div className="relative w-full">
            <div
                ref={triggerRef}
                onClick={handleToggle}
                className="flex items-center justify-between w-full px-3 py-2 border border-white/10 rounded-xl bg-white/5 text-white cursor-pointer hover:bg-white/10 transition-colors"
                role="button"
                tabIndex={0}
            >
                <span className={!value ? 'text-white/30' : 'text-white'}>
                    {value ? `${tempValue.hour}:${String(tempValue.minute).padStart(2, '0')} ${tempValue.ampm}` : '--:-- --'}
                </span>
                <span className="text-white/60">🕒</span>
            </div>

            {isOpen && createPortal(
                <div
                    id="glass-time-picker-dropdown"
                    className="fixed w-48 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-[9999] overflow-hidden flex flex-col"
                    style={{
                        top: coords.top,
                        left: coords.left,
                        height: CONTAINER_HEIGHT,
                        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
                    }}
                >
                    <div className="absolute inset-0 pointer-events-none">
                        {/* Highlight Bar */}
                        <div className="absolute top-1/2 left-0 right-0 h-[40px] -translate-y-1/2 bg-white/10 border-t border-b border-white/10 z-10" />

                        {/* Top Fade */}
                        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/60 to-transparent z-20 pointer-events-none" />

                        {/* Bottom Fade */}
                        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent z-20 pointer-events-none" />
                    </div>

                    <div className="flex h-full relative z-30">
                        {/* We use parseTime(value) for initial, BUT we don't pass 'tempValue' to maximize Memo usage.
                            Column only cares about items. It doesn't need 'selectedItem' prop for RENDERING style anymore
                            since it does it via Direct DOM.
                            It only needs to know 'initialItem' for logic if needed (or parent handles init scroll). 
                        */}
                        <Column
                            items={originalHours}
                            type="hour"
                            onValueChange={(v) => handleColumnChange('hour', v)}
                            setRef={setHourRef}
                        />
                        <Column
                            items={originalMinutes}
                            type="minute"
                            onValueChange={(v) => handleColumnChange('minute', v)}
                            setRef={setMinuteRef}
                        />
                        <Column
                            items={ampms}
                            type="ampm"
                            onValueChange={(v) => handleColumnChange('ampm', v)}
                            setRef={setAmpmRef}
                        />
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
