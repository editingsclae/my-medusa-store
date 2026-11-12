import React from 'react';

// A template (unlike a layout) is created again on every navigation, so the page
// content fades in each time you move between pages. The wrapper keeps the same
// column layout the pages had directly under <main>.
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="page-enter"
      style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}
    >
      {children}
    </div>
  );
}
