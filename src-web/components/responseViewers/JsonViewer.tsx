import classNames from "classnames";
import { EmptyStateText } from "../EmptyStateText";
import { JsonAttributeTree } from "../core/JsonAttributeTree";

interface Props {
  text: string;
  className?: string;
}

export function JsonViewer({ text, className }: Props) {
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  if (parsed == null) {
    return <EmptyStateText>JSON 解析失败</EmptyStateText>;
  }

  return (
    <div className={classNames(className, "overflow-x-auto h-full")}>
      <JsonAttributeTree attrValue={parsed} enableCopyActions />
    </div>
  );
}
