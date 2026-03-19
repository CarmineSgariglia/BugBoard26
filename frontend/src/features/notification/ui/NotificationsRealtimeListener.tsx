import { useEffect, useEffectEvent, useMemo, useRef } from "react";
import type { InfiniteData } from "@tanstack/react-query";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { matchPath, useLocation, useNavigate } from "react-router-dom";

import { getAccessToken } from "@shared/api/core/client";
import { refreshApi } from "@features/auth/api";
import {
  deleteNotificationApi,
  getNotificationsStreamUrl,
  listNotificationsApi,
  notificationsPageSize,
  notificationsQueryKey,
  readNotificationApi,
} from "@features/notification/api";
import {
  flattenNotificationsPages,
  getNotificationDescription,
  getNotificationTargetKind,
  getNotificationTitle,
  prependNotificationToInfiniteData,
  updateNotificationsInfiniteData,
} from "@features/notification/lib/notifications";
import { getLatestNotificationId } from "@features/notification/lib/notificationsRealtime";
import type { NotificationItem, NotificationsPage } from "@shared/api/types/notifications";
import { createSseParser } from "@shared/lib/sse";
import { useAuth } from "@features/auth";
import { useToast } from "@shared/providers";
import { consumeOwnProjectRemovalNotificationSuppression } from "@features/project/lib/notificationSuppression";
import {
  invalidateProjectAccessQueries,
  revokeProjectAccess,
} from "@features/project/lib/accessRevocation";
import { getProjectApi } from "@features/project/api";
import { getIssueApi } from "@features/issue/api";
import { resolveMediaUrl } from "@shared/api/core/media";
import type { Project } from "@shared/api/types/projects";
import type { Issue } from "@shared/api/types/issues";

const STREAM_RETRY_DELAYS_MS = [1000, 2000, 5000, 10000, 20000];

type RouteTarget =
  | { kind: "issue"; issueId: number }
  | { kind: "project"; projectId: number }
  | { kind: "none" };

function parsePositiveInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getRouteTarget(pathname: string): RouteTarget {
  const issueMatch = matchPath("/projects/:projectId/issues/:issueId", pathname);
  if (issueMatch) {
    const issueId = parsePositiveInt(issueMatch.params.issueId);
    if (issueId != null) {
      return { kind: "issue", issueId };
    }
  }

  const projectMatch = matchPath("/projects/:projectId/issues", pathname);
  if (projectMatch) {
    const projectId = parsePositiveInt(projectMatch.params.projectId);
    if (projectId != null) {
      return { kind: "project", projectId };
    }
  }

  return { kind: "none" };
}

function getRouteProjectId(pathname: string): number | null {
  const issueMatch = matchPath("/projects/:projectId/issues/:issueId", pathname);
  if (issueMatch) {
    return parsePositiveInt(issueMatch.params.projectId);
  }

  const projectMatch = matchPath("/projects/:projectId/issues", pathname);
  if (projectMatch) {
    return parsePositiveInt(projectMatch.params.projectId);
  }

  return null;
}

function matchesRouteTarget(notification: NotificationItem, routeTarget: RouteTarget): boolean {
  if (routeTarget.kind === "issue") {
    return notification.issueId === routeTarget.issueId;
  }

  if (routeTarget.kind === "project") {
    return (
      getNotificationTargetKind(notification.type) === "project" &&
      notification.projectId === routeTarget.projectId
    );
  }

  return false;
}

function shouldSilenceNotification(notification: NotificationItem, routeTarget: RouteTarget): boolean {
  return matchesRouteTarget(notification, routeTarget);
}

