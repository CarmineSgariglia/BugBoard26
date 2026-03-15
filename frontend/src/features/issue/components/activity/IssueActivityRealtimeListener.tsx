import { useEffect, useEffectEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { getAccessToken } from "@shared/api/core/client";
import { refreshApi } from "@shared/api/modules/auth";
import { getIssueUpdatesStreamUrl } from "@shared/api/modules/issues";
import type { IssueUpdate } from "@shared/api/types/issues";
import { getLatestIssueUpdateId, upsertIssueUpdates } from "@shared/lib/issueUpdatesRealtime";
import { createSseParser } from "@shared/lib/notificationsRealtime";
import { useAuth } from "@shared/providers";

const STREAM_RETRY_DELAYS_MS = [1000, 2000, 5000, 10000, 20000];

type Props = {
  issueId: number;
};

export function IssueActivityRealtimeListener({ issueId }: Props) {
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();

  const handleIssueEventCreated = useEffectEvent((update: IssueUpdate) => {
    queryClient.setQueryData<IssueUpdate[]>(["issue", issueId, "updates"], (current = []) =>
      upsertIssueUpdates(current, update),
    );
  });

  useEffect(() => {
    if (!user || !issueId) {
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

      const latestUpdateId = getLatestIssueUpdateId(
        queryClient.getQueryData<IssueUpdate[]>(["issue", issueId, "updates"]) ?? [],
      );

      const headers = new Headers({
        Authorization: `Bearer ${token}`,
      });

      if (latestUpdateId > 0) {
        headers.set("Last-Event-ID", String(latestUpdateId));
      }

      abortController?.abort();
      abortController = new AbortController();

      let response: Response;

      try {
        response = await fetch(getIssueUpdatesStreamUrl(issueId), {
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
        if (message.event !== "issue.event.created") {
          return;
        }

        try {
          handleIssueEventCreated(JSON.parse(message.data) as IssueUpdate);
        } catch (error) {
          console.error("Failed to parse issue activity stream message", error);
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
  }, [issueId, queryClient, refreshUser, user]);

  return null;
}
