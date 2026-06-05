"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

function mergeClasses(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Tooltip({
  content,
  label,
  children,
  className,
  triggerClassName,
}: {
  content: string;
  label: string;
  children: React.ReactNode;
  className?: string;
  triggerClassName?: string;
}) {
  const tooltipId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number; placeAbove: boolean }>({
    left: 0,
    top: 0,
    placeAbove: true,
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  function updatePosition(target: HTMLElement) {
    const rect = target.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const tooltipWidth = Math.min(320, viewportWidth - 24);
    const nextLeft = Math.min(
      viewportWidth - tooltipWidth / 2 - 12,
      Math.max(tooltipWidth / 2 + 12, rect.left + rect.width / 2)
    );
    const preferredTop = rect.top - 10;
    const useBottom = preferredTop < 72;
    const nextTop = useBottom ? rect.bottom + 10 : preferredTop;
    setPosition({ left: nextLeft, top: nextTop, placeAbove: !useBottom });
  }

  function openFromTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return;
    updatePosition(target);
    setIsOpen(true);
  }

  useEffect(() => {
    if (!isOpen) return;

    const handleClose = () => setIsOpen(false);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    const handleResizeOrScroll = () => setIsOpen(false);

    window.addEventListener("resize", handleResizeOrScroll);
    window.addEventListener("scroll", handleResizeOrScroll, true);
    document.addEventListener("pointerdown", handleClose);
    document.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("resize", handleResizeOrScroll);
      window.removeEventListener("scroll", handleResizeOrScroll, true);
      document.removeEventListener("pointerdown", handleClose);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <span className={mergeClasses("relative inline-flex", className)}>
      <span
        tabIndex={0}
        aria-label={label}
        aria-describedby={tooltipId}
        aria-expanded={isOpen}
        className={mergeClasses(
          "inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fin-brand focus-visible:ring-offset-2 focus-visible:ring-offset-fin-surface rounded-full",
          triggerClassName
        )}
        onMouseEnter={(event) => openFromTarget(event.currentTarget)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={(event) => openFromTarget(event.currentTarget)}
        onBlur={() => setIsOpen(false)}
        onTouchStart={(event) => {
          event.stopPropagation();
          if (isOpen) {
            setIsOpen(false);
            return;
          }
          openFromTarget(event.currentTarget);
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {children}
      </span>
      {isMounted &&
        isOpen &&
        createPortal(
          <span
            id={tooltipId}
            role="tooltip"
            className="pointer-events-none fixed z-[200] w-[min(20rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-2xl border border-fin-border-strong bg-fin-elevated p-3 text-left text-xs leading-relaxed text-fin-text shadow-float motion-reduce:transition-none"
            style={{
              left: `${position.left}px`,
              top: `${position.top}px`,
              transform: position.placeAbove
                ? "translateX(-50%) translateY(-100%)"
                : "translateX(-50%)",
            }}
          >
            {content}
          </span>,
          document.body
        )}
    </span>
  );
}

export function TooltipLabel({
  label,
  content,
  className,
}: {
  label: string;
  content: string;
  className?: string;
}) {
  return (
    <Tooltip
      label={`${label} explanation`}
      content={content}
      className={className}
      triggerClassName="rounded-md px-0.5"
    >
      <span className="inline-flex items-center gap-1.5">
        <span className="border-b border-dotted border-fin-subtle/80">{label}</span>
        <span
          aria-hidden
          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-fin-border-strong text-[10px] font-bold text-fin-subtle"
        >
          i
        </span>
      </span>
    </Tooltip>
  );
}
