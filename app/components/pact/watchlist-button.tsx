"use client";

import React, { useState, useEffect } from "react";
import { Button } from "../ui/button";
import {
  addToWatchlist,
  removeFromWatchlist,
  isInWatchlist,
  updateWatchlistNickname,
} from "../../lib/watchlist";

interface WatchlistButtonProps {
  address: string;
  nickname?: string;
}

export function WatchlistButton({ address, nickname }: WatchlistButtonProps) {
  const [isWatched, setIsWatched] = useState(false);
  const [showNicknameInput, setShowNicknameInput] = useState(false);
  const [inputNickname, setInputNickname] = useState(nickname || "");

  useEffect(() => {
    setIsWatched(isInWatchlist(address));
    setInputNickname(nickname || "");
  }, [address, nickname]);

  const handleToggle = () => {
    if (isWatched) {
      removeFromWatchlist(address);
      setIsWatched(false);
    } else {
      addToWatchlist(address, inputNickname || undefined);
      setIsWatched(true);
      if (inputNickname) {
        setShowNicknameInput(false);
      } else {
        setShowNicknameInput(true);
      }
    }
  };

  const handleSaveNickname = () => {
    if (inputNickname.trim()) {
      updateWatchlistNickname(address, inputNickname.trim());
      setShowNicknameInput(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button variant="outline" className="w-full" onClick={handleToggle}>
        {isWatched ? (
          <span className="flex items-center gap-2">
            <span>✓</span> Watching
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <span>+</span> Add to Watchlist
          </span>
        )}
      </Button>

      {isWatched && showNicknameInput && (
        <div className="space-y-2">
          <input
            type="text"
            value={inputNickname}
            onChange={(e) => setInputNickname(e.target.value)}
            placeholder="Nickname (optional)"
            className="w-full bg-[#15171C] border border-[#23262F] p-2 text-sm focus:outline-none focus:border-[#F26B3A]"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSaveNickname();
              }
            }}
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleSaveNickname}
            >
              Save
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                setShowNicknameInput(false);
                setInputNickname(nickname || "");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {isWatched && !showNicknameInput && inputNickname && (
        <p className="text-xs text-[#8E9094] text-center">
          Watching as: {inputNickname}
        </p>
      )}
    </div>
  );
}
