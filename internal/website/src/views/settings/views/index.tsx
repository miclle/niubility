import { useMemo, useRef, useCallback, useState } from "react";
import { NavLink } from "react-router-dom";
import { Clock3, Eye } from "lucide-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useAppContext } from "src/context/app";
import { listMyContentViews } from "src/api/view";
import { getStyledContentCardCover } from "src/lib/content-assets";
import { contentDetailPath } from "src/lib/content-url";
import { toPlainTextPreview } from "src/lib/utils";
import { useIntersection } from "src/hooks/use-intersection";
import type { ContentType } from "src/types/content";

const limit = 20;
type ViewFilterType = ContentType | "all";

interface ViewGroup {
  key: string;
  label: string;
  items: Awaited<ReturnType<typeof listMyContentViews>>["data"]["items"];
}

function getStartOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function getStartOfWeek(value: Date) {
  const start = getStartOfDay(value);
  const day = start.getDay();
  const diff = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - diff);
  return start;
}

function MyViews() {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const { currentUser, siteConfig } = useAppContext();
  const [activeType, setActiveType] = useState<ViewFilterType>("all");

  const typeTabs: Array<{ key: ViewFilterType; label: string }> = [
    { key: "all", label: t("settings:allTypes") },
    { key: "video", label: t("settings:videos") },
    { key: "gallery", label: t("settings:galleries") },
    { key: "article", label: t("settings:articles") },
    { key: "podcast", label: t("settings:podcasts") || "Podcasts" },
  ];

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ["my-views", activeType],
      queryFn: ({ pageParam }) =>
        listMyContentViews({
          cursor: pageParam,
          limit,
          type: activeType,
        }),
      getNextPageParam: (lastPage) => lastPage.data.next_cursor || undefined,
      initialPageParam: undefined as string | undefined,
      enabled: !!currentUser,
    });

  const items = data?.pages.flatMap((p) => p.data.items) ?? [];
  const groupedItems = useMemo<ViewGroup[]>(() => {
    const now = new Date();
    const today = getStartOfDay(now);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekStart = getStartOfWeek(now);
    const groups = new Map<string, ViewGroup>();

    const resolveGroup = (value: string) => {
      const viewedAt = new Date(value);
      const viewedDay = getStartOfDay(viewedAt);

      if (viewedDay.getTime() === today.getTime()) {
        return {
          key: "today",
          label: t("settings:viewGroupToday"),
        };
      }
      if (viewedDay.getTime() === yesterday.getTime()) {
        return {
          key: "yesterday",
          label: t("settings:viewGroupYesterday"),
        };
      }
      if (viewedDay >= weekStart) {
        return {
          key: "this-week",
          label: t("settings:viewGroupThisWeek"),
        };
      }
      return {
        key: viewedDay.toISOString(),
        label: viewedAt.toLocaleDateString("zh-CN", {
          month: "long",
          day: "numeric",
          weekday: "short",
        }),
      };
    };

    for (const item of items) {
      const groupMeta = resolveGroup(item.last_viewed_at);
      const existing = groups.get(groupMeta.key);
      if (existing) {
        existing.items.push(item);
        continue;
      }
      groups.set(groupMeta.key, {
        ...groupMeta,
        items: [item],
      });
    }

    return Array.from(groups.values());
  }, [items, t]);
  const loaderRef = useRef<HTMLDivElement>(null);
  const handleIntersect = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  useIntersection(loaderRef, handleIntersect);

  const loading = isLoading || isFetchingNextPage;

  const formatTimelineTime = (value: string) => {
    const viewedAt = new Date(value);
    const today = getStartOfDay(new Date());
    const viewedDay = getStartOfDay(viewedAt);

    if (viewedDay.getTime() === today.getTime()) {
      return viewedAt.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    return viewedAt.toLocaleDateString("zh-CN", {
      month: "numeric",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-full bg-white">
      <div className="px-6 pt-8 pb-0 lg:px-12">
        <h1
          className="text-[2rem] font-semibold tracking-tight"
          style={{ color: "#0f0f0f" }}
        >
          {t("settings:myViewsTitle")}
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
              background: "linear-gradient(180deg, #e8f1ff 0%, #d8e7ff 100%)",
            }}
          >
            <Clock3
              size={72}
              strokeWidth={1.5}
              style={{ color: "#2f69d9" }}
            />
          </div>
          <h2
            className="mt-8 text-2xl font-semibold"
            style={{ color: "#0f0f0f" }}
          >
            {t("settings:myViewsTitle")}
          </h2>
          <p
            className="mt-3 max-w-md text-sm leading-6"
            style={{ color: "#707070" }}
          >
            {activeType === "all"
              ? t("settings:noViews")
              : t("settings:noViewsForType")}
          </p>
        </div>
      ) : (
        <div className="px-4 py-8 lg:px-8">
          <div className="space-y-8">
            {groupedItems.map((group) => (
              <section key={group.key} className="relative">
                <div className="absolute bottom-0 left-0 top-0 hidden md:block">
                  <div className="grid h-full grid-cols-[52px_26px_minmax(0,1fr)] gap-3">
                    <div />
                    <div className="relative">
                      <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-[linear-gradient(180deg,rgba(232,238,248,0)_0%,rgba(232,238,248,1)_12%,rgba(232,238,248,1)_88%,rgba(232,238,248,0)_100%)]" />
                    </div>
                    <div />
                  </div>
                </div>

                <div className="sticky top-14 z-10 backdrop-blur-xs">
                  <div className="relative grid grid-cols-[32px_minmax(0,1fr)] gap-3 md:grid-cols-[52px_26px_minmax(0,1fr)] md:gap-3">
                    <div className="hidden md:flex items-center justify-end pr-2">
                      <span className="text-[13px] font-semibold tracking-[0.08em] text-[#52607a]">
                        {group.label}
                      </span>
                    </div>
                    <div className="relative" />
                    <div className="flex items-center md:hidden">
                      <span className="text-[13px] font-semibold tracking-[0.08em] text-[#52607a]">
                        {group.label}
                      </span>
                    </div>
                    <div className="hidden md:block" />
                  </div>
                </div>

                <div className="relative mt-2 space-y-4">
                  {group.items.map((item) => (
                    <div
                      key={`${item.content.id}-${item.last_viewed_at}`}
                      className="grid gap-4 md:grid-cols-[52px_26px_minmax(0,1fr)] md:gap-3"
                    >
                      <div className="hidden md:flex flex-col items-end pt-7">
                        <span className="text-xs font-semibold leading-none tracking-[0.08em] text-[#6c7890]">
                          {formatTimelineTime(item.last_viewed_at)}
                        </span>
                      </div>

                      <div className="relative hidden md:block">
                        <div className="absolute left-1/2 top-7 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-white bg-[#4d7df0] shadow-[0_0_0_4px_rgba(77,125,240,0.08)]" />
                      </div>

                      <div className="relative pl-10 md:pl-0">
                        <div className="absolute left-3 top-0 bottom-0 w-px -translate-x-1/2 bg-[linear-gradient(180deg,rgba(232,238,248,0)_0%,rgba(232,238,248,1)_14%,rgba(232,238,248,1)_86%,rgba(232,238,248,0)_100%)] md:hidden" />
                        <div className="absolute left-3 top-7 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-white bg-[#4d7df0] shadow-[0_0_0_4px_rgba(77,125,240,0.08)] md:hidden" />

                        <div className="rounded-[1.4rem] border border-[#e9edf5] bg-[linear-gradient(180deg,#ffffff_0%,#fbfcff_100%)] p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
                          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-[#70809d] md:hidden">
                            <Clock3 size={13} />
                            <span>{formatTimelineTime(item.last_viewed_at)}</span>
                          </div>

                          <div className="flex gap-4">
                            <div className="h-[84px] w-[148px] shrink-0 overflow-hidden rounded-xl bg-[#f5f5f5]">
                              <NavLink
                                to={contentDetailPath(item.content)}
                                className="block h-full w-full no-underline"
                              >
                                <img
                                  src={getStyledContentCardCover(
                                    item.content,
                                    siteConfig,
                                  )}
                                  alt={item.content.title}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              </NavLink>
                            </div>

                            <div className="min-w-0 flex-1">
                              <NavLink
                                to={contentDetailPath(item.content)}
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
                                className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm"
                                style={{ color: "#909090" }}
                              >
                                <span className="inline-flex items-center gap-1">
                                  <Eye size={13} />
                                  <span>
                                    {t("settings:viewCountSummary", {
                                      count: item.view_count,
                                    })}
                                  </span>
                                </span>
                                <span className="inline-flex items-center gap-1 md:hidden">
                                  <Clock3 size={13} />
                                  <span>
                                    {t("settings:lastViewedAtLabel", {
                                      date: new Date(
                                        item.last_viewed_at,
                                      ).toLocaleString("zh-CN", {
                                        month: "numeric",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      }),
                                    })}
                                  </span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
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
          : !hasNextPage && items.length > 0
            ? tc("common:noMoreContent")
            : ""}
      </div>
    </div>
  );
}

export default MyViews;
