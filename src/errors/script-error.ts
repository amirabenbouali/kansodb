export type ScriptErrorCode = "LEX_ERROR" | "PARSE_ERROR" | "EXECUTION_ERROR" | "INVALID_SCRIPT";

export interface ScriptErrorOptions {
  code: ScriptErrorCode;
  message: string;
  causeName?: string;
  start?: number;
  end?: number;
}

export class ScriptError extends Error {
  public readonly code: ScriptErrorCode;
  public readonly causeName?: string;
  public readonly start?: number;
  public readonly end?: number;

  public constructor(options: ScriptErrorOptions) {
    super(options.message);
    this.name = "ScriptError";
    this.code = options.code;

    if (options.causeName !== undefined) {
      this.causeName = options.causeName;
    }

    if (options.start !== undefined) {
      this.start = options.start;
    }

    if (options.end !== undefined) {
      this.end = options.end;
    }
  }
}
