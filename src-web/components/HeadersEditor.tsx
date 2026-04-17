import type { HttpRequestHeader } from "@yaakapp-internal/models";
import type { GenericCompletionOption } from "@yaakapp-internal/plugins";
import { useCallback, useEffect, useState } from "react";
import { charsets } from "../lib/data/charsets";
import { connections } from "../lib/data/connections";
import { encodings } from "../lib/data/encodings";
import { useRandomKey } from "../hooks/useRandomKey";
import { headerNames } from "../lib/data/headerNames";
import { mimeTypes } from "../lib/data/mimetypes";
import { showDialog } from "../lib/dialog";
import { t } from "../lib/i18n";
import { CountBadge } from "./core/CountBadge";
import { DetailsBanner } from "./core/DetailsBanner";
import { Button } from "./core/Button";
import { pairsToText, textToPairs } from "./core/BulkPairEditor";
import type { GenericCompletionConfig } from "./core/Editor/genericCompletion";
import { Editor } from "./core/Editor/LazyEditor";
import { Icon } from "./core/Icon";
import type { InputProps } from "./core/Input";
import type { Pair, PairEditorProps } from "./core/PairEditor";
import { PairEditorRow } from "./core/PairEditor";
import { ensurePairId } from "./core/PairEditor.util";
import { PairOrBulkEditor } from "./core/PairOrBulkEditor";
import type { RadioDropdownItem } from "./core/RadioDropdown";
import { HStack, VStack } from "./core/Stacks";

type Props = {
  forceUpdateKey: string;
  headers: HttpRequestHeader[];
  inheritedHeaders?: HttpRequestHeader[];
  inheritedHeadersLabel?: string;
  stateKey: string;
  onChange: (headers: HttpRequestHeader[]) => void;
  label?: string;
};

export function HeadersEditor({
  stateKey,
  headers,
  inheritedHeaders,
  inheritedHeadersLabel = "Inherited",
  onChange,
  forceUpdateKey,
}: Props) {
  const [localHeaders, setLocalHeaders] = useState<HttpRequestHeader[]>(headers);
  const [editorRefreshKey, regenerateEditorRefreshKey] = useRandomKey();

  useEffect(() => {
    setLocalHeaders(headers);
  }, [headers]);

  const handleChangeHeaders = useCallback(
    (nextHeaders: HttpRequestHeader[]) => {
      setLocalHeaders(nextHeaders);
      onChange(nextHeaders);
    },
    [onChange],
  );

  const handleApplyPastedHeaders = useCallback(
    (nextHeaders: HttpRequestHeader[]) => {
      setLocalHeaders(nextHeaders);
      onChange(nextHeaders);
      regenerateEditorRefreshKey();
    },
    [onChange, regenerateEditorRefreshKey],
  );

  const handleOpenPasteDialog = useCallback(() => {
    const initialText = pairsToText(localHeaders);
    showDialog({
      id: `paste-headers.${stateKey}`,
      title: t("Batch Edit Headers"),
      size: "md",
      render: ({ hide }) => (
        <PasteHeadersDialog
          hide={hide}
          initialText={initialText}
          stateKey={stateKey}
          onApply={handleApplyPastedHeaders}
        />
      ),
    });
  }, [handleApplyPastedHeaders, localHeaders, stateKey]);

  // Get header names defined at current level (case-insensitive)
  const currentHeaderNames = new Set(
    localHeaders.filter((h) => h.name).map((h) => h.name.toLowerCase()),
  );
  // Filter inherited headers: must be enabled, have content, and not be overridden by current level
  const validInheritedHeaders =
    inheritedHeaders?.filter(
      (pair) =>
        pair.enabled &&
        (pair.name || pair.value) &&
        !currentHeaderNames.has(pair.name.toLowerCase()),
    ) ?? [];
  const hasInheritedHeaders = validInheritedHeaders.length > 0;
  return (
    <div
      className={
        hasInheritedHeaders
          ? "@container w-full h-full grid grid-rows-[auto_auto_minmax(0,1fr)] gap-y-1.5"
          : "@container w-full h-full grid grid-rows-[auto_minmax(0,1fr)] gap-y-1.5"
      }
    >
      {hasInheritedHeaders && (
        <DetailsBanner
          color="secondary"
          className="text-sm"
          summary={
            <HStack>
              {inheritedHeadersLabel} <CountBadge count={validInheritedHeaders.length} />
            </HStack>
          }
        >
          <div className="pb-2">
            {validInheritedHeaders?.map((pair, i) => (
              <PairEditorRow
                key={`${pair.id}.${i}`}
                index={i}
                disabled
                disableDrag
                className="py-1"
                pair={ensurePairId(pair)}
                stateKey={null}
                nameAutocompleteFunctions
                nameAutocompleteVariables
                valueAutocompleteFunctions
                valueAutocompleteVariables
              />
            ))}
          </div>
        </DetailsBanner>
      )}
      <HStack justifyContent="end">
        <Button
          size="xs"
          variant="border"
          onClick={handleOpenPasteDialog}
          leftSlot={<Icon icon="file_code" size="xs" />}
        >
          {t("Batch Edit Headers")}
        </Button>
      </HStack>
      <PairOrBulkEditor
        forceUpdateKey={`${forceUpdateKey}.${editorRefreshKey}`}
        nameAutocomplete={nameAutocomplete}
        nameAutocompleteFunctions
        nameAutocompleteVariables
        namePlaceholder="Header-Name"
        nameValidate={validateHttpHeader}
        onChange={handleChangeHeaders}
        pairs={localHeaders}
        preferenceName="headers"
        stateKey={stateKey}
        valueType={valueType}
        valueAutocomplete={valueAutocomplete}
        valueAutocompleteFunctions
        valueAutocompleteVariables
        valueOptions={valueOptions}
      />
    </div>
  );
}

