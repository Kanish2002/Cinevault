import { render, screen, fireEvent } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import { Button } from "@/components/ui/button";
it("exposes usable keyboard button semantics and disabled behavior", () => {
  const action = vi.fn();
  const { rerender } = render(<Button onClick={action}>Save movie</Button>);
  fireEvent.click(screen.getByRole("button", { name: "Save movie" }));
  expect(action).toHaveBeenCalledTimes(1);
  rerender(
    <Button disabled onClick={action}>
      Save movie
    </Button>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Save movie" }));
  expect(action).toHaveBeenCalledTimes(1);
});
