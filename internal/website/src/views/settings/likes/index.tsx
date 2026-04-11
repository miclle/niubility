import { useRef, useCallback, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { Heart, Image as ImageIcon, Sparkles } from "lucide-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { listMyLikes } from "src/api/content";
import { getStyledContentCardCover } from "src/lib/content-assets";
import { contentDetailPath } from "src/lib/content-url";
import { toPlainTextPreview } from "src/lib/utils";
import { useIntersection } from "src/hooks/use-intersection";
import { useAppContext } from "src/context/app";
import type { ContentType, MyLikeItem } from "src/types/content";

const limit = 20;
type LikeFilterType = ContentType | "all";

function buildLikeTargetPath(item: MyLikeItem): string {
  const searchParams = new URLSearchParams();

  if (item.recent_target_type === "content") {
    searchParams.set("liked_content", "1");
  }

  if (item.recent_target_type === "comment") {
    searchParams.set("liked_comment", item.recent_target_id);
  }

  if (item.recent_attachment_id) {
    searchParams.set("liked_attachment", item.recent_attachment_id);
  }

  const query = searchParams.toString();
  const hash =
    item.recent_target_type === "comment"
      ? `#comment-${item.recent_target_id}`
      : "";
  return `${contentDetailPath(item.content)}${query ? `?${query}` : ""}${hash}`;
}

function MyLikes() {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const { siteConfig } = useAppContext();
  const [activeType, setActiveType] = useState<LikeFilterType>("all");

  const typeTabs: Array<{ key: LikeFilterType; label: string }> = [
    { key: "all", label: t("settings:allTypes") },
    { key: "video", label: t("settings:videos") },
    { key: "gallery", label: t("settings:galleries") },
    { key: "article", label: t("settings:articles") },
    { key: "podcast", label: t("settings:podcasts") || "Podcasts" },
  ];

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ["my-likes"],
      queryFn: ({ pageParam }) => listMyLikes({ cursor: pageParam, limit }),
      getNextPageParam: (lastPage) => lastPage.data.next_cursor || undefined,
      initialPageParam: undefined as string | undefined,
    });

  const allItems = data?.pages.flatMap((p) => p.data.items) ?? [];
  const items = useMemo(
    () =>
      activeType === "all"
        ? allItems
        : allItems.filter((item) => item.content.type === activeType),
    [activeType, allItems],
  );
  const loaderRef = useRef<HTMLDivElement>(null);
  const handleIntersect = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  useIntersection(loaderRef, handleIntersect);

  const loading = isLoading || isFetchingNextPage;

  const renderSummary = (item: MyLikeItem) => {
    const pieces: string[] = [];
    if (item.liked_content) pieces.push(t("settings:likedContentSummary"));
    if (item.liked_comment_count > 0)
      pieces.push(
        t("settings:likedCommentsSummary", { count: item.liked_comment_count }),
      );
    if (item.liked_attachment_count > 0)
      pieces.push(
        t("settings:likedAttachmentsSummary", {
          count: item.liked_attachment_count,
        }),
      );
    return pieces.join(" · ");
  };

  return (
    <div className="min-h-full bg-white">
      <div className="px-6 pt-8 pb-0 lg:px-12">
        <h1
          className="text-[2rem] font-semibold tracking-tight"
          style={{ color: "#0f0f0f" }}
        >
          {t("settings:myLikesTitle")}
        </h1>

        <div className="mt-6 -mx-6 flex gap-10 overflow-x-auto border-b border-[#ececec] px-6 lg:-mx-12 lg:px-12">
          {typeTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveType(tab.key)}
              className="relative shrink-0 pb-2.5 text-[15px] font-semibold transition-colors"
              style={{ color: activeType === tab.key ? "#0f0f0f" : "#6f6f6f" }}
            >
              {tab.label}
              {activeType === tab.key && (
                <span
                  className="absolute inset-x-0 bottom-0 h-0.5 rounded-full"
                  style={{ background: "#0f0f0f" }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 && !loading ? (
        <div className="flex min-h-[460px] flex-col items-center justify-center px-6 text-center lg:px-12">
          <div
            className="flex h-40 w-40 items-center justify-center rounded-[2rem]"
            style={{
              background: "linear-gradient(180deg, #ffe9ef 0%, #ffd2dd 100%)",
            }}
          >
            <Heart size={72} strokeWidth={1.5} style={{ color: "#d23b68" }} />
          </div>
          <h2
            className="mt-8 text-2xl font-semibold"
            style={{ color: "#0f0f0f" }}
          >
            {t("settings:myLikesTitle")}
          </h2>
          <p
            className="mt-3 max-w-md text-sm leading-6"
            style={{ color: "#707070" }}
          >
            {allItems.length === 0
              ? t("settings:noLikes")
              : t("settings:noLikesForType")}
          </p>
        </div>
      ) : (
        <div className="px-6 py-8 lg:px-12">
          <div className="divide-y divide-[#ececec]">
            {items.map((item) => (
              <div
                key={`${item.content.id}-${item.last_liked_at}`}
                className="flex gap-5 py-5 first:pt-0"
              >
                <div className="h-[84px] w-[148px] shrink-0 overflow-hidden rounded-xl bg-[#f5f5f5]">
                  <NavLink
                    to={buildLikeTargetPath(item)}
                    className="block h-full w-full no-underline"
                  >
                    <img
                      src={getStyledContentCardCover(item.content, siteConfig)}
                      alt={item.content.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </NavLink>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <NavLink
                        to={buildLikeTargetPath(item)}
                        className="block truncate text-[15px] font-medium no-underline hover:underline"
                        style={{ color: "#0f0f0f" }}
                      >
                        {item.content.title}
                      </NavLink>

                      {item.content.summary && (
                        <p
                          className="mt-1 line-clamp-2 text-sm leading-6"
                          style={{ color: "#707070" }}
                        >
                          {toPlainTextPreview(item.content.summary)}
                        </p>
                      )}

                      <div
                        className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm"
                        style={{ color: "#909090" }}
                      >
                        <span className="inline-flex items-center gap-1">
                          <Heart size={13} style={{ color: "#b42359" }} />
                          <span>{renderSummary(item)}</span>
                        </span>
                        {item.liked_attachment_count > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <ImageIcon size={13} />
                            <span>
                              {t("settings:likedAttachmentsSummary", {
                                count: item.liked_attachment_count,
                              })}
                            </span>
                          </span>
                        )}
                        <span>
                          {new Date(item.last_liked_at).toLocaleDateString(
                            "zh-CN",
                          )}
                        </span>
                        <NavLink
                          to={buildLikeTargetPath(item)}
                          className="inline-flex items-center gap-1 font-medium no-underline hover:underline"
                          style={{ color: "#065fd4" }}
                        >
                          <Sparkles size={14} />
                          {t("settings:viewDetails")}
                        </NavLink>
                      </div>
                    </div>
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
        style={{ color: "#909090" }}
      >
        {loading
          ? tc("common:loading")
          : !hasNextPage && allItems.length > 0
            ? tc("common:noMoreContent")
            : ""}
      </div>
    </div>
  );
}

export default MyLikes;
