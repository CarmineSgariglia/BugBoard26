import { useCallback, useEffect, useEffectEvent, useMemo, useRef } from "react";
import type { InfiniteData } from "@tanstack/react-query";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { matchPath, useLocation, useNavigate } from "react-router-dom";

import {
  deleteNotificationApi,
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
import type { NotificationItem, NotificationsPage } from "@shared/api/types/notifications";
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
import { isRequestAbortError } from "@shared/api";
import type { Project } from "@shared/api/types/projects";
import type { Issue } from "@shared/api/types/issues";
import { useNotificationsStream } from "@features/notification/lib/useNotificationsStream";

type RouteTarget =
  | { kind: "issue"; issueId: number }
  | { kind: "project"; projectId: number }
  | { kind: "none" };

function parsePositiveInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getRouteContext(pathname: string): {
  routeProjectId: number | null;
  routeTarget: RouteTarget;
} {
  const issueMatch = matchPath("/projects/:projectId/issues/:issueId", pathname);
  if (issueMatch) {
    const routeProjectId = parsePositiveInt(issueMatch.params.projectId);
    const issueId = parsePositiveInt(issueMatch.params.issueId);

    return {
      routeProjectId,
      routeTarget: issueId != null ? { kind: "issue", issueId } : { kind: "none" },
    };
  }

  const projectMatch = matchPath("/projects/:projectId/issues", pathname);
  if (projectMatch) {
    const routeProjectId = parsePositiveInt(projectMatch.params.projectId);

    return {
      routeProjectId,
      routeTarget:
        routeProjectId != null ? { kind: "project", projectId: routeProjectId } : { kind: "none" },
    };
  }

  return {
    routeProjectId: null,
    routeTarget: { kind: "none" },
  };
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
  return [
    ...(currentIssues ?? []).filter((issue) => issue.issueId !== nextIssue.issueId),
    nextIssue,
  ];
}

export function NotificationsRealtimeListener() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();
  const { pushToast } = useToast();
  const pendingReadIdsRef = useRef(new Set<number>());
  const projectHydrationControllersRef = useRef(new Map<number, AbortController>());
  const issueHydrationControllersRef = useRef(new Map<number, AbortController>());

  const { routeProjectId, routeTarget } = useMemo(
    () => getRouteContext(location.pathname),
    [location.pathname],
  );

  const { data, isSuccess } = useInfiniteQuery({
    queryKey: notificationsQueryKey,
    queryFn: ({ pageParam, signal }) =>
      listNotificationsApi({ limit: notificationsPageSize, before: pageParam }, { signal }),
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

  const hydrateAddedProjectInHome = useCallback(async (projectId: number) => {
    projectHydrationControllersRef.current.get(projectId)?.abort();
    const controller = new AbortController();
    projectHydrationControllersRef.current.set(projectId, controller);

    try {
      const project = await getProjectApi(projectId, { signal: controller.signal });
      const normalizedProject = {
        ...project,
        authorProfileImg: resolveMediaUrl(project.authorProfileImg || undefined),
      } satisfies Project;

      queryClient.setQueryData<Project[]>(["projects"], (currentProjects) =>
        mergeProjectIntoHomeProjects(currentProjects, normalizedProject),
      );
    } catch (error) {
      if (isRequestAbortError(error)) {
        return;
      }
      console.error("Failed to hydrate added project in home cache", error);
    } finally {
      if (projectHydrationControllersRef.current.get(projectId) === controller) {
        projectHydrationControllersRef.current.delete(projectId);
      }
    }
  }, [queryClient]);

  const hydrateAddedIssueInProject = useCallback(async (projectId: number, issueId: number) => {
    issueHydrationControllersRef.current.get(issueId)?.abort();
    const controller = new AbortController();
    issueHydrationControllersRef.current.set(issueId, controller);

    try {
      const issue = await getIssueApi(issueId, { signal: controller.signal });

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
      if (isRequestAbortError(error)) {
        return;
      }
      console.error("Failed to hydrate added issue in project cache", error);
    } finally {
      if (issueHydrationControllersRef.current.get(issueId) === controller) {
        issueHydrationControllersRef.current.delete(issueId);
      }
    }
  }, [queryClient]);

  const handleNotificationCreated = useCallback((notification: NotificationItem) => {
    if (notification.projectId != null) {
      if (notification.type === "PROJECT_ASSIGNED") {
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
  }, [
    deleteMutation,
    hydrateAddedIssueInProject,
    hydrateAddedProjectInHome,
    navigate,
    pushToast,
    queryClient,
    routeProjectId,
    routeTarget,
  ]);

  useEffect(() => {
    notifications.forEach((notification) => {
      markNotificationAsRead(notification);
    });
  }, [notifications, routeTarget]);

  useEffect(() => {
    if (!user) {
      queryClient.removeQueries({ queryKey: notificationsQueryKey });
    }

    const projectHydrationControllers = projectHydrationControllersRef.current;
    const issueHydrationControllers = issueHydrationControllersRef.current;

    return () => {
      projectHydrationControllers.forEach((controller) => controller.abort());
      issueHydrationControllers.forEach((controller) => controller.abort());
      projectHydrationControllers.clear();
      issueHydrationControllers.clear();
    };
  }, [queryClient, user]);

  useNotificationsStream({
    enabled: Boolean(user) && isSuccess,
    userId: user?.userId ?? null,
    queryClient,
    refreshUser,
    onNotificationCreated: handleNotificationCreated,
  });

  return null;
}
