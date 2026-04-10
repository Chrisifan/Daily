/**
 * 邮件解析模块
 * 负责解析 RFC822 格式邮件，提取标准字段、正文、附件等信息
 * 支持中文编码（GB2312、GBK、UTF-8）正确解析
 */

import { simpleParser, ParsedMail, Attachment } from "mailparser";
import iconv from "iconv-lite";
import { Buffer } from "buffer";
import {
  EmailMessage,
  EmailAddress,
  EmailBody,
  EmailAttachment,
  IcsEvent,
  EmailServiceError,
  EmailServiceErrorCode,
} from "./models/email.js";
import { parseIcsContent, detectIcsContent } from "./utils/ics-parser.js";

// ==================== 解析选项 ====================

export interface EmailParserOptions {
  /**
   * 是否将 HTML 正文转换为纯文本
   * @default true
   */
  convertHtmlToText?: boolean;
  /**
   * 是否解析 .ics 日历邀请附件
   * @default true
   */
  parseCalendarInvites?: boolean;
  /**
   * 解析正文的最大字符数（避免超大邮件）
   * @default 100000
   */
  maxBodyLength?: number;
  /**
   * 是否保留原始头部信息（调试用）
   * @default false
   */
  includeRawHeaders?: boolean;
}

// ==================== 解析器类 ====================

/**
 * 邮件解析器
 * 将原始邮件内容解析为结构化的 EmailMessage 对象
 */
export class EmailParser {
  private options: Required<EmailParserOptions>;

  constructor(options: EmailParserOptions = {}) {
    this.options = {
      convertHtmlToText: true,
      parseCalendarInvites: true,
      maxBodyLength: 100000,
      includeRawHeaders: false,
      ...options,
    };
  }

  /**
   * 解析原始邮件内容（Buffer 或 ReadableStream）
   * @param rawEmail - 原始邮件内容
   * @param accountId - 来源账户 ID
   * @param folder - 来源文件夹
   * @param uid - 邮件 UID
   * @param sequenceNo - 邮件序号
   * @returns 解析后的邮件对象
   */
  async parse(
    rawEmail: Buffer | NodeJS.ReadableStream,
    accountId: string,
    folder = "INBOX",
    uid?: number,
    sequenceNo?: number
  ): Promise<EmailMessage> {
    try {
      // 处理 Buffer（先检测并转换编码）
      let processedEmail = rawEmail;
      if (Buffer.isBuffer(rawEmail)) {
        processedEmail = this.preprocessBuffer(rawEmail);
      }

      const parsed = await simpleParser(processedEmail as Buffer, {});

      return this.convertToEmailMessage(parsed, accountId, folder, uid, sequenceNo);
    } catch (err) {
      console.error("[email-parser] 邮件解析失败:", err);
      const error =
        err instanceof Error
          ? err
          : new Error(String(err));
      throw new EmailServiceError(
        EmailServiceErrorCode.PARSE_FAILED,
        `邮件解析失败: ${error.message}`,
        error
      );
    }
  }

  /**
   * 批量解析邮件
   */
  async parseBatch(
    emails: Array<{ raw: Buffer; uid: number; sequenceNo: number }>,
    accountId: string,
    folder = "INBOX",
    onProgress?: (index: number, total: number) => void
  ): Promise<EmailMessage[]> {
    const results: EmailMessage[] = [];

    for (let i = 0; i < emails.length; i++) {
      const { raw, uid, sequenceNo } = emails[i];
      try {
        const email = await this.parse(raw, accountId, folder, uid, sequenceNo);
        results.push(email);
      } catch (err) {
        console.error(`[email-parser] 批量解析第 ${i + 1}/${emails.length} 封邮件失败:`, err);
        // 继续解析其他邮件，不中断
        results.push(this.createErrorEmail(uid, sequenceNo, accountId, folder, err as Error));
      }
      onProgress?.(i + 1, emails.length);
    }

    return results;
  }

  // ==================== 内部方法 ====================

