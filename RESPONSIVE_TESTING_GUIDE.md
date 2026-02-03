# Mobile Responsive Testing Guide

## Quick Start

### 1. Start Development Server
```bash
cd /Users/jong-geon/Desktop/aeri.xyz/dashboard
npm run dev
```

Server will be available at: `http://localhost:5175/` (or next available port)

### 2. Open Chrome DevTools
1. Open the URL in Chrome
2. Press `F12` (Windows/Linux) or `Cmd+Option+I` (Mac)
3. Click the device toolbar icon or press `Cmd+Shift+M` (Mac) / `Ctrl+Shift+M` (Windows)

## Testing Checklist by Device Size

### Mobile (iPhone SE - 375px width)

#### Layout
- [ ] All widgets are stacked vertically (single column)
- [ ] No horizontal scrolling
- [ ] Adequate spacing between widgets

#### DashboardGrid
- [ ] Drag handles are NOT visible
- [ ] Cannot drag or resize widgets
- [ ] Widgets fill full width

#### Header
- [ ] Title is readable: "Personal Dashboard"
- [ ] Subtitle is hidden
- [ ] Padding looks good

#### CalendarWidget
- [ ] Calendar fits in viewport
- [ ] Dates are tappable (not too small)
- [ ] Navigation buttons are touch-friendly (44x44px)
- [ ] Modal appears properly when clicking dates
- [ ] Modal is properly sized for mobile screen

#### TodoWidget
- [ ] Input field is full width
- [ ] Checkboxes are large enough (20x20px)
- [ ] Add button is touch-friendly
- [ ] Edit/Delete buttons are always visible (no hover needed)
- [ ] Scrolling works within the widget

#### WeatherWidget
- [ ] Weather icon is appropriately sized
- [ ] Temperature is clearly visible
- [ ] Humidity/Wind cards are readable
- [ ] Location form stacks vertically
- [ ] Save/Cancel buttons are touch-friendly

#### BookmarkWidget
- [ ] Add button is touch-friendly
- [ ] Filter/Sort dropdowns work well
- [ ] Bookmark items are readable
- [ ] Edit/Delete buttons are visible
- [ ] URLs truncate properly

#### ReadingWidget
- [ ] Progress bar is visible
- [ ] Add button is touch-friendly
- [ ] Status dropdown is easy to use
- [ ] Edit/Delete icons are large enough

### Tablet (iPad Air - 820px width)

#### Layout
- [ ] Widgets use 6-column grid
- [ ] 2 widgets per row (approximately)
- [ ] Appropriate gaps between widgets

#### Interaction
- [ ] Still no drag/resize (< 768px threshold)
- [ ] All widgets fit comfortably
- [ ] Text is well-sized

### Desktop (1920px width)

#### Layout
- [ ] Widgets use full 12-column grid
- [ ] Original 2x3 grid layout maintained
- [ ] Proper spacing and alignment

#### Interaction
- [ ] Drag handles are visible (at top of each widget)
- [ ] Can drag widgets to reposition
- [ ] Can resize widgets
- [ ] Hover effects work on buttons (opacity changes)

#### Features
- [ ] All original desktop functionality preserved
- [ ] No mobile-specific elements visible
- [ ] Optimal use of screen space

## Browser Testing Matrix

### Desktop Browsers
| Browser | Version | Status |
|---------|---------|--------|
| Chrome  | Latest  | ⬜ Test |
| Firefox | Latest  | ⬜ Test |
| Safari  | Latest  | ⬜ Test |
| Edge    | Latest  | ⬜ Test |

### Mobile Browsers
| Device/Browser | Status |
|---------------|--------|
| iPhone Safari | ⬜ Test |
| Android Chrome | ⬜ Test |
| iPad Safari | ⬜ Test |

## Common Issues & Solutions

### Issue: Widgets overlap on mobile
**Solution**: Clear localStorage and reload
```javascript
// In browser console:
localStorage.clear();
location.reload();
```

### Issue: Layout doesn't respond to resize
**Solution**: Hard refresh the page
- Mac: `Cmd+Shift+R`
- Windows: `Ctrl+Shift+R`

### Issue: Buttons too small to tap
**Verify**: Check if buttons have `min-h-[44px]` class
**Fix**: All interactive elements should be at least 44x44px

### Issue: Horizontal scrolling on mobile
**Check**: Viewport meta tag in index.html
**Expected**: `width=device-width, initial-scale=1.0`

## Performance Testing

### Lighthouse Audit
1. Open Chrome DevTools
2. Go to "Lighthouse" tab
3. Select "Mobile" device
4. Check all categories
5. Click "Generate report"

**Expected Scores:**
- Performance: > 90
- Accessibility: > 90
- Best Practices: > 90
- SEO: > 80

### Mobile Performance Metrics
- [ ] First Contentful Paint < 1.8s
- [ ] Time to Interactive < 3.9s
- [ ] Cumulative Layout Shift < 0.1
- [ ] Largest Contentful Paint < 2.5s

## Detailed Feature Testing

