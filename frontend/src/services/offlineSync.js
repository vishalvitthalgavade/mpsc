import { openDB } from "idb";

const DB_NAME = "gate-cse-tracker";
const DB_VERSION = 1;
const STORE_NAME = "pending-sessions";

const API_URL = import.meta.env.VITE_API_URL || "";

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      const store = db.createObjectStore(STORE_NAME, {
        keyPath: "id",
      });

      store.createIndex("userId", "userId");
      store.createIndex("status", "status");
    }
  },
});

export async function saveOfflineSession(session) {
  const db = await dbPromise;

  await db.put(STORE_NAME, {
    ...session,
    status: "pending",
    savedAt: new Date().toISOString(),
  });

  console.log("Study session saved offline");
}

export async function getPendingSessions(userId) {
  const db = await dbPromise;

  const sessions = await db.getAllFromIndex(
    STORE_NAME,
    "userId",
    userId
  );

  return sessions.filter(
    (session) => session.status === "pending"
  );
}

export async function removePendingSession(id) {
  const db = await dbPromise;

  await db.delete(STORE_NAME, id);
}

export async function syncPendingSessions(
  userId,
  accessToken
) {
  if (!navigator.onLine) {
    return {
      success: false,
      synced: 0,
      reason: "offline",
    };
  }

  if (!userId || !accessToken) {
    return {
      success: false,
      synced: 0,
      reason: "not-authenticated",
    };
  }

  const pendingSessions =
    await getPendingSessions(userId);

  if (pendingSessions.length === 0) {
    return {
      success: true,
      synced: 0,
      reason: "nothing-to-sync",
    };
  }

  let synced = 0;

  for (const session of pendingSessions) {
    try {
      const response = await fetch(
        `${API_URL}/api/sessions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          credentials: "include",
          body: JSON.stringify({
            clientId: session.clientId,
            subject: session.subject,
            topic: session.topic,
            duration: session.duration,
            type: session.type,
            startedAt: session.startedAt,
            completedAt: session.completedAt,
          }),
        }
      );

      if (response.ok) {
        await removePendingSession(session.id);
        synced++;

        console.log(
          "Offline session synced:",
          session.clientId
        );
      } else if (response.status === 401) {
        console.log(
          "Authentication expired. Session remains offline."
        );

        break;
      } else {
        console.error(
          "Failed to sync session:",
          session.clientId
        );
      }
    } catch (error) {
      console.error(
        "Network error while syncing session:",
        error
      );

      break;
    }
  }

  return {
    success: true,
    synced,
  };
}

export function setupOnlineSync(
  userId,
  accessToken,
  onSync
) {
  async function handleOnline() {
    console.log(
      "Internet connection restored. Syncing..."
    );

    const result = await syncPendingSessions(
      userId,
      accessToken
    );

    if (onSync) {
      onSync(result);
    }
  }

  window.addEventListener(
    "online",
    handleOnline
  );

  return () => {
    window.removeEventListener(
      "online",
      handleOnline
    );
  };
}