  /**
   * 预处理邮件 Buffer
   * 处理编码问题，特别是中文邮件常见的 GB2312、GBK 编码
   */
  private preprocessBuffer(buffer: Buffer): Buffer {
    try {
      // 检测邮件内容编码
      // 邮件正文可能用 quoted-printable 或 base64 编码
      // 这里主要处理 Transfer Encoding 后的内容

      // 尝试检测并处理 GB2312/GBK 编码的中文邮件
      // 通过检测 Content-Type charset 参数来判断
      const headerStr = buffer.toString("ascii", 0, Math.min(buffer.length, 1024));
      const charsetMatch = headerStr.match(/charset=["']?([^"'\r\n]+)/i);

      if (charsetMatch) {
        const charset = charsetMatch[1].toUpperCase();
        const transferEncoding = headerStr.match(/Content-Transfer-Encoding:\s*(\S+)/i)?.[1]?.toUpperCase();

        if (charset === "GB2312" || charset === "GBK" || charset === "GB18030") {
          // 检测到中文编码，尝试转换
          try {
            // 先解码 Transfer Encoding（quoted-printable 或 base64）
            const decoded = this.decodeContent(buffer, transferEncoding);
            if (decoded) {
              // 将 GB2312/GBK 转换为 UTF-8
              const utf8Buffer = iconv.encode(
                iconv.decode(decoded, "gb2312"),
                "utf-8"
              );
              return utf8Buffer;
            }
          } catch {
            console.warn("[email-parser] GB2312/GBK 编码转换失败，使用原始内容");
          }
        }
      }

      return buffer;
    } catch (err) {
      console.warn("[email-parser] 预处理邮件内容失败:", err);
      return buffer;
    }
  }

  /**
   * 解码邮件内容（处理 quoted-printable 和 base64）
   */
  private decodeContent(
    buffer: Buffer,
    encoding?: string
  ): Buffer | null {
    if (!encoding) {
      return null;
    }

    try {
      if (encoding === "BASE64") {
        // 找到邮件头部结束位置（\r\n\r\n 或 \n\n）
        const headerEnd = this.findHeaderEnd(buffer);
        if (headerEnd === -1) {
          return buffer;
        }

        const bodyBuffer = buffer.slice(headerEnd);
        const bodyStr = bodyBuffer.toString("ascii").trim();
        return Buffer.from(bodyStr, "base64");
      }

      if (encoding === "QUOTED-PRINTABLE") {
        // quoted-printable 解码较复杂，这里做简化处理
        // 实际 mailparser 已经处理了这些编码，这里主要处理正文部分的编码转换
        return null;
      }

      return null;
    } catch (err) {
      console.warn("[email-parser] 内容解码失败:", err);
      return null;
    }
  }

  /**
   * 查找邮件头部结束位置
   */
  private findHeaderEnd(buffer: Buffer): number {
    // \r\n\r\n 或 \n\n
    for (let i = 0; i < buffer.length - 3; i++) {
      if (
        buffer[i] === 0x0d &&
        buffer[i + 1] === 0x0a &&
        buffer[i + 2] === 0x0d &&
        buffer[i + 3] === 0x0a
      ) {
        return i + 4;
      }
      if (buffer[i] === 0x0a && buffer[i + 1] === 0x0a) {
        return i + 2;
      }
    }
    return -1;
  }

  /**
   * 将 mailparser 的 ParsedMail 转换为 EmailMessage
   */
  private convertToEmailMessage(
    parsed: ParsedMail,
    accountId: string,
    folder: string,
    uid?: number,
    sequenceNo?: number
  ): EmailMessage {
    // 提取正文
    const body = this.extractBody(parsed);

    // 提取附件
    const attachments = this.extractAttachments(parsed);

    // 解析 ICS 日历邀请
    let icsEvents: IcsEvent[] | undefined;
    if (this.options.parseCalendarInvites) {
      icsEvents = this.parseCalendarEvents(attachments, parsed.messageId);
    }

    // 提取原始头部
    let rawHeaders: Record<string, string> | undefined;
    if (this.options.includeRawHeaders && parsed.headers) {
      rawHeaders = {};
      parsed.headers.forEach((value, key) => {
        // HeaderValue 可以是 string | string[] | AddressObject | Date | StructuredHeader | StructuredHeader[]
        // 转换为字符串便于存储
        rawHeaders![key] = typeof value === "string" ? value : JSON.stringify(value);
      });
    }

    // 处理 message-id
    const messageId = parsed.messageId?.replace(/^<|>$/g, "") ?? undefined;

    return {
      uid: uid ?? 0,
      sequenceNo: sequenceNo ?? 0,
      messageId,
      threadId: parsed.inReplyTo?.replace(/^<|>$/g, "") ?? undefined,
      subject: parsed.subject ?? undefined,
      from: this.extractAddressFromObject(parsed.from),
      to: this.extractAddressList(parsed.to),
      cc: this.extractAddressList(parsed.cc),
      bcc: this.extractAddressList(parsed.bcc),
      date: parsed.date ?? new Date(),
      body,
      attachments,
      seen: false,
      draft: false,
      answered: false,
      forwarded: false,
      hasAttachments: attachments.length > 0,
      size: 0,
      accountId,
      folder,
      icsEvents: icsEvents && icsEvents.length > 0 ? icsEvents : undefined,
      rawHeaders,
      parsedAt: new Date().toISOString(),
    };
  }

  /**
   * 提取邮件正文
   */
  private extractBody(parsed: ParsedMail): EmailBody {
    const body: EmailBody = {};

    // 优先提取纯文本正文
    if (parsed.text) {
      body.text = this.truncateText(parsed.text, this.options.maxBodyLength);
      body.textFromHtml = false;
    }

    // 处理 HTML 正文
    if (parsed.html) {
      if (this.options.convertHtmlToText) {
        // 将 HTML 转换为纯文本
        if (!body.text) {
          body.text = this.htmlToText(parsed.html);
          body.textFromHtml = true;
        }
      } else {
        body.html = this.truncateText(parsed.html, this.options.maxBodyLength);
      }
    }

    return body;
  }

  /**
   * 提取附件列表（只含元信息）
   */
  private extractAttachments(parsed: ParsedMail): EmailAttachment[] {
    if (!parsed.attachments || parsed.attachments.length === 0) {
      return [];
    }

    return parsed.attachments.map((attachment: Attachment, index: number) => {
      const dispHeader = attachment.headers.get("content-disposition");
      const dispositionStr = typeof dispHeader === "string" ? dispHeader : "";
      const isInline = dispositionStr.includes("inline");
      const contentType = attachment.contentType ?? "application/octet-stream";
      const isCalendarInvite =
        contentType === "text/calendar" ||
        (attachment.filename?.toLowerCase().endsWith(".ics") ?? false) ||
        detectIcsContent(attachment.content?.toString("utf-8") ?? "");

      return {
        id: `att-${index}-${Date.now()}`,
        filename: attachment.filename ?? "unknown",
        contentType,
        size: attachment.size ?? 0,
        inline: isInline,
        cid: isInline ? (attachment.cid ?? undefined) : undefined,
        disposition: dispositionStr || undefined,
        isCalendarInvite,
      };
    });
  }

  /**
   * 解析日历邀请附件
   */
  private parseCalendarEvents(
    attachments: EmailAttachment[],
    messageId?: string
  ): IcsEvent[] {
    const events: IcsEvent[] = [];

    for (const attachment of attachments) {
      if (!attachment.isCalendarInvite) {
        continue;
      }

      // 注意：这里需要原始 ICS 内容，实际应用中需要从邮件原始内容中提取
      // 简化处理：如果 mailparser 能解析出 calendar 事件
      // 由于 mailparser 3.x 对 ical 的支持有限，这里标记为需要单独处理
      console.debug(
        `[email-parser] 检测到日历邀请附件: ${attachment.filename}`
      );
      // 实际的 ICS 解析需要访问邮件原始内容的附件部分
      // 在 fetchEmail 时需要额外处理附件的 content
    }

    return events;
  }

  /**
   * 转换邮件地址格式
   */
  private convertAddress(address: { name?: string; address?: string } | undefined): EmailAddress | null {
    if (!address || !address.address) {
      return null;
    }
    return {
      name: address.name ?? undefined,
      address: address.address,
    };
  }

  /**
   * 从 AddressObject 或 AddressObject[] 中提取单个地址
   */
  private extractAddressFromObject(
    addr: ParsedMail["from"] // AddressObject | AddressObject[] | undefined
  ): EmailAddress | undefined {
    if (!addr) return undefined;
    if (Array.isArray(addr)) {
      const first = addr[0];
      if (!first) return undefined;
      return {
        name: first.name || undefined,
        address: first.address || "",
      };
    }
    const first = addr.value?.[0];
    if (!first) return undefined;
    return {
      name: first.name || undefined,
      address: first.address || "",
    };
  }

  /**
   * 从 AddressObject 或 AddressObject[] 中提取地址列表
   */
  private extractAddressList(
    addr: ParsedMail["to"] // AddressObject | AddressObject[] | undefined
  ): EmailAddress[] {
    if (!addr) return [];
    if (Array.isArray(addr)) {
      const results: EmailAddress[] = [];
      for (const a of addr) {
        const first = a.value?.[0];
        if (first?.address) {
          results.push({ name: first.name || undefined, address: first.address });
        }
      }
      return results;
    }
    return (addr.value ?? [])
      .filter((a) => !!a.address)
      .map((a) => ({ name: a.name || undefined, address: a.address || "" }));
  }

  /**
   * 将 HTML 转换为纯文本
   */
  private htmlToText(html: string): string {
    // 简单的 HTML 转文本
    let text = html;

    // 移除 script 和 style 标签及其内容
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

    // 替换常用标签为空格
    text = text.replace(/<(br|hr)[^>]*>/gi, "\n");
    text = text.replace(/<\/p>/gi, "\n\n");
    text = text.replace(/<\/div>/gi, "\n");

    // 移除所有 HTML 标签
    text = text.replace(/<[^>]+>/g, "");

    // 解码 HTML 实体
    text = this.decodeHtmlEntities(text);

    // 清理多余空白
    text = text.replace(/[ \t]+/g, " ");
    text = text.replace(/\n\s*\n/g, "\n\n");

    return this.truncateText(text, this.options.maxBodyLength);
  }

  /**
   * 解码 HTML 实体
   */
  private decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
      "&nbsp;": " ",
      "&amp;": "&",
      "&lt;": "<",
      "&gt;": ">",
      "&quot;": '"',
      "&#39;": "'",
      "&apos;": "'",
      "&#x27;": "'",
      "&#x2F;": "/",
      "&mdash;": "\u2014",
      "&ndash;": "\u2013",
      "&hellip;": "\u2026",
      "&ldquo;": "\u201C",
      "&rdquo;": "\u201D",
      "&lsquo;": "\u2018",
      "&rsquo;": "\u2019",
    };

    let result = text;
    for (const [entity, char] of Object.entries(entities)) {
      result = result.replace(new RegExp(entity, "gi"), char);
    }

    // 解码数字形式的实体
    result = result.replace(/&#(\d+);/g, (_, code) =>
      String.fromCharCode(parseInt(code, 10))
    );
    result = result.replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(parseInt(code, 16))
    );

