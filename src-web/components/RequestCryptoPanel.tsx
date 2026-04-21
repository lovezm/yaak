import CryptoJS from "crypto-js";
import JSEncrypt from "jsencrypt";
import { useMemo, useState } from "react";
import { t } from "../lib/i18n";
import { showToast } from "../lib/toast";
import { Button } from "./core/Button";
import { Select } from "./core/Select";
import { VStack } from "./core/Stacks";

type CryptoAlgorithm =
  | "aes"
  | "des"
  | "tripledes"
  | "rc4"
  | "rabbit"
  | "rsa"
  | "md5"
  | "sha1"
  | "sha256"
  | "sha512"
  | "base64"
  | "hex"
  | "url"
  | "url_component";

type CipherMode = "CBC" | "ECB" | "CFB" | "CTR" | "OFB";
type PaddingMode =
  | "Pkcs7"
  | "AnsiX923"
  | "Iso10126"
  | "Iso97971"
  | "ZeroPadding"
  | "NoPadding";
type DataEncoding = "utf8" | "hex" | "base64";
type OutputEncoding = "none" | "base64" | "hex";

interface CryptoPanelState {
  algorithm: CryptoAlgorithm;
  mode: CipherMode;
  padding: PaddingMode;
  key: string;
  iv: string;
  outputEncoding: OutputEncoding;
  plainText: string;
  cipherText: string;
  rsaPublicKey: string;
  rsaPrivateKey: string;
}

const DEFAULT_STATE: CryptoPanelState = {
  algorithm: "aes",
  mode: "CBC",
  padding: "Pkcs7",
  key: "",
  iv: "",
  outputEncoding: "base64",
  plainText: "",
  cipherText: "",
  rsaPublicKey: "",
  rsaPrivateKey: "",
};

const ALGORITHM_OPTIONS = [
  { value: "aes", label: "AES" },
  { value: "des", label: "DES" },
  { value: "tripledes", label: "3DES" },
  { value: "rc4", label: "RC4" },
  { value: "rabbit", label: "Rabbit" },
  { value: "rsa", label: "RSA" },
  { value: "md5", label: "MD5" },
  { value: "sha1", label: "SHA1" },
  { value: "sha256", label: "SHA256" },
  { value: "sha512", label: "SHA512" },
  { value: "base64", label: "Base64" },
  { value: "hex", label: "Hex" },
  { value: "url", label: "URL Encode" },
  { value: "url_component", label: "URL Component" },
] as const;

const MODE_OPTIONS = [
  { value: "CBC", label: "CBC" },
  { value: "ECB", label: "ECB" },
  { value: "CFB", label: "CFB" },
  { value: "CTR", label: "CTR" },
  { value: "OFB", label: "OFB" },
] as const;

const PADDING_OPTIONS = [
  { value: "Pkcs7", label: "Pkcs7" },
  { value: "AnsiX923", label: "AnsiX923" },
  { value: "Iso10126", label: "Iso10126" },
  { value: "Iso97971", label: "Iso97971" },
  { value: "ZeroPadding", label: "ZeroPadding" },
  { value: "NoPadding", label: "NoPadding" },
] as const;

const OUTPUT_ENCODING_OPTIONS = [
  { value: "none", label: "None" },
  { value: "base64", label: "Base64" },
  { value: "hex", label: "Hex" },
] as const;

