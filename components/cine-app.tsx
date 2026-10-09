"use client";
import { usePathname } from "next/navigation";
import { Shell } from "./shell";
import { HomePage } from "./home";
import { DiscoverPage } from "./discovery";
import { LibraryPage } from "./library";
import { CollectionsPage } from "./collections";
import { StatisticsPage } from "./statistics";
import { SettingsPage } from "./settings";
import { BulkPage } from "./bulk";
import { DetailPage } from "./detail";
export function CineApp() {
  const path = usePathname();
  const parts = path.split("/");
  let page: React.ReactNode = <HomePage />;
  if (path === "/discover") page = <DiscoverPage />;
  if (path === "/watchlist") page = <LibraryPage />;
  if (path === "/watched") page = <LibraryPage watched />;
  if (path === "/collections") page = <CollectionsPage />;
  if (path === "/statistics") page = <StatisticsPage />;
  if (path === "/settings") page = <SettingsPage />;
  if (path === "/bulk") page = <BulkPage />;
  if (
    parts[1] === "media" &&
    (parts[2] === "movie" || parts[2] === "tv") &&
    /^\d+$/.test(parts[3])
  )
    page = (
      <DetailPage
        key={`${parts[2]}/${parts[3]}`}
        type={parts[2]}
        id={Number(parts[3])}
      />
    );
  return <Shell>{page}</Shell>;
}
