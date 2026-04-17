import type {
  HttpResponse,
  HttpResponseEvent,
  HttpResponseEventData,
} from "@yaakapp-internal/models";
import { type ReactNode, useMemo, useState } from "react";
import { useHttpResponseEvents } from "../hooks/useHttpResponseEvents";
import { t } from "../lib/i18n";
import { Editor } from "./core/Editor/LazyEditor";
import { type EventDetailAction, EventDetailHeader, EventViewer } from "./core/EventViewer";
import { EventViewerRow } from "./core/EventViewerRow";
import { HttpStatusTagRaw } from "./core/HttpStatusTag";
import { Icon, type IconProps } from "./core/Icon";
import { KeyValueRow, KeyValueRows } from "./core/KeyValueRow";
import type { TimelineViewMode } from "./HttpResponsePane";

interface Props {
  response: HttpResponse;
  viewMode: TimelineViewMode;
}

export function HttpResponseTimeline({ response, viewMode }: Props) {
  return <Inner key={response.id} response={response} viewMode={viewMode} />;
}

function Inner({ response, viewMode }: Props) {
  const [showRaw, setShowRaw] = useState(false);
  const { data: events, error, isLoading } = useHttpResponseEvents(response);

  // Generate plain text representation of all events (with prefixes for timeline view)
  const plainText = useMemo(() => {
    if (!events || events.length === 0) return "";
    return events.map((event) => formatEventText(event.event, true)).join("\n");
  }, [events]);

  // Plain text view - show all events as text in an editor
  if (viewMode === "text") {
    if (isLoading) {
      return <div className="p-4 text-text-subtlest">{t("Loading events...")}</div>;
    } else if (error) {
      return <div className="p-4 text-danger">{String(error)}</div>;
    } else if (!events || events.length === 0) {
      return <div className="p-4 text-text-subtlest">{t("No events recorded")}</div>;
    } else {
      return (
        <Editor language="timeline" defaultValue={plainText} readOnly stateKey={null} hideGutter />
      );
    }
  }

  return (
    <EventViewer
      events={events ?? []}
      getEventKey={(event) => event.id}
      error={error ? String(error) : null}
      isLoading={isLoading}
      loadingMessage={t("Loading events...")}
      emptyMessage={t("No events recorded")}
      splitLayoutName="http_response_events"
      defaultRatio={0.25}
      renderRow={({ event, isActive, onClick }) => {
        const display = getEventDisplay(event.event);
        return (
          <EventViewerRow
            isActive={isActive}
            onClick={onClick}
            icon={<Icon color={display.color} icon={display.icon} size="sm" />}
            content={display.summary}
            timestamp={event.createdAt}
          />
        );
      }}
      renderDetail={({ event, onClose }) => (
        <EventDetails event={event} showRaw={showRaw} setShowRaw={setShowRaw} onClose={onClose} />
      )}
    />
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function EventDetails({
  event,
  showRaw,
  setShowRaw,
  onClose,
}: {
  event: HttpResponseEvent;
  showRaw: boolean;
  setShowRaw: (v: boolean) => void;
  onClose: () => void;
}) {
  const { label } = getEventDisplay(event.event);
  const e = event.event;

  const actions: EventDetailAction[] = [
    {
      key: "toggle-raw",
      label: showRaw ? t("Formatted") : t("Text"),
      onClick: () => setShowRaw(!showRaw),
    },
  ];

  // Determine the title based on event type
  const title = (() => {
    switch (e.type) {
      case "header_up":
        return t("Header Sent");
      case "header_down":
        return t("Header Received");
      case "send_url":
        return t("Request");
      case "receive_url":
        return t("Response");
      case "redirect":
        return t("Redirect");
      case "setting":
        return t("Apply Setting");
      case "chunk_sent":
        return t("Data Sent");
      case "chunk_received":
        return t("Data Received");
      case "dns_resolved":
        return e.overridden ? t("DNS Override") : t("DNS Resolution");
      default:
        return label;
    }
  })();

  // Render content based on view mode and event type
  const renderContent = () => {
    // Raw view - show plaintext representation (without prefix)
    if (showRaw) {
      const rawText = formatEventText(event.event, false);
      return <Editor language="text" defaultValue={rawText} readOnly stateKey={null} hideGutter />;
    }

    // Headers - show name and value
    if (e.type === "header_up" || e.type === "header_down") {
      return (
        <KeyValueRows>
          <KeyValueRow label={t("Header")}>{e.name}</KeyValueRow>
          <KeyValueRow label={t("Value")}>{e.value}</KeyValueRow>
        </KeyValueRows>
      );
    }

    // Request URL - show all URL parts separately
    if (e.type === "send_url") {
      const auth = e.username || e.password ? `${e.username}:${e.password}@` : "";
      const isDefaultPort =
        (e.scheme === "http" && e.port === 80) || (e.scheme === "https" && e.port === 443);
      const portStr = isDefaultPort ? "" : `:${e.port}`;
      const query = e.query ? `?${e.query}` : "";
      const fragment = e.fragment ? `#${e.fragment}` : "";
      const fullUrl = `${e.scheme}://${auth}${e.host}${portStr}${e.path}${query}${fragment}`;
      return (
        <KeyValueRows>
          <KeyValueRow label={t("URL")}>{fullUrl}</KeyValueRow>
          <KeyValueRow label={t("Method")}>{e.method}</KeyValueRow>
          <KeyValueRow label={t("Scheme")}>{e.scheme}</KeyValueRow>
          {e.username ? <KeyValueRow label={t("Username")}>{e.username}</KeyValueRow> : null}
          {e.password ? <KeyValueRow label={t("Password")}>{e.password}</KeyValueRow> : null}
          <KeyValueRow label={t("Host")}>{e.host}</KeyValueRow>
          {!isDefaultPort ? <KeyValueRow label={t("Port")}>{e.port}</KeyValueRow> : null}
          <KeyValueRow label={t("Path")}>{e.path}</KeyValueRow>
          {e.query ? <KeyValueRow label={t("Query")}>{e.query}</KeyValueRow> : null}
          {e.fragment ? <KeyValueRow label={t("Fragment")}>{e.fragment}</KeyValueRow> : null}
        </KeyValueRows>
      );
    }

    // Response status - show version and status separately
    if (e.type === "receive_url") {
      return (
        <KeyValueRows>
          <KeyValueRow label={t("HTTP Version")}>{e.version}</KeyValueRow>
          <KeyValueRow label={t("Status")}>
            <HttpStatusTagRaw status={e.status} />
          </KeyValueRow>
        </KeyValueRows>
      );
    }

    // Redirect - show status, URL, and behavior
    if (e.type === "redirect") {
      const droppedHeaders = e.dropped_headers ?? [];
      return (
        <KeyValueRows>
          <KeyValueRow label={t("Status")}>
            <HttpStatusTagRaw status={e.status} />
          </KeyValueRow>
          <KeyValueRow label={t("Location")}>{e.url}</KeyValueRow>
          <KeyValueRow label={t("Behavior")}>
            {e.behavior === "drop_body"
              ? t("Drop body, change to GET")
              : t("Preserve method and body")}
          </KeyValueRow>
          <KeyValueRow label={t("Body Dropped")}>{e.dropped_body ? t("Yes") : t("No")}</KeyValueRow>
          <KeyValueRow label={t("Headers Dropped")}>
            {droppedHeaders.length > 0 ? droppedHeaders.join(", ") : "--"}
          </KeyValueRow>
        </KeyValueRows>
      );
    }

    // Settings - show as key/value
    if (e.type === "setting") {
      return (
        <KeyValueRows>
          <KeyValueRow label={t("Setting")}>{e.name}</KeyValueRow>
          <KeyValueRow label={t("Value")}>{e.value}</KeyValueRow>
        </KeyValueRows>
      );
    }

    // Chunks - show formatted bytes
    if (e.type === "chunk_sent" || e.type === "chunk_received") {
      return <div className="font-mono text-editor">{formatBytes(e.bytes)}</div>;
    }

    // DNS Resolution - show hostname, addresses, and timing
    if (e.type === "dns_resolved") {
      return (
        <KeyValueRows>
          <KeyValueRow label="Hostname">{e.hostname}</KeyValueRow>
          <KeyValueRow label="Addresses">{e.addresses.join(", ")}</KeyValueRow>
          <KeyValueRow label="Duration">
            {e.overridden ? (
              <span className="text-text-subtlest">--</span>
            ) : (
              `${String(e.duration)}ms`
            )}
          </KeyValueRow>
          {e.overridden ? <KeyValueRow label="Source">Workspace Override</KeyValueRow> : null}
        </KeyValueRows>
      );
    }

    // Default - use summary
    const { summary } = getEventDisplay(event.event);
    return <div className="font-mono text-editor">{summary}</div>;
  };
  return (
    <div className="flex flex-col gap-2 h-full">
      <EventDetailHeader
        title={title}
        timestamp={event.createdAt}
        actions={actions}
        onClose={onClose}
      />
      {renderContent()}
    </div>
  );
}

type EventTextParts = { prefix: ">" | "<" | "*"; text: string };

/** Get the prefix and text for an event */
function getEventTextParts(event: HttpResponseEventData): EventTextParts {
  switch (event.type) {
    case "send_url":
      return {
        prefix: ">",
        text: `${event.method} ${event.path}${event.query ? `?${event.query}` : ""}${event.fragment ? `#${event.fragment}` : ""}`,
      };
    case "receive_url":
      return { prefix: "<", text: `${event.version} ${event.status}` };
    case "header_up":
      return { prefix: ">", text: `${event.name}: ${event.value}` };
    case "header_down":
      return { prefix: "<", text: `${event.name}: ${event.value}` };
    case "redirect": {
      const behavior = event.behavior === "drop_body" ? "drop body" : "preserve";
      const droppedHeaders = event.dropped_headers ?? [];
      const dropped = [
        event.dropped_body ? "body dropped" : null,
        droppedHeaders.length > 0 ? `headers dropped: ${droppedHeaders.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join(", ");
      return {
        prefix: "*",
        text: `Redirect ${event.status} -> ${event.url} (${behavior}${dropped ? `, ${dropped}` : ""})`,
      };
    }
    case "setting":
      return { prefix: "*", text: `Setting ${event.name}=${event.value}` };
    case "info":
      return { prefix: "*", text: event.message };
    case "chunk_sent":
      return { prefix: "*", text: `[${formatBytes(event.bytes)} sent]` };
    case "chunk_received":
      return { prefix: "*", text: `[${formatBytes(event.bytes)} received]` };
    case "dns_resolved":
      if (event.overridden) {
        return {
          prefix: "*",
          text: `DNS override ${event.hostname} -> ${event.addresses.join(", ")}`,
        };
      }
      return {
        prefix: "*",
        text: `DNS resolved ${event.hostname} to ${event.addresses.join(", ")} (${event.duration}ms)`,
      };
    default:
      return { prefix: "*", text: "[unknown event]" };
  }
}

/** Format event as plaintext, optionally with curl-style prefix (> outgoing, < incoming, * info) */
function formatEventText(event: HttpResponseEventData, includePrefix: boolean): string {
  const { prefix, text } = getEventTextParts(event);
  return includePrefix ? `${prefix} ${text}` : text;
}

type EventDisplay = {
  icon: IconProps["icon"];
  color: IconProps["color"];
  label: string;
  summary: ReactNode;
};

function getEventDisplay(event: HttpResponseEventData): EventDisplay {
  switch (event.type) {
    case "setting":
      return {
        icon: "settings",
        color: "secondary",
        label: t("Setting"),
        summary: `${event.name} = ${event.value}`,
      };
    case "info":
      return {
        icon: "info",
        color: "secondary",
        label: t("Info"),
        summary: event.message,
      };
    case "redirect": {
      const droppedHeaders = event.dropped_headers ?? [];
      const dropped = [
        event.dropped_body ? "drop body" : null,
        droppedHeaders.length > 0
          ? `drop ${droppedHeaders.length} ${droppedHeaders.length === 1 ? "header" : "headers"}`
          : null,
      ]
        .filter(Boolean)
        .join(", ");
      return {
        icon: "arrow_big_right_dash",
        color: "success",
        label: t("Redirect"),
        summary: `Redirecting ${event.status} ${event.url}${dropped ? ` (${dropped})` : ""}`,
      };
    }
    case "send_url":
      return {
        icon: "arrow_big_up_dash",
        color: "primary",
        label: t("Request"),
        summary: `${event.method} ${event.path}${event.query ? `?${event.query}` : ""}${event.fragment ? `#${event.fragment}` : ""}`,
      };
    case "receive_url":
      return {
        icon: "arrow_big_down_dash",
        color: "info",
        label: t("Response"),
        summary: `${event.version} ${event.status}`,
      };
    case "header_up":
      return {
        icon: "arrow_big_up_dash",
        color: "primary",
        label: t("Header"),
        summary: `${event.name}: ${event.value}`,
      };
    case "header_down":
      return {
        icon: "arrow_big_down_dash",
        color: "info",
        label: t("Header"),
        summary: `${event.name}: ${event.value}`,
      };

    case "chunk_sent":
      return {
        icon: "info",
        color: "secondary",
        label: "Chunk",
        summary: `${formatBytes(event.bytes)} chunk sent`,
      };
    case "chunk_received":
      return {
        icon: "info",
        color: "secondary",
        label: "Chunk",
        summary: `${formatBytes(event.bytes)} chunk received`,
      };
    case "dns_resolved":
      return {
        icon: "globe",
        color: event.overridden ? "success" : "secondary",
        label: event.overridden ? t("DNS Override") : "DNS",
        summary: event.overridden
          ? `${event.hostname} → ${event.addresses.join(", ")} (overridden)`
          : `${event.hostname} → ${event.addresses.join(", ")} (${event.duration}ms)`,
      };
    default:
      return {
        icon: "info",
        color: "secondary",
        label: "Unknown",
        summary: "Unknown event",
      };
  }
}
