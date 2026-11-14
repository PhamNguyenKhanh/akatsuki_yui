import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";

describe("Button Slot regression test", () => {
  it("renders asChild with a single React element child without Radix Slot error", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        Button,
        { asChild: true, size: "lg" },
        React.createElement("a", { href: "/login" }, "Đăng nhập")
      )
    );

    expect(html).toContain("<a");
    expect(html).toContain('href="/login"');
    expect(html).toContain("Đăng nhập");
    expect(html).not.toContain("<button");
  });

  it("renders native button with loading indicator when asChild is false", () => {
    const html = renderToStaticMarkup(
      React.createElement(Button, { isLoading: true }, "Đang xử lý")
    );

    expect(html).toContain("<button");
    expect(html).toContain("disabled");
    expect(html).toContain("Đang xử lý");
  });
});
