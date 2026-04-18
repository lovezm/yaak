import type { GitCommit } from "@yaakapp-internal/git";
import { formatDistanceToNowStrict } from "date-fns";
import { t } from "../../lib/i18n";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TruncatedWideTableCell,
} from "../core/Table";

interface Props {
  log: GitCommit[];
}

export function HistoryDialog({ log }: Props) {
  return (
    <div className="pl-5 pr-1 pb-1">
      <Table scrollable className="px-1">
        <TableHead>
          <TableRow>
            <TableHeaderCell>{t("Message")}</TableHeaderCell>
            <TableHeaderCell>{t("Author")}</TableHeaderCell>
            <TableHeaderCell>{t("When")}</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {log.map((l) => (
            <TableRow
              key={(l.author.name ?? "") + (l.author.email ?? "") + (l.message ?? "n/a") + l.when}
            >
              <TruncatedWideTableCell>
                {l.message || <em className="text-text-subtle">{t("No message")}</em>}
              </TruncatedWideTableCell>
              <TableCell>
                <span title={`${t("Email")}: ${l.author.email}`}>{l.author.name || t("Unknown")}</span>
              </TableCell>
              <TableCell className="text-text-subtle">
                <span title={l.when}>
                  {formatDistanceToNowStrict(l.when)} {t("ago")}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
