import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

interface MailSecretStoreOptions {
  serviceName?: string;
}

export interface MailSecretStoreLike {
  setPassword(accountId: string, password: string): Promise<void>;
  getPassword(accountId: string): Promise<string>;
  deletePassword(accountId: string): Promise<void>;
}

export class MailSecretStore implements MailSecretStoreLike {
  private readonly serviceName: string;

  constructor(options: MailSecretStoreOptions = {}) {
    this.serviceName = options.serviceName ?? "Daily.IMAP";
  }

  async setPassword(accountId: string, password: string): Promise<void> {
    if (process.platform === "darwin") {
      await execFileAsync("security", [
        "add-generic-password",
        "-a",
        accountId,
        "-s",
        this.serviceName,
        "-U",
        "-w",
        password,
      ]);
      return;
    }

    if (process.platform === "win32") {
      await this.runWindowsCredentialScript(accountId, password, "set");
      return;
    }

    this.throwUnsupportedPlatform();
  }

  async getPassword(accountId: string): Promise<string> {
    if (process.platform === "darwin") {
      try {
        const { stdout } = await execFileAsync("security", [
          "find-generic-password",
          "-a",
          accountId,
          "-s",
          this.serviceName,
          "-w",
        ]);
        return stdout.trim();
      } catch {
        throw new Error(`No stored credential found for account ${accountId}`);
      }
    }

    if (process.platform === "win32") {
      const password = await this.runWindowsCredentialScript(accountId, undefined, "get");
      if (!password) {
        throw new Error(`No stored credential found for account ${accountId}`);
      }
      return password;
    }

    this.throwUnsupportedPlatform();
  }

  async deletePassword(accountId: string): Promise<void> {
    if (process.platform === "darwin") {
      try {
        await execFileAsync("security", [
          "delete-generic-password",
          "-a",
          accountId,
          "-s",
          this.serviceName,
        ]);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("could not be found")) {
          return;
        }

        throw error;
      }
      return;
    }

    if (process.platform === "win32") {
      await this.runWindowsCredentialScript(accountId, undefined, "delete");
      return;
    }

    this.throwUnsupportedPlatform();
  }

  private getWindowsTargetName(accountId: string): string {
    return `${this.serviceName}:${accountId}`;
  }

  private async runWindowsCredentialScript(
    accountId: string,
    password: string | undefined,
    action: "set" | "get" | "delete"
  ): Promise<string> {
    const targetName = this.getWindowsTargetName(accountId);
    const script = `
param(
  [string]$Action,
  [string]$TargetName,
  [string]$Secret
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class DailyCredentialManager {
  public const int CRED_TYPE_GENERIC = 1;
  public const int CRED_PERSIST_LOCAL_MACHINE = 2;

  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public UInt32 Flags;
    public UInt32 Type;
    public string TargetName;
    public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public UInt32 CredentialBlobSize;
    public IntPtr CredentialBlob;
    public UInt32 Persist;
    public UInt32 AttributeCount;
    public IntPtr Attributes;
    public string TargetAlias;
    public string UserName;
  }

  [DllImport("Advapi32.dll", EntryPoint = "CredWriteW", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool CredWrite(ref CREDENTIAL userCredential, UInt32 flags);

  [DllImport("Advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool CredRead(string target, UInt32 type, UInt32 reservedFlag, out IntPtr credentialPtr);

  [DllImport("Advapi32.dll", EntryPoint = "CredDeleteW", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool CredDelete(string target, UInt32 type, UInt32 flags);

  [DllImport("Advapi32.dll", SetLastError = true)]
  public static extern void CredFree([In] IntPtr cred);

  public static void Write(string targetName, string secret, string userName) {
    byte[] byteArray = Encoding.Unicode.GetBytes(secret);
    IntPtr blobPtr = Marshal.StringToCoTaskMemUni(secret);

    try {
      CREDENTIAL credential = new CREDENTIAL();
      credential.AttributeCount = 0;
      credential.Attributes = IntPtr.Zero;
      credential.Comment = null;
      credential.TargetAlias = null;
      credential.Type = CRED_TYPE_GENERIC;
      credential.Persist = CRED_PERSIST_LOCAL_MACHINE;
      credential.CredentialBlobSize = (UInt32)byteArray.Length;
      credential.TargetName = targetName;
      credential.CredentialBlob = blobPtr;
      credential.UserName = userName;

      if (!CredWrite(ref credential, 0)) {
        throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
      }
    } finally {
      Marshal.ZeroFreeCoTaskMemUnicode(blobPtr);
    }
  }

  public static string Read(string targetName) {
    IntPtr credPtr;
    bool read = CredRead(targetName, CRED_TYPE_GENERIC, 0, out credPtr);
    if (!read) {
      int error = Marshal.GetLastWin32Error();
      if (error == 1168) {
        return null;
      }
      throw new System.ComponentModel.Win32Exception(error);
    }

    try {
      CREDENTIAL credential = (CREDENTIAL)Marshal.PtrToStructure(credPtr, typeof(CREDENTIAL));
      if (credential.CredentialBlob == IntPtr.Zero || credential.CredentialBlobSize == 0) {
        return string.Empty;
      }
      return Marshal.PtrToStringUni(credential.CredentialBlob, (int)credential.CredentialBlobSize / 2);
    } finally {
      CredFree(credPtr);
    }
  }

  public static void Delete(string targetName) {
    bool deleted = CredDelete(targetName, CRED_TYPE_GENERIC, 0);
    if (!deleted) {
      int error = Marshal.GetLastWin32Error();
      if (error == 1168) {
        return;
      }
      throw new System.ComponentModel.Win32Exception(error);
    }
  }
}
"@

switch ($Action) {
  "set" {
    [DailyCredentialManager]::Write($TargetName, $Secret, $TargetName)
    return
  }
  "get" {
    $value = [DailyCredentialManager]::Read($TargetName)
    if ($null -ne $value) {
      Write-Output $value
    }
    return
  }
  "delete" {
    [DailyCredentialManager]::Delete($TargetName)
    return
  }
  default {
    throw "Unsupported action: $Action"
  }
}
`;

    const { stdout } = await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script,
        "-Action",
        action,
        "-TargetName",
        targetName,
        "-Secret",
        password ?? "",
      ],
      {
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      }
    );

    return stdout.trim();
  }

  private throwUnsupportedPlatform(): never {
    throw new Error("MailSecretStore currently supports macOS Keychain and Windows Credential Manager only");
  }
}
