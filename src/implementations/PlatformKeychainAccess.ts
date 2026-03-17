import { Layer } from "effect"
import { platform } from "node:os"
import { KeychainAccess } from "../services/KeychainAccess.js"
import { MacOsKeychainAccessLive } from "./MacOsKeychainAccess.js"
import { LinuxSecretServiceAccessLive } from "./LinuxSecretServiceAccess.js"
import { WindowsCredentialManagerAccessLive } from "./WindowsCredentialManagerAccess.js"

/**
 * Auto-detects the current OS and provides the appropriate KeychainAccess layer.
 *
 * - macOS:   uses `security` CLI (Keychain)
 * - Linux:   uses `secret-tool` (libsecret / Secret Service API)
 * - Windows: uses PowerShell + Credential Manager (advapi32 CredRead/cmdkey)
 */
export const PlatformKeychainAccessLive: Layer.Layer<KeychainAccess> =
  (() => {
    switch (platform()) {
      case "darwin":
        return MacOsKeychainAccessLive
      case "linux":
        return LinuxSecretServiceAccessLive
      case "win32":
        return WindowsCredentialManagerAccessLive
      default:
        throw new Error(
          `Unsupported platform: ${platform()}. Supported: macOS, Linux, Windows.`,
        )
    }
  })()
