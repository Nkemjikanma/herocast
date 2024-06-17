import NewPostEntry from "../../src/common/components/NewPostEntry";
import { classNames } from "../../src/common/helpers/css";
import { useDraftStore } from "../../src/stores/useDraftStore";
import React, { useEffect, useMemo, useState } from "react";
import {
  ClockIcon,
  PlusCircleIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import * as Tooltip from "@radix-ui/react-tooltip";
import HotkeyTooltipWrapper from "../../src/common/components/HotkeyTooltipWrapper";
import { Button } from "../../src/components/ui/button";
import { CastRow } from "@/common/components/CastRow";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { useAccountStore } from "@/stores/useAccountStore";
import { CastWithInteractions } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { parseISO, formatDistanceToNow } from "date-fns";
import { DraftStatus, DraftType } from "../../src/common/constants/farcaster";
import map from "lodash.map";
import { renderEmbedForUrl } from "../../src/common/components/Embeds";
import {
  getUserLocaleDateFromIsoString,
  localize,
} from "../../src/common/helpers/date";
import { ChannelType } from "@/common/constants/channels";
import { UUID } from "crypto";

enum DraftListTab {
  writing = "writing",
  scheduled = "scheduled",
  published = "published",
}

const DraftListTabs = [
  {
    key: DraftListTab.writing,
    label: "Writing",
  },
  {
    key: DraftListTab.scheduled,
    label: "Scheduled",
  },
  {
    key: DraftListTab.published,
    label: "Published",
  },
];

const getDraftsForTab = (
  drafts: DraftType[],
  activeTab: DraftListTab,
  activeAccountId?: UUID
) => {
  switch (activeTab) {
    case DraftListTab.writing:
      return drafts.filter((draft) => draft.status === DraftStatus.writing);
    case DraftListTab.scheduled:
      return drafts
        .filter(
          (draft) =>
            draft.status === DraftStatus.scheduled &&
            draft.accountId === activeAccountId
        )
        .sort(
          (a, b) =>
            new Date(a.scheduledFor).getTime() -
            new Date(b.scheduledFor).getTime()
        );
    case DraftListTab.published:
      return drafts.filter(
        (draft) =>
          draft.status === DraftStatus.published &&
          draft.accountId === activeAccountId
      );
    default:
      return drafts;
  }
};

const getChannelForParentUrl = ({
  channels,
  parentUrl,
}: {
  channels: ChannelType[];
  parentUrl: string | null;
}) =>
  parentUrl ? channels.find((channel) => channel.url === parentUrl) : undefined;

export default function NewPost() {
  const { addNewPostDraft, removePostDraftById } = useDraftStore();
  const { drafts } = useDraftStore();
  const [parentCasts, setParentCasts] = useState<CastWithInteractions[]>([]);
  const { accounts, selectedAccountIdx, allChannels } = useAccountStore();
  const selectedAccount = accounts[selectedAccountIdx];
  const [activeTab, setActiveTab] = useState<DraftListTab>(
    DraftListTab.writing
  );

  const draftsForTab = useMemo(
    () => getDraftsForTab(drafts, activeTab, selectedAccount?.id),
    [drafts, activeTab, selectedAccount?.id]
  );
  const [selectedDraftId, setSelectedDraftId] = useState(draftsForTab[0]?.id);

  useEffect(() => {
    if (drafts.length === 0) {
      addNewPostDraft({});
    }
  }, []);

  useEffect(() => {
    // when drafts change, we want to make sure that selectedDraftId is always a valid draft id
    if (
      !draftsForTab.find((draft) => draft.id === selectedDraftId) &&
      draftsForTab.length > 0
    ) {
      setSelectedDraftId(draftsForTab[0]?.id);
    }
  }, [draftsForTab]);

  useEffect(() => {
    const parentCastIds = drafts
      .map((draft) => draft?.parentCastId?.hash)
      .filter(Boolean) as string[];

    const fetchParentCasts = async () => {
      const neynarClient = new NeynarAPIClient(
        process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
      );
      const res = await neynarClient.fetchBulkCasts(parentCastIds, {
        viewerFid: selectedAccount?.platformAccountId,
      });
      setParentCasts(res?.result?.casts);
    };
    if (parentCastIds.length) {
      fetchParentCasts();
    }
  }, [drafts]);

  const onRemove = (draft) => {
    removePostDraftById(draft.id);
  };

  const getTitle = () => {
    switch (activeTab) {
      case DraftListTab.writing:
        return "New cast";
      case DraftListTab.scheduled:
        return "Scheduled casts";
      case DraftListTab.published:
        return "Published casts";
      default:
        return "Drafts";
    }
  };

  const renderWritingDraft = (draft) => {
    if (!draft) return null;

    const parentCast = parentCasts.find(
      (cast) => cast.hash === draft.parentCastId?.hash
    );
    return (
      <div key={draft.id} className="pt-4 pb-6">
        {parentCast && <CastRow cast={parentCast} />}
        <NewPostEntry
          draft={draft}
          draftIdx={drafts.findIndex((d) => d.id === draft.id)}
        />
      </div>
    );
  };

  const renderScheduledDraft = (draft) => {
    if (!draft) return null;
    const channel = getChannelForParentUrl({
      channels: allChannels,
      parentUrl: draft.parentUrl,
    });
    const hasEmbeds = draft?.embeds?.length > 0;
    return (
      <div className="pt-4 pb-6">
        <div className="flex items-center text-xs text-muted-foreground">
          <ClockIcon className="w-5 h-5" />
          <span className="">
            Scheduled for {getUserLocaleDateFromIsoString(draft.scheduledFor)}
          </span>
          {channel && (
            <p>
              &nbsp;in&nbsp;
              <span className="h-5 inline-flex truncate items-top rounded-sm bg-blue-400/10 px-1.5 py-0.5 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-400/30">
                {channel.name}
              </span>
            </p>
          )}
        </div>
        <div className="mt-4 px-2 py-1 border rounded-lg w-full h-full min-h-[150px]">
          {draft.text}
        </div>
        {hasEmbeds && (
          <div className="mt-8 rounded-md bg-muted p-2 w-full break-all">
            {map(draft.embeds, (embed) => (
              <div key={`cast-embed-${embed.url || embed.hash}`}>
                {renderEmbedForUrl(embed)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderDraftListPreview = (draft) => {
    const channel = getChannelForParentUrl({
      channels: allChannels,
      parentUrl: draft.parentUrl,
    });
    return (
      <div
        key={draft?.id || draft?.createdAt}
        className={cn(
          "flex flex-col max-w-full items-start gap-2 rounded-lg border p-3 text-left text-sm transition-all hover:bg-accent cursor-pointer",
          draft.id === selectedDraftId && "bg-muted"
        )}
        onClick={() => {
          setSelectedDraftId(draft.id);
        }}
      >
        <div
          className={cn(
            "line-clamp-2 text-xs break-all",
            draft.id === selectedDraftId
              ? "text-foreground"
              : "text-muted-foreground"
          )}
        >
          {draft.text ? draft.text.substring(0, 300) : "New cast"}
        </div>
        <div className="flex w-full flex-col gap-1">
          <div className="flex items-center gap-2">
            {draft?.embeds?.length ? (
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {localize(draft.embeds.length, " embed")}
                </Badge>
              </div>
            ) : null}
            {channel && (
              <span className="h-5 inline-flex truncate items-top rounded-sm bg-blue-400/10 px-1.5 py-0.5 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-400/30">
                {channel.name}
              </span>
            )}
            <div
              className={cn(
                "ml-auto text-xs",
                draft.id === selectedDraftId
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {draft.status === DraftStatus.writing &&
                draft.createdAt &&
                formatDistanceToNow(new Date(draft.createdAt), {
                  addSuffix: true,
                })}
            </div>
            <Button
              className="py-0.5 px-1 hover:bg-muted-foreground/20"
              size="sm"
              variant="outline"
              onClick={() => onRemove(draft)}
            >
              <TrashIcon className="w-4 h-4" />
            </Button>
          </div>
          <div className="text-xs font-medium">
            {draft.scheduledFor && (
              <div className="flex items-center gap-2">
                <ClockIcon className="w-4 h-4" />
                <span className="text-xs text-muted-foreground">
                  Scheduled for{" "}
                  {getUserLocaleDateFromIsoString(
                    draft.scheduledFor,
                    "short",
                    "short"
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderScrollableList = (children: React.ReactElement) => (
    <ScrollArea className="flex-1">
      <div className="flex flex-col gap-2 pt-0">{children}</div>
    </ScrollArea>
  );

  const renderDraftList = () => {
    return renderScrollableList(
      <>
        <Button
          variant="outline"
          className="flex items-center gap-2 mx-2"
          onClick={() => {
            addNewPostDraft({});
          }}
        >
          <PlusCircleIcon className="w-5 h-5" />
          <span>New draft</span>
        </Button>
        <div className="flex flex-col gap-2 p-2 pt-0">
          {draftsForTab.map(renderDraftListPreview)}
        </div>
      </>
    );
  };

  const renderScheduledList = () => {
    return renderScrollableList(
      <>
        {draftsForTab.length === 0 && (
          <Button
            variant="outline"
            className="flex items-center gap-2 mx-2"
            onClick={() => {
              addNewPostDraft({});
              setActiveTab(DraftListTab.writing);
            }}
          >
            <PlusCircleIcon className="w-5 h-5" />
            <span>New draft</span>
          </Button>
        )}
        <div className="flex flex-col gap-2 p-2 pt-0">
          {draftsForTab.map(renderDraftListPreview)}
        </div>
      </>
    );
  };

  const renderContent = () => {
    const draft = draftsForTab.find((draft) => draft.id === selectedDraftId);
    switch (activeTab) {
      case DraftListTab.writing:
        return renderWritingDraft(draft);
      case DraftListTab.scheduled:
      case DraftListTab.published:
        return renderScheduledDraft(draft);
      default:
        return null;
    }
  };

  return (
    <div className="grid grid-cols-[300px_1fr] h-screen w-full">
      <div className="overflow-y-auto p-4">
        <div className="space-y-4">
          <Tabs
            defaultValue="drafts"
            className="w-full"
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as DraftListTab)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center py-2 w-full">
                <TabsList className="flex w-full">
                  {DraftListTabs.map((tab) => (
                    <TabsTrigger
                      key={tab.key}
                      value={tab.key}
                      className="text-zinc-600 dark:text-zinc-200"
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </div>
            <TabsContent value={DraftListTab.writing}>
              {renderDraftList()}
            </TabsContent>
            <TabsContent value={DraftListTab.scheduled}>
              {renderScheduledList()}
            </TabsContent>
            <TabsContent value={DraftListTab.published}>
              {renderScheduledList()}
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <div className="flex flex-col">
        <div className="bg-white dark:bg-gray-900 p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold">{getTitle()}</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{renderContent()}</div>
      </div>
    </div>
  );
}