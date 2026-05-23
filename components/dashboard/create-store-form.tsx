"use client";

import { useState } from "react";

export default function CreateStoreForm() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleCreateStore() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/stores/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, description }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create store");
      }

      setMessage("Store created successfully");
      setName("");
      setSlug("");
      setDescription("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create store");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border p-6">
      <h2 className="text-xl font-semibold">Create real store</h2>

      <input className="w-full rounded-lg border p-3" placeholder="Store name" value={name} onChange={(e) => setName(e.target.value)} />

      <input className="w-full rounded-lg border p-3" placeholder="Store slug" value={slug} onChange={(e) => setSlug(e.target.value)} />

      <textarea className="w-full rounded-lg border p-3" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />

      <button type="button" onClick={handleCreateStore} disabled={loading} className="rounded-lg bg-black px-5 py-3 text-white">
        {loading ? "Creating..." : "Create Store"}
      </button>

      {message ? <p className="text-sm text-neutral-600">{message}</p> : null}
    </div>
  );
}