### Calendar Widget Mobile Tests
1. **Tap on today's date**
   - Modal should appear
   - Modal should be centered and readable
   - Input fields should be easy to tap

2. **Add an event**
   - Type in title (keyboard should not obscure input)
   - Set time (time picker should work)
   - Tap "Save"
   - Event should appear on calendar

3. **Edit an event**
   - Tap on date with event
   - Modify details
   - Tap "Update"
   - Changes should persist

4. **Navigate months**
   - Tap previous/next month buttons
   - Should be smooth and responsive
   - Button tap area should be adequate

### Todo Widget Mobile Tests
1. **Add a todo**
   - Tap input field
   - Type task
   - Select recurring option if desired
   - Tap "Add"
   - Todo appears in list

2. **Complete a todo**
   - Tap checkbox
   - Item should strikethrough
   - Checkbox should be easy to tap

3. **Edit a todo**
   - Tap "Edit" button
   - Modify text
   - Change recurring setting
   - Tap "Save"
   - Changes persist

4. **Delete a todo**
   - Tap "Delete" button
   - Item removed immediately

### Weather Widget Mobile Tests
1. **Change location**
   - Tap location name
   - Form appears (stacked vertically)
   - Type new city
   - Tap "Save"
   - Weather updates

2. **Refresh weather**
   - Tap refresh icon (🔄)
   - Should rotate and update
   - New timestamp shown

### Bookmark Widget Mobile Tests
1. **Add bookmark**
   - Tap "+ Add"
   - Form appears
   - Fill in name and URL
   - Add tags (press Enter after each)
   - Tap "Save"
   - Bookmark appears

2. **Filter by tag**
   - Tap tag filter dropdown
   - Select a tag
   - List filters correctly

3. **Edit bookmark**
   - Tap "Edit" on a bookmark
   - Modify details
   - Tap "Update"
   - Changes save

### Reading Widget Mobile Tests
1. **Add reading**
   - Tap "Add Reading"
   - Enter title and URL
   - Tap "Save"
   - Item appears in list

2. **Change status**
   - Tap status dropdown
   - Select new status
   - Color badge updates
   - Progress bar updates

3. **Edit reading**
   - Tap edit icon
   - Modify details
   - Tap "Update"
   - Changes persist

## Viewport Breakpoint Testing

Test these specific widths to verify breakpoint behavior:

| Width | Expected Layout | Drag/Resize |
|-------|----------------|-------------|
| 320px | 2 columns (xxs) | Disabled |
| 480px | 4 columns (xs) | Disabled |
| 640px | 6 columns (sm) | Disabled |
| 768px | 6 columns (sm) | **Enabled** |
| 996px | 10 columns (md) | Enabled |
| 1200px | 12 columns (lg) | Enabled |

## Screenshot Checklist

Take screenshots at these sizes for documentation:
- [ ] iPhone SE (375px) - Mobile view
- [ ] iPad Air (820px) - Tablet view
- [ ] Desktop (1920px) - Desktop view

## Accessibility Testing

### Keyboard Navigation
- [ ] Can tab through all interactive elements
- [ ] Tab order is logical
- [ ] Focus indicators are visible
- [ ] Enter/Space activate buttons

### Screen Reader Testing
- [ ] VoiceOver (iOS/Mac): All elements announced properly
- [ ] TalkBack (Android): Navigation works
- [ ] NVDA/JAWS (Windows): Semantic structure correct

### Color Contrast
- [ ] All text has sufficient contrast ratio
- [ ] Dark mode (if applicable) also meets standards
- [ ] Interactive states are distinguishable

### Touch Targets
Verify all interactive elements meet WCAG 2.1 Level AAA:
- [ ] Minimum 44x44px on mobile
- [ ] Adequate spacing between targets
- [ ] No accidental taps

## Network Testing

### Slow 3G Simulation
1. Open DevTools Network tab
2. Select "Slow 3G" from throttling dropdown
3. Reload page
4. Verify:
   - [ ] Page loads within reasonable time
   - [ ] No broken layouts during loading
   - [ ] Loading states are clear

### Offline Testing
1. Open DevTools Application tab
2. Check "Offline" in Service Worker section
3. Verify:
   - [ ] Appropriate offline message
   - [ ] No console errors
   - [ ] Graceful degradation

## Final Verification

Before marking as complete, verify:
- [ ] All widgets work on mobile
- [ ] No horizontal scrolling on any screen size
- [ ] Touch targets are appropriately sized
- [ ] Text is readable at all sizes
- [ ] Forms are easy to use on mobile
- [ ] No TypeScript errors in console
- [ ] No React warnings in console
- [ ] Build succeeds without errors
- [ ] LocalStorage persists data correctly
- [ ] Layout preferences are saved

## Report Issues

If you find any issues during testing:

1. **Screen Size**: What viewport size?
2. **Browser**: Which browser and version?
3. **Issue**: What's broken or not working?
4. **Expected**: What should happen?
5. **Steps**: How to reproduce?

---

**Testing Status**: 🟡 Ready for Testing
**Last Updated**: 2026-02-01
**Dev Server**: http://localhost:5175/