type PasteHeadersDialogProps = {
  hide: () => void;
  initialText: string;
  stateKey: string;
  onApply: (headers: HttpRequestHeader[]) => void;
};

function PasteHeadersDialog({
  hide,
  initialText,
  stateKey,
  onApply,
}: PasteHeadersDialogProps) {
  const [text, setText] = useState(initialText);

  const handleApply = useCallback(() => {
    onApply(textToPairs(text));
    hide();
  }, [hide, onApply, text]);

  return (
    <VStack className="w-full min-h-[24rem]" space={3}>
      <p className="text-sm text-text-subtle">
        {t("Paste one header per line. Both Header:Value and Header: Value are supported.")}
      </p>
      <div className="min-h-0 flex-1">
        <Editor
          autocompleteFunctions
          autocompleteVariables
          defaultValue={initialText}
          forceUpdateKey={initialText}
          heightMode="full"
          language="pairs"
          onChange={setText}
          placeholder={"Content-Type: application/json\nUser-Agent: Yaak"}
          stateKey={`paste_headers.${stateKey}`}
        />
      </div>
      <HStack justifyContent="between" space={2}>
        <span className="text-xs text-text-subtle">
          {t("Current headers are already filled in below for editing.")}
        </span>
        <HStack space={2}>
          <Button variant="border" onClick={hide}>
            {t("Cancel")}
          </Button>
          <Button onClick={handleApply}>{t("Save")}</Button>
        </HStack>
      </HStack>
    </VStack>
  );
}

const MIN_MATCH = 3;

const headerOptionsMap: Record<string, string[]> = {
  "content-type": mimeTypes,
  accept: ["*/*", ...mimeTypes],
  "accept-encoding": encodings,
  connection: connections,
  "accept-charset": charsets,
};

const valueType = (pair: Pair): InputProps["type"] => {
  const name = pair.name.toLowerCase().trim();
  if (
    name.includes("authorization") ||
    name.includes("api-key") ||
    name.includes("access-token") ||
    name.includes("auth") ||
    name.includes("secret") ||
    name.includes("token")
  ) {
    return "password";
  }
  return "text";
};

const valueAutocomplete = (headerName: string): GenericCompletionConfig | undefined => {
  const name = headerName.toLowerCase().trim();
  const options: GenericCompletionOption[] =
    headerOptionsMap[name]?.map((o) => ({
      label: o,
      type: "constant",
      boost: 1, // Put above other completions
    })) ?? [];
  return { minMatch: MIN_MATCH, options };
};

const commonContentTypes: RadioDropdownItem<string>[] = [
  { type: "separator", label: t("Common") },
  { label: "application/json", value: "application/json" },
  { label: "text/plain", value: "text/plain" },
  { label: "text/html", value: "text/html" },
  { label: "application/x-www-form-urlencoded", value: "application/x-www-form-urlencoded" },
  { label: "multipart/form-data", value: "multipart/form-data" },
  { label: "application/octet-stream", value: "application/octet-stream" },
  { type: "separator", label: t("Structured Data") },
  { label: "application/xml", value: "application/xml" },
  { label: "text/xml", value: "text/xml" },
  { label: "application/graphql", value: "application/graphql" },
  { label: "application/ld+json", value: "application/ld+json" },
  { label: "application/vnd.api+json", value: "application/vnd.api+json" },
  { label: "application/x-ndjson", value: "application/x-ndjson" },
  { type: "separator", label: t("Documents and Media") },
  { label: "text/csv", value: "text/csv" },
  { label: "application/pdf", value: "application/pdf" },
  { label: "image/png", value: "image/png" },
  { label: "image/jpeg", value: "image/jpeg" },
  { label: "image/webp", value: "image/webp" },
];

const valueOptions = (pair: Pair): RadioDropdownItem<string>[] | undefined => {
  if (pair.name.toLowerCase().trim() !== "content-type") {
    return undefined;
  }
  return commonContentTypes;
};

const nameAutocomplete: PairEditorProps["nameAutocomplete"] = {
  minMatch: MIN_MATCH,
  options: headerNames.map((t) =>
    typeof t === "string"
      ? {
          label: t,
          type: "constant",
          boost: 1, // Put above other completions
        }
      : {
          ...t,
          boost: 1, // Put above other completions
        },
  ),
};

const validateHttpHeader = (v: string) => {
  if (v === "") {
    return true;
  }

  // Template strings are not allowed so we replace them with a valid example string
  const withoutTemplateStrings = v.replace(/\$\{\[\s*[^\]\s]+\s*]}/gi, "123");
  return withoutTemplateStrings.match(/^[a-zA-Z0-9-_]+$/) !== null;
};
