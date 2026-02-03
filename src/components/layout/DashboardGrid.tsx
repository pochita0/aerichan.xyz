import React, { useEffect, useState, useMemo } from 'react';
import {
  ResponsiveGridLayout,
  useContainerWidth,
  verticalCompactor,
} from 'react-grid-layout';
import type { Layout, ResponsiveLayouts } from 'react-grid-layout';
import { useLocalStorage } from '../../hooks/useLocalStorage';

type LayoutDef = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
};

interface DashboardGridProps {
  children: React.ReactNode;
  defaultLayout: LayoutDef[];
}

// Breakpoint definitions
// md lowered to 768 so that ~882px containers use 12 columns instead of 6
const breakpoints = { lg: 1200, md: 768, sm: 480, xs: 0 };
const cols = { lg: 12, md: 12, sm: 6, xs: 4 };

export const DashboardGrid: React.FC<DashboardGridProps> = ({
  children,
  defaultLayout,
}) => {
  const [, setSavedLayouts] = useLocalStorage<Record<string, LayoutDef[]>>(
    'dashboard-layouts-v2',
    {}
  );
  const [isMobile, setIsMobile] = useState(false);

  // Use the library's own hook for accurate container width measurement
  const { width: containerWidth, mounted, containerRef } = useContainerWidth({
    initialWidth: typeof window !== 'undefined' ? window.innerWidth - 48 : 1200,
  });

  const [rowHeight, setRowHeight] = useState(100);

  // Calculate dynamic row height to fit screen
  useEffect(() => {
    const updateRowHeight = () => {
      if (typeof window === 'undefined') return;

      const HEADER_HEIGHT = 0; // Header removed
      const MAIN_PADDING = 100; // Increased to account for p-12 (48px*2) + safe area
      const GRID_MARGIN = 16;   // Grid item margin
      const TOTAL_ROWS = 8;     // Total rows in our layout (6 + 2)

      const availableHeight = window.innerHeight - HEADER_HEIGHT - MAIN_PADDING;
      const totalMargins = GRID_MARGIN * (TOTAL_ROWS - 1);

      // Calculate height per row to fit exactly in viewport
      const calculatedHeight = Math.floor((availableHeight - totalMargins) / TOTAL_ROWS);

      // Enforce a sensible minimum to prevent UI breaking on very small screens
      setRowHeight(Math.max(calculatedHeight, 50));
    };

    updateRowHeight();
    window.addEventListener('resize', updateRowHeight);
    return () => window.removeEventListener('resize', updateRowHeight);
  }, []);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Generate responsive layouts for all breakpoints
  const generateResponsiveLayouts = (baseLayout: LayoutDef[]): ResponsiveLayouts => {
    return {
      lg: baseLayout,
      md: baseLayout,
      sm: baseLayout.map((item, idx) => ({
        ...item,
        w: 6,
        x: 0,
        y: idx * (item.h || 4),
        minW: undefined,
      })),
      xs: baseLayout.map((item, idx) => ({
        ...item,
        w: 4,
        x: 0,
        y: idx * (item.h || 4),
        minW: undefined,
      })),
    };
  };

  const handleLayoutChange = (_currentLayout: Layout, allLayouts: ResponsiveLayouts) => {
    const mutableLayouts: Record<string, LayoutDef[]> = {};
    for (const [bp, layout] of Object.entries(allLayouts)) {
      if (layout) {
        mutableLayouts[bp] = layout.map(item => ({
          i: item.i,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          minW: item.minW,
          minH: item.minH,
        }));
      }
    }
    setSavedLayouts(mutableLayouts);
  };

  const responsiveLayouts = useMemo(() => {
    return generateResponsiveLayouts(defaultLayout);
  }, [defaultLayout]);

  const dragConfig = useMemo(() => ({
    enabled: !isMobile,
    handle: '.drag-handle',
    bounded: false,
    threshold: 3,
  }), [isMobile]);

  const resizeConfig = useMemo(() => ({
    enabled: !isMobile,
    handles: ['s', 'e', 'se'] as const,
  }), [isMobile]);

  // Build children array with correct keys that match layout item `i` values.
  // IMPORTANT: Do NOT use React.Children.map here because it mangles keys
  // by prepending the original child's key/index, causing layout item lookup
  // to fail (items fall back to w:1 h:1 defaults).
  const gridChildren = useMemo(() => {
    const result: React.ReactElement[] = [];
    React.Children.forEach(children, (child, index) => {
      if (React.isValidElement(child)) {
        const layoutId = defaultLayout[index]?.i || `widget-${index}`;
        result.push(
          <div key={layoutId}>
            {!isMobile && (
              <div className="drag-handle cursor-move absolute top-0 left-0 right-0 h-8 z-10" />
            )}
            {child}
          </div>
        );
      }
    });
    return result;
  }, [children, defaultLayout, isMobile]);

  return (
    <div className="p-4 sm:p-8 md:p-12" ref={containerRef}>
      {mounted && containerWidth > 0 && (
        <ResponsiveGridLayout
          className="layout"
          width={containerWidth}
          layouts={responsiveLayouts}
          breakpoints={breakpoints}
          cols={cols}
          rowHeight={rowHeight}
          onLayoutChange={handleLayoutChange}
          dragConfig={dragConfig}
          resizeConfig={resizeConfig}
          compactor={verticalCompactor}
          margin={[16, 16] as const}
          containerPadding={[0, 0] as const}
        >
          {gridChildren}
        </ResponsiveGridLayout>
      )}
    </div>
  );
};
