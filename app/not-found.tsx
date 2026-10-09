import Link from "next/link";
export default function NotFound() {
  return (
    <div className="empty-state">
      <h1>This story hasn’t been written.</h1>
      <p>The page doesn’t exist.</p>
      <Link href="/">Return to CineVault</Link>
    </div>
  );
}
