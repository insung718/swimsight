"use client";

import { UserPlus, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import type { CommunitySummary } from "@/types/swim";

export function CommunityHub() {
  const [communities, setCommunities] = useState<CommunitySummary[]>([]);
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [friendEmail, setFriendEmail] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch("/api/communities")
      .then((response) => response.json())
      .then((data) => {
        setCommunities(data.communities ?? []);
        setStatus("");
      })
      .catch(() => setStatus("Could not load communities."));
  }, []);

  async function createCommunity() {
    const response = await fetch("/api/communities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    const result = await response.json();

    if (response.ok) {
      setCommunities((current) => [result.community, ...current]);
      setStatus("Community created.");
      return;
    }

    setStatus(result.error ?? "Sign in to create communities.");
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
      setStatus("Joined community.");
      return;
    }

    setStatus(result.error ?? "Could not join community.");
  }

  async function inviteFriend() {
    const response = await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: friendEmail })
    });
    const result = await response.json();
    setStatus(response.ok ? "Friend request sent." : result.error ?? "Could not send request.");
  }

  return (
    <section className="stitch-panel min-w-0 p-4 lg:p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-stitch-cyan/10 text-stitch-cyan">
          <UsersRound aria-hidden className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-white">Community</h2>
          <p className="text-sm text-white/70">Create, join, invite, and compare</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-2">
          <input
            className="h-10 w-full rounded-md border border-white/15 bg-stitch-abyss px-3 text-sm text-white outline-none transition placeholder:text-white/45 focus:border-stitch-cyan"
            placeholder="Community name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <button
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-stitch-cyan px-3 text-sm font-semibold text-stitch-abyss transition hover:bg-white"
            type="button"
            onClick={createCommunity}
          >
            <UsersRound aria-hidden className="h-4 w-4" />
            Create
          </button>
        </div>
        <div className="space-y-2">
          <input
            className="h-10 w-full rounded-md border border-white/15 bg-stitch-abyss px-3 text-sm text-white outline-none transition placeholder:text-white/45 focus:border-stitch-cyan"
            placeholder="Join code"
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value)}
          />
          <button
            className="h-10 w-full rounded-md border border-white/20 bg-white/10 px-3 text-sm font-semibold text-white transition hover:border-stitch-cyan hover:bg-white/15"
            type="button"
            onClick={joinCommunity}
          >
            Join
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
            Invite
          </button>
        </div>
      </div>

      <p className="mt-3 text-sm text-white/72">{status}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {communities.length === 0 && <div className="rounded-lg border border-dashed border-white/20 bg-white/5 p-6 text-center text-sm text-white/72 sm:col-span-2">No communities yet.</div>}
        {communities.slice(0, 4).map((community) => (
          <div className="rounded-lg border border-white/15 bg-white/10 p-3" key={community.id}>
            <div className="font-semibold text-white">{community.name}</div>
            <div className="mt-1 text-sm text-white/72">
              {community.memberCount} members{community.joinCode ? ` · code ${community.joinCode}` : ""}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
