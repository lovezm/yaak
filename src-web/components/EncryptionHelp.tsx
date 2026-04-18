import { VStack } from "./core/Stacks";
import { t } from "../lib/i18n";

export function EncryptionHelp() {
  return (
    <VStack space={3}>
      <p>{t("Encrypt passwords, tokens, and other sensitive info when encryption is enabled.")}</p>
      <p>
        {t(
          "Encrypted data remains secure when syncing to the filesystem or Git, and when exporting or sharing with others.",
        )}
      </p>
    </VStack>
  );
}
