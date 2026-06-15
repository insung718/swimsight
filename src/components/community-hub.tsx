"use client";

import { UserPlus, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import type { CommunitySummary } from "@/types/swim";

export function CommunityHub() {
  const [communities, setCommunities] = useState<CommunitySummary[]>([]);
  const [name, setName] = useState("My swim crew");
  const [joinCode, setJoinCode] = useState("");
  const [friendEmail, setFriendEmail] = useState("");
  const [status, setStatus] = useState("Create a community or invite friends after sign-in.");

  useEffect(() => {
    fetch("/api/communities")
      .then((response) => response.json())
      .then((data) => {
        setCommunities(data.communities ?? []);
        setStatus(data.mode === "account" ? "Community data synced." : "Demo community shown.");
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
    <section className="min-w-0 rounded-lg border border-navy-100 bg-white p-4 shadow-panel dark:border-white/10 dark:bg-white/[0.04] lg:p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-aqua-50 text-aqua-600 dark:bg-aqua-400/10 dark:text-aqua-100">
          <UsersRound aria-hidden className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-navy-950 dark:text-white">Community</h2>
          <p className="text-sm text-navy-500 dark:text-navy-100">Create, join, invite, and compare</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-2">
          <input
            className="h-10 w-full rounded-md border border-navy-100 bg-white px-3 text-sm text-navy-950 outline-none focus:border-aqua-400 dark:border-white/10 dark:bg-navy-950 dark:text-white"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <button
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-navy-900 px-3 text-sm font-semibold text-white transition hover:bg-navy-700 dark:bg-aqua-400 dark:text-navy-950"
            type="button"
            onClick={createCommunity}
          >
            <UsersRound aria-hidden className="h-4 w-4" />
            Create
          </button>
        </div>
        <div className="space-y-2">
          <input
            className="h-10 w-full rounded-md border border-navy-100 bg-white px-3 text-sm text-navy-950 outline-none focus:border-aqua-400 dark:border-white/10 dark:bg-navy-950 dark:text-white"
            placeholder="Join code"
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value)}
          />
          <button
            className="h-10 w-full rounded-md border border-navy-100 bg-white px-3 text-sm font-semibold text-navy-700 transition hover:border-aqua-400 hover:text-aqua-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-white"
            type="button"
            onClick={joinCommunity}
          >
            Join
          </button>
        </div>
        <div className="space-y-2">
          <input
            className="h-10 w-full rounded-md border border-navy-100 bg-white px-3 text-sm text-navy-950 outline-none focus:border-aqua-400 dark:border-white/10 dark:bg-navy-950 dark:text-white"
            placeholder="friend@email.com"
            value={friendEmail}
            onChange={(event) => setFriendEmail(event.target.value)}
          />
          <button
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-navy-100 bg-white px-3 text-sm font-semibold text-navy-700 transition hover:border-aqua-400 hover:text-aqua-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-white"
            type="button"
            onClick={inviteFriend}
          >
            <UserPlus aria-hidden className="h-4 w-4" />
            Invite
          </button>
        </div>
      </div>

      <p className="mt-3 text-sm text-navy-500 dark:text-navy-100">{status}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {communities.slice(0, 4).map((community) => (
          <div className="rounded-lg bg-navy-50 p-3 dark:bg-white/[0.08]" key={community.id}>
            <div className="font-semibold text-navy-950 dark:text-white">{community.name}</div>
            <div className="mt-1 text-sm text-navy-500 dark:text-navy-100">
              {community.memberCount} members · code {community.joinCode}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
