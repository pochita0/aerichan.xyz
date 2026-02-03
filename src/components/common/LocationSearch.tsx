import React, { useState, useEffect, useRef, useCallback } from 'react';

interface Place {
    id: string;
    place_name: string;
    address_name: string;
    road_address_name?: string;
    x: string; // longitude
    y: string; // latitude
}

interface LocationSearchProps {
    value: string;
    onChange: (value: string, place?: Place) => void;
    placeholder?: string;
    limit?: number;
}

// Kakao Local API Key - 사용자가 직접 발급받아야 합니다
// https://developers.kakao.com 에서 앱 등록 후 REST API 키 사용
const KAKAO_API_KEY = import.meta.env.VITE_KAKAO_API_KEY || '';

export const LocationSearch: React.FC<LocationSearchProps> = ({
    value,
    onChange,
    placeholder = 'Search for a place...',
    limit = 15,
}) => {
    const [query, setQuery] = useState(value);
    const [results, setResults] = useState<Place[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [error, setError] = useState<string | null>(null);

    // Sync query with external value
    useEffect(() => {
        setQuery(value);
    }, [value]);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const searchPlaces = useCallback(async (keyword: string) => {
        if (!keyword.trim() || keyword.length < 2) {
            setResults([]);
            return;
        }

        if (!KAKAO_API_KEY) {
            console.warn('VITE_KAKAO_API_KEY not set.');
            setError('API 키가 없습니다.');
            setResults([]);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            console.log('Searching for:', keyword);
            const response = await fetch(
                `/api/kakao/v2/local/search/keyword.json?query=${encodeURIComponent(keyword)}&size=${limit}`,
                {
                    headers: {
                        Authorization: `KakaoAK ${KAKAO_API_KEY}`,
                    },
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error:', response.status, errorText);

                let errorMsg = `API 오류: ${response.status}`;
                try {
                    const errorJson = JSON.parse(errorText);
                    if (errorJson.msg) errorMsg += ` - ${errorJson.msg}`;
                    else if (errorJson.message) errorMsg += ` - ${errorJson.message}`;
                    else if (errorJson.code) errorMsg += ` (Code: ${errorJson.code})`;
                } catch {
                    errorMsg += ` - ${errorText.slice(0, 50)}`;
                }

                throw new Error(errorMsg);
            }

            const data = await response.json();
            console.log('API Response:', data);
            setResults(data.documents || []);

            if (!data.documents || data.documents.length === 0) {
                console.log('No results found');
            }
        } catch (err) {
            console.error('Place search error:', err);
            const msg = err instanceof Error ? err.message : '검색 중 오류가 발생했습니다';
            setError(msg === 'Failed to fetch' ? '네트워크 연결 상태를 확인해주세요.' : msg);
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setQuery(newValue);
        onChange(newValue); // Update parent immediately for manual input
        setSelectedIndex(-1);
        setError(null);

        // Debounce API call
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(() => {
            if (newValue.length >= 2) {
                searchPlaces(newValue);
                setIsOpen(true);
            } else {
                setIsOpen(false);
            }
        }, 500); // 300ms -> 500ms 로 늘려서 너무 잦은 호출 방지
    };

    const handleSelectPlace = (place: Place) => {
        const displayValue = place.place_name;
        setQuery(displayValue);
        onChange(displayValue, place);
        setIsOpen(false);
        setResults([]);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) return;

        if (results.length > 0) {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (selectedIndex >= 0 && selectedIndex < results.length) {
                        handleSelectPlace(results[selectedIndex]);
                    }
                    break;
                case 'Escape':
                    setIsOpen(false);
                    break;
            }
        }
    };

    const handleSearchClick = () => {
        if (query.length >= 2) {
            searchPlaces(query);
            setIsOpen(true);
        }
    };

    return (
        <div ref={containerRef} className="relative z-50">
            <div className="flex gap-2">
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        if (results.length > 0 || error) setIsOpen(true);
                    }}
                    placeholder={placeholder}
                    className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:bg-white/10 focus:border-white/30 transition-all"
                />
                <button
                    type="button"
                    onClick={handleSearchClick}
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors border border-white/10"
                    title="검색"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                    </svg>
                </button>
            </div>

            {/* Dropdown results */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl max-h-[190px] overflow-y-auto custom-scrollbar">
                    {isLoading ? (
                        <div className="px-4 py-3 text-sm text-white/50">
                            Searching...
                        </div>
                    ) : error ? (
                        <div className="px-4 py-3 text-sm text-red-300">
                            {error}
                        </div>
                    ) : results.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-white/50">
                            No results found.
                        </div>
                    ) : (
                        results.map((place, index) => (
                            <button
                                key={place.id}
                                type="button"
                                onClick={() => handleSelectPlace(place)}
                                className={`w-full px-4 py-3 text-left hover:bg-white/10 transition-colors border-b border-white/5 last:border-b-0 ${index === selectedIndex ? 'bg-white/10' : ''
                                    }`}
                            >
                                <div className="flex items-start gap-2">
                                    <svg
                                        className="w-4 h-4 mt-0.5 text-white/40 flex-shrink-0"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                        />
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                        />
                                    </svg>
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium text-white truncate">
                                            {place.place_name}
                                        </div>
                                        <div className="text-xs text-white/50 truncate">
                                            {place.road_address_name || place.address_name}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
