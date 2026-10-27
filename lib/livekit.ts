import type { RemoteTrack, Room } from "livekit-client";
import { z } from "zod";

/** A remote video track that can be attached to a <video> element and used as a texture. */
export type LiveVideoTrack = RemoteTrack;

export interface LiveFeedHandlers {
  /** Called with the current video track, or null when it goes away. */
  onVideoTrack: (track: LiveVideoTrack | null) => void;
  onDisconnected?: () => void;
}

export interface LiveFeedConnection {
  room: Room;
  disconnect: () => void;
}

const tokenResponseSchema = z.object({ token: z.string().min(1) });

export function isLiveKitConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_LIVEKIT_URL &&
      process.env.NEXT_PUBLIC_LIVEKIT_TOKEN_ENDPOINT,
  );
}

async function fetchViewerToken(endpoint: string, slug: string): Promise<string> {
  // The endpoint is expected to accept ?room=<name> and answer { "token": "..." }.
  const url = new URL(endpoint, window.location.origin);
  url.searchParams.set("room", `tour-${slug}`);
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Token endpoint responded ${response.status}`);
  return tokenResponseSchema.parse(await response.json()).token;
}

/**
 * Connects to the LiveKit room for a destination as a view-only participant.
 * Returns null when LiveKit is not configured so the UI can show its placeholder.
 * Throws on network/token failures; callers should show an error state.
 * livekit-client is imported dynamically to keep it out of the main bundle and SSR.
 */
export async function connectLiveFeed(
  slug: string,
  handlers: LiveFeedHandlers,
): Promise<LiveFeedConnection | null> {
  const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  const tokenEndpoint = process.env.NEXT_PUBLIC_LIVEKIT_TOKEN_ENDPOINT;
  if (!serverUrl || !tokenEndpoint) return null;

  const [{ Room, RoomEvent, Track }, token] = await Promise.all([
    import("livekit-client"),
    fetchViewerToken(tokenEndpoint, slug),
  ]);

  const room = new Room({ adaptiveStream: true, dynacast: false });
  let currentTrack: LiveVideoTrack | null = null;

  const setTrack = (track: LiveVideoTrack | null): void => {
    currentTrack = track;
    handlers.onVideoTrack(track);
  };

  room
    .on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Video) setTrack(track);
    })
    .on(RoomEvent.TrackUnsubscribed, (track) => {
      if (track === currentTrack) setTrack(null);
    })
    .on(RoomEvent.Disconnected, () => {
      setTrack(null);
      handlers.onDisconnected?.();
    });

  await room.connect(serverUrl, token);

  // Pick up a stream that was already live before we joined.
  for (const participant of room.remoteParticipants.values()) {
    for (const publication of participant.trackPublications.values()) {
      const track = publication.track;
      if (track && track.kind === Track.Kind.Video) {
        setTrack(track);
        break;
      }
    }
  }

  return {
    room,
    disconnect: () => {
      room.removeAllListeners();
      void room.disconnect();
      currentTrack = null;
    },
  };
}
