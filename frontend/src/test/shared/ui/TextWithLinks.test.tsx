import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextWithLinks } from "@shared/ui/TextWithLinks";

describe("TextWithLinks", () => {
  it("renders simple text without links", () => {
    render(<TextWithLinks text="Hello World" />);
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("converts http/https URLs to clickable links", () => {
    render(<TextWithLinks text="Visit https://google.com for info" />);
    
    const link = screen.getByRole("link");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://google.com");
    expect(link).toHaveTextContent("https://google.com");
  });

  it("converts www. URLs adding https protocol", () => {
    render(<TextWithLinks text="Visit www.example.com" />);
    
    const link = screen.getByRole("link");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://www.example.com");
    expect(link).toHaveTextContent("www.example.com");
  });

  it("renders multiple links with intervening text", () => {
    render(<TextWithLinks text="Go to https://a.com and http://b.com" />);
    
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "https://a.com");
    expect(links[1]).toHaveAttribute("href", "http://b.com");
  });

  it("returns null or empty for falsy text", () => {
    const { container } = render(<TextWithLinks text="" />);
    expect(container.firstChild).toBeNull();
  });
});
