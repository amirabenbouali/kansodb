export class LexerError extends Error {
  public readonly position: number;

  public constructor(message: string, position: number) {
    super(`${message} at position ${position}`);
    this.name = "LexerError";
    this.position = position;
  }
}
