import { http, HttpResponse } from "msw";

const defaultUser = {
  userId: 7,
  username: "dev",
  email: "dev@test.it",
  firstName: "Dev",
  lastName: "User",
  isAdmin: false,
  profileImg: null,
  active: true,
};

export const handlers = [
  http.get("/api/auth/csrf", () => HttpResponse.json({ ok: true })),
  http.get("/api/auth/me", () => HttpResponse.json(defaultUser)),
  http.post("/api/auth/refresh", () =>
    HttpResponse.json({ detail: "Unauthorized" }, { status: 401 }),
  ),
  http.get("/api/notifications", () => HttpResponse.json([])),
  http.post("/api/notifications/:notifyUserId/read", async ({ params }) =>
    HttpResponse.json({
      notifyUserId: Number(params.notifyUserId),
      isRead: true,
    }),
  ),
  http.delete("/api/notifications/:notifyUserId", () => new HttpResponse(null, { status: 204 })),
  http.get("/api/issues/:issueId", async ({ params }) =>
    HttpResponse.json({
      issueId: Number(params.issueId),
      projectId: 1,
    }),
  ),
];
