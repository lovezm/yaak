import { useCallback, useMemo } from "react";
import { generateId } from "../../lib/generateId";
import { Editor } from "./Editor/LazyEditor";
import type { Pair, PairEditorProps, PairWithId } from "./PairEditor";

type Props = PairEditorProps;

export function BulkPairEditor({
  pairs,
  onChange,
  namePlaceholder,
  valuePlaceholder,
  forceUpdateKey,
  forcedEnvironmentId,
  stateKey,
}: Props) {
  const pairsText = useMemo(() => {
    return pairsToText(pairs);
  }, [pairs]);

  const handleChange = useCallback(
    (text: string) => {
      onChange(textToPairs(text));
    },
    [onChange],
  );

  return (
    <Editor
      autocompleteFunctions
      autocompleteVariables
      stateKey={`bulk_pair.${stateKey}`}
      forcedEnvironmentId={forcedEnvironmentId}
      forceUpdateKey={forceUpdateKey}
      placeholder={`${namePlaceholder ?? "name"}: ${valuePlaceholder ?? "value"}`}
      defaultValue={pairsText}
      language="pairs"
      onChange={handleChange}
    />
  );
}

export function pairsToText(pairs: Pair[]) {
  return pairs
    .filter((p) => !(p.name.trim() === "" && p.value.trim() === ""))
    .map(pairToLine)
    .join("\n");
}

export function textToPairs(text: string): PairWithId[] {
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map(lineToPair);
}

function pairToLine(pair: Pair) {
  const value = pair.value.replaceAll("\n", "\\n");
  return `${pair.name}: ${value}`;
}

function lineToPair(line: string): PairWithId {
  const [, name, value] = line.match(/^([^:]+):(.*)$/) ?? [];
  return {
    enabled: true,
    name: (name ?? "").trim(),
    value: (value ?? "").replaceAll("\\n", "\n").trim(),
    id: generateId(),
  };
}
