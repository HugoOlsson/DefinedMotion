/* eslint-disable @typescript-eslint/explicit-function-return-type */

export class CliError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

export const cliFailure = (command, code, message) => ({
  success: false,
  command,
  error: { code, message }
})

export const delay = (milliseconds) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds))
