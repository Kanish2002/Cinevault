"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty-state">
      <h1>A brief intermission.</h1>
      <p>
        The page could not open. Your local collection is still stored in this
        browser.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
