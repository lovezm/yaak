import classNames from "classnames";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { copyToClipboard } from "../../lib/copy";
import { Button } from "./Button";
import { Icon } from "./Icon";

interface Props {
  depth?: number;
  // oxlint-disable-next-line no-explicit-any
  attrValue: any;
  attrKey?: string | number;
  attrKeyJsonPath?: string;
  className?: string;
  enableCopyActions?: boolean;
}

export const JsonAttributeTree = ({
  depth = 0,
  attrKey,
  attrValue,
  attrKeyJsonPath,
  className,
  enableCopyActions = false,
}: Props) => {
  attrKeyJsonPath = attrKeyJsonPath ?? "$";

  const [isExpanded, setIsExpanded] = useState(true);
  const toggleExpanded = () => setIsExpanded((v) => !v);

  const { isExpandable, children, label, labelClassName } = useMemo<{
    isExpandable: boolean;
    children: ReactNode;
    label?: string;
    labelClassName?: string;
  }>(() => {
    const jsonType = Object.prototype.toString.call(attrValue);
    if (jsonType === "[object Object]") {
      return {
        children: isExpanded
          ? Object.keys(attrValue)
              .sort((a, b) => a.localeCompare(b))
              .flatMap((k) => (
                <JsonAttributeTree
                  key={k}
                  depth={depth + 1}
                  attrValue={attrValue[k]}
                  attrKey={k}
                  attrKeyJsonPath={joinObjectKey(attrKeyJsonPath, k)}
                  enableCopyActions={enableCopyActions}
                />
              ))
          : null,
        isExpandable: Object.keys(attrValue).length > 0,
        label: isExpanded ? `{${Object.keys(attrValue).length || " "}}` : "{⋯}",
        labelClassName: "text-text-subtlest",
      };
    }
    if (jsonType === "[object Array]") {
      return {
        children: isExpanded
          ? // oxlint-disable-next-line no-explicit-any
            attrValue.flatMap((v: any, i: number) => (
              <JsonAttributeTree
                // oxlint-disable-next-line react/no-array-index-key
                key={i}
                depth={depth + 1}
                attrValue={v}
                attrKey={i}
                attrKeyJsonPath={joinArrayKey(attrKeyJsonPath, i)}
                enableCopyActions={enableCopyActions}
              />
            ))
          : null,
        isExpandable: attrValue.length > 0,
        label: isExpanded ? `[${attrValue.length || " "}]` : "[⋯]",
        labelClassName: "text-text-subtlest",
      };
    }
    return {
      children: null,
      isExpandable: false,
      label: jsonType === "[object String]" ? `"${attrValue}"` : `${attrValue}`,
      labelClassName: classNames(
        jsonType === "[object Boolean]" && "text-primary",
        jsonType === "[object Number]" && "text-info",
        jsonType === "[object String]" && "text-notice",
        jsonType === "[object Null]" && "text-danger",
      ),
    };
  }, [attrValue, attrKeyJsonPath, isExpanded, depth]);

  const labelEl = (
    <span
      className={classNames(labelClassName, "cursor-text select-text group-hover:text-text-subtle")}
    >
      {label}
    </span>
  );

  const copyValue = () => copyToClipboard(formatNodeValue(attrValue));
  const copyPath = () => copyToClipboard(normalizeJsonPathForCopy(attrKeyJsonPath));

  return (
    <div
      className={classNames(
        className,
        /*depth === 0 && '-ml-4',*/ "font-mono text-xs",
        depth === 0 && "h-full overflow-y-auto pb-2",
      )}
    >
      <div className="group flex items-center gap-2">
        {isExpandable ? (
          <button
            type="button"
            className="group/toggle relative flex items-center pl-4 min-w-0 flex-1 text-left"
            onClick={toggleExpanded}
          >
            <Icon
              size="xs"
              icon="chevron_right"
              className={classNames(
                "left-0 absolute transition-transform flex items-center",
                "group-hover/toggle:text-text-subtle",
                isExpanded ? "rotate-90" : "",
              )}
            />
            <span className="text-primary group-hover/toggle:text-primary mr-1.5 whitespace-nowrap">
              {attrKey === undefined ? "$" : attrKey}:
            </span>
            {labelEl}
          </button>
        ) : (
          <div className="flex items-center min-w-0 flex-1">
            <span className="text-primary mr-1.5 pl-4 whitespace-nowrap cursor-text select-text">
              {attrKey === undefined ? "$" : attrKey}:
            </span>
            {labelEl}
          </div>
        )}
        {enableCopyActions && (
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              size="2xs"
              variant="border"
              title="复制值"
              onClick={(e) => {
                e.stopPropagation();
                copyValue();
              }}
            >
              值
            </Button>
            <Button
              size="2xs"
              variant="border"
              title="复制路径"
              onClick={(e) => {
                e.stopPropagation();
                copyPath();
              }}
            >
              路径
            </Button>
          </div>
        )}
      </div>
      {children && <div className="ml-4 whitespace-nowrap">{children}</div>}
    </div>
  );
};

function joinObjectKey(baseKey: string | undefined, key: string): string {
  const quotedKey = key.match(/^[a-z0-9_]+$/i) ? key : `\`${key}\``;

  if (baseKey == null) return quotedKey;
  return `${baseKey}.${quotedKey}`;
}

function joinArrayKey(baseKey: string | undefined, index: number): string {
  return `${baseKey ?? ""}[${index}]`;
}

function formatNodeValue(
  // oxlint-disable-next-line no-explicit-any
  value: any,
) {
  if (typeof value === "string") {
    return value;
  }

  if (
    value == null ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function normalizeJsonPathForCopy(path: string) {
  if (path === "$") {
    return "";
  }

  if (path.startsWith("$.")) {
    return path.slice(2);
  }

  if (path.startsWith("$[")) {
    return path.slice(1);
  }

  return path;
}
