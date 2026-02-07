import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  ResponsiveGridLayout,
  useContainerWidth,
  verticalCompactor,
} from 'react-grid-layout';
import type { Layout, LayoutItem, ResponsiveLayouts } from 'react-grid-layout';
import { useLocalStorage } from '../../hooks/useLocalStorage';

type LayoutDef = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxH?: number;
};

interface DashboardGridProps {
  children: React.ReactNode;
  defaultLayout: LayoutDef[];
  mobileLayout?: LayoutDef[];
}

// Breakpoint definitions
const breakpoints = { lg: 1200, md: 768, sm: 480, xs: 0 };
const cols = { lg: 12, md: 12, sm: 12, xs: 12 };

// Maximum rows to contain the grid
const MAX_ROWS = 8;

// Custom constraint to keep items within grid bounds
const gridBoundsConstraint = {
  name: 'gridBounds',
  constrainPosition: (item: LayoutItem, x: number, y: number, context: { cols: number; maxRows: number }) => {
    // Clamp x to grid bounds
    const maxX = context.cols - item.w;
    const clampedX = Math.max(0, Math.min(x, maxX));

    // Clamp y to grid bounds
    const maxY = context.maxRows - item.h;
    const clampedY = Math.max(0, Math.min(y, maxY));

    return { x: clampedX, y: clampedY };
  },
  constrainSize: (item: LayoutItem, w: number, h: number, _handle: string, context: { cols: number; maxRows: number }) => {
    // Clamp width
    const maxW = context.cols - item.x;
    const clampedW = Math.max(item.minW || 1, Math.min(w, maxW));

    // Clamp height
    const maxH = context.maxRows - item.y;
    const clampedH = Math.max(item.minH || 1, Math.min(h, maxH));

    return { w: clampedW, h: clampedH };
  },
};

export const DashboardGrid: React.FC<DashboardGridProps> = ({
  children,
  defaultLayout,
  mobileLayout,
}) => {
  const [savedLayouts, setSavedLayouts] = useLocalStorage<Record<string, LayoutDef[]>>(
    'dashboard-layouts-v7',
    {}
  );
  const [currentLayouts, setCurrentLayouts] = useState<ResponsiveLayouts>({});
  const [isMobile, setIsMobile] = useState(false);

  const { width: containerWidth, mounted, containerRef } = useContainerWidth({
    initialWidth: typeof window !== 'undefined' ? window.innerWidth - 48 : 1200,
  });

  const [rowHeight, setRowHeight] = useState(100);

  // Calculate dynamic row height
  useEffect(() => {
    const updateRowHeight = () => {
      if (typeof window === 'undefined') return;

      const isMobileView = window.innerWidth < 768;

      if (isMobileView) {
        // Fixed smaller row height for mobile - allows scrolling
        setRowHeight(80);
      } else {
        // Desktop: fit to viewport
        const MAIN_PADDING = 100;
        const GRID_MARGIN = 16;
        const availableHeight = window.innerHeight - MAIN_PADDING;
        const totalMargins = GRID_MARGIN * (MAX_ROWS - 1);
        const calculatedHeight = Math.floor((availableHeight - totalMargins) / MAX_ROWS);
        setRowHeight(Math.max(calculatedHeight, 50));
      }
    };
    updateRowHeight();
    window.addEventListener('resize', updateRowHeight);
    return () => window.removeEventListener('resize', updateRowHeight);
  }, []);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Add constraints to layouts
  const addConstraints = (layout: LayoutDef[]): LayoutDef[] => {
    return layout.map(item => ({
      ...item,
      // Ensure items fit within bounds
      y: Math.min(item.y, MAX_ROWS - item.h),
      h: Math.min(item.h, MAX_ROWS - item.y),
    }));
  };

  // Initialize layouts with mobile support
  useEffect(() => {
    const mobileL = mobileLayout || defaultLayout;

    const initLayouts = (): ResponsiveLayouts => {
      if (savedLayouts && Object.keys(savedLayouts).length > 0) {
        return {
          lg: addConstraints(savedLayouts.lg || defaultLayout),
          md: addConstraints(savedLayouts.md || defaultLayout),
          sm: mobileL, // Mobile uses different layout without constraints
          xs: mobileL,
        };
      }
      return {
        lg: addConstraints(defaultLayout),
        md: addConstraints(defaultLayout),
        sm: mobileL,
        xs: mobileL,
      };
    };
    setCurrentLayouts(initLayouts());
  }, [mobileLayout]);

  // Save layout changes - constrain to bounds
  const handleLayoutChange = useCallback((_layout: Layout, allLayouts: Partial<Record<string, Layout>>) => {
    const mutableLayouts: Record<string, LayoutDef[]> = {};

    for (const [bp, bpLayout] of Object.entries(allLayouts)) {
      if (bpLayout) {
        // Constrain all items to grid bounds
        const constrainedLayout = bpLayout.map((item) => ({
          i: item.i,
          x: item.x,
          y: Math.min(item.y, MAX_ROWS - item.h),
          w: item.w,
          h: Math.min(item.h, MAX_ROWS - item.y),
          minW: item.minW,
          minH: item.minH,
        }));
        mutableLayouts[bp] = constrainedLayout;
      }
    }

    setSavedLayouts(mutableLayouts);
    setCurrentLayouts(allLayouts as ResponsiveLayouts);
  }, [setSavedLayouts]);

  // Handle breakpoint change
  const handleBreakpointChange = useCallback((_newBreakpoint: string) => {
    // Breakpoint changed - layout will auto-adjust
  }, []);

  const dragConfig = useMemo(() => ({
    enabled: !isMobile,
    handle: '.drag-handle',
    bounded: true,
    threshold: 3,
  }), [isMobile]);

  const resizeConfig = useMemo(() => ({
    enabled: !isMobile,
    handles: ['s', 'e', 'se'] as const,
  }), [isMobile]);

  // Constraints array
  const constraints = useMemo(() => [gridBoundsConstraint], []);

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

  // Use mobile layout for smaller screens
  const mobileL = mobileLayout || defaultLayout;

  const layoutsToUse = Object.keys(currentLayouts).length > 0 ? currentLayouts : {
    lg: addConstraints(defaultLayout),
    md: addConstraints(defaultLayout),
    sm: mobileL,
    xs: mobileL,
  };

  return (
    <div className={`p-4 sm:p-8 md:p-12 ${isMobile ? 'overflow-y-auto' : ''}`} ref={containerRef}>
      {mounted && containerWidth > 0 && (
        <ResponsiveGridLayout
          className="layout"
          width={containerWidth}
          layouts={layoutsToUse}
          breakpoints={breakpoints}
          cols={cols}
          rowHeight={rowHeight}
          maxRows={isMobile ? undefined : MAX_ROWS}
          constraints={constraints}
          onLayoutChange={handleLayoutChange}
          onBreakpointChange={handleBreakpointChange}
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