    return result;
  }

  /**
   * 截断文本
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.slice(0, maxLength) + "...(truncated)";
  }

  /**
   * 创建解析失败的占位邮件
   */
  private createErrorEmail(
    uid: number,
    sequenceNo: number,
    accountId: string,
    folder: string,
    error: Error
  ): EmailMessage {
    return {
      uid,
      sequenceNo,
      subject: "[解析失败]",
      to: [],
      date: new Date(),
      body: { text: `邮件解析失败: ${error.message}` },
      attachments: [],
      seen: false,
      draft: false,
      answered: false,
      forwarded: false,
      hasAttachments: false,
      size: 0,
      accountId,
      folder,
      parsedAt: new Date().toISOString(),
    };
  }
}

// ==================== 辅助函数 ====================

/**
 * 创建邮件解析器实例
 */
export function createEmailParser(options?: EmailParserOptions): EmailParser {
  return new EmailParser(options);
}

/**
 * 快速解析单封邮件（同步便捷方法）
 */
export async function parseEmail(
  rawEmail: Buffer | NodeJS.ReadableStream,
  accountId: string,
  folder?: string,
  uid?: number,
  sequenceNo?: number,
  options?: EmailParserOptions
): Promise<EmailMessage> {
  const parser = new EmailParser(options);
  return parser.parse(rawEmail, accountId, folder, uid, sequenceNo);
}
