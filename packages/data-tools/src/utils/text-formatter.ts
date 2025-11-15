/**
 * Text formatting utilities for terminal output
 */

export interface TextWrapOptions {
  maxWidth?: number
  indent?: string
  firstLineIndent?: string
}

export class TextFormatter {
  private defaultMaxWidth: number

  constructor(defaultMaxWidth: number = 80) {
    this.defaultMaxWidth = defaultMaxWidth
  }

  /**
   * Wrap text at word boundaries
   */
  wrap(text: string, options: TextWrapOptions = {}): string[] {
    const maxWidth = options.maxWidth ?? this.defaultMaxWidth
    const indent = options.indent ?? ''
    const firstLineIndent = options.firstLineIndent ?? indent

    const words = text.split(' ')
    const lines: string[] = []
    let currentLine = ''
    let isFirstLine = true

    for (const word of words) {
      const lineIndent = isFirstLine ? firstLineIndent : indent
      const availableWidth = maxWidth - lineIndent.length

      if ((currentLine + word).length <= availableWidth) {
        currentLine += (currentLine ? ' ' : '') + word
      } else {
        if (currentLine) {
          lines.push(lineIndent + currentLine)
          isFirstLine = false
        }
        currentLine = word
      }
    }

    if (currentLine) {
      const lineIndent = isFirstLine ? firstLineIndent : indent
      lines.push(lineIndent + currentLine)
    }

    return lines
  }

  /**
   * Wrap text with quotes properly handled
   */
  wrapQuoted(text: string, options: TextWrapOptions = {}): string[] {
    const maxWidth = options.maxWidth ?? this.defaultMaxWidth
    const indent = options.indent ?? ''

    const lines = this.wrap(text, { ...options, maxWidth: maxWidth - 2 }) // Account for quotes

    return lines.map((line, idx) => {
      if (idx === 0) {
        return `"${line}`
      } else if (idx === lines.length - 1) {
        return `${indent} ${line}"`
      } else {
        return `${indent} ${line}`
      }
    })
  }

  /**
   * Wrap and print multiple lines
   */
  wrapAndPrint(
    text: string,
    printFn: (line: string) => void,
    options: TextWrapOptions = {}
  ): void {
    const lines = this.wrap(text, options)
    lines.forEach(line => printFn(line))
  }

  /**
   * Wrap quoted text and print
   */
  wrapQuotedAndPrint(
    text: string,
    printFn: (line: string) => void,
    options: TextWrapOptions = {}
  ): void {
    const lines = this.wrapQuoted(text, options)
    lines.forEach(line => printFn(line))
  }
}

/**
 * Default formatter instance
 */
export const defaultFormatter = new TextFormatter(80)
