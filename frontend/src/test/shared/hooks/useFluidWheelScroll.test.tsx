import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useFluidWheelContainer, useFluidWheelWindow } from "../../../../src/shared/hooks/useFluidWheelScroll";

function TestContainerComponent({ enabled = true, options = {} }) {
  const ref = useFluidWheelContainer<HTMLDivElement>(enabled, options);
  return (
    <div ref={ref} data-testid="scroll-container" style={{ height: "100px", overflowY: "auto" }}>
      <div style={{ height: "1000px" }}>content</div>
    </div>
  );
}

function TestWindowComponent({ enabled = true }) {
  useFluidWheelWindow(enabled);
  return <div data-testid="window-anchor">Window anchor</div>;
}

describe("useFluidWheelContainer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Setup requestAnimationFrame mock that integrates with setTimeout fake timers
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: any) => {
      setTimeout(() => cb(performance.now()), 16);
      return 1;
    });
    vi.spyOn(window, "matchMedia").mockImplementation(
      ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })) as typeof window.matchMedia
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("mounts safely and applies listeners", () => {
    const { unmount } = render(<TestContainerComponent />);
    const div = screen.getByTestId("scroll-container");
    expect(div).toBeInTheDocument();
    unmount();
  });

  it("handles wheel triggers after idle buffer", async () => {
    render(<TestContainerComponent />);
    const div = screen.getByTestId("scroll-container");

    // Mock node layout metrics
    Object.defineProperty(div, "clientHeight", { value: 100, configurable: true });
    Object.defineProperty(div, "scrollHeight", { value: 1000, configurable: true });
    
    let currentScrollTop = 0;
    Object.defineProperty(div, "scrollTop", {
      get: () => currentScrollTop,
      set: (val) => { currentScrollTop = val; },
      configurable: true
    });

    // Dispatch mock WheelEvent
    const event = new WheelEvent("wheel", { deltaY: 200, deltaMode: 0 });
    div.dispatchEvent(event);

    // Fast Forward Idle buffer (default options 110ms)
    vi.advanceTimersByTime(120);

    // Fast Forward Frame buffer for tail animations (default options 900ms)
    vi.advanceTimersByTime(1000);

    // Verification
    expect(currentScrollTop).toBeGreaterThan(0);
  });

  it("does nothing when disabled", () => {
    render(<TestContainerComponent enabled={false} />);
    const div = screen.getByTestId("scroll-container");

    Object.defineProperty(div, "clientHeight", { value: 100, configurable: true });
    Object.defineProperty(div, "scrollHeight", { value: 1000, configurable: true });

    let currentScrollTop = 0;
    Object.defineProperty(div, "scrollTop", {
      get: () => currentScrollTop,
      set: (val) => {
        currentScrollTop = val;
      },
      configurable: true,
    });

    div.dispatchEvent(new WheelEvent("wheel", { deltaY: 200, deltaMode: 0 }));
    vi.advanceTimersByTime(1200);

    expect(currentScrollTop).toBe(0);
  });

  it("does nothing when reduced motion is preferred", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      ((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })) as typeof window.matchMedia
    );

    render(<TestContainerComponent />);
    const div = screen.getByTestId("scroll-container");

    Object.defineProperty(div, "clientHeight", { value: 100, configurable: true });
    Object.defineProperty(div, "scrollHeight", { value: 1000, configurable: true });

    let currentScrollTop = 0;
    Object.defineProperty(div, "scrollTop", {
      get: () => currentScrollTop,
      set: (val) => {
        currentScrollTop = val;
      },
      configurable: true,
    });

    div.dispatchEvent(new WheelEvent("wheel", { deltaY: 200, deltaMode: 0 }));
    vi.advanceTimersByTime(1200);

    expect(currentScrollTop).toBe(0);
  });
});

describe("useFluidWheelWindow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: any) => {
      setTimeout(() => cb(performance.now()), 16);
      return 1;
    });
    vi.spyOn(window, "matchMedia").mockImplementation(
      ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })) as typeof window.matchMedia
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("calls window.scrollTo on wheel event", async () => {
    const scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    
    // Mock Scroll height specs on documentElement
    Object.defineProperty(document.documentElement, "scrollHeight", { value: 2000, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });

    render(<TestWindowComponent />);

    const wheelEvent = new WheelEvent("wheel", { deltaY: 300, deltaMode: 0 });
    window.dispatchEvent(wheelEvent);

    vi.advanceTimersByTime(100);

    // Verify trigger scrolling behavior 
    expect(scrollToSpy).toHaveBeenCalled();
  });

  it("does not call scrollTo when disabled", () => {
    const scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    Object.defineProperty(document.documentElement, "scrollHeight", {
      value: 2000,
      configurable: true,
    });
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });

    render(<TestWindowComponent enabled={false} />);

    window.dispatchEvent(new WheelEvent("wheel", { deltaY: 300, deltaMode: 0 }));
    vi.advanceTimersByTime(100);

    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it("does not intercept wheel scrolling when a nested scrollable ancestor can handle it", () => {
    const scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    Object.defineProperty(document.documentElement, "scrollHeight", {
      value: 2000,
      configurable: true,
    });
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });

    render(
      <div
        data-testid="nested-scrollable"
        style={{ overflowY: "auto", height: "100px" }}
      >
        <div style={{ height: "1000px" }}>nested content</div>
        <TestWindowComponent />
      </div>
    );

    const nested = screen.getByTestId("nested-scrollable");
    Object.defineProperty(nested, "clientHeight", { value: 100, configurable: true });
    Object.defineProperty(nested, "scrollHeight", { value: 1000, configurable: true });
    Object.defineProperty(nested, "scrollTop", {
      value: 200,
      writable: true,
      configurable: true,
    });

    const wheelEvent = new WheelEvent("wheel", {
      deltaY: 300,
      deltaMode: 0,
      cancelable: true,
      bubbles: true,
    });
    nested.dispatchEvent(wheelEvent);
    vi.advanceTimersByTime(100);

    expect(scrollToSpy).not.toHaveBeenCalled();
  });
});