function mergeProjectIntoHomeProjects(
  currentProjects: Project[] | undefined,
  nextProject: Project,
): Project[] {
  const merged = [
    nextProject,
    ...(currentProjects ?? []).filter((project) => project.projectId !== nextProject.projectId),
  ];

  return merged.sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

function mergeIssueIntoProjectIssues(
  currentIssues: Issue[] | undefined,
  nextIssue: Issue,
): Issue[] {
  return [...(currentIssues ?? []).filter((issue) => issue.issueId !== nextIssue.issueId), nextIssue];
}

export function NotificationsRealtimeListener() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();
  const { pushToast } = useToast();
  const pendingReadIdsRef = useRef(new Set<number>());

  const routeTarget = useMemo(() => getRouteTarget(location.pathname), [location.pathname]);
  const routeProjectId = useMemo(() => getRouteProjectId(location.pathname), [location.pathname]);

  const { data, isSuccess } = useInfiniteQuery({
    queryKey: notificationsQueryKey,
    queryFn: ({ pageParam }) =>
      listNotificationsApi({ limit: notificationsPageSize, before: pageParam }),
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : null),
    enabled: Boolean(user),
    staleTime: 30000,
  });
  const notifications = useMemo(() => flattenNotificationsPages(data), [data]);

  const readMutation = useMutation({
    mutationFn: (notifyUserId: number) => readNotificationApi(notifyUserId),
    onMutate: async (notifyUserId) => {
      pendingReadIdsRef.current.add(notifyUserId);
      await queryClient.cancelQueries({ queryKey: notificationsQueryKey });
      queryClient.setQueryData(
        notificationsQueryKey,
        (current: InfiniteData<NotificationsPage> | undefined) =>
          updateNotificationsInfiniteData(current, (item) =>
            item.notifyUserId === notifyUserId
              ? {
                  ...item,
                  isRead: true,
                  readAt: item.readAt ?? new Date().toISOString(),
                }
              : item,
          ),
      );
    },
    onError: (_error, notifyUserId) => {
      queryClient.setQueryData(
        notificationsQueryKey,
        (current: InfiniteData<NotificationsPage> | undefined) =>
          updateNotificationsInfiniteData(current, (item) =>
            item.notifyUserId === notifyUserId ? { ...item, isRead: false, readAt: null } : item,
          ),
      );
    },
    onSettled: (_data, _error, notifyUserId) => {
      pendingReadIdsRef.current.delete(notifyUserId);
      void queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (notifyUserId: number) => deleteNotificationApi(notifyUserId),
    onMutate: async (notifyUserId) => {
      await queryClient.cancelQueries({ queryKey: notificationsQueryKey });
      queryClient.setQueryData(
        notificationsQueryKey,
        (current: InfiniteData<NotificationsPage> | undefined) =>
          updateNotificationsInfiniteData(current, (item) =>
            item.notifyUserId === notifyUserId ? null : item,
          ),
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
    },
  });

  const markNotificationAsRead = useEffectEvent((notification: NotificationItem) => {
    if (
      routeTarget.kind === "none" ||
      notification.isRead ||
      !matchesRouteTarget(notification, routeTarget) ||
      pendingReadIdsRef.current.has(notification.notifyUserId)
    ) {
      return;
    }

    readMutation.mutate(notification.notifyUserId);
  });

  const hydrateAddedProjectInHome = useEffectEvent(async (projectId: number) => {
    try {
      const project = await getProjectApi(projectId);
      const normalizedProject = {
        ...project,
        authorProfileImg: resolveMediaUrl(project.authorProfileImg || undefined),
      } satisfies Project;

      queryClient.setQueryData<Project[]>(["projects"], (currentProjects) =>
        mergeProjectIntoHomeProjects(currentProjects, normalizedProject),
      );
    } catch (error) {
      console.error("Failed to hydrate added project in home cache", error);
    }
  });

  const hydrateAddedIssueInProject = useEffectEvent(async (projectId: number, issueId: number) => {
    try {
      const issue = await getIssueApi(issueId);

      queryClient.setQueriesData<Issue[]>(
        {
          predicate: (query) =>
            Array.isArray(query.queryKey) &&
            query.queryKey[0] === "project" &&
            String(query.queryKey[1]) === String(projectId) &&
            query.queryKey[2] === "issues",
        },
        (currentIssues) => mergeIssueIntoProjectIssues(currentIssues, issue),
      );
      queryClient.setQueryData(["issue", issueId], issue);
      queryClient.setQueryData(["issue", String(issueId)], issue);
    } catch (error) {
      console.error("Failed to hydrate added issue in project cache", error);
    }
  });

  const handleNotificationCreated = useEffectEvent((notification: NotificationItem) => {
    if (notification.projectId != null) {
      if (notification.type === "PROJECT_ADDED") {
        void hydrateAddedProjectInHome(notification.projectId);
      }

      if (notification.type === "ISSUE_ADDED" && notification.issueId != null) {
        void hydrateAddedIssueInProject(notification.projectId, notification.issueId);
      }

      if (notification.type === "PROJECT_REMOVED") {
        queryClient.setQueryData(
          notificationsQueryKey,
          (current: InfiniteData<NotificationsPage> | undefined) =>
            updateNotificationsInfiniteData(current, (item) =>
              item.projectId === notification.projectId &&
              item.type === "PROJECT_REMOVED"
                ? null
                : item,
            ),
        );
      }

      if (notification.type === "PROJECT_UNASSIGNED" || notification.type === "PROJECT_REMOVED") {
        revokeProjectAccess(queryClient, notification.projectId);

        if (routeProjectId === notification.projectId) {
          navigate("/projects", { replace: true });
        }
      }
    } else if (notification.type === "PROJECT_REMOVED" && routeProjectId != null) {
      invalidateProjectAccessQueries(
        queryClient,
        routeProjectId,
        routeTarget.kind === "issue" ? routeTarget.issueId : null,
      );
    }

    if (
      notification.type === "PROJECT_REMOVED" &&
      notification.projectId != null &&
      consumeOwnProjectRemovalNotificationSuppression(notification.projectId)
    ) {
      deleteMutation.mutate(notification.notifyUserId);
      return;
    }

    if (shouldSilenceNotification(notification, routeTarget)) {
      deleteMutation.mutate(notification.notifyUserId);
      return;
    }

    queryClient.setQueryData(
      notificationsQueryKey,
      (current: InfiniteData<NotificationsPage> | undefined) =>
        prependNotificationToInfiniteData(current, notification),
    );

    pushToast({
      title: getNotificationTitle(notification.type),
      description: getNotificationDescription(notification),
    });
  });

  useEffect(() => {
    notifications.forEach((notification) => {
      markNotificationAsRead(notification);
    });
  }, [notifications, routeTarget]);

  useEffect(() => {
    if (!user) {
      queryClient.removeQueries({ queryKey: notificationsQueryKey });
      return;
    }

    if (!isSuccess) {
      return;
    }

    let stopped = false;
    let retryIndex = 0;
    let reconnectTimer: number | null = null;
    let abortController: AbortController | null = null;

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const resolveStreamToken = async (): Promise<string | null> => {
      const currentToken = getAccessToken();
      if (currentToken) {
        return currentToken;
      }

      try {
        return await refreshApi();
      } catch {
        await refreshUser();
        return null;
      }
    };

    const scheduleReconnect = (connect: () => Promise<void>) => {
      if (stopped) {
        return;
      }

      const delayIndex = Math.min(retryIndex, STREAM_RETRY_DELAYS_MS.length - 1);
      const baseDelay = STREAM_RETRY_DELAYS_MS[delayIndex];
      retryIndex = Math.min(retryIndex + 1, STREAM_RETRY_DELAYS_MS.length - 1);
      const jitter = Math.floor(Math.random() * 250);
      reconnectTimer = window.setTimeout(() => {
        void connect();
      }, baseDelay + jitter);
    };

    const connect = async (allowAuthRetry = true) => {
      if (stopped) {
        return;
      }

      clearReconnectTimer();

      const token = await resolveStreamToken();
      if (!token || stopped) {
        return;
      }

      const latestNotificationId = getLatestNotificationId(
        flattenNotificationsPages(
          queryClient.getQueryData<InfiniteData<NotificationsPage>>(notificationsQueryKey),
        ),
      );

      const headers = new Headers({
        Authorization: `Bearer ${token}`,
      });

      if (latestNotificationId > 0) {
        headers.set("Last-Event-ID", String(latestNotificationId));
      }

      abortController?.abort();
      abortController = new AbortController();

      let response: Response;

      try {
        response = await fetch(getNotificationsStreamUrl(), {
          method: "GET",
          headers,
          cache: "no-store",
          credentials: "include",
          signal: abortController.signal,
        });
      } catch {
        if (!stopped && !abortController.signal.aborted) {
          scheduleReconnect(() => connect());
        }
        return;
      }

      if (response.status === 401 && allowAuthRetry) {
        try {
          await refreshApi();
        } catch {
          await refreshUser();
          return;
        }
        await connect(false);
        return;
      }

      if (!response.ok || !response.body) {
        scheduleReconnect(() => connect());
        return;
      }

      retryIndex = 0;

      const parser = createSseParser((message) => {
        if (message.event !== "notification.created") {
          return;
        }

        try {
          handleNotificationCreated(JSON.parse(message.data) as NotificationItem);
        } catch (error) {
          console.error("Failed to parse notification stream message", error);
        }
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (!stopped) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          if (value) {
            parser(decoder.decode(value, { stream: true }));
          }
        }
        parser(decoder.decode());
      } catch {
        if (stopped || abortController.signal.aborted) {
          return;
        }
      }

      if (!stopped && !abortController.signal.aborted) {
        scheduleReconnect(() => connect());
      }
    };

    void connect();

    return () => {
      stopped = true;
      clearReconnectTimer();
      abortController?.abort();
    };
  }, [isSuccess, navigate, queryClient, refreshUser, routeProjectId, user]);

  return null;
}
