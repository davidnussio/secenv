import { platform } from "node:os";
import { Layer } from "effect";
import { UnsupportedPlatformError } from "../errors.js";
import type { KeychainAccess } from "../services/keychain-access.js";
import { LinuxSecretServiceAccessLive } from "./linux-secret-service-access.js";
import { MacOsKeychainAccessLive } from "./mac-os-keychain-access.js";
import { WindowsCredentialManagerAccessLive } from "./windows-credential-manager-access.js";

/**
 * Auto-detects the current OS and provides the appropriate KeychainAccess layer.
 *
 * - macOS:   uses `security` CLI (Keychain)
 * - Linux:   uses `secret-tool` (libsecret / Secret Service API)
 * - Windows: uses PowerShell + Credential Manager (advapi32 CredRead/cmdkey)
 */
export const PlatformKeychainAccessLive: Layer.Layer<
  KeychainAccess,
  UnsupportedPlatformError
> = (() => {
  switch (platform()) {
    case "darwin":
      return MacOsKeychainAccessLive;
    case "linux":
      return LinuxSecretServiceAccessLive;
    case "win32":
      return WindowsCredentialManagerAccessLive;
    default:
      return Layer.fail(
        new UnsupportedPlatformError({
          platform: platform(),
          message: `Unsupported platform: ${platform()}. Supported: macOS, Linux, Windows.`,
        })
      );
  }
})();
