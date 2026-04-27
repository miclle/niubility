import { useRef, useCallback, useState } from "react";
import { NavLink } from "react-router-dom";
import { Heart, MessageSquare, Sparkles } from "lucide-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useAppContext } from "src/context/app";
import { listFavorites } from "src/api/content";
import { getStyledContentCardCover } from "src/lib/content-assets";
import { contentDetailPath } from "src/lib/content-url";
import { toPlainTextPreview } from "src/lib/utils";
import { useIntersection } from "src/hooks/use-intersection";
import type { ContentType } from "src/types/content";

const limit = 20;
type FavoriteFilterType = ContentType | "all";

// Favorites displays the current user's favorited content list with infinite scroll.
function Favorites() {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const { currentUser, siteConfig } = useAppContext();
  const [activeType, setActiveType] = useState<FavoriteFilterType>("all");

  const typeTabs: Array<{ key: FavoriteFilterType; label: string }> = [
    { key: "all", label: t("settings:allTypes") },
    { key: "video", label: t("settings:videos") },
    { key: "gallery", label: t("settings:galleries") },
    { key: "article", label: t("settings:articles") },
    { key: "podcast", label: t("settings:podcasts") || "Podcasts" },
  ];

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ["my-favorites"],
      queryFn: ({ pageParam }) => listFavorites({ cursor: pageParam, limit }),
      getNextPageParam: (lastPage) => lastPage.data.next_cursor || undefined,
      initialPageParam: undefined as string | undefined,
      enabled: !!currentUser,
    });

  const allContents = data?.pages.flatMap((p) => p.data.items) ?? [];
  const contents =
    activeType === "all"
      ? allContents
      : allContents.filter((content) => content.type === activeType);
  const loaderRef = useRef<HTMLDivElement>(null);
  const handleIntersect = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  useIntersection(loaderRef, handleIntersect);

  const loading = isLoading || isFetchingNextPage;

  return (
    <div className="app-surface min-h-full">
      <div className="px-6 pt-8 pb-0 lg:px-12">
        <h1
          className="text-[2rem] font-semibold tracking-tight"
          style={{ color: "var(--foreground)" }}
        >
          {t("settings:myFavoritesTitle")}
        </h1>

        <div className="mt-6 -mx-6 flex gap-10 overflow-x-auto border-b app-border px-6 lg:-mx-12 lg:px-12">
          {typeTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveType(tab.key)}
              className="relative shrink-0 pb-2.5 text-[15px] font-semibold transition-colors"
              style={{ color: activeType === tab.key ? "var(--foreground)" : "var(--text-secondary)" }}
            >
              {tab.label}
              {activeType === tab.key && (
                <span
                  className="absolute inset-x-0 bottom-0 h-0.5 rounded-full"
                  style={{ background: "var(--foreground)" }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {contents.length === 0 && !loading ? (
        <div className="flex min-h-[460px] flex-col items-center justify-center px-6 text-center lg:px-12">
          <div
            className="flex h-40 w-40 items-center justify-center rounded-[2rem]"
            style={{
              background: "linear-gradient(180deg, #dff8ff 0%, #b5ecff 100%)",
            }}
          >
            <Sparkles
              size={72}
              strokeWidth={1.5}
              style={{ color: "#1296c9" }}
            />
          </div>
          <h2
            className="mt-8 text-2xl font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            {t("settings:myFavoritesTitle")}
          </h2>
          <p
            className="mt-3 max-w-md text-sm leading-6"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("settings:noFavoritesForType")}
          </p>
        </div>
      ) : (
        <div className="px-6 py-8 lg:px-12">
          <div className="divide-y app-border">
            {contents.map((content) => (
              <div key={content.id} className="flex gap-5 py-5 first:pt-0">
                <div className="app-surface-muted h-[84px] w-[148px] shrink-0 overflow-hidden rounded-xl">
                  <NavLink
                    to={contentDetailPath(content)}
                    className="block h-full w-full no-underline"
                  >
                    <img
                      src={getStyledContentCardCover(content, siteConfig)}
                      alt={content.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </NavLink>
                </div>

                <div className="min-w-0 flex-1">
                  <NavLink
                    to={contentDetailPath(content)}
                    className="block truncate text-[15px] font-medium no-underline hover:underline"
                    style={{ color: "var(--foreground)" }}
                  >
                    {content.title}
                  </NavLink>

                  {content.summary && (
                    <p
                      className="mt-1 line-clamp-2 text-sm leading-6"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {toPlainTextPreview(content.summary)}
                    </p>
                  )}

                  <div
                    className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    <span>
                      {new Date(content.created_at).toLocaleDateString("zh-CN")}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Heart size={13} />
                      <span>{content.like_count}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare size={13} />
                      <span>{content.comment_count}</span>
                    </span>
                    <NavLink
                      to={contentDetailPath(content)}
                      className="inline-flex items-center gap-1 font-medium no-underline hover:underline"
                      style={{ color: "var(--brand)" }}
                    >
                      {t("settings:viewDetails")}
                    </NavLink>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        ref={loaderRef}
        className="py-4 text-center text-sm"
        style={{ color: "var(--text-tertiary)" }}
      >
        {loading
          ? tc("common:loading")
          : !hasNextPage && allContents.length > 0
            ? tc("common:noMoreContent")
            : ""}
      </div>
    </div>
  );
}

export default Favorites;
