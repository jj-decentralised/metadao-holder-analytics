"use client";

import { useEffect, useState } from "react";
import type { Token } from "@/lib/tokens";

interface TokenSelectorProps {
  /** Currently selected token ID */
  value: string;
  /** Callback when token selection changes */
  onChange: (tokenId: string) => void;
  /** Optional CSS class for the container */
  className?: string;
  /** Show loading state externally */
  disabled?: boolean;
}

/**
 * TokenSelector component for selecting tokens from the registry.
 * Fetches available tokens from /api/tokens and renders a dropdown.
 */
export function TokenSelector({
  value,
  onChange,
  className = "",
  disabled = false,
}: TokenSelectorProps) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTokens() {
      try {
        const res = await fetch("/api/tokens");
        if (!res.ok) throw new Error("Failed to fetch tokens");
        const data = await res.json();
        setTokens(data.tokens || []);
      } catch (err) {
        console.error("Error fetching tokens:", err);
        setError("Failed to load tokens");
      } finally {
        setLoading(false);
      }
    }
    fetchTokens();
  }, []);

  if (loading) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <span className="text-xs text-neutral-500 uppercase tracking-wider">
          Token
        </span>
        <div className="animate-pulse bg-neutral-100 h-8 w-32 rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <span className="text-xs text-red-500">{error}</span>
      </div>
    );
  }

  const selectedToken = tokens.find((t) => t.id === value);

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <label className="text-xs text-neutral-500 uppercase tracking-wider">
        Token
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="border border-neutral-300 rounded px-3 py-1.5 text-sm bg-white 
                   hover:border-neutral-400 focus:outline-none focus:ring-2 
                   focus:ring-neutral-900 focus:border-transparent
                   disabled:bg-neutral-100 disabled:cursor-not-allowed
                   font-[family-name:var(--font-sans)]"
      >
        {tokens.map((token) => (
          <option key={token.id} value={token.id}>
            {token.symbol} - {token.name}
          </option>
        ))}
      </select>
      {selectedToken && (
        <span className="text-xs text-neutral-400 hidden md:inline">
          {truncateAddress(selectedToken.address)}
        </span>
      )}
    </div>
  );
}

/**
 * Truncate a blockchain address for display
 */
function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default TokenSelector;