export function RequestCryptoPanel() {
  const [state, setState] = useState<CryptoPanelState>(DEFAULT_STATE);

  const algorithmType = useMemo(() => getAlgorithmType(state.algorithm), [state.algorithm]);
  const needsIv = algorithmType === "symmetric" && state.algorithm !== "rc4" && state.algorithm !== "rabbit" && state.mode !== "ECB";
  const usesMode = algorithmType === "symmetric" && state.algorithm !== "rc4" && state.algorithm !== "rabbit";
  const usesPadding = algorithmType === "symmetric" && state.algorithm !== "rc4" && state.algorithm !== "rabbit";
  const usesKey = algorithmType === "symmetric";
  const usesOutputEncoding = algorithmType === "symmetric" || algorithmType === "hash";

  const updateState = <K extends keyof CryptoPanelState>(key: K, value: CryptoPanelState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const handleEncrypt = () => {
    try {
      const nextValue = encryptValue(state);
      updateState("cipherText", nextValue);
    } catch (err) {
      showCryptoError(err, t("Encryption failed"));
    }
  };

  const handleDecrypt = () => {
    try {
      const nextValue = decryptValue(state);
      updateState("plainText", nextValue);
    } catch (err) {
      showCryptoError(err, t("Decryption failed"));
    }
  };

  return (
    <div className="grid grid-rows-[auto_auto_minmax(0,1fr)] gap-3 h-full min-h-0 overflow-y-auto pr-1 pb-3">
      <div className="rounded-md border border-border-subtle bg-surface p-3">
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-3">
          <Select
            name="crypto-algorithm"
            label={t("Algorithm")}
            value={state.algorithm}
            options={[...ALGORITHM_OPTIONS]}
            onChange={(value) => updateState("algorithm", value)}
          />
          {usesMode && (
            <Select
              name="crypto-mode"
              label={t("Mode")}
              value={state.mode}
              options={[...MODE_OPTIONS]}
              onChange={(value) => updateState("mode", value)}
            />
          )}
          {usesPadding && (
            <Select
              name="crypto-padding"
              label={t("Padding")}
              value={state.padding}
              options={[...PADDING_OPTIONS]}
              onChange={(value) => updateState("padding", value)}
            />
          )}
          {usesOutputEncoding && (
            <Select
              name="crypto-output-encoding"
              label={t("Ciphertext encoding")}
              value={state.outputEncoding}
              options={[...OUTPUT_ENCODING_OPTIONS]}
              onChange={(value) => updateState("outputEncoding", value)}
            />
          )}
        </div>
      </div>

      {(usesKey || algorithmType === "asymmetric") && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {usesKey && (
            <div className="rounded-md border border-border-subtle p-3">
              <div className="grid grid-cols-1 gap-3">
                <SingleLineField
                  label={t("Key")}
                  value={state.key}
                  onChange={(value) => updateState("key", value)}
                  placeholder="secret-key"
                />
              </div>
            </div>
          )}

          {usesKey && needsIv && (
            <div className="rounded-md border border-border-subtle p-3">
              <div className="grid grid-cols-1 gap-3">
                <SingleLineField
                  label="IV"
                  value={state.iv}
                  onChange={(value) => updateState("iv", value)}
                  placeholder="initial-vector"
                />
              </div>
            </div>
          )}

          {algorithmType === "asymmetric" && (
            <>
              <TextAreaField
                label={t("Public key")}
                value={state.rsaPublicKey}
                onChange={(value) => updateState("rsaPublicKey", value)}
                placeholder="-----BEGIN PUBLIC KEY-----"
                rows={6}
              />
              <TextAreaField
                label={t("Private key")}
                value={state.rsaPrivateKey}
                onChange={(value) => updateState("rsaPrivateKey", value)}
                placeholder="-----BEGIN PRIVATE KEY-----"
                rows={6}
              />
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-3 min-h-0 items-stretch">
        <TextAreaField
          label={t("Plaintext")}
          value={state.plainText}
          onChange={(value) => updateState("plainText", value)}
          placeholder={t("Enter plaintext or data to encode")}
          rows={10}
          className="min-h-[14rem] 2xl:min-h-[18rem]"
        />
        <VStack
          space={2}
          justifyContent="center"
          className="items-stretch justify-center 2xl:w-[7rem] 2xl:self-center"
        >
          <Button size="sm" color="primary" className="min-w-[7rem]" onClick={handleEncrypt}>
            {t("Encrypt")}
          </Button>
          <Button size="sm" variant="border" className="min-w-[7rem]" onClick={handleDecrypt}>
            {t("Decrypt")}
          </Button>
        </VStack>
        <TextAreaField
          label={t("Ciphertext")}
          value={state.cipherText}
          onChange={(value) => updateState("cipherText", value)}
          placeholder={t("Encrypted result or encoded text")}
          rows={10}
          className="min-h-[14rem] 2xl:min-h-[18rem]"
        />
      </div>
    </div>
  );
}

function SingleLineField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="w-full">
      <div className="text-sm text-text mb-1">{label}</div>
      <input
        name={`crypto-${label}`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        className="x-theme-input w-full rounded-md border border-border-subtle bg-transparent px-3 py-2 text-sm font-mono outline-none focus:border-border-focus"
      />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-sm text-text mb-1">{label}</div>
      <textarea
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="x-theme-input w-full h-full min-h-[10rem] rounded-md border border-border-subtle bg-transparent px-3 py-2 text-sm font-mono outline-none focus:border-border-focus resize-y"
      />
    </div>
  );
}

function getAlgorithmType(algorithm: CryptoAlgorithm) {
  if (algorithm === "rsa") return "asymmetric" as const;
  if (algorithm === "md5" || algorithm === "sha1" || algorithm === "sha256" || algorithm === "sha512") {
    return "hash" as const;
  }
  if (algorithm === "base64" || algorithm === "hex" || algorithm === "url" || algorithm === "url_component") {
    return "encoding" as const;
  }
  return "symmetric" as const;
}

function encryptValue(state: CryptoPanelState): string {
  switch (getAlgorithmType(state.algorithm)) {
    case "symmetric":
      return encryptSymmetric(state);
    case "hash":
      return hashText(state);
    case "encoding":
      return encodeText(state);
    case "asymmetric":
      return encryptRsa(state);
  }
}

function decryptValue(state: CryptoPanelState): string {
  switch (getAlgorithmType(state.algorithm)) {
    case "symmetric":
      return decryptSymmetric(state);
    case "hash":
      throw new Error(t("Hash algorithms cannot be decrypted"));
    case "encoding":
      return decodeText(state);
    case "asymmetric":
      return decryptRsa(state);
  }
}

function encryptSymmetric(state: CryptoPanelState): string {
  ensureValue(state.plainText, t("Plaintext"));
  ensureValue(state.key, t("Key"));
  const key = parseSymmetricKey(state);
  const options = buildCipherOptions(state);

  switch (state.algorithm) {
    case "aes":
      return formatCipherText(CryptoJS.AES.encrypt(state.plainText, key, options).ciphertext, state.outputEncoding);
    case "des":
      return formatCipherText(CryptoJS.DES.encrypt(state.plainText, key, options).ciphertext, state.outputEncoding);
    case "tripledes":
      return formatCipherText(CryptoJS.TripleDES.encrypt(state.plainText, key, options).ciphertext, state.outputEncoding);
    case "rc4":
      return formatCipherText(CryptoJS.RC4.encrypt(state.plainText, key).ciphertext, state.outputEncoding);
    case "rabbit":
      return formatCipherText(CryptoJS.Rabbit.encrypt(state.plainText, key).ciphertext, state.outputEncoding);
    default:
      throw new Error(t("Unsupported algorithm"));
  }
}

function decryptSymmetric(state: CryptoPanelState): string {
  ensureValue(state.cipherText, t("Ciphertext"));
  ensureValue(state.key, t("Key"));
  const key = parseSymmetricKey(state);
  const cipherParams = CryptoJS.lib.CipherParams.create({
    ciphertext: parseWordArray(state.cipherText, state.outputEncoding),
  });
  const options = buildCipherOptions(state);

  let decrypted: CryptoJS.lib.WordArray;
  switch (state.algorithm) {
    case "aes":
      decrypted = CryptoJS.AES.decrypt(cipherParams, key, options);
      break;
    case "des":
      decrypted = CryptoJS.DES.decrypt(cipherParams, key, options);
      break;
    case "tripledes":
      decrypted = CryptoJS.TripleDES.decrypt(cipherParams, key, options);
      break;
    case "rc4":
      decrypted = CryptoJS.RC4.decrypt(cipherParams, key);
      break;
    case "rabbit":
      decrypted = CryptoJS.Rabbit.decrypt(cipherParams, key);
      break;
    default:
      throw new Error(t("Unsupported algorithm"));
  }

  return decrypted.toString(CryptoJS.enc.Utf8);
}

function hashText(state: CryptoPanelState): string {
  ensureValue(state.plainText, t("Plaintext"));

  let digest: CryptoJS.lib.WordArray;
  switch (state.algorithm) {
    case "md5":
      digest = CryptoJS.MD5(state.plainText);
      break;
    case "sha1":
      digest = CryptoJS.SHA1(state.plainText);
      break;
    case "sha256":
      digest = CryptoJS.SHA256(state.plainText);
      break;
    case "sha512":
      digest = CryptoJS.SHA512(state.plainText);
      break;
    default:
      throw new Error(t("Unsupported algorithm"));
  }

  return formatCipherText(digest, state.outputEncoding);
}

function encodeText(state: CryptoPanelState): string {
  ensureValue(state.plainText, t("Plaintext"));
  switch (state.algorithm) {
    case "base64":
      return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(state.plainText));
    case "hex":
      return CryptoJS.enc.Hex.stringify(CryptoJS.enc.Utf8.parse(state.plainText));
    case "url":
      return encodeURI(state.plainText);
    case "url_component":
      return encodeURIComponent(state.plainText);
    default:
      throw new Error(t("Unsupported algorithm"));
  }
}

function decodeText(state: CryptoPanelState): string {
  ensureValue(state.cipherText, t("Ciphertext"));
  switch (state.algorithm) {
    case "base64":
      return CryptoJS.enc.Base64.parse(cleanEncodedText(state.cipherText)).toString(CryptoJS.enc.Utf8);
    case "hex":
      return CryptoJS.enc.Hex.parse(cleanEncodedText(state.cipherText)).toString(CryptoJS.enc.Utf8);
    case "url":
      return decodeURI(state.cipherText);
    case "url_component":
      return decodeURIComponent(state.cipherText);
    default:
      throw new Error(t("Unsupported algorithm"));
  }
}

function encryptRsa(state: CryptoPanelState): string {
  ensureValue(state.plainText, t("Plaintext"));
  ensureValue(state.rsaPublicKey, t("Public key"));
  const encryptor = new JSEncrypt();
  encryptor.setPublicKey(state.rsaPublicKey);
  const encrypted = encryptor.encrypt(state.plainText);
  if (!encrypted) {
    throw new Error(t("RSA encryption failed"));
  }
  return encrypted;
}

function decryptRsa(state: CryptoPanelState): string {
  ensureValue(state.cipherText, t("Ciphertext"));
  ensureValue(state.rsaPrivateKey, t("Private key"));
  const encryptor = new JSEncrypt();
  encryptor.setPrivateKey(state.rsaPrivateKey);
  const decrypted = encryptor.decrypt(state.cipherText);
  if (decrypted == null || decrypted === false) {
    throw new Error(t("RSA decryption failed"));
  }
  return decrypted;
}

function buildCipherOptions(state: CryptoPanelState) {
  const options: Record<string, unknown> = {};

  if (state.algorithm !== "rc4" && state.algorithm !== "rabbit") {
    options.mode = getCipherMode(state.mode);
    options.padding = getCipherPadding(state.padding);
    if (state.mode !== "ECB") {
      ensureValue(state.iv, "IV");
      options.iv = CryptoJS.enc.Utf8.parse(state.iv);
    }
  }

  return options;
}

function parseSymmetricKey(state: CryptoPanelState) {
  return CryptoJS.enc.Utf8.parse(state.key);
}

function getCipherMode(mode: CipherMode) {
  switch (mode) {
    case "CBC":
      return CryptoJS.mode.CBC;
    case "ECB":
      return CryptoJS.mode.ECB;
    case "CFB":
      return CryptoJS.mode.CFB;
    case "CTR":
      return CryptoJS.mode.CTR;
    case "OFB":
      return CryptoJS.mode.OFB;
  }
}

function getCipherPadding(padding: PaddingMode) {
  switch (padding) {
    case "Pkcs7":
      return CryptoJS.pad.Pkcs7;
    case "AnsiX923":
      return CryptoJS.pad.AnsiX923;
    case "Iso10126":
      return CryptoJS.pad.Iso10126;
    case "Iso97971":
      return CryptoJS.pad.Iso97971;
    case "ZeroPadding":
      return CryptoJS.pad.ZeroPadding;
    case "NoPadding":
      return CryptoJS.pad.NoPadding;
  }
}

function parseWordArray(value: string, encoding: DataEncoding | OutputEncoding) {
  switch (encoding) {
    case "none":
      return CryptoJS.enc.Latin1.parse(value);
    case "utf8":
      return CryptoJS.enc.Utf8.parse(value);
    case "hex":
      return CryptoJS.enc.Hex.parse(cleanEncodedText(value));
    case "base64":
      return CryptoJS.enc.Base64.parse(cleanEncodedText(value));
  }
}

function formatCipherText(value: CryptoJS.lib.WordArray, encoding: OutputEncoding) {
  switch (encoding) {
    case "none":
      return CryptoJS.enc.Latin1.stringify(value);
    case "base64":
      return CryptoJS.enc.Base64.stringify(value);
    case "hex":
      return CryptoJS.enc.Hex.stringify(value);
  }
}

function cleanEncodedText(value: string) {
  return value.replace(/\s+/g, "");
}

function ensureValue(value: string, label: string) {
  if (value.trim() === "") {
    throw new Error(`${label}${t(" cannot be empty")}`);
  }
}

function showCryptoError(err: unknown, fallbackTitle: string) {
  const message = err instanceof Error ? err.message : String(err);
  showToast({
    color: "danger",
    message: `${fallbackTitle}: ${message}`,
  });
}
