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
    this.ensureDarwin();
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
  }

  async getPassword(accountId: string): Promise<string> {
    this.ensureDarwin();

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
    } catch (error) {
      throw new Error(`No stored credential found for account ${accountId}`);
    }
  }

  async deletePassword(accountId: string): Promise<void> {
    this.ensureDarwin();

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
  }

  private ensureDarwin(): void {
    if (process.platform !== "darwin") {
      throw new Error("MailSecretStore currently supports macOS Keychain only");
    }
  }
}
