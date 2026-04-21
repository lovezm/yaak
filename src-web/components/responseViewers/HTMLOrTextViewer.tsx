import type { HttpResponse } from "@yaakapp-internal/models";
import { useMemo, useState } from "react";
import { useResponseBodyText } from "../../hooks/useResponseBodyText";
import { t } from "../../lib/i18n";
import { languageFromContentType } from "../../lib/contentType";
import { getContentTypeFromHeaders } from "../../lib/model_util";
import type { EditorProps } from "../core/Editor/Editor";
import { SegmentedControl } from "../core/SegmentedControl";
import { VStack } from "../core/Stacks";
import { EmptyStateText } from "../EmptyStateText";
import { JsonViewer } from "./JsonViewer";
import { TextViewer } from "./TextViewer";
import { WebPageViewer } from "./WebPageViewer";

interface Props {
  response: HttpResponse;
  pretty: boolean;
  textViewerClassName?: string;
}

export function HTMLOrTextViewer({ response, pretty, textViewerClassName }: Props) {
  const rawTextBody = useResponseBodyText({ response, filter: null });
  const contentType = getContentTypeFromHeaders(response.headers);
  const language = languageFromContentType(contentType, rawTextBody.data ?? "");

  if (rawTextBody.isLoading || response.state === "initialized") {
    return null;
  }

  if (language === "html" && pretty) {
    return <WebPageViewer html={rawTextBody.data ?? ""} baseUrl={response.url} />;
  }
  if (rawTextBody.data == null) {
    return <EmptyStateText>Empty response</EmptyStateText>;
  }
  return (
    <HttpTextViewer
      response={response}
      text={rawTextBody.data}
      language={language}
      pretty={pretty}
      className={textViewerClassName}
    />
  );
}

interface HttpTextViewerProps {
  response: HttpResponse;
  text: string;
  language: EditorProps["language"];
  pretty: boolean;
  className?: string;
}

function HttpTextViewer({ response, text, language, pretty, className }: HttpTextViewerProps) {
  const [currentFilter, setCurrentFilter] = useState<string | null>(null);
  const [jsonViewMode, setJsonViewMode] = useState<"text" | "tree">("text");
  const filteredBody = useResponseBodyText({ response, filter: currentFilter });
  const canUseJsonTree = language === "json";

  const filterCallback = useMemo(
    () => (filter: string) => {
      setCurrentFilter(filter);
      return {
        data: filteredBody.data,
        isPending: filteredBody.isPending,
        error: !!filteredBody.error,
      };
    },
    [filteredBody],
  );

  if (!canUseJsonTree) {
    return (
      <TextViewer
        text={text}
        language={language}
        stateKey={`response.body.${response.id}`}
        pretty={pretty}
        className={className}
        onFilter={filterCallback}
      />
    );
  }

  return (
    <VStack className="h-full min-h-0" space={2}>
      <SegmentedControl
        name={`response-json-view.${response.id}`}
        label={t("JSON View")}
        hideLabel
        value={jsonViewMode}
        onChange={setJsonViewMode}
        options={[
          { value: "text", label: t("Text") },
          { value: "tree", label: t("Tree") },
        ]}
      />
      <div className="min-h-0 flex-1">
        {jsonViewMode === "tree" ? (
          <JsonViewer text={text} className={className} />
        ) : (
          <TextViewer
            text={text}
            language={language}
            stateKey={`response.body.${response.id}`}
            pretty={pretty}
            className={className}
            onFilter={filterCallback}
          />
        )}
      </div>
    </VStack>
  );
}
