"use client";

import { Building2, UserPlus, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslator } from "@/components/i18n/use-language";
import type { CoachClubSummary, CommunitySummary } from "@/types/swim";

type FriendshipRecord = {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: "PENDING" | "ACCEPTED" | "BLOCKED";
  requester: { id: string; name: string; imageUrl?: string | null };
  addressee: { id: string; name: string; imageUrl?: string | null };
};

const comparisonModes = [
  ["Past self", "Default", "Your current season against your own previous swims."],
  ["Age group", "Optional", "A same-age benchmark when enough private data exists."],
  ["Team", "Private", "Only inside coach clubs or communities you joined."],
  ["Percentile", "Anonymous", "Rank bands without exposing another swimmer's data."]
] as const;

export function CommunityHub() {
  const { t } = useTranslator();
  const [coachClubs, setCoachClubs] = useState<CoachClubSummary[]>([]);
  const [communities, setCommunities] = useState<CommunitySummary[]>([]);
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [coachClubCode, setCoachClubCode] = useState("");
  const [friendEmail, setFriendEmail] = useState("");
  const [friendships, setFriendships] = useState<FriendshipRecord[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/communities").then((response) => response.json()),
      fetch("/api/coach/clubs/join").then((response) => response.json()),
      fetch("/api/friends").then((response) => response.json())
    ])
      .then(([communityData, clubData, friendData]) => {
        setCommunities(communityData.communities ?? []);
        setCoachClubs(clubData.clubs ?? []);
        setFriendships(friendData.friendships ?? []);
        setStatus("");
      })
      .catch(() => setStatus(t("Could not load communities.")));
  }, [t]);

  async function createCommunity() {
    const response = await fetch("/api/communities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    const result = await response.json();

    if (response.ok) {
      setCommunities((current) => [result.community, ...current]);
      setStatus(t("Community created."));
      return;
    }

    setStatus(result.error ? t(result.error) : t("Sign in to create communities."));
  }

  async function joinCommunity() {
    const response = await fetch("/api/communities/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ joinCode })
    });
    const result = await response.json();

    if (response.ok) {
      setCommunities((current) => [result.community, ...current]);
      setStatus(t("Joined community."));
      return;
    }

    setStatus(result.error ? t(result.error) : t("Could not join community."));
  }

  async function joinCoachClub() {
    const response = await fetch("/api/coach/clubs/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ joinCode: coachClubCode })
    });
    const result = await response.json();

    if (response.ok) {
      setCoachClubs((current) => [result.club, ...current.filter((club) => club.id !== result.club.id)]);
      setCoachClubCode("");
      setStatus(`${t("Joined coach club")}: ${result.club.name}.`);
      return;
    }

    setStatus(result.error ? t(result.error) : t("Could not join coach club."));
  }

  async function inviteFriend() {
    const response = await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: friendEmail })
    });
    const result = await response.json();
    setStatus(response.ok ? t("Friend request sent.") : result.error ? t(result.error) : t("Could not send request."));
  }

  async function updateFriendship(friendshipId: string, action: "accept" | "block" | "remove") {
    const response = await fetch("/api/friends", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendshipId, action })
    });
    const result = await response.json();
    if (!response.ok) {
      setStatus(result.error ? t(result.error) : t("Could not update friend."));
      return;
    }
    if (action === "remove") {
      setFriendships((current) => current.filter((friendship) => friendship.id !== friendshipId));
      setStatus(t("Friend removed."));
      return;
    }
    setFriendships((current) => current.map((friendship) => friendship.id === friendshipId ? { ...friendship, status: result.friendship.status } : friendship));
    setStatus(action === "accept" ? t("Friend accepted.") : t("Friend blocked."));
  }

  return (
    <section className="stitch-panel min-w-0 p-4 lg:p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-stitch-cyan/10 text-stitch-cyan">
          <UsersRound aria-hidden className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-white">{t("Community")}</h2>
          <p className="text-sm text-white/70">{t("Create, join, invite, and compare")}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <input
            className="h-10 w-full rounded-md border border-white/15 bg-stitch-abyss px-3 text-sm text-white outline-none transition placeholder:text-white/45 focus:border-stitch-cyan"
            placeholder={t("Community name")}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <button
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-stitch-cyan px-3 text-sm font-semibold text-stitch-abyss transition hover:bg-white"
            type="button"
            onClick={createCommunity}
          >
            <UsersRound aria-hidden className="h-4 w-4" />
            {t("Create")}
          </button>
        </div>
        <div className="space-y-2">
          <input
            className="h-10 w-full rounded-md border border-white/15 bg-stitch-abyss px-3 text-sm text-white outline-none transition placeholder:text-white/45 focus:border-stitch-cyan"
            placeholder={t("Coach club code")}
            value={coachClubCode}
            onChange={(event) => setCoachClubCode(event.target.value)}
          />
          <button
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 text-sm font-semibold text-white transition hover:border-stitch-cyan hover:bg-white/15"
            type="button"
            onClick={joinCoachClub}
          >
            <Building2 aria-hidden className="h-4 w-4" />
            {t("Join club")}
          </button>
        </div>
        <div className="space-y-2">
          <input
            className="h-10 w-full rounded-md border border-white/15 bg-stitch-abyss px-3 text-sm text-white outline-none transition placeholder:text-white/45 focus:border-stitch-cyan"
            placeholder={t("Join code")}
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value)}
          />
          <button
            className="h-10 w-full rounded-md border border-white/20 bg-white/10 px-3 text-sm font-semibold text-white transition hover:border-stitch-cyan hover:bg-white/15"
            type="button"
            onClick={joinCommunity}
          >
            {t("Join")}
          </button>
        </div>
        <div className="space-y-2">
          <input
            className="h-10 w-full rounded-md border border-white/15 bg-stitch-abyss px-3 text-sm text-white outline-none transition placeholder:text-white/45 focus:border-stitch-cyan"
            placeholder="friend@email.com"
            value={friendEmail}
            onChange={(event) => setFriendEmail(event.target.value)}
          />
          <button
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 text-sm font-semibold text-white transition hover:border-stitch-cyan hover:bg-white/15"
            type="button"
            onClick={inviteFriend}
          >
            <UserPlus aria-hidden className="h-4 w-4" />
            {t("Invite")}
          </button>
        </div>
      </div>

      <p className="mt-3 text-sm text-white/72">{status}</p>
      <div className="mt-5 rounded-lg border border-white/12 bg-white/[0.07] p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="font-semibold text-white">{t("Comparison modes")}</h3>
            <p className="text-sm text-white/62">{t("Self-improvement stays the default. Team comparison is private and opt-in.")}</p>
          </div>
          <span className="rounded-full border border-aqua-200/20 bg-aqua-300/10 px-3 py-1 text-xs font-semibold text-aqua-100">{t("healthy defaults")}</span>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {comparisonModes.map(([title, badge, body]) => (
            <article className="rounded-md border border-white/10 bg-stitch-abyss/55 p-3" key={title}>
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-white">{t(title)}</h4>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-aqua-100">{t(badge)}</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-white/58">{t(body)}</p>
            </article>
          ))}
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {communities.length === 0 && coachClubs.length === 0 && <div className="rounded-lg border border-dashed border-white/20 bg-white/5 p-6 text-center text-sm text-white/72 sm:col-span-2">{t("No communities or coach clubs yet.")}</div>}
        {communities.slice(0, 4).map((community) => (
          <div className="rounded-lg border border-white/15 bg-white/10 p-3" key={community.id}>
            <div className="font-semibold text-white">{community.name}</div>
            <div className="mt-1 text-sm text-white/72">
              {community.memberCount} {t("members")}{community.joinCode ? ` · ${t("code")} ${community.joinCode}` : ""}
            </div>
          </div>
        ))}
        {coachClubs.slice(0, 4).map((club) => (
          <div className="rounded-lg border border-aqua-200/20 bg-aqua-300/10 p-3" key={club.id}>
            <div className="flex items-center gap-2 font-semibold text-white">
              <Building2 aria-hidden className="h-4 w-4 text-aqua-100" />
              {club.name}
            </div>
            <div className="mt-1 text-sm text-white/72">{club.memberCount} {t("swimmers")} · {t("coach club")}</div>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-lg border border-white/12 bg-white/[0.07] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-white">{t("Friends")}</h3>
            <p className="text-sm text-white/62">{t("Accept, block, or remove connections.")}</p>
          </div>
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 font-mono text-xs text-aqua-100">{friendships.length}</span>
        </div>
        <div className="mt-4 space-y-2">
          {friendships.length === 0 && <div className="rounded-md border border-dashed border-white/12 p-4 text-center text-sm text-white/60">{t("No friend requests yet.")}</div>}
          {friendships.slice(0, 6).map((friendship) => {
            return (
              <article className="flex flex-col gap-3 rounded-md border border-white/10 bg-stitch-abyss/55 p-3 sm:flex-row sm:items-center sm:justify-between" key={friendship.id}>
                <div>
                  <p className="font-semibold text-white">{friendship.requester.name} / {friendship.addressee.name}</p>
                  <p className="text-xs text-white/50">{friendship.status === "ACCEPTED" ? t("Accepted") : friendship.status === "PENDING" ? t("Pending") : t("Blocked")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {friendship.status === "PENDING" && <button className="h-8 rounded-md bg-stitch-cyan px-3 text-xs font-semibold text-stitch-abyss" type="button" onClick={() => updateFriendship(friendship.id, "accept")}>{t("Accept")}</button>}
                  <button className="h-8 rounded-md border border-white/15 bg-white/10 px-3 text-xs font-semibold text-white transition hover:border-stitch-cyan" type="button" onClick={() => updateFriendship(friendship.id, "remove")}>{t("Remove")}</button>
                  {friendship.status !== "BLOCKED" && <button className="h-8 rounded-md border border-white/15 bg-white/10 px-3 text-xs font-semibold text-white transition hover:border-rose-300" type="button" onClick={() => updateFriendship(friendship.id, "block")}>{t("Block")}</button>}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
