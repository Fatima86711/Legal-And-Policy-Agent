// frontend/src/components/layout/MainLayout.jsx


// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════════════════════
const SIDEBAR_WIDTH = "280px";


// ══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENT — Mobile Overlay
// Dark overlay behind the sidebar on mobile when it is open
// Tapping it closes the sidebar
// ══════════════════════════════════════════════════════════════════════════════
function MobileOverlay({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="
        fixed inset-0 z-20 bg-black/40 backdrop-blur-sm
        transition-opacity duration-200
        md:hidden
      "
      aria-hidden="true"
    />
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENT — Mobile Menu Toggle Button
// Shown only on small screens — toggles the sidebar open/closed
// ══════════════════════════════════════════════════════════════════════════════
function MobileMenuButton({ isOpen, onToggle }) {
  return (
    <button
      onClick={onToggle}
      aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
      className="
        fixed bottom-20 left-4 z-30 flex h-10 w-10
        items-center justify-center rounded-full
        border border-gray-200 bg-white shadow-md
        transition-all hover:shadow-lg
        md:hidden
      "
    >
      {isOpen ? (
        /* Close icon */
        <svg
          className="h-5 w-5 text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ) : (
        /* Menu icon */
        <svg
          className="h-5 w-5 text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      )}
    </button>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENT — Resize Handle
// Draggable vertical divider between sidebar and main content
// Allows the user to adjust sidebar width on desktop
// ══════════════════════════════════════════════════════════════════════════════
function ResizeHandle({ onMouseDown }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="
        group relative hidden w-1 flex-shrink-0 cursor-col-resize
        bg-gray-200 transition-colors hover:bg-blue-400
        md:block
      "
      aria-hidden="true"
    >
      {/* Visual drag indicator dots */}
      <div className="
        absolute inset-y-0 left-1/2 flex -translate-x-1/2
        flex-col items-center justify-center gap-1
        opacity-0 transition-opacity group-hover:opacity-100
      ">
        <span className="h-1 w-1 rounded-full bg-blue-500" />
        <span className="h-1 w-1 rounded-full bg-blue-500" />
        <span className="h-1 w-1 rounded-full bg-blue-500" />
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// MAIN LAYOUT COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
import { useState, useCallback, useEffect, useRef } from "react";

export default function MainLayout({ sidebar, children }) {

  // ── State ─────────────────────────────────────────────────────────────────
  const [sidebarWidth,      setSidebarWidth]      = useState(parseInt(SIDEBAR_WIDTH));
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isResizing,        setIsResizing]        = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const startXRef          = useRef(0);
  const startWidthRef      = useRef(parseInt(SIDEBAR_WIDTH));
  const layoutRef          = useRef(null);

  // ── Sidebar width constraints ─────────────────────────────────────────────
  const MIN_SIDEBAR_WIDTH = 220;
  const MAX_SIDEBAR_WIDTH = 400;


  // ══════════════════════════════════════════════════════════════════════════
  // RESIZE LOGIC
  // Drag the ResizeHandle to adjust sidebar width on desktop
  // ══════════════════════════════════════════════════════════════════════════

  const handleMouseMove = useCallback((e) => {
    if (!isResizing) return;

    const delta    = e.clientX - startXRef.current;
    const newWidth = Math.min(
      MAX_SIDEBAR_WIDTH,
      Math.max(MIN_SIDEBAR_WIDTH, startWidthRef.current + delta),
    );

    setSidebarWidth(newWidth);
  }, [isResizing]);


  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor       = "";
    document.body.style.userSelect   = "";
  }, []);


  function handleResizeMouseDown(e) {
    e.preventDefault();
    startXRef.current     = e.clientX;
    startWidthRef.current = sidebarWidth;
    setIsResizing(true);
    document.body.style.cursor     = "col-resize";
    document.body.style.userSelect = "none";
  }


  // Attach and clean up global mouse listeners during resize
  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup",   handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup",   handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);


  // ══════════════════════════════════════════════════════════════════════════
  // MOBILE SIDEBAR
  // ══════════════════════════════════════════════════════════════════════════

  function openMobileSidebar()  { setIsMobileSidebarOpen(true);  }
  function closeMobileSidebar() { setIsMobileSidebarOpen(false); }
  function toggleMobileSidebar() {
    setIsMobileSidebarOpen((prev) => !prev);
  }

  // Close mobile sidebar when screen widens to desktop breakpoint
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 768) {
        setIsMobileSidebarOpen(false);
      }
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);


  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div
      ref={layoutRef}
      className="relative flex h-screen w-screen overflow-hidden bg-gray-50"
    >

      {/* ── Mobile overlay ─────────────────────────────────────────────────── */}
      <MobileOverlay
        isOpen={isMobileSidebarOpen}
        onClose={closeMobileSidebar}
      />


      {/* ══════════════════════════════════════════════════════════════════════
          SIDEBAR
          Desktop: fixed width, always visible, resizable
          Mobile:  off-canvas drawer, toggled by MobileMenuButton
      ══════════════════════════════════════════════════════════════════════ */}
      <aside
        style={{ width: `${sidebarWidth}px` }}
        className={`
          flex flex-shrink-0 flex-col
          border-r border-gray-200 bg-white
          transition-transform duration-300 ease-in-out

          /* Desktop — always visible, participates in normal flow */
          hidden md:flex

          /* Mobile — fixed drawer sliding in from left */
          md:relative md:translate-x-0
          ${isMobileSidebarOpen
            ? "fixed inset-y-0 left-0 z-30 flex translate-x-0"
            : "fixed inset-y-0 left-0 z-30 -translate-x-full"
          }
        `}
      >
        {/* Sidebar content — passed via prop from Home.jsx */}
        <div className="flex h-full flex-col overflow-hidden">
          {sidebar}
        </div>
      </aside>


      {/* ── Resize handle — desktop only ──────────────────────────────────── */}
      <ResizeHandle onMouseDown={handleResizeMouseDown} />


      {/* ══════════════════════════════════════════════════════════════════════
          MAIN CONTENT AREA
          Takes all remaining width after the sidebar
          Contains Header + ChatWindow + ChatInput stacked vertically
      ══════════════════════════════════════════════════════════════════════ */}
      <main className="
        flex flex-1 flex-col overflow-hidden bg-white
        min-w-0
      ">
        {/* Main content — passed via children from Home.jsx */}
        {children}
      </main>


      {/* ── Mobile menu toggle button ─────────────────────────────────────── */}
      <MobileMenuButton
        isOpen={isMobileSidebarOpen}
        onToggle={toggleMobileSidebar}
      />

    </div>
  );
}