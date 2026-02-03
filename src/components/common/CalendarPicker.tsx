import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface CalendarPickerProps {
    value: string;
    onChange: (date: string) => void;
}

export const CalendarPicker: React.FC<CalendarPickerProps> = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(() => value ? new Date(value) : new Date());
    const triggerRef = useRef<HTMLDivElement>(null);
    const [coords, setCoords] = useState({ top: 0, left: 0 });

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            // Check if it fits below, otherwise show above (basic logic, or just below for now)
            setCoords({
                top: rect.bottom + 8,
                left: rect.left
            });
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    };

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
    const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

    const handlePrevMonth = () => setViewDate(new Date(year, month - 1, 1));
    const handleNextMonth = () => setViewDate(new Date(year, month + 1, 1));

    const handleDateClick = (day: number) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        onChange(dateStr);
        setIsOpen(false);
    };

    const formatDateDisplay = (dateStr: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            const dropdownEl = document.getElementById('glass-calendar-dropdown');
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

    // Update position on resize/scroll
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
            >
                <span className={!value ? 'text-white/30' : 'text-white'}>
                    {value ? formatDateDisplay(value) : 'YYYY-MM-DD'}
                </span>
                <span className="text-white/60">📅</span>
            </div>

            {isOpen && createPortal(
                <div
                    id="glass-calendar-dropdown"
                    className="fixed w-72 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-[9999] p-4 animate-in fade-in zoom-in-95 duration-200"
                    style={{
                        top: coords.top,
                        left: coords.left,
                        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
                    }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={handlePrevMonth}
                            className="p-1 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                        >
                            ←
                        </button>
                        <span className="text-white font-medium text-lg">
                            {year}년 {month + 1}월
                        </span>
                        <button
                            onClick={handleNextMonth}
                            className="p-1 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                        >
                            →
                        </button>
                    </div>

                    {/* Weekdays */}
                    <div className="grid grid-cols-7 mb-2 text-center">
                        {weekDays.map((d, i) => (
                            <span key={d} className={`text-xs font-semibold ${i === 0 ? 'text-rose-400' : i === 6 ? 'text-blue-400' : 'text-white/50'
                                }`}>
                                {d}
                            </span>
                        ))}
                    </div>

                    {/* Days */}
                    <div className="grid grid-cols-7 gap-1">
                        {/* Empty cells for padding */}
                        {Array.from({ length: firstDay }).map((_, i) => (
                            <div key={`empty-${i}`} className="h-8" />
                        ))}

                        {/* Actual days */}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            const isSelected = value === dateStr;
                            const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();

                            return (
                                <button
                                    key={day}
                                    type="button"
                                    onClick={() => handleDateClick(day)}
                                    className={`
                                        h-8 w-8 rounded-full flex items-center justify-center text-sm transition-all
                                        ${isSelected
                                            ? 'bg-blue-600 text-white font-bold shadow-lg shadow-blue-500/30'
                                            : isToday
                                                ? 'bg-white/10 text-blue-300 font-bold border border-blue-500/30'
                                                : 'text-white/80 hover:bg-white/10 hover:text-white'
                                        }
                                    `}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex justify-between mt-4 pt-3 border-t border-white/10">
                        <button
                            type="button"
                            onClick={() => { onChange(''); setIsOpen(false); }}
                            className="text-xs text-white/40 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                const today = new Date();
                                const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                                onChange(todayStr);
                                setIsOpen(false);
                            }}
                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            Today
